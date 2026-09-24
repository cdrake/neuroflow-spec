# RFC 0009: MCP Binding

Status: Proposed

Created: 2026-09-24

## Summary

This RFC defines how a NeuroFlow runtime exposes its tool registry,
workflows, runs, artifacts, and approvals to AI agents through the
Model Context Protocol (MCP). It is a **binding profile**: a normative
mapping from existing NeuroFlow concepts onto MCP primitives, plus one
new extension namespace, `neuroflow/mcp`, for per-document MCP
metadata. It makes no changes to the core document model.

The binding targets MCP protocol version `2026-07-28` (stateless
requests, Multi Round-Trip Requests, the `io.modelcontextprotocol/tasks`
extension) and the MCP Apps extension (`io.modelcontextprotocol/ui`).
Behavior against earlier MCP versions is covered in the compatibility
notes at the end.

In one sentence: every NeuroFlow tool and workflow becomes an MCP tool
with a JSON Schema generated from its typed inputs, every produced
artifact becomes an MCP resource, every run becomes an MCP task, every
`core:await-approval` becomes an MCP input request, and every
interactive `uiApp` tool can become an MCP App.

## Decision

A conforming **NeuroFlow MCP server** is a NeuroFlow runtime (spec §3)
that also speaks MCP. It:

1. Exposes each exposed tool and workflow document in its resolved
   registry as an MCP tool, with `inputSchema` and `outputSchema`
   derived from the document's typed `inputs` and `outputs` (§1 below).
2. Exposes a small fixed set of authoring and run-management tools
   (`neuroflow_validate`, `neuroflow_plan`, `neuroflow_run`, and
   others; §2, §3).
3. Represents runs as MCP tasks when the client supports the tasks
   extension, and as explicit server-minted `runId` handles otherwise
   (§3).
4. Maps `core:progress` events to `notifications/progress`, and
   `core:await-approval` / `core:fix-proposal` events to MCP input
   requests (§3, §4).
5. Exposes artifacts, provenance, events, and the NeuroFlow schemas as
   MCP resources under the `neuroflow://` URI scheme (§5).
6. MAY expose `uiApp` tools as MCP Apps (§6).
7. Records the MCP client and every approval decision in the run's
   provenance document (§7).

The server advertises support in `ServerCapabilities.extensions` under
the identifier `com.niivue/neuroflow` (see Open issues on the final
identifier):

```json
{
  "extensions": {
    "com.niivue/neuroflow": {
      "neuroflow": "0.1.0",
      "binding": "0009",
      "features": ["tasks", "approvals", "summaries", "renditions", "apps"],
      "agentApprovals": false
    }
  }
}
```

## Motivation

NeuroFlow already has the properties that make a system usable by
agents, and most existing agent integrations for neuroimaging lack
them:

- **Typed, described contracts.** Tool inputs carry types,
  descriptions, enums, defaults, and bounds. That is exactly what an
  MCP `inputSchema` needs, so the mapping is mechanical rather than
  hand-written per tool.
- **Declarative workflows validated by a real validator.** Language
  models are good at producing JSON against a schema and good at
  fixing it when given precise diagnostics. `neuroflow-core` can check
  references, cycles, and type compatibility, so an agent can author a
  new pipeline, validate it, repair it, and run it, all without
  executing arbitrary code.
- **A control plane that already separates progress, approvals, and
  data.** Runtime events (RFC 0002), fix proposals (RFC 0005), error
  policy (RFC 0007), and output delivery (RFC 0008) line up one-to-one
  with MCP progress notifications, input requests, tool errors, and
  resources.
- **Provenance.** An agent-driven analysis is only acceptable in
  research if it is auditable. The provenance family (RFC 0003) gives
  every agent run a PROV-aligned record, including who approved what.

Separately, the browser-based neuroimaging ecosystem (NiiVue-based web
apps for segmentation, QSM, brain extraction, and review) has no shared
glue. Each app is a standalone page. MCP Apps gives those pages a
standard way to receive inputs and hand back outputs inside an agent
session, and NeuroFlow gives them a typed contract and a place in a
pipeline. §6 defines that bridge.

