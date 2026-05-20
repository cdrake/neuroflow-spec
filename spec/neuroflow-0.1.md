# NeuroFlow Specification 0.1

Status: Draft

Last updated: 2026-05-20

This document defines the NeuroFlow 0.1 document model. NeuroFlow describes
declarative neuroimaging pipelines as portable JSON documents, validated by
JSON Schema Draft 2020-12.

This document is normative where it uses capitalized requirement keywords such
as MUST, SHOULD, and MAY. Sections explicitly marked informative describe
background and migration guidance.

The machine-readable schemas for this version live in
[`schemas/0.1/`](../schemas/0.1/). Where this prose and the schemas disagree,
the schemas are authoritative.

## 1. Scope

NeuroFlow defines JSON documents for declarative neuroimaging pipelines. A
NeuroFlow document can describe workflow orchestration, typed inputs and
outputs, context sidecars, tool contracts, deterministic heuristics, and
extension metadata.

The specification does not require a specific execution engine, UI framework,
viewer, package manager, scheduler, or storage backend.

## 2. Origin

This section is informative.

NeuroFlow was extracted from the workflow, tool, and heuristic JSON used by
NiiVue Desktop. That model mixed portable pipeline semantics with UI metadata
(menus, forms, designer blocks) and runtime metadata (CLI execution). NeuroFlow
0.1 keeps the useful pipeline semantics as a normalized core and relegates UI
and runtime concerns to extension namespaces.

NeuroFlow 0.1 defines a single document shape — the normalized model described
below. There is no separate legacy or source-compatible profile; tools that
hold pre-NeuroFlow documents are expected to migrate them to the normalized
shape. See [`docs/niivue-desktop-source-model.md`](../docs/niivue-desktop-source-model.md)
for the original NiiVue Desktop model and its mapping into NeuroFlow.

## 3. Conformance Classes

A conforming document MUST be valid JSON and MUST satisfy the JSON Schema for
its declared document family.

A conforming validator MUST validate JSON Schema constraints and SHOULD validate
semantic rules that JSON Schema cannot fully express, including reference
resolution, type compatibility, dependency graph cycles, context writes, and
extension namespace shape.

A conforming runtime MUST preserve the core execution semantics defined here.
It MAY ignore extensions it does not understand, unless a future required
extension mechanism says otherwise.

A conforming designer MAY use UI extensions, but MUST NOT require UI extensions
for a core workflow to be understood as a workflow.

## 4. Layers

NeuroFlow is divided into layers.

The core layer defines the portable document model:

- document families
- identifiers and versions
- workflow inputs and outputs
- context fields
- steps and dependencies
- references and bindings
- output mappings
- tool contracts
- deterministic heuristics
- execution semantics
- extension behavior

The neuro layer defines neuroimaging types:

- `neuro:volume`
- `neuro:mask`
- `neuro:dicom-folder`
- `neuro:dicom-series`
- `neuro:bids-dataset`
- `neuro:subject`
- `neuro:series-mapping`
- `neuro:label-map`
- `neuro:transform`
- `neuro:surface`

The UI layer is optional. UI metadata MUST live in extension namespaces.

The runtime layer is optional. Runtime metadata MUST live in extension
namespaces.

## 5. Document Families

This draft defines three document families:

- `workflow`
- `tool`
- `heuristic`

Every NeuroFlow document uses a common envelope:

```json
{
  "neuroflow": "0.1.0",
  "kind": "workflow",
  "id": "niivue.desktop/dicom-to-bids",
  "version": "2.0.0"
}
```

`neuroflow` identifies the specification version used by the document. For this
draft it MUST be `0.1.0`.

`kind` identifies the document family and MUST be `workflow`, `tool`, or
`heuristic`.

`id` is a stable identifier for the document. It MUST be namespace-qualified
using at least one `/` segment, and SHOULD use a reverse-DNS, URI-like, or
registry-qualified namespace.

`version` is the document version and MUST use semantic versioning.

## 6. Identifiers

