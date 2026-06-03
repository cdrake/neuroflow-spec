# RFC 0005: Fix Proposals and Pipeline Flow Control

Status: Proposed

Created: 2026-05-24

## Summary

This RFC standardizes the detector → fixer → re-validate pattern in
NeuroFlow. It adds two core event types (`core:fix-proposal`,
`core:await-approval`), a closed `operations` vocabulary that fixers consume
declaratively, a step-level `awaitApproval` policy, and a `fixLoop`
declaration that lets the runtime drive validator/fixer cycles to a
fixed-point.

The companion specification text lives in
[spec/neuroflow-0.1.md §21](../spec/neuroflow-0.1.md). The schema changes
live in [schemas/0.1/events.schema.json](../schemas/0.1/events.schema.json)
and [schemas/0.1/workflow.schema.json](../schemas/0.1/workflow.schema.json).

## Decision

NeuroFlow 0.1 defines a portable, declarative fix-proposal pattern in the
core layer:

- Detectors emit structured `core:fix-proposal` events.
- Fixers consume the declarative `operations` vocabulary
  (`set-field`, `set-bids-entity`, `rename-field`, `rename-file`,
  `patch-json`, `replace-image`, …) — no scripting.
- Steps that need operator confirmation emit `core:await-approval` and
  declare `awaitApproval: "required"`.
- Validators declare a `fixLoop` referencing the paired fixer so the
  runtime can re-run them to fixed-point.
- Every proposal, approval, rejection, and skip is recorded in the
  `decisions[]` array of the provenance document.

## Motivation

Working neuroimaging pipelines spend significant effort on remediable
issues that current workflow languages (CWL, WDL, Nextflow, Snakemake) do
not model directly:

- **Missing BIDS sidecar fields.** `bids-validator` reports them as errors;
  pipelines like fMRIPrep then refuse to run. Today operators edit JSON by
  hand or run ad-hoc scripts; the fix is not captured in provenance.
- **Subject relabeling.** Scanner-side identifiers (`Patient_001`,
  `Phantom`, `Test`) frequently violate the project's BIDS naming
  policy. The fix is a rename across many files and entity references.
- **Defacing and refacing.** Defacing is required for sharing anatomical
  scans; refacing is sometimes required for QC or registration debugging.
  Both are conditional, file-targeted operations that depend on a
  detector's verdict.
