// @mostajs/init — Barrel exports
// Author: Dr Hamid MADANI drmdh@msn.com

// Discovery
export { discoverModules } from './lib/discover.js'
export { analyzeModule } from './lib/analyze.js'

// Report
export { generateReport, renderReportMarkdown, renderReportJSON } from './lib/reporter.js'

// Codegen
export { generateRegistry, generateDalService, generateRouteStub, applyCodegen } from './lib/codegen.js'

// Reverse engineering
export { reverseEngineerMongo, reverseEngineerSQL, reverseEngineerFromModules } from './lib/reverse-engineer.js'

// CRUD generator
export { entityToCrudConfig, generateCrud } from './lib/crud-generator.js'

// Types
export type {
  ModuleInfo,
  ExportEntry,
  ModuleCapabilities,
  InitReport,
  SuggestedAction,
  CodegenOptions,
} from './types/index.js'
