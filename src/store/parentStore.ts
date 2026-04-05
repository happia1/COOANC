import { create } from 'zustand'

type ParentStore = {
  selectedChildId: string | null
  setSelectedChildId: (id: string | null) => void
}

export const useParentStore = create<ParentStore>((set) => ({
  selectedChildId: null,
  setSelectedChildId: (id) => set({ selectedChildId: id }),
}))