Existing NiiVue MCP servers focus on viewer control or API lookup.
None expose processing pipelines. This RFC fills that gap without
coupling the NeuroFlow core to MCP.

## Scope and layering

- The binding is a runtime concern. Per spec §4, runtime metadata
  lives in extension namespaces; this RFC adds `neuroflow/mcp` (§9)
  and changes no core schema.
- A document with no `neuroflow/mcp` extension is still exposed using
  the defaults below. Authors add the extension only to rename,
  annotate, hide, or attach an app.
- The binding does not define how tools are launched. `script`,
  console (`niivue/runtime` `exec`), and `uiApp` launch kinds keep
  their existing contracts. The MCP server sits in front of the
  runtime, not inside tools.
- Transport is unconstrained: stdio for a local desktop runtime,
  Streamable HTTP for a shared or HPC runtime.

## Server surface at a glance

| NeuroFlow concept | MCP primitive |
| --- | --- |
| Tool document | Tool, named from its `id` (§1) |
| Workflow document | Tool, named from its `id` (§1) |
| Validate / plan / inline run | Fixed tools `neuroflow_validate`, `neuroflow_plan`, `neuroflow_run` (§2) |
| Run | Task (`io.modelcontextprotocol/tasks`) or `runId` handle (§3) |
| `core:progress` | `notifications/progress` on the request's response stream |
| `core:await-approval`, `core:fix-proposal` | `InputRequiredResult` with an elicitation request, or task `input_required` (§4) |
| `core:error` with `fatal: true`, step failure | Tool result with `isError: true` and structured diagnostics |
| `core:cancel-request` | `tasks/cancel` or `neuroflow_cancel` |
| Step output artifact | Resource `neuroflow://runs/...` plus `resource_link` content (§5) |
| Provenance document | Resource `neuroflow://runs/{runId}/provenance` |
| Schemas, tool and workflow documents | Resources `neuroflow://schemas/...`, `neuroflow://catalog/...` |
| `uiApp` tool | MCP App (`_meta.ui.resourceUri`) (§6) |

## 1. Tools and workflows as MCP tools

### 1.1 Naming

The MCP tool name is derived from the document `id`:

1. Replace each `/` with `.`.
2. Remove any character outside `[A-Za-z0-9_.-]`.
3. If the result exceeds 64 characters, the document MUST declare
   `extensions["neuroflow/mcp"].name`.

Examples: `neuroflow.gallery.tools/python-volume-filter` becomes
`neuroflow.gallery.tools.python-volume-filter`;
`niivue.desktop/dicom-to-bids` becomes `niivue.desktop.dicom-to-bids`.

`extensions["neuroflow/mcp"].name` overrides the derived name. Names
beginning with `neuroflow_` are reserved for the fixed tools in §2 and
§3. A server MUST reject a registry in which two exposed documents
resolve to the same name.

The MCP `title` is taken from `extensions["neuroflow/mcp"].title`, then
`extensions["niivue/ui"].block.label`, then the document `id`. The MCP
`description` is the document `description`, followed by the stage tag
(spec §27) when present, since stage is a useful discovery hint for an
agent choosing among tools.

Only one version of a given `id` is exposed at a time: the version the
runtime's registry resolves. Version pinning remains an open issue in
the core (spec §26).

### 1.2 Input schema

`inputSchema` is a JSON Schema 2020-12 object whose properties are the
document's `inputs`. Each NeuroFlow type declaration maps as follows:

| NeuroFlow | JSON Schema |
| --- | --- |
| `core:string` | `{"type": "string"}` |
| `core:number` | `{"type": "number"}` |
| `core:integer` | `{"type": "integer"}` |
| `core:boolean` | `{"type": "boolean"}` |
| `core:object` | `{"type": "object"}` |
| `core:json` | `{}` (any JSON value) |
| `core:array<T>` | `{"type": "array", "items": <map(T)>}` |
| Artifact type (§1.3) | `{"$ref": "#/$defs/artifactRef"}` |
| Value type (§1.3) | `{"type": "object"}`, or a `$ref` to the type's schema when the spec defines one |
| `description` | `description` |
| `label` | `title` |
| `default` | `default` |
| `enum` | `enum` |
| `min` / `max` | `minimum` / `maximum` |

