# RFC 0011: Agent Usage Guidance

Status: Draft

Authors: Chris Drake, Chris Rorden, Taylor Hanayik (NiiVue)

Created: 2026-10-15

## Summary

This RFC adds an optional, structured block of usage guidance to tool
and workflow documents, in a new extension namespace,
`neuroflow/usage`. The block says when to use the operation and when
not to (naming the alternative), what must hold before it runs, what it
does beyond producing its declared outputs, how long it typically
takes, a few example calls, and what its common failures mean and how
to recover from them.

Every document already carries a required `description`, and every
input and output carries its own. Those say *what* an operation does.
They are enough for a person reading a gallery, but an AI agent
choosing among tools, filling in arguments, and recovering from a
failed run needs the rest: the situations a tool is for, the ones it is
not, and what to do when it fails. Today that knowledge lives in READMEs,
in launch-specific fields such as `extensions["neuroflow/launch"].description`,
or nowhere.

The block is advisory. It never changes validation, planning, or
execution, so a runtime that ignores it behaves exactly as it does
today. RFC 0009 (MCP binding) is amended to render it into the MCP tool
description, to return its short fields from `neuroflow_list`, and to
attach a matching failure's remedy to a failed result.

## Decision

- Add the extension namespace `neuroflow/usage`, registered as
  `provisional`, allowed on tool and workflow documents. Every field is
  optional.
- Fields: `useWhen`, `avoidWhen`, `preconditions`, `effects`,
  `duration`, `examples`, `failures` (§ Fields).
- `description` stays required and keeps its meaning: one or two
  sentences saying what the operation does. Guidance on when and how
  goes in the block, not in `description`.
- The block is advisory metadata. A validator checks its shape; a
  runtime MUST NOT change validation, planning, or execution because of
  it.
- RFC 0009 renders the block for agents (§ MCP rendering) and uses
  `failures` to attach a remedy to a failed call (§ Failure remedies).
- The block lives in an extension, not the core, until implementations
  have used it. Promotion to a core field is an open issue.

## Motivation

The gallery's tool documents show the gap. All fifteen have a 200 to
430 character `description` and a description on every input and
output, which is what RFC 0009 sends to an agent. What they cannot say
anywhere an agent will read:

- **When not to use a tool, and what to use instead.** BIDSvue's
  headless `bidsvue-ingest` and its windowed `bidsvue` import the same
  DICOM folder into the same BIDS dataset. An agent should use the
  headless one for unattended runs and the windowed one when a person
  needs to check the series mapping. Both descriptions are accurate;
  neither tells an agent which to pick.
- **Preconditions the type system does not capture.** `neuro:dicom-folder`
  says nothing about whether the data must be de-identified before it
  goes to a remote model, or whether the output directory must be
  empty. `bidsvue-ingest` refuses to start when `<out>/bids` already
  exists, and an agent learns that only by failing.
- **Effects beyond the outputs.** MCP's four annotation hints cover
  read-only, destructive, idempotent and open-world. They cannot say
  "opens a window on the user's desktop", "runs a heuristic file as
  Python", or "appends to the session's provenance log".
- **Cost.** A brain extraction takes seconds; a FreeSurfer
  reconstruction takes hours. An agent deciding whether to wait, poll,
  or ask the user first has no estimate.
- **Examples.** A sample call with realistic arguments is the fastest
  way for a model to fill in a schema correctly, especially enums and
  labels such as `subject`.
- **Recovery.** When a run fails, the agent sees an exit code and the
  tail of stderr. The tool's author usually knows what exit 1 with
  "already exists" means and what to do about it; the document has no
  place to say so.

Free-form text in `description` cannot fix this without hurting the
human reader, and it cannot be rendered selectively, budgeted, or
matched against a failure. A small structured block can.

## The `neuroflow/usage` namespace

Allowed on tool and workflow documents, under
`extensions["neuroflow/usage"]`.

```json
{
  "extensions": {
    "neuroflow/usage": {
      "useWhen": ["..."],
      "avoidWhen": [{ "when": "...", "instead": "<document id>" }],
      "preconditions": ["..."],
      "effects": ["..."],
      "duration": { "typicalSeconds": 60, "maxSeconds": 900, "basis": "..." },
      "examples": [{ "title": "...", "inputs": {}, "outputs": {} }],
      "failures": [{ "match": { "exitCode": 1, "contains": "..." }, "meaning": "...", "remedy": "...", "retry": "after-fix" }]
    }
  }
}
```

### Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `useWhen` | array of strings, at most 5 | Situations where this operation is the right choice. Each item is one sentence. |
| `avoidWhen` | array of objects, at most 5 | Situations where it is not. `when` (string, required) describes the situation; `instead` (string, optional) is the `id` of a tool or workflow to use in its place. |
| `preconditions` | array of strings, at most 5 | What must hold before a run that the input types do not express: the state of the output directory, required de-identification, a licence, a host requirement. |
| `effects` | array of strings, at most 5 | What a run does besides producing its declared outputs: files written elsewhere, windows opened, network access, code from an input executed. |
| `duration` | object | `typicalSeconds` (number), `maxSeconds` (number, optional), and `basis` (string, optional) naming the input the estimate was measured on. |
| `examples` | array of objects, at most 3 | `title` (string, required); `inputs` (object, required) mapping input ids to example values; `outputs` (object, optional) showing an abbreviated result; `note` (string, optional). |
| `failures` | array of objects, at most 8 | `match` (object, required) with `exitCode` (integer) and/or `contains` (string); `meaning` (string, required); `remedy` (string, required); `retry` (`"never"`, `"after-fix"` or `"safe"`, default `"after-fix"`). |

Each string is plain text, at most 300 characters. The counts and
lengths are hard limits in the schema: the block is read by a model on
every tool choice, and a bound keeps it from crowding out the task.

### Rules

- `instead` MUST be a document `id` (spec §14). A validator with a
  registry SHOULD warn when it does not resolve; it MUST NOT reject the
  document, since the alternative may live in another registry.
- Keys in `examples[].inputs` MUST be input ids the document declares,
  and each value MUST be valid for that input's declared type and
  enum. File and directory values SHOULD be placeholders of the form
  `<name>` (for example `"<dicom_dir>"`) or relative paths.
- Examples are illustrative. A runtime MUST NOT run them unprompted,
  and an example MUST NOT contain identifiable subject data.
- `failures[].match` needs at least one of `exitCode` and `contains`.
  When both are given, both must match. `contains` is a plain,
  case-sensitive substring, not a pattern, so matching costs no more
  than a search and cannot be made slow by a crafted document.
- `effects` complements MCP's annotation hints and does not replace
  them. A tool that runs input-supplied code SHOULD still set
  `destructiveHint` or `openWorldHint` as RFC 0009 §1.5 requires.
- On a workflow document, the block describes the workflow as a whole.
  It is not inherited from or merged with its steps' blocks.

## MCP rendering (amends RFC 0009)

### Tool description (§1.1)

The MCP `description` becomes the document `description`, then the
stage tag, then these sections when present, in this order, each
introduced by its label on its own line:

```text
Use when: <useWhen items, separated by "; ">
Avoid when: <when> (use <instead's MCP name>); ...
Requires: <preconditions>
Effects: <effects>
Typical time: ~<typicalSeconds> s (up to <maxSeconds> s)
```

`instead` is shown as the alternative's MCP tool name when the server
exposes it, and otherwise as its `id`. Examples and failures are not
included in the description.

The rendered description SHOULD stay under 1,500 characters. If it
would exceed that, the server drops whole sections from the end of the
list above until it fits, and MUST NOT cut a section in the middle.

### `neuroflow_list` (§2)

Each catalog entry gains `useWhen` and `avoidWhen` (with `instead` as
an `id`), copied from the block when present. These are the fields an
agent needs to choose between tools; the rest of the block is one
`neuroflow_describe` call away.

### `neuroflow_describe` (§2)

Unchanged. It returns the full document, block included.

### Failure remedies (§1.4, §3)

When a call fails (a tool result with `isError: true`, or a task that
ends `failed`), the server checks the failed step's tool `failures`
entries in order. The first entry whose `exitCode` equals the process
exit code and whose `contains` occurs in the error message or the
captured stderr tail is the match. The server then:

- adds `"remedy": { "meaning", "remedy", "retry" }` to the failed
  step's entry in `structuredContent`, and
- appends `meaning` and `remedy` to the text summary in `content`.

No match means no remedy, and the result is as before. A remedy is
advice to the agent. The server MUST NOT act on it: it does not retry,
delete files, or change inputs.

## Worked example (informative)

The gallery's headless BIDSvue import:

