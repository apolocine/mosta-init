// @mostajs/init — Page Designer (visual page layout builder)
// Author: Dr Hamid MADANI drmdh@msn.com
'use client'

import { useState, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────

type ComponentType =
  | 'heading'
  | 'card'
  | 'table'
  | 'form'
  | 'button'
  | 'badge'
  | 'stat'
  | 'tabs'
  | 'grid'
  | 'separator'
  | 'text'
  | 'custom'

interface PageComponent {
  id: string
  type: ComponentType
  label: string
  props: Record<string, string>
  children?: PageComponent[]
}

interface PageDef {
  name: string
  route: string
  layout: 'single' | 'two-column' | 'sidebar'
  components: PageComponent[]
  dataSource?: string
  permission?: string
}

export interface PageDesignerProps {
  /** Available entities (from schema designer or discovery) */
  entities?: string[]
  /** Called when page config changes */
  onChange?: (page: PageDef) => void
  /** Called when user exports code */
  onExport?: (code: string) => void
}

// ── Styles ────────────────────────────────────────────────────

const S = {
  container: { display: 'flex', height: '100%', minHeight: 600, fontFamily: 'system-ui, sans-serif', fontSize: 14 } as const,
  palette: { width: 200, borderRight: '1px solid #e5e7eb', padding: 12, backgroundColor: '#f9fafb', overflowY: 'auto' } as const,
  canvas: { flex: 1, padding: 24, overflowY: 'auto', backgroundColor: '#fff' } as const,
  panel: { width: 280, borderLeft: '1px solid #e5e7eb', padding: 16, overflowY: 'auto', backgroundColor: '#f9fafb' } as const,
  paletteItem: { padding: '8px 12px', marginBottom: 4, border: '1px solid #d1d5db', borderRadius: 6, backgroundColor: '#fff', cursor: 'grab', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 } as const,
  dropZone: (active: boolean) => ({
    minHeight: 60,
    border: `2px dashed ${active ? '#0284c7' : '#d1d5db'}`,
    borderRadius: 8,
    padding: 16,
    backgroundColor: active ? '#f0f9ff' : '#fafafa',
    transition: 'all 0.2s',
  }),
  componentPreview: (selected: boolean) => ({
    padding: 12,
    marginBottom: 8,
    border: selected ? '2px solid #0284c7' : '1px solid #e5e7eb',
    borderRadius: 6,
    backgroundColor: '#fff',
    cursor: 'pointer',
    boxShadow: selected ? '0 0 0 2px rgba(2,132,199,0.2)' : 'none',
  }),
  btn: (variant: 'primary' | 'secondary' | 'danger' = 'primary') => ({
    padding: '6px 12px',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500 as const,
    cursor: 'pointer',
    backgroundColor: variant === 'primary' ? '#0284c7' : variant === 'danger' ? '#dc2626' : '#e5e7eb',
    color: variant === 'secondary' ? '#374151' : '#fff',
  }),
  input: { width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 } as const,
  select: { width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, backgroundColor: '#fff' } as const,
  label: { display: 'block', marginBottom: 4, fontWeight: 500 as const, fontSize: 12, color: '#374151' } as const,
  section: { marginBottom: 16 } as const,
  toolbar: { display: 'flex', gap: 8, padding: 12, borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' } as const,
}

const COMPONENT_PALETTE: { type: ComponentType; icon: string; label: string }[] = [
  { type: 'heading', icon: 'H', label: 'Heading' },
  { type: 'text', icon: 'T', label: 'Text' },
  { type: 'card', icon: '▭', label: 'Card' },
  { type: 'table', icon: '▦', label: 'Data Table' },
  { type: 'form', icon: '☐', label: 'Form' },
  { type: 'button', icon: '▢', label: 'Button' },
  { type: 'badge', icon: '●', label: 'Badge' },
  { type: 'stat', icon: '#', label: 'Stat Card' },
  { type: 'tabs', icon: '⊞', label: 'Tabs' },
  { type: 'grid', icon: '⊟', label: 'Grid' },
  { type: 'separator', icon: '—', label: 'Separator' },
  { type: 'custom', icon: '{ }', label: 'Custom' },
]

const LAYOUTS = [
  { value: 'single', label: 'Single column' },
  { value: 'two-column', label: 'Two columns' },
  { value: 'sidebar', label: 'Sidebar + content' },
] as const

let uid = 1
function nextId() { return `c${uid++}` }

function defaultProps(type: ComponentType): Record<string, string> {
  switch (type) {
    case 'heading': return { text: 'Page Title', level: '1' }
    case 'text': return { text: 'Description text' }
    case 'card': return { title: 'Card Title' }
    case 'table': return { entity: '', columns: 'name, status' }
    case 'form': return { entity: '', fields: 'name, email' }
    case 'button': return { text: 'Action', variant: 'default' }
    case 'badge': return { text: 'Status', variant: 'default' }
    case 'stat': return { label: 'Total', value: '0', icon: 'BarChart3' }
    case 'tabs': return { tabs: 'Overview, Details' }
    case 'grid': return { columns: '2', gap: '16' }
    case 'separator': return {}
    case 'custom': return { code: '<div>Custom component</div>' }
  }
}

// ── Main Component ───────────────────────────────────────────

export default function PageDesigner({ entities = [], onChange, onExport }: PageDesignerProps) {
  const [page, setPage] = useState<PageDef>({
    name: 'NewPage',
    route: '/dashboard/new-page',
    layout: 'single',
    components: [],
  })
  const [selected, setSelected] = useState<string | null>(null)

  const selectedComponent = page.components.find((c) => c.id === selected)

  const update = useCallback((updated: PageDef) => {
    setPage(updated)
    onChange?.(updated)
  }, [onChange])

  const addComponent = (type: ComponentType) => {
    const comp: PageComponent = {
      id: nextId(),
      type,
      label: COMPONENT_PALETTE.find((p) => p.type === type)?.label || type,
      props: defaultProps(type),
    }
    update({ ...page, components: [...page.components, comp] })
    setSelected(comp.id)
  }

  const updateComponent = (id: string, patch: Partial<PageComponent>) => {
    const components = page.components.map((c) => c.id === id ? { ...c, ...patch } : c)
    update({ ...page, components })
  }

  const removeComponent = (id: string) => {
    update({ ...page, components: page.components.filter((c) => c.id !== id) })
    if (selected === id) setSelected(null)
  }

  const moveComponent = (id: string, direction: -1 | 1) => {
    const idx = page.components.findIndex((c) => c.id === id)
    if (idx < 0) return
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= page.components.length) return
    const comps = [...page.components]
    ;[comps[idx], comps[newIdx]] = [comps[newIdx], comps[idx]]
    update({ ...page, components: comps })
  }

  const exportCode = () => {
    const code = generatePageCode(page)
    onExport?.(code)
    navigator.clipboard?.writeText(code)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={S.label}>
            Name:
            <input style={{ ...S.input, width: 150, marginLeft: 4 }} value={page.name}
              onChange={(e) => update({ ...page, name: e.target.value })} />
          </label>
          <label style={S.label}>
            Route:
            <input style={{ ...S.input, width: 200, marginLeft: 4 }} value={page.route}
              onChange={(e) => update({ ...page, route: e.target.value })} />
          </label>
          <label style={S.label}>
            Layout:
            <select style={{ ...S.select, width: 150, marginLeft: 4 }} value={page.layout}
              onChange={(e) => update({ ...page, layout: e.target.value as PageDef['layout'] })}>
              {LAYOUTS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>
        </div>
        <button onClick={exportCode} style={S.btn('secondary')}>Export Code</button>
      </div>

      <div style={S.container}>
        {/* Component Palette */}
        <div style={S.palette as any}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Components</div>
          {COMPONENT_PALETTE.map((item) => (
            <div key={item.type} style={S.paletteItem} onClick={() => addComponent(item.type)}>
              <span style={{ width: 24, textAlign: 'center', fontSize: 16 }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div style={S.canvas as any}>
          {page.components.length === 0 ? (
            <div style={S.dropZone(false)}>
              <div style={{ textAlign: 'center', color: '#9ca3af' }}>
                Click a component from the palette to add it here
              </div>
            </div>
          ) : (
            <div style={page.layout === 'two-column' ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 } :
              page.layout === 'sidebar' ? { display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 } : {}}>
              {page.components.map((comp) => (
                <div key={comp.id}
                  style={S.componentPreview(comp.id === selected)}
                  onClick={() => setSelected(comp.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 500, fontSize: 12, color: '#6b7280' }}>{comp.label}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={(e) => { e.stopPropagation(); moveComponent(comp.id, -1) }}
                        style={{ ...S.btn('secondary'), padding: '2px 6px', fontSize: 11 }}>up</button>
                      <button onClick={(e) => { e.stopPropagation(); moveComponent(comp.id, 1) }}
                        style={{ ...S.btn('secondary'), padding: '2px 6px', fontSize: 11 }}>dn</button>
                      <button onClick={(e) => { e.stopPropagation(); removeComponent(comp.id) }}
                        style={{ ...S.btn('danger'), padding: '2px 6px', fontSize: 11 }}>x</button>
                    </div>
                  </div>
                  {renderPreview(comp)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Property Panel */}
        {selectedComponent && (
          <div style={S.panel as any}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Properties: {selectedComponent.label}</div>
            {Object.entries(selectedComponent.props).map(([key, value]) => (
              <div key={key} style={S.section}>
                <label style={S.label}>{key}</label>
                {key === 'entity' ? (
                  <select style={S.select} value={value}
                    onChange={(e) => updateComponent(selectedComponent.id, { props: { ...selectedComponent.props, [key]: e.target.value } })}>
                    <option value="">-- select entity --</option>
                    {entities.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                ) : key === 'variant' ? (
                  <select style={S.select} value={value}
                    onChange={(e) => updateComponent(selectedComponent.id, { props: { ...selectedComponent.props, [key]: e.target.value } })}>
                    {['default', 'outline', 'destructive', 'secondary', 'ghost'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : (
                  <input style={S.input} value={value}
                    onChange={(e) => updateComponent(selectedComponent.id, { props: { ...selectedComponent.props, [key]: e.target.value } })} />
                )}
              </div>
            ))}
            <div style={S.section}>
              <label style={S.label}>Permission</label>
              <input style={S.input} value={page.permission || ''}
                onChange={(e) => update({ ...page, permission: e.target.value })} placeholder="e.g. client:view" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Preview Renderer ─────────────────────────────────────────

function renderPreview(comp: PageComponent) {
  const p = comp.props
  switch (comp.type) {
    case 'heading':
      return <div style={{ fontSize: p.level === '1' ? 24 : p.level === '2' ? 20 : 16, fontWeight: 700 }}>{p.text}</div>
    case 'text':
      return <div style={{ color: '#6b7280' }}>{p.text}</div>
    case 'card':
      return <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{p.title}</div>
        <div style={{ color: '#9ca3af', fontSize: 12 }}>Card content</div>
      </div>
    case 'table':
      return <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ display: 'flex', backgroundColor: '#f3f4f6', padding: '8px 12px', fontSize: 12, fontWeight: 600 }}>
          {(p.columns || '').split(',').map((col, i) => <span key={i} style={{ flex: 1 }}>{col.trim()}</span>)}
        </div>
        <div style={{ padding: '8px 12px', color: '#9ca3af', fontSize: 12 }}>
          {p.entity ? `Data from ${p.entity}` : 'Configure entity'}
        </div>
      </div>
    case 'form':
      return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(p.fields || '').split(',').map((field, i) => (
          <div key={i}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{field.trim()}</div>
            <div style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '6px 8px', backgroundColor: '#f9fafb', fontSize: 12, color: '#9ca3af' }}>input</div>
          </div>
        ))}
      </div>
    case 'button':
      return <button style={{ ...S.btn('primary'), pointerEvents: 'none' }}>{p.text}</button>
    case 'badge':
      return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, backgroundColor: '#e5e7eb', fontSize: 12 }}>{p.text}</span>
    case 'stat':
      return <div style={{ textAlign: 'center', padding: 12 }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>{p.value}</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{p.label}</div>
      </div>
    case 'tabs':
      return <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e5e7eb' }}>
        {(p.tabs || '').split(',').map((tab, i) => (
          <span key={i} style={{ padding: '8px 16px', fontSize: 13, fontWeight: i === 0 ? 600 : 400, borderBottom: i === 0 ? '2px solid #0284c7' : 'none', color: i === 0 ? '#0284c7' : '#6b7280' }}>{tab.trim()}</span>
        ))}
      </div>
    case 'grid':
      return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${p.columns || 2}, 1fr)`, gap: Number(p.gap) || 16 }}>
        {Array(Number(p.columns) || 2).fill(null).map((_, i) => (
          <div key={i} style={{ border: '1px dashed #d1d5db', borderRadius: 4, padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Column {i + 1}</div>
        ))}
      </div>
    case 'separator':
      return <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '8px 0' }} />
    case 'custom':
      return <div style={{ padding: 8, backgroundColor: '#fef3c7', borderRadius: 4, fontSize: 12, fontFamily: 'monospace' }}>{p.code}</div>
    default:
      return <div>{comp.type}</div>
  }
}

// ── Code Generator ───────────────────────────────────────────

function generatePageCode(page: PageDef): string {
  const imports = new Set<string>()
  imports.add("'use client'")

  const uiImports = new Set<string>()
  const lucideImports = new Set<string>()

  for (const comp of page.components) {
    switch (comp.type) {
      case 'card': uiImports.add('Card').add('CardContent').add('CardHeader').add('CardTitle'); break
      case 'table': uiImports.add('Table').add('TableHeader').add('TableBody').add('TableRow').add('TableHead').add('TableCell'); break
      case 'button': uiImports.add('Button'); break
      case 'badge': uiImports.add('Badge'); break
      case 'tabs': uiImports.add('Tabs').add('TabsList').add('TabsTrigger').add('TabsContent'); break
      case 'form': uiImports.add('Input').add('Label'); break
      case 'stat': lucideImports.add(comp.props.icon || 'BarChart3'); break
    }
  }

  const lines: string[] = [
    "// Generated by @mostajs/init Page Designer",
    "'use client'",
    '',
  ]

  if (uiImports.size > 0) {
    // Group by source component file
    const byFile: Record<string, string[]> = {}
    for (const name of uiImports) {
      const file = name.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
      const base = file.includes('card') ? 'card' : file.includes('table') ? 'table' : file.includes('tab') ? 'tabs' : file
      if (!byFile[base]) byFile[base] = []
      byFile[base].push(name)
    }
    for (const [file, names] of Object.entries(byFile)) {
      lines.push(`import { ${names.join(', ')} } from '@mostajs/ui/${file}'`)
    }
  }

  if (lucideImports.size > 0) {
    lines.push(`import { ${Array.from(lucideImports).join(', ')} } from 'lucide-react'`)
  }

  lines.push('')
  lines.push(`export default function ${page.name}Page() {`)
  lines.push('  return (')
  lines.push('    <div className="space-y-6">')

  for (const comp of page.components) {
    lines.push('      ' + generateComponentCode(comp))
  }

  lines.push('    </div>')
  lines.push('  )')
  lines.push('}')

  return lines.join('\n')
}

function generateComponentCode(comp: PageComponent): string {
  const p = comp.props
  switch (comp.type) {
    case 'heading': return `<h${p.level || 1} className="text-${p.level === '1' ? '2xl' : p.level === '2' ? 'xl' : 'lg'} font-bold text-gray-900">${p.text}</h${p.level || 1}>`
    case 'text': return `<p className="text-gray-600">${p.text}</p>`
    case 'card': return `<Card>\n        <CardHeader><CardTitle>${p.title}</CardTitle></CardHeader>\n        <CardContent>{/* TODO */}</CardContent>\n      </Card>`
    case 'table': return `{/* TODO: Data table for ${p.entity || 'entity'} */}\n      <Table>\n        <TableHeader><TableRow>${(p.columns || '').split(',').map((c) => `<TableHead>${c.trim()}</TableHead>`).join('')}</TableRow></TableHeader>\n        <TableBody>{/* rows */}</TableBody>\n      </Table>`
    case 'form': return `<form className="space-y-4">\n${(p.fields || '').split(',').map((f) => `        <div>\n          <Label>${f.trim()}</Label>\n          <Input name="${f.trim().toLowerCase()}" />\n        </div>`).join('\n')}\n        <Button type="submit">Save</Button>\n      </form>`
    case 'button': return `<Button variant="${p.variant || 'default'}">${p.text}</Button>`
    case 'badge': return `<Badge variant="${p.variant || 'default'}">${p.text}</Badge>`
    case 'stat': return `<Card>\n        <CardContent className="pt-6 text-center">\n          <${p.icon || 'BarChart3'} className="mx-auto h-8 w-8 text-sky-600 mb-2" />\n          <div className="text-3xl font-bold">${p.value}</div>\n          <div className="text-sm text-gray-500">${p.label}</div>\n        </CardContent>\n      </Card>`
    case 'tabs': return `<Tabs defaultValue="${(p.tabs || '').split(',')[0]?.trim().toLowerCase()}">\n        <TabsList>${(p.tabs || '').split(',').map((t) => `<TabsTrigger value="${t.trim().toLowerCase()}">${t.trim()}</TabsTrigger>`).join('')}</TabsList>\n${(p.tabs || '').split(',').map((t) => `        <TabsContent value="${t.trim().toLowerCase()}">{/* ${t.trim()} content */}</TabsContent>`).join('\n')}\n      </Tabs>`
    case 'grid': return `<div className="grid grid-cols-${p.columns || 2} gap-${p.gap || 4}">\n        {/* grid content */}\n      </div>`
    case 'separator': return `<hr className="border-gray-200" />`
    case 'custom': return p.code || '{/* custom */}'
    default: return `{/* ${comp.type} */}`
  }
}
