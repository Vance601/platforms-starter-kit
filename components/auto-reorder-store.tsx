"use client"

import { create } from "zustand"

interface AutoReorderState {
  reorders: any[]
  addReorder: (reorder: any) => void
  updateReorderStatus: (id: string, status: string) => void
  addItemToReorder: (reorderId: string, item: any) => void
  removeItemFromReorder: (reorderId: string, itemId: string) => void
  updateItemQuantity: (reorderId: string, itemId: string, quantity: number) => void
  updateReorderItems: (reorderId: string, items: any[]) => void
  updateReorderNotes: (reorderId: string, notes: string) => void
}

export const useAutoReorderStore = create<AutoReorderState>((set) => ({
  reorders: [],
  addReorder: (reorder) =>
    set((state) => ({
      reorders: [...state.reorders, { ...reorder, id: `reorder-${Date.now()}` }],
    })),
  updateReorderStatus: (id, status) =>
    set((state) => ({
      reorders: state.reorders.map((reorder) => (reorder.id === id ? { ...reorder, status } : reorder)),
    })),
  addItemToReorder: (reorderId, item) =>
    set((state) => ({
      reorders: state.reorders.map((reorder) =>
        reorder.id === reorderId ? { ...reorder, items: [...(reorder.items || []), item] } : reorder,
      ),
    })),
  removeItemFromReorder: (reorderId, itemId) =>
    set((state) => ({
      reorders: state.reorders.map((reorder) =>
        reorder.id === reorderId ? { ...reorder, items: reorder.items.filter((item) => item.id !== itemId) } : reorder,
      ),
    })),
  updateItemQuantity: (reorderId, itemId, quantity) =>
    set((state) => ({
      reorders: state.reorders.map((reorder) =>
        reorder.id === reorderId
          ? {
              ...reorder,
              items: reorder.items.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
            }
          : reorder,
      ),
    })),
  updateReorderItems: (reorderId, items) =>
    set((state) => ({
      reorders: state.reorders.map((reorder) => (reorder.id === reorderId ? { ...reorder, items } : reorder)),
    })),
  updateReorderNotes: (reorderId, notes) =>
    set((state) => ({
      reorders: state.reorders.map((reorder) => (reorder.id === reorderId ? { ...reorder, notes } : reorder)),
    })),
}))

export function useAutoReorderManager() {
  return useAutoReorderStore()
}
