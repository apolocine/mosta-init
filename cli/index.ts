#!/usr/bin/env node
// @mostajs/init — CLI entry point
// Author: Dr Hamid MADANI drmdh@msn.com
//
// Usage:
//   npx @mostajs/init                     # Report only (default)
//   npx @mostajs/init --json              # Output JSON report
//   npx @mostajs/init --generate          # Generate code (registry, DAL, route stubs)
//   npx @mostajs/init --install           # Install missing modules
//   npx @mostajs/init --reverse-engineer  # Reverse engineer DB schemas via @mostajs/orm
//   npx @mostajs/init --crud <Entity>     # Generate CRUD pages for an entity

import { discoverModules } from '../lib/discover.js'
import { generateReport, renderReportMarkdown, renderReportJSON } from '../lib/reporter.js'
import { applyCodegen } from '../lib/codegen.js'
import { reverseEngineerFromModules } from '../lib/reverse-engineer.js'
import { entityToCrudConfig, generateCrud } from '../lib/crud-generator.js'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const execAsync = promisify(exec)

const args = process.argv.slice(2)
const projectRoot = process.cwd()

const FLAG_JSON = args.includes('--json')
const FLAG_GENERATE = args.includes('--generate')
const FLAG_INSTALL = args.includes('--install')
const FLAG_REVERSE = args.includes('--reverse-engineer')
const FLAG_HELP = args.includes('--help') || args.includes('-h')
const FLAG_CRUD = args.includes('--crud')
const CRUD_ENTITY = FLAG_CRUD ? args[args.indexOf('--crud') + 1] : null

