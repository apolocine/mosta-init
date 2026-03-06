// @mostajs/init — Database reverse engineering
// Author: Dr Hamid MADANI drmdh@msn.com
//
// Introspects an existing database and generates @mostajs/orm EntitySchema definitions.
// Supports MongoDB (via collection inspection) and SQL (via information_schema).

import fs from 'fs'
import path from 'path'

// ── Types ────────────────────────────────────────────────────

type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'json' | 'array'
type RelationType = 'one-to-one' | 'many-to-one' | 'one-to-many' | 'many-to-many'

interface IntrospectedField {
  name: string
  type: FieldType
  required: boolean
  unique: boolean
  enum?: string[]
  default?: unknown
}

interface IntrospectedRelation {
  name: string
  target: string
  type: RelationType
  required: boolean
  nullable: boolean
}

interface IntrospectedIndex {
  fields: { name: string; direction: 'asc' | 'desc' }[]
  unique: boolean
}

interface IntrospectedEntity {
  name: string
  collection: string
  fields: IntrospectedField[]
  relations: IntrospectedRelation[]
  indexes: IntrospectedIndex[]
  timestamps: boolean
}

export interface ReverseEngineerResult {
  entities: IntrospectedEntity[]
  code: string
  warnings: string[]
}

// ── MongoDB Reverse Engineering ──────────────────────────────

/**
 * Introspect a MongoDB database.
 * Pass the native MongoDB client `db` object (from `MongoClient.db()`).
 */
export async function reverseEngineerMongo(db: any): Promise<ReverseEngineerResult> {
  const warnings: string[] = []
  const entities: IntrospectedEntity[] = []

  const collections = await db.listCollections().toArray()

  for (const col of collections) {
    const collName = col.name
    // Skip system collections
    if (collName.startsWith('system.')) continue

    const collection = db.collection(collName)
    const entityName = collectionToEntityName(collName)

    // Sample documents to infer schema
    const samples = await collection.find({}).limit(100).toArray()
    if (samples.length === 0) {
      warnings.push(`Collection '${collName}' is empty — skipped`)
      continue
    }

    // Aggregate field info from samples
    const fieldMap = new Map<string, { types: Set<string>; count: number; values: Set<unknown> }>()
    let hasCreatedAt = false
    let hasUpdatedAt = false

    for (const doc of samples) {
      for (const [key, value] of Object.entries(doc)) {
        if (key === '_id') continue
        if (key === '__v') continue
        if (key === 'createdAt') { hasCreatedAt = true; continue }
        if (key === 'updatedAt') { hasUpdatedAt = true; continue }

        if (!fieldMap.has(key)) fieldMap.set(key, { types: new Set(), count: 0, values: new Set() })
        const info = fieldMap.get(key)!
        info.count++
        info.types.add(inferMongoType(value))
        if (info.values.size < 50 && typeof value === 'string') info.values.add(value)
      }
    }

    const fields: IntrospectedField[] = []
    const relations: IntrospectedRelation[] = []

    for (const [name, info] of fieldMap) {
      // Detect ObjectId references → relation
      if (info.types.has('objectId')) {
        const targetName = name.replace(/Id$/, '').replace(/^(.)/,  (_, c) => c.toUpperCase())
        relations.push({
          name,
          target: targetName,
          type: 'many-to-one',
          required: info.count === samples.length,
          nullable: info.count < samples.length,
        })
        continue
      }

      const type = resolveFieldType(info.types)
      const field: IntrospectedField = {
        name,
        type,
        required: info.count === samples.length,
        unique: false, // can't infer from data alone
      }

      // Detect enum patterns (few distinct string values)
      if (type === 'string' && info.values.size > 0 && info.values.size <= 10 && info.values.size < samples.length / 2) {
        field.enum = Array.from(info.values) as string[]
      }

      fields.push(field)
    }

    // Introspect indexes
    const indexes: IntrospectedIndex[] = []
    try {
      const indexList = await collection.indexes()
      for (const idx of indexList) {
        if (idx.name === '_id_') continue
        const idxFields = Object.entries(idx.key).map(([name, dir]) => ({
          name,
          direction: (dir === 1 ? 'asc' : 'desc') as 'asc' | 'desc',
        }))
        indexes.push({ fields: idxFields, unique: !!idx.unique })

        // Mark unique fields
        if (idx.unique && idxFields.length === 1) {
          const f = fields.find((f) => f.name === idxFields[0].name)
          if (f) f.unique = true
        }
      }
    } catch {
      warnings.push(`Could not read indexes for '${collName}'`)
    }

    entities.push({
      name: entityName,
      collection: collName,
      fields,
      relations,
      indexes,
      timestamps: hasCreatedAt && hasUpdatedAt,
    })
  }

  const code = generateSchemaCode(entities)
  return { entities, code, warnings }
}

