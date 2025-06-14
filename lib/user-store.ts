import { create } from "zustand"
import { persist } from "zustand/middleware"

export type UserRole = "admin" | "manager" | "technician"

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  location: string
  phone: string
  active: boolean
  createdAt: string
}

interface UserState {
  users: User[]
  addUser: (user: Omit<User, "id" | "createdAt">) => void
  updateUser: (id: string, updates: Partial<User>) => void
  deleteUser: (id: string) => void
}

// Sample initial users
const initialUsers: User[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john@duggers.com",
    role: "admin",
    location: "Broadway",
    phone: "(602) 555-1234",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@duggers.com",
    role: "manager",
    location: "Camelback",
    phone: "(602) 555-5678",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "3",
    name: "Mike Johnson",
    email: "mike@duggers.com",
    role: "technician",
    location: "Broadway",
    phone: "(602) 555-9012",
    active: true,
    createdAt: new Date().toISOString(),
  },
]

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      users: initialUsers,
      addUser: (user) =>
        set((state) => ({
          users: [
            ...state.users,
            {
              ...user,
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      updateUser: (id, updates) =>
        set((state) => ({
          users: state.users.map((user) => (user.id === id ? { ...user, ...updates } : user)),
        })),
      deleteUser: (id) =>
        set((state) => ({
          users: state.users.filter((user) => user.id !== id),
        })),
    }),
    {
      name: "user-storage",
    },
  ),
)