```json
{
  "id": "neuroflow.gallery.tools/bidsvue-ingest",
  "extensions": {
    "neuroflow/usage": {
      "useWhen": [
        "Convert a folder of DICOM files to a BIDS dataset without user interaction, as one step in a workflow.",
        "Re-run an import whose settings are already known, such as the importer, subject and session labels."
      ],
      "avoidWhen": [
        {
          "when": "A person should review how series map to BIDS names before anything is written.",
          "instead": "neuroflow.gallery.tools/bidsvue"
        },
        {
          "when": "Only NIfTI files are needed, without a BIDS layout.",
          "instead": "neuroflow.gallery.tools/dcm2niix"
        }
      ],
      "preconditions": [
        "The step's output directory has no bids/ or bidsvue-import/ folder from an earlier run.",
        "Send the DICOM through a remote model only when it is de-identified."
      ],
      "effects": [
        "Writes neuroflow.handoff.json and a provenance line in the session as well as the dataset.",
        "With the heudiconv importer and a heuristic file, runs that file as Python."
      ],
      "duration": {
        "typicalSeconds": 60,
        "maxSeconds": 900,
        "basis": "One Siemens research session, 35 series, on an Apple-silicon laptop."
      },
      "examples": [
        {
          "title": "Import one session with ReproIn naming",
          "inputs": {
            "dicom_dir": "<dicom_dir>",
            "importer": "dcm2niix-reproin",
            "subject": "01",
            "session": "baseline"
          },
          "outputs": { "bids_dir": "<output_dir>/bids" }
        }
      ],
      "failures": [
        {
          "match": { "exitCode": 1, "contains": "already exists" },
          "meaning": "An earlier run left its output in the output directory, and the import does not overwrite it.",
          "remedy": "Use a new output directory, or ask the user before deleting the old bids/ and bidsvue-import/ folders.",
          "retry": "after-fix"
        },
        {
          "match": { "contains": "is not ready" },
          "meaning": "BIDSvue's readiness check failed before the import started, usually because dcm2niix is missing.",
          "remedy": "Report the problem to the user, who can run bun install in the BIDSvue checkout, stage its dcm2niix sidecar, or set DCM2NIIX. Retrying will not help.",
          "retry": "never"
        }
      ]
    }
  }
}
```

Rendered as the MCP description (RFC 0009 §1.1, amended):

```text
Import a DICOM folder into a BIDS dataset with BIDSvue's import
pipeline, without a window: ... <stage tag>
Use when: Convert a folder of DICOM files to a BIDS dataset without user interaction, as one step in a workflow.; Re-run an import whose settings are already known, ...
Avoid when: A person should review how series map to BIDS names before anything is written. (use neuroflow.gallery.tools.bidsvue); Only NIfTI files are needed, without a BIDS layout. (use neuroflow.gallery.tools.dcm2niix)
Requires: The step's output directory has no bids/ or bidsvue-import/ folder from an earlier run.; Send the DICOM through a remote model only when it is de-identified.
Effects: Writes neuroflow.handoff.json and a provenance line ...; With the heudiconv importer and a heuristic file, runs that file as Python.
Typical time: ~60 s (up to 900 s)
```

A second run into the same directory fails with exit 1 and
`.../bids already exists (from an earlier run?)`. The first `failures`
entry matches, and the result tells the agent to choose a new output
directory or ask before deleting, instead of leaving it to guess from
stderr.

## Writing guidance (informative)

- Keep `description` to what the operation does, with its main input
  and output. Put "use this when" in `useWhen`.
- Write `avoidWhen` for the confusions you have actually seen, and
  name the alternative whenever one exists. It is the field most
  likely to change an agent's choice.
- Write `preconditions` and `effects` for things that surprise people.
  Don't repeat what the types and annotation hints already say.
- Measure `duration` on a real input and say which in `basis`. An
  order of magnitude is enough.
- Add a `failures` entry for each refusal the tool makes on purpose,
  and for each common environment problem. Make `contains` a stable
  fragment of the tool's own message, not of a library's.
- Write for a reader who cannot see the tool's README.

## Static validation

- The block MUST validate against
  `schemas/0.1/extensions/neuroflow-usage.schema.json`.
- `examples[].inputs` keys MUST name declared inputs, and values MUST
  fit their types and enums (error).
- An `instead` that does not resolve in the validator's registry is a
  warning.
