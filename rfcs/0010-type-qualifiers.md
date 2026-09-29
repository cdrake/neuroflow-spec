# RFC 0010: Type Qualifiers

Status: Proposed

Created: 2026-09-29

## Summary

This RFC adds three optional qualifiers to type declarations: `formats`
(the file formats a value may be encoded in), `space` (the coordinate
space a spatial value is expressed in), and `labelSystem` (the label
vocabulary a label map uses). A qualified type still names the same
`neuro:` concept; the qualifiers narrow it enough that a validator can
reject a binding that would fail at runtime, and a planner can insert
a conversion, resampling, or relabeling step where one is needed.

The qualifiers are adopted from the `automation.json` app contracts in
Neurodesk Webapps ([neurodesk/webapps#99](https://github.com/neurodesk/webapps/pull/99)),
the first implementation outside NiiVue to use the `neuro:` type
vocabulary. That contract declares `formats`, `space`, and
`labelSystem` beside `type` on inputs and artifacts; this RFC gives
those keys a single definition so a NeuroFlow tool document generated
from such a contract carries them without loss.

The companion specification text lives in
[spec/neuroflow-0.1.md §7](../spec/neuroflow-0.1.md). Schema changes
live in [schemas/0.1/common.schema.json](../schemas/0.1/common.schema.json)
(`typeDeclaration`) and
[schemas/0.1/tool.schema.json](../schemas/0.1/tool.schema.json)
(`toolOutputDef`).

## Decision

NeuroFlow 0.1 lets any type declaration carry `formats`, `space`, and
`labelSystem`:

```json
{
  "inputs": {
    "image": {
      "type": "neuro:volume",
      "description": "One anatomical head image, unstripped.",
      "formats": ["nifti"],
      "space": "individual"
    }
  },
  "outputs": {
    "labels": {
      "type": "neuro:label-map",
      "description": "Whole-brain segmentation on a 1 mm grid.",
      "formats": ["nifti"],
      "space": "inputs.image",
      "labelSystem": "freesurfer"
    }
  }
}
```

- `formats` is an array of lowercase format tokens. A declaration on an
  input lists what the tool accepts; on an output, what the tool may
  produce. Absent, the value is in whichever format is conventional for
  its type, which is what every implementation assumes today.
- `space` is a string naming a coordinate space, or a reference of the
  form `inputs.<local-id>` on a tool output, meaning "the same space as
  that input, whatever it turns out to be".
- `labelSystem` is a string naming the label lookup table a
  `neuro:label-map` or `neuro:probseg` value uses.

A qualifier on a `core:array<...>` declaration applies to every element.
Qualifiers take part in binding type compatibility (§20): a validator
rejects a binding whose declared qualifiers cannot match.

## Motivation

The `neuro:` vocabulary names concepts, not encodings. `neuro:volume`
says "a scalar image on a voxel grid" and nothing more. That was the
right choice for a portable core, but the implementations that exist
all quietly assume one encoding: the NeuroFlow reference runtime sniffs
`.nii` and `.nii.gz` when it registers an artifact, summarizes only
NIfTI, and the gallery tools pass NIfTI paths straight to `dcm2niix`,
`niimath`, and the brainchop CLI. Neurodesk's apps read NIfTI only. The
assumption is invisible in the documents, so it cannot be validated.

Several observations forced the change:

- **Validators cannot see a format mismatch.** A tool that emits MGZ
  (a FreeSurfer `mri_convert` wrapper) and a tool that reads only NIfTI
  both declare `neuro:volume`, so a workflow binding one to the other
  validates and then fails inside the second tool. With `formats` on
  both declarations the validator reports the mismatch at the binding.

- **Planners cannot insert conversions.** A planner that knows an
  upstream output is `["mgz"]` and a downstream input is `["nifti"]`
  can look for a tool that accepts `mgz` and produces `nifti` and splice
  it in. Without the qualifier it has nothing to reason from.

- **Chaining by type alone gets the space wrong.** In the
  prompt-to-workflow demo an agent chained `neuro:volume` into SynthSeg
  and into an affine registration correctly, but only because the tool
  descriptions said, in prose, that SynthSeg wants the unstripped
  native-space head and the registration output is in template space.
  A `label-volumes` step fed an MNI-resampled brain would have reported
  wrong millilitres with no error. `space` moves that fact out of prose
  into a field a validator can compare.

- **Label maps are only meaningful with their lookup table.** SynthSeg
  emits FreeSurfer label numbers; a tissue classifier emits 1, 2, 3. A
  tool that sums "left hippocampus" needs to know which. `labelSystem`
  is that declaration, and a binding between two different label
  systems is an error, not a silent miscount.

- **An external implementer already declares all three.** Neurodesk's
  `automation.json` puts `formats`, `space`, and `labelSystem` next to
  the NeuroFlow type on every input and artifact. Adopting the same
  keys, with the same meaning, means the generator from that contract
  to a NeuroFlow tool document is a projection rather than a mapping.

## Format tokens

`formats` items are lowercase tokens matching `^[a-z][a-z0-9-]*$`. The
vocabulary is open; the tokens below are registered by this RFC, and
implementations SHOULD use them where they apply rather than coining a
synonym:

| Token | Encoding | Typical types |
| --- | --- | --- |
| `nifti` | NIfTI-1 or NIfTI-2, plain or gzip-compressed | `neuro:volume`, `neuro:mask`, `neuro:label-map`, `neuro:statmap`, `neuro:probseg` |
| `mgz` | FreeSurfer MGH/MGZ volume | same |
| `nrrd` | NRRD, single file or detached header | same |
| `minc` | MINC 2 | same |
| `analyze` | Analyze 7.5 `.hdr`/`.img` pair | same |
| `dicom` | DICOM Part 10 files | `neuro:dicom-folder`, `neuro:dicom-series` |
| `gifti` | GIFTI surface or surface-data file | `neuro:surface` |
| `freesurfer-surface` | FreeSurfer binary surface | `neuro:surface` |
| `cifti` | CIFTI-2 | `neuro:cifti` |
| `trk` | TrackVis streamlines | `neuro:tract` |
| `tck` | MRtrix streamlines | `neuro:tract` |
| `ome-zarr` | OME-Zarr / NGFF store | `neuro:ome-zarr`, `neuro:ngff-zarr` |
| `bval-bvec` | FSL `.bval` and `.bvec` pair | `neuro:gradient-table` |
| `fsl-mat` | FSL 4×4 affine text matrix | `neuro:transform` |
| `itk-transform` | ITK/ANTs `.mat`, `.txt`, or `.h5` transform | `neuro:transform` |
| `lta` | FreeSurfer linear transform array | `neuro:transform` |
| `json` | JSON text | `core:json`, `core:object`, `bids:sidecar` |
| `tsv` | Tab-separated values with header row | `core:tabular`, `bids:*-table` |
| `csv` | Comma-separated values with header row | `core:tabular` |

`nifti` deliberately covers both `.nii` and `.nii.gz`: every reader that
handles one handles the other, and splitting them would make almost
every declaration list both. Compression is not a format.

A validator MUST NOT reject an unregistered token. A token outside this
table is an extension of the vocabulary in the same sense as an
extension type: it is preserved and compared literally.

## Spaces

`space` is a string. Two forms are defined:

- **A space label.** A name for a coordinate space. Where BIDS defines
  a `space-<label>` value for the space, that label MUST be used:
  `individual` (the subject's own acquisition space, unresampled),
  `MNI152NLin2009cAsym`, `MNI152NLin6Asym`, `MNI152Lin`, `fsnative`,
  `fsaverage`, `fsLR`, and the rest of the BIDS "image-based coordinate
  systems" and "template-based coordinate systems" lists. Labels not in
  BIDS are allowed and compared literally.
- **An input reference**, `inputs.<local-id>`, on a tool output only.
  It declares that the output is in the same space as the named input.
  A brain extractor writes `"space": "inputs.image"` on its brain and
  mask; a resampler writes `"space": "inputs.template"` on its
  registered volume. The reference grammar is the one in §8 restricted
  to the `inputs.` branch, so a validator reuses the parser it already
  has, and the input MUST be declared on the same tool.

A space label says nothing about the voxel grid: `individual` does not
imply the acquisition resolution and `MNI152NLin2009cAsym` does not
imply 1 mm. Grid resolution is left to a later RFC (see open issues).

`space` MAY appear on `neuro:volume`, `neuro:mask`, `neuro:label-map`,
`neuro:statmap`, `neuro:probseg`, `neuro:surface`, `neuro:tract`,
`neuro:cifti`, and on arrays of them. A validator MUST reject it on any
other spec-defined type. `neuro:transform` is excluded on purpose: a
transform relates two spaces, and a single `space` string cannot say
which is which.

## Label systems

`labelSystem` is a string naming the lookup table that gives meaning to
the integers in a label map. The vocabulary is open. Registered values:

| Value | Table |
| --- | --- |
| `freesurfer` | `FreeSurferColorLUT.txt`; what SynthSeg, FastSurfer, and `recon-all` emit |
| `fsl-fast` | FSL FAST tissue classes: 1 CSF, 2 GM, 3 WM |
| `spm-tpm` | SPM tissue probability map order: 1 GM, 2 WM, 3 CSF, 4 bone, 5 soft tissue, 6 air |
| `desikan-killiany` | Desikan-Killiany cortical parcellation |
| `destrieux` | Destrieux cortical parcellation |
| `aal` | Automated Anatomical Labeling atlas |
| `harvard-oxford` | Harvard-Oxford cortical and subcortical atlases |
| `schaefer` | Schaefer parcellations; the resolution is a separate concern |
| `binary` | 0 background, 1 foreground; the implied value for `neuro:mask` |

A value that is a URL is also allowed and names a lookup-table file
(BIDS `dseg.tsv` or FreeSurfer LUT format) that defines the system.

`labelSystem` MAY appear on `neuro:label-map` and `neuro:probseg` and
on arrays of them. A validator MUST reject it on any other spec-defined
type.

## Compatibility rules

Qualifiers extend the binding type compatibility check in §20. For a
binding from a source declaration S (a workflow input, a context field,
or a step output resolved through its tool) to a target declaration T
(a tool input, or a workflow output):

- **`formats`.** If both declare `formats` and the sets are disjoint,
  the binding is an error. If both declare and S lists a format T does
  not accept, the binding is a warning: the tool may produce a format
  the consumer cannot read. If either side omits `formats`, no check is
  made.
- **`space`.** If both declare `space` and the resolved labels differ,
  the binding is an error. A source `inputs.<id>` reference resolves to
  the `space` of whatever the workflow binds to that input on the
  producing step, recursively; a reference that resolves to an input
  with no `space` is treated as absent. If either side omits or resolves
  to absent, no check is made.
- **`labelSystem`.** If both declare `labelSystem` and the values
  differ, the binding is an error. If either side omits it, no check is
  made.

Comparison is literal, case-sensitive string equality. A validator MUST
NOT treat two labels it believes to be synonyms (`native` and
`individual`, `FreeSurfer` and `freesurfer`) as equal; the vocabularies
above exist so that authors converge on one spelling.

A runtime MAY relax these rules when it can act on the mismatch: a
runtime that can convert MGZ to NIfTI, or resample into a target space,
MAY accept the binding and record the conversion in provenance as its
own activity. Static validators report; they do not convert.

## Static validation

A validator MUST check:

- Every `formats` item matches `^[a-z][a-z0-9-]*$`; the array is
  non-empty and has no duplicates.
- `formats`, `space`, and `labelSystem` are absent from declarations
  whose type is `core:string`, `core:number`, `core:integer`,
  `core:boolean`, `core:object`, `core:json`, or an array of one of
  these.
- `space` appears only on the spatial types listed above, or on
  extension types, or on arrays of either.
- `labelSystem` appears only on `neuro:label-map`, `neuro:probseg`,
  extension types, or arrays of these.
- A `space` of the form `inputs.<local-id>` appears only on a tool
  output and names an input declared on the same tool.
- Binding compatibility per the rules above, where both sides declare
  the qualifier.

The first four rules are expressed in the JSON Schema; the last two are
semantic rules for §20.

## What this RFC does **not** specify

- **Conversion.** Which tool turns MGZ into NIfTI, or resamples from
  `individual` to `MNI152NLin2009cAsym`, is a registry and planning
  concern. This RFC only makes the need for a conversion visible.
- **Media types.** Neurodesk's contract also carries `mediaType`
  (`application/x-nifti`, `application/gzip`) on artifacts. That is a
  transport property of one delivered file, not of the type, and it
  belongs to the delivery and MCP-resource layers (RFC 0008, RFC 0009),
  where a runtime derives it from the harvested file. It is not a
  qualifier.
- **Grid resolution, orientation, or data type.** Neurodesk writes
  `subject-1mm` to say "subject space on a 1 mm grid". Under this RFC
  that is a literal, valid, unregistered label; the spec does not yet
  separate resolution from space. See open issues.
- **Transform source and target spaces.** A `neuro:transform` needs a
  pair of spaces. That is a separate, small RFC once the transform type
  itself is exercised by more than one tool.
- **Runtime introspection.** Whether a runtime reads the file header to
  check that a value really is NIfTI or really is in the declared space
  is an implementation choice. The declaration is a contract, and the
  validator checks contracts against each other.

## Alternatives considered

- **Encode the format in the type name** (`neuro:nifti-volume`,
  `neuro:mgz-volume`). Rejected: it multiplies the closed vocabulary by
  the number of encodings, and a tool that reads three formats would
  need a union type the grammar does not have. The same reasoning
  rejected folding delivery into the type in RFC 0008.
- **Put the qualifiers in an extension namespace** (`extensions.
  "neurodesk/contract"`). Rejected: the compatibility check has to run
  in every validator for the qualifiers to be worth declaring, and
  extension metadata MUST NOT change core validation (§18).
- **Closed `formats` and `space` vocabularies.** Rejected for now: the
  set of real formats is long-tailed, and BIDS already curates the
  space labels that matter. Registering tokens and requiring BIDS
  labels where they exist gives convergence without a change request
  for every new atlas. `labelSystem` is open for the same reason.
- **A structured `space` object** (`{ "sameAs": "image" }` for the
  relative case). Rejected: the `inputs.<id>` string reuses the §8
  grammar and the parser validators already have, and keeps `space` a
  string in every position.
- **A single `mediaType` instead of `formats`.** Rejected: media types
  for neuroimaging formats are mostly unregistered (`application/
  x-nifti` is a convention, and a gzipped NIfTI reports
  `application/gzip`, which says nothing), and one string cannot list
  the three formats a tool accepts.

## Prior art

[docs/type-qualifiers-survey.md](../docs/type-qualifiers-survey.md)
surveys how workflow languages, vocabularies and the common
neuroimaging packages express each qualifier, and lists the changes
to this RFC that the survey recommends. Those changes are not yet
applied to this draft.

## Open issues

- Should the spec add a `resolution` qualifier (`"1mm"`, or `[1, 1, 1]`
  in mm) so that `subject-1mm` can be written as `space` plus
  `resolution`? BIDS has the `res-<label>` entity, which is a keyword,
  not a measurement.
- Should `formats` be allowed on `core:file` and `core:directory`,
  where the token would be the only hint about content? The schema in
  this draft allows it.
- Should a validator warn when a `neuro:label-map` declaration omits
  `labelSystem`? Every label map has one; omitting it is almost always
  an oversight rather than "any".
- Provenance entities (§17) could record the resolved `space` and
  `labelSystem` of each artifact so that a downstream reader does not
  have to walk back to the tool document. The provenance schema is not
  changed by this RFC.
- Whether `space` labels should be validated against a fetched copy of
  the BIDS coordinate-system list. This draft compares literally and
  leaves label curation to authors.