- **Series classification confirmation.** Heuristic classifiers (HeuDiConv,
  `dcm2bids`, NiiVue Desktop's BIDS classifier) emit low-confidence
  guesses that should be confirmed before downstream steps consume them.
- **`IntendedFor` repair** after series-level edits.

These scenarios share a structure that deserves to be portable: a
detector identifies a remediable issue and proposes a structured change; a
fixer applies the change (with optional operator approval); the validator
re-runs until the issue is resolved.

## Goals

- Standardize a structured proposal payload that any detector can emit and
  any fixer can consume, regardless of vendor.
- Define a closed `operations` vocabulary so fix proposals are
  declarative and statically reviewable.
- Support a `none` / `auto` / `required` approval policy per step so the
  same fix pattern serves headless batch jobs and interactive pipelines.
- Support a `fixLoop` declaration so the runtime drives the
  detector → fixer → re-detect cycle to a fixed-point.
- Record every proposal and decision in the provenance document defined by
  RFC 0003.

## Non-goals

- Embedding a scripting language in fix proposals. The `operations`
  vocabulary is closed for 0.1; richer transforms belong to extension
  namespaces or to dedicated fixer tools.
- Defining a UI for approval. NeuroFlow describes the events; the UI is a
  designer / runtime concern.
- Defining a unified BIDS validator interface in core. The
  `core:fix-proposal` event is generic; BIDS-specific tool contracts live
  in the `bids/profile` extension (RFC 0006).

## Proposal

### 1. Two new core event types

- `core:fix-proposal` — structured remediation proposal.
- `core:await-approval` — tool is paused awaiting operator decision.

Both are listed in the closed `core:` event-type vocabulary and constrained
by `events.schema.json`.

### 2. Closed operations vocabulary

```text
set-field | delete-field | rename-field | set-bids-entity |
rename-file | copy-file | delete-file |
patch-json | replace-image | annotate
```

Each operation carries declarative parameters (`path`, `field`, `from`,
`to`, `value`, `reason`).

### 3. Step `awaitApproval` policy

- `none` — proposals surfaced, no blocking.
- `auto` — proposals with `autoApprove: true` applied silently.
- `required` — step pauses until each proposal is decided.

### 4. `fixLoop`

```json
{
  "validate": {
    "tool": "…",
    "inputs": { "…": "…" },
    "fixLoop": {
      "fixerStep": "fix_sidecars",
      "maxIterations": 5,
      "stopOn": "no-error-proposals"
    }
  }
}
```

The runtime re-runs `validate` after each successful `fix_sidecars` pass
until `stopOn` holds or `maxIterations` is exhausted.

### 5. Provenance integration

Every fix-proposal raised, approved, rejected, or skipped MUST appear in
`decisions[]` of the provenance document. The proposal payload itself
SHOULD be stored as a `bids:fix-proposal` entity (or domain-appropriate
type) that the decision references via `proposal.entity`.

## Worked Scenarios

### Missing `RepetitionTime` in BOLD sidecars

1. `validate` runs `bids-validator`, emits three `core:fix-proposal`
   events with `category: "bids:missing-sidecar-field"` and
   `operations: [{ op: "set-field", path: "<bold>.json", field: "RepetitionTime", value: 2.0, reason: "From DICOM tag (0018,0080)" }]`.
2. With `awaitApproval: "auto"` on `fix_sidecars`, the operator gates each
   proposal in the UI.
3. After approval, `fix_sidecars` applies operations and writes the
   patched sidecars to a staging directory.
4. The runtime re-runs `validate`; if it emits no error-severity
   proposals, the `fixLoop` exits.

### Refacing a defaced anatomical scan

1. A `detect_defacing` step inspects T1w volumes for defacing artifacts
   and emits `core:fix-proposal` events with
   `category: "bids:reface"` and
   `operations: [{ op: "replace-image", path: "sub-001_T1w.nii.gz", value: "<reface-tool-output>" }, { op: "annotate", path: "sub-001_T1w.json", value: { "RefacedBy": "neuroflow/reface@1.0.0" } }]`.
2. The fixer step `reface` consumes the proposals if the operator
   approves. The annotation operation records the transformation in the
   sidecar so downstream tools know the image was modified.

### Subject relabeling

1. A `detect_subject_ids` step compares scanner-derived ids against the
   project's BIDS policy and emits `core:fix-proposal` events with
   `category: "bids:subject-relabel"` and operations combining
   `set-bids-entity` and `rename-file` for every affected file.
2. The fixer `relabel_subjects` applies the rename atomically.

## Alternatives Considered

### Free-form scripting in fix payloads

Considered and rejected. The core spec forbids embedded script execution;
allowing it in fix proposals would reintroduce the problem. The closed
`operations` vocabulary preserves declarativity.

### Have the validator just write the fix itself

Considered and rejected. Separating detector and fixer keeps each step's
responsibility small, lets the operator review the proposed change before
it lands, and aligns with how `bids-validator`, MRIQC, and similar
community tools are designed.

### Out-of-band approval channel

Considered and rejected. Approvals flow back through the same
runtime-events channel (as control events from runtime to tool over
bidirectional transports, or as completion of the `core:await-approval`
state on one-way transports). Keeping the channel unified is consistent
with RFC 0002.

## Compatibility

This RFC extends the closed `core:` event vocabulary with two values and
adds optional fields to `stepDef`. Existing 0.1 documents are unaffected.
Validators that do not implement fix-loops MUST still accept documents
that declare them but MAY treat the loop as a one-shot validator.

## Open Questions

- Should `fixLoop` iterations appear as separate activities in the
  provenance document, or as one activity with an `iterations[]` array?
- Should the `operations` vocabulary include `merge-json` for partial
  sidecar updates that preserve unknown keys?
- Should runtimes be required to dry-run operations before applying them
  for `awaitApproval: "auto"` proposals?
- How should fix loops compose with sibling subscriptions when multiple
  steps consume the same validator's proposals?

## Decision Outcome

Pending review.