An input is listed in `required` when it is neither `optional` nor has
a `default`.

Every generated property carries the annotation keyword
`"x-neuroflow-type"` holding the original qualified type string, so a
client or agent can see that a string parameter is a `neuro:volume`
rather than an arbitrary string. MCP `2026-07-28` permits arbitrary
2020-12 keywords in `inputSchema`, and unknown keywords are ignored by
validators.

The shared definition:

```json
{
  "$defs": {
    "artifactRef": {
      "type": "string",
      "description": "A neuroflow:// artifact URI returned by an earlier call, or an absolute path inside one of the server's allowed data roots."
    }
  }
}
```

### 1.3 Artifact types and value types

An agent should pass *references* to large data and *values* for small
structured data. The binding classifies types accordingly:

- **Artifact types** (passed and returned as references): `core:file`,
  `core:directory`, `core:tabular`; `neuro:volume`, `neuro:mask`,
  `neuro:dicom-folder`, `neuro:bids-dataset`, `neuro:label-map`,
  `neuro:transform`, `neuro:surface`, `neuro:tract`, `neuro:ome-zarr`,
  `neuro:ngff-zarr`, `neuro:statmap`, `neuro:probseg`, `neuro:cifti`,
  `neuro:gradient-table`, `neuro:connectivity-matrix`, `neuro:report`;
  `bids:sidecar`, `bids:participants-table`, `bids:events-table`,
  `bids:scans-table`, `bids:sessions-table`,
  `bids:derivatives-dataset`.
- **Value types** (passed and returned inline as JSON):
  `neuro:dicom-series`, `neuro:subject`, `neuro:series-mapping`,
  `neuro:qc-metrics`; `bids:dataset-description`,
  `bids:participants-sidecar`, `bids:validation-report`,
  `bids:fix-proposal`, `bids:entity-map`; all `prov:` types.
- **Extension types** are artifact types unless the owning namespace
  lists them in `extensions["neuroflow/mcp"].valueTypes` on the tool,
  or registers them as value types in the extension registry.

This classification parallels the value / file / directory distinction
RFC 0008 already draws for `core:result-dir` default paths. See Open
issues on moving it into the core type vocabulary.

### 1.4 Output schema and results

`outputSchema` describes `structuredContent` for a completed call:

```json
{
  "runId": "run-2026-09-24-0007",
  "status": "completed",
  "outputs": {
    "filtered_volumes": [
      {
        "uri": "neuroflow://runs/run-2026-09-24-0007/artifacts/filter/filtered_volumes/0",
        "type": "neuro:volume",
        "path": "/data/session/outputs/filter/filtered/sub-01_T1w.nii.gz",
        "mediaType": "application/x-nifti+gzip",
        "bytes": 14872231,
        "checksum": { "algorithm": "sha256", "value": "9c1f..." }
      }
    ]
  },
  "provenance": "neuroflow://runs/run-2026-09-24-0007/provenance"
}
```

Artifact-typed outputs appear as artifact descriptors; value-typed
outputs appear inline. For a workflow tool, `outputs` holds the
workflow's public `outputs`; for a tool document, the tool's
`outputs`. `path` is included only when the client is local to the
runtime (stdio transport) or the server is configured to disclose
paths.

The unstructured `content` array SHOULD contain a one-paragraph text
summary of the run (status, step count, item failures, outputs) and
one `resource_link` per artifact output, so clients that ignore
`structuredContent` still give the model something useful.

### 1.5 Tool annotations

| Annotation | Default | Source |
| --- | --- | --- |
| `readOnlyHint` | `false` | `neuroflow/mcp.annotations` |
| `destructiveHint` | `false`, except `true` for a workflow containing a `fixLoop` or any step whose tool declares a `core:fix-proposal` channel | `neuroflow/mcp.annotations` overrides |
| `idempotentHint` | `false` | `neuroflow/mcp.annotations` |
| `openWorldHint` | `false` | `neuroflow/mcp.annotations` |

