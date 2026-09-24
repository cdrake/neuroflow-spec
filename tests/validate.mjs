// NeuroFlow 0.1 conformance harness.
//
// Validates every example document against the normalized NeuroFlow schemas,
// and confirms that the documents under examples/invalid/ are rejected.
//
// Run with: npm test

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const schemaDir = join(root, 'schemas', '0.1')

const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)

// Register every schema file by its $id so cross-file $refs resolve.
const schemaFiles = [
  'common.schema.json',
  'events.schema.json',
  'workflow.schema.json',
  'tool.schema.json',
  'heuristic.schema.json',
  'provenance.schema.json',
  'extensions/niivue-ui.schema.json',
  'extensions/niivue-runtime.schema.json',
  'extensions/bids-profile.schema.json',
  'extensions/neurovue.schema.json',
  'extensions/registry.schema.json'
]
for (const rel of schemaFiles) {
  const schema = JSON.parse(readFileSync(join(schemaDir, rel), 'utf8'))
  ajv.addSchema(schema)
}

const base = 'https://niivue.github.io/neuroflow-spec/schemas/0.1/'
const validators = {
  workflow: ajv.getSchema(base + 'workflow.schema.json'),
  tool: ajv.getSchema(base + 'tool.schema.json'),
  heuristic: ajv.getSchema(base + 'heuristic.schema.json'),
  provenance: ajv.getSchema(base + 'provenance.schema.json')
}

let failures = 0
const report = (ok, label, detail) => {
  if (ok) {
    console.log(`  ok    ${label}`)
  } else {
    failures++
    console.log(`  FAIL  ${label}`)
    if (detail) console.log(`        ${detail}`)
  }
}

// Pick a validator from a document's `kind` field.
const validatorFor = (doc) => validators[doc && doc.kind]

console.log('Valid examples (expect pass):')
const examplesDir = join(root, 'examples')
for (const name of readdirSync(examplesDir)) {
  if (!name.endsWith('.json')) continue
  const doc = JSON.parse(readFileSync(join(examplesDir, name), 'utf8'))
  const validate = validatorFor(doc)
  if (!validate) {
    report(false, name, `unknown or missing kind: ${doc.kind}`)
    continue
  }
  const ok = validate(doc)
  report(ok, name, ok ? '' : ajv.errorsText(validate.errors, { separator: '\n        ' }))
}

console.log('\nInvalid examples (expect rejection):')
const invalidDir = join(examplesDir, 'invalid')
if (existsSync(invalidDir)) {
  for (const name of readdirSync(invalidDir)) {
    if (!name.endsWith('.json')) continue
    const doc = JSON.parse(readFileSync(join(invalidDir, name), 'utf8'))
    const validate = validatorFor(doc) || validators.workflow
    const ok = validate(doc)
    // A correct outcome here is rejection.
    report(!ok, name, ok ? 'document was accepted but should have been rejected' : '')
  }
}

console.log('\nExtension registry:')
const extDir = join(schemaDir, 'extensions')
const registryPath = join(extDir, 'registry.json')
if (existsSync(registryPath)) {
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
  const validateRegistry = ajv.getSchema(base + 'extensions/registry.schema.json')
  const ok = validateRegistry(registry)
  report(ok, 'registry.json conforms to registry.schema.json',
    ok ? '' : ajv.errorsText(validateRegistry.errors, { separator: '\n        ' }))
  for (const entry of registry.extensions ?? []) {
    const schemaPath = join(extDir, entry.schema)
    const present = existsSync(schemaPath)
    report(present, `${entry.namespace} -> ${entry.schema} exists`,
      present ? '' : `referenced schema file is missing: ${entry.schema}`)
    if (present) {
      try {
        JSON.parse(readFileSync(schemaPath, 'utf8'))
        report(true, `${entry.schema} parses`)
      } catch (err) {
        report(false, `${entry.schema} parses`, String(err))
      }
    }
  }
} else {
  report(false, 'extensions/registry.json present', 'registry.json not found')
}

console.log('')
if (failures > 0) {
  console.error(`${failures} check(s) failed.`)
  process.exit(1)
}
console.log('All NeuroFlow conformance checks passed.')