// ── SQL Reverse Engineering ──────────────────────────────────

/**
 * Introspect a SQL database via information_schema.
 * Pass a query function: (sql: string) => Promise<any[]>
 * Works with Postgres, MySQL, MariaDB, MSSQL, CockroachDB.
 */
export async function reverseEngineerSQL(
  query: (sql: string) => Promise<any[]>,
  schema: string = 'public',
): Promise<ReverseEngineerResult> {
  const warnings: string[] = []
  const entities: IntrospectedEntity[] = []

  // Get all tables
  const tables: { table_name: string }[] = await query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' AND table_type = 'BASE TABLE' ORDER BY table_name`
  )

  for (const { table_name } of tables) {
    const entityName = collectionToEntityName(table_name)

    // Get columns
    const columns: any[] = await query(
      `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
       FROM information_schema.columns
       WHERE table_schema = '${schema}' AND table_name = '${table_name}'
       ORDER BY ordinal_position`
    )

    const fields: IntrospectedField[] = []
    const relations: IntrospectedRelation[] = []
    let hasCreatedAt = false
    let hasUpdatedAt = false

    for (const col of columns) {
      const name = col.column_name
      if (name === 'id' || name === '_id') continue
      if (name === 'created_at' || name === 'createdAt') { hasCreatedAt = true; continue }
      if (name === 'updated_at' || name === 'updatedAt') { hasUpdatedAt = true; continue }

      const type = sqlTypeToFieldType(col.data_type)
      fields.push({
        name: snakeToCamel(name),
        type,
        required: col.is_nullable === 'NO',
        unique: false,
      })
    }

    // Get foreign keys → relations
    try {
      const fks: any[] = await query(
        `SELECT kcu.column_name, ccu.table_name AS foreign_table_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
         JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
         WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = '${schema}' AND tc.table_name = '${table_name}'`
      )
      for (const fk of fks) {
        const relName = snakeToCamel(fk.column_name.replace(/_id$/, ''))
        relations.push({
          name: relName,
          target: collectionToEntityName(fk.foreign_table_name),
          type: 'many-to-one',
          required: true,
          nullable: false,
        })
        // Remove the FK field from fields list (it's covered by the relation)
        const fkField = snakeToCamel(fk.column_name)
        const idx = fields.findIndex((f) => f.name === fkField)
        if (idx >= 0) fields.splice(idx, 1)
      }
    } catch {
      warnings.push(`Could not read foreign keys for '${table_name}'`)
    }

    // Get unique constraints
    try {
      const uniques: any[] = await query(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
         WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = '${schema}' AND tc.table_name = '${table_name}'`
      )
      for (const u of uniques) {
        const f = fields.find((f) => f.name === snakeToCamel(u.column_name))
        if (f) f.unique = true
      }
    } catch {
      // ignore
    }

    // Get indexes
    const indexes: IntrospectedIndex[] = []
    // Note: index introspection varies by DBMS, skip for portability

    entities.push({
      name: entityName,
      collection: table_name,
      fields,
      relations,
      indexes,
      timestamps: hasCreatedAt && hasUpdatedAt,
    })
  }

  const code = generateSchemaCode(entities)
  return { entities, code, warnings }
}

// ── Reverse engineer from installed @mostajs modules ─────────

/**
 * Read all EntitySchema definitions from installed @mostajs modules
 * by scanning their dist/ .d.ts files for exported *Schema constants.
 * Returns them as IntrospectedEntity for the Schema Designer.
 */
export function reverseEngineerFromModules(projectRoot: string): IntrospectedEntity[] {
  const nmBase = path.join(projectRoot, 'node_modules', '@mostajs')
  const entities: IntrospectedEntity[] = []

  if (!fs.existsSync(nmBase)) return entities

  const moduleDirs = fs.readdirSync(nmBase, { withFileTypes: true })
  for (const dir of moduleDirs) {
    if (!dir.isDirectory()) continue
    const distDir = path.join(nmBase, dir.name, 'dist')
    if (!fs.existsSync(distDir)) continue

    // Look for schema files
    const schemaFiles = findFiles(distDir, '.js', 3)
      .filter((f) => f.includes('schema') && !f.includes('.map'))

    for (const schemaFile of schemaFiles) {
      try {
        const content = fs.readFileSync(schemaFile, 'utf-8')
        // Quick parse: find EntitySchema object literals
        const schemaMatches = content.matchAll(/export\s+const\s+(\w+Schema)\s*=\s*\{/g)
        for (const match of schemaMatches) {
          // Can't fully parse JS, but extract name/collection from the file
          const nameMatch = content.match(new RegExp(`${match[1]}[\\s\\S]*?name:\\s*['"]([^'"]+)['"]`))
          const collMatch = content.match(new RegExp(`${match[1]}[\\s\\S]*?collection:\\s*['"]([^'"]+)['"]`))
          if (nameMatch && collMatch) {
            entities.push({
              name: nameMatch[1],
              collection: collMatch[1],
              fields: [],
              relations: [],
              indexes: [],
              timestamps: true,
            })
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  return entities
}

// ── Helpers ──────────────────────────────────────────────────

function inferMongoType(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (value instanceof Date) return 'date'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') {
    const obj = value as any
    // Detect ObjectId
    if (obj._bsontype === 'ObjectId' || obj.constructor?.name === 'ObjectId') return 'objectId'
    if (obj instanceof Date) return 'date'
    return 'json'
  }
  return 'string'
}

function resolveFieldType(types: Set<string>): FieldType {
  types.delete('null')
  if (types.size === 0) return 'string'
  if (types.has('objectId')) return 'string' // handled as relation
  if (types.has('date')) return 'date'
  if (types.has('number')) return 'number'
  if (types.has('boolean')) return 'boolean'
  if (types.has('array')) return 'array'
  if (types.has('json')) return 'json'
  return 'string'
}

function sqlTypeToFieldType(sqlType: string): FieldType {
  const t = sqlType.toLowerCase()
  if (['integer', 'int', 'bigint', 'smallint', 'numeric', 'decimal', 'real', 'double', 'float'].some((s) => t.includes(s))) return 'number'
  if (t.includes('bool')) return 'boolean'
  if (['timestamp', 'date', 'time'].some((s) => t.includes(s))) return 'date'
  if (['json', 'jsonb'].some((s) => t.includes(s))) return 'json'
  if (t.includes('array') || t === 'text[]') return 'array'
  return 'string'
}

function collectionToEntityName(collection: string): string {
  return collection
    .replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    .replace(/^([a-z])/, (_, c) => c.toUpperCase())
    .replace(/s$/, '')
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function findFiles(dir: string, ext: string, maxDepth: number, depth = 0): string[] {
  if (depth > maxDepth) return []
  const results: string[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) results.push(...findFiles(full, ext, maxDepth, depth + 1))
      else if (entry.name.endsWith(ext)) results.push(full)
    }
  } catch { /* */ }
  return results
}

// ── Code Generation ──────────────────────────────────────────

function generateSchemaCode(entities: IntrospectedEntity[]): string {
  const lines: string[] = [
    "// Generated by @mostajs/init — Reverse engineered from database",
    "import type { EntitySchema } from '@mostajs/orm';",
    '',
  ]

  for (const entity of entities) {
    lines.push(`export const ${entity.name}Schema: EntitySchema = {`)
    lines.push(`  name: '${entity.name}',`)
    lines.push(`  collection: '${entity.collection}',`)
    lines.push(`  timestamps: ${entity.timestamps},`)
    lines.push('')

    lines.push('  fields: {')
    for (const f of entity.fields) {
      const parts: string[] = [`type: '${f.type}'`]
      if (f.required) parts.push('required: true')
      if (f.unique) parts.push('unique: true')
      if (f.enum) parts.push(`enum: [${f.enum.map((v) => `'${v}'`).join(', ')}]`)
      if (f.default !== undefined) {
        const val = typeof f.default === 'string' ? `'${f.default}'` : String(f.default)
        parts.push(`default: ${val}`)
      }
      lines.push(`    ${f.name}: { ${parts.join(', ')} },`)
    }
    lines.push('  },')
    lines.push('')

    lines.push('  relations: {')
    for (const r of entity.relations) {
      const parts: string[] = [`target: '${r.target}'`, `type: '${r.type}'`]
      if (r.nullable) parts.push('nullable: true')
      lines.push(`    ${r.name}: { ${parts.join(', ')} },`)
    }
    lines.push('  },')
    lines.push('')

    lines.push('  indexes: [')
    for (const idx of entity.indexes) {
      const fieldsStr = idx.fields.map((f) => `${f.name}: '${f.direction}'`).join(', ')
      lines.push(`    { fields: { ${fieldsStr} }${idx.unique ? ', unique: true' : ''} },`)
    }
    lines.push('  ],')
    lines.push('};')
    lines.push('')
  }

  return lines.join('\n')
}