The fixed tools `neuroflow_list`, `neuroflow_describe`,
`neuroflow_validate`, and `neuroflow_plan` are `readOnlyHint: true`.

## 2. Authoring tools and schema resources

The binding assumes agents will write NeuroFlow documents, not only
call existing ones. A server MUST expose:

| Tool | Purpose |
| --- | --- |
| `neuroflow_list` | Catalog of exposed tools and workflows: name, id, version, title, stage, input and output types. Optional filters: `stage`, `acceptsType`, `producesType`. |
| `neuroflow_describe` | The full tool or workflow document for an `id`. |
| `neuroflow_validate` | Validate a document supplied inline. Returns diagnostics (below). |
| `neuroflow_plan` | Return the execution plan for a valid workflow: ordered steps, resolved tools, dependencies. |

`acceptsType` and `producesType` let an agent ask "what can consume a
`neuro:probseg`?", which is how it chains tools it has not seen
before.

Diagnostics use one shape across `neuroflow_validate`,
`neuroflow_plan`, and `neuroflow_run`:

```json
{
  "valid": false,
  "diagnostics": [
    {
      "severity": "error",
      "code": "reference.unresolved",
      "pointer": "/steps/segment/inputs/t1/ref",
      "message": "Reference 'steps.strip.outputs.brain' does not resolve: tool 'brainchop.tools/skull-strip' has no output 'brain'.",
      "hint": "Declared outputs: brain_mask, brain_volume."
    }
  ]
}
```

`pointer` is a JSON Pointer into the submitted document. `hint` is
optional, but servers SHOULD include one whenever the validator knows
the valid alternatives, since that is what lets an agent repair the
document in one step.

A server MUST also expose the NeuroFlow schemas as resources at
`neuroflow://schemas/0.1/{family}.schema.json` (and the registered
extension schemas at `neuroflow://schemas/0.1/extensions/{file}`), and
SHOULD expose an MCP prompt `neuroflow_author_workflow` that bundles a
condensed description of the workflow model, the reference grammar,
and the current catalog.

## 3. Runs

### 3.1 Starting a run

A run starts in one of three ways:

- Calling a generated workflow tool (§1).
- Calling a generated tool-document tool. The server wraps it in an
  implicit one-step workflow whose inputs and outputs are the tool's.
- Calling `neuroflow_run` with an inline workflow document and its
  inputs. The server MUST validate the document first and MUST refuse
  it unless every step references a tool in the resolved registry and
  every `requiredExtensions` namespace is supported. Refusals return
  `isError: true` with the diagnostics shape from §2.

`neuroflow_run` is how an agent executes a pipeline it composed
itself. It never widens what can execute: only registered tools run,
only through their declared launch contracts.

### 3.2 Tasks

When the client declares the `io.modelcontextprotocol/tasks`
extension, a server SHOULD return a task (`resultType: "task"`) for any
run it does not expect to finish within a few seconds, and MUST do so
for runs containing a `uiApp` step or a step with
`awaitApproval: "required"`.

The task status tracks the NeuroFlow run status:

| NeuroFlow state | Task `status` |
| --- | --- |
| `in-progress` | `working` |
| Paused on `core:await-approval`, or waiting on a `uiApp` | `input_required` |
| `completed`, `partial` | `completed` (the `partial` state is visible in `structuredContent.status`) |
| `failed`, `halted` | `failed` |
| `cancelled` | `cancelled` |

`tasks/cancel` maps to cooperative cancellation (spec §23.3). Task
`ttlMs` SHOULD match how long the runtime retains the run's session
directory.

A run whose status is `partial` is reported as a completed task,
because its public outputs exist. The agent learns about tolerated
item failures from `structuredContent.status` and the text summary.
Surfacing this clearly matters: an agent that treats `partial` as
success on a 1,000-subject batch may silently drop subjects.

### 3.3 Without the tasks extension

MCP `2026-07-28` removed protocol sessions; cross-call state must use
server-minted handles passed as ordinary arguments. When tasks are not
available, a run that exceeds `neuroflow/mcp.maxWaitMs` (default
30,000) returns a result with `status: "in-progress"` and its `runId`,
and the agent continues with:

