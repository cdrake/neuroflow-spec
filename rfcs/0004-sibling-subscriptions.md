# RFC 0004: Sibling-Step Event Subscriptions

Status: Proposed

Created: 2026-05-24

## Summary

This RFC extends RFC 0002 (Runtime Events) so a workflow step can subscribe
to events emitted by sibling steps in the same workflow run, not only by its
own tool. Sibling subscriptions enable monitor, QC, orchestrator, and
aggregator patterns — tools that exist to react to other tools' progress and
products — without bespoke interprocess plumbing.

The companion specification text lives in
[spec/neuroflow-0.1.md §20](../spec/neuroflow-0.1.md). The schema definitions
live in [schemas/0.1/events.schema.json](../schemas/0.1/events.schema.json)
under `$defs.stepEventBindings.subscribeTo` and `$defs.siblingSubscription`.

## Decision

A step's `eventBindings.subscribeTo` declares a list of sibling subscriptions.
Each subscription names a sibling step and optionally filters by event type
and by tool-side channel name. The runtime forwards matching events into the
subscribing step's tool over its existing transport. Sibling forwarding
preserves the envelope verbatim — the subscriber sees the original `stepId`
and `toolId` of the emitter.

## Motivation

The runtime-events channel introduced in RFC 0002 connects a tool to the
runtime. Many neuroimaging pipelines also need tools to communicate with
each other:

- **QC dashboards** that watch a long-running converter's progress and
  publish a live summary.
- **Aggregators** that consume per-subject classifier output streams and
  produce a study-level table once enough subjects have been seen.
- **Validators** that watch the writer's outputs and signal failures back
  through the same event channel so an upstream fix step can react.
- **Orchestrators** that decide when to pause or branch based on a sibling's
  status.

Without sibling subscriptions, every such pattern has to invent its own
shared file, socket, or queue — which is exactly the fragmentation RFC 0002
set out to prevent.

## Goals

- Let any step listen to any sibling step's events in the same run.
- Filter by event type and by tool-side channel name.
- Reuse the same transports already defined in RFC 0002. The runtime is the
  forwarder; the wire protocol does not change.
- Preserve the original envelope, including `stepId` and `toolId`, so the
  subscribing tool can attribute events.
- Optionally route forwarded events to a named tool input so the tool's
  contract documents its sibling dependency.

## Non-goals

- Defining a pub/sub broker outside the runtime. Forwarding is the runtime's
  responsibility; tools see one event channel each.
- Cross-run subscriptions. A subscription is scoped to a single workflow run.
- Out-of-band sibling control messages (cancel, pause). Those are the
  bidirectional-transport open question from RFC 0002.

## Proposal

### 1. Subscription shape

```json
{
  "monitor": {
    "tool": "niivue.desktop.tools/qc-monitor",
    "inputs": {},
    "eventBindings": {
      "transport": "core:stdout-ndjson",
      "subscribeTo": [
        { "step": "convert", "types": ["core:progress", "core:status"] },
        { "step": "classify", "names": ["series_partial"], "inputBinding": "series_stream" }
      ]
    }
  }
}
```

`step` names a sibling step. `types` filters by event-type vocabulary. `names`
filters by the tool-side `events.emits` channel keys of the emitter.
`inputBinding` optionally pins forwarded events to a declared tool input on
the subscriber, making the dependency explicit in the tool contract.

### 2. Delivery semantics

The runtime delivers forwarded events to the subscriber over the subscriber's
chosen transport. The envelope is preserved unchanged — `stepId` is still the
emitter's, `sequence` is still the emitter's per-step counter. Subscribers
that consume multiple sibling streams MUST tolerate non-monotonic combined
sequences and rely on `(stepId, sequence)` for ordering within each stream.

### 3. Static validation

A validator MUST reject a subscription whose `step` is not declared,
whose `names[]` entries are not in the sibling tool's `events.emits` map,
or whose `inputBinding` is not declared on the subscriber's tool.

### 4. Provenance

Sibling subscriptions SHOULD appear in the provenance record as part of the
subscribing activity's narrative. No new entity type is required.

## Examples

### Monitor sibling

```json
{
  "monitor": {
    "tool": "niivue.desktop.tools/qc-monitor",
    "inputs": {},
    "eventBindings": {
      "subscribeTo": [
        { "step": "convert", "types": ["core:progress", "core:status", "core:error"] }
      ]
    }
  }
}
```

### Aggregator sibling

```json
{
  "aggregate": {
    "tool": "niivue.desktop.tools/study-aggregate",
    "inputs": {},
    "eventBindings": {
      "subscribeTo": [
        { "step": "classify-per-subject", "names": ["subject_done"], "inputBinding": "subject_stream" }
      ]
    }
  }
}
```

## Alternatives Considered

### Promote events to a workflow-level pub/sub bus

Considered and rejected. Adding a workflow-level bus means every tool is
implicitly on every channel, which conflicts with the declarative principle
that tool contracts should document their consumed inputs. Sibling
subscriptions stay opt-in and statically analyzable.

### Make subscribers connect to siblings directly

Considered and rejected. Direct connections would force every tool to
implement multiple transports and discover sibling endpoints on its own,
duplicating work the runtime already does for the primary tool→runtime
channel.

### Use context fields as the only communication medium between steps

Considered and partially adopted. Context fields remain the primary way
steps share *state*; sibling subscriptions are for *streams* (progress,
intermediate values, status transitions) that are awkward or expensive to
encode as context updates.

## Compatibility

This RFC adds an optional `subscribeTo` field to `eventBindings`. Existing
0.1 documents are unaffected. Runtimes that do not implement sibling
forwarding MUST still accept documents that declare it but MAY emit a
runtime warning and proceed without forwarding.

## Open Questions

- Should subscribers receive a synthetic `core:status` event when a sibling
  step finishes, even if the sibling didn't emit one?
- Should sibling forwarding survive a subscriber restart, or always be
  per-instance?
- Should subscribers be able to depend on a sibling that did not declare any
  `events` block (and therefore emits no events under RFC 0002)? The current
  design says no.

## Decision Outcome

Pending review.
