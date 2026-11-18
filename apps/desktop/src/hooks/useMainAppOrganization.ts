import type { Group } from '@/lib/types'

import { useCollectionsCrud } from './useCollectionsCrud'
import { useMainAppCollectionEditor } from './useMainAppCollectionEditor'
import { useMainAppGroupEditor } from './useMainAppGroupEditor'

/**
 * Compose remote organization writes with the collection and group editors that consume them.
 * MainApp uses one organization controller so each editor shares the same confirmed write boundary.
 * @example const organization = useMainAppOrganization(groups)
 */
export function useMainAppOrganization(groups: Group[]) {
  const operations = useCollectionsCrud()
  const collections = useMainAppCollectionEditor(groups, operations)
  const groupEditor = useMainAppGroupEditor(groups, operations.updateUserGroups)
  return { ...operations, ...collections, ...groupEditor }
}
