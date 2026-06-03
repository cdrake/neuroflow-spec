# RFC 0003: Provenance Documents

Status: Proposed

Created: 2026-05-24

## Summary

This RFC adds a fourth NeuroFlow document family — `provenance` — that records
what happened during a single workflow run. A provenance document is the
deliverable audit trail: workflow identification, agents, step activities,
input and output entities (with checksums), context evolution, decisions,
fix proposals, and a compact event summary.

The companion specification text lives in
[spec/neuroflow-0.1.md §16](../spec/neuroflow-0.1.md). The schema lives in
[schemas/0.1/provenance.schema.json](../schemas/0.1/provenance.schema.json).

## Decision

NeuroFlow 0.1 defines `provenance` as a first-class document family in the
portable core. Its structure is aligned with W3C PROV concepts (Entity,
Activity, Agent, used, wasGeneratedBy, wasDerivedFrom) and intended to be
embeddable in BIDS-Derivatives datasets and RO-Crate research objects.

## Motivation

Neuroimaging pipelines routinely produce artifacts that downstream consumers
(other researchers, journals, regulators) must trust. The current 0.1 core
captures the *contract* (the workflow document) but not the *execution*
(what versions ran, on what host, with what inputs, producing what outputs,
under what user decisions). Without a portable record, every runtime is free
to invent its own log format, and provenance is lost when artifacts move
between systems.

The neuroimaging community already has the building blocks: BIDS Derivatives
specifies `dataset_description.json.GeneratedBy[]`, DataLad records git
provenance, NiPype emits workflow JSON, and W3C PROV provides a shared
vocabulary. NeuroFlow needs a normalized JSON record that integrates with
those standards rather than competing with them.

## Goals

- Define a JSON document family for one workflow run's provenance.
- Align with W3C PROV (Entity, Activity, Agent) so existing PROV tooling can
  translate to/from NeuroFlow provenance.
- Capture the **final products** of the workflow as a first-class list
  (`outputs` → entity ids).
- Capture per-step **tool resolutions** so the same workflow can be
  re-executed with the same tool versions.
- Capture **decisions**: branches taken, fix proposals approved or rejected,
  manual overrides, and skips.
- Make the document embeddable in BIDS Derivatives and RO-Crate.
- Record checksums for tamper-evidence on workflow JSON and file entities.

## Non-goals

- Replacing W3C PROV. NeuroFlow provenance is one PROV serialization shape,
  not the standard itself.
- Replacing DataLad, RO-Crate, or BIDS-Derivatives. NeuroFlow provenance is
  designed to live alongside those records and reference them by id/path.
- Defining a query language over provenance. SPARQL/PROV-N tooling already
  exists; NeuroFlow provides the data, not the queries.
- Defining a full event log format. The provenance document carries a
  compact summary; the full event log is a runtime concern.

## Proposal

### 1. Envelope

```json
{
  "neuroflow": "0.1.0",
  "kind": "provenance",
  "id": "<reverse-DNS-id>/<workflow-id>/<run-id>",
  "version": "1.0.0"
}
```

### 2. Run identification

`run` carries `runId` (matching the runId used in the runtime-events
envelope), timestamps, terminal `status`, and optional host metadata.

### 3. Workflow reference

`workflow` records the workflow document `id`, `version`, and an optional
`checksum` of the JSON. Re-running the workflow against a different version
or modified document is detectable.

### 4. Agents

`agents` lists PROV-style participants: software (with version and binary or
container reference), people, and organizations. Activities reference agents.

### 5. Activities

`activities` is the ordered record of step executions. Each activity carries
`stepId`, `toolId`, `toolVersion`, timestamps, terminal `status`, agent
reference, `used` (input entity ids), `generated` (output entity ids), and
final `contextWrites`.

### 6. Entities

`entities` is the union of inputs, outputs, intermediates, and context
snapshots. File entities carry `path`, `size`, and `checksum`. Small JSON
values may be embedded inline via `value`. Files inside a BIDS dataset MAY
carry `bidsEntities` recording their BIDS key/value entities (`sub`, `ses`,
`task`, `run`, …).

### 7. Final products

`outputs` maps workflow output identifiers to entity ids. This is the
canonical list of final products produced by the run. A consumer can locate
every published artifact without traversing the activity DAG.

### 8. Decisions

`decisions` records branches taken, fix proposals raised, approvals and
rejections, manual overrides, and skips. This is the audit trail that
explains *why* the run produced what it did.

### 9. Compact event summary

`events` is an OPTIONAL compact summary of notable runtime events
(`core:status` transitions, `core:error` events). The full event log is
implementation-defined.

### 10. Integration with BIDS-Derivatives and RO-Crate

A `provenance` document MAY be saved as `dataset_description.json.GeneratedBy[]`
entries (compacted), as a sibling `*_prov.json` file, or as an `RO-Crate`
metadata entity. The mapping is non-normative; the schema is the contract.

## Examples

See [examples/dicom-to-bids-run.provenance.json](../examples/dicom-to-bids-run.provenance.json),
which records a complete run including a fix-proposal approval that patched
missing `RepetitionTime` fields in three BOLD sidecars.

## Alternatives Considered

### Adopt PROV-JSON directly

Considered and rejected. PROV-JSON is correct but verbose and PROV-centric;
it doesn't model neuroimaging-specific concepts (BIDS entities, fix
proposals) that NeuroFlow workflows produce. NeuroFlow provenance uses
PROV-aligned terms (Entity, Activity, Agent, used, wasGeneratedBy,
wasDerivedFrom) while staying readable for pipeline operators.

### Reuse BIDS-Derivatives `GeneratedBy[]` as the only record

Considered and rejected. `GeneratedBy[]` covers software identity but not
step lineage, decisions, or input checksums. The two records integrate:
NeuroFlow provenance can be projected into `GeneratedBy[]` entries.

### Stream provenance entirely via runtime events

Considered and rejected. Provenance is a deliverable artifact that outlives
the run; runtime events are ephemeral. Both layers exist: events emit
provenance fragments, and the runtime composes them into a `provenance`
document at the end.

## Compatibility

This RFC adds a new document family. Existing 0.1 documents are unaffected.
Validators that do not implement provenance MUST still accept the other
document families.

## Open Questions

- Should provenance be emittable as PROV-JSON in addition to NeuroFlow JSON?
- How should provenance reference data hosted outside the run (S3 URIs,
  DataLad annex keys, container digests)?
- Should `entities[].path` be normalized to a single root, or stay as
  source-aware paths?
- How should iterated steps (per-subject loops) flatten into activities?
  One activity per iteration, or one activity with iteration metadata?

## Decision Outcome

Pending review.
