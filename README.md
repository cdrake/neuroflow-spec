# NeuroFlow Specification

NeuroFlow is a vendor-neutral, JSON-first specification for declarative
neuroimaging pipelines. It is extracted from the workflow model currently used
by `niivue/niivue/packages/niivue-desktop/workflows`, then normalized into a
portable contract that can outlive any single runtime or viewer.

Status: pre-1.0 draft, created 2026-05-20.

## Repository Layout

- [spec/neuroflow-0.1.md](spec/neuroflow-0.1.md): draft normative specification.
- [schemas/0.1/](schemas/0.1/): machine-readable JSON Schemas (Draft 2020-12)
  for the `workflow`, `tool`, `heuristic`, and `provenance` document families,
  the shared runtime-events definitions in `events.schema.json`, plus the
  `niivue/ui`, `niivue/runtime`, and `bids/profile` reference extension
  schemas.
- [rfcs/0001-neuroflow-core.md](rfcs/0001-neuroflow-core.md): the accepted RFC
  for the core document model and evolution path.
- [rfcs/0002-runtime-events.md](rfcs/0002-runtime-events.md): proposed RFC
  adding the runtime-events channel to the portable core.
- [rfcs/0003-provenance.md](rfcs/0003-provenance.md): proposed RFC adding the
  `provenance` document family as the deliverable run record.
- [rfcs/0004-sibling-subscriptions.md](rfcs/0004-sibling-subscriptions.md):
  proposed RFC extending events with sibling-step event subscriptions
  (monitor / aggregator / orchestrator patterns).
- [rfcs/0005-fix-proposals.md](rfcs/0005-fix-proposals.md): proposed RFC for
  the detector → fixer → re-validate pattern (BIDS sidecar repair, refacing,
  subject relabeling).
- [rfcs/0006-bids-profile.md](rfcs/0006-bids-profile.md): proposed RFC for the
  `bids/profile` reference extension namespace.
- [rfcs/0007-error-handling.md](rfcs/0007-error-handling.md): proposed RFC for
  the portable error-handling model (per-item failures, step and workflow
  `errorPolicy`, cooperative cancellation, partial / halted provenance).
- [rfcs/0008-output-delivery.md](rfcs/0008-output-delivery.md): proposed RFC
  for the portable output-delivery model — closed `core:` delivery
  vocabulary (stdout-json, result-file, result-dir, event-stream,
  fixed-path, exit-code), tool-level defaults with per-output overrides,
  and `NEUROFLOW_OUTPUT_*` channel discovery.
- [rfcs/0009-mcp-binding.md](rfcs/0009-mcp-binding.md): proposed RFC
  for exposing a NeuroFlow runtime to AI agents over the Model Context
  Protocol: tools and workflows as MCP tools, runs as tasks, approvals as
  input requests, artifacts as resources, and `uiApp` tools as MCP Apps.
- [rfcs/0010-type-qualifiers.md](rfcs/0010-type-qualifiers.md): proposed RFC
  adding the `formats`, `space`, `resolution`, `density`, and
  `labelSystem` qualifiers to type declarations, with a format token
  registry, BIDS space labels, vendor prefixes, `inputs.<id>` inheritance
  and three-outcome binding compatibility rules; documents that use them
  declare `neuroflow: "0.1.1"`. Adopted from the Neurodesk Webapps
  `automation.json` contracts, revised after the survey below, and merged
  with the Neurodesk draft in neurodesk/webapps#107 into one RFC.
- [docs/type-qualifiers-survey.md](docs/type-qualifiers-survey.md): survey
  of how workflow languages (CWL, Galaxy, Boutiques, Pydra), vocabularies
  (BIDS, TemplateFlow, EDAM, NIDM, DICOM) and packages (AFNI, SPM, FSL,
  FSLeyes, FreeSurfer, ANTs, MRtrix3, Workbench, Slicer, NiiVue) express
  format, coordinate space and label tables, with recommended changes to
  RFC 0010.
- [docs/niivue-desktop-source-model.md](docs/niivue-desktop-source-model.md):
  historical notes on the original NiiVue Desktop model and its mapping.
- [examples/](examples/): valid example documents, plus `examples/invalid/`
  cases that a conforming validator must reject.
  `examples/invalid-extensions/` holds core-valid documents whose
  extension metadata an extension-aware validator must reject.
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
and adding compatible schema metadata. Within a minor line, the `neuroflow`
envelope value advances by a patch when a document needs a feature an older
validator would not check, so that the older validator rejects it: `0.1.1` for
the RFC 0010 qualifiers. Breaking changes include removing fields,
renaming fields, tightening validation in ways that reject previously valid
documents, removing enum values, changing required fields, or changing execution
semantics.

## Status

The schema-backed 0.1 draft is in place:

- Shared schema primitives, a formal reference grammar, and namespaced types
  drawn from the closed `core:`, `neuro:`, `bids:`, and `prov:` vocabularies.
- Normalized `workflow`, `tool`, `heuristic`, and `provenance` schemas.
- A transport-agnostic runtime-events channel (RFC 0002) with a closed set
  of standard transports (stdout/stderr NDJSON, event file, event directory,
  Unix socket, named pipe, TCP, HTTP webhook, WebSocket) and an extension
  grammar for additional transports.
- Sibling-step event subscriptions (RFC 0004) for monitor, aggregator, and
  orchestrator patterns.
- A fix-proposal pattern (RFC 0005) for the detector → fixer → re-validate
  loop common in BIDS, refacing, and subject-relabel pipelines.
- A `provenance` document family (RFC 0003) aligned with W3C PROV and
  intended to embed in BIDS-Derivatives and RO-Crate research objects.
- A portable error-handling model (RFC 0007) with per-item-failure events,
  step and workflow `errorPolicy`, cooperative cancellation, and
  `partial` / `halted` run statuses in provenance. Workflow resumption
  remains a runtime implementation concern.
- A portable output-delivery model (RFC 0008) with a closed `core:`
  delivery vocabulary covering stdout JSON, result file, result
  directory, event stream, fixed path, and exit code; tool-level
  defaults and per-output overrides; and `NEUROFLOW_OUTPUT_*` channel
  discovery.
- Type qualifiers (RFC 0010): `formats`, `space`, `resolution`, `density`,
  and `labelSystem` on any type declaration, so a validator can reject a
  NIfTI-only tool bound to an MGZ output, a gzip-compressed NIfTI bound
  to SPM, a native-space label map bound to a template-space consumer,
  a 1 mm grid bound to an acquisition-grid consumer, or two label maps
  with different integer tables.
- Reference extension schemas for the `niivue/ui`, `niivue/runtime`,
  `bids/profile`, and `neurovue` namespaces, plus the provisional
  `neuroflow/mcp` namespace from RFC 0009.
- A conformance harness with valid and invalid example documents.

NiiVue Desktop is the reference implementation: it vendors these schemas and
migrates its workflow JSON to the normalized shape.

Next: semantic validation rules beyond JSON Schema (reference resolution,
dependency cycles, type compatibility, event-binding and fix-loop validity),
and follow-up RFCs for the open issues listed in the specification.

## License

Licensed under either of the [Apache License, Version 2.0](LICENSE-APACHE) or the
[MIT license](LICENSE-MIT), at your option. Contributions are accepted under the
same terms.
