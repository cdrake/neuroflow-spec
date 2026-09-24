---
marp: true
title: NeuroFlow Specification 0.1
description: A vendor-neutral, JSON-first standard for declarative neuroimaging pipelines
paginate: true
---

# NeuroFlow Specification 0.1

### A JSON-first standard for declarative neuroimaging pipelines

Vendor-neutral · schema-validated · provenance-first · open & extensible

<small>neuroflow-spec · 2026</small>

---

## The problem

Neuroimaging pipelines are powerful but fragmented:

- Each tool invents its own config, I/O, and execution model
- Apps (BIDSvue, NeuroVue, NiiVue, fMRIPrep, QSIPrep…) don't share a contract
- Provenance is an afterthought, reconstructed later if at all

**NeuroFlow** is a small, portable contract that describes *what a pipeline is*
— its inputs, tools, data flow, and outputs — as validated JSON, independent of
any UI toolkit or runtime.

---

## Design principles

- **Schema-first** — every document validates against a JSON Schema
- **Portable core** — the contract requires no specific UI, viewer, or binary
- **Closed vocab + open extensions** — small typed core, app-specific everything-else
- **Provenance-first** — every run produces a W3C PROV-aligned record
- **Interoperate, don't replace** — aligns with BIDS, CWL/WDL, PROV, RO-Crate

---

## Document families

| Kind | Purpose |
|------|---------|
| **workflow** | Steps, bindings, context, and public outputs of a pipeline |
| **tool** | Portable contract for one operation: typed inputs/outputs + delivery |
| **heuristic** | Declarative rule that auto-populates context fields |
| **provenance** | PROV-aligned record of one executed run |

One envelope for all: `{ neuroflow, kind, id, version, … }`.

---

## A layered, qualified type system

Every value carries a namespace-qualified type:

```text
core:string   neuro:volume   bids:sidecar   prov:run-record
core:array<neuro:volume>     myapp:custom-thing   (extension)
```

- `core:` `neuro:` `bids:` `prov:` are **closed vocabularies** — a misspelled
  `neuro:volme` is a *validation error*, not a silent unknown.
- **Any other namespace is an open extension type** — accepted, never interpreted,
  always preserved.

---

## Types common neuroimaging pipelines exchange today

The `neuro:` / `core:` core now covers what real pipelines emit:

- **Images** — `volume`, `mask`, `label-map`, `probseg`, `statmap`, `cifti`,
  `surface`, `tract`
- **Diffusion / connectivity** — `gradient-table`, `connectivity-matrix`
- **Multiscale** — `ome-zarr`, `ngff-zarr`
- **Tabular / QC** — `core:tabular` (confounds, regressors), `qc-metrics`, `report`
- **BIDS** — `bids:dataset`, sidecars, tables, validation reports, fix proposals

> Grounded in fMRIPrep / QSIPrep / MRIQC / ANTs / BIDS-Derivatives outputs.

---

## Conformance classes

Two validator tiers keep the standard open:

- **Core-conformant** — validates the closed core + structure; treats every
  extension as opaque. **MUST preserve, MUST NOT fail** on unknown extensions.
- **Extension-aware** — additionally validates *registered* extension schemas.
  A mismatch there never changes core validity.

There is no mode where an unknown extension makes a document non-conformant.
**That is what keeps NeuroFlow open.**

---

## Anatomy of a workflow

```json
{
  "kind": "workflow",
  "inputs":  { "dicom_dir": { "type": "neuro:dicom-folder" } },
  "steps": {
    "convert": { "tool": "…/dcm2niix", "stage": "ingest",
                 "inputs": { "dicom_dir": { "ref": "inputs.dicom_dir" } } }
  },
  "outputs": { "bids_dir": { "type": "neuro:bids-dataset",
                             "ref": "steps.convert.outputs.bids_dir" } }
}
```

Bindings are `ref` (a statically-checkable dot-path) or `constant`. Data flow is
analyzable *before* anything runs.

---

## Tool contracts & output delivery

A tool declares typed inputs/outputs and **how each output is delivered** —
a closed vocabulary the runtime harvests against:

