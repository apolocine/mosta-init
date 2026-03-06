# @mostajs/init

CLI tool and visual designers for the @mostajs ecosystem. Discovers installed modules, generates configuration reports, scaffolds API routes, DAL services, CRUD pages, and provides graphical tools for database schema design and page layout.

## Installation

```bash
npm install @mostajs/init
# or use directly
npx @mostajs/init
```

## CLI Usage

### Report (default)

Discover all @mostajs modules and show a configuration report:

```bash
npx @mostajs/init           # Markdown report
npx @mostajs/init --json    # JSON report
```

Output includes:
- Installed modules with capabilities (routes, schemas, repositories, components)
- Available modules on npm (not yet installed)
- Suggested actions (routes to create, schemas to register, DAL entries)

### Install all modules

```bash
npx @mostajs/init --install
```

### Generate code

Generates `src/dal/registry.ts`, `src/dal/service.ts`, and API route stubs:

```bash
npx @mostajs/init --generate
```

### Reverse engineer database

Introspects your database via `@mostajs/orm` and generates EntitySchema definitions:

```bash
npx @mostajs/init --reverse-engineer
```

Reads `.env.local` for `DB_DIALECT` and `SGBD_URI`, connects via @mostajs/orm, and exports schema code to `generated-schemas.ts`.

### Generate CRUD pages

Generates a complete CRUD (list page + form page + API routes) for any entity:

```bash
npx @mostajs/init --crud Client
npx @mostajs/init --crud Activity
```

This creates 4 files:
- `src/app/dashboard/<entity>/page.tsx` — List page with table, search, pagination
- `src/app/dashboard/<entity>/[id]/page.tsx` — Create/Edit form
- `src/app/api/<entity>/route.ts` — GET (list) + POST (create)
- `src/app/api/<entity>/[id]/route.ts` — GET (detail) + PUT (update) + DELETE

The CRUD generator automatically detects the EntitySchema from installed @mostajs modules and uses:
- `@mostajs/ui` components (Card, Table, Button, Input, Select, Badge)
- `@mostajs/orm` repository pattern
- App Router (Next.js 14+)
- Permission-based auth checks

### Combine options

```bash
npx @mostajs/init --install --generate
npx @mostajs/init --reverse-engineer --crud Client
```

## Visual Designers (React Components)

### Schema Designer

Graphical tool to design `@mostajs/orm` EntitySchema definitions. Drag entities, add fields/relations, export TypeScript code.

```tsx
import SchemaDesigner from '@mostajs/init/components/SchemaDesigner'

export default function SchemaDesignerPage() {
  return (
    <div style={{ height: '100vh' }}>
      <SchemaDesigner
        initial={[]}
        onChange={(entities) => console.log('Schema changed:', entities)}
        onExport={(code) => {
          console.log('Generated code:', code)
          // code is a complete TypeScript file with EntitySchema definitions
        }}
      />
    </div>
  )
}
```

**Features:**
- Visual entity cards with fields and relations
- Drag to reposition entities
- Relation lines drawn between related entities
- Property panel for editing fields (type, required, unique, enum, default)
- Property panel for editing relations (target, type, nullable)
- Export button generates `@mostajs/orm` EntitySchema TypeScript code
- Auto-generates collection name from entity name

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `initial` | `EntityDef[]` | Initial entities to load |
| `onChange` | `(entities) => void` | Called when schema changes |
| `onExport` | `(code: string) => void` | Called when user clicks Export |

### Page Designer

Visual page layout builder. Drag components from palette, configure properties, export Next.js page code.

```tsx
import PageDesigner from '@mostajs/init/components/PageDesigner'

export default function PageDesignerPage() {
  return (
    <div style={{ height: '100vh' }}>
      <PageDesigner
        entities={['Client', 'Activity', 'Ticket']}
        onChange={(page) => console.log('Page changed:', page)}
        onExport={(code) => {
          console.log('Generated code:', code)
        }}
      />
    </div>
  )
}
```

**Component palette:** Heading, Text, Card, Data Table, Form, Button, Badge, Stat Card, Tabs, Grid, Separator, Custom

**Features:**
- Three layout modes: single column, two columns, sidebar + content
- Component palette with click-to-add
- Property panel for each component
- Reorder components (up/down)
- Entity selector for Table and Form components
- Export generates a complete Next.js page with `@mostajs/ui` imports

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `entities` | `string[]` | Available entity names (for Table/Form selectors) |
| `onChange` | `(page) => void` | Called when page config changes |
| `onExport` | `(code: string) => void` | Called when user clicks Export |

## Reverse Engineering API

Use programmatically for database introspection:

### MongoDB

```typescript
import { reverseEngineerMongo } from '@mostajs/init'
import { MongoClient } from 'mongodb'

const client = new MongoClient('mongodb://localhost:27017')
await client.connect()
const db = client.db('mydb')

const { entities, code, warnings } = await reverseEngineerMongo(db)
console.log(code)  // Complete EntitySchema TypeScript file
```

### SQL (Postgres, MySQL, etc.)

```typescript
import { reverseEngineerSQL } from '@mostajs/init'

const { entities, code, warnings } = await reverseEngineerSQL(
  async (sql) => pool.query(sql).then(r => r.rows),
  'public'  // schema name
)
console.log(code)
```

### From installed modules

```typescript
import { reverseEngineerFromModules } from '@mostajs/init'

const entities = reverseEngineerFromModules(process.cwd())
// Returns IntrospectedEntity[] from all installed @mostajs modules
```

## CRUD Generator API

```typescript
import { entityToCrudConfig, generateCrud } from '@mostajs/init'
import { ActivitySchema } from '@mostajs/ticketing'

const config = entityToCrudConfig(ActivitySchema)
const crud = generateCrud(config)

// crud.listPage.code   — List page component
// crud.formPage.code   — Form page component
// crud.apiRoute.code   — API GET/POST route
// crud.apiIdRoute.code — API GET/PUT/DELETE route
```

## License

MIT
