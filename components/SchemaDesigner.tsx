// @mostajs/init — Schema Designer (visual EntitySchema builder)
// Author: Dr Hamid MADANI drmdh@msn.com
'use client'

import { useState, useCallback } from 'react'

// ── Types matching @mostajs/orm EntitySchema ──────────────────

type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'json' | 'array'
type RelationType = 'one-to-one' | 'many-to-one' | 'one-to-many' | 'many-to-many'
type IndexType = 'asc' | 'desc' | 'text'

interface FieldDef {
  name: string
  type: FieldType
  required: boolean
  unique: boolean
  default?: string
  enum?: string
}

interface RelationDef {
  name: string
  target: string
  type: RelationType
  required: boolean
  nullable: boolean
}

interface IndexDef {
  fields: { name: string; direction: IndexType }[]
  unique: boolean
}

interface EntityDef {
  id: string
  name: string
  collection: string
  timestamps: boolean
  fields: FieldDef[]
  relations: RelationDef[]
  indexes: IndexDef[]
  // Visual position
  x: number
  y: number
}

export interface SchemaDesignerProps {
  /** Initial entities to load */
  initial?: EntityDef[]
  /** Called when schema changes */
  onChange?: (entities: EntityDef[]) => void
  /** Called when user exports code */
  onExport?: (code: string) => void
}

// ── Styles ────────────────────────────────────────────────────

