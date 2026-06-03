# RFC 0007: Error Handling, Halt, and Notification

Status: Proposed

Created: 2026-05-24

## Summary

This RFC adds a portable error-handling model to NeuroFlow. It defines two
levels of failure (tool-level and per-item), gives each step an opt-in
tolerance policy, gives the workflow a halt / continue / notify / handle
policy, and records the resulting partial / halted / cancelled outcomes in
provenance. It also adds a cooperative cancellation event.

Resumption of failed or halted runs is explicitly **not** specified: that
is a runtime concern. NeuroFlow only defines the visible boundary so
different runtimes can interoperate on what happened and why.

The companion specification text lives in
[spec/neuroflow-0.1.md §22](../spec/neuroflow-0.1.md). Schema changes live
in:

- [schemas/0.1/events.schema.json](../schemas/0.1/events.schema.json) —
  adds `core:item-error` and `core:cancel-request` event types and their
  payload schemas.
- [schemas/0.1/workflow.schema.json](../schemas/0.1/workflow.schema.json) —
  adds `step.errorPolicy` and workflow-level `errorPolicy` with handler
  steps.
- [schemas/0.1/provenance.schema.json](../schemas/0.1/provenance.schema.json) —
  adds `partial` and `halted` run statuses, `partial` activity status,
  per-activity `itemFailures[]`, and the `handlerFor` link from handler
  activities back to the failing step.

## Decision

NeuroFlow 0.1 introduces two orthogonal layers of error handling:

1. **Item tolerance**, expressed by tools through `core:item-error` events
   and bounded by `step.errorPolicy.tolerateItemFailures`. The tool itself
   succeeds; only the bad inputs are dropped or annotated.
2. **Step-failure reaction**, expressed by `step.errorPolicy.onError` and
   `workflow.errorPolicy`. Steps may halt the workflow, continue with
   downstream dependents marked skipped, or trigger workflow-level handler
   steps for cleanup, reporting, and notification.

Cancellation is cooperative: the runtime emits `core:cancel-request`
through the runtime-events channel; tools that cooperate wind down and
emit `core:status` with state `cancelled`. Sibling-step orchestrators may
also request cancellation of their peers.

## Motivation

Neuroimaging pipelines routinely process tens to thousands of inputs and
hit a long tail of malformed cases:

- One subject in a 500-subject BIDS validation run has a corrupt sidecar.
- A few DICOM series in a batch convert cleanly but fail QC thresholds.
- A scanner exported one of twelve runs as a partial NIfTI.

In every case the desired outcome is "produce derivatives for the inputs
that worked, surface the ones that didn't, and don't lose half a day of
batch compute to one bad file." Today this is encoded ad-hoc by each
pipeline:

- BIDS-Apps return non-zero exit codes for per-subject failures, but
  whether the calling runtime halts is opaque to the workflow.
- MRIQC writes failure stubs but downstream tools must decide whether to
  consume them.
- Snakemake and Nextflow expose retry/`errorStrategy` directives, but
  these are runtime-private and don't survive translation to another
  engine.

Conversely, some failures *must* halt: if registration to a study
template fails, every downstream derivative is invalid. The same
workflow needs both tolerant batch steps and strict pinned steps, and
needs to record which mode each step ran in so the run is auditable.

Two reviewer needs framed the design:

- An **operator** who needs to know whether a 1000-input batch finished,
  finished with tolerated drops, or halted on something they need to
  intervene on — without grepping log files.
- A **downstream consumer** (a BIDS-App, an aggregator, a meta-analysis
  pipeline) who needs to know which entities are trustworthy and which
  were produced from partial inputs.

The portable error model surfaces both: provenance carries `partial`
status and `itemFailures[]` arrays, and the runtime emits notifications on
declared channels at well-defined points.

## Item failures vs. tool failures

A clean distinction matters because the runtime reacts differently to
each:

| Concern | Tool failure | Item failure |
| --- | --- | --- |
| Event | `core:status: failed`, `core:error: fatal=true`, non-zero exit | `core:item-error` (any number, mid-run) |
| Tool outputs | Missing or incomplete | Present, with bad items dropped or annotated |
| Default reaction | Step is failed; workflow halts | Step continues; failure recorded |
| Controlled by | `step.errorPolicy.onError` | `step.errorPolicy.tolerateItemFailures` |
| Activity status | `failed` (or `cancelled`) | `completed` or `partial` |

A tool MAY emit both: a `core:item-error` for each malformed sidecar
in a batch, followed by a `core:status: failed` if the surviving set
falls below the tool's internal threshold. The runtime sees the same
sequence and applies the per-step policy.

## Step `errorPolicy`

```json
{
  "convert_dicoms": {
    "tool": "niivue.desktop.tools/dcm2niix",
    "inputs": {
      "dicom_dirs": { "ref": "inputs.dicom_dirs" }
    },
    "errorPolicy": {
      "onError": "continue",
      "tolerateItemFailures": { "maxFraction": 0.05, "minSuccesses": 1 },
      "requiredOutputs": ["niftis"],
      "notify": ["niivue:desktop-toast"]
    }
  }
}
```

Three bounds combine: `max` (absolute), `maxFraction` (ratio against the
total reported via `core:progress`), and `minSuccesses` (lower bound on
processed items). Crossing any one bound flips the step to failed.

`requiredOutputs` lets the workflow author insist on shape — even a
tolerant step must produce at least the named outputs, and `array<...>`
outputs in the list must be non-empty.

`onError` values: `halt`, `continue`, `skip-dependents`, `notify`. They
compose with `workflow.errorPolicy.haltOnSteps` (which pins specific
steps to halt regardless) and `workflow.errorPolicy.onError` (which
triggers handler steps when the run halts or completes with failures).