async function main() {
  if (FLAG_HELP) {
    console.log(`
@mostajs/init — Discover, analyze, scaffold, and reverse-engineer @mostajs modules

Usage:
  npx @mostajs/init                          Show configuration report (Markdown)
  npx @mostajs/init --json                   Show configuration report (JSON)
  npx @mostajs/init --generate               Generate code (registry, DAL service, route stubs)
  npx @mostajs/init --install                Install all available @mostajs modules
  npx @mostajs/init --reverse-engineer       Reverse engineer schemas from @mostajs/orm DB
  npx @mostajs/init --crud <EntityName>      Generate CRUD pages + API for an entity
  npx @mostajs/init --help                   Show this help message

Options can be combined:
  npx @mostajs/init --install --generate
  npx @mostajs/init --reverse-engineer --crud Client

Visual designers (React components):
  import SchemaDesigner from '@mostajs/init/components/SchemaDesigner'
  import PageDesigner from '@mostajs/init/components/PageDesigner'
`)
    process.exit(0)
  }

  // ── Reverse engineer from DB via @mostajs/orm ──
  if (FLAG_REVERSE) {
    console.log('Reverse engineering database schemas via @mostajs/orm...\n')
    await reverseEngineerFromOrm(projectRoot)
    if (!FLAG_CRUD) return
  }

  // ── CRUD generator ──
  if (FLAG_CRUD) {
    if (!CRUD_ENTITY) {
      console.error('Usage: npx @mostajs/init --crud <EntityName>')
      process.exit(1)
    }
    await generateCrudForEntity(projectRoot, CRUD_ENTITY)
    return
  }

  // ── Standard discovery + report ──
  console.log('Discovering @mostajs modules...')
  const modules = await discoverModules(projectRoot)
  const report = generateReport(projectRoot, modules)

  const installed = report.installed.length
  const available = report.available.length
  console.log(`Found ${modules.length} modules (${installed} installed, ${available} available)\n`)

  // Install missing modules
  if (FLAG_INSTALL && report.available.length > 0) {
    const names = report.available.map((m) => m.name).join(' ')
    console.log(`Installing: ${names}`)
    try {
      const { stdout } = await execAsync(`npm install ${names} --save`, {
        cwd: projectRoot,
        timeout: 120_000,
      })
      console.log(stdout)
      const updatedModules = await discoverModules(projectRoot)
      const updatedReport = generateReport(projectRoot, updatedModules)
      if (FLAG_JSON) console.log(renderReportJSON(updatedReport))
      else console.log(renderReportMarkdown(updatedReport))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Install failed: ${msg}`)
      process.exit(1)
    }
    if (!FLAG_GENERATE) return
  }

  // Generate code
  if (FLAG_GENERATE) {
    console.log('Generating code...\n')
    const { written, skipped } = applyCodegen(report.installed, { projectRoot })
    if (written.length > 0) {
      console.log('Created:')
      for (const f of written) console.log(`  + ${f}`)
    }
    if (skipped.length > 0) {
      console.log('\nSkipped:')
      for (const f of skipped) console.log(`  ~ ${f}`)
    }
    if (written.length === 0 && skipped.length === 0) console.log('Nothing to generate.')
    console.log('')
    return
  }

  // Default: print report
  if (FLAG_JSON) console.log(renderReportJSON(report))
  else console.log(renderReportMarkdown(report))
}

// ── Reverse engineer via @mostajs/orm dialect ────────────────

async function reverseEngineerFromOrm(projectRoot: string) {
  // Load @mostajs/orm dynamically
  let orm: any
  try {
    const ormPkg = '@mostajs/orm'
    orm = await import(ormPkg)
  } catch {
    console.error('@mostajs/orm not found. Install it first: npm install @mostajs/orm')
    process.exit(1)
  }

  // Load .env.local for DB config
  const envPath = path.join(projectRoot, '.env.local')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([A-Z_]+)=(.+)$/)
      if (match) process.env[match[1]] = match[2]
    }
  }

  // Load project schemas (registry side-effect)
  const registryPath = path.join(projectRoot, 'src', 'dal', 'registry.ts')
  const registryJsPath = path.join(projectRoot, '.next', 'server', 'dal', 'registry.js')

  // Try to get the dialect and introspect
  try {
    const dialect = await orm.getDialect()

    // Get registered schemas
    const schemas = orm.getRegisteredSchemas?.() || []
    if (schemas.length > 0) {
      console.log(`Found ${schemas.length} registered schemas:\n`)
      for (const schema of schemas) {
        const fieldCount = Object.keys(schema.fields || {}).length
        const relCount = Object.keys(schema.relations || {}).length
        console.log(`  ${schema.name} (${schema.collection}) — ${fieldCount} fields, ${relCount} relations`)
      }
      console.log('')

      // Generate schema code
      const code = generateSchemaCodeFromORM(schemas)
      const outPath = path.join(projectRoot, 'generated-schemas.ts')
      fs.writeFileSync(outPath, code, 'utf-8')
      console.log(`Schema code written to: ${outPath}`)
    } else {
      // Fallback: scan installed modules for schema definitions
      console.log('No registered schemas found. Scanning installed modules...\n')
      const entities = reverseEngineerFromModules(projectRoot)
      if (entities.length > 0) {
        console.log(`Found ${entities.length} entities in installed modules:`)
        for (const e of entities) {
          console.log(`  ${e.name} (${e.collection})`)
        }
      } else {
        console.log('No entities found.')
      }
    }
  } catch (err: unknown) {
    // If ORM can't connect, fall back to module scanning
    console.log('Could not connect to database. Scanning installed modules instead...\n')
    const entities = reverseEngineerFromModules(projectRoot)
    if (entities.length > 0) {
      console.log(`Found ${entities.length} entities in installed modules:`)
      for (const e of entities) {
        console.log(`  ${e.name} (${e.collection})`)
      }
    } else {
      console.log('No entities found in installed modules.')
    }
  }
}

function generateSchemaCodeFromORM(schemas: any[]): string {
  const lines: string[] = [
    "// Generated by @mostajs/init --reverse-engineer",
    "// Source: @mostajs/orm registered schemas",
    "import type { EntitySchema } from '@mostajs/orm';",
    '',
  ]

  for (const schema of schemas) {
    lines.push(`export const ${schema.name}Schema: EntitySchema = ${JSON.stringify(schema, null, 2)};`)
    lines.push('')
  }

  return lines.join('\n')
}

// ── CRUD generator from EntitySchema ─────────────────────────

async function generateCrudForEntity(projectRoot: string, entityName: string) {
  console.log(`Generating CRUD for entity: ${entityName}\n`)

  // Try to find the schema in installed modules
  const nmBase = path.join(projectRoot, 'node_modules', '@mostajs')
  let schema: any = null

  if (fs.existsSync(nmBase)) {
    const moduleDirs = fs.readdirSync(nmBase, { withFileTypes: true })
    for (const dir of moduleDirs) {
      if (!dir.isDirectory()) continue
      const distDir = path.join(nmBase, dir.name, 'dist')
      if (!fs.existsSync(distDir)) continue

      // Try to import the module and find the schema
      try {
        const mod = await import(`@mostajs/${dir.name}`)
        const schemaKey = `${entityName}Schema`
        if (mod[schemaKey]) {
          schema = mod[schemaKey]
          console.log(`Found ${schemaKey} in @mostajs/${dir.name}`)
          break
        }
      } catch {
        // not every module exports schemas
      }
    }
  }

  if (!schema) {
    // Create a minimal placeholder schema
    console.log(`Schema not found for ${entityName}. Generating with default fields.`)
    schema = {
      name: entityName,
      collection: entityName.toLowerCase() + 's',
      timestamps: true,
      fields: {
        name: { type: 'string', required: true },
        status: { type: 'string', enum: ['active', 'inactive'], default: 'active' },
      },
      relations: {},
    }
  }

  const config = entityToCrudConfig(schema)
  const crud = generateCrud(config)

  // Write files
  const files = [crud.listPage, crud.formPage, crud.apiRoute, crud.apiIdRoute]
  for (const file of files) {
    const fullPath = path.join(projectRoot, file.path)
    if (fs.existsSync(fullPath)) {
      console.log(`  ~ ${file.path} (already exists, skipped)`)
      continue
    }
    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(fullPath, file.code, 'utf-8')
    console.log(`  + ${file.path}`)
  }

  console.log('\nDone! Files generated.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
