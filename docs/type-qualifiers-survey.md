# Type qualifiers: prior art and tool survey

Companion to [RFC 0010](../rfcs/0010-type-qualifiers.md). Surveyed
2026-09-29 against primary sources (specification text, schema files,
package sources, shipped data files). The question for each system is
the same three-part one the RFC answers: how does it say what **format**
a file is in, what **coordinate space** a spatial value is in, and which
**label table** a segmentation uses. A fourth column, "same as input",
records whether the system can say that an output inherits a property
from an input, because that is the dominant implicit contract in every
tool surveyed and the RFC's `inputs.<id>` form makes it explicit.

Sections 1 and 2 cover description languages and vocabularies. Section 3
covers the packages a NeuroFlow tool document is most likely to wrap.
Section 4 lists what the survey changes about the RFC.

## 1. Workflow and tool description languages

| System | Format | Space | Labels | Same as input |
| --- | --- | --- | --- | --- |
| CWL 1.2 | `format` on File parameters: one or more IRIs, "preferably defined within an ontology"; EDAM via `$namespaces`, `$schemas` loads the OWL so cwltool can reason over `rdfs:subClassOf` and `owl:equivalentClass`; exact match otherwise | none | none | none |
| Boutiques | none; `File` type plus `path-template` extensions | none | none | none |
| WDL 1.2 | `File`, `Directory` only | none | none | none |
| Nextflow | `path` qualifier only; nf-core `meta.yml` adds documentation-only `pattern` and EDAM `ontologies`, checked by the nf-core linter, not by Nextflow | none | none | none |
| Snakemake | path strings with wildcards | none | none | none |
| Galaxy | registered datatypes keyed by extension (`nii1`, `nii2`, `gii`, `tck`, `trk`, `dcm`, `nrrd`, `analyze75`, `zarr`, `ome_zarr`), with sniffers, subclassing, `auto_compressed_types="gz"`, and `edam_format` cross-references; tool XML `<param format="...">` | none | none | `format_source` on outputs: "same format as that of the specified tool input" |
| Pydra + fileformats-medimage | Python classes: `Nifti1`, `Nifti2`, `NiftiGz`, `NiftiX` (with JSON sidecar), `NiftiGzX`, `Analyze`, `Mgh`, `MghGz`, `Nrrd`, `Gifti`, `DicomSeries`, `Bval`/`Bvec`, MRtrix `ImageFormat`/`Tracks`; magic-number validation; converter graph; `to_mime()` gives `application/x-nifti1+gzip` and similar | none (classifiers cover modality and anatomy: `NiftiGz[T1w, Brain]`) | none | none |
| Nipype | `File(exists=True)`; FSL interfaces carry `output_type` from `FSLOUTPUTTYPE` | none | none | none |
| Neurodesk `automation.json` | `formats: ["nifti"]` on inputs; `mediaType` on artifacts | `space` string on inputs and artifacts (`native`, `subject-1mm`, `input`) | `labelSystem` on artifacts (`FreeSurfer`) | `space: "input"` |
| NeuroFlow RFC 0010 | `formats` token array | `space` string, BIDS labels, or `inputs.<id>` | `labelSystem` string | `space: "inputs.<id>"` |

Only CWL and Galaxy type formats at all, and they take opposite routes:
CWL uses ontology IRIs and gets subclass reasoning for free; Galaxy uses
short extension tokens backed by a registry with sniffers. The RFC is
Galaxy-shaped. No description language expresses coordinate space or
label tables. Galaxy's `format_source` is the only declarative "same as
input" anywhere in the survey, and it applies to format, not space.

EDAM has terms for a few of the RFC's tokens and no term for most:

| RFC token | EDAM (1.25) |
| --- | --- |
| `nifti` | `format_3549` (label "nii"; `format_4001` is a deprecated duplicate) |
| `dicom` | `format_3548` |
| `nrrd` | `format_3551` |
| `tsv` | `format_3475` |
| `ome-zarr` | `format_3915` is generic Zarr; no OME-Zarr term |
| `mgz`, `minc`, `gifti`, `cifti`, `trk`, `tck`, `mif` | not found |

