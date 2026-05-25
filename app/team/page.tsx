"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Users, Building2 } from "lucide-react"

type Driver = {
  id: string
  name: string
  active: boolean
  company: string
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function TeamPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetch("/api/drivers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success && Array.isArray(j.drivers)) setDrivers(j.drivers)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const query = searchQuery.toLowerCase()
  const filtered = query
    ? drivers.filter(
        (d) =>
          d.name.toLowerCase().includes(query) ||
          d.company.toLowerCase().includes(query),
      )
    : drivers

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Team</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <p className="text-lg text-muted-foreground">Loading…</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-1">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{drivers.length}</div>
                <p className="text-xs text-muted-foreground">Active drivers on the roster</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search drivers..."
                className="pl-8 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Drivers</CardTitle>
              <CardDescription>Live roster from the database</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {filtered.length > 0 ? (
                  filtered.map((driver) => (
                    <div key={driver.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{initials(driver.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium">{driver.name}</h3>
                          <p className="text-sm text-muted-foreground flex items-center">
                            <Building2 className="mr-1 h-3 w-3" />
                            {driver.company}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={driver.active ? "default" : "outline"}>
                          {driver.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium">No drivers found</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {drivers.length === 0
                        ? "No active drivers in the database yet."
                        : "Try adjusting your search."}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
