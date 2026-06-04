'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PlantHarvestInventoryRow } from '@/lib/plantHarvest'
import { parseJsonFromResponse } from '@/lib/parseJsonResponse'

export function usePlantHarvest(childId: string) {
  const [items, setItems] = useState<PlantHarvestInventoryRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ childId })
      const res = await fetch(`/api/child/plant-harvest-inventory?${q}`, {
        credentials: 'same-origin',
      })
      const { data, parseError } = await parseJsonFromResponse<{ items?: PlantHarvestInventoryRow[] }>(res)
      if (!parseError && res.ok && Array.isArray(data?.items)) {
        setItems(data.items)
      }
    } catch (e) {
      console.warn('[usePlantHarvest] fetch', e)
    } finally {
      setLoading(false)
    }
  }, [childId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const totalCount = items.reduce((sum, row) => sum + row.quantity, 0)

  return { items, loading, totalCount, refresh }
}
