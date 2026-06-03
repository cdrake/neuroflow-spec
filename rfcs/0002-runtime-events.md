# RFC 0002: Runtime Events

Status: Proposed

Created: 2026-05-24

## Summary

This RFC adds a runtime-events channel to NeuroFlow 0.1: a normative,
transport-agnostic mechanism that lets a running tool emit progress,
log lines, lifecycle status, intermediate or final outputs, and proposed
writes to live-writable context fields back to the workflow runtime before
the step has finished.

The companion specification text lives in
[spec/neuroflow-0.1.md §19](../spec/neuroflow-0.1.md) and the schema
definitions live in
[schemas/0.1/events.schema.json](../schemas/0.1/events.schema.json).

## Decision

NeuroFlow 0.1 defines runtime events in the portable core, with a single JSON
envelope, a closed `core:` event-type vocabulary, and a closed `core:`
transport vocabulary that admits open extension transports. Tools declare
their capabilities under a top-level `events` block. Workflow steps subscribe
under `eventBindings`. Context fields that may be mutated live are explicitly
marked `liveWritable: true`.

## Motivation

The 0.1 core treats a step as a closed box: the runtime supplies inputs,
launches the tool, waits for completion, and then collects outputs and applies
`outputMappings`. That model is sufficient for short batch operations but
breaks down for the workflows NeuroFlow actually targets:

- DICOM-to-BIDS conversion runs for minutes and produces a stream of
  classifiable series that downstream UI wants to render as they appear.
- Skull-stripping and registration jobs need progress reporting and partial
  previews.
- Heuristics that depend on partial classifier output cannot run until the
  classifier finishes, even when an early answer would be useful.
- Designers cannot show live status without falling back to runtime-specific
  side channels (stdout scraping, log tailing, ad hoc files) that no other
  conforming runtime would understand.

A normative events channel keeps these UX-critical capabilities portable.

## Goals

- Define a single transport-agnostic JSON envelope for tool-to-runtime events.
- Define a closed core vocabulary for the event types runtimes must
  understand (`core:status`, `core:progress`, `core:log`, `core:heartbeat`,
  `core:context-write`, `core:output-intermediate`, `core:output-final`,
  `core:error`).
- Define a closed core vocabulary for transports (stdout/stderr NDJSON, event
  file, event directory, Unix socket, named pipe, TCP, HTTP webhook,
  WebSocket) and an extension grammar for additional transports.
- Let tools declare what they emit and on which transports.
- Let workflow steps subscribe to those events and bind them to context fields.
- Make live context writes safe: require the target field to opt in via
  `liveWritable: true`.
- Define environment-variable channel discovery so the same tool binary can
  run under any conforming runtime.

## Non-goals

- Defining a generic IPC framework. The events channel is one-way
  (tool → runtime) for all transports except `core:websocket`. Runtime
  control messages (cancel, pause, resume) are an open question deferred to
  a future RFC.
- Standardizing log format, metric format, or distributed tracing schemas.
  `core:log` carries free text; richer telemetry belongs in extension event
  types.
- Defining queueing, persistence, or replay semantics for events. Delivery is
  at-least-once within a single run; durable event stores are a runtime
  implementation concern.
- Replacing static `outputMappings`. `core:output-final` is an alternative
  delivery mechanism for the same value, not a replacement for the contract.

## Proposal

### 1. Envelope

Every event is a single JSON object with `neuroflowEvent`, `runId`, `stepId`,
`sequence`, `timestamp`, `type`, and `payload` (plus optional `toolId`,
`name`, and `token`). The envelope is normative; transports vary only in how
they frame and deliver it.

### 2. Closed core event types

The `core:` vocabulary is closed: validators MUST reject unknown `core:`
types. Extension event types use the qualified-type grammar
(`namespace:name`).

### 3. Closed core transports with extension fallback

The `core:` transport list is closed; extension transports follow the
qualified-type grammar. A runtime that cannot honor a tool's preferred
transport MUST select a mutually supported one or fail step launch with a
clear error.

### 4. Tool-side declaration

Tool documents add an optional `events` block:

```json
{
  "events": {
    "transports": ["core:stdout-ndjson"],
    "emits": {
      "progress": {
        "type": "core:progress",
        "description": "Per-volume conversion progress."
      },
      "series_list_partial": {
        "type": "core:context-write",
        "description": "Streams classified series as they are recognized.",
        "valueType": "core:array<neuro:series-mapping>"
      }
    }
  }
}
```

### 5. Workflow-side subscription

