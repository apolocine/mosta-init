// @mostajs/init — Types
// Author: Dr Hamid MADANI drmdh@msn.com

/** Info about a discovered @mostajs module */
export interface ModuleInfo {
  /** Package name, e.g. '@mostajs/auth' */
  name: string
  /** Short key, e.g. 'auth' */
  key: string
  /** Package version */
  version: string
  /** Package description */
  description: string
  /** Whether it's installed in node_modules */
  installed: boolean
  /** Subpath exports from package.json */
  exports: ExportEntry[]
  /** Detected capabilities */
  capabilities: ModuleCapabilities
}

export interface ExportEntry {
  /** Subpath, e.g. './lib/audit' or '.' */
  subpath: string
  /** Full import path, e.g. '@mostajs/audit/lib/audit' */
  importPath: string
  /** Whether it has types */
  hasTypes: boolean
}

export interface ModuleCapabilities {
  /** Has API route factories (createXxxHandler) */
  hasRoutes: boolean
  /** Has React components */
  hasComponents: boolean
  /** Has React hooks */
  hasHooks: boolean
  /** Has ORM schemas */
  hasSchemas: boolean
  /** Has ORM repositories */
  hasRepositories: boolean
  /** Has types */
  hasTypes: boolean
  /** Detected route factory names */
  routeFactories: string[]
  /** Detected schema names */
  schemaNames: string[]
  /** Detected repository names */
  repositoryNames: string[]
  /** Detected component names */
  componentNames: string[]
}

/** Configuration report for a project */
export interface InitReport {
  /** Project root path */
  projectRoot: string
  /** All discovered modules */
  modules: ModuleInfo[]
  /** Modules that are available but not installed */
  available: ModuleInfo[]
  /** Modules already installed */
  installed: ModuleInfo[]
  /** Suggested actions */
  actions: SuggestedAction[]
}

export interface SuggestedAction {
  type: 'install' | 'route' | 'page' | 'registry' | 'dal' | 'provider'
  module: string
  description: string
  /** Generated code or command */
  code?: string
  /** Target file path (relative to project root) */
  targetPath?: string
}

/** Options for codegen */
export interface CodegenOptions {
  /** Project root directory */
  projectRoot: string
  /** Source directory (default: 'src') */
  srcDir?: string
  /** Whether to use App Router (default: true) */
  appRouter?: boolean
  /** DAL service file path (default: 'src/dal/service.ts') */
  dalServicePath?: string
  /** DAL registry file path (default: 'src/dal/registry.ts') */
  dalRegistryPath?: string
}
