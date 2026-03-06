// @mostajs/init — Configuration reporter
// Author: Dr Hamid MADANI drmdh@msn.com
import type { InitReport, ModuleInfo, SuggestedAction } from '../types/index.js'

/**
 * Generate an InitReport from discovered modules.
 * Produces suggested actions (routes to create, schemas to register, etc.)
 */
export function generateReport(projectRoot: string, modules: ModuleInfo[]): InitReport {
  const installed = modules.filter((m) => m.installed)
  const available = modules.filter((m) => !m.installed)
  const actions: SuggestedAction[] = []

  // For each installed module, suggest actions
  for (const mod of installed) {
    // Suggest route factories
    for (const factory of mod.capabilities.routeFactories) {
      const routeName = factoryToRoutePath(factory)
      actions.push({
        type: 'route',
        module: mod.name,
        description: `Create API route using ${factory} from ${mod.name}`,
        targetPath: `src/app/api/${routeName}/route.ts`,
      })
    }

    // Suggest schema registration
    for (const schema of mod.capabilities.schemaNames) {
      actions.push({
        type: 'registry',
        module: mod.name,
        description: `Register ${schema} in DAL registry`,
      })
    }

    // Suggest DAL service entries for repositories
    for (const repo of mod.capabilities.repositoryNames) {
      actions.push({
        type: 'dal',
        module: mod.name,
        description: `Add ${repo} factory to DAL service`,
      })
    }
  }

  // Suggest install for available modules
  for (const mod of available) {
    actions.push({
      type: 'install',
      module: mod.name,
      description: `Install ${mod.name}: ${mod.description}`,
      code: `npm install ${mod.name}`,
    })
  }

  return { projectRoot, modules, available, installed, actions }
}

/**
 * Render the report as a Markdown string.
 */
export function renderReportMarkdown(report: InitReport): string {
  const lines: string[] = []

  lines.push('# @mostajs/init — Configuration Report')
  lines.push('')
  lines.push(`Project: \`${report.projectRoot}\``)
  lines.push(`Modules found: ${report.modules.length} (${report.installed.length} installed, ${report.available.length} available)`)
  lines.push('')

  // Installed modules
  if (report.installed.length > 0) {
    lines.push('## Installed Modules')
    lines.push('')
    lines.push('| Module | Version | Routes | Schemas | Repos | Components |')
    lines.push('|--------|---------|--------|---------|-------|------------|')
    for (const mod of report.installed) {
      const c = mod.capabilities
      lines.push(
        `| ${mod.name} | ${mod.version} | ${c.routeFactories.length || '-'} | ${c.schemaNames.length || '-'} | ${c.repositoryNames.length || '-'} | ${c.componentNames.length || '-'} |`
      )
    }
    lines.push('')
  }

  // Available modules
  if (report.available.length > 0) {
    lines.push('## Available (not installed)')
    lines.push('')
    for (const mod of report.available) {
      lines.push(`- **${mod.name}** (${mod.version}): ${mod.description}`)
    }
    lines.push('')
  }

  // Suggested actions
  const routeActions = report.actions.filter((a) => a.type === 'route')
  const registryActions = report.actions.filter((a) => a.type === 'registry')
  const dalActions = report.actions.filter((a) => a.type === 'dal')
  const installActions = report.actions.filter((a) => a.type === 'install')

  if (routeActions.length > 0) {
    lines.push('## API Routes to Create')
    lines.push('')
    for (const a of routeActions) {
      lines.push(`- [ ] \`${a.targetPath}\` — ${a.description}`)
    }
    lines.push('')
  }

  if (registryActions.length > 0) {
    lines.push('## Schemas to Register')
    lines.push('')
    lines.push('Add to `src/dal/registry.ts`:')
    lines.push('')
    for (const a of registryActions) {
      lines.push(`- [ ] ${a.description}`)
    }
    lines.push('')
  }

  if (dalActions.length > 0) {
    lines.push('## DAL Service Entries')
    lines.push('')
    lines.push('Add to `src/dal/service.ts`:')
    lines.push('')
    for (const a of dalActions) {
      lines.push(`- [ ] ${a.description}`)
    }
    lines.push('')
  }

  if (installActions.length > 0) {
    lines.push('## Modules to Install')
    lines.push('')
    for (const a of installActions) {
      lines.push(`- \`${a.code}\` — ${a.description}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Render the report as JSON.
 */
export function renderReportJSON(report: InitReport): string {
  return JSON.stringify(report, null, 2)
}

/** Convert factory name to route path: createTicketsHandler -> tickets */
function factoryToRoutePath(factoryName: string): string {
  return factoryName
    .replace(/^create/, '')
    .replace(/Handler$/, '')
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '')
}
