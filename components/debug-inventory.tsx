"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useInventoryStore } from "@/lib/inventory-store"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function DebugInventory() {
  const { inventory, pendingInventory, holdInventory, verifiedInventory } = useInventoryStore()
  const [selectedLocation, setSelectedLocation] = useState<string>("all")
  const [showDebug, setShowDebug] = useState(false)

  const filteredInventory =
    selectedLocation === "all"
      ? inventory
      : inventory.filter((item) => item.locations[selectedLocation as "broadway" | "camelback"] > 0)

  const filteredPending =
    selectedLocation === "all"
      ? pendingInventory
      : pendingInventory.filter((item) => item.location.toLowerCase() === selectedLocation.toLowerCase())

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Inventory Debug</CardTitle>
        <Button variant="outline" onClick={() => setShowDebug(!showDebug)}>
          {showDebug ? "Hide Details" : "Show Details"}
        </Button>
      </CardHeader>
      {showDebug && (
        <CardContent>
          <div className="mb-4">
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="broadway">Broadway</SelectItem>
                <SelectItem value="camelback">Camelback</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Verified Inventory</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Broadway</TableHead>
                    <TableHead>Camelback</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.length > 0 ? (
                    filteredInventory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.type}</TableCell>
                        <TableCell>{item.model}</TableCell>
                        <TableCell>{item.locations.broadway || 0}</TableCell>
                        <TableCell>{item.locations.camelback || 0}</TableCell>
                        <TableCell>{item.totalCount}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        No inventory found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">Pending Inventory</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPending.length > 0 ? (
                    filteredPending.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.type}</TableCell>
                        <TableCell>{item.model}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.location}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                            Pending
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        No pending inventory
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
