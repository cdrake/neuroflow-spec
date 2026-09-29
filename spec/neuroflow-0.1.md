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
- runtime events
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
- `neuro:tract`
- `neuro:ome-zarr`
- `neuro:ngff-zarr`
- `neuro:statmap`
- `neuro:probseg`
- `neuro:cifti`
- `neuro:gradient-table`
- `neuro:connectivity-matrix`
- `neuro:qc-metrics`
- `neuro:report`

These cover the artifacts current neuroimaging pipelines routinely exchange:

- `neuro:statmap` — a statistical or parametric map (e.g. z, t, F, beta, or
  effect-size), as produced by GLM, qMRI, or group analyses. Distinct from a raw
  intensity `neuro:volume`.
- `neuro:probseg` — a probabilistic segmentation: values in `[0, 1]` per
  structure (e.g. GM/WM/CSF tissue-probability maps from fMRIPrep/ANTs), one
  frame per structure. The discrete-segmentation counterpart is `neuro:label-map`.
- `neuro:cifti` — CIFTI grayordinate data combining surface vertices and
  subcortical voxels (`dscalar`/`dtseries`/`dlabel`), as used by HCP and fMRIPrep.
- `neuro:gradient-table` — a diffusion gradient scheme (b-values and b-vectors)
  accompanying DWI data (e.g. for QSIPrep).
- `neuro:connectivity-matrix` — a structural or functional connectivity matrix
  over a parcellation (the BIDS-Connectivity family).
- `neuro:qc-metrics` — image-quality metrics for a scan or dataset (e.g. MRIQC
  IQMs), structured for aggregation.
- `neuro:report` — a rendered QA/QC or processing report (HTML or PDF) for human
  review.

Generic tabular data uses the `core:tabular` primitive (§7): rows-and-columns
TSV/CSV such as confounds, motion regressors, or tractometry tables. BIDS-shaped
tables keep their specific `bids:` types.

`neuro:surface` is an anatomical surface mesh (e.g. a cortical surface);
`neuro:tract` is tractography streamlines (e.g. `.trk`/`.tck`). They are distinct
geometry types and are not interchangeable.

Viewer- or app-specific artifacts that are not general neuroimaging types — for
example a NeuroVue review correction patch — MUST use an open extension
namespace (`neurovue:correction-patch`), not an invented `neuro:` name, since
`neuro:` is a closed vocabulary (§7).

