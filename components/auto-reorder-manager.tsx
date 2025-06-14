"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useEffect, useRef } from "react"

// Define types
export interface ReorderItem {
  id: string
  type: string
  model: string
  quantity: number
  location: string
  threshold: number
  current: number
  notes?: string
}

export interface Reorder {
  id: string
  date: string
  location: string
  status: "pending" | "processed" | "cancelled"
  items: ReorderItem[]
  notes?: string
}

// Add updateReorderItems to the AutoReorderState interface
export interface AutoReorderState {
  reorders: Reorder[]
  lastCheck: string | null
  addReorder: (reorder: Omit<Reorder, "id">) => string
  updateReorderStatus: (id: string, status: Reorder["status"]) => void
  addItemToReorder: (reorderId: string, item: Omit<ReorderItem, "id">) => void
  removeItemFromReorder: (reorderId: string, itemId: string) => void
  updateItemQuantity: (reorderId: string, itemId: string, quantity: number) => void
  updateReorderItems: (reorderId: string, items: ReorderItem[]) => void
  updateReorderNotes: (reorderId: string, notes: string) => void
  getReordersByLocation: (location: string) => Reorder[]
  getPendingReorders: () => Reorder[]
  getReorderById: (id: string) => Reorder | undefined
  updateLastCheck: () => void
  addAlertToReorder: (alert: any, quantity: number, notes?: string) => void
}

