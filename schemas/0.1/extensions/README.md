# NeuroFlow Extension Registry

NeuroFlow keeps its core type vocabulary (`core:`, `neuro:`, `bids:`, `prov:`)
small and closed, and lets applications add their own **extension types** and
**extension metadata** under their own namespaces. Any namespace is accepted and
preserved by every conforming tool — but a namespace becomes *registered* only
when its schema is merged here.

This mirrors how the NIH maintains the
[NIfTI extension-code registry](https://nifti.nimh.nih.gov/): anyone may use an
extension, but the codes/namespaces and their meanings are recorded centrally so
the ecosystem stays interoperable. **The NeuroFlow-spec maintainers act as the
registrar; registration happens by pull request.**

## What's here

- `registry.json` — the authoritative list of registered namespaces.
- `registry.schema.json` — validates `registry.json` (CI checks every PR).
- `<namespace>.schema.json` — one JSON Schema per registered namespace
  (`niivue-ui`, `niivue-runtime`, `bids-profile`, `neurovue`,
  `neuroflow-mcp`, …).

## Registered vs. unregistered

| | Namespace in `registry.json` | Validation | Preserved |
| --- | --- | --- | --- |
| **Registered** | yes, with a merged schema | extension-aware validators MAY check the schema | yes |
| **Unregistered (open)** | no | none (opaque) | yes — MUST NOT fail core validation |

Both are legal. Registration buys discoverability, a reviewed schema, and
machine validation; it is never required to *use* an extension. See
specification §28 for the normative rules and validator conformance tiers.

## How to register a namespace (open a PR)

1. **Pick a namespace.** Use a stable, owned name: a reverse-DNS or
   project-qualified token. Extension-metadata keys use the slash form
   (`myorg/ui`); extension *types* use the colon form (`myorg:my-type`). Do not
   use `core`, `neuro`, `bids`, or `prov` — those are closed (§7).
2. **Add a schema file** `<namespace>.schema.json` in this directory. For an
   extension *type*, define a `$def` describing the type's value shape (see
   `neurovue.schema.json`). For extension *metadata*, describe the object placed
   under `extensions["<namespace>"]` (see `niivue-ui.schema.json`).
3. **Add a `registry.json` entry** with `namespace`, `title`, `status`
   (`provisional` for a first submission), `maintainer`, `contact`, `schema`,
   `addedIn`, an optional `reservedTypes` list, and a `description`.
4. **Open the PR.** CI validates `registry.json` against `registry.schema.json`,
   confirms each `schema` file exists and parses, and checks `reservedTypes`
   against the extension-type grammar (`npm test`).
5. **Review.** Maintainers (the registrar) check the namespace is unclaimed, the
   schema is sound, and the contact is real, then merge. Status moves to
   `registered`.

Removing or repurposing a registered namespace is a breaking change; deprecate
it (`status: "deprecated"`) instead.
