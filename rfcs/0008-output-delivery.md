# RFC 0008: Output Delivery

Status: Proposed

Created: 2026-05-24

## Summary

This RFC adds a portable way for a tool to declare *where* its produced
values live, so a runtime can harvest them deterministically. It defines
a closed `core:` delivery vocabulary (`core:stdout-json`,
`core:result-file`, `core:result-dir`, `core:event-stream`,
`core:fixed-path`, `core:exit-code`), tool-level defaults with per-output
overrides, channel-discovery environment variables, and validation
rules. Output delivery is the data-plane sibling of the runtime-events
control plane (RFC 0002): events carry progress / logs / status / fix
proposals / cancellation; output delivery carries the actual produced
bytes and values.

The companion specification text lives in
[spec/neuroflow-0.1.md §15](../spec/neuroflow-0.1.md). Schema changes
live in [schemas/0.1/tool.schema.json](../schemas/0.1/tool.schema.json).

## Decision

NeuroFlow 0.1 specifies how outputs are produced and harvested as a
portable, declarative part of the tool contract. A tool MAY declare
`outputDelivery.default` and per-output `delivery` overrides:

```json
{
  "outputs": {
    "mappings": {
      "type": "core:array<neuro:series-mapping>",
      "description": "Final classified series mappings.",
      "delivery": { "mode": "core:event-stream", "eventName": "mappings_final" }
    },
    "subjects": {
      "type": "core:array<neuro:subject>",
      "description": "Detected subjects and sessions.",
      "delivery": { "mode": "core:result-file" }
    }
  },
  "outputDelivery": {
    "default": "core:result-file"
  }
}
```

The runtime signals the chosen delivery context to the tool through
`NEUROFLOW_OUTPUT_MODE`, `NEUROFLOW_OUTPUT_FILE`, `NEUROFLOW_OUTPUT_DIR`,
and `NEUROFLOW_WORK_DIR`. Default-path rules for `core:result-dir` cover
the common case so most tools only need a tool-level default and no per-
output configuration.

## Motivation

Before this RFC, the tool schema declared outputs by name and type but
said nothing about how the value reached the runtime. Implementations
were free to invent conventions: dcm2niix writes NIfTI files to a
directory passed via `-o`, a BIDS validator prints JSON to stdout, a
custom registration tool writes a hard-coded `derivatives/` tree.
Workflow authors couldn't write portable references to "the result"
because each tool meant something different by it.

Several reviewer observations forced the change:

- **Workflow references break without a delivery contract.** The
  expression `steps.convert.outputs.niftis` is meaningful only if the
  runtime knows where to find `niftis`. The runtime can't pick the right
  harvest strategy from the output's type alone (a `core:directory`
  output could be a path the tool prints, an `$NEUROFLOW_OUTPUT_DIR`
  layout, or a fixed `outputs/` convention).

- **The runtime-events channel is the wrong primary delivery for large
  files.** RFC 0002 already lets a tool emit `core:output-final` with
  an embedded value, but streaming a 2 GB NIfTI through stdout NDJSON or
  a Unix socket is impractical. The runtime needs filesystem-based
  delivery for the common case, with events reserved for cases where
  timing or incremental delivery genuinely matters.

- **Existing tools have conventions the spec should accommodate.**
  Wrapping HeuDiConv, dcm2niix, MRIQC, fMRIPrep, etc. is easier if the
  tool document can say "this binary writes into a known relative
  path" (`core:fixed-path`) rather than requiring a shim that copies
  outputs into a NeuroFlow-shaped layout.

- **The runtime needs to know when harvesting is complete.** For
  filesystem modes, harvest happens after process exit. For
  `core:event-stream`, harvest happens when `core:output-final` arrives.
  Without a declared mode the runtime has no portable termination rule.

## Delivery vocabulary

Closed in this draft:

| Mode | Where the value lives | Suited for |
| --- | --- | --- |
| `core:stdout-json` | One JSON object on stdout. | Small scalar / structured outputs. |
| `core:result-file` | One JSON file at `$NEUROFLOW_OUTPUT_FILE`. | Mixed outputs. The default. |
| `core:result-dir` | One artifact per output under `$NEUROFLOW_OUTPUT_DIR`. | Many large outputs. |
| `core:event-stream` | Value via `core:output-final` event. | Long-running or incremental tools. |
| `core:fixed-path` | Deterministic relative path under `$NEUROFLOW_WORK_DIR`. | Wrapping legacy tools. |
| `core:exit-code` | Process exit code (integer). | Status-only tools. |

A closed vocabulary is the right shape: the runtime needs to compile
each mode into a harvest implementation, and an open enum would force
runtimes to support arbitrary string values they can't act on. An
extension grammar may follow in a future RFC if a clear need emerges.

## Defaults

Outputs without an explicit `delivery` use the tool-level
`outputDelivery.default`. Tools without a tool-level default fall back
to `core:result-file`. This makes the simplest tool — one with declared
outputs and no delivery configuration — work portably:

```json
{
  "kind": "tool",
  "outputs": {
    "report": { "type": "bids:validation-report", "description": "Validator report." }
  }
}
```

Such a tool writes `{"report": {...}}` to `$NEUROFLOW_OUTPUT_FILE` and
exits. The runtime parses the file, picks the `report` key out, and
records the value.

