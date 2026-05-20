# RFC 0001: Extract NeuroFlow from NiiVue Desktop Workflows

Status: Accepted

Created: 2026-05-20

Decided: 2026-05-20

## Summary

This RFC establishes NeuroFlow as a vendor-neutral specification extracted from
the workflow model in `niivue/niivue/packages/niivue-desktop/workflows`. It
keeps the practical NiiVue Desktop pipeline concepts that already work, while
separating portable pipeline semantics from implementation-specific UI and
runtime details.

The companion draft specification is [spec/neuroflow-0.1.md](../spec/neuroflow-0.1.md).

## Decision

NeuroFlow 0.1 defines a single, normalized document model. NiiVue is the first
and only consumer, so there is no installed base of pre-NeuroFlow documents to
preserve and **no source-compatible profile is defined**. NiiVue Desktop
migrates its workflow, tool, and heuristic JSON to the normalized shape, and
the NiiVue Desktop loader acts as the adapter between normalized documents and
its internal runtime types.

## Motivation

NiiVue Desktop already contains a useful JSON workflow system:

- workflow files compose tools into pipelines
- tool files describe typed inputs and outputs
- heuristic files declaratively derive context values
- schemas provide editor-friendly validation
- UI metadata supports forms and visual blocks
- runtime metadata can describe CLI execution

That model should be lifted into a neutral specification so workflows can be
validated, exchanged, versioned, and eventually run by more than one
implementation.

## Goals

- Define a core document model for workflows, tools, and heuristics.
- Formalize inputs, context fields, steps, bindings, output mappings, and
  workflow outputs.
- Define a deterministic reference grammar.
- Use namespaced types such as `neuro:volume` and `core:array<...>`.
- Keep NiiVue UI and runtime details in extension namespaces.
- Preserve JSON Schema Draft 2020-12 compatibility.
- Add semantic validation beyond JSON Schema.

## Non-goals

- Replacing BIDS, CWL, WDL, Nextflow, Snakemake, or Boutiques.
- Requiring NiiVue Desktop as the only runtime.
- Embedding arbitrary script execution into the core document model.
- Standardizing Electron, Radix icons, packaged binary paths, or viewer
  behavior in the portable core.
- Defining a full provenance, packaging, or registry system in this RFC.

## Source Model

The NiiVue Desktop source repository contained three schema families
(`workflow.schema.json`, `tool.schema.json`, `heuristic.schema.json`) with
documents that used `name`, unqualified type strings, and inlined `menu`,
`form`, `block`, and `exec` metadata. [docs/niivue-desktop-source-model.md](../docs/niivue-desktop-source-model.md)
records that model and its mapping into NeuroFlow.

## Proposal

### 1. Document families

NeuroFlow defines three document families: `workflow`, `tool`, and `heuristic`.
Every document carries the envelope `neuroflow`, `kind`, `id`, and `version`.

### 2. Identifiers

Local identifiers permit lowercase-starting names with ASCII letters, digits,
underscores, and hyphens, matching identifiers already in use such as
`dicom_dir`, `series_list`, `bids_dir`, and `outDir`. Document `id` values are
namespace-qualified with at least one `/` segment.

### 3. Namespaced types

The type model uses namespaced types:

```json
{ "type": "neuro:volume" }
```

Container types use `core:array<element-type>`. Unqualified legacy strings such
as `volume` or `dicom-series[]` are not valid NeuroFlow types; migration tools
canonicalize them.

### 4. References

References use a deterministic dot-path form:

```json
{ "ref": "steps.convert.outputs.volumes" }
```

The grammar covers `inputs.<input-id>`, `context`, `context.<field-id>`, and
`steps.<step-id>.outputs.<output-id>`. References must be statically
analyzable and resolvable before execution.

### 5. Bindings

A binding uses exactly one of `ref` or `constant`:

```json
{ "ref": "context.selected_series" }
```

```json
{ "constant": "y" }
```

### 6. Object-keyed steps

Workflows define steps as an object keyed by step id. Portable runtimes derive
dependencies from references and output mappings; object member order is only a
deterministic tie-breaker.

### 7. Context sidecars and output mappings

`context.fields` is a mutable run sidecar and `outputMappings` writes step
outputs back into it. Semantic validators ensure mapped outputs exist and
mapped context fields are declared.

### 8. UI metadata in extensions

Workflow `menu` and `form`, and tool `block`, live under
`extensions["niivue/ui"]`. Their shape is described by a reference extension
schema, not by the portable core.

### 9. Runtime metadata in extensions

Tool `exec` metadata (CLI binaries, platform paths, iteration, arguments,
output collection, post-processing) lives under `extensions["niivue/runtime"]`.
The core tool contract is typed inputs and outputs only.

### 10. Declarative heuristics

Heuristics use `source`, an ordered `operations` chain, and a typed `output`.
They remain deterministic and serializable; no scripting language is added to
core heuristics.

## Example

See [examples/niivue-dicom-to-bids.neuroflow.json](../examples/niivue-dicom-to-bids.neuroflow.json).

## Alternatives Considered

### Copy the NiiVue Desktop schemas unchanged

This would preserve immediate compatibility, but it would leave UI, runtime,
and portable core semantics mixed together. NeuroFlow instead defines a clean
normalized model and migrates the existing documents into it.

### Define a source-compatible profile alongside the normalized model

Considered and rejected. NiiVue is the only existing consumer, so a dual-profile
design would add validator and tooling surface area for documents that do not
exist. Migrating the NiiVue Desktop documents once is cheaper.

### Use CWL or WDL directly

CWL and WDL are mature workflow languages, but NeuroFlow needs a smaller
schema-first interchange layer with neuroimaging types, context-assisted UI,
and heuristic configuration. NeuroFlow interoperates with these systems rather
than replacing them.

### Make UI and runtime fields core

This would make the first implementation easier, but it would weaken vendor
neutrality and force non-NiiVue implementations to inherit assumptions they do
not need.

## Migration Plan

1. Create shared schema primitives for semver, identifiers, type declarations,
   references, bindings, context fields, output mappings, and extensions.
2. Author the normalized `workflow`, `tool`, and `heuristic` schemas plus the
   `niivue/ui` and `niivue/runtime` reference extension schemas.
3. Migrate the NiiVue Desktop workflow, tool, and heuristic JSON to the
   normalized shape.
4. Make the NiiVue Desktop loader the adapter between normalized documents and
   internal runtime types.
5. Add semantic validation tests for references, context writes, output
   mappings, dependency cycles, and type compatibility.
6. Add valid and invalid examples for each document family.

## Compatibility

This RFC is pre-1.0 and may require breaking changes while the model is being
validated. Once a 1.0 line exists, breaking changes are limited to major
versions.

Non-breaking changes include adding optional fields, adding extension
namespaces, and adding new namespaced types when validators handle unknown
types predictably.

Breaking changes include removing fields, changing reference grammar, changing
execution semantics, removing accepted type names, adding required fields, and
tightening validation in a way that rejects previously valid documents.

## Open Questions

- Should `tool` references support version ranges?
- How should nullable outputs and skipped steps be represented?
- Should references support paths into structured values in a later RFC?
- How should implicit context mutation and object-order execution be replaced
  with explicit dependencies?
- What is the minimal required BIDS entity model?
- How should provenance align with W3C PROV, RO-Crate, or BIDS Derivatives?
- How should extension namespaces declare required capabilities?

## Decision Outcome

This RFC is accepted. The draft core described in
[spec/neuroflow-0.1.md](../spec/neuroflow-0.1.md) is the basis for schema
authoring, examples, validation rules, source migration, and follow-up RFCs.