Local identifiers are used for inputs, context fields, steps, outputs, tool
parameters, and heuristic operations inside one document.

Local identifiers MUST match:

```text
^[a-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)*$
```

Examples:

- `subject`
- `dicom_dir`
- `selected_series`
- `outDir`
- `brain-mask`
- `skull_strip`

Local identifiers MUST be unique within their containing object. Step
identifiers MUST be unique across a workflow.

## 7. Type Declarations

A type declaration describes the expected shape of a value.

NeuroFlow documents MUST use qualified type strings:

```json
{
  "type": "neuro:volume",
  "description": "Input NIfTI volume"
}
```

The type grammar is:

```text
type           = qualified-type / array-type
qualified-type = namespace ":" name
array-type     = "core:array<" qualified-type ">"
```

The `core` namespace is reserved for primitive and container types:

- `core:string`
- `core:number`
- `core:integer`
- `core:boolean`
- `core:object`
- `core:json`
- `core:array`
- `core:file`
- `core:directory`

The `neuro` namespace is reserved for the neuroimaging types listed in
section 4.

The `core` and `neuro` namespaces are **closed vocabularies**: a validator
MUST reject a `core:` or `neuro:` type that is not one of the names defined by
this specification. This makes a misspelled type (`neuro:volme`) a validation
error rather than a value silently treated as an unknown type.

Any other namespace denotes an **open extension type**. A validator MUST accept
an extension type whose namespace is neither `core` nor `neuro`, MUST NOT
attempt to interpret it, and MUST preserve it unchanged. Extension types follow
the same grammar (`namespace ":" name`) and may appear inside the array
container (`core:array<niivue:report>`).

Array values use the container form `core:array<element-type>`, for example
`core:array<neuro:volume>` or `core:array<core:string>`.

Type declarations MAY include `description`, `optional`, `default`, `enum`,
`min`, `max`, `label`, and `extensions`.

## 8. References

References identify values produced or declared elsewhere in a workflow.
References MUST be statically analyzable and MUST NOT depend on runtime string
interpolation.

A reference is a dot-path string:

```json
{
  "ref": "steps.convert.outputs.volumes"
}
```

The reference grammar is:

```text
reference       = input-ref / context-ref / step-output-ref
input-ref       = "inputs." local-id
context-ref     = "context" / "context." local-id
step-output-ref = "steps." local-id ".outputs." local-id
```

Examples:

- `inputs.dicom_dir`
- `context`
- `context.series_list`
- `steps.convert.outputs.volumes`

A reference MUST resolve to exactly one declared value. A reference to a skipped
step output is invalid unless the consuming field declares an explicit fallback
or the referenced output is nullable.

Open issue: later drafts may add reference paths into structured objects and
arrays. This draft only defines references to declared workflow values and the
whole `context` object.

## 9. Bindings

A binding supplies a concrete value for a tool input.

A constant binding:

```json
{
  "constant": "y"
}
```

A reference binding:

```json
{
  "ref": "context.selected_series"
}
```

A binding object MUST contain exactly one of `constant` or `ref`.

## 10. Workflow Documents

A workflow document defines a pipeline contract.

```json
{
  "neuroflow": "0.1.0",
  "kind": "workflow",
  "id": "niivue.desktop/dicom-to-bids",
  "version": "2.0.0",
  "description": "Convert DICOM to a BIDS-compliant dataset",
  "inputs": {},
  "context": {
    "fields": {}
  },
  "steps": {},
  "outputs": {},
  "extensions": {}
}
```

`inputs` maps local identifiers to type declarations. Inputs are supplied by the
caller, user, host application, or surrounding workflow.

`context.fields` maps local identifiers to type declarations for values
accumulated during a workflow run. Context fields MAY include `heuristic`,
`dependsOn`, `default`, `enum`, `min`, and `max`.

`steps` maps step identifiers to step definitions. Object member order is the
authorial pipeline order. Portable runtimes SHOULD derive dependencies from
references and output mappings, and SHOULD use member order only as a
deterministic tie-breaker.

