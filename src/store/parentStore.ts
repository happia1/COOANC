import { create } from 'zustand'

type ParentStore = {
  selectedChildId: string | null
  setSelectedChildId: (id: string | null) => void
  /** 자녀 삭제 시 선택이 그 id 면 해제 → 홈/루틴이 첫 자녀로 맞춤 */
  clearSelectionIfChildRemoved: (removedChildId: string) => void
}

export const useParentStore = create<ParentStore>((set, get) => ({
  selectedChildId: null,
  setSelectedChildId: (id) => set({ selectedChildId: id }),
  clearSelectionIfChildRemoved: (removedChildId) => {
    if (get().selectedChildId === removedChildId) {
      set({ selectedChildId: null })
    }
  },
}))