```text
core:result-file   core:result-dir   core:stdout-json
core:event-stream  core:fixed-path   core:exit-code
```

The portable core is just `description`, `inputs`, `outputs`. UI and CLI
specifics live in extensions (`niivue/ui`, `niivue/runtime`).

---

## Workflow stages

An informal, opt-in grouping for discovery — **ingest → explore → publish**:

| Stage | Intent | Reference adapter |
|-------|--------|-------------------|
| `ingest` | bring data in, shape a dataset | BIDSvue |
| `explore` | review, correct, process | NeuroVue |
| `publish` | figures, captions, QA reports | composer |

Non-load-bearing: the runtime never branches on a stage. Reference adapters are
defaults; any tool — including custom `open file` / `run script` tools — fits any stage.

---

## Open & extensible: the Extension Registry

NeuroFlow keeps the core small and lets applications add their own types and
metadata under their **own namespaces**.

- **Open by default** — any namespace works immediately, preserved, never fails core
- **Registered by review** — a merged schema in neuroflow-spec

**The project acts as registrar — registration is by pull request**, exactly like
the NIH NIfTI extension-code registry.

`schemas/0.1/extensions/registry.json` + one schema per namespace.

---

## Extension Registry — how it works

```text
schemas/0.1/extensions/
  registry.json          ← authoritative list (CI-validated)
  registry.schema.json
  niivue-ui.schema.json  bids-profile.schema.json  neurovue.schema.json …
```

To add one: PR a `<namespace>.schema.json` + a registry entry
(`status`, `maintainer`, `contact`, `reservedTypes`). Maintainers review & merge.

`requiredExtensions` lets a document demand a runtime understand a namespace —
or refuse to run.

---

## Provenance — every run is reproducible

A `kind:"provenance"` document, **W3C PROV-aligned** (Agent / Activity / Entity),
embeddable in BIDS-Derivatives `GeneratedBy[]` and RO-Crate.

- Tools append a lightweight `provenance.jsonl` trail *during* the run
- The runtime **folds** it into one durable provenance document at the end
- Captures agents, step activities, output entities, checksums, decisions

> Lightweight in-flight log → conformant PROV artifact.

---

## Runtime semantics (defined, not hand-waved)

The spec also pins down the hard parts:

- **Runtime events** — progress, logs, live context-writes over a typed envelope
- **Fix proposals** — human-in-the-loop approval and fix loops (e.g. BIDS repairs)
- **Error handling** — per-step / per-workflow `errorPolicy`, halt, notify, handlers
- **Heuristics** — declarative auto-population of context fields

---

## Relationship to existing standards

NeuroFlow **interoperates**, it does not replace:

| Standard | NeuroFlow relationship |
|----------|------------------------|
| **BIDS / Derivatives** | closed `bids:` types; fix-proposals; embeds provenance |
| **CWL / WDL** | may compile to/from; keeps neuro-typed, UI-native semantics |
| **W3C PROV** | provenance docs are a PROV-compatible serialization |
| **RO-Crate** | provenance designed to embed as an RO-Crate entity |
| **BIDS-Apps / Boutiques** | tool contracts align via extensions |

---

## Reference implementation

The spec is exercised by a working ecosystem:

- **neuroflow** — Tauri/React workbench + Rust/WASM validator + tool **gallery**
- **BIDSvue** & **NeuroVue** — NeuroFlow-aware ingest & explore apps
- A complete **DICOM → BIDS → review → filter → QA** workflow, schema-valid
- `npm test` — schemas + examples + extension-registry all conformance-checked

---

## Status & roadmap

- **0.1** — workflow / tool / heuristic / provenance families; events; fix
  proposals; error handling; **stages**; **common pipeline types**; **extension
  registry**
- Pre-1.0: breaking changes allowed while the model settles
- Open: tool-version range grammar, BIDS entity modeling, deeper PROV/RO-Crate

---

# NeuroFlow 0.1

### Small typed core · open extension lane · provenance by default

- Conforms to what pipelines do **today**
- Extensible to whatever apps need **next** — by PR
- Reproducible by construction

**Contribute a type or extension:** open a PR against `neuroflow-spec`.
