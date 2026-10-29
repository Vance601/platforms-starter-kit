"use client"

// Real users of the signed-in user's organization (same source as
// /admin/users). Replaces the old demo list from lib/user-store.ts, which was
// hardcoded sample data (John Doe, Jane Smith, Mike Johnson) and never in the DB.
import { useEffect, useState } from "react"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type U = {
  id: string
  name: string | null
  email: string | null
  role: string
  status: string | null
  has_password: boolean
}

export function UserManagement() {
  const [users, setUsers] = useState<U[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/admin/users", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setUsers(d.users)
        else setError(d.error || "Could not load users")
      })
      .catch(() => setError("Could not load users"))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link href="/admin/users">Reset passwords</Link>
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users in your organization.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Password</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name || "-"}</TableCell>
                <TableCell>{u.email || "-"}</TableCell>
                <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                <TableCell>{u.status || "-"}</TableCell>
                <TableCell>{u.has_password ? "set" : "none"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