`neuro:ome-zarr` is an OME-Zarr (OME-NGFF) multiscale image — a Zarr store whose
group metadata conforms to the OME-NGFF specification (a `multiscales` pyramid,
optionally with `omero` rendering and labels). `neuro:ngff-zarr` is the
[`ngff-zarr`](https://github.com/fideus-labs/ngff-zarr) multiscale data model: a
spatial-image pyramid (named dimensions, scale/translation, units) that may be
held in memory or serialized to an OME-Zarr store. Use `neuro:ome-zarr` for the
on-disk store exchanged between steps, and `neuro:ngff-zarr` when a step's
contract is specifically the `ngff-zarr` representation rather than any
OME-Zarr store.

The BIDS layer defines BIDS-aligned artifact types that pipelines exchange.
The closed `bids:` vocabulary is enumerated in §7.

The provenance layer defines provenance-record types aligned with W3C PROV
concepts. The closed `prov:` vocabulary is enumerated in §7. The `provenance`
document family defined in §17 is the primary record produced by these types.

The UI layer is optional. UI metadata MUST live in extension namespaces.

The runtime layer is optional. Runtime metadata MUST live in extension
namespaces.

## 5. Document Families

This draft defines four document families:

- `workflow`
- `tool`
- `heuristic`
- `provenance`

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

`kind` identifies the document family and MUST be `workflow`, `tool`,
`heuristic`, or `provenance`.

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
- `core:tabular` — rows-and-columns tabular data (TSV/CSV), the generic
  substrate for confounds, regressors, and other pipeline tables.

The `neuro` namespace is reserved for the neuroimaging types listed in
section 4.

The `bids` namespace is reserved for BIDS-aligned artifact types that
neuroimaging pipelines routinely exchange:

- `bids:dataset-description` — contents of `dataset_description.json`.
- `bids:participants-table` — `participants.tsv` rows with header.
- `bids:participants-sidecar` — `participants.json` column definitions.
- `bids:sidecar` — JSON sidecar accompanying a data file (`*_bold.json`,
  `*_T1w.json`, `*_dwi.json`, etc.).
- `bids:events-table` — `*_events.tsv` rows for task fMRI timing.
- `bids:scans-table` — `sub-<id>_scans.tsv` per-session scan listing.
- `bids:sessions-table` — `sub-<id>_sessions.tsv` per-subject session listing.
- `bids:validation-report` — structured result from a BIDS validator.
- `bids:fix-proposal` — proposed change to one or more BIDS files (see §21
  runtime events and §22 fix proposals).
- `bids:derivatives-dataset` — a BIDS-Derivatives output dataset.
- `bids:entity-map` — entity key/value pairs (`sub`, `ses`, `task`, `run`,
  `acq`, `ce`, `rec`, `dir`, `mod`, `echo`, `space`, `desc`).

The `prov` namespace is reserved for provenance-artifact types aligned with
W3C PROV concepts:

- `prov:run-record` — a complete provenance document for one workflow run.
- `prov:checksum` — `{ algorithm, value }` digest of a file or value.
- `prov:agent` — a software, person, or organization participant.
- `prov:activity` — record of one step execution.
- `prov:entity` — input or output artifact reference (path, value, or both).

The `core`, `neuro`, `bids`, and `prov` namespaces are **closed vocabularies**:
a validator MUST reject a type in one of these namespaces that is not one of
the names defined by this specification. This makes a misspelled type
(`neuro:volme`, `bids:sidcar`) a validation error rather than a value silently
treated as an unknown type.

Any other namespace denotes an **open extension type**. A validator MUST accept
an extension type whose namespace is not one of the closed core namespaces,
MUST NOT attempt to interpret it, and MUST preserve it unchanged. Extension
types follow the same grammar (`namespace ":" name`) and may appear inside
the array container (`core:array<niivue:report>`).

Array values use the container form `core:array<element-type>`, for example
`core:array<neuro:volume>` or `core:array<core:string>`.

Type declarations MAY include `description`, `optional`, `default`, `enum`,
`min`, `max`, `label`, `extensions`, and the type qualifiers `formats`,
`space`, `resolution`, `density`, and `labelSystem`.

### 7.1 Type Qualifiers

A qualified type names a concept; a type qualifier narrows how a value of
that type is encoded or situated, so that validators can compare two
declarations and planners can insert a conversion between them (RFC 0010).

```json
{
  "type": "neuro:label-map",
  "description": "Whole-brain segmentation on a 1 mm grid.",
  "formats": ["nii-gz"],
  "space": "inputs.image",
  "resolution": 1,
  "labelSystem": "freesurfer"
}
```

- `formats` — array of format tokens, non-empty, no duplicates. On an
  input, the formats the tool accepts; on an output, the formats it may
  produce. Tokens form a two-level hierarchy: `nii`, `nii-gz` and
  `nii-pair` are children of `nifti`; `seg-nrrd` of `nrrd`; the
  `cifti-*` intents of `cifti`; `dicom-seg` of `dicom`; `dseg-tsv` of
  `tsv`. Other registered tokens include `analyze`, `mgz`, `minc`, `mha`,
  `mif`, `brik-head`, `ecat`, `npy`, `ome-zarr`, `gifti`,
  `freesurfer-surface`, `freesurfer-annot`, `freesurfer-label`, `vtk`,
  `trk`, `tck`, `trx`, `bval-bvec`, `fsl-mat`, `fnirt-coef`,
  `fnirt-field`, `x5`, `itk-transform`, `displacement-field`,
  `spm-deformation`, `mrtrix-warp`, `afni-1d`, `lta`, `xfm`,
  `matlab-mat`, `freesurfer-lut`, `json`, `tsv`, `csv`. RFC 0010 carries
  the registry with each token's parent and EDAM cross-reference. When
  `formats` is absent, the value is in the format conventional for its
  type.
- `space` — the coordinate space of a spatial value. Where BIDS defines a
  `space-<label>` value it MUST be used (`individual`,
  `MNI152NLin2009cAsym`, `MNI152NLin6Asym`, `MNI152Lin`, `fsnative`,
  `fsaverage`, `fsLR`, ...). A space label says nothing about the grid.
  `space` MAY appear on `neuro:volume`, `neuro:mask`, `neuro:label-map`,
  `neuro:statmap`, `neuro:probseg`, `neuro:surface`, `neuro:tract`,
  `neuro:cifti`, extension types, and arrays of these; a validator MUST
  reject it elsewhere, including on `neuro:transform`.
- `resolution` — voxel spacing in millimetres: one positive number for an
  isotropic grid, or three in axis order. `resolution` MAY appear on
  `neuro:volume`, `neuro:mask`, `neuro:label-map`, `neuro:statmap`,
  `neuro:probseg`, extension types, and arrays of these.
- `density` — surface mesh density as a BIDS `den-<label>` value (`32k`,
  `59k`, `164k`, `41k`, ...). `density` MAY appear on `neuro:surface`,
  `neuro:cifti`, extension types, and arrays of these.
- `labelSystem` — the integer table that gives meaning to the values of a
  label map, or the volume order of a probabilistic segmentation: a
  registered name (`freesurfer`, `mrtrix-fs-default`, `mrtrix-hcpmmp1`,
  `mrtrix-5tt`, `fsl-fast`, `spm-tpm`, `ants-atropos-6`,
  `harvard-oxford-cortical`, `harvard-oxford-subcortical`,
  `neuromorphometrics`, `aal`, `lpba40`, `hcp-mmp1`, `binary`, or
  `embedded` for a file that carries its own table), or a URL to a BIDS
  `dseg.tsv` or FreeSurfer LUT file. A label system is a specific table,
  not a parcellation: the same parcellation under different integers is a
  different label system. `labelSystem` MAY appear on `neuro:label-map`,
  `neuro:probseg`, extension types, and arrays of these.

Two forms are shared by all five qualifiers:

- **Inheritance from an input.** On a tool output only, a qualifier may be
  the string `inputs.<local-id>`, declaring that the output has the same
  value of that qualifier as the named input of the same tool, whatever
  it turns out to be. A brain extractor writes `"formats": "inputs.image"`,
  `"space": "inputs.image"`, `"resolution": "inputs.image"`.
- **Vendor prefixes.** Every qualifier vocabulary is open. A value that is
  neither a registered token nor, for `space` and `density`, a BIDS label,
  SHOULD carry a vendor prefix in the form `<vendor>:<value>`
  (`afni:MNI_ANAT`, `brainvoyager:vmr`, `neurodesk:subject-1mm`). The
  prefixes `core`, `neuro`, `bids`, and `prov` are reserved and a
  validator MUST reject them. Unregistered values are preserved and
  compared literally; a validator MUST NOT reject them.

None of the five qualifiers may appear on `core:string`, `core:number`,
`core:integer`, `core:boolean`, `core:object`, `core:json`, or arrays of
these. A qualifier on a `core:array<...>` declaration applies to every
element.

Qualifiers take part in binding type compatibility (§20). For a binding
from a source declaration to a target declaration, where both sides
declare the qualifier, after resolving any `inputs.<local-id>` reference
through the producing step's bindings:

- `formats`: a source token is accepted by a target token that equals it
  or is its parent. If no source token equals, is the parent of, or is a
  child of any target token, the binding is an error; otherwise a source
  token accepted by no target token is a warning.
- `space` and `density`: differing labels are an error.
- `resolution`: differing spacings are an error, a single number being
  expanded to three, with 0.001 mm tolerance per axis.
- `labelSystem`: differing values are an error, except that `embedded`
  against a named system is a warning.

Comparison of strings is literal and case-sensitive. When either side
omits a qualifier, or a reference resolves to a declaration without it,
no check is made for it. A runtime that can act on a mismatch (convert,
resample, relabel) MAY accept the binding and MUST record the conversion
in provenance as an activity of its own. A runtime writing a NIfTI
artifact declared in an MNI152 space SHOULD set its sform and qform codes
to 4, the only in-band signal FSL and FSLeyes read.

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

`stage` MAY tag the step with an informal workflow stage (`ingest`, `explore`,
or `publish`). It is a non-normative discovery and organization aid; the runtime
MUST NOT branch execution on it. See §27.

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

Visual designer metadata lives under `extensions["niivue/ui"].block`. A block
MAY carry an informal `stage` (`ingest`/`explore`/`publish`) so the designer can
group palette entries by stage; see §27.
Declarative CLI execution metadata lives under
`extensions["niivue/runtime"].exec`.

The core tool contract MUST NOT require a specific UI toolkit, viewer, or binary
packaging layout.

## 15. Output Delivery

The runtime needs a portable answer to a simple question: when a tool's
process exits (or before, for streamed outputs), where are the produced
values? NeuroFlow defines this as a separate concern from the runtime
events channel (§21). Events carry control-plane signals (progress, logs,
fix proposals, item failures, cancellation). **Output delivery** carries
data-plane bytes — the NIfTI volume, the BIDS dataset directory, the
JSON manifest of detected series — from the tool to the runtime.

A tool MAY declare delivery at the tool level (a default for all outputs)
and per output (an override). If neither is declared, the runtime falls
back to `core:result-file` (Section 15.2). A conforming runtime MUST
recognize every mode in the closed core vocabulary; it MAY support
extension delivery modes contributed by other namespaces, but this draft
does not define an extension-mode grammar.

### 15.1 Delivery vocabulary

The `core:` delivery vocabulary is closed in this draft:

| Mode | Where the value lives | Suited for |
| --- | --- | --- |
| `core:stdout-json` | Tool writes exactly one JSON object to stdout before exit; the object is `{output_name: value, ...}`. | Small scalar / structured outputs from short-running tools. |
| `core:result-file` | Tool writes one JSON file at `$NEUROFLOW_OUTPUT_FILE`; the file is `{output_name: value, ...}`. | Mixed scalar and path outputs from a single tool invocation. The default when no delivery is declared. |
| `core:result-dir` | Tool writes one artifact per output into `$NEUROFLOW_OUTPUT_DIR`. Path within the directory is taken from the output's `delivery.path` if present, otherwise from a default rule (Section 15.3). | Tools that produce many large outputs and prefer one-file-per-output. |
| `core:event-stream` | Value arrives via a `core:output-final` event (§21). Streaming intermediate values via `core:output-intermediate` is also permitted. | Long-running tools that compute outputs incrementally, and outputs whose timing matters more than their durability. |
| `core:fixed-path` | Tool writes the output to a deterministic relative path under `$NEUROFLOW_WORK_DIR`, declared by the output's `delivery.path`. | Wrapped legacy tools with conventional output filenames the workflow author cannot influence. |
| `core:exit-code` | Output value is the process exit code, restricted to integer-typed outputs. | Tools whose only output is a status code. |

Validators MUST reject `core:` delivery modes not in this list.

### 15.2 Discovery

The runtime selects the delivery mode (per tool default and per-output
overrides come from the tool document) and signals the chosen mode to
the tool through environment variables at launch:

- `NEUROFLOW_OUTPUT_MODE` — the chosen tool-level default mode (e.g.
  `core:result-file`). Tools that ship single delivery code paths MAY
  ignore this; tools that support multiple modes inspect it.
- `NEUROFLOW_OUTPUT_FILE` — absolute path for `core:result-file`.
- `NEUROFLOW_OUTPUT_DIR` — absolute path for `core:result-dir`.
- `NEUROFLOW_WORK_DIR` — absolute path of the tool's working directory.
  Used as the base for `core:fixed-path` and as a convenient scratch
  area for any tool.

`NEUROFLOW_RUN_ID` and the events channel discovery variables (§21) are
still set alongside these; output delivery and event delivery are
independent channels.

### 15.3 Default paths inside `core:result-dir`

For an output declared with `delivery.mode: "core:result-dir"` and no
explicit `delivery.path`:

- A value-typed output (anything other than `core:file`,
  `core:directory`, or a `core:array<core:file>` etc.) is delivered at
  `<output-name>.json` containing the JSON-encoded value.
- A file-typed output (`core:file` or any `neuro:` type that resolves to
  a file artifact) is delivered at `<output-name>` and the file content
  *is* the output value.
- A directory-typed output (`core:directory`, `neuro:bids-dataset`,
  `neuro:dicom-folder`, etc.) is delivered at `<output-name>/` as a
  subdirectory.

When `delivery.path` is supplied, it is used verbatim and overrides
these defaults.

### 15.4 Interaction with the events channel

`core:event-stream` is the data-plane sibling of `core:output-final` /
`core:output-intermediate`. The two are deliberately distinct:

- A tool that declares `core:event-stream` delivery for output `X` MUST
  also declare an `events.emits` channel whose `type` is
  `core:output-final` (and MAY additionally declare one whose `type` is
  `core:output-intermediate`). The output's optional `delivery.eventName`
  selects which channel carries the final value; if absent, the runtime
  accepts `core:output-final` events whose `payload.output` equals `X`.
- Tools delivering via any other mode MAY still emit
  `core:output-intermediate` events for the same output without
  declaring `core:event-stream`. Such events are progress signals only;
  the canonical final value still arrives through the declared delivery
  mode.
- A tool that emits `core:output-final` for an output not declared as
  `core:event-stream` causes the runtime to prefer the event-carried
  value over the harvested value, matching the existing rule in §21.

### 15.5 Static validation

A validator MUST check:

- Each `delivery.mode` is one of the enumerated `core:` modes.
- For `core:exit-code`, the output's `type` is `core:integer`.
- For `core:event-stream`, the tool declares an `events.emits` channel
  whose `type` is `core:output-final`; if `delivery.eventName` is given,
  it MUST match a key in `events.emits` whose `type` is
  `core:output-final` (or `core:output-intermediate` for intermediates).
- Output names referenced by `delivery.path` collisions within
  `core:result-dir` MUST be unique; two outputs MUST NOT resolve to the
  same path within the result directory.
- A tool that declares any output with `delivery.mode: "core:event-stream"`
  MUST also declare at least one transport under `events.transports`.

### 15.6 Runtime obligations

A conforming runtime MUST:

- Set the discovery environment variables before launching the tool.
- Create `$NEUROFLOW_WORK_DIR`, and for the chosen modes also
  `$NEUROFLOW_OUTPUT_DIR` (as an empty directory) and the parent of
  `$NEUROFLOW_OUTPUT_FILE`.
- Harvest outputs only after the tool process has exited (for non-event
  modes) or after a `core:output-final` event has been received (for
  `core:event-stream`), whichever the declared mode selects.
- Treat a missing required output (non-`optional`) as a step failure
  governed by `step.errorPolicy` (§23).

## 16. Heuristic Documents

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

## 17. Provenance Documents

A provenance document records what happened during one workflow run. It is a
deliverable artifact: a workflow runtime SHOULD emit a `provenance` document
when a run completes, fails, is cancelled, or is snapshotted. The shape is
defined in [`schemas/0.1/provenance.schema.json`](../schemas/0.1/provenance.schema.json).

A provenance document MUST be valid JSON, MUST satisfy the provenance JSON
Schema, and SHOULD be embeddable in BIDS-Derivatives datasets (for example, as
`dataset_description.json` `GeneratedBy[]` augmentation, or as a sibling
`*_prov.json` file) and in RO-Crate research objects.

```json
{
  "neuroflow": "0.1.0",
  "kind": "provenance",
  "id": "niivue.desktop/dicom-to-bids/run-2026-05-24-001",
  "version": "1.0.0",
  "description": "DICOM-to-BIDS run for Project A, batch 3.",
  "run": {
    "runId": "run-2026-05-24-001",
    "startedAt": "2026-05-24T12:00:00.000Z",
    "endedAt":   "2026-05-24T12:18:42.500Z",
    "status": "completed",
    "host": { "platform": "darwin", "arch": "arm64", "hostname": "lab-mac-01" }
  },
  "workflow": {
    "id": "niivue.desktop/dicom-to-bids",
    "version": "2.0.0",
    "checksum": { "algorithm": "sha256", "value": "…" }
  },
  "agents": [
    { "id": "agent-niivue-desktop", "type": "software", "name": "NiiVue Desktop", "version": "0.7.3" },
    { "id": "agent-dcm2niix",      "type": "software", "name": "dcm2niix", "version": "1.0.20240202" },
    { "id": "agent-operator-001",  "type": "person", "name": "C. Drake" }
  ],
  "activities": [
    {
      "id": "act-convert",
      "stepId": "convert",
      "toolId": "niivue.desktop.tools/dcm2niix",
      "toolVersion": "1.0.20240202",
      "agent": "agent-dcm2niix",
      "startedAt": "2026-05-24T12:00:01.100Z",
      "endedAt":   "2026-05-24T12:10:33.220Z",
      "status": "completed",
      "used":      ["ent-dicom-dir"],
      "generated": ["ent-converted-volumes"],
      "exitCode": 0
    }
  ],
  "entities": [
    { "id": "ent-dicom-dir", "type": "neuro:dicom-folder", "role": "workflow-input", "path": "/data/dicoms/proj-a/batch-3" },
    { "id": "ent-converted-volumes", "type": "core:array<neuro:volume>", "role": "step-output", "path": "derivatives/niivue-desktop/", "derivedFrom": ["ent-dicom-dir"] }
  ],
  "inputs":  { "dicom_dir": "ent-dicom-dir" },
  "outputs": { "bids_dir":  "ent-bids-dataset" },
  "decisions": [
    {
      "id": "dec-fix-missing-tr",
      "kind": "fix-approval",
      "at": "2026-05-24T12:14:01.000Z",
      "agent": "agent-operator-001",
      "activity": "act-fix-sidecar",
      "summary": "Approved auto-fix that populated RepetitionTime from DICOM (0019,XXXX) for 3 sidecars.",
      "proposal": { "entity": "ent-fix-proposal-tr" }
    }
  ]
}
```

`run` identifies and times the run. `runId` MUST match the `runId` carried in
runtime events for the same run (§21). `run.status` is `completed`,
`partial`, `failed`, `cancelled`, `halted`, or (for snapshots taken while a
run is still executing) `in-progress`; `partial` indicates the run finished
with one or more failed-but-tolerated steps under the workflow's
`errorPolicy`, and `halted` indicates the runtime stopped at a step failure
before producing public outputs (see Section 23). When status is `halted` or
`failed`, `run.haltedAtStep` SHOULD identify the failing step.

`workflow` records the workflow document `id` and `version` as executed, and
SHOULD include a `checksum` of the workflow JSON for tamper-evidence.

`agents` lists PROV-style agents: software (with version and resolved binary
or container reference), people, and organizations. Every activity SHOULD
reference an agent.

`activities` records each step execution in order. An activity carries
`stepId`, `toolId`, `toolVersion`, lifecycle timestamps, the entity ids it
`used` and `generated`, and a final `status` (`completed`, `partial`,
`failed`, `skipped`, or `cancelled`). `partial` means the step finished and
produced outputs but accumulated one or more tolerated item failures; those
failures appear in `itemFailures[]`. Activities created by workflow-level
error handlers (declared in `workflow.errorPolicy.onError`) carry
`handlerFor` set to the failing step id. Activities SHOULD record final
`contextWrites` so the run-context evolution is reconstructable.

`entities` are PROV entities: workflow inputs, step inputs and outputs, and
context snapshots. File entities SHOULD carry a `checksum` so downstream
consumers can detect tampering. `derivedFrom` records the lineage chain
(PROV `wasDerivedFrom`). File entities that live inside a BIDS dataset MAY
carry `bidsEntities` recording the BIDS key/value pairs (`sub`, `ses`,
`task`, `run`, `desc`, …) for that file.

`inputs` and `outputs` map workflow input/output identifiers to entity ids.
`outputs` is the canonical list of **final products** of the run.

`decisions` records branch points, fix proposals, fix approvals, manual
overrides, and skips. This is the audit trail that explains why the run
produced what it did. Each fix-approval / fix-rejection SHOULD reference the
fix-proposal entity by id.

`events` MAY contain a compact summary of notable events emitted during the
run (typically `core:status` transitions and `core:error` events). The full
event log is implementation-defined; this is the portable summary that other
tools can consume.

A conforming runtime that produces provenance MUST ensure that:

- Every workflow input is represented as a `workflow-input` entity referenced
  in `inputs`.
- Every workflow output is represented as a `workflow-output` entity
  referenced in `outputs`.
- Every executed step appears as one activity.
- Every entity referenced by an activity's `used` or `generated` exists in
  `entities`.

## 18. Extensions

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

Extension namespaces are governed by the extension registry (§28), which also
defines `requiredExtensions` and validator conformance levels.

## 19. Execution Semantics

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

When a step fails (tool failure or its `errorPolicy.tolerateItemFailures`
bound is exceeded), the runtime consults `step.errorPolicy.onError` and
`workflow.errorPolicy` (see Section 23) to decide whether to halt the run,
mark dependents skipped, or run handler steps. Resumption of a halted or
failed run is an implementation concern and is not specified here.

Runtimes SHOULD record provenance, including document versions, resolved tool
versions, input identifiers, output identifiers, context writes, item failures,
and extension metadata used for execution.

## 20. Semantic Validation Rules

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
- type-qualifier compatibility (§7.1): where both sides of a binding declare
  `formats`, `space`, `resolution`, `density`, or `labelSystem`, the format
  tokens are related through the token hierarchy, and the resolved space,
  resolution, density and label-system values match; a qualifier of the
  form `inputs.<local-id>` appears only on a tool output and names an
  input of the same tool
- condition reference validity
- heuristic source validity
- heuristic output type compatibility
- extension namespace validity
- compatibility between workflow-declared outputs and resolved tool outputs
- event-binding validity: each `eventBindings.contextWrites` key matches a key
  in the tool's `events.emits` map, the bound channel's declared `type` is
  `core:context-write`, the channel's `valueType` is compatible with the
  target context field's declared type, the target context field exists, and
  the target context field is declared with `liveWritable: true`
- event-transport compatibility: any `eventBindings.transport` is one of the
  transports the tool declares under `events.transports`
- sibling-subscription validity: each `eventBindings.subscribeTo[].step` names
  a declared step in the same workflow; each listed `names[]` entry matches a
  key in that sibling tool's `events.emits` map; any `inputBinding` is an
  input declared on the subscribing step's tool
- fix-loop validity: each step `fixLoop.fixerStep` names a declared step;
  the validator step's tool declares an `events.emits` channel of type
  `core:fix-proposal`; `maxIterations >= 1`
- error-policy validity: `step.errorPolicy.onError` is one of the enumerated
  values; `tolerateItemFailures.maxFraction` is in `[0, 1]`; each
  `requiredOutputs[]` names a declared output on the step's tool
- workflow error-policy validity: `workflow.errorPolicy.haltOnSteps[]` and
  `workflow.errorPolicy.onError[]` name declared steps; handler steps named
  in `workflow.errorPolicy.onError` are not reachable through the public
  outputs' dependency graph
- output-delivery validity: each `delivery.mode` is one of the enumerated
  `core:` modes; `core:exit-code` is only declared on `core:integer` outputs;
  a tool with any `core:event-stream` output declares at least one transport
  under `events.transports` and an `events.emits` channel of type
  `core:output-final`; within one tool no two outputs delivered via
  `core:result-dir` resolve to the same path

## 21. Runtime Events

Runtime events let a running tool communicate with the workflow runtime before
the step has finished. Events can stream progress, log lines, lifecycle status,
intermediate or final outputs, and proposed writes to live-writable context
fields. The events channel is the only normative mechanism for tool-to-runtime
notification during a step; other interprocess communication MAY be used for
implementation reasons but is not portable.

The events channel is transport-agnostic. The envelope is a single JSON object,
and any of the standard transports defined below can carry it. A conforming
runtime MUST accept the envelope shape and MUST recognize the closed
`core:` event-type and transport vocabularies. A conforming runtime MAY support
extension transports and extension event types; if it does not, it MUST ignore
them rather than fail.

### 20.1 Event Envelope

Every event is a single JSON object matching the envelope defined in
[`schemas/0.1/events.schema.json`](../schemas/0.1/events.schema.json):

```json
{
  "neuroflowEvent": "0.1.0",
  "runId": "run-2026-05-24-001",
  "stepId": "convert",
  "toolId": "niivue.desktop.tools/dcm2niix",
  "sequence": 17,
  "timestamp": "2026-05-24T12:34:56.789Z",
  "type": "core:context-write",
  "name": "series_list_partial",
  "payload": {
    "field": "series_list_partial",
    "value": [{ "series_uid": "1.2.840...", "datatype": "anat" }],
    "merge": "append"
  }
}
```

`neuroflowEvent` MUST be `0.1.0` for documents declaring `neuroflow: 0.1.0`.

`runId` is opaque and supplied by the runtime when launching the tool; tools
MUST echo it unchanged.

`stepId` MUST be the local identifier of the step whose tool emitted the event.

`sequence` is a monotonic per-(runId, stepId) integer starting at 0. Runtimes
SHOULD process events in sequence order per step.

`timestamp` is the emission time in RFC 3339 format.

`type` is a qualified event type. The `core:` namespace is closed and defined
below.

`name` is an optional emitter-defined channel name. When the event type is
namespaced and the tool declares an `events.emits` map, `name` MUST be a key
from that map.

`payload` is event-type-specific. For core types the payload shape is
constrained by `events.schema.json`.

### 20.2 Core Event Vocabulary

The `core:` event vocabulary is closed in this draft:

- `core:status` — lifecycle state change (`started`, `running`, `paused`,
  `resumed`, `completed`, `failed`, `cancelled`).
- `core:progress` — fractional and/or counted progress with an optional unit
  and human-readable message.
- `core:log` — log line with severity (`debug`, `info`, `warn`, `error`).
- `core:heartbeat` — keep-alive ping carrying optional message text.
- `core:context-write` — proposes a write to a context field bound through
  step `eventBindings.contextWrites`. The target context field MUST be declared
  with `liveWritable: true`.
- `core:output-intermediate` — emits a partial value for a named tool output.
  Runtimes MAY surface intermediate outputs to subscribers but MUST NOT mark
  the output final.
- `core:output-final` — emits the final value for a named tool output.
  Supersedes any value the runtime would otherwise collect at step completion
  for that output.
- `core:error` — non-fatal (`fatal: false`) diagnostic or fatal (`fatal: true`)
  failure for the step as a whole. A `fatal: true` error MUST cause the runtime
  to treat the step as failed; per-step `errorPolicy` then governs whether the
  workflow halts, notifies, or continues with downstream steps.
- `core:item-error` — per-item failure inside a tool that processes a batch of
  inputs. The tool itself has not failed; it is reporting that one input was
  skipped or could not be processed. The runtime records the failure on the
  activity and consults the step's `errorPolicy.tolerateItemFailures` to decide
  whether the step ultimately succeeds, partially succeeds, or fails. See
  Section 23.
- `core:fix-proposal` — a structured proposal for repairing or modifying
  workflow artifacts. See Section 22.
- `core:await-approval` — signals the tool is waiting on operator (or policy)
  approval before continuing. See Section 22.
- `core:cancel-request` — cooperative cancellation. A tool MAY observe this
  event from the runtime (when delivered via a subscribed channel) or emit it
  toward sibling steps (when the tool is an orchestrator). Cooperating tools
  SHOULD wind down promptly and emit `core:status` with state `cancelled`.

Validators MUST reject `core:` event types not in this list. Extension event
types follow the qualified-type grammar (`namespace:name`) and MUST NOT use the
`core` namespace.

### 20.3 Transports

A transport defines how the JSON envelope crosses the process boundary between
a tool and the runtime. The `core:` transport vocabulary is closed in this
draft:

| Transport | Direction | Wire format | Channel discovery |
| --- | --- | --- | --- |
| `core:stdout-ndjson` | tool → runtime | Newline-delimited envelopes on stdout. | Implicit; runtime reads child stdout. |
| `core:stderr-ndjson` | tool → runtime | Newline-delimited envelopes on stderr. | Implicit; runtime reads child stderr. |
| `core:event-file` | tool → runtime | Tool appends newline-delimited envelopes to a single file. | File path passed in `NEUROFLOW_EVENT_ENDPOINT`. |
| `core:event-dir` | tool → runtime | Tool writes one JSON envelope per file into a directory. Runtime watches the directory and consumes files in name order. | Directory path passed in `NEUROFLOW_EVENT_ENDPOINT`. |
| `core:unix-socket` | tool → runtime | Newline-delimited envelopes over a Unix domain socket. | Socket path passed in `NEUROFLOW_EVENT_ENDPOINT`. |
| `core:named-pipe` | tool → runtime | Newline-delimited envelopes over a Windows named pipe. | Pipe name passed in `NEUROFLOW_EVENT_ENDPOINT`. |
| `core:tcp` | tool → runtime | Newline-delimited envelopes over a TCP connection. | `host:port` passed in `NEUROFLOW_EVENT_ENDPOINT`. |
| `core:http-webhook` | tool → runtime | Tool POSTs one envelope per request as `application/json`. | Absolute URL passed in `NEUROFLOW_EVENT_ENDPOINT`. |
| `core:websocket` | bidirectional | One envelope per WebSocket text message. | `ws://` or `wss://` URL passed in `NEUROFLOW_EVENT_ENDPOINT`. |

Validators MUST reject `core:` transports not in this list. Extension transports
follow the qualified-type grammar. A runtime that encounters an extension
transport it does not support MUST fall back to a transport it shares with the
tool, or fail step launch with a clear error.

### 20.4 Channel Discovery

The runtime selects exactly one supported transport at launch and signals the
selection to the tool through the following environment variables:

- `NEUROFLOW_EVENT_TRANSPORT` — the chosen transport identifier
  (e.g. `core:unix-socket`).
- `NEUROFLOW_EVENT_ENDPOINT` — the endpoint (file path, socket path, URL, etc.)
  for transports that carry one. Absent for `core:stdout-ndjson` and
  `core:stderr-ndjson`.
- `NEUROFLOW_EVENT_TOKEN` — optional shared secret. When present, tools MUST
  include it on each event, either as an `Authorization: Bearer …` header
  (HTTP transports) or as a `token` field at the top of the envelope (other
  transports). A runtime that issues a token MUST reject events that do not
  carry it.
- `NEUROFLOW_RUN_ID` — value to use in envelope `runId`.
- `NEUROFLOW_STEP_ID` — value to use in envelope `stepId`.

Runtime profiles MAY also pass these values as CLI arguments through their own
extension (for example via `niivue/runtime` `exec.args`). Environment variables
are the portable contract.

### 20.5 Tool-Side Declaration

A tool document MAY declare its event capabilities under the top-level
`events` key:

```json
{
  "events": {
    "transports": ["core:stdout-ndjson", "core:event-file"],
    "emits": {
      "progress": {
        "type": "core:progress",
        "description": "Per-volume conversion progress."
      },
      "series_list_partial": {
        "type": "core:context-write",
        "description": "Streams classified series as they are recognized.",
        "valueType": "core:array<neuro:series-mapping>"
      }
    }
  }
}
```

`transports` is the set of transports the tool can emit on. The runtime picks
one supported transport at launch.

`emits` declares named event channels. Each channel's `type` MUST be a known
event type. For `core:context-write`, `core:output-intermediate`, and
`core:output-final` channels, `valueType` declares the qualified type of the
emitted value and MUST be compatible with the bound context field or tool
output. An empty or absent `events` block means the tool emits no events.

### 20.6 Workflow-Side Subscription

A workflow step MAY subscribe to its tool's events under `eventBindings`:

```json
{
  "convert": {
    "tool": "niivue.desktop.tools/dcm2niix",
    "inputs": {},
    "eventBindings": {
      "transport": "core:unix-socket",
      "contextWrites": {
        "series_list_partial": "series_list"
      }
    }
  }
}
```

`transport` is the preferred transport for this step. If declared, it MUST be
one of the transports the tool declares. If absent, the runtime chooses any
mutually supported transport.

`contextWrites` maps tool-side event channel names (matching keys in the tool's
`events.emits` map and carried in `core:context-write` payload `field`) to
context field local identifiers. The target context field MUST be declared
with `liveWritable: true`. Validators MUST reject a binding whose target is
not live-writable.

`core:context-write` events whose tool-side `payload.field` is not present in
`contextWrites` MUST be ignored by the runtime, not treated as an error.

A step MAY also subscribe to events emitted by sibling steps via
`eventBindings.subscribeTo`:

```json
{
  "monitor": {
    "tool": "niivue.desktop.tools/qc-monitor",
    "inputs": {},
    "eventBindings": {
      "transport": "core:stdout-ndjson",
      "subscribeTo": [
        {
          "step": "convert",
          "types": ["core:progress", "core:status"]
        },
        {
          "step": "classify",
          "names": ["series_partial"],
          "inputBinding": "series_stream"
        }
      ]
    }
  }
}
```

When sibling subscriptions are declared, the runtime forwards matching events
from the named sibling steps into the subscribing step's tool over its own
transport. Validators MUST reject a `subscribeTo` entry whose `step` is not
declared in the workflow, whose `names` are not declared in the sibling
tool's `events.emits` map, or whose `inputBinding` is not a declared input of
the subscribing step's tool. Sibling subscriptions enable monitor, QC,
orchestrator, and aggregator patterns without bespoke IPC.

### 20.7 Ordering, Delivery, and Idempotency

Within a single `(runId, stepId)`, `sequence` is strictly monotonic. Runtimes
SHOULD apply events in sequence order and SHOULD detect and discard duplicate
sequences (at-least-once delivery).

`core:context-write` payloads carry `merge`, with values:

- `replace` (default) — the new value supersedes the current context value.
- `append` — for `core:array<…>` target fields, append the new value's
  elements to the current array.
- `merge` — for `core:object` and `core:json` target fields, shallow-merge
  the new value into the current object; new keys overwrite.

Runtimes MUST reject a `merge` mode that does not match the target context
field's declared type.

### 20.8 Security

Runtimes MUST treat events as untrusted input from a child process or remote
caller and MUST validate envelopes against this specification before applying
them.

Local transports (`core:event-file`, `core:event-dir`, `core:unix-socket`,
`core:named-pipe`) SHOULD be created with file-system permissions that restrict
access to the runtime's effective user.

Network transports (`core:tcp`, `core:http-webhook`, `core:websocket`) MUST
either bind to loopback or carry the `NEUROFLOW_EVENT_TOKEN` shared secret;
runtimes MUST reject events without a matching token when one was issued.

A runtime MUST NOT execute, eval, or otherwise interpret event payload values
as code.

### 20.9 Effect on Execution Semantics

Section 19 step-evaluation rules are extended as follows. After the runtime
launches a step's tool and before the step is marked complete:

- The runtime accepts events from the tool on the chosen transport.
- `core:context-write` events bound through `eventBindings.contextWrites` are
  applied to the run context as they arrive. Heuristics with `dependsOn`
  entries naming a live-writable field MAY be re-evaluated; whether a runtime
  re-runs heuristics on live writes is an open issue.
- `core:output-final` events satisfy that output for the purpose of subsequent
  steps and workflow outputs; the runtime SHOULD NOT also collect the same
  output from result inspection.
- A `core:status` event with state `completed` or `failed`, or a `core:error`
  event with `fatal: true`, MUST terminate the step in that state once the
  underlying process exits.

Runtimes SHOULD record events into provenance alongside resolved tool
versions, input identifiers, and context writes.

## 22. Fix Proposals and Pipeline Flow Control

Real neuroimaging pipelines frequently encounter remediable issues:

- A NIfTI JSON sidecar missing a BIDS-required field (`RepetitionTime`,
  `EchoTime`, `PhaseEncodingDirection`, `EffectiveEchoSpacing`,
  `FieldStrength`).
- A scanner-assigned subject identifier that does not match the project's
  BIDS naming policy (`Patient_001` → `sub-001`).
- An anatomical scan that should be defaced for sharing, or refaced for
  visualization or QC.
- A series classification with low confidence that should be confirmed by
  an operator before downstream steps consume it.
- An `IntendedFor` pointer in a fieldmap sidecar that needs updating after
  series-level relabeling.

These cases share a structural pattern: a detector or validator step
identifies the issue, proposes a structured change, and either auto-applies
the change (when policy allows) or pauses for operator approval. NeuroFlow
defines this pattern in the core so detectors, fixers, and runtimes from
different vendors interoperate.

### 21.1 Fix proposal events

A detector emits a `core:fix-proposal` event (§21). The payload carries a
`proposalId`, a `summary`, a `severity` (`info`, `warn`, or `error`), an
optional `category` label (e.g. `bids:missing-sidecar-field`,
`bids:reface`, `bids:subject-relabel`), a list of `targets` (paths,
context fields, or provenance entity ids), an ordered list of declarative
`operations`, and an `autoApprove` flag.

The `operations` vocabulary is closed: `set-field`, `delete-field`,
`rename-field`, `set-bids-entity`, `rename-file`, `copy-file`,
`delete-file`, `patch-json`, `replace-image`, `annotate`. Fixers consume
these declaratively; no script execution is implied.

### 21.2 Awaiting approval

A step that needs operator confirmation before continuing emits a
`core:await-approval` event referencing one or more `proposalIds` and an
optional `timeoutMs`. The runtime pauses the step. The operator (or an
automated approver) records an approval or rejection. The runtime resumes
the step with the decision.

Step-level approval policy is declared by `awaitApproval`:

- `none` (default) — proposals are surfaced but the step does not block.
- `auto` — proposals marked `autoApprove: true` are applied without
  operator interaction; others are surfaced.
- `required` — every proposal pauses the step.

### 21.3 Fix loops

A common pipeline shape is `detector → fixer → re-validate`. A step that
acts as the validator half MAY declare a `fixLoop`:

```json
{
  "validate": {
    "tool": "niivue.desktop.tools/bids-validate",
    "inputs": {
      "bids_dir": { "ref": "context.staging_dir" }
    },
    "fixLoop": {
      "fixerStep": "fix_sidecars",
      "maxIterations": 5,
      "stopOn": "no-error-proposals"
    }
  },
  "fix_sidecars": {
    "tool": "niivue.desktop.tools/bids-fix-sidecar",
    "inputs": {
      "bids_dir":    { "ref": "context.staging_dir" },
      "proposals":   { "ref": "context.pending_fixes" }
    },
    "awaitApproval": "auto"
  }
}
```

After the validator runs, the runtime forwards its emitted fix proposals to
`fixerStep`. If the fixer completes successfully, the runtime re-runs the
validator. The cycle stops when the `stopOn` condition holds or
`maxIterations` is reached. A `fixLoop` whose iteration cap is exhausted
MUST terminate the step as failed.

### 21.4 Recording in provenance

Every fix proposal raised, approved, rejected, or skipped MUST appear as a
`decisions[]` entry in the provenance document. The fix-proposal payload
itself SHOULD be recorded as a `bids:fix-proposal` (or other domain) entity
that the decision references via `proposal.entity`.

### 21.5 Static validation

A validator MUST check:

- Each `fixLoop.fixerStep` names a declared step in the same workflow.
- `fixLoop.maxIterations` is at least 1.
- `awaitApproval` is one of the enumerated values.
- A step declaring `fixLoop` declares an `events` block on its tool that
  includes a `core:fix-proposal` channel.

## 23. Error Handling, Halt, and Notification

Real pipelines mix two kinds of failure that the runtime MUST treat
differently:

- **Tool failures** — the tool itself cannot finish, signaled by a
  `core:status` event with state `failed`, a `core:error` event with
  `fatal: true`, or a non-zero exit code.
- **Item failures** — the tool finished, but one or more inputs in a batch
  could not be processed. The tool surfaces each failure as a
  `core:item-error` event (§21). The tool's own outputs still arrive; they
  simply omit (or annotate) the bad items.

A pipeline that processes 1000 DICOM series will frequently encounter
malformed series that should not abort the run; conversely, a single failure
in a registration step that produces the canonical reference image MUST halt
the run. NeuroFlow lets each step declare its tolerance, and lets the
workflow declare what happens when a step still fails after that tolerance is
applied. Resumption of failed or halted workflows is an implementation
concern of the runtime and is not specified by NeuroFlow; this section only
defines the visible boundary (halt, notify, run handlers, write provenance).

### 22.1 Step `errorPolicy`

Each step MAY declare an `errorPolicy`:

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

The fields:

- `onError` (default `halt`) — reaction when the tool itself fails. `halt`
  stops the workflow; `continue` marks the step failed but lets downstream
  steps run (dependents that need this step's outputs are skipped);
  `skip-dependents` is `continue` plus an explicit cascade so transitive
  dependents are marked skipped without each runtime guessing; `notify` is
  `continue` plus a mandatory notification.
- `tolerateItemFailures` — bounds for `core:item-error` accumulation. The
  step is treated as failed (and `onError` applies) when `max` is exceeded,
  when `failures / total` exceeds `maxFraction` (where `total` is taken from
  the tool's `core:progress` events), or when fewer than `minSuccesses`
  items succeeded. Any one bound being exceeded is enough.
- `requiredOutputs` — tool outputs that MUST be present (and non-empty for
  array types) for the step to be considered successful, even if item
  failures stayed within tolerance.
- `notify` — opaque channel identifiers that the runtime SHOULD use to
  notify operators when this step fails or accumulates item failures.
  Channel definitions are extension-namespaced.

A step with no `errorPolicy` halts the workflow on tool failure and treats
any `core:item-error` event as a step failure.

### 22.2 Workflow `errorPolicy`

The workflow MAY declare a top-level `errorPolicy`:

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

The fields:

- `defaultOnError` — value of `step.errorPolicy.onError` for steps that do
  not declare their own.
- `haltOnSteps` — step ids whose failure MUST halt the workflow regardless
  of those steps' own `errorPolicy`. Use for the small set of pins in an
  otherwise tolerant pipeline.
- `onError` — handler step ids the runtime runs when the workflow halts or
  completes with any failed step. Handlers are ordinary steps elsewhere in
  `steps`; they MUST NOT be on the normal dependency graph leading to
  public outputs.
- `notify` — opaque channel identifiers for workflow-level notifications.
- `completionStatus` — how a run that finishes with one or more
  failed-but-tolerated steps is labelled in the provenance `run.status`:
  `partial` (recommended) or `success`.

### 22.3 Cooperative cancellation

A runtime cancels a step by emitting `core:cancel-request` toward the step's
tool through the runtime-events channel. Cooperating tools SHOULD wind down
promptly and emit `core:status` with state `cancelled`. If the tool does not
respond within an implementation-defined grace period, the runtime MAY
escalate by terminating the process; the resulting activity records
`status: cancelled` either way.

Orchestrator tools (those subscribed to sibling-step events) MAY also emit
`core:cancel-request` toward sibling steps. The runtime relays the event to
the target step's tool. Sibling-emitted cancellation is advisory; only the
runtime ultimately decides whether a step is terminated.

### 22.4 Notification channels

The core specification does not enumerate notification channels: a runtime
may speak to a desktop toast, a Slack webhook, an email gateway, or a
log-only sink. Channel identifiers in `notify` arrays are opaque strings
that an extension namespace defines (for example, the `niivue/runtime`
namespace declares `niivue:desktop-toast`). A runtime that does not
recognise a channel identifier MUST silently skip it rather than fail the
workflow.

Runtimes MUST notify on the channels listed in `errorPolicy.notify` at the
following points:

- step failure (after `tolerateItemFailures` is consulted),
- workflow halt,
- workflow completion with `completionStatus: partial`.

### 22.5 Recording in provenance

The runtime MUST record failure outcomes in the provenance document:

- `run.status` MUST be one of `completed`, `partial`, `failed`, `cancelled`,
  `halted`, or `in-progress`. `partial` indicates one or more
  failed-but-tolerated steps; `halted` indicates the runtime stopped at a
  step failure before producing public outputs.
- `run.haltedAtStep` MUST be set when `status` is `halted` or `failed`.
- An activity for a step that accumulated `core:item-error` events MUST
  carry an `itemFailures[]` array. When the step still finished
  successfully under its `tolerateItemFailures` bounds, its activity
  `status` is `partial`; otherwise `failed`.
- An activity created by a workflow-level error handler MUST carry
  `handlerFor` set to the failing step id.

### 22.6 Static validation

A validator MUST check:

- `step.errorPolicy.onError` is one of the enumerated values.
- `tolerateItemFailures.maxFraction` is in `[0, 1]`.
- `requiredOutputs[]` names declared outputs on the step's tool.
- `workflow.errorPolicy.haltOnSteps[]` and `errorPolicy.onError[]` name
  declared steps.
- Steps listed in `workflow.errorPolicy.onError` are not reachable through
  `outputs` dependency resolution (handlers must not gate public outputs).

## 24. Compatibility

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

## 25. Relationship to Existing Standards

NeuroFlow is intended to interoperate with existing neuroimaging and workflow
standards rather than replace them.

| Standard | Primary role | NeuroFlow relationship |
| --- | --- | --- |
| BIDS | Neuroimaging dataset organization | NeuroFlow references, the closed `bids:` type vocabulary, and the `bids/profile` reference extension describe BIDS datasets, subjects, sessions, sidecars, and validation reports. The fix-proposal pattern (§22) targets BIDS-typical issues such as missing required sidecar fields, subject relabeling, and refacing. |
| BIDS-Derivatives | Derived neuroimaging outputs | The `provenance` document family (§17) is intended to embed in derivatives `dataset_description.json.GeneratedBy[]` entries or as sibling `*_prov.json` files. |
| CWL/WDL | Portable workflow execution languages | NeuroFlow may compile to or interoperate with these systems, while keeping UI-native and neuro-typed semantics in its own model. |
| Nextflow/Snakemake | Workflow orchestration systems | NeuroFlow may be adapted to these runtimes through extensions. |
| Boutiques | Command-line tool descriptors | NeuroFlow tool contracts can align with Boutiques concepts while remaining JSON Schema centered. |
| W3C PROV | General provenance model | The `provenance` document family is PROV-aligned: agents map to PROV Agent, activities to PROV Activity, entities to PROV Entity, and `derivedFrom` to PROV `wasDerivedFrom`. NeuroFlow provenance is one PROV-compatible serialization, not a replacement. |
| RO-Crate | Research-object packaging | A NeuroFlow `provenance` document is designed to embed as an RO-Crate metadata entity. |
| BIDS-Apps | Containerized BIDS-aware tools | Tool documents can describe BIDS-App entry points via the `niivue/runtime` (or analogous) extension; the `bids/profile` extension declares the role and modality coverage. |
| HeuDiConv / dcm2bids | DICOM → BIDS conversion with heuristics | `neuro:dicom-folder`, `neuro:dicom-series`, and `neuro:series-mapping` types plus the heuristic document family cover the same use cases as these tools' heuristic configurations. |

## 26. Open Issues

- Version range grammar for tool references.
- Nullable and optional output semantics.
- Reference paths into arrays and structured objects.
- Explicit step dependencies versus object-order execution.
- BIDS entity modeling.
- Provenance model and relationship to W3C PROV or RO-Crate.
- Whether and how heuristics should be re-evaluated when a live `core:context-write`
  changes one of their `dependsOn` fields.
- Back-pressure and rate-limit semantics for high-volume event streams.
- Bidirectional event transports beyond `core:websocket` (runtime-to-tool
  control messages such as cancel, pause, resume).
- Source and target spaces, direction, and coordinate convention for
  `neuro:transform` (RFC 0010 leaves the transform type unqualified).

## 27. Workflow Stages

NeuroFlow defines three coarse **stages** that organize a workflow and the tools
that drive it:

| Stage | Intent | Reference adapter |
| --- | --- | --- |
| `ingest` | Bring data in and shape it into a dataset. | BIDSvue / bidsui |
| `explore` | Review, correct, and process artifacts. | NeuroVue |
| `publish` | Compose figures, captions, graphs, and reports. | composer (TBD) |

Stages are **informal and non-normative**. They exist primarily for discovery —
so an author looking for "the Ingest tools" can filter a palette — and for
recording how a document is organized. A conforming runtime MUST NOT branch
execution, gate steps, or change validation outcomes based on a stage value.
Because stages carry no execution semantics, this section uses no normative
requirements beyond that prohibition.

### 27.1 Reference adapters are defaults, not requirements

The adapters named above are the reference implementation NeuroFlow ships for
each stage; they are not part of the contract. Any tool MAY fill any stage,
including generic custom tools — for example a tool that opens a file or a
browser at QA images, or one that runs a Python or shell script. A `stage`
describes *where a tool sits in the flow*; a block `category`
(`Import`/`Processing`/`Quality`/`Output`, §14) describes *what kind of work it
does*. The two are independent and either MAY be omitted.

### 27.2 The `stage` value

`stage` is a string drawn from a closed vocabulary:

```text
"ingest" | "explore" | "publish"
```

It is defined once as `workflowStage` in `common.schema.json` and referenced
wherever a stage may appear. It is OPTIONAL in every position.

### 27.3 Placement

A `stage` MAY appear in two places:

1. **On a workflow step** — `steps.<id>.stage`. This records the stage a placed
   step belongs to. It is the only signal for stage-ambiguous custom tools (an
   "open a file" or "run a script" tool has no `category` to derive from). The
   field is toolkit-neutral: any UI, or none, may read it.

   ```json
   {
     "convert": {
       "tool": "niivue.desktop.tools/dcm2niix",
       "stage": "ingest",
       "inputs": { "dicom_dir": { "ref": "inputs.dicom_dir" } }
     }
   }
   ```

2. **On a designer block** — `extensions["niivue/ui"].block.stage`. This groups a
   tool's palette entry under a stage in the visual designer (§14, §18). Block
   metadata is a `niivue/ui` extension concern, not portable core.

   ```json
   {
     "id": "filter-import-dicoms",
     "label": "Filter and Import DICOMs",
     "category": "Import",
     "stage": "ingest",
     "exposedFields": ["dicom_dir"]
   }
   ```

### 27.4 Untagged tools and steps

`stage` is optional everywhere. An untagged step or block is unaffected and, by
convention, a designer groups untagged palette entries under "Other". This keeps
the tag zero-cost: an author opts in only when stage placement is useful, and
removing it again is deleting one optional field.

### 27.5 Validation

A document with a `stage` outside the closed vocabulary is invalid against the
schemas. A reference validator MAY additionally surface an unrecognized stage as
a non-fatal warning rather than a hard error when validating leniently, since
stages carry no execution semantics; doing so MUST NOT set the document's
validity to false on the basis of stage alone.

### 27.6 Future hooks

The stage boundary is a natural seam that later drafts MAY build on, but 0.1
intentionally leaves unused:

- **Session handoff** — checkpoint context and provenance at the ingest →
  explore boundary (see the BIDSvue/NeuroVue integration plan).
- **Gating** — block publish until explore has produced reviewed outputs.
- **Promotion** — mark where explore working state becomes a shareable publish
  artifact.

None of these are defined here; the tag only leaves the door open.

## 28. Extension Registry

NeuroFlow is an open, extensible standard. The core type vocabulary (`core:`,
`neuro:`, `bids:`, `prov:`) is deliberately small and closed (§7), and covers
the artifacts common neuroimaging pipelines exchange today. Everything
application- or domain-specific is expressed through **extensions**: extension
types (`namespace:name`, §7) and extension metadata (`extensions["namespace"]`,
§18). This section defines how those namespaces are governed.

### 28.1 Open by default, registered by review

Any namespace other than the four closed core namespaces is a legal extension. A
conforming tool MUST accept it, MUST NOT attempt to interpret it, and MUST
preserve it unchanged (§7, §18). This keeps the standard open: an application can
ship a new type or metadata block without waiting for anyone.

A namespace becomes **registered** when its schema is merged into the
neuroflow-spec extension registry. Registration is by pull request, and the
neuroflow-spec maintainers act as the **registrar**. This is the same model the
NIH uses for NIfTI header extension codes: anyone may use an extension, but the
namespaces and their meanings are recorded centrally so the ecosystem stays
interoperable.

The registry lives at `schemas/0.1/extensions/`:

- `registry.json` — the authoritative list of registered namespaces, each with a
  maintainer, contact, status, schema file, and optional reserved types.
- `registry.schema.json` — validates `registry.json`.
- `<namespace>.schema.json` — one JSON Schema per registered namespace.

The registration process and PR checklist are documented in
`schemas/0.1/extensions/README.md`.

### 28.2 Registered namespace lifecycle

A registry entry has a `status`:

- `provisional` — submitted and merged for use, schema may still change.
- `registered` — stable; changing its meaning is a breaking change.
- `deprecated` — retained for compatibility; SHOULD NOT be used in new documents.

A registered namespace MUST NOT be removed or repurposed; deprecate it instead.
Adding a new registered namespace or a new reserved type to an existing one is
non-breaking (§24).

### 28.3 Validator conformance

A validator declares one of two conformance levels:

- **Core-conformant** — validates the closed core vocabulary and document
  structure, and treats every extension namespace as opaque: it MUST preserve
  extensions and MUST NOT fail validation because of an unknown or unregistered
  extension. This is the minimum bar and the default.
- **Extension-aware** — additionally resolves registered namespaces against the
  registry and MAY validate extension metadata objects and extension-type values
  against their registered `<namespace>.schema.json`. An extension-aware
  validator MAY report a registered-schema mismatch, but a mismatch in an
  extension MUST NOT change the document's core validity.

Unregistered extensions are never validated, only preserved. There is no mode in
which an unknown extension makes a document non-conformant; that is what keeps
NeuroFlow open.

### 28.4 Requiring an extension

A document MAY declare that a runtime must understand specific namespaces to
execute it, via a `requiredExtensions` array in the document `extensions` block:

```json
{
  "extensions": {
    "neuroflow/core": { "requiredExtensions": ["neurovue", "niivue/runtime"] }
  }
}
```

A runtime that does not understand every listed namespace MUST refuse to execute
the document rather than silently ignoring required behavior. `requiredExtensions`
does not affect static validation: a core-conformant validator still validates
and preserves the document; the obligation is on the executing runtime. Listing a
namespace in `requiredExtensions` does not require it to be registered, but
registration is strongly recommended for anything a runtime is required to
understand.