| Tool | Purpose |
| --- | --- |
| `neuroflow_status` | Status, current step, progress, pending approvals, and (when finished) the same `structuredContent` as §1.4. |
| `neuroflow_cancel` | Request cooperative cancellation. |

`runId` is the same identifier recorded in provenance
(`run.id`), so an agent, a human, and the provenance record all refer
to one run the same way.

### 3.4 Progress and logs

When the originating request carries a `progressToken`, the server
forwards `core:progress` events as `notifications/progress` on that
request's response stream, using the event's fraction or counts and
prefixing the message with the step id.

MCP `2026-07-28` deprecates the Logging feature, so `core:log` events
are NOT forwarded as `notifications/message`. They are available in
the events resource (§5) and summarized in `neuroflow_status`. Servers
MAY also export events as OpenTelemetry spans.

## 4. Approvals and fix proposals

This is the part of the binding with the most consequence for safety.
A detector step can propose deleting files, relabeling subjects, or
replacing images (spec §22). The binding keeps the human in that loop
by default.

### 4.1 Input requests

When a step emits `core:await-approval`, the server asks the client
for a decision using the Multi Round-Trip Request pattern:

- **Inside a synchronous call:** return an `InputRequiredResult`
  (`resultType: "input_required"`) whose `inputRequests` contain one
  form-mode elicitation per pending proposal. `requestState` carries
  an opaque, server-signed encoding of `runId` and `proposalIds`. The
  client retries the call with `inputResponses`; the server records
  the decisions and resumes the step.
- **Inside a task:** set the task to `input_required` and include the
  same elicitation requests in `tasks/get`; the client answers with
  `tasks/update`.

Each elicitation presents the proposal's `summary`, `severity`,
`category`, `targets`, and a plain-text rendering of its `operations`,
and requests:

```json
{
  "type": "object",
  "properties": {
    "decision": { "type": "string", "enum": ["approve", "reject", "skip"] },
    "note": { "type": "string" }
  },
  "required": ["decision"]
}
```

Proposals with `autoApprove: true` on steps with
`awaitApproval: "auto"` are applied without an input request, exactly
as spec §22.2 already defines. The binding does not loosen that
policy.

### 4.2 Agent-initiated decisions

Elicitation is answered by the client, which normally means the human.
Some deployments (unattended batch QC, a trusted lab pipeline) want
the agent itself to approve routine fixes. A server MAY expose
`neuroflow_decide` (`runId`, `proposalId`, `decision`, `note`) for
that purpose, but:

- It MUST be disabled by default and enabled only by server
  configuration, never by a document or a tool argument.
- The server MUST advertise the setting as `agentApprovals` in its
  capability block, so a client can warn the user.
- Decisions made through it MUST be recorded with the MCP client as
  the deciding agent (§7), never as a person.

### 4.3 Clients without elicitation

If the client supports neither elicitation nor tasks and
`agentApprovals` is off, a step that requires approval cannot proceed
inside MCP. The server leaves the run paused, returns
`status: "awaiting-approval"` with the proposals, and the decision is
made in the NeuroFlow app or another operator surface.

## 5. Artifacts as resources

### 5.1 URI scheme

| URI | Content |
| --- | --- |
| `neuroflow://catalog/tools/{id}` | Tool document (`application/json`) |
| `neuroflow://catalog/workflows/{id}` | Workflow document |
| `neuroflow://schemas/0.1/{file}` | JSON Schema |
| `neuroflow://runs/{runId}/provenance` | Provenance document |
| `neuroflow://runs/{runId}/events` | Event log (`application/x-ndjson`) |
| `neuroflow://runs/{runId}/artifacts/{step}/{output}[/{index}]` | Artifact summary (§5.2) |
| `.../raw` | Artifact bytes, subject to the size cap |
| `.../rendition{?view,slice,overlay}` | Optional rendered image (§5.3) |

Document ids contain `/` and are percent-encoded in the URI. The
server publishes the run and artifact patterns as resource templates.

