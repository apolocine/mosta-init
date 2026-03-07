// @mostajs/init — Menu contribution
// Author: Dr Hamid MADANI drmdh@msn.com

import { Blocks, LayoutTemplate, Database } from 'lucide-react'
import type { ModuleMenuContribution } from '@mostajs/menu'

export const initMenuContribution: ModuleMenuContribution = {
  moduleKey: 'init',
  order: 95,
  groups: [
    {
      label: 'Developpement',
      icon: Blocks,
      items: [
        {
          label: 'init.schemaDesigner.title',
          href: '/dashboard/dev/schema-designer',
          icon: Database,
          permission: 'admin:access',
        },
        {
          label: 'init.pageDesigner.title',
          href: '/dashboard/dev/page-designer',
          icon: LayoutTemplate,
          permission: 'admin:access',
        },
      ],
    },
  ],
}
