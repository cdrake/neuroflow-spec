# RFC 0010: Type Qualifiers

Status: Proposed

Authors: Chris Drake (NiiVue); Steffen Bollmann (Neurodesk), whose draft
in [neurodesk/webapps#107](https://github.com/neurodesk/webapps/pull/107)
this RFC absorbs (co-authorship confirmed on 2026-10-02)

Created: 2026-09-29

Revised: 2026-09-29 (after the [prior-art survey](../docs/type-qualifiers-survey.md));
2026-09-30 (reconciled with the Neurodesk draft in
[neurodesk/webapps#107](https://github.com/neurodesk/webapps/pull/107));
2026-09-30 (merged into one RFC for both projects: string values defined
as the serialization of the Neurodesk pair form, revisions on space
labels, the `0.1.1` envelope value, and an implementation plan with
owners); 2026-09-30 (after review on the pull request: a revision the
consumer declares and the producer does not is `requires-runtime-check`
at the validator's floor, which replaces the strict executor profile,
and executor conformance cases)

## Summary

This RFC adds five optional qualifiers to type declarations: `formats`
(the file formats a value may be encoded in), `space` (the coordinate
space a spatial value is expressed in), `resolution` (the voxel spacing
of a gridded value), `density` (the mesh density of a surface value),
and `labelSystem` (the integer table a label map uses). A qualified
type still names the same `neuro:` concept; the qualifiers narrow it
enough that a validator can reject a binding that would fail at
runtime, and a planner can insert a conversion, resampling, or
relabeling step where one is needed.

The qualifiers are adopted from the `automation.json` app contracts in
Neurodesk Webapps ([neurodesk/webapps#99](https://github.com/neurodesk/webapps/pull/99)),
the first implementation outside NiiVue to use the `neuro:` type
vocabulary. That contract declares `formats`, `space`, and
`labelSystem` beside `type` on inputs and artifacts; this RFC gives
those keys a single definition so a NeuroFlow tool document generated
from such a contract carries them without loss. `resolution` and
`density` were added after a survey of how AFNI, SPM, FSL, FreeSurfer,
ANTs, MRtrix3, Connectome Workbench, 3D Slicer and the BIDS,
TemplateFlow, CWL and Galaxy vocabularies express the same facts; the
survey is in [docs/type-qualifiers-survey.md](../docs/type-qualifiers-survey.md).
The second revision reconciles this RFC with the draft Steffen Bollmann
wrote for the Neurodesk contract generator
([neurodesk/webapps#107](https://github.com/neurodesk/webapps/pull/107)):
three compatibility outcomes instead of error-or-warning, the rule that
an unknown source value is not a pass, subject identity for `individual`
spaces, the executor's obligation to resolve or fail, a conformance
table, table revisions on label systems, and a migration path for
contracts whose annotations are not yet portable.

The third revision makes this the single RFC for both projects, in
place of the two drafts. The string values here are defined as the
serialization of the pair form the Neurodesk draft proposed, so
neither side loses information; a revision may follow `@` on a space
label as well as on a label system; a revision the consumer declares
and the producer does not claim is `requires-runtime-check`, never a
pass, which is the exact-identity rule the Neurodesk draft asked for
restated in three-outcome terms; and a document that uses any qualifier
declares `"neuroflow": "0.1.1"`, so that a runtime built against 0.1.0
rejects it instead of running a workflow whose constraints it cannot
read. The implementation plan near the end names an owner for each
piece.

The companion specification text lives in
[spec/neuroflow-0.1.md §7.1](../spec/neuroflow-0.1.md). Schema changes
live in [schemas/0.1/common.schema.json](../schemas/0.1/common.schema.json)
(`typeDeclaration`) and
[schemas/0.1/tool.schema.json](../schemas/0.1/tool.schema.json)
(`toolOutputDef`).

## Decision

NeuroFlow 0.1 lets any type declaration carry `formats`, `space`,
`resolution`, `density`, and `labelSystem`:

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
      "formats": ["nii-gz"],
      "space": "inputs.image",
      "resolution": 1,
      "labelSystem": "freesurfer"
    },
    "brain": {
      "type": "neuro:volume",
      "description": "The input with non-brain voxels zeroed.",
      "formats": "inputs.image",
      "space": "inputs.image",
      "resolution": "inputs.image"
    }
  }
}
```

- `formats` is an array of format tokens. A declaration on an input
  lists what the tool accepts; on an output, what the tool may produce.
  Absent, the value is in whichever format is conventional for its
  type, which is what every implementation assumes today.
- `space` is a string naming a coordinate space.
- `resolution` is a number (isotropic voxel spacing in millimetres) or
  an array of three numbers (spacing per axis).
- `density` is a string naming a mesh density.
- `labelSystem` is a string naming the integer table a
  `neuro:label-map` or `neuro:probseg` value uses.

**Inheritance from an input.** On a tool output, any of the five may
instead be the string `inputs.<local-id>`, meaning "the same as that
input, whatever it turns out to be". This is the contract every
pass-through tool has always had in prose (a brain extractor keeps the
input's format, space and grid; a resampler keeps the label system)
and never had in a field.

**Vendor prefixes.** Each vocabulary below is open. A value that is not
a registered token, and not a BIDS label where BIDS defines one, SHOULD
carry a vendor prefix, `<vendor>:<value>`, in the same way an extension
type carries a namespace: `afni:MNI_ANAT`, `afni:HaskinsPeds`,
`fsl:MNI152_T1_2mm`, `neurodesk:subject-1mm`. A prefixed value is
preserved and compared literally, it cannot collide with a token
registered later, and it records where the name came from when two
packages disagree. The prefixes `core`, `neuro`, `bids` and `prov` are
reserved.

**Revisions.** A `space` label or a `labelSystem` name MAY carry a
revision after `@`: `freesurfer@7.4.1`, `fsaverage@7.4.1`,
`neurodesk:atlas@2`. The name is the identity and the revision narrows
it (see Spaces and Label systems). A revision is never required: most
tools cannot state one honestly, and a name without one is a weaker
claim, not a wrong one.

**String form.** Each value is a string, and each string is the
serialization of a pair. `name@revision` is `{ "id": name, "version":
revision }`; `inputs.<local-id>` is `{ "kind": "relative", "input":
<local-id> }`; a bare label is the pair with the revision absent. The
Neurodesk draft
([neurodesk/webapps#107](https://github.com/neurodesk/webapps/pull/107))
wrote the pairs as objects; this RFC writes them as strings because a
string validates with a pattern, compares, sorts and greps without a
parser, and is what the `automation.json` contracts already carry. An
implementation MAY parse a value into the pair and MUST compare it as
the rules below say, not as an opaque string. No information is lost
in either direction.

**Specification version.** A document that carries any of the five
qualifiers declares `"neuroflow": "0.1.1"`; a document without them
keeps `"0.1.0"`. See Specification version below.

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
  The mismatch can be finer than the family: SPM refuses gzip-compressed
  NIfTI outright, and FSL chooses between `.nii`, `.nii.gz` and
  `.hdr`/`.img` from an environment variable rather than the output
  name.

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

- **Space and grid change independently.** SynthStrip keeps the input's
  space and grid; SynthSeg keeps the space and resamples to 1 mm;
  registration changes both; FreeSurfer conforms to 256³ at 1 mm while
  staying in the subject's space. Neurodesk wrote `subject-1mm` to say
  "subject space on a 1 mm grid" because one string had to carry both
  facts. `resolution` separates them, as BIDS separates `space-` from
  `res-`, and `density` does the same for surface meshes (`fsLR` at
  32k or 164k vertices).

- **Label maps are only meaningful with their integer table.** SynthSeg
  emits FreeSurfer label numbers; a tissue classifier emits 1, 2, 3;
  MRtrix's `labelconvert` renumbers the same FreeSurfer structures to 1
  through 84. A tool that sums "left hippocampus" needs to know which. A
  parcellation name such as Desikan-Killiany is not enough, because the
  same parcellation is carried under three different integer schemes.
  `labelSystem` names the table, and a binding between two different
  tables is an error, not a silent miscount.

- **An external implementer already declares three of the five.**
  Neurodesk's `automation.json` puts `formats`, `space`, and
  `labelSystem` next to the NeuroFlow type on every input and artifact.
  Adopting the same keys, with the same meaning, means the generator
  from that contract to a NeuroFlow tool document is a projection
  rather than a mapping.

## Format tokens

`formats` items are tokens matching `^[a-z][a-z0-9-]*$`, or
vendor-prefixed tokens matching `^[a-z][a-z0-9.-]*:[a-z][a-z0-9-]*$`.
The vocabulary is open; the tokens below are registered by this RFC,
and implementations SHOULD use them where they apply rather than
coining a synonym.

Tokens form a hierarchy. A token with a `parent` is a narrower case of
the parent: every `nii-gz` file is a `nifti` file. A declaration lists
the narrowest token it can stand behind. A tool that reads any NIfTI
packaging says `["nifti"]`; SPM, which cannot read a gzip-compressed
file, says `["nii", "nii-pair"]`; a tool that always writes `.nii.gz`
says `["nii-gz"]`.

A token names a byte layout or a directory layout, not a filename
suffix. A consumer that needs uncompressed bytes says `nii`; it does
not infer that from `.nii`, and a validator that cannot open the file
decides from the suffix only where the token defines one. A category
is not a token: `surface` and `volume` are types, and a declaration
that means "any surface format the tool reads" lists the tokens.

| Token | Parent | Encoding | Typical types | EDAM |
| --- | --- | --- | --- | --- |
| `nifti` | | NIfTI-1 or NIfTI-2 in any packaging | `neuro:volume`, `neuro:mask`, `neuro:label-map`, `neuro:statmap`, `neuro:probseg` | `format_3549` |
| `nii` | `nifti` | single uncompressed `.nii` | same | |
| `nii-gz` | `nifti` | gzip-compressed `.nii.gz` | same | |
| `nii-pair` | `nifti` | NIfTI `.hdr`/`.img` pair, plain or gzip | same | |
| `analyze` | | Analyze 7.5 `.hdr`/`.img` pair (not NIfTI) | same | |
| `mgh` | | FreeSurfer MGH in any packaging | same | |
| `mgz` | `mgh` | gzip-compressed MGH `.mgz` | same | |
| `nrrd` | | NRRD, single file or detached `.nhdr` | same | `format_3551` |
| `seg-nrrd` | `nrrd` | 3D Slicer segmentation NRRD with per-segment header keys | `neuro:label-map` | |
| `minc` | | MINC 2 | volumes | |
| `mha` | | MetaImage `.mha` or `.mhd` | volumes | |
| `mif` | | MRtrix `.mif`, `.mif.gz`, or `.mih` with `.dat` | volumes | |
| `brik-head` | | AFNI `.BRIK`/`.HEAD` pair, plain or gzip | volumes | |
| `ecat` | | ECAT 7 `.v` | `neuro:volume` | |
| `npy` | | NumPy array | `neuro:volume` | `format_4003` |
| `dicom` | | DICOM Part 10 files | `neuro:dicom-folder`, `neuro:dicom-series` | `format_3548` |
| `dicom-seg` | `dicom` | DICOM Segmentation object | `neuro:label-map` | |
| `ome-zarr` | | OME-Zarr / NGFF store | `neuro:ome-zarr`, `neuro:ngff-zarr` | `format_3915` (Zarr) |
| `gifti` | | GIFTI surface or surface-data file | `neuro:surface` | |
| `freesurfer-surface` | | FreeSurfer binary triangle surface | `neuro:surface` | |
| `freesurfer-annot` | | FreeSurfer `.annot` with embedded color table | `neuro:surface`, `neuro:label-map` | |
| `freesurfer-label` | | FreeSurfer `.label` vertex list | `neuro:surface`, `neuro:mask` | |
| `mz3` | | Surf-Ice MZ3 mesh, plain or gzip | `neuro:surface` | |
| `obj` | | Wavefront OBJ mesh | `neuro:surface` | |
| `ply` | | Stanford PLY mesh | `neuro:surface` | |
| `stl` | | STL triangle mesh, ASCII or binary | `neuro:surface` | |
| `vtk` | | legacy VTK polydata or structured points | `neuro:surface`, `neuro:volume` | |
| `cifti` | | CIFTI-2, any intent | `neuro:cifti` | |
| `cifti-dtseries` | `cifti` | intent 3002 dense time series | `neuro:cifti` | |
| `cifti-dscalar` | `cifti` | intent 3006 dense scalar | `neuro:cifti` | |
| `cifti-dlabel` | `cifti` | intent 3007 dense label, table embedded | `neuro:cifti`, `neuro:label-map` | |
| `cifti-dconn` | `cifti` | intent 3001 dense connectivity | `neuro:cifti`, `neuro:connectivity-matrix` | |
| `cifti-pconn` | `cifti` | intent 3003 parcellated connectivity | same | |
| `cifti-ptseries` | `cifti` | intent 3004 parcellated time series | `neuro:cifti` | |
| `cifti-pscalar` | `cifti` | intent 3008 parcellated scalar | `neuro:cifti` | |
| `trk` | | TrackVis streamlines | `neuro:tract` | |
| `tck` | | MRtrix streamlines | `neuro:tract` | |
| `trx` | | TRX streamlines (zip or directory) | `neuro:tract` | |
| `bval-bvec` | | FSL `.bval` and `.bvec` pair | `neuro:gradient-table` | |
| `bval` | | FSL `.bval` b-values text | `neuro:gradient-table`, `core:file` | |
| `bvec` | | FSL `.bvec` gradient directions text | `neuro:gradient-table`, `core:file` | |
| `fsl-mat` | | FLIRT 4×4 text matrix in FSL scaled-voxel coordinates | `neuro:transform` | |
| `fnirt-coef` | | FNIRT spline coefficient NIfTI (intents 2007 to 2009) | `neuro:transform` | |
| `fnirt-field` | | FNIRT displacement field NIfTI (intent 2006) | `neuro:transform` | |
| `x5` | | fslpy X5 HDF5 transform | `neuro:transform` | |
| `itk-transform` | | ITK/ANTs `.mat`, `.txt`, `.tfm`, or `.h5` transform (LPS) | `neuro:transform` | |
| `displacement-field` | | vector NIfTI displacement field (ITK intent 1007) | `neuro:transform` | |
| `spm-deformation` | | SPM `y_`/`iy_` deformation NIfTI | `neuro:transform` | |
| `mrtrix-warp` | | `mrtransform` 4-D or 5-D warp image | `neuro:transform` | |
| `afni-1d` | | AFNI `.1D` text, including `.aff12.1D` affines | `neuro:transform`, `core:tabular` | |
| `lta` | | FreeSurfer linear transform array | `neuro:transform` | |
| `xfm` | | MNI `.xfm` text transform | `neuro:transform` | |
| `matlab-mat` | | MATLAB MAT-file (SPM `*_seg8.mat`, `*_sn.mat`) | `core:file` | `format_3626` |
| `freesurfer-lut` | | FreeSurfer color lookup table text | `core:tabular` | |
| `onnx` | | ONNX model graph | `core:file` | |
| `dseg-tsv` | `tsv` | BIDS `dseg.tsv` label table | `core:tabular`, `bids:*-table` | |
| `json` | | JSON text | `core:json`, `core:object`, `bids:sidecar` | `format_3464` |
| `tsv` | | Tab-separated values with header row | `core:tabular`, `bids:*-table` | `format_3475` |
| `csv` | | Comma-separated values with header row | `core:tabular` | `format_3752` |

The EDAM column is a cross-reference for CWL and nf-core adapters; EDAM
1.25 has no term for MGH, MINC, GIFTI, CIFTI, TRK, TCK or MRtrix
formats. Where a Pydra `fileformats` class exists (`NiftiGz`, `Mgh`,
`Nrrd`, `Gifti`, `DicomSeries`, MRtrix `ImageFormat`, `Tracks`) the
mapping is by name.

A validator MUST NOT reject an unregistered token. A token outside this
table is an extension of the vocabulary in the same sense as an
extension type: it is preserved and compared literally, and it SHOULD
carry a vendor prefix (`brainvoyager:vmr`).

## Spaces

`space` is a string. Three forms are defined:

- **A space label.** Where BIDS defines a `space-<label>` value for the
  space, that label MUST be used: `individual` (the subject's own
  acquisition space, unresampled), `MNI152NLin2009cAsym`,
  `MNI152NLin6Asym`, `MNI152Lin`, `MNI305`, `MNIColin27`, `Talairach`,
  `fsnative`, `fsaverage`, `fsLR`, and the rest of the BIDS
  "image-based coordinate systems" and "template-based coordinate
  systems" lists.
- **A vendor-prefixed label** for a space BIDS does not name:
  `afni:MNI_ANAT`, `afni:HaskinsPeds`. A prefix is not a substitute
  for a BIDS label that exists: AFNI's `TT_N27` is written `Talairach`.
- **An input reference**, `inputs.<local-id>`, on a tool output only.

Packages name the same templates differently. A tool document uses the
BIDS label; an adapter maps from the package's name:

| BIDS label | Package names |
| --- | --- |
| `MNI152NLin2009cAsym` | AFNI `MNI_2009c_asym`; SPM12+ `TPM.nii` and "MNI space"; CAT12 templates; TemplateFlow `tpl-MNI152NLin2009cAsym`; NIDM `Icbm Mni152 Non Linear2009c Asymmetric` |
| `MNI152NLin6Asym` | FSL `MNI152_T1_*` (ICBM 152 nonlinear 6th generation); HCP `MNINonLinear`; ANTs via TemplateFlow |
| `MNI152Lin` | AFNI `MNI` (`MNI_avg152T1`), `MNI_SPM2`; SPM `avg152T1`; FSL `MNI152lin`; NIDM `Icbm Mni152 Linear` |
| `MNI305` | SPM `avg305T1`; FreeSurfer `talairach.xfm` target; NIDM `Mni305` |
| `MNIColin27` | AFNI `MNI_N27`, `MNI_caez_N27` |
| `Talairach` | AFNI `TT_N27`, `TLRC`, `TT_Daemon`; DICOM well-known frame of reference `1.2.840.10008.1.4.1.1` |
| `individual` | FreeSurfer conformed `orig.mgz`; SPM "native"; AFNI `ORIG`; Neurodesk `native` |
| `fsnative` | FreeSurfer subject surface space |
| `fsaverage` | FreeSurfer `fsaverage` (with `density` for `fsaverage5`, `fsaverage6`) |
| `fsLR` | HCP `fs_LR` (with `density` `32k`, `59k`, `164k`) |
| `OASIS30ANTs` | ANTs OASIS-30 Atropos template |

A space label says nothing about the voxel grid: `individual` does not
imply the acquisition resolution and `MNI152NLin2009cAsym` does not
imply 1 mm. That is what `resolution` is for.

A space label MAY carry a revision after `@` (`fsaverage@7.4.1`,
`neurodesk:atlas@2`), naming the release of the template files. A BIDS
template label is a fixed frame by definition, so a revision on one is
rarely needed; a vendor-prefixed template whose files can change
between releases is where it earns its place. Same label, both
revisions present and different, is `requires-runtime-check`: the
runtime compares the two templates' geometry, and an executor without
an inspector for that fails (see Runtime guidance). A revision on the
target only is `requires-runtime-check` as well: the consumer requires
a release the producer has not claimed, and only the artifact can show
it. A revision on the source only is `compatible`; the producer claims
more than the consumer asks for.

A subject-specific label (`individual`, `fsnative`) identifies a kind
of space, not one subject's frame. Two values both declared
`individual` share a frame only if they descend from the same
acquisition, which the label cannot say and the binding graph can. A
validator therefore treats two `individual` declarations as compatible
only when it can trace both, through `inputs.<local-id>` references
and workflow bindings, to the same workflow input or the same step
output. When it cannot, the outcome is `requires-runtime-check` (see
Compatibility rules), never a pass. Template labels have no such
problem: every `MNI152NLin2009cAsym` is the same frame.

`space` MAY appear on `neuro:volume`, `neuro:mask`, `neuro:label-map`,
`neuro:statmap`, `neuro:probseg`, `neuro:surface`, `neuro:tract`,
`neuro:cifti`, and on arrays of them. A validator MUST reject it on any
other spec-defined type. `neuro:transform` is excluded on purpose: a
transform relates two spaces, and a single `space` string cannot say
which is which.

## Resolution and density

`resolution` is the voxel spacing of a gridded value in millimetres: a
single positive number for an isotropic grid (`1`, `0.8`) or an array
of three positive numbers in the file's axis order (`[1, 1, 1.2]`). It
is a measurement, not a keyword, so that `subject-1mm`, FreeSurfer's
conformed grid, SPM's 2 mm normalised default and TemplateFlow's
`res-01` all reduce to comparable numbers. A tool that resamples
declares the grid it produces; a tool that keeps the input grid writes
`inputs.<local-id>`; a tool that accepts any grid omits it.

`resolution` MAY appear on `neuro:volume`, `neuro:mask`,
`neuro:label-map`, `neuro:statmap`, `neuro:probseg`, and arrays of
them. A validator MUST reject it on any other spec-defined type.

Equal `space` and equal `resolution` establish a shared frame and
spacing, not voxelwise correspondence: origin, shape and axis order
can still differ. A tool that needs voxel-for-voxel alignment between
two inputs verifies the grids at runtime; this RFC does not add a grid
predicate.

`density` is the vertex count of a surface mesh as a BIDS `den-<label>`
value: `32k`, `59k`, `164k` for `fsLR`; `10k`, `41k`, `164k` for the
`fsaverage` family (BIDS deprecated the `fsaverage5` and `fsaverage6`
space labels in favour of `fsaverage` with a density). Other labels are
allowed and compared literally, and SHOULD carry a vendor prefix.

`density` MAY appear on `neuro:surface`, `neuro:cifti`, and arrays of
them. A validator MUST reject it on any other spec-defined type.

## Label systems

`labelSystem` names the integer table that gives meaning to the values
in a label map, or the volume order of a probabilistic segmentation. A
label system is a specific table, not a parcellation: the Desikan-
Killiany parcellation is carried as `ctx-lh-*` 1000 to 1035 in
FreeSurferColorLUT, as 1 to 34 in MRtrix's `fs_default`, and as an
embedded table in a CIFTI dlabel file, and those three are different
label systems. The vocabulary is open. Registered values:

| Value | Table | Integers | Emitted by |
| --- | --- | --- | --- |
| `freesurfer` | `FreeSurferColorLUT.txt` | 0 to 255 aseg; 1000/2000 Desikan-Killiany cortex; 3000/4000 wmparc; 11100/12100 Destrieux | `recon-all`, SynthSeg (33-label subset), FastSurfer, FSL FIRST (CMA subset) |
| `mrtrix-fs-default` | `share/mrtrix3/labelconvert/fs_default.txt` | 1 to 84 | `labelconvert` |
| `mrtrix-hcpmmp1` | `share/mrtrix3/labelconvert/hcpmmp1_ordered.txt` | 1 to 379 | `labelconvert` |
| `mrtrix-5tt` | five-tissue-type volume order | 0 cortical GM, 1 subcortical GM, 2 WM, 3 CSF, 4 pathological | `5ttgen` (`neuro:probseg`) |
| `fsl-fast` | FAST tissue classes on T1 | 1 CSF, 2 GM, 3 WM | `fast` |
| `spm-tpm` | SPM tissue probability map order | 1 GM, 2 WM, 3 CSF, 4 bone, 5 soft tissue, 6 air | SPM Segment (`neuro:probseg`) |
| `ants-atropos-6` | ANTs six-class tissue prior order | 1 CSF, 2 cortical GM, 3 WM, 4 deep GM, 5 brainstem, 6 cerebellum | `antsAtroposN4.sh`, `antsCorticalThickness.sh` |
| `harvard-oxford-cortical` | `HarvardOxford-Cortical.xml` label indices | 0 to 47 in the XML; the summary image stores index plus one | FSL atlases, FSLeyes |
| `harvard-oxford-subcortical` | `HarvardOxford-Subcortical.xml` | 0 to 20, same convention | FSL atlases, FSLeyes |
| `neuromorphometrics` | SPM `labels_Neuromorphometrics.xml` | 4 to 207 with gaps, 121 labels | SPM, CAT12 |
| `aal` | AAL atlas table | atlas-specific | AFNI, CAT12, MRtrix `aal.txt` |
| `lpba40` | LONI LPBA40 table | atlas-specific | AFNI, CAT12, MRtrix `lpba40.txt` |
| `hcp-mmp1` | Glasser HCP-MMP1.0 with original integers | 1 to 180 per hemisphere | Workbench, AFNI `MNI_Glasser_HCP_v1.0` |
| `binary` | 0 background, 1 foreground | | the implied value for `neuro:mask` |
| `embedded` | the file carries its own table | | CIFTI dlabel, GIFTI label, FreeSurfer `.annot`, AFNI `VALUE_LABEL_DTABLE`, Slicer `seg-nrrd`, Workbench volume labels |

A value that is a URL names a table file that defines the system, in
BIDS `dseg.tsv` (columns `index`, `name`, and optionally
`abbreviation`, `color`, `mapping`) or FreeSurfer LUT format. A
registered value resolves to the table named in its row; a later
revision may publish `dseg.tsv` copies of the registered tables with
the spec.

A registered or vendor-prefixed value MAY carry a table revision after
`@` (`freesurfer@7.4.1`, `neurodesk:mindgrab-16chan18cls@1`), naming
the release of the table. The name is the identity: a registered table
does not change the meaning of an integer between revisions, it
appends. A revision narrows the claim for a consumer that depends on
entries added later, and lets a runtime compare two tables rather than
two names.

`labelSystem` MAY appear on `neuro:label-map` and `neuro:probseg` and
on arrays of them. A validator MUST reject it on any other spec-defined
type.

## Compatibility rules

Qualifiers extend the binding type compatibility check in §20. For a
binding from a source declaration S (a workflow input, a context field,
or a step output resolved through its tool) to a target declaration T
(a tool input, or a workflow output), each qualifier is an axis with
one of three outcomes:

- `compatible`: the declarations prove the target's requirement is met.
- `incompatible`: the declarations prove it is not.
- `requires-runtime-check`: the declarations cannot decide. The target
  constrains the axis and the source's value is absent, unresolved, or
  only partly covered.

Type compatibility runs first; qualifiers cannot make two incompatible
types compatible. A target that omits a qualifier imposes nothing on
that axis, and the axis is `compatible`. A source that omits a
qualifier the target declares is `requires-runtime-check`: unknown is
not a pass. The binding's outcome is `incompatible` if any axis is,
otherwise `requires-runtime-check` if any axis is, otherwise
`compatible`. `incompatible` is a validation failure;
`requires-runtime-check` is reported and handed to the executor.

Per axis, after resolving any `inputs.<local-id>` reference:

- **`formats`.** A source token *s* is accepted by a target token *t*
  when *s* = *t* or *t* is an ancestor of *s* (a target that reads any
  `nifti` accepts a `nii-gz` source). The two are *related* when either
  is an ancestor of the other. Every source token accepted:
  `compatible`. No source token related to any target token:
  `incompatible`. Otherwise `requires-runtime-check`: the tool may
  produce a packaging the consumer cannot read (a `nifti` source into
  an SPM `nii` target), and the runtime looks at the actual file.
  Unregistered tokens have no ancestors.
- **`space`.** Both resolve to the same template label: `compatible`.
  Different labels: `incompatible`. Both a subject-specific label:
  `compatible` when the validator traces both to the same workflow
  input or step output, otherwise `requires-runtime-check`. Same
  label with a revision on the target that the source does not carry,
  or with revisions on both that differ: `requires-runtime-check`. A
  revision on the source only is `compatible`.
- **`resolution`.** Equal: `compatible`; different: `incompatible`. A
  single number is expanded to three before comparison, and two
  spacings are equal when each axis differs by less than 0.001 mm.
- **`density`.** Equal labels: `compatible`; different:
  `incompatible`.
- **`labelSystem`.** Same name: `compatible`, except that a revision
  on the target that the source does not carry, or revisions on both
  that differ, is `requires-runtime-check` and the runtime compares
  the tables; a revision on the source only is `compatible`. Different
  names: `incompatible`, except that `embedded` against a named system
  is `requires-runtime-check`: the runtime can read the file's table
  and compare it, a static validator cannot.

A source `inputs.<id>` reference resolves to the qualifier of whatever
the workflow binds to that input on the producing step, recursively; a
reference that resolves to an input with no such qualifier is treated
as absent.

String comparison is literal and case-sensitive. A validator MUST NOT
treat two labels it believes to be synonyms (`native` and
`individual`, `FreeSurfer` and `freesurfer`, `afni:MNI_2009c_asym` and
`MNI152NLin2009cAsym`) as equal; the registered vocabularies exist so
that authors converge on one spelling, and the vendor prefix exists so
that a name that cannot converge is at least unambiguous.

A diagnostic for either non-compatible outcome names the binding, the
qualifier, the target's requirement, the source's declared or resolved
value, and, where the registry knows one, a repair: the conversion,
resampling or relabelling that would satisfy the target. The repair is
a suggestion about formats and frames, not about science: a converted
value that satisfies the constraint is not thereby the right input.

A runtime MAY relax these rules when it can act on the mismatch: a
runtime that can convert MGZ to NIfTI, resample into a target space or
grid, or renumber a label map, MAY accept the binding and MUST record
the conversion in provenance as its own activity. Static validators
report; they do not convert.

## Conformance cases

| Source declaration | Target declaration | Outcome |
| --- | --- | --- |
| `formats: ["mgz"]` | `formats: ["nifti"]` | `incompatible` |
| `formats: ["nii-gz"]` | `formats: ["nifti"]` | `compatible` |
| `formats: ["nifti"]` | `formats: ["nii"]` | `requires-runtime-check` |
| `formats: ["nifti", "mgh"]` | `formats: ["nifti"]` | `requires-runtime-check` |
| no `formats` | `formats: ["nifti"]` | `requires-runtime-check` |
| any `formats` | no `formats` | `compatible` |
| `space: "MNI152NLin6Asym"` | `space: "MNI152NLin2009cAsym"` | `incompatible` |
| `space: "inputs.image"`, resolving to workflow input `t1` | `space: "inputs.image"` on another step, also resolving to `t1` | `compatible` |
| `space: "individual"` from workflow input `a` | `space: "individual"` from workflow input `b` | `requires-runtime-check` |
| `space: "MNI152NLin2009cAsym"`, `resolution: 2` | same space, `resolution: 1` | `incompatible` |
| same `space` and `resolution` | a target that needs voxelwise correspondence with another input | `compatible`; the grid is verified at runtime |
| `labelSystem: "freesurfer@7.3.2"` | `labelSystem: "freesurfer@7.4.1"` | `requires-runtime-check` |
| `labelSystem: "freesurfer"` | `labelSystem: "mrtrix-fs-default"` | `incompatible` |
| `labelSystem: "embedded"` | `labelSystem: "freesurfer"` | `requires-runtime-check` |
| `space: "neurodesk:atlas@1"` | `space: "neurodesk:atlas@2"` | `requires-runtime-check` |
| `space: "fsaverage"` | `space: "fsaverage@7.4.1"` | `requires-runtime-check` |
| `space: "fsaverage@7.4.1"` | `space: "fsaverage"` | `compatible` |
| `labelSystem: "freesurfer"` | `labelSystem: "freesurfer@7.4.1"` | `requires-runtime-check` |
| `labelSystem: "freesurfer@7.4.1"` | `labelSystem: "freesurfer"` | `compatible` |
| any qualifier in a document that declares `"neuroflow": "0.1.0"` | | rejected by a semantic validator (Specification version) |
| `neuro:surface`, `formats: ["gifti"]` | `neuro:volume`, `formats: ["gifti"]` | `incompatible` (type) |

Schema fixtures in `examples/invalid/` cover the syntactic half: empty
and malformed token lists, values with reserved prefixes, a reference
that is not `inputs.<id>`, a zero spacing, a revision with no name, a
qualified document that declares `0.1.0`, and each qualifier on a type
that cannot carry it.

The static outcomes above are decided from declarations alone. The
cases below are for an executor handed a `requires-runtime-check`
binding; they are the runtime half of conformance, and a runtime's
conformance statement lists which of them it can resolve.

| Binding | Evidence the executor has | Required behaviour |
| --- | --- | --- |
| `formats: ["nifti"]` into `formats: ["nii"]` | a format reader identifies the file as `nii` | launch |
| same | the reader identifies it as `nii-gz` | fail: constraint violated |
| same | no format reader | fail: constraint unresolved; not a pass |
| `space: "individual"` from input `a` into `space: "individual"` derived from input `b` | provenance records that `a` and `b` descend from one acquisition | launch |
| same | only the two headers, and their affines match | fail: constraint unresolved; a matching affine is not subject identity |
| `space: "fsaverage"` into `space: "fsaverage@7.4.1"` | provenance or the artifact names the release it was produced against | launch when it is `7.4.1`, else fail: constraint violated |
| `space: "neurodesk:atlas@1"` into `space: "neurodesk:atlas@2"` | a template inspector compares the two releases' geometry | launch when they agree, else fail: constraint violated |
| `labelSystem: "embedded"` into `labelSystem: "freesurfer"` | a label-table reader | launch when the embedded table maps onto the target's table, else fail: constraint violated |
| `labelSystem: "freesurfer"` into `labelSystem: "freesurfer@7.4.1"` | a label-table reader and the registered table for the revision | launch when every integer the artifact uses is defined in that revision, else fail: constraint violated |
| any `requires-runtime-check` axis | no inspector for that axis, no provenance | fail: constraint unresolved; the diagnostic names the binding, the axis and the missing inspector |
| any `requires-runtime-check` axis, in an editor or planner | not applicable | show the plan as conditionally valid, never as runnable |
| any `incompatible` axis the runtime can convert | a converter (format, resampling, relabelling) | MAY launch after converting, with the conversion recorded in provenance as its own activity |

## Runtime guidance

An executor MUST resolve every `requires-runtime-check` outcome
before launching the consuming step: by reading the artifact (its
header, a format reader, an embedded label table), or by trusting
provenance that records the value. If it cannot establish the fact, it
MUST fail with an unresolved-constraint diagnostic rather than launch.
An editor or planner MAY display such a workflow and MUST distinguish
a conditionally valid plan from a runnable one. A matching affine alone
does not establish that two `individual` values come from the same
subject; provenance does. A runtime SHOULD state which inspectors it
has, and MUST NOT treat a missing inspector as a passed check.

Exact identity, where a consumer needs it, is therefore declared, not
configured: a consumer that names a revision gets `requires-runtime-check`
from every producer that does not claim it, and the executor verifies
the artifact before the consumer launches or refuses to launch it. A
consumer that names no revision has said it accepts any, and a producer
that names one has said more than was asked. There is no executor
profile that changes a validator's outcome; two conformant validators
agree on every binding, and what differs between runtimes is which
`requires-runtime-check` outcomes they can resolve, which each states
in its conformance statement.

A runtime that writes a NIfTI artifact whose declared `space` is an
MNI152 label SHOULD set the sform and qform code to 4
(`NIFTI_XFORM_MNI_152`), because FSL and FSLeyes accept nothing else as
evidence of MNI space, and MAY write AFNI's `TEMPLATE_SPACE` attribute
in an AFNI extension, the only in-band label that distinguishes MNI152
generations. A runtime that writes a NIfTI artifact whose declared
`space` is `individual` SHOULD set the codes to 1
(`NIFTI_XFORM_SCANNER_ANAT`) or 2 (`NIFTI_XFORM_ALIGNED_ANAT`). None of
this replaces the declaration; it keeps other packages from
contradicting it.

## Static validation

A validator MUST check:

- Every `formats` item matches the token grammar; an array is non-empty
  and has no duplicates.
- `formats`, `space`, `resolution`, `density`, and `labelSystem` are
  absent from declarations whose type is `core:string`, `core:number`,
  `core:integer`, `core:boolean`, `core:object`, `core:json`, or an
  array of one of these.
- `space` appears only on the spatial types listed above, or on
  extension types, or on arrays of either.
- `resolution` appears only on the gridded types listed above,
  extension types, or arrays of these.
- `density` appears only on `neuro:surface`, `neuro:cifti`, extension
  types, or arrays of these.
- `labelSystem` appears only on `neuro:label-map`, `neuro:probseg`,
  extension types, or arrays of these.
- A vendor prefix on any qualifier value is not `core`, `neuro`,
  `bids`, or `prov`.
- A qualifier of the form `inputs.<local-id>` appears only on a tool
  output and names an input declared on the same tool.
- A `space` or `labelSystem` revision, when present, follows a name
  and is non-empty.
- A document that carries any qualifier declares `"neuroflow":
  "0.1.1"` (Specification version below).
- Binding compatibility per the rules above: an `incompatible` axis is
  a validation failure, a `requires-runtime-check` axis is reported.

All but three of these rules are expressed in the JSON Schema. The
`inputs.<local-id>` rule, the version rule and the binding rule are
semantic rules for §20.

## What this RFC does **not** specify

- **Conversion.** Which tool turns MGZ into NIfTI, or resamples from
  `individual` to `MNI152NLin2009cAsym`, is a registry and planning
  concern. This RFC only makes the need for a conversion visible.
- **Media types.** Neurodesk's contract also carries `mediaType`
  (`application/x-nifti`, `application/gzip`) on artifacts. That is a
  transport property of one delivered file, not of the type, and it
  belongs to the delivery and MCP-resource layers (RFC 0008, RFC 0009),
  where a runtime derives it from the harvested file. No neuroimaging
  format other than DICOM has a registered media type, and the
  conventions in use for NIfTI disagree with each other.
- **Orientation, data type, or field of view.** A `resolution` says
  how far apart voxels are, not how many there are or which way the
  axes point.
- **Transform source and target spaces.** A `neuro:transform` needs a
  pair of spaces, a direction, and a coordinate convention: FLIRT,
  AFNI, ITK and LTA disagree on all three. That is a separate RFC once
  the transform type itself is exercised by more than one tool.
- **Coded terminologies.** DICOM SEG and 3D Slicer label segments with
  SNOMED CT triplets rather than integers. A `dseg.tsv` can carry a
  code column; the spec does not define one.
- **Runtime introspection.** Whether a runtime reads the file header to
  check that a value really is NIfTI or really is in the declared space
  is an implementation choice. The declaration is a contract, and the
  validator checks contracts against each other.

## Specification version

The `neuroflow` envelope field accepts `"0.1.0"` and `"0.1.1"`. A
document that carries any of the five qualifiers MUST declare
`"0.1.1"`; a document that carries none SHOULD keep `"0.1.0"` and
remains valid unchanged. The schemas stay at `schemas/0.1/`; the
changes to `common.schema.json` are the `specVersion` definition (a
`const` becomes an enum), the optional revision in the `space`
pattern, and the qualifier definitions themselves. A validator that
accepts `"0.1.1"` MUST implement this RFC's static rules and the
compatibility outcomes of §20.

This is the middle path between the two drafts. The README classes
adding optional fields as a non-breaking change, which argued for
shipping the qualifiers in 0.1 in place; the Neurodesk draft asked for
a 0.2 so that a runtime built against the published 0.1 schemas
rejects a document whose execution requirements it cannot read rather
than silently ignoring them. A patch value satisfies both. Every
validator published so far checks the envelope against the literal
`"0.1.0"` (the schema `const`, and the reference runtime's own check),
so a qualified document is refused by all of them, while an
unqualified document, the schema `$id`s, a vendored schema snapshot
and every existing example are untouched. A 0.2 would have copied
every schema and re-versioned every document for an additive change.

An adapter that emits tool documents from another contract format
emits `"0.1.0"` while the source annotations stay in an extension
block, and `"0.1.1"` from the first document in which it promotes one
to a qualifier.

## Migration

- An unqualified document remains valid and means what it meant.
- A qualified document is rejected by a validator that predates this
  RFC, because `typeDeclaration` and `toolOutputDef` are closed
  objects and because its envelope value `"0.1.1"` is not the
  `"0.1.0"` such a validator accepts. That is the intended behaviour:
  an older runtime refuses a document whose execution requirements it
  cannot read instead of ignoring them.
- The qualifiers ship in the 0.1 schemas under the `"0.1.1"` envelope
  value (Specification version above). No existing document changes; a
  document gains `"0.1.1"` when it gains its first qualifier.
- An adapter that generates tool documents from another contract
  format (the Neurodesk generator in neurodesk/webapps#107) MAY keep
  the source's own annotations in an extension block
  (`extensions["neurodesk/data"]`) and promote a value to a qualifier
  only once it maps onto a registered token, a BIDS label, a
  vendor-prefixed value, or an `inputs.<local-id>` reference. Core
  validators do not read extension blocks (§18), so an annotation left
  there is documentation, not a constraint, and neither the generator
  nor a validator may report it as checked.

The Neurodesk source audit gives the following migration rules. Promote an
annotation only when the app's actual input requirements or output behavior
supports it. A vendor prefix does not turn an ambiguous label into evidence
that two artifacts share a coordinate frame.

- `native` on an input remains source metadata when the app also accepts
  images in template or aligned frames. Brain extraction and SynthSeg do not
  require scanner coordinates. On an output, `native` or `input` can inherit
  the identified source input's frame with `inputs.<id>`.
- `fixed` and `moving` on outputs inherit those inputs' frames. The source
  input must be spatial. A collection of independent images does not promise
  one shared subject frame.
- `subject-1mm` adds `resolution: 1` and inherits the identified source frame.
  If several spatial inputs exist, the app owner must name the source.
- SYNcro and disconnectome share the same checksummed FSL 1 mm template,
  `MNI152NLin6Asym`. This does not establish a mapping for an arbitrary
  `MNI152-1mm` annotation in another app.
- TopoFit's scanner-RAS surfaces, dwi2trx's RAS-mm tracts and VesselBoost's
  analysis outputs inherit their anatomical/diffusion input's frame. These
  relationships do not promise the same grid. TopoFit's optional ROI does
  not become a second source for its output frame.
- CALMaR's selected `atlas`, SYNcro's conditional `lesion-reference`, and
  TopoFit's `registration-sphere` remain source metadata until their exact
  relationships are expressible. Do not emit one global vendor space for
  unrelated subjects or parameter-dependent atlas choices.
- `FreeSurfer` becomes `freesurfer` without inventing a table revision;
  `gii` becomes `gifti`. A `surface` category needs the actual accepted
  encoding list before it can become a format constraint.
- `moving-to-fixed` on a `neuro:transform` stays in the extension until the
  transform RFC. Format lists express alternatives: adding the broad
  `nifti` token beside `displacement-field` would wrongly admit scalar images.

The implementation and source evidence are maintained with
[Neurodesk's qualifier migration](https://github.com/neurodesk/webapps/pull/109).
These conservative rules preserve source annotations without claiming they
have been verified or narrowing the inputs the scientific apps accept.

## Implementation plan

The work splits by repository. Each item names its owner.

| # | Work | Where | Owner |
| --- | --- | --- | --- |
| 1 | Qualifier definitions, the `specVersion` enum, the `space` revision pattern, and the fixtures under `examples/` | neuroflow-spec `schemas/0.1/`, `examples/` | Chris Drake (this PR) |
| 2 | §5, §7.1 and §20 of the specification text, and this RFC | neuroflow-spec `spec/`, `rfcs/` | Chris Drake (this PR) |
| 3 | Accept `"0.1.1"` in the reference validator and runtime; a three-outcome comparison API in the Rust core and the TypeScript validator; `requires-runtime-check` in planning diagnostics | cdrake/neuroflow `crates/neuroflow-core`, `crates/neuroflow-mcp`, `src/domain` | Chris Drake |
| 4 | Header, format-reader and label-table inspectors for the reference runtime; advertise them; fail on a missing one | cdrake/neuroflow `crates/neuroflow-mcp` | Chris Drake |
| 5 | Promote `extensions["neurodesk/data"]` values to qualifiers by the Migration mapping and emit `"0.1.1"` for promoted documents; scalar types for `maximum: 1` inputs | neurodesk/webapps `packages/desktop/neuroflow/generator.mjs` | Steffen Bollmann |
| 6 | Desktop-side inspection of artifacts before a constrained consumer launches; the app-owner decisions for the strings the mapping leaves open | neurodesk/webapps | Steffen Bollmann |
| 7 | Observed format, frame and table on provenance entities, and how a consumer authenticates evidence from a remote runtime | a follow-up RFC | both |
| 8 | A `space` for `neuro:transform` (source, target, direction, axis convention) | a follow-up RFC | both |

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
- **Ontology IRIs for formats, as CWL does.** Rejected: EDAM has terms
  for a handful of the formats a neuroimaging tool meets, and the
  subclass reasoning CWL gets from the OWL file is a two-level
  hierarchy here, which a `parent` column expresses. The registry
  carries the EDAM id so an adapter can emit the IRI.
- **Closed `formats`, `space`, and `labelSystem` vocabularies.**
  Rejected: the set of real formats is long-tailed, and BIDS already
  curates the space labels that matter. Registering tokens, requiring
  BIDS labels where they exist, and prefixing everything else gives
  convergence without a change request for every new atlas.
- **Compression as a separate flag.** Rejected: the survey found the
  compression and packaging axis (`.nii`, `.nii.gz`, `.hdr`/`.img`) is
  the only one tools actually refuse on, and one token per packaging
  under a family parent keeps a single field.
- **A structured `space` object** (`{ "sameAs": "image" }` for the
  relative case). Rejected: the `inputs.<id>` string reuses the §8
  grammar and the parser validators already have, and keeps `space` a
  string in every position. The same string form now serves all five
  qualifiers.
- **Object-valued qualifiers** (`{ "kind": "relative", "input":
  "image" }`, `{ "id": ..., "version": ... }`), as the Neurodesk draft
  proposes. Not adopted as the wire form: the string is defined as the
  serialization of the same pair (Decision, "String form"), so the
  relative form is `inputs.<id>`, the versioned form is
  `name@revision`, and a string compares, sorts and greps without a
  parser. An object form can be added later as another branch of the
  same schema without invalidating a string.
- **A mandatory revision on every named space.** Rejected as a
  requirement, adopted as an option: a BIDS space label is a fixed
  coordinate frame by definition (TemplateFlow versions the files, not
  the frame), and most tools cannot state a revision honestly. A label
  MAY carry one after `@`, and a consumer that declares one gets
  `requires-runtime-check` from a producer that does not, so it can
  insist on evidence without forcing every producer to claim a release.
- **Exact identity for label systems.** The Neurodesk draft requires
  equal name and revision. Rejected as the sole rule: registered tables
  append, so a revision mismatch is a runtime table comparison, not a
  refusal; the name is the identity and the revision narrows it. A
  consumer that declares a revision has the artifact verified against
  it when the producer does not claim one, which is where exact
  identity is needed.
- **A 0.2 schema path**, as the Neurodesk draft proposes. Rejected in
  favour of the `"0.1.1"` envelope value (Specification version): it
  gives the same refusal by older runtimes without copying the schemas
  or re-versioning any document.
- **A `res-<label>` keyword for resolution, as BIDS uses.** Rejected:
  BIDS resolves the keyword through a `Resolution` sidecar field that a
  tool document has no place for, and every package the survey looked
  at states the grid as millimetres.
- **A single `mediaType` instead of `formats`.** Rejected: media types
  for neuroimaging formats are mostly unregistered (`application/
  x-nifti` is a convention, and a gzipped NIfTI reports
  `application/gzip`, which says nothing), and one string cannot list
  the three formats a tool accepts.

## Prior art

[docs/type-qualifiers-survey.md](../docs/type-qualifiers-survey.md)
surveys how workflow languages, vocabularies and the common
neuroimaging packages express each qualifier. Its recommendations are
applied in this revision: the token hierarchy, `inputs.<id>` on every
qualifier, the enlarged token registry with EDAM cross-references, the
template crosswalk, label systems defined as integer tables with
`embedded`, `resolution`, `density`, and the xform-code guidance.

Steffen Bollmann's draft for the same qualifiers
(`docs/rfcs/0010-neuroflow-data-constraints.md` in
[neurodesk/webapps#107](https://github.com/neurodesk/webapps/pull/107)),
written against the Neurodesk contract generator, was reconciled into
the second revision. Taken from it: the three compatibility outcomes
and the rule that an unknown source value is not a pass; the executor's
obligation to resolve or fail, and the editor's to tell a conditional
plan from a runnable one; that a subject-specific label does not
identify a subject; that a token names bytes or a layout, not a
suffix; the conformance table; revisions on label systems; the
extension block as migration path; and the open questions on registry
ownership, revision identifiers and evidence across remote runtimes.
Reshaped rather than taken: object-valued `space` and `labelSystem`
(kept as the pair the strings serialize), the mandatory revision
(optional on the producer; a consumer that declares one has it verified
at runtime), the 0.2 version (the `"0.1.1"`
envelope value), and the absence of a grid qualifier (see Alternatives
considered). The third revision merges the two drafts into this one
document.

## Open issues

- Should `formats` be allowed on `core:file` and `core:directory`,
  where the token would be the only hint about content? The schema in
  this draft allows it.
- Should a validator warn when a `neuro:label-map` declaration omits
  `labelSystem`? Every label map has one; omitting it is almost always
  an oversight rather than "any".
- Provenance entities (§17) could record the resolved qualifiers of
  each artifact so that a downstream reader does not have to walk back
  to the tool document. The provenance schema is not changed by this
  RFC.
- Whether `space` labels should be validated against a fetched copy of
  the BIDS coordinate-system list. This draft compares literally and
  leaves label curation to authors.
- Whether the spec should publish `dseg.tsv` files for the registered
  label systems, and under what licence, given that several are
  derived from package data files.
- Registry ownership: who admits a format token, a space label outside
  BIDS, or a label system, and where the tables live.
- Whether a label-system revision is a release string, as here, or a
  digest of the table.
- How a remote runtime's declared evidence (observed format, frame,
  table) is authenticated by a consumer that did not produce it.
- Which inspectors an executor must have to resolve
  `requires-runtime-check` on each axis, and how it advertises them.
