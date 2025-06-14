"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle, Clock, AlertTriangle, Eye } from "lucide-react"
import { useInventoryStore } from "@/lib/inventory-store"

interface ReceivedOrdersListProps {
  filter: "all" | "pending" | "completed" | "holding"
}

export function ReceivedOrdersList({ filter }: ReceivedOrdersListProps) {
  const { pendingInventory, holdInventory, verifiedInventory, inventoryHistory } = useInventoryStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [locationFilter, setLocationFilter] = useState("all")

  // Sample data for received orders
  const receivedOrders = [
    {
      id: "order-001",
      invoiceNumber: "INV-24581",
      date: "Jan 17, 2025",
      poNumber: "PO-11625",
      location: "Broadway",
      status: "completed",
      items: [
        { type: "Alpha", quantity: 9 },
        { type: "Bravo", quantity: 8 },
        { type: "Charlie", quantity: 8 },
        { type: "AMG", quantity: 13 },
      ],
      verifiedBy: "John Smith",
      verifiedDate: "Jan 18, 2025",
    },
    {
      id: "order-002",
      invoiceNumber: "INV-24582",
      date: "Jan 19, 2025",
      poNumber: "PO-11626",
      location: "Camelback",
      status: "pending",
      items: [
        { type: "Alpha", quantity: 5 },
        { type: "Bravo", quantity: 3 },
        { type: "AMG", quantity: 2 },
      ],
    },
    {
      id: "order-003",
      invoiceNumber: "INV-24583",
      date: "Jan 20, 2025",
      poNumber: "PO-11627",
      location: "Broadway",
      status: "holding",
      items: [
        { type: "Charlie", quantity: 4 },
        { type: "AMG", quantity: 6 },
      ],
      holdReason: "Damaged packaging, waiting for inspection",
      heldBy: "Mike Johnson",
      heldDate: "Jan 20, 2025",
    },
    {
      id: "order-004",
      invoiceNumber: "INV-24584",
      date: "Jan 21, 2025",
      poNumber: "PO-11628",
      location: "Camelback",
      status: "holding",
      items: [
        { type: "Alpha", quantity: 7 },
        { type: "Bravo", quantity: 5 },
      ],
      holdReason: "Incorrect model received, awaiting vendor response",
      heldBy: "Sarah Williams",
      heldDate: "Jan 21, 2025",
    },
    {
      id: "order-005",
      invoiceNumber: "INV-24585",
      date: "Jan 22, 2025",
      poNumber: "PO-11629",
      location: "Broadway",
      status: "holding",
      items: [
        { type: "Charlie", quantity: 3 },
        { type: "AMG", quantity: 4 },
      ],
      holdReason: "Quality control issue - pending inspection",
      heldBy: "David Brown",
      heldDate: "Jan 22, 2025",
    },
    {
      id: "order-006",
      invoiceNumber: "INV-24586",
      date: "Jan 23, 2025",
      poNumber: "PO-11630",
      location: "Camelback",
      status: "completed",
      items: [
        { type: "Alpha", quantity: 6 },
        { type: "Bravo", quantity: 4 },
        { type: "Charlie", quantity: 5 },
      ],
      verifiedBy: "Lisa Garcia",
      verifiedDate: "Jan 24, 2025",
    },
  ]

  // Filter orders based on the filter prop
  const filteredOrders = receivedOrders.filter((order) => {
    // Filter by status
    if (filter !== "all" && order.status !== filter) return false

    // Filter by search query
    if (
      searchQuery &&
      !order.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !order.poNumber.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false
    }

    // Filter by location
    if (locationFilter !== "all" && order.location.toLowerCase() !== locationFilter.toLowerCase()) {
      return false
    }

    return true
  })

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending Verification
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        )
      case "holding":
        return (
          <Badge variant="outline" className="bg-amber-100 text-amber-800">
            <AlertTriangle className="h-3 w-3 mr-1" />
            On Hold
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              type="search"
              placeholder="Search by invoice or PO number..."
              className="w-[300px] pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="broadway">Broadway</SelectItem>
              <SelectItem value="camelback">Camelback</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>PO Number</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.invoiceNumber}</TableCell>
                <TableCell>{order.date}</TableCell>
                <TableCell>{order.poNumber}</TableCell>
                <TableCell>{order.location}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {order.items.map((item, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {item.type}: {item.quantity}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(order.status)}</TableCell>
                <TableCell>
                  {order.status === "completed" && (
                    <div className="text-xs text-muted-foreground">
                      <div>Verified by: {order.verifiedBy}</div>
                      <div>Date: {order.verifiedDate}</div>
                    </div>
                  )}
                  {order.status === "holding" && (
                    <div className="text-xs text-amber-700">
                      <div>Reason: {order.holdReason}</div>
                      <div>Held by: {order.heldBy}</div>
                      <div>Date: {order.heldDate}</div>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {filteredOrders.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
                  No orders found matching your criteria
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