For `core:result-dir`, defaults for the per-output relative path
distinguish value-typed outputs (saved as `<name>.json`) from
file-typed outputs (saved as `<name>`) from directory-typed outputs
(saved as `<name>/`). The author can override via `delivery.path`.

## Discovery

The runtime signals delivery context through four environment variables:

- `NEUROFLOW_OUTPUT_MODE` — tool-level default delivery mode chosen by
  the runtime. Tools that support multiple modes inspect it.
- `NEUROFLOW_OUTPUT_FILE` — absolute path for `core:result-file`.
- `NEUROFLOW_OUTPUT_DIR` — absolute path for `core:result-dir`.
- `NEUROFLOW_WORK_DIR` — absolute path of the tool's working directory.
  Also the base for `core:fixed-path`.

This deliberately mirrors the event-channel discovery vars from
RFC 0002. Tools that already speak NeuroFlow events recognize the
shape; tools that only emit outputs (no events) don't need to learn a
second discovery convention.

## Relationship to runtime events

`core:event-stream` and `core:output-final` are intentionally
distinct concepts that compose:

- `core:event-stream` is a *delivery mode*: a contract that the value
  will arrive through the events channel rather than the filesystem.
  Declaring it commits the tool to emitting `core:output-final` (and
  forces the tool to support at least one event transport).
- `core:output-final` is an *event type*: the wire payload that carries
  one output's value.

A tool that delivers `mappings` via `core:event-stream` must declare an
`events.emits` channel of type `core:output-final` and emit the value
through it. A tool that delivers `mappings` via `core:result-file`
*may* additionally emit `core:output-intermediate` events for progress,
but the runtime treats those as control-plane progress signals; the
canonical value still arrives via the result file.

A tool that violates the contract — declaring `core:result-file` but
also emitting `core:output-final` for the same output — has the event
value win. This matches the existing rule in §21 and avoids surprising
authors who use `core:output-final` to deliver an early-completion
value.

## Static validation

A validator MUST check:

- `delivery.mode` is one of the enumerated `core:` modes.
- `core:exit-code` is declared only on `core:integer` outputs.
- `core:event-stream` outputs have a matching `events.emits` channel of
  type `core:output-final`; `delivery.eventName` (if present) names a
  channel from that map.
- A tool with any `core:event-stream` output declares at least one
  entry under `events.transports`.
- Within one tool, no two outputs delivered via `core:result-dir`
  resolve to the same path.

## What this RFC does **not** specify

- **CLI argument construction.** How a tool is invoked — what arguments
  point at `$NEUROFLOW_OUTPUT_DIR`, which flag selects stdout-json mode
  — is a tool-author concern. The `niivue/runtime` extension namespace
  already covers declarative CLI execution metadata; this RFC stays
  out of that layer.
- **Streaming progress for value-typed outputs.** Tools that want to
  surface progress while computing a `core:result-file` output emit
  `core:progress` and (optionally) `core:output-intermediate` events.
  No new mechanism is needed.
- **Compression, deduplication, or content-addressed storage.** A
  runtime may post-process harvested outputs (e.g. into DataLad / git-
  annex / RO-Crate), but the harvest contract itself is plain
  filesystem and JSON.
- **Multi-process or multi-host delivery.** All modes assume the tool
  runs as a single process whose filesystem the runtime can read. A
  future RFC may add a delivery mode for distributed execution.

## Alternatives considered

- **Per-output transport choice (analogous to events.transports).**
  Rejected: a tool typically picks one delivery strategy for all its
  outputs; per-output mode-switching multiplies harvest code paths in
  every runtime for negligible expressive gain.
- **Open delivery-mode grammar.** Rejected: every mode is harvest
  code in every runtime. An open grammar would let workflow documents
  reference modes no runtime can act on.
- **Folding delivery into the type system** (e.g. `core:file@stdout`).
  Rejected: types and delivery are orthogonal — a `core:integer` can
  arrive via stdout, exit code, or result file — and conflating them
  bloats the type vocabulary.
- **Implicit defaults by type** (file outputs always at
  `$NEUROFLOW_OUTPUT_DIR/<name>`, scalars always to stdout). Rejected:
  reasonable inference often disagrees with what the tool actually
  does, and the explicit-default rules above are nearly as compact.
- **Single `output_url` per output.** Rejected: forcing every tool to
  serialize a URL imposes parsing on both sides for no portability
  win over a closed enum with mode-specific arguments.

## Open issues

- Should `core:result-dir` allow nested per-output paths
  (`delivery.path: "sub-01/anat/T1w.nii.gz"`)? The current grammar
  accepts arbitrary relative paths; the collision rule covers the only
  ambiguity. Likely fine.
- Should the runtime hash-stamp `$NEUROFLOW_OUTPUT_FILE` contents into
  provenance to detect accidental rewrites by sibling tools? Useful but
  out of scope for this RFC; provenance already records `checksum` per
  entity.
- Should `core:exit-code` be expanded to allow `core:string` outputs
  derived from a small map (e.g. exit code 0 → "ok", 1 → "warn")?
  Probably not — that mapping belongs in the tool, and the runtime
  should not invent it.