- A `failures` entry with an empty `match` is an error.

## Security

- **Usage text is untrusted input to a model.** A document from a
  third-party registry can put text in front of an agent through this
  block, as it already can through `description`. Servers SHOULD
  render the block only for documents in the resolved registry, apply
  the length limits even if the schema is not checked, and present the
  text as tool metadata, never as system or user instructions.
- **Remedies are advice.** A server never acts on a remedy (§ Failure
  remedies). An agent that follows one is still bound by the binding's
  approvals (RFC 0009 §4), so a remedy that says "delete the output
  folder" cannot delete anything without the user's approval.
- **No subject data.** Examples and `basis` MUST NOT contain
  identifiable data. Placeholders keep real paths out of documents.

## Specification version

None needed. The block is an extension, so the core schemas and the
`neuroflow` envelope value are unchanged. A document that carries it
stays at `"0.1.0"` (or `"0.1.1"` if it uses RFC 0010 qualifiers), and
every published validator accepts it, because `extensions` is open.

## What this RFC does **not** specify

- How a designer or gallery shows the block to people. It is written
  for agents but is plain text that any UI may display.
- Localisation. Strings are English in this draft.
- Guidance on individual inputs beyond their `description`.
- Measured durations. A runtime may learn real timings from provenance
  (RFC 0003); `duration` is the author's estimate.

## Alternatives considered

- **A core `usage` field.** The tool and workflow schemas set
  `additionalProperties: false`, so a new top-level field would need a
  new envelope value, and every published validator would refuse the
  document over metadata that never affects execution. An extension
  works with every validator now and can be promoted later.
- **Folding it into `neuroflow/mcp`.** That namespace is about MCP
  exposure (names, annotations, wait budgets). Usage guidance is useful
  without MCP too: in a designer palette, an `llms.txt`, or a
  non-MCP agent integration.
- **A long Markdown `doc` field**, like CWL's `doc` or Galaxy's
  `<help>`. It is easy to write but cannot be budgeted, rendered by
  section, or matched against a failure, and in practice it repeats the
  README.
- **Server-level instructions only.** MCP servers can send
  instructions at initialization, but those are per server, not per
  tool. They do not travel with a document from one registry to another.

## Prior art

- **MCP** tool `description`, `title` and annotation hints, and
  server `instructions`. This RFC fills the per-tool gap between the
  one-line description and the server-wide instructions.
- **CWL** `label` and `doc`; **Galaxy** tool `<help>` and `<tests>`;
  **Boutiques** `description`, `tests` and `suggested-resources`
  (including a walltime estimate). `duration` follows Boutiques' idea
  of a declared estimate, and `examples` follows Galaxy and Boutiques
  tests, without making them executable.
- **OpenAPI** `summary`, `description` and `examples` on operations
  and parameters.

## Implementation plan

1. Spec: add `schemas/0.1/extensions/neuroflow-usage.schema.json`, the
   registry entry (`provisional`), a valid and an invalid example, and
   the harness entries in `tests/validate.mjs`. Amend RFC 0009 §1.1,
   §2 and §1.4/§3 as above.
2. NeuroFlow reference runtime: render the block in
   `neuroflow-mcp`, add the list fields, match failures, and lint
   examples against input types in `neuroflow_validate`.
3. NeuroFlow gallery: add blocks to its tools, starting with the pairs
   agents confuse (`bidsvue` and `bidsvue-ingest`, `dcm2niix` and the
   BIDS importers, `mindgrab` and `brain-extraction`).
4. Neurodesk Webapps: consider emitting the block from
   `automation.json` contracts that already carry this kind of text.

## Open issues

- **Promotion to core.** After implementations have used the block,
  should it become a core field in a later envelope version?
- **Limits.** Are 5 items of 300 characters, and 1,500 characters
  rendered, the right bounds? They are set from the gallery's longest
  descriptions and have not been measured against agent behaviour.
- **Executable examples.** Should examples double as conformance tests,
  as Galaxy's and Boutiques' do? That needs test data and expected
  outputs, which this draft avoids.
- **Matching on structured errors.** When a tool emits `core:error`
  events (RFC 0007) with codes, `match` should be able to name the code
  instead of an exit code and a substring.
- **Workflows built from tools with blocks.** Should a planner derive a
  workflow's preconditions and effects from its steps when the
  workflow has no block of its own?
