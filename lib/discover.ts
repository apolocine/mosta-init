// @mostajs/init — Module discovery
// Author: Dr Hamid MADANI drmdh@msn.com
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import type { ModuleInfo } from '../types/index.js'
import { analyzeModule } from './analyze.js'

const execAsync = promisify(exec)

interface NpmSearchResult {
  name: string
  description: string
  version: string
}

/**
 * Discover all @mostajs/* packages from npm registry + local node_modules.
 *
 * 1. Searches npm registry for @mostajs scoped packages
 * 2. Scans node_modules/@mostajs/ for locally installed packages
 * 3. Merges both lists (npm wins for metadata, local wins for installed status)
 * 4. Analyzes each module's package.json for capabilities
 */
export async function discoverModules(projectRoot: string): Promise<ModuleInfo[]> {
  const found = new Map<string, { name: string; version: string; description: string; installed: boolean }>()

  // 1. Scan node_modules/@mostajs/
  const nmBase = path.join(projectRoot, 'node_modules', '@mostajs')
  try {
    if (fs.existsSync(nmBase)) {
      const entries = fs.readdirSync(nmBase, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const pkgPath = path.join(nmBase, entry.name, 'package.json')
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
          found.set(pkg.name, {
            name: pkg.name,
            version: pkg.version || '0.0.0',
            description: pkg.description || '',
            installed: true,
          })
        } catch {
          // skip broken packages
        }
      }
    }
  } catch {
    // node_modules scan failed
  }

  // 2. Search npm registry (10s timeout)
  try {
    const { stdout } = await execAsync('npm search @mostajs --json 2>/dev/null', {
      timeout: 10_000,
    })
    const results: NpmSearchResult[] = JSON.parse(stdout)
    for (const pkg of results) {
      if (!pkg.name.startsWith('@mostajs/')) continue
      if (!found.has(pkg.name)) {
        found.set(pkg.name, {
          name: pkg.name,
          version: pkg.version,
          description: pkg.description || '',
          installed: false,
        })
      } else {
        // Update description/version from npm but keep installed=true
        const existing = found.get(pkg.name)!
        existing.description = pkg.description || existing.description
      }
    }
  } catch {
    // npm search failed (offline, timeout) — continue with local only
  }

  // 3. Analyze each module
  const modules: ModuleInfo[] = []
  for (const [, info] of found) {
    const key = info.name.replace('@mostajs/', '')
    const moduleInfo = await analyzeModule(projectRoot, info.name, key, info.version, info.description, info.installed)
    modules.push(moduleInfo)
  }

  // Sort: installed first, then alphabetically
  modules.sort((a, b) => {
    if (a.installed !== b.installed) return a.installed ? -1 : 1
    return a.key.localeCompare(b.key)
  })

  return modules
}
