# NeuroFlow Specification

NeuroFlow is a vendor-neutral, JSON-first specification for declarative
neuroimaging pipelines. It is extracted from the workflow model currently used
by `niivue/niivue/packages/niivue-desktop/workflows`, then normalized into a
portable contract that can outlive any single runtime or viewer.

Status: pre-1.0 draft, created 2026-05-20.

## Repository Layout

- [spec/neuroflow-0.1.md](spec/neuroflow-0.1.md): draft normative specification.
- [schemas/0.1/](schemas/0.1/): machine-readable JSON Schemas (Draft 2020-12)
  for the `workflow`, `tool`, and `heuristic` document families, plus the
  `niivue/ui` and `niivue/runtime` reference extension schemas.
- [rfcs/0001-neuroflow-core.md](rfcs/0001-neuroflow-core.md): the accepted RFC
  for the core document model and evolution path.
- [docs/niivue-desktop-source-model.md](docs/niivue-desktop-source-model.md):
  historical notes on the original NiiVue Desktop model and its mapping.
- [examples/](examples/): valid example documents, plus `examples/invalid/`
  cases that a conforming validator must reject.
- [tests/validate.mjs](tests/validate.mjs): conformance harness. Run with
  `npm install && npm test`.

## Goals

- Define portable neuroimaging workflow documents.
- Use JSON and JSON Schema Draft 2020-12 as the validation foundation.
- Keep core workflow semantics independent from NiiVue, web apps, desktop apps,
  HPC schedulers, and cloud runtimes.
- Support typed neuroimaging concepts such as volumes, masks, DICOM series,
  BIDS datasets, subjects, transforms, and surfaces.
- Make references and bindings deterministic, statically analyzable, and easy to
  validate in editor tooling.
- Provide clear extension points for UI, runtime, packaging, provenance, and
  implementation-specific metadata.

## Non-goals

- Replacing BIDS, CWL, WDL, Nextflow, Snakemake, or Boutiques.
- Embedding a scripting language inside pipeline documents.
- Defining an application UI or renderer.
- Defining one required execution engine.
- Encoding NiiVue-specific behavior in the core specification.

## Design Principles

NeuroFlow is declarative, explicit, and layered:

- The core layer defines documents, identifiers, references, bindings, steps,
  context fields, output mappings, tool contracts, workflow outputs, extensions,
  and execution semantics.
- The neuro layer defines namespaced neuroimaging data types.
- The UI layer is optional and belongs in extension namespaces.
- The runtime layer is optional and belongs in extension namespaces.

## Compatibility

The specification follows semantic versioning.

Non-breaking changes include adding optional fields, adding extension namespaces,
and adding compatible schema metadata. Breaking changes include removing fields,
renaming fields, tightening validation in ways that reject previously valid
documents, removing enum values, changing required fields, or changing execution
semantics.

## Status

The schema-backed 0.1 draft is in place:

- Shared schema primitives, a formal reference grammar, and namespaced types.
- Normalized `workflow`, `tool`, and `heuristic` schemas.
- Reference extension schemas for the `niivue/ui` and `niivue/runtime`
  namespaces.
- A conformance harness with valid and invalid example documents.

NiiVue Desktop is the reference implementation: it vendors these schemas and
migrates its workflow JSON to the normalized shape.

Next: semantic validation rules beyond JSON Schema (reference resolution,
dependency cycles, type compatibility), and follow-up RFCs for the open issues
listed in the specification.