### 5.2 Summaries, not bytes

A 2 GB NIfTI must never land in a model's context. Reading an artifact
URI therefore returns a **summary** by default
(`application/vnd.neuroflow.artifact-summary+json`), and `.../raw`
returns bytes only when the artifact is under a server-configured cap
(default 1 MiB) or is a text type (`core:tabular`, `bids:sidecar`,
`neuro:report` HTML).

Servers SHOULD produce these summaries:

| Type | Summary |
| --- | --- |
| `neuro:volume`, `neuro:statmap`, `neuro:probseg`, `neuro:mask` | Dimensions, voxel size, datatype, orientation codes, intensity range; nonzero voxel count and volume in mL for masks |
| `neuro:label-map` | As above, plus label ids with voxel counts and volumes (and names when a lookup table is attached) |
| `neuro:bids-dataset`, `bids:derivatives-dataset` | Subjects, sessions, datatypes with file counts, `dataset_description` fields |
| `core:tabular` and `bids:*-table` | Column names, row count, first rows |
| `neuro:surface`, `neuro:tract` | Vertex and face counts, or streamline count and length range |
| `neuro:ome-zarr` | Multiscale levels with shapes and scales |

Summaries are often enough to answer the scientific question outright
("hippocampal volumes per subject") and to sanity-check a step before
running the next one.

### 5.3 Renditions

A server MAY offer `.../rendition` for spatial artifacts, returning
`image/png`. Parameters: `view` (`axial`, `coronal`, `sagittal`,
`multiplanar`, `render`), `slice` (index or `center`), and `overlay`
(another artifact URI drawn over the base, for example a mask over its
T1). A NiiVue-based headless renderer is the reference
implementation.

Renditions let an agent do visual QC, such as checking whether a
skull strip removed cortex or a registration is misaligned, which
summaries alone cannot catch. Servers advertise the capability as
`renditions` in the capability block.

### 5.4 Inputs from outside the runtime

MCP `2026-07-28` deprecates Roots and recommends passing directories
through tool parameters or server configuration. Accordingly:

- The server's **allowed data roots** are set in server configuration.
- An `artifactRef` argument that is a filesystem path MUST resolve
  (after symlink resolution) inside an allowed root; otherwise the
  call fails before any step launches.
- `neuroflow://` URIs from earlier runs are always accepted while the
  run is retained.

## 6. Interactive tools as MCP Apps

### 6.1 Motivation

`uiApp` tools (BIDSvue, NeuroVue, a QA page) and standalone browser
tools currently need a native launcher and the file-based session
contract (`context.json`, `$NEUROFLOW_OUTPUT_DIR`). MCP Apps lets the
same HTML render directly inside an MCP host, receive its inputs over
`postMessage`, and call back into the server. That is the shared glue
the browser-tool ecosystem lacks.

### 6.2 Exposing an app

A tool opts in by declaring an app in its extension block:

```json
{
  "extensions": {
    "neuroflow/mcp": {
      "app": {
        "resourceUri": "ui://neurovue/review",
        "connectDomains": ["http://127.0.0.1:7878"],
        "requiredOutputs": ["correction_patch"]
      }
    }
  }
}
```

The server exposes the tool with `_meta.ui.resourceUri` set to the
declared URI and serves the app bundle as a `text/html;profile=mcp-app`
resource. When a host that supports MCP Apps calls the tool, the step
enters `input_required` (§3.2) until the app submits its required
outputs or the user closes it.

### 6.3 Session contract equivalence

The MCP App path is the browser-native form of the existing session
contract:

| File-based session contract | MCP App |
| --- | --- |
| `context.json` `inputs` | `ui/notifications/tool-input` arguments (resolved artifact URIs) |
| Reading input files | `neuroflow_read_artifact` (app-only tool) or HTTP range requests to a `connectDomains` artifact endpoint |
| Writing into `$NEUROFLOW_OUTPUT_DIR` | `neuroflow_submit_outputs` (app-only tool) |
| Appending to `provenance.jsonl` | `provenance` lines included in `neuroflow_submit_outputs` |
| App close | Host closes the app view; step completes if required outputs are present, fails otherwise |