const S = {
  container: { display: 'flex', height: '100%', minHeight: 600, fontFamily: 'system-ui, sans-serif', fontSize: 14 } as const,
  sidebar: { width: 300, borderRight: '1px solid #e5e7eb', padding: 16, overflowY: 'auto', backgroundColor: '#f9fafb' } as const,
  canvas: { flex: 1, position: 'relative', overflow: 'auto', backgroundColor: '#fff', backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)', backgroundSize: '20px 20px' } as const,
  entityCard: (selected: boolean) => ({
    position: 'absolute' as const,
    width: 260,
    border: selected ? '2px solid #0284c7' : '1px solid #d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
    boxShadow: selected ? '0 0 0 2px rgba(2,132,199,0.2)' : '0 1px 3px rgba(0,0,0,0.1)',
    cursor: 'move',
    userSelect: 'none' as const,
  }),
  entityHeader: { padding: '8px 12px', backgroundColor: '#0284c7', color: '#fff', borderRadius: '6px 6px 0 0', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as const,
  entityBody: { padding: '8px 12px', fontSize: 12 } as const,
  fieldRow: { display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', borderBottom: '1px solid #f3f4f6' } as const,
  fieldName: { flex: 1, fontWeight: 500 } as const,
  fieldType: { color: '#6b7280', fontSize: 11 } as const,
  badge: (color: string) => ({ display: 'inline-block', padding: '0 4px', borderRadius: 3, backgroundColor: color, color: '#fff', fontSize: 10, marginLeft: 4 }),
  relationRow: { display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', color: '#7c3aed', fontSize: 12 } as const,
  btn: (variant: 'primary' | 'secondary' | 'danger' = 'primary') => ({
    padding: '6px 12px',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    backgroundColor: variant === 'primary' ? '#0284c7' : variant === 'danger' ? '#dc2626' : '#e5e7eb',
    color: variant === 'secondary' ? '#374151' : '#fff',
  }),
  input: { width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 } as const,
  select: { width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, backgroundColor: '#fff' } as const,
  label: { display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 12, color: '#374151' } as const,
  section: { marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' } as const,
  toolbar: { display: 'flex', gap: 8, padding: 12, borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' } as const,
}

const FIELD_TYPES: FieldType[] = ['string', 'number', 'boolean', 'date', 'json', 'array']
const RELATION_TYPES: RelationType[] = ['one-to-one', 'many-to-one', 'one-to-many', 'many-to-many']

let nextId = 1
function uid() { return `e${nextId++}` }

function toCollectionName(name: string): string {
  return name.replace(/([A-Z])/g, (m, c, i) => (i > 0 ? '_' : '') + c.toLowerCase()) + 's'
}

// ── Main Component ───────────────────────────────────────────

export default function SchemaDesigner({ initial = [], onChange, onExport }: SchemaDesignerProps) {
  const [entities, setEntities] = useState<EntityDef[]>(initial)
  const [selected, setSelected] = useState<string | null>(null)
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)

  const selectedEntity = entities.find((e) => e.id === selected)

  const update = useCallback((updated: EntityDef[]) => {
    setEntities(updated)
    onChange?.(updated)
  }, [onChange])

  // ── Entity CRUD ──

  const addEntity = () => {
    const name = `Entity${entities.length + 1}`
    const e: EntityDef = {
      id: uid(), name, collection: toCollectionName(name), timestamps: true,
      fields: [{ name: 'name', type: 'string', required: true, unique: false }],
      relations: [], indexes: [],
      x: 20 + entities.length * 30, y: 20 + entities.length * 30,
    }
    update([...entities, e])
    setSelected(e.id)
  }

  const removeEntity = (id: string) => {
    update(entities.filter((e) => e.id !== id))
    if (selected === id) setSelected(null)
  }

  const updateEntity = (id: string, patch: Partial<EntityDef>) => {
    update(entities.map((e) => e.id === id ? { ...e, ...patch } : e))
  }

  // ── Field CRUD ──

  const addField = () => {
    if (!selectedEntity) return
    const fields = [...selectedEntity.fields, { name: 'newField', type: 'string' as FieldType, required: false, unique: false }]
    updateEntity(selectedEntity.id, { fields })
  }

  const updateField = (idx: number, patch: Partial<FieldDef>) => {
    if (!selectedEntity) return
    const fields = selectedEntity.fields.map((f, i) => i === idx ? { ...f, ...patch } : f)
    updateEntity(selectedEntity.id, { fields })
  }

  const removeField = (idx: number) => {
    if (!selectedEntity) return
    const fields = selectedEntity.fields.filter((_, i) => i !== idx)
    updateEntity(selectedEntity.id, { fields })
  }

  // ── Relation CRUD ──

  const addRelation = () => {
    if (!selectedEntity) return
    const target = entities.find((e) => e.id !== selectedEntity.id)?.name || 'Entity'
    const relations = [...selectedEntity.relations, { name: target.toLowerCase(), target, type: 'many-to-one' as RelationType, required: false, nullable: true }]
    updateEntity(selectedEntity.id, { relations })
  }

  const updateRelation = (idx: number, patch: Partial<RelationDef>) => {
    if (!selectedEntity) return
    const relations = selectedEntity.relations.map((r, i) => i === idx ? { ...r, ...patch } : r)
    updateEntity(selectedEntity.id, { relations })
  }

  const removeRelation = (idx: number) => {
    if (!selectedEntity) return
    const relations = selectedEntity.relations.filter((_, i) => i !== idx)
    updateEntity(selectedEntity.id, { relations })
  }

  // ── Drag ──

  const onMouseDown = (e: React.MouseEvent, entityId: string) => {
    const entity = entities.find((en) => en.id === entityId)
    if (!entity) return
    setSelected(entityId)
    setDragging({ id: entityId, offsetX: e.clientX - entity.x, offsetY: e.clientY - entity.y })
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    const x = Math.max(0, e.clientX - dragging.offsetX)
    const y = Math.max(0, e.clientY - dragging.offsetY)
    updateEntity(dragging.id, { x, y })
  }

  const onMouseUp = () => setDragging(null)

  // ── Export ──

  const exportCode = () => {
    const code = generateSchemaCode(entities)
    onExport?.(code)
    navigator.clipboard?.writeText(code)
  }

  return (
    <div style={S.container}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
        <div style={S.toolbar}>
          <button onClick={addEntity} style={S.btn('primary')}>+ Entity</button>
          <button onClick={exportCode} style={S.btn('secondary')}>Export Code</button>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>
            {entities.length} entities | @mostajs/orm schema designer
          </span>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Canvas */}
          <div
            style={S.canvas as any}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onClick={(e) => { if (e.target === e.currentTarget) setSelected(null) }}
          >
            {/* Relation lines */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              {entities.flatMap((entity) =>
                entity.relations.map((rel, ri) => {
                  const target = entities.find((e) => e.name === rel.target)
                  if (!target) return null
                  const x1 = entity.x + 130
                  const y1 = entity.y + 40
                  const x2 = target.x + 130
                  const y2 = target.y + 20
                  return (
                    <line key={`${entity.id}-${ri}`} x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="#7c3aed" strokeWidth={1.5} strokeDasharray="4" markerEnd="url(#arrowhead)" />
                  )
                })
              )}
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#7c3aed" />
                </marker>
              </defs>
            </svg>

            {/* Entity cards */}
            {entities.map((entity) => (
              <div
                key={entity.id}
                style={{ ...S.entityCard(entity.id === selected), left: entity.x, top: entity.y }}
                onMouseDown={(e) => onMouseDown(e, entity.id)}
              >
                <div style={S.entityHeader}>
                  <span>{entity.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); removeEntity(entity.id) }}
                    style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}>x</button>
                </div>
                <div style={S.entityBody}>
                  <div style={{ color: '#9ca3af', fontSize: 10, marginBottom: 4 }}>{entity.collection}</div>
                  {entity.fields.map((f, i) => (
                    <div key={i} style={S.fieldRow}>
                      <span style={S.fieldName}>{f.name}</span>
                      <span style={S.fieldType}>{f.type}</span>
                      {f.required && <span style={S.badge('#dc2626')}>req</span>}
                      {f.unique && <span style={S.badge('#7c3aed')}>uniq</span>}
                    </div>
                  ))}
                  {entity.relations.map((r, i) => (
                    <div key={i} style={S.relationRow}>
                      <span>{r.name}</span>
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{r.type}</span>
                      <span style={{ fontWeight: 600 }}>{r.target}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Property panel */}
          {selectedEntity && (
            <div style={S.sidebar as any}>
              <div style={S.section}>
                <label style={S.label}>Entity Name</label>
                <input style={S.input} value={selectedEntity.name}
                  onChange={(e) => updateEntity(selectedEntity.id, { name: e.target.value, collection: toCollectionName(e.target.value) })} />
                <div style={{ marginTop: 8 }}>
                  <label style={S.label}>Collection</label>
                  <input style={S.input} value={selectedEntity.collection}
                    onChange={(e) => updateEntity(selectedEntity.id, { collection: e.target.value })} />
                </div>
                <label style={{ ...S.label, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={selectedEntity.timestamps}
                    onChange={(e) => updateEntity(selectedEntity.id, { timestamps: e.target.checked })} />
                  Timestamps (createdAt/updatedAt)
                </label>
              </div>

              {/* Fields */}
              <div style={S.section}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>Fields</span>
                  <button onClick={addField} style={S.btn('primary')}>+</button>
                </div>
                {selectedEntity.fields.map((f, i) => (
                  <div key={i} style={{ marginBottom: 8, padding: 8, border: '1px solid #e5e7eb', borderRadius: 4 }}>
                    <input style={{ ...S.input, marginBottom: 4 }} value={f.name}
                      onChange={(e) => updateField(i, { name: e.target.value })} placeholder="field name" />
                    <select style={{ ...S.select, marginBottom: 4 }} value={f.type}
                      onChange={(e) => updateField(i, { type: e.target.value as FieldType })}>
                      {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                      <label><input type="checkbox" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })} /> required</label>
                      <label><input type="checkbox" checked={f.unique} onChange={(e) => updateField(i, { unique: e.target.checked })} /> unique</label>
                      <button onClick={() => removeField(i)} style={{ ...S.btn('danger'), padding: '2px 6px', fontSize: 11 }}>x</button>
                    </div>
                    <input style={{ ...S.input, marginTop: 4 }} value={f.enum || ''} placeholder="enum: val1, val2, ..."
                      onChange={(e) => updateField(i, { enum: e.target.value })} />
                    <input style={{ ...S.input, marginTop: 4 }} value={f.default || ''} placeholder="default value"
                      onChange={(e) => updateField(i, { default: e.target.value })} />
                  </div>
                ))}
              </div>

              {/* Relations */}
              <div style={S.section}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>Relations</span>
                  <button onClick={addRelation} style={S.btn('primary')}>+</button>
                </div>
                {selectedEntity.relations.map((r, i) => (
                  <div key={i} style={{ marginBottom: 8, padding: 8, border: '1px solid #e5e7eb', borderRadius: 4 }}>
                    <input style={{ ...S.input, marginBottom: 4 }} value={r.name}
                      onChange={(e) => updateRelation(i, { name: e.target.value })} placeholder="relation name" />
                    <select style={{ ...S.select, marginBottom: 4 }} value={r.target}
                      onChange={(e) => updateRelation(i, { target: e.target.value })}>
                      {entities.filter((e) => e.id !== selectedEntity.id).map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
                    </select>
                    <select style={{ ...S.select, marginBottom: 4 }} value={r.type}
                      onChange={(e) => updateRelation(i, { type: e.target.value as RelationType })}>
                      {RELATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                      <label><input type="checkbox" checked={r.required} onChange={(e) => updateRelation(i, { required: e.target.checked })} /> required</label>
                      <label><input type="checkbox" checked={r.nullable} onChange={(e) => updateRelation(i, { nullable: e.target.checked })} /> nullable</label>
                      <button onClick={() => removeRelation(i)} style={{ ...S.btn('danger'), padding: '2px 6px', fontSize: 11 }}>x</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Code Generator ───────────────────────────────────────────

function generateSchemaCode(entities: EntityDef[]): string {
  const lines: string[] = [
    "// Generated by @mostajs/init Schema Designer",
    "import type { EntitySchema } from '@mostajs/orm';",
    '',
  ]

  for (const entity of entities) {
    lines.push(`export const ${entity.name}Schema: EntitySchema = {`)
    lines.push(`  name: '${entity.name}',`)
    lines.push(`  collection: '${entity.collection}',`)
    lines.push(`  timestamps: ${entity.timestamps},`)
    lines.push('')

    // Fields
    lines.push('  fields: {')
    for (const f of entity.fields) {
      const parts: string[] = [`type: '${f.type}'`]
      if (f.required) parts.push('required: true')
      if (f.unique) parts.push('unique: true')
      if (f.default) {
        const val = f.type === 'number' ? f.default : f.type === 'boolean' ? f.default : `'${f.default}'`
        parts.push(`default: ${val}`)
      }
      if (f.enum) {
        const vals = f.enum.split(',').map((v) => `'${v.trim()}'`).join(', ')
        parts.push(`enum: [${vals}]`)
      }
      lines.push(`    ${f.name}: { ${parts.join(', ')} },`)
    }
    lines.push('  },')
    lines.push('')

    // Relations
    lines.push('  relations: {')
    for (const r of entity.relations) {
      const parts: string[] = [`target: '${r.target}'`, `type: '${r.type}'`]
      if (r.required) parts.push('required: true')
      if (r.nullable) parts.push('nullable: true')
      lines.push(`    ${r.name}: { ${parts.join(', ')} },`)
    }
    lines.push('  },')
    lines.push('')

    // Indexes
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
