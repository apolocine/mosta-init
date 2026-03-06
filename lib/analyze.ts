// @mostajs/init — Module analyzer
// Author: Dr Hamid MADANI drmdh@msn.com
import fs from 'fs'
import path from 'path'
import type { ModuleInfo, ExportEntry, ModuleCapabilities } from '../types/index.js'

/**
 * Analyze a single @mostajs module's package.json to extract:
 * - Subpath exports
 * - Capabilities (routes, components, hooks, schemas, repositories)
 */
export async function analyzeModule(
  projectRoot: string,
  name: string,
  key: string,
  version: string,
  description: string,
  installed: boolean,
): Promise<ModuleInfo> {
  const exports: ExportEntry[] = []
  const capabilities: ModuleCapabilities = {
    hasRoutes: false,
    hasComponents: false,
    hasHooks: false,
    hasSchemas: false,
    hasRepositories: false,
    hasTypes: false,
    routeFactories: [],
    schemaNames: [],
    repositoryNames: [],
    componentNames: [],
  }

  if (!installed) {
    return { name, key, version, description, installed, exports, capabilities }
  }

  // Read package.json
  const pkgPath = path.join(projectRoot, 'node_modules', name, 'package.json')
  let pkg: any
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  } catch {
    return { name, key, version, description, installed, exports, capabilities }
  }

  // Parse exports field
  if (pkg.exports && typeof pkg.exports === 'object') {
    for (const [subpath, value] of Object.entries(pkg.exports)) {
      const entry: ExportEntry = {
        subpath,
        importPath: subpath === '.' ? name : `${name}/${subpath.replace(/^\.\//, '')}`,
        hasTypes: false,
      }

      if (typeof value === 'object' && value !== null) {
        const v = value as Record<string, string>
        entry.hasTypes = !!v.types
      }

      exports.push(entry)

      // Detect capabilities from subpath patterns
      const s = subpath.toLowerCase()
      if (s.includes('/api/') || s.includes('.route') || s.includes('/route')) {
        capabilities.hasRoutes = true
      }
      if (s.includes('/components/') || s.includes('/component')) {
        capabilities.hasComponents = true
      }
      if (s.includes('/hooks/') || s.includes('/hook')) {
        capabilities.hasHooks = true
      }
      if (s.includes('/schemas') || s.includes('/schema')) {
        capabilities.hasSchemas = true
      }
      if (s.includes('/repositories') || s.includes('/repository')) {
        capabilities.hasRepositories = true
      }
      if (s.includes('/types')) {
        capabilities.hasTypes = true
      }
    }
  }

  // Deep scan: read barrel index for exported names
  const distDir = path.join(projectRoot, 'node_modules', name, 'dist')
  if (fs.existsSync(distDir)) {
    scanDistForNames(distDir, name, capabilities)
  }

  return { name, key, version, description, installed, exports, capabilities }
}

/**
 * Scan .d.ts files in dist/ for exported class/function names
 * to detect route factories, schemas, repositories, components.
 */
function scanDistForNames(distDir: string, _pkgName: string, caps: ModuleCapabilities) {
  const dtsFiles = findFiles(distDir, '.d.ts', 3)

  for (const file of dtsFiles) {
    let content: string
    try {
      content = fs.readFileSync(file, 'utf-8')
    } catch {
      continue
    }

    // Route factories: export function createXxxHandler
    const routeMatches = content.matchAll(/export\s+(?:declare\s+)?function\s+(create\w+Handler)/g)
    for (const m of routeMatches) {
      caps.hasRoutes = true
      if (!caps.routeFactories.includes(m[1])) caps.routeFactories.push(m[1])
    }

    // Schemas: export const XxxSchema
    const schemaMatches = content.matchAll(/export\s+(?:declare\s+)?(?:const|let)\s+(\w+Schema)\b/g)
    for (const m of schemaMatches) {
      caps.hasSchemas = true
      if (!caps.schemaNames.includes(m[1])) caps.schemaNames.push(m[1])
    }

    // Repositories: export class XxxRepository
    const repoMatches = content.matchAll(/export\s+(?:declare\s+)?class\s+(\w+Repository)\b/g)
    for (const m of repoMatches) {
      caps.hasRepositories = true
      if (!caps.repositoryNames.includes(m[1])) caps.repositoryNames.push(m[1])
    }

    // Components: export default function XxxComponent / export function Xxx
    const basename = path.basename(file, '.d.ts')
    if (file.includes('/components/')) {
      caps.hasComponents = true
      if (!caps.componentNames.includes(basename)) caps.componentNames.push(basename)
    }
  }
}

/** Recursively find files with given extension, up to maxDepth */
function findFiles(dir: string, ext: string, maxDepth: number, depth = 0): string[] {
  if (depth > maxDepth) return []
  const results: string[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...findFiles(full, ext, maxDepth, depth + 1))
      } else if (entry.name.endsWith(ext)) {
        results.push(full)
      }
    }
  } catch {
    // permission error, etc.
  }
  return results
}