// Add the updateReorderItems and updateReorderNotes functions to the store implementation
export const useAutoReorderStore = create<AutoReorderState>()(
  persist(
    (set, get) => ({
      reorders: [],
      lastCheck: null,

      addReorder: (reorder) => {
        const id = `reorder-${Date.now()}`
        set((state) => ({
          reorders: [
            ...(Array.isArray(state.reorders) ? state.reorders : []),
            {
              ...reorder,
              id,
              items: Array.isArray(reorder.items) ? reorder.items : [],
            },
          ],
        }))
        return id
      },

      updateReorderStatus: (id, status) => {
        set((state) => {
          if (!Array.isArray(state.reorders)) {
            return { reorders: [] }
          }

          return {
            reorders: state.reorders.map((reorder) => (reorder.id === id ? { ...reorder, status } : reorder)),
          }
        })
      },

      addItemToReorder: (reorderId, item) => {
        set((state) => {
          if (!Array.isArray(state.reorders)) {
            return state
          }

          const reorderIndex = state.reorders.findIndex((r) => r.id === reorderId)
          if (reorderIndex === -1) return state

          const updatedReorders = [...state.reorders]
          const reorder = updatedReorders[reorderIndex]

          // Ensure items array exists
          const items = Array.isArray(reorder.items) ? [...reorder.items] : []

          // Add the new item
          const newItem = {
            ...item,
            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          }

          items.push(newItem)

          updatedReorders[reorderIndex] = {
            ...reorder,
            items,
          }

          return { reorders: updatedReorders }
        })
      },

      removeItemFromReorder: (reorderId, itemId) => {
        set((state) => {
          if (!Array.isArray(state.reorders)) {
            return state
          }

          const reorderIndex = state.reorders.findIndex((r) => r.id === reorderId)
          if (reorderIndex === -1) return state

          const updatedReorders = [...state.reorders]
          const reorder = updatedReorders[reorderIndex]

          // Ensure items array exists before filtering
          if (!Array.isArray(reorder.items)) return state

          updatedReorders[reorderIndex] = {
            ...reorder,
            items: reorder.items.filter((item) => item.id !== itemId),
          }

          return { reorders: updatedReorders }
        })
      },

      updateItemQuantity: (reorderId, itemId, quantity) => {
        set((state) => {
          if (!Array.isArray(state.reorders)) {
            return state
          }

          const reorderIndex = state.reorders.findIndex((r) => r.id === reorderId)
          if (reorderIndex === -1) return state

          const updatedReorders = [...state.reorders]
          const reorder = updatedReorders[reorderIndex]

          // Ensure items array exists before updating
          if (!Array.isArray(reorder.items)) return state

          updatedReorders[reorderIndex] = {
            ...reorder,
            items: reorder.items.map((item) => (item.id === itemId ? { ...item, quantity: quantity } : item)),
          }

          return { reorders: updatedReorders }
        })
      },

      // Add the updateReorderItems function
      updateReorderItems: (reorderId, items) => {
        set((state) => {
          if (!Array.isArray(state.reorders)) {
            return state
          }

          const reorderIndex = state.reorders.findIndex((r) => r.id === reorderId)
          if (reorderIndex === -1) return state

          const updatedReorders = [...state.reorders]
          updatedReorders[reorderIndex] = {
            ...updatedReorders[reorderIndex],
            items: items,
          }

          return { reorders: updatedReorders }
        })
      },

      // Add the updateReorderNotes function
      updateReorderNotes: (reorderId, notes) => {
        set((state) => {
          if (!Array.isArray(state.reorders)) {
            return state
          }

          const reorderIndex = state.reorders.findIndex((r) => r.id === reorderId)
          if (reorderIndex === -1) return state

          const updatedReorders = [...state.reorders]
          updatedReorders[reorderIndex] = {
            ...updatedReorders[reorderIndex],
            notes: notes,
          }

          return { reorders: updatedReorders }
        })
      },

      getReordersByLocation: (location) => {
        const reorders = get().reorders
        if (!Array.isArray(reorders)) {
          return []
        }
        return reorders.filter((reorder) => reorder.location === location)
      },

      getPendingReorders: () => {
        const reorders = get().reorders
        if (!Array.isArray(reorders)) {
          return []
        }
        return reorders.filter((reorder) => reorder.status === "pending")
      },

      getReorderById: (id) => {
        const reorders = get().reorders
        if (!Array.isArray(reorders)) {
          return undefined
        }
        return reorders.find((reorder) => reorder.id === id)
      },

      updateLastCheck: () => {
        set({ lastCheck: new Date().toISOString() })
      },

      addAlertToReorder: (alert, quantity, notes) => {
        const { reorders, addReorder, addItemToReorder } = get()

        if (!alert || !alert.item || !alert.location) {
          console.error("Invalid alert data", alert)
          return
        }

        try {
          // Extract battery type from alert item (e.g., "Alpha Batteries" -> "Alpha")
          const batteryType = alert.item.split(" ")[0]

          // Find existing pending reorder for this location
          const today = new Date().toISOString().split("T")[0]
          const existingReorder = Array.isArray(reorders)
            ? reorders.find((r) => r.location === alert.location && r.status === "pending" && r.date.startsWith(today))
            : undefined

          // Create reorder item
          const reorderItem = {
            type: batteryType,
            model: `${batteryType}-Standard`, // Default model name
            quantity: quantity,
            location: alert.location,
            threshold: alert.threshold || 0,
            current: alert.current || 0,
            notes: notes || `Added from alert: ${alert.item}`,
          }

          if (existingReorder) {
            // Add to existing reorder
            addItemToReorder(existingReorder.id, reorderItem)
          } else {
            // Create new reorder
            addReorder({
              date: new Date().toISOString(),
              location: alert.location,
              status: "pending",
              items: [{ ...reorderItem, id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` }],
              notes: `Auto-generated from alert: ${alert.item}`,
            })
          }
        } catch (error) {
          console.error("Error in addAlertToReorder:", error)
        }
      },
    }),
    {
      name: "auto-reorder-storage",
    },
  ),
)

// Hook for managing auto-reorders
export function useAutoReorderManager() {
  const store = useAutoReorderStore()
  // Use a ref to track if we've already done the initial check
  const initialCheckDone = useRef(false)

  // Check inventory levels and create reorders if needed
  useEffect(() => {
    // Skip if we've already done the initial check
    if (initialCheckDone.current) return

    const checkInventoryLevels = () => {
      try {
        // This would normally check inventory levels and create reorders
        // For demo purposes, we'll just update the last check time
        store.updateLastCheck()
      } catch (error) {
        console.error("Error checking inventory levels:", error)
      }
    }

    // Check inventory levels every 5 minutes, but don't set up the interval
    // in development to avoid unnecessary state updates
    let intervalId: NodeJS.Timeout | null = null

    if (process.env.NODE_ENV === "production") {
      intervalId = setInterval(checkInventoryLevels, 5 * 60 * 1000)
    }

    // Initial check (only once)
    checkInventoryLevels()
    initialCheckDone.current = true

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, []) // Empty dependency array to run only once

  return store
}
