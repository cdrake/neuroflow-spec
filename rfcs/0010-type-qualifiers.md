# RFC 0010: Type Qualifiers

Status: Proposed

Created: 2026-09-29

Revised: 2026-09-29 (after the [prior-art survey](../docs/type-qualifiers-survey.md))

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

| Token | Parent | Encoding | Typical types | EDAM |
| --- | --- | --- | --- | --- |
| `nifti` | | NIfTI-1 or NIfTI-2 in any packaging | `neuro:volume`, `neuro:mask`, `neuro:label-map`, `neuro:statmap`, `neuro:probseg` | `format_3549` |
| `nii` | `nifti` | single uncompressed `.nii` | same | |
| `nii-gz` | `nifti` | gzip-compressed `.nii.gz` | same | |
| `nii-pair` | `nifti` | NIfTI `.hdr`/`.img` pair, plain or gzip | same | |
| `analyze` | | Analyze 7.5 `.hdr`/`.img` pair (not NIfTI) | same | |
| `mgz` | | FreeSurfer MGH `.mgh` or gzip-compressed `.mgz` | same | |
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

`labelSystem` MAY appear on `neuro:label-map` and `neuro:probseg` and
on arrays of them. A validator MUST reject it on any other spec-defined
type.

## Compatibility rules

Qualifiers extend the binding type compatibility check in §20. For a
binding from a source declaration S (a workflow input, a context field,
or a step output resolved through its tool) to a target declaration T
(a tool input, or a workflow output):

- **`formats`.** A source token *s* is accepted by a target token *t*
  when *s* = *t* or *t* is an ancestor of *s* (a target that reads any
  `nifti` accepts a `nii-gz` source). The two are *related* when either
  is an ancestor of the other. If no source token is related to any
  target token, the binding is an error. Otherwise, if some source
  token is not accepted by any target token, the binding is a warning:
  the tool may produce a packaging the consumer cannot read (a `nifti`
  source into an SPM `nii` target). If either side omits `formats`, no
  check is made. Unregistered tokens have no ancestors.
- **`space`.** If both declare `space` and the resolved labels differ,
  the binding is an error.
- **`resolution`.** If both declare it and the resolved values differ,
  the binding is an error. A single number is expanded to three before
  comparison, and two spacings are equal when each axis differs by
  less than 0.001 mm.
- **`density`.** If both declare it and the resolved labels differ, the
  binding is an error.
- **`labelSystem`.** If both declare it and the resolved values differ,
  the binding is an error, except that `embedded` against a named
  system is a warning: the runtime can read the file's table and
  compare it, a static validator cannot.

A source `inputs.<id>` reference resolves to the qualifier of whatever
the workflow binds to that input on the producing step, recursively; a
reference that resolves to an input with no such qualifier is treated
as absent. If either side omits a qualifier, or resolves to absent, no
check is made for it.

String comparison is literal and case-sensitive. A validator MUST NOT
treat two labels it believes to be synonyms (`native` and
`individual`, `FreeSurfer` and `freesurfer`, `afni:MNI_2009c_asym` and
`MNI152NLin2009cAsym`) as equal; the registered vocabularies exist so
that authors converge on one spelling, and the vendor prefix exists so
that a name that cannot converge is at least unambiguous.

A runtime MAY relax these rules when it can act on the mismatch: a
runtime that can convert MGZ to NIfTI, resample into a target space or
grid, or renumber a label map, MAY accept the binding and MUST record
the conversion in provenance as its own activity. Static validators
report; they do not convert.

## Runtime guidance

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
- Binding compatibility per the rules above, where both sides declare
  the qualifier.

All but the last two rules are expressed in the JSON Schema; the last
two are semantic rules for §20.

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