IANA has registered `application/dicom` and nothing for NIfTI, NRRD,
MINC, GIFTI, CIFTI, or Zarr. Conventions in the wild conflict:
fileformats says `application/x-nifti1`, NIDM says `image/nifti`, Galaxy
says `application/octet-stream`, and Neurodesk says `application/gzip`
for a `.nii.gz`. That settles the RFC's choice of tokens over media
types.

## 2. Vocabularies for space and labels

**BIDS** owns the space vocabulary. The `space-<label>` entity takes
`individual` ("participant specific anatomical space", `fsnative` on
surfaces), `study`, or a template identifier from the coordinate-systems
appendix: `MNI152Lin`, `MNI152NLin2009[a-c][Sym|Asym]`,
`MNI152NLin6Sym`, `MNI152NLin6ASym`, `MNI305`, `MNIColin27`,
`Talairach`, `fsaverage`, `fsaverageSym`, `fsLR`, `ICBM452AirSpace`,
`ICBM452Warp5Space`, `IXI549Space`, `NIHPD`, `OASIS30AntsOASISAnts`,
`OASIS30Atropos`, `UNCInfant`. Nonstandard spaces require a
`SpatialReference` sidecar field, which is either `"orig"` ("a
potentially unique per-image space") or a URI to the reference image.
Grid resolution is a separate entity, `res-<label>`, whose label is
opaque and explained by a `Resolution` field. Label tables are
`_dseg.tsv` files with columns `index`, `name`, `abbreviation`, `color`,
`mapping` (into 12 standard BIDS tissue labels), and the `atlas-<label>`
entity names the atlas; BEP038 (merged 2026-01) adds an `atlases/`
directory with `Name`, `License`, `SpatialReference`.

**TemplateFlow** identifiers are the BIDS template labels, with
`res-<index>` and `cohort-<n>` defined per template in
`template_description.json` (`MNI152NLin2009cAsym` `res-01` is 1 mm,
193×229×193). fMRIPrep composes them as `MNI152NLin2009cAsym:res-2`.
Atlas files ship beside their `dseg.tsv`
(`tpl-MNI152NLin2009cAsym_res-01_atlas-HOCPAL_desc-th25_dseg.nii.gz`),
and cross-template transforms are named
`from-MNI152NLin6Asym_mode-image_xfm.h5`.

**NIDM-Results** models a `Coordinate Space` object carrying the
voxel-to-world matrix, units, and a coordinate-system class
(`SubjectCoordinateSystem`, `TalairachCoordinateSystem`,
`Icbm Mni152 Non Linear2009cAsymmetric`, `Mni305`, ...). The classes
predate and are compatible with the BIDS labels. File format is free
text (`dct:format "image/nifti"`). No atlas property.

**DICOM** identifies space by `Frame of Reference UID`, with well-known
UIDs for atlases (Talairach `1.2.840.10008.1.4.1.1`, SPM2 AVG152T1
`1.4.1.15`, ICBM 452, Colin27, SRI24, LPBA40). DICOM SEG labels each
segment with coded triplets (`Segmented Property Category Code
Sequence`, `Segmented Property Type Code Sequence`, mostly SNOMED CT:
`12738006 Brain`, `5366008 Hippocampus`) rather than an integer table.
3D Slicer's `.seg.nrrd` carries the same triplets per segment.

## 3. Package assessment

Each package under the same four headings. "In-band" means the file
itself records the fact; "out-of-band" means a filename, directory
layout, environment variable, or documentation does.

### AFNI

- **Formats.** BRIK/HEAD with a view suffix (`+orig`, `+acpc`, `+tlrc`),
  NIfTI, `.1D` text, `.niml.dset`. Output format follows the `-prefix`
  extension. NIfTI written by AFNI carries an ecode-4 extension mirroring
  the HEAD attributes.
- **Space.** The only package with an in-band named space: the
  `TEMPLATE_SPACE` attribute (ORIG, ACPC, TLRC, TT_N27, MNI, MNI_ANAT,
  MNI_N27, MNI_2009c_asym, MNI_FSL, MNI_SPM2, HaskinsPeds) set by
  `3drefit -space`, backed by a registry (`AFNI_atlas_spaces.niml`) of
  spaces, templates, and transforms between them. NIfTI xform codes 3, 4,
  5 map to `+tlrc`; code 2 is ambiguous and resolved by an environment
  variable. There is no AFNI name for MNI152NLin6Asym.
- **Labels.** In-band: `VALUE_LABEL_DTABLE`, a NIML value/name table
  attached with `3drefit -labeltable` and written by `@MakeLabelTable`.
  Atlases (TT_Daemon, CA_ML_18_MNI, Brainnetome, Glasser HCP, Julich,
  FreeSurfer DK in MNI2009c) are registered out-of-band in the spaces
  file with a `template_space`.
- **Transforms.** `.aff12.1D` (12 numbers, DICOM-ordered axes, base to
  source, no metadata); `3dQwarp` warps are datasets on the base grid, so
  they inherit the base's space but never name the source.

### SPM (12 and 25)

- **Formats.** NIfTI-1 `.nii` or Analyze pair (`defaults.images.format`).
  No gzip: `spm_vol` refuses compressed files.
- **Space.** "Native" versus "MNI". `TPM.nii` is ICBM 2009c nonlinear
  asymmetric, smoothed and resampled to 1.5 mm, so SPM's MNI is
  MNI152NLin2009cAsym; `avg152T1` is MNI152Lin; `avg305T1` is MNI305.
  Signalled out-of-band by filename prefix (`w`, `wc`, `mwc`) and weakly
  in-band by `sform_code` 2 ("Aligned") and `descrip` "Warped". SPM never
  writes xform code 4.
- **Labels.** Segmentation is probability maps `c1..c6` in TPM order (GM,
  WM, CSF, bone, soft tissue, air), not a label map.
  `labels_Neuromorphometrics.nii` with an XML table of 121 labels (indices
  4 to 207 with gaps). CAT12 ships aal3, hammers, julichbrain3, lpba40,
  neuromorphometrics and others in MNI152NLin2009cAsym.
- **Transforms.** `y_*.nii` and `iy_*.nii` deformation fields (5-D NIfTI,
  intent VECTOR, values are MNI mm coordinates); `*_seg8.mat`. Neither
  names its spaces.

### FSL

- **Formats.** NIfTI and Analyze only. Output format is chosen by the
  `FSLOUTPUTTYPE` environment variable (NIFTI_GZ, NIFTI, NIFTI_PAIR,
  ANALYZE, gz variants), not by the output name.
- **Space.** `$FSLDIR/data/standard/MNI152_T1_*` is the ICBM 152
  nonlinear 6th generation build, so FSL's MNI is MNI152NLin6Asym;
  `MNI152lin` is MNI152Lin. The only in-band signal is xform code 4,
  which does not say which generation. `-ref` defines the output grid.
- **Labels.** FAST `_seg`: 1 CSF, 2 GM, 3 WM, ordered by mean intensity
  (so the order changes with `-t`). FIRST uses CMA integers identical to
  FreeSurferColorLUT (10 L_Thal, 17 L_Hipp, 49 R_Thal, 53 R_Hipp, ...).
  Atlases are XML descriptors (`<atlas><header><type>Label|Probabilistic`,
  `<label index= x= y= z=>`) in `$FSLDIR/data/atlases` with no space
  field; MNI152 is asserted by documentation. Probabilistic atlases index
  4-D volumes, and their summary image uses index plus one.
- **Transforms.** FLIRT `.mat` is a 4×4 ASCII matrix in FSL scaled-voxel
  coordinates (source to reference, x-flipped when the sform determinant
  is positive); it needs both images to mean anything. FNIRT coefficient
  files (intent 2007 to 2009) record the reference grid and initial
  affine; displacement fields (intent 2006) do not say whether they are
  relative or absolute. fslpy's X5 (HDF5) records both grids and still no
  template name.

### FSLeyes

- **Formats.** NIfTI, Analyze pair, MGH/MGZ, MRtrix `.mif`, GIFTI,
  FreeSurfer surfaces, legacy VTK, TRK/TCK/TRX, bitmaps, FEAT/MELODIC
  directories, DICOM through dcm2niix. Type is guessed by extension.
- **Space.** The atlas panel refuses to query an overlay unless its
  xform code is exactly 4 (`NIFTI_XFORM_MNI_152`). It does not compare
  dimensions against a template.
- **Labels.** `.lut` files (`value r g b name`, floats 0 to 1); bundled
  `freesurfercolorlut`, `mgh-cma-freesurfer`, `harvard-oxford-cortical`,
  `harvard-oxford-subcortical`, `random`. A label overlay's LUT is a user
  choice; nothing in the image names it.
- **Transforms.** fslpy `fsl.transform.{flirt, fnirt, nonlinear, x5}`;
  `detectDeformationType()` guesses relative versus absolute.

### FreeSurfer

- **Formats.** MGH/MGZ (header with direction cosines, `goodRASFlag`,
  optional footer tags), COR, bshort/bfloat, plus NIfTI, Analyze, MINC,
  DICOM, AFNI through `mri_convert`, which infers format from the
  extension with `--in_type`/`--out_type` overrides (`mgz`, `nii`,
  `analyze`, `minc`, `dicom`, `brik`, ...). Surfaces are the binary
  triangle format; `curv`, `w`, `label`, `annot`, `ctab`.
- **Space.** Conformed space is 256³ at 1 mm (`orig.mgz`); `rawavg.mgz`
  is unconformed. Scanner RAS and tkregister RAS coexist; surfaces live
  in tkrRAS. `talairach.xfm` targets MNI305. Nothing in a volume header
  names a space; identity is the `SUBJECTS_DIR/<subject>/mri|surf|label`
  layout. Surface spaces are subject names: `fsaverage` (163842
  vertices), `fsaverage6`, `fsaverage5`, `fsaverage4`, `fsnative`.
- **Labels.** `FreeSurferColorLUT.txt` (`index name R G B A`): 0 to 255
  aseg, 1000/2000 `ctx-lh/rh-*` (Desikan-Killiany), 3000/4000 `wm-*`,
  11100/12100 `ctx_lh/rh_*` (Destrieux a2009s), 7000+ nuclei, 8000+
  thalamic nuclei. A segmentation never names its LUT in-band; the
  aseg/aparc filename implies it. `.annot` embeds its own color table.
  SynthSeg emits a 33-label subset of the FreeSurfer integers (0, 2, 3,
  4, 5, 7, 8, 10 to 18, 24, 26, 28, 41 to 47, 49 to 54, 58, 60), always
  resampled to 1 mm; `--parc` adds 1000/2000. SynthStrip writes a 0/1
  mask on the input grid in the input's format.
- **Transforms.** LTA is the one transform format in the survey that is
  self-describing: `type` (VOX_TO_VOX, RAS_TO_RAS, ...), the matrix, then
  `src volume info` and `dst volume info` blocks with filename, volume
  dimensions, voxel size, and direction cosines. `lta_convert` bridges
  MNI `.xfm`, FSL `.mat`, and ITK (LPS) forms.

### ANTs / ITK

- **Formats.** Everything ITK's IO factories read: NIfTI, NRRD,
  MetaImage (`.mha`/`.mhd`), MINC, GIPL, VTK, HDF5, MGH (ITK-Wasm),
  DICOM series. Output format follows the output extension.
- **Space.** None. Registration is "fixed" versus "moving"; physical
  coordinates are LPS mm, converted from NIfTI RAS on read. Templates
  are external data (OASIS-30 Atropos, MNI152 through TemplateFlow).
- **Labels.** `antsAtroposN4.sh` classes are numbered by mean intensity;
  the cortical-thickness convention is 1 CSF, 2 cortical GM, 3 WM, 4 deep
  GM, 5 brainstem, 6 cerebellum. `antsJointLabelFusion.sh` inherits the
  atlas numbering (Mindboggle DKT31 plus CMA). No LUT is written or
  referenced.
- **Transforms.** `.mat` (ITK binary), `.txt`/`.tfm` (text affine with
  `FixedParameters` center), `.h5` composite, 5-D vector NIfTI
  displacement fields (intent 1007, LPS). `antsApplyTransforms -t`
  applies the last listed first; `[file,1]` inverts. No geometry or
  space name in `.mat`/`.h5`; a warp's own header defines the fixed
  grid.

### MRtrix3

- **Formats.** `.mif`, `.mif.gz`, `.mih` (key-value header with `dim`,
  `vox`, `layout`, `transform`, `dw_scheme`, `pe_scheme`, arbitrary keys,
  `command_history`), NIfTI-1/2, MGH/MGZ, DICOM, `.tck`. Output by
  extension. `mrconvert -strides` controls layout.
- **Space.** Scanner space through `transform`; no named space. The 5TT
  format is a 4-D image whose volume index is the tissue (0 cortical GM,
  1 subcortical GM, 2 WM, 3 CSF, 4 pathological).
- **Labels.** `labelconvert` remaps a parcellation to consecutive
  integers from 1 using LUT pairs in `share/mrtrix3/labelconvert/`:
  `fs_default.txt` (85 rows, 1 to 34 `ctx-lh-*`, 35 to 42 left
  subcortical, 50 to 83 `ctx-rh-*`), `fs_a2009s.txt`, `hcpmmp1_ordered.txt`
  (1 to 180 `L_*`, 181 to 360 `R_*`, 361 to 379 subcortical), `aal.txt`,
  `aal2.txt`, `lpba40.txt`. The output image carries no LUT reference.
  The same FreeSurfer structure names therefore appear under two
  different integer systems (FreeSurferColorLUT and `fs_default`).
- **Transforms.** `mrtransform -linear` takes a 4×4 text matrix in the
  template-to-moving direction; `-warp` takes a 4-D deformation image of
  scanner-space positions (pull-back), `-warp_full` the 5-D midway-grid
  output of `mrregister`. `warpinit`/`warpcorrect` let external tools
  produce warps. Target grid in-band, source space unnamed.

### Connectome Workbench / HCP

- **Formats.** CIFTI-2: a NIfTI-2 container with XML in extension ecode
  32, distinguished by intent code, not extension (3002 `.dtseries.nii`,
  3006 `.dscalar.nii`, 3007 `.dlabel.nii`, 3003 `.pconn.nii`, ...).
  GIFTI `.surf.gii`, `.func.gii`, `.shape.gii`, `.label.gii`.
  `wb_command` selects behaviour by subcommand family, not extension.
- **Space.** In-band structure: `BrainModel` with `BrainStructure`
  (`CIFTI_STRUCTURE_CORTEX_LEFT`, `..._HIPPOCAMPUS_LEFT`, ...) and
  `SurfaceNumberOfVertices`; GIFTI `DataSpace`/`TransformedSpace` use the
  NIfTI xform enum and metadata `AnatomicalStructurePrimary`,
  `GeometricType`. Mesh identity (`fs_LR` 32k/59k/164k) is a filename
  convention. `MNINonLinear/` is FSL's template, MNI152NLin6Asym.
- **Labels.** Self-describing: `.dlabel.nii` and `.label.gii` embed a
  `<LabelTable>`; `-volume-label-import` writes the table into a NIfTI
  extension. Import text is name line then `key r g b a`.
- **Transforms.** Surface resampling uses sphere pairs, no file. Volume
  warps are FNIRT fields; `-convert-warpfield -from-flirt <mat> <source>
  <target>` takes the geometry on the command line.

### 3D Slicer and ITK-SNAP

- **Formats.** Slicer: DICOM, NRRD, MetaImage, VTK, NIfTI, and read-only
  Analyze, MGH, MRC; segmentations `.seg.nrrd`; models VTK/STL/OBJ/PLY;
  transforms `.h5`, `.tfm`, `.mat`, displacement fields. ITK-SNAP: DICOM,
  NIfTI, MetaImage, NRRD, Analyze, GIPL.
- **Space.** NRRD records `space: left-posterior-superior` (or RAS) plus
  directions and origin; Slicer is RAS internally and LPS in files;
  transforms are stored in LPS in the resampling direction. No named
  template anywhere.
- **Labels.** `.seg.nrrd` per-segment keys `Segment0_Name`,
  `Segment0_LabelValue`, `Segment0_Color`, `Segment0_Tags` with a
  `TerminologyEntry` of SNOMED/DICOM coded triplets; DICOM SEG export
  through dcmqi renumbers segments from 1. ITK-SNAP label descriptions
  are a text file (`IDX R G B A VIS MSH LABEL`).
- **Transforms.** ITK forms, LPS, no source or target names.

### NiiVue, nibabel, DIPY

- **Formats.** NiiVue volume loaders: NIfTI, DICOM (folder, manifest),
  DSI-Studio FIB/SRC, MIH/MIF, NHDR/NRRD, MHD/MHA, MGH/MGZ, ECAT `.v`,
  BrainVoyager V16/VMR, AFNI HEAD, BMP, NPY/NPZ, Zarr; mesh and tract
  readers for GIFTI, FreeSurfer, MZ3, OBJ, PLY, STL, VTK, X3D, OFF, DFS,
  SRF, ASC, NV, ICO, GEO, TRK, TCK, TRX, TT, TRACT, plus ANNOT, CURV,
  SMP, STC overlays. nibabel: analyze, nifti1/2, minc1/2, mgh, brikhead,
  ecat, parrec, gifti, cifti2, freesurfer, streamlines (trk, tck). TRX is
  a zip with `header.json` (`VOXEL_TO_RASMM`, `DIMENSIONS`) and typed
  arrays.
- **Space.** sform/qform only. TRK, TCK, TRX carry a reference grid,
  unnamed.
- **Labels.** NiiVue `colormapLabel` takes a JSON `{R, G, B, A, I,
  labels}` object with sparse `I` keys; nibabel exposes FreeSurfer ctab,
  GIFTI and CIFTI label tables.
- **Transforms.** Neither loads transform files.

### Template identity crosswalk

The same template appears under a different name in every package. A
`space` value should use the BIDS label; this table is what an adapter
maps from.

| Package name | BIDS label |
| --- | --- |
| AFNI `MNI_2009c_asym`, `MNI152_2009_template` | `MNI152NLin2009cAsym` |
| AFNI `MNI` (`MNI_avg152T1`), `MNI_SPM2` | `MNI152Lin` |
| AFNI `MNI_N27`, `MNI_caez_N27` | `MNIColin27` |
| AFNI `TT_N27`, `TLRC`, `TT_Daemon` | `Talairach` |
| AFNI `MNI_ANAT` (Eickhoff-Zilles shift), `HaskinsPeds` | none; literal label |
| SPM `TPM.nii`, "MNI space" (SPM12+), CAT12 templates | `MNI152NLin2009cAsym` |
| SPM `avg152T1` | `MNI152Lin` |
| SPM `avg305T1`, FreeSurfer `talairach.xfm` target | `MNI305` |
| FSL `MNI152_T1_*`, HCP `MNINonLinear`, ANTs via TemplateFlow | `MNI152NLin6Asym` |
| FSL `MNI152lin` | `MNI152Lin` |
| FreeSurfer `fsaverage`, `fsaverage5`, `fsaverage6` | `fsaverage` (`den-` for the smaller meshes; `fsaverage5/6` are deprecated labels) |
| FreeSurfer subject surface space | `fsnative` |
| HCP `fs_LR` 32k / 164k | `fsLR` with `den-32k` / `den-164k` |
| FreeSurfer conformed `orig.mgz`, SPM "native", AFNI `ORIG`, Neurodesk `native` | `individual` |
| ANTs OASIS-30 template | `OASIS30ANTs` |

### Label systems observed

Two systems can share structure names and disagree on integers, so a
label system is a specific integer-to-name table, not a naming scheme.

| System | Integers | Emitted by |
| --- | --- | --- |
| FreeSurferColorLUT | 0 to 255 aseg, 1000/2000 DK cortex, 3000/4000 wmparc, 11100/12100 Destrieux | FreeSurfer `recon-all`, SynthSeg (33-label subset, plus 1000/2000 with `--parc`), FastSurfer, FSL FIRST (CMA subset), AFNI `FS.afni.MNI2009c_asym` |
| MRtrix `fs_default` | 1 to 84, renumbered from FreeSurferColorLUT | `labelconvert` |
| MRtrix `hcpmmp1_ordered` | 1 to 379 | `labelconvert` |
| FSL FAST | 1 CSF, 2 GM, 3 WM (T1 ordering) | `fast` |
| ANTs Atropos 6-class | 1 CSF, 2 cortical GM, 3 WM, 4 deep GM, 5 brainstem, 6 cerebellum | `antsAtroposN4.sh`, `antsCorticalThickness.sh` |
| SPM TPM classes | separate maps c1 GM, c2 WM, c3 CSF, c4 bone, c5 soft tissue, c6 air | SPM Segment (probseg, not dseg) |
| MRtrix 5TT | volume index 0 to 4 | `5ttgen` (probseg) |
| Harvard-Oxford cortical / subcortical | 0 to 47 / 0 to 20 (XML index; summary image is index plus one) | FSL atlases, FSLeyes LUT |
| Neuromorphometrics | 4 to 207 with gaps | SPM, CAT12 |
| AAL, AAL2, AAL3, LPBA40, Brainnetome, Julich, Glasser HCP-MMP1, Destrieux, DKT31 | atlas-specific | AFNI, CAT12, MRtrix LUTs, TemplateFlow atlases |
| Embedded table | file-defined | CIFTI `.dlabel.nii`, GIFTI `.label.gii`, AFNI `VALUE_LABEL_DTABLE`, FreeSurfer `.annot`, Slicer `.seg.nrrd`, Workbench volume labels |
| Coded terminology | SNOMED CT / DICOM triplets per segment | DICOM SEG, Slicer terminologies |

## 4. What the survey changes about RFC 0010

The recommendations below are applied in the current RFC revision,
with one addition from review: a value that no registry or BIDS list
names carries a vendor prefix (`afni:MNI_ANAT`, `neurodesk:subject-1mm`)
rather than a bare literal, so that package-specific names stay
unambiguous and cannot collide with tokens registered later.

**Confirmed as proposed.**

- Short registered tokens rather than media types or IRIs. No standard
  media type exists for any neuroimaging format except DICOM, and the
  conventions in use disagree. Galaxy is the working precedent for
  tokens plus a registry.
- BIDS labels for `space`, with literal labels as the escape hatch.
  Every other vocabulary (AFNI's spaces file, NIDM's class tree, DICOM's
  well-known UIDs, TemplateFlow) maps onto the BIDS list, and the gaps
  (`MNI_ANAT`, `HaskinsPeds`) are rare enough to stay literal.
- `space` as a declared contract rather than something read from files.
  Only AFNI records a named space in-band. FSL and FSLeyes see xform code
  4 and nothing finer; SPM writes code 2; ANTs, MRtrix, SynthSeg and
  Slicer write nothing.
- `inputs.<id>` for "same space as this input". No package has a
  declarative field for it, and every package has tools that depend on
  it (SynthStrip, `mrtransform` without `-template`, `mri_vol2vol
  --no-resample`, ANTs `-r`, Workbench label import).
- Excluding `neuro:transform` from `space`. FLIRT `.mat` and AFNI
  `.aff12.1D` disagree on direction and axis order, ITK is LPS,
  LTA is RAS with embedded geometries. A transform needs `from`, `to`, a
  direction, and a convention, which is its own RFC.
- Excluding `mediaType`.

**Recommended changes.**

1. **Token hierarchy for compression and variants.** SPM cannot read
   gzipped NIfTI, FSL picks the variant from `FSLOUTPUTTYPE`, and
   fileformats, Galaxy and EDAM all distinguish `.nii` from `.nii.gz`
   and NIfTI-1 from NIfTI-2. Register narrower tokens `nifti-1`,
   `nifti-2`, `nifti-gz`, `nifti-pair` under `nifti`, and define
   compatibility so a target listing the family accepts any child while
   a target listing a child rejects a source that lists only the
   family (a warning, since the source may still produce that child).
   CWL gets this from `rdfs:subClassOf`; Galaxy from datatype
   subclassing. The registry table gains a `parent` column.
2. **Allow `inputs.<id>` on `formats` too.** SynthStrip, `mri_convert`
   without `--out_type`, and every ITK tool with a pass-through output
   name produce the input's format. Galaxy's `format_source` is the
   precedent.
3. **Register the tokens the wrapped tools actually need.** Beyond the
   RFC's table: `mif` (MRtrix, with `mih`), `mha` (MetaImage), `brik-head`
   (AFNI), `trx`, `annot`, `freesurfer-label`, `seg-nrrd`, `vtk`, `ecat`,
   `afni-1d`, `flirt-mat` (distinct from `itk-transform`, different
   coordinate convention), `fnirt-coef`, `fnirt-field`, `x5`,
   `spm-deformation`, `ants-h5`, `displacement-field`, `mrtrix-warp`.
   CIFTI should be subtyped by intent (`cifti-dlabel`, `cifti-dscalar`,
   `cifti-dtseries`, `cifti-pconn`) since one extension covers all of
   them.
4. **Publish cross-references in the registry.** Each registered format
   token gets its EDAM IRI where one exists (`nifti` → `format_3549`,
   `dicom` → `format_3548`, `nrrd` → `format_3551`, `tsv` →
   `format_3475`) and its fileformats class, so a CWL or Pydra adapter
   is a lookup. Each `space` label gets its NIDM class and DICOM
   well-known UID where they exist.
5. **Define `labelSystem` as an integer table, and name the tables the
   tools emit.** The RFC's `desikan-killiany` and `destrieux` entries are
   ambiguous: those parcellations exist as FreeSurferColorLUT ranges
   (1000/2000, 11100/12100), as MRtrix's renumbered 1 to 84, and as CIFTI
   embedded tables, all with different integers. Register
   `freesurfer` (FreeSurferColorLUT, which covers aseg, DK, Destrieux,
   wmparc, and the FIRST and SynthSeg subsets), `mrtrix-fs-default`,
   `mrtrix-hcpmmp1`, `fsl-fast`, `ants-atropos-6`, `harvard-oxford-cortical`,
   `harvard-oxford-subcortical`, `neuromorphometrics`, and the atlas
   names, and drop `desikan-killiany` and `destrieux` as standalone
   systems. Add the reserved value `embedded` for formats that carry
   their own table (CIFTI, GIFTI label, AFNI label table, `.annot`,
   `.seg.nrrd`), which a validator treats as compatible with any target
   that also declares `embedded` and as absent otherwise.
6. **Say how a registered `labelSystem` resolves.** BIDS `dseg.tsv`
   (`index`, `name`, `abbreviation`, `color`, `mapping`) is the
   de-facto table schema and TemplateFlow already ships atlases in it;
   the registry entry for each system should point at one. Coded
   terminologies (DICOM SEG, Slicer) stay out of scope; a `dseg.tsv`
   can carry SNOMED codes in an extra column if needed.
7. **Add `resolution` now rather than later.** Neurodesk's
   `subject-1mm`, SynthSeg's forced 1 mm resample, FreeSurfer's
   conformed 256³, SPM's 2 mm normalised default and TemplateFlow's
   `res-` index all show that grid and space are separate facts that
   tools change independently: SynthStrip keeps both, SynthSeg keeps the
   space and changes the grid, registration changes both. A
   `resolution` qualifier (millimetre spacing as a number or triple, or
   `inputs.<id>`) lets `subject-1mm` be written as `space: individual`
   plus `resolution: 1`, and lets a validator catch a label-volume
   consumer that assumes the acquisition grid.
8. **Add BIDS `den-<label>` for surfaces.** `fsaverage`, `fsLR` and
   `fsnative` name a family; the mesh density (`32k`, `164k`,
   `fsaverage5` versus `fsaverage`) is a separate fact the way
   `resolution` is for volumes. Either fold it into `resolution` or add
   `density`.
9. **Runtime hint.** A runtime that writes an artifact declared in an
   MNI-family space SHOULD set NIfTI xform code 4 so FSLeyes and FSL
   tools accept it, and MAY write AFNI's `TEMPLATE_SPACE` extension, the
   only in-band generation-level label any consumer reads.

**Left as open issues.** Transform `from`/`to` (its own RFC); coded
terminologies; whether `formats` should be required on `core:file`.