`outputs` maps local identifiers to workflow output declarations.

`extensions` carries UI, runtime, and implementation metadata. NiiVue Desktop
menu and form metadata live under `extensions["niivue/ui"]`.

## 11. Context Fields

The run context is a workflow sidecar. It can hold user-entered configuration,
heuristic results, intermediate metadata, and values copied from step outputs.

```json
{
  "series_list": {
    "type": "core:array<neuro:series-mapping>",
    "description": "Classified series with BIDS datatype, suffix, and metadata",
    "heuristic": "bids-classify"
  }
}
```

`heuristic` names a deterministic heuristic that can pre-populate the field.

`dependsOn` lists input or context field identifiers that MUST be available
before the heuristic is evaluated.

## 12. Steps

A step invokes a tool contract.

```json
{
  "tool": "niivue.desktop.tools/dcm2niix",
  "inputs": {
    "dicom_dir": {
      "ref": "inputs.dicom_dir"
    },
    "bids": {
      "constant": "y"
    }
  },
  "outputMappings": {
    "volumes": "converted_volumes"
  }
}
```

The step identifier is the key in the workflow `steps` object.

`tool` identifies a tool document. Version pinning for tool references is an
open issue.

`inputs` maps tool input identifiers to bindings.

`outputMappings` maps tool output identifiers to context field identifiers.
After a step completes, a runtime SHOULD write mapped output values into the run
context.

`condition` MAY contain a dot-path expression evaluated against run state. If
the condition resolves to a falsy value, the step is skipped.

Open issue: `condition` should become a typed binding or expression object in a
future draft.

## 13. Workflow Outputs

Workflow outputs map public output identifiers to a type declaration and a
source reference.

```json
{
  "bids_dir": {
    "type": "neuro:bids-dataset",
    "ref": "steps.postpass.outputs.bids_dir"
  }
}
```

`ref` MUST resolve to a step output. Its resolved type MUST be compatible with
the declared output type.

## 14. Tool Documents

A tool document defines a portable contract for an operation.

```json
{
  "neuroflow": "0.1.0",
  "kind": "tool",
  "id": "niivue.desktop.tools/dcm2niix",
  "version": "1.0.0",
  "description": "Convert DICOM images to NIfTI format using dcm2niix CLI",
  "inputs": {},
  "outputs": {},
  "extensions": {}
}
```

The portable core tool contract consists of the envelope, `description`,
`inputs`, and `outputs`.

Visual designer metadata lives under `extensions["niivue/ui"].block`.
Declarative CLI execution metadata lives under
`extensions["niivue/runtime"].exec`.

The core tool contract MUST NOT require a specific UI toolkit, viewer, or binary
packaging layout.

## 15. Heuristic Documents

A heuristic document defines deterministic value derivation.

```json
{
  "neuroflow": "0.1.0",
  "kind": "heuristic",
  "id": "niivue.desktop.heuristics/filter-high-confidence",
  "version": "1.0.0",
  "description": "Filter series list to only include high-confidence classifications",
  "preserveExisting": true,
  "source": "context.series_list",
  "operations": [
    {
      "op": "filter",
      "field": "confidence",
      "operator": "eq",
      "value": "high"
    }
  ],
  "output": "core:array<core:json>"
}
```

`source` MUST be a reference string.

`operations` MUST be an ordered list of deterministic operations.

`output` MUST be a qualified type string.

The 0.1 operation vocabulary includes:

- `filter`
- `map`
- `sort`
- `group-by`
- `flatten`
- `unique`
- `count`
- `first`
- `last`
- `default`
- `lookup`
- `set-field`
- `merge`
- `pick-fields`
- `template`

Heuristics MUST be deterministic and serializable. A heuristic MUST NOT execute
arbitrary script code as part of the core specification.

## 16. Extensions

Every document and major nested object MAY include `extensions`.