`neuroflow_read_artifact` and `neuroflow_submit_outputs` are declared
with `_meta.ui.visibility: ["app"]`, so the app can call them and the
model cannot.

For volumes, the runtime SHOULD serve artifacts over a loopback HTTP
endpoint that supports range requests and list it in
`connectDomains`. That lets NiiVue's chunked and tiled loading stream
large volumes and OME-Zarr pyramids into the app instead of pushing
whole files through `postMessage`.

### 6.4 Wrapping an existing web app

An existing browser tool joins a NeuroFlow pipeline with:

1. A tool document declaring its typed inputs and outputs.
2. A thin adapter in the page that listens for `tool-input`, loads the
   referenced artifacts, and calls `neuroflow_submit_outputs` when the
   user finishes (or immediately, for a headless in-browser tool).
3. A `neuroflow/mcp.app` block pointing at the page.

No change to the tool's processing code is required.

### 6.5 Hosts without MCP Apps

If the client does not support `io.modelcontextprotocol/ui`, the
server falls back to the tool's native `neuroflow/launch` contract
when the runtime is local, and otherwise returns an error stating that
the step needs an interactive host.

## 7. Provenance

- The MCP client is recorded as a `software` agent in the provenance
  document, from `io.modelcontextprotocol/clientInfo` (name and
  version). The run's top-level activity references it.
- A decision made through elicitation is recorded with
  `agent` set to an operator agent whose `name` is
  `"operator via <client name>"`. The server cannot verify that a
  human answered, and provenance MUST NOT claim more than it knows.
- A decision made through `neuroflow_decide` is recorded with the MCP
  client as the deciding agent.
- Each activity MAY carry the MCP request id and, where present, the
  OpenTelemetry `traceparent` from `_meta`, so an agent transcript can
  be joined to the provenance record.

## 8. Security

- **Allowlist only.** Only tools in the resolved registry run, only
  through their declared launch contracts. No binding tool accepts a
  command, script, or shell string.
- **Path confinement** as in §5.4.
- **Untrusted arguments.** Tool arguments come from a model and MUST be
  treated like event payloads (spec §21.8): validated against the
  generated schema, never interpreted as code.
- **Human approval by default** (§4).
- **Network transports.** A Streamable HTTP deployment MUST use MCP
  authorization; a loopback artifact endpoint (§6.3) MUST bind to
  loopback and require a per-run token.
- **Data protection.** Artifact summaries and renditions of human
  imaging data enter the model's context. Deployments handling
  identifiable data SHOULD disable `path` disclosure and renditions,
  and SHOULD run only de-identified data through remote models.

## 9. The `neuroflow/mcp` extension namespace

Allowed on tool and workflow documents:

| Field | Type | Meaning |
| --- | --- | --- |
| `expose` | boolean | Expose as an MCP tool. Default `true`, except `uiApp` tools without an `app` block, which default to `false`. |
| `name` | string | Override the derived tool name (§1.1). |
| `title` | string | Override the display title. |
| `annotations` | object | `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`. |
| `maxWaitMs` | integer | How long a non-task call waits before returning a `runId` (§3.3). |
| `valueTypes` | array of strings | Extension types this tool treats as value types (§1.3). |
| `app` | object | MCP App declaration (§6.2): `resourceUri`, `connectDomains`, `resourceDomains`, `requiredOutputs`. |

Example, on the gallery's Python filter tool:

```json
{
  "extensions": {
    "neuroflow/mcp": {
      "title": "Filter volumes (smooth, threshold, z-score)",
      "annotations": { "idempotentHint": true },
      "maxWaitMs": 60000
    }
  }
}
```

The namespace is registered as `provisional` in
`schemas/0.1/extensions/registry.json` with schema
`neuroflow-mcp.schema.json`.

## 10. Static validation

A validator that is extension-aware for `neuroflow/mcp` MUST check:

- `name`, when present, matches `^[A-Za-z0-9_.-]{1,64}$` and does not
  begin with `neuroflow_`.