## Workflow `errorPolicy`

```json
{
  "errorPolicy": {
    "defaultOnError": "continue",
    "haltOnSteps": ["register_to_template"],
    "onError": ["write_partial_report"],
    "notify": ["niivue:desktop-toast"],
    "completionStatus": "partial"
  }
}
```

Handler steps named in `onError[]` run after the workflow halts or
completes with at least one failed step. They are ordinary steps
elsewhere in `steps` and follow the same schema; the only constraint is
that they MUST NOT be reachable through the public-outputs dependency
graph (a handler that gates an output would create a circular halt
condition).

`completionStatus` decides the provenance label for runs that finish with
failed-but-tolerated steps: `partial` (recommended) records honestly that
not every step succeeded; `success` is available for workflows that
explicitly want lenient labelling.

## Cancellation

`core:cancel-request` is a cooperative signal. The runtime emits one
toward a step's tool when an operator cancels the run, when an
orchestrator sibling requests it, or when a workflow-level halt cascades
through still-running steps. Tools SHOULD react by:

1. Stopping any further item processing.
2. Closing files and flushing partial outputs (no requirement to
   finalize them — these are not `core:output-final`).
3. Emitting `core:status` with state `cancelled`.

If a tool does not respond within an implementation-defined grace
period, the runtime MAY escalate by terminating the process. The
activity is recorded as `cancelled` either way.

Orchestrator tools subscribed to sibling events MAY emit
`core:cancel-request` toward sibling steps; the runtime relays it.
Sibling-emitted cancellation is advisory — only the runtime ultimately
terminates a step.

## Provenance contract

The provenance document is the durable record. After this RFC:

- `run.status` extends to `partial` and `halted`. `partial` means the
  run finished with one or more tolerated step failures; `halted` means
  the runtime stopped at a step failure before producing public outputs.
- `run.haltedAtStep` identifies the failing step when `status` is
  `halted` or `failed`.
- `run.cancelReason` carries the human-readable reason when `status` is
  `cancelled`.
- Activity `status` extends to `partial`. A `partial` activity carries a
  non-empty `itemFailures[]` array — one entry per `core:item-error`
  event the runtime received.
- Activities produced by workflow-level error handlers carry
  `handlerFor` set to the failing step's id.

An automated consumer can answer "did this run produce trustworthy
results?" by inspecting `run.status` and the `itemFailures` length of
each activity.

## Notifications

Notification channels are not enumerated in the core. Channel
identifiers in `notify[]` arrays are opaque strings defined by extension
namespaces (e.g. `niivue:desktop-toast` lives in `niivue/runtime`).
Runtimes that do not recognise a channel MUST silently skip it.

Runtimes MUST notify on declared channels at three points:

- step failure (after `tolerateItemFailures` is applied),
- workflow halt,
- workflow completion when `completionStatus: partial` is recorded.

This keeps the workflow author in control of when operators get paged
without baking a transport into the spec.

## What this RFC does **not** specify

- **Resumption.** Whether a halted run can be resumed from the failing
  step, the last successful step, or not at all is up to the runtime.
  NeuroFlow only ensures the provenance has enough information for a
  resuming runtime to do the right thing: it knows which steps
  completed, which were partial, which failed, which were cancelled,
  and which inputs already produced outputs.
- **Retry.** Tools and runtimes may retry internally and surface the
  result via `attempts` on the activity record. NeuroFlow does not
  define a retry policy syntax.
- **Backoff, timeouts, or rate limits.** All implementation-specific.
- **The notification transport.** The `notify` channel identifier is
  opaque; a desktop runtime may speak to native UI, a server runtime
  may speak to Slack, a CI runtime may speak to log files. The channel
  vocabulary is contributed by extension namespaces, not by the core.

## Worked examples

Two new example workflows in [`examples/`](../examples/) cover the two
canonical shapes:

- [`bids-batch-tolerant.neuroflow.json`](../examples/bids-batch-tolerant.neuroflow.json) —
  a converter step that tolerates up to 5% per-subject failures and a
  validator step that halts on tool failure but tolerates warnings.
- [`mriqc-halt-on-template.neuroflow.json`](../examples/mriqc-halt-on-template.neuroflow.json) —
  a tolerant per-subject MRIQC step, a strict registration-to-template
  step pinned in `workflow.errorPolicy.haltOnSteps`, and a workflow-level
  `onError` handler that writes a partial report.

## Alternatives considered

- **Per-step `retry` directive in the core.** Rejected: retry is a
  runtime concern (cluster vs. desktop vs. cloud have very different
  retry economics) and there is no portable way to specify it.
- **Enumerate notification channels in the core.** Rejected: locks the
  spec to the channels current vendors implement and slows the spec's
  release cadence to track new channels.
- **A single `onError: "halt" | "continue"` switch with no item-level
  tolerance.** Rejected: this collapses the two failure modes that real
  pipelines need to treat differently and forces tools to choose between
  emitting `core:error` (halt) or hiding failures.
- **A `failedOk: true` flag on each tool input.** Rejected: makes the
  workflow's tolerance dependent on every tool author independently
  surfacing per-input failure modes, which is not portable.

## Open issues

- Should `tolerateItemFailures` accept an expression against `core:item-error`
  payload fields (e.g. "tolerate only `severity: warn`")? Punted; the
  current shape covers the common case.
- Should `workflow.errorPolicy.onError[]` handlers be allowed to
  themselves halt the workflow further? Currently they run on a
  best-effort basis and their failure is recorded but does not change
  `run.status`. A future RFC may revisit this.
- Should runtimes be permitted to emit `core:cancel-request` to a step
  whose `errorPolicy` declares no tolerance for it? The current draft
  treats cancellation as universally available.