Workflow steps add an optional `eventBindings` block. `contextWrites` maps
tool-side channel names to context field local identifiers; the target
context field MUST be declared `liveWritable: true`.

```json
{
  "convert": {
    "tool": "niivue.desktop.tools/dcm2niix",
    "inputs": {},
    "eventBindings": {
      "contextWrites": {
        "series_list_partial": "series_list"
      }
    }
  }
}
```

### 6. Channel discovery

Runtimes signal the chosen transport and endpoint to the tool via
environment variables (`NEUROFLOW_EVENT_TRANSPORT`,
`NEUROFLOW_EVENT_ENDPOINT`, `NEUROFLOW_EVENT_TOKEN`, `NEUROFLOW_RUN_ID`,
`NEUROFLOW_STEP_ID`). Runtime profiles MAY also pass the values as CLI
arguments through their own extension.

### 7. Security

Events are untrusted input. Local transports SHOULD restrict file-system
permissions; network transports MUST either bind to loopback or carry a
shared secret. Runtimes MUST NOT execute payload values as code.

### 8. Effect on execution semantics

Section 17's step-evaluation rules extend in-place. Live context writes are
applied as events arrive; `core:output-final` satisfies an output for the
purpose of subsequent steps; `core:status` and fatal `core:error` events
terminate the step.

## Examples

See [examples/event-emitting-tool.neuroflow.json](../examples/event-emitting-tool.neuroflow.json)
for a tool document that declares emitted events, and the updated
[examples/niivue-dicom-to-bids.neuroflow.json](../examples/niivue-dicom-to-bids.neuroflow.json)
for the corresponding workflow-side `eventBindings`.

## Alternatives Considered

### Put events in an extension namespace

Considered and rejected. Events express user-visible workflow behavior
(progress reporting, live classification) that any conforming runtime is
expected to surface. Hiding the channel behind an opt-in extension would
fragment runtime support and force every UI to handle two cases.

### Define only the envelope and let transports be entirely open

Considered and rejected. With no closed transport vocabulary, two runtimes
could both claim conformance while sharing no transport — making a tool
unrunnable in practice across implementations. A closed core list with an
extension grammar preserves portability while leaving room for innovation.

### Block context writes; only allow progress/log/status events

Considered and rejected. The primary motivating use case — streaming
classifier output into `series_list` so the BIDS prep UI updates live —
requires context writes. We mitigate the risk with the `liveWritable`
opt-in and the explicit `contextWrites` binding map.

### Open all context fields to writes by default

Considered and rejected. A tool that bound to the wrong context channel
could silently overwrite user-edited state or interfere with heuristics.
Requiring `liveWritable: true` on the target field and an explicit binding
in the step keeps the surface area small.

### Standardize a binary or framed protocol (Protocol Buffers, MessagePack)

Considered and rejected for 0.1. NeuroFlow's design principle is JSON-first
and schema-validated. A binary transport could be added later as an
extension; nothing in the envelope precludes it.

## Migration Plan

1. Land `events.schema.json` and the `events` / `eventBindings` /
   `liveWritable` additions to `tool.schema.json` and `workflow.schema.json`.
2. Update the NiiVue Desktop loader to recognize tool `events` declarations
   and step `eventBindings`, and to wire at least the
   `core:stdout-ndjson` transport for child processes.
3. Add semantic validation for event-binding validity and event-transport
   compatibility.
4. Migrate one long-running NiiVue Desktop tool (likely the BIDS classifier)
   to emit `core:progress` and `core:context-write` events as a reference
   implementation.
5. Add an integration test that runs an event-emitting tool and asserts that
   bound context fields update live.

## Compatibility

This RFC adds optional fields only (`events` on tool documents,
`eventBindings` on steps, `liveWritable` on context fields). Existing 0.1
documents remain valid. Validators that do not implement events MUST still
accept documents that declare them.

## Open Questions

- Should heuristics that list a live-writable field in `dependsOn` re-run on
  each `core:context-write`, debounce, or only run once?
- Should the runtime expose back-pressure (slow-consumer signaling) on
  high-volume event streams?
- Should `core:websocket` (or a successor) standardize a runtime → tool
  control message vocabulary (cancel, pause, resume)?
- Should an event-aware tool be allowed to omit static `outputs` entirely
  when all outputs are emitted via `core:output-final`?
- Should we standardize a binary framing (length-prefixed JSON, CBOR) as a
  follow-up to the NDJSON transports?

## Decision Outcome

Pending review.