- Across a registry, no two exposed documents resolve to the same
  name.
- `app.resourceUri` uses the `ui://` scheme.
- `app.requiredOutputs[]` names declared outputs of the tool.
- `valueTypes[]` entries are extension types, not `core:`, `neuro:`,
  `bids:`, or `prov:` types.

## Example session (informative)

An agent is asked: "Skull-strip this T1, segment it, and tell me the
hippocampal volumes."

1. `neuroflow_list` with `acceptsType: "neuro:volume"` returns a
   skull-strip tool and a segmentation tool; the second's output is a
   `neuro:label-map`.
2. The agent writes a two-step workflow and calls `neuroflow_validate`.
   The diagnostic reports that the strip tool's output is
   `brain_volume`, not `brain`. The agent fixes the reference and the
   document validates.
3. `neuroflow_run` returns a task. Progress notifications stream per
   step.
4. The agent reads the strip output's `.../rendition?view=multiplanar`
   and sees the mask is intact.
5. The run completes. Reading the label-map artifact summary gives
   label volumes; the agent reports left and right hippocampus in mL
   and links the provenance resource.

No step ran code the agent wrote, every artifact is traceable, and the
user could open the same workflow in the NeuroFlow designer.

## What this RFC does not specify

- **A web launch contract outside MCP.** Launching a browser tool from
  the NeuroFlow desktop app without an MCP host (URL parameters,
  `postMessage` from a parent window) is left to a follow-up RFC. §6
  is designed so that contract can reuse the same adapter.
- **Scheduling and resources.** Queueing, GPU allocation, and HPC
  submission are runtime concerns.
- **Model choice or agent behavior.** The binding is agnostic about
  which agent or model is on the other side.
- **Remote execution of browser tools without a host.** Headless
  execution of in-browser tools on a server is out of scope.

## Alternatives considered

- **One generic `run_tool(id, inputs)` MCP tool.** Rejected: the model
  loses per-tool schemas, descriptions, and enums, which are what make
  tool selection and argument filling reliable. Generated per-tool
  entries cost little, and the catalog tool covers discovery when the
  registry is large.
- **Expose only workflows, not individual tools.** Rejected: agents
  compose. Exposing tools lets an agent run one step to inspect a
  result before committing to a pipeline.
- **Let agents submit tool documents.** Rejected: a tool document
  carries a launch contract, which is effectively code execution. Agents
  may submit workflows (compositions of vetted tools), never tools.
- **Return artifact bytes as embedded resources.** Rejected for all
  but small text artifacts; see §5.2.
- **Put MCP fields in the core schemas.** Rejected: the core stays
  protocol-neutral, per spec §4 and the non-goals in the README.

## Open issues

- Final MCP extension identifier (`com.niivue/neuroflow` is a
  placeholder pending where the spec is hosted).
- Whether the artifact / value classification (§1.3) belongs in the
  core type vocabulary as a type property, since RFC 0008 already
  depends on a similar distinction.
- Tool-name length: 64 characters is a conservative limit for current
  clients. Relax once clients accept longer names.
- Registries with hundreds of tools: whether to expose only workflows
  and a curated tool subset by default, relying on `neuroflow_list`
  for the rest, to keep the tool list within model context budgets.
- A standard summary schema per artifact type (§5.2), shared with the
  NeuroFlow app's inspector panel.
- Whether renditions (§5.3) should be standardized as a separate
  NiiVue extension so non-NeuroFlow MCP servers can reuse them.
- Behavior when the MCP host and the runtime are on different machines
  and `connectDomains` loopback streaming (§6.3) is unavailable.

## Compatibility with earlier MCP versions (informative)

- `2025-11-25` and earlier: use the `initialize` handshake for
  capability exchange; send approvals through `elicitation/create`
  instead of `InputRequiredResult`; use the experimental core tasks
  (`tasks/result`) if the client advertises them, otherwise the
  `runId` fallback in §3.3.
- Before `2025-06-18`: no `structuredContent`, `outputSchema`, or
  `resource_link`. Servers SHOULD return the text summary and embed the
  §1.4 JSON as a second text block.
