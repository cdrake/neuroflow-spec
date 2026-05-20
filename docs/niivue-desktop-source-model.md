# NiiVue Desktop Source Model

Status: Informative, historical

This document records the pre-NeuroFlow NiiVue Desktop workflow model as it
existed when NeuroFlow was extracted. NeuroFlow 0.1 defines only the normalized
model; this file is kept as the origin record and migration reference. It does
not describe a supported document profile.

Inspected source: `/Users/chrisdrake/Dev/niivue/niivue/packages/niivue-desktop/workflows`

Repository remote: `https://github.com/niivue/niivue.git`

Local branch inspected: `BIDS-allineate`

Inspection date: 2026-05-20

## Files

The source directory currently contains:

- 3 JSON Schemas
- 5 workflow documents
- 15 tool documents
- 1 heuristic document

Schema families:

- `schemas/workflow.schema.json`
- `schemas/tool.schema.json`
- `schemas/heuristic.schema.json`

Workflow examples:

- `dicom-to-nifti`
- `dicom-skull-strip`
- `dicom-preview-skull-strip`
- `dicom-to-bids`
- `multi-subject-acquisition`

Tool examples:

- `dcm2niix`
- `bids-classify`
- `bids-write`
- `bids-postpass`
- `bids-validate`
- `brainchop`
- `niimath`
- `allineate`

## Workflow Shape

Current workflows use:

```json
{
  "$schema": "../schemas/workflow.schema.json",
  "name": "dicom-to-bids",
  "version": "2.0.0",
  "description": "Convert DICOM to a BIDS-compliant dataset",
  "menu": "Import",
  "inputs": {},
  "context": {
    "description": "BIDS dataset configuration accumulated during the workflow run",
    "fields": {}
  },
  "form": {
    "sections": []
  },
  "steps": {},
  "outputs": {}
}
```

Important workflow concepts:

- `inputs` are workflow launch inputs.
- `context.fields` are run sidecar values for user edits, heuristic results,
  metadata, and intermediate state.
- `form.sections` describe NiiVue Desktop UI review/edit screens.
- `steps` is an object keyed by step id.
- step inputs use `{ "ref": "..." }` and `{ "constant": ... }`.
- `outputMappings` copy tool outputs into context fields.
- `condition` is a dot-path expression evaluated against run state.
- `outputs` expose final workflow outputs by reference.

## Tool Shape

Current tools use:

```json
{
  "$schema": "../schemas/tool.schema.json",
  "name": "dcm2niix",
  "version": "1.0.0",
  "description": "Convert DICOM images to NIfTI format using dcm2niix CLI",
  "inputs": {},
  "outputs": {},
  "block": {},
  "exec": {}
}
```

Important tool concepts:

- `inputs` and `outputs` define typed parameters.
- `block` describes visual designer palette entries and form behavior.
- `exec` describes CLI execution and output collection.

The `exec` object can include:

- `binary`
- `outputDir`
- `resources`
- `forEach`
- `forEachExtract`
- `iterationVar`
- `parallel`
- `outputFile`
- `args`
- `exitCodes`
- `outputs`
- `postProcess`

## Heuristic Shape

Current heuristics use:

```json
{
  "$schema": "../schemas/heuristic.schema.json",
  "name": "filter-high-confidence",
  "version": "1.0.0",
  "description": "Filter series list to only include high-confidence classifications",
  "preserveExisting": true,
  "source": "context.series_list",
  "operations": [],
  "output": "json[]"
}
```

Important heuristic concepts:

- `source` is a dot-path into inputs, context, or step outputs.
- `operations` are ordered deterministic transformations.
- `output` is the final value type.
- `preserveExisting` allows user edits to win over recomputed heuristic output.

## Source-to-NeuroFlow Mapping

| Source concept | NeuroFlow core or extension |
| --- | --- |
| `name` | `id` in normalized documents |
| file family or schema | `kind` |
| `version` | `version` |
| `description` | `description` |
| workflow `menu` | `extensions["niivue/ui"].menu` |
| workflow `form` | `extensions["niivue/ui"].form` |
| `inputs` | core |
| `context.fields` | core |
| step `inputs` | core bindings |
| step `outputMappings` | core context writes |
| step `condition` | core for 0.1, likely typed expression later |
| workflow `outputs` | core |
| tool `block` | `extensions["niivue/ui"].block` |
| tool `exec` | `extensions["niivue/runtime"].exec` |
| heuristic `source` and `operations` | core |

## Type Mapping

Current source types are unqualified strings. NeuroFlow should accept them in a
source profile and canonicalize them to namespaced types in normalized
documents.

| Source type | Canonical type |
| --- | --- |
| `string` | `core:string` |
| `string[]` | `core:array<core:string>` |
| `number` | `core:number` |
| `number[]` | `core:array<core:number>` |
| `boolean` | `core:boolean` |
| `object` | `core:object` |
| `json[]` | `core:array<core:json>` |
| `directory` | `core:directory` |
| `volume` | `neuro:volume` |
| `volume[]` | `core:array<neuro:volume>` |
| `mask` | `neuro:mask` |
| `dicom-folder` | `neuro:dicom-folder` |
| `dicom-series[]` | `core:array<neuro:dicom-series>` |
| `series-mapping[]` | `core:array<neuro:series-mapping>` |
| `subject[]` | `core:array<neuro:subject>` |
| `bids-dir` | `neuro:bids-dataset` |

## Notes for Schema Work

The current workflow examples use `dependsOn` in context fields, but the source
`workflow.schema.json` does not currently define `dependsOn` under
`contextFieldDef` while `additionalProperties` is `false`. NeuroFlow should
either formalize `dependsOn` or remove it from source-compatible examples.

Some workflows depend on context fields populated by prior step
`outputMappings`. A semantic validator should understand these context writes
instead of checking only direct `steps.X.outputs.Y` references.

The current `steps` object is described as ordered. JSON object order should not
be the only portable execution semantic, so NeuroFlow should preserve source
order for compatibility while moving toward explicit dependencies.
