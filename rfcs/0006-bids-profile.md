# RFC 0006: bids/profile Extension Namespace

Status: Proposed

Created: 2026-05-24

## Summary

This RFC publishes a reference extension namespace, `bids/profile`, that
declares BIDS-aware tool metadata and pairs with the portable
fix-proposal pattern in RFC 0005. The namespace lets tool authors describe:

- the tool's role in a BIDS workflow (converter, classifier, validator,
  fixer, writer, deface-detector, reface-tool, subject-relabel-detector,
  subject-relabel-fixer, intendedfor-fixer, qc),
- the BIDS modalities it handles,
- the required and recommended JSON sidecar fields the tool enforces or
  populates per suffix,
- the provenance sources a fixer may consult to fill missing fields
  (DICOM tags, NIfTI headers, context values, operator input),
- refacing / defacing detection and annotation, and
- subject relabeling rules.

The schema lives in [schemas/0.1/extensions/bids-profile.schema.json](../schemas/0.1/extensions/bids-profile.schema.json).
It is referenced by tool documents under `extensions["bids/profile"]`,
mirroring how `niivue/ui` and `niivue/runtime` are used.

## Decision

The `bids/profile` namespace is published as a reference extension. It is
optional, but tool authors who declare it gain validator support for the
BIDS knowledge they encode, and runtimes that integrate this extension can
provide turn-key behavior for missing fields, refacing, and subject
relabeling without bespoke configuration in each pipeline.

## Motivation

RFC 0005 made the *pattern* portable (detector emits proposal → fixer
applies → re-validate). But each BIDS-aware tool still needs to declare
*what* it considers required, *which* sidecar fields it can populate, and
*how*. Today this knowledge is scattered:

- `bids-validator` hardcodes required-field tables in TypeScript.
- `dcm2bids`, HeuDiConv, and `dcm2niix` each have their own mapping between
  DICOM tags and BIDS fields.
- Refacing tools (PyDeface, MRIDeface, Quickshear, neuroflow/reface) use
  ad-hoc sidecar annotations.
- Subject-relabel logic lives in operator scripts.

Standardizing this knowledge as an extension namespace lets workflow
authors compose interoperable tools, lets editors surface useful warnings,
and lets new tools join the ecosystem by declaring their capability
profile in JSON.

## Goals

- Make BIDS knowledge declarative and externally inspectable.
- Cover the common modalities (anat, func, dwi, fmap, perf, meg, eeg,
  ieeg, pet, micr, motion, nirs, mrs).
- Encode the most common fix sources: DICOM tag (with group/element),
  NIfTI header, run-context value, operator input, computed.
- Capture refacing / defacing in a way that survives in BIDS sidecars
  (`DefacedBy`, `RefacedBy`).
- Capture subject-relabel rules so the fix-proposal step in RFC 0005 can
  drive a deterministic rename.

## Non-goals

- Replacing BIDS or `bids-validator`. The extension *describes* tools'
  BIDS behavior; the validator's truth is still BIDS.
- Modeling every BIDS sidecar field. The extension lists fields by name;
  it does not duplicate the BIDS field-level type system.
- Embedding BIDS-Derivatives semantics for every tool. The
  `outputDataset` field flags the writer; the actual derivatives layout
  is the writer's responsibility.

## Proposal

### 1. Per-tool profile under `extensions["bids/profile"]`

```json
{
  "extensions": {
    "bids/profile": {
      "role": "validator",
      "modality": ["anat", "func", "fmap"],
      "requiredFields": {
        "bold":         ["RepetitionTime", "EchoTime", "TaskName"],
        "T1w":          [],
        "magnitude1":   ["EchoTime"],
        "phasediff":    ["EchoTime1", "EchoTime2", "IntendedFor"]
      },
      "recommendedFields": {
        "bold": ["PhaseEncodingDirection", "EffectiveEchoSpacing", "SliceTiming"]
      },
      "fillFrom": {
        "RepetitionTime":         { "source": "dicom", "dicomTag": "(0018,0080)", "description": "ms in DICOM, seconds in BIDS." },
        "EchoTime":               { "source": "dicom", "dicomTag": "(0018,0081)" },
        "PhaseEncodingDirection": { "source": "operator-input", "description": "Cannot be inferred; ask operator." }
      }
    }
  }
}
```

### 2. Refacing profile

```json
{
  "extensions": {
    "bids/profile": {
      "role": "reface-tool",
      "refacing": { "operation": "reface", "annotationField": "RefacedBy" }
    }
  }
}
```

### 3. Subject-relabel profile

```json
{
  "extensions": {
    "bids/profile": {
      "role": "subject-relabel-detector",
      "subjectPolicy": {
        "pattern": "^[A-Za-z0-9]+$",
        "rules": [
          { "match": "^Patient_(\\d+)$", "replace": "$1", "description": "Strip scanner prefix." },
          { "match": "^(\\d{3})$",       "replace": "$1", "description": "Pad to canonical width — placeholder." }
        ]
      }
    }
  }
}
```

### 4. Writer profile

```json
{
  "extensions": {
    "bids/profile": {
      "role": "writer",
      "outputDataset": {
        "type": "bids-derivatives",
        "pipelineName": "niivue-desktop"
      }
    }
  }
}
```

## Worked Scenarios

The required-fields and `fillFrom` declarations are exactly what a
`bids-fix-sidecar` tool needs to:

1. Parse the validator's `core:fix-proposal` events.
2. For each `set-field` operation whose target is in `requiredFields`,
   resolve the value via `fillFrom`.
3. Emit a follow-up proposal for any field that cannot be filled
   (forcing operator input).

## Alternatives Considered

### Embed this metadata in the core tool contract

Considered and rejected. The portable core stays modality-agnostic;
BIDS-specific knowledge belongs in an extension namespace.

### Reuse Boutiques as the carrier

Considered and rejected. Boutiques covers CLI argument shape, not BIDS
semantics; it complements rather than replaces this profile.

### Standardize only the role, not the fields

Considered and rejected. The required-fields table is exactly the
knowledge that has the most leverage — encoding it makes editors useful
and lets fixers be portable.

## Compatibility

This RFC adds an optional extension namespace. Tools and workflows that do
not declare it are unaffected. Runtimes that do not understand
`bids/profile` MUST preserve it unchanged when rewriting documents.

## Open Questions

- Should the spec maintain a canonical, versioned BIDS required-fields
  knowledge base, or rely on each tool to declare its own?
- Should `fillFrom` allow chained fallbacks (try DICOM, then context,
  then operator-input)?
- Should the schema cover `IntendedFor` repair explicitly, or treat it as
  a generic `patch-json` operation under RFC 0005?

## Decision Outcome

Pending review.