```json
{
  "extensions": {
    "niivue/ui": {
      "menu": "Import"
    },
    "niivue/runtime": {
      "exec": {}
    }
  }
}
```

Extension keys MUST be namespace strings. Reverse-DNS names, URI-like names, and
implementation-qualified names are recommended.

Unknown extensions MUST be preserved by tools that rewrite documents, unless
the user explicitly removes them.

Unknown extensions MUST NOT change core validation semantics.

Reference schemas for the NiiVue extension namespaces are published alongside
the core schemas:

- [`schemas/0.1/extensions/niivue-ui.schema.json`](../schemas/0.1/extensions/niivue-ui.schema.json)
  — `menu`, `form`, and designer `block` metadata.
- [`schemas/0.1/extensions/niivue-runtime.schema.json`](../schemas/0.1/extensions/niivue-runtime.schema.json)
  — declarative CLI `exec` metadata.

Open issue: later drafts should define a `requiredExtensions` mechanism.

## 17. Execution Semantics

A runtime evaluates a workflow by:

1. Validating the workflow document.
2. Resolving input values.
3. Initializing the run context.
4. Evaluating eligible context heuristics.
5. Resolving tool contracts.
6. Building an execution plan from step order, step input references,
   conditions, output mappings, and workflow output references.
7. Rejecting cycles.
8. Evaluating each executable step after its dependencies are available.
9. Applying `outputMappings` into context.
10. Evaluating workflow outputs from declared output references.

Portable workflows SHOULD NOT depend only on JSON object member order for
semantics.

If a step has `condition` and the condition resolves to a falsy value, the step
is skipped. Skipped outputs are unavailable unless explicitly declared nullable
or given a fallback in a later draft.

Runtimes SHOULD record provenance, including document versions, resolved tool
versions, input identifiers, output identifiers, context writes, and extension
metadata used for execution.

## 18. Semantic Validation Rules

JSON Schema validation is necessary but not sufficient. A conforming semantic
validator SHOULD check:

- local identifier uniqueness
- reference grammar validity
- reference target existence
- step dependency cycles
- tool input completeness
- tool output existence
- output mapping target existence
- binding type compatibility
- condition reference validity
- heuristic source validity
- heuristic output type compatibility
- extension namespace validity
- compatibility between workflow-declared outputs and resolved tool outputs

## 19. Compatibility

NeuroFlow specification versions follow semantic versioning.

Adding optional fields is non-breaking. Adding extension namespaces is
non-breaking. Adding new namespaced types is non-breaking when validators can
preserve or reject unknown types in a predictable way.

Renaming fields, removing fields, changing execution semantics, tightening
identifier grammar, changing required fields, or removing previously valid enum
values is breaking.

NeuroFlow 0.1 is pre-1.0 and may require breaking changes while the model is
being validated. Once a 1.0 line exists, breaking changes are limited to major
versions.

## 20. Relationship to Existing Standards

NeuroFlow is intended to interoperate with existing neuroimaging and workflow
standards rather than replace them.

| Standard | Primary role | NeuroFlow relationship |
| --- | --- | --- |
| BIDS | Neuroimaging dataset organization | NeuroFlow references and types can describe BIDS datasets, subjects, sessions, and derivatives. |
| CWL/WDL | Portable workflow execution languages | NeuroFlow may compile to or interoperate with these systems, while keeping UI-native and neuro-typed semantics in its own model. |
| Nextflow/Snakemake | Workflow orchestration systems | NeuroFlow may be adapted to these runtimes through extensions. |
| Boutiques | Command-line tool descriptors | NeuroFlow tool contracts can align with Boutiques concepts while remaining JSON Schema centered. |

## 21. Open Issues

- Version range grammar for tool references.
- Nullable and optional output semantics.
- Reference paths into arrays and structured objects.
- Explicit step dependencies versus object-order execution.
- Type registry governance.
- BIDS entity modeling.
- Provenance model and relationship to W3C PROV or RO-Crate.
- Runtime adapter extension shape beyond the `niivue/runtime` profile.
- Required extension declarations.
