"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle, AlertTriangle, Search, Package2 } from "lucide-react"
import { useInventoryStore } from "@/lib/inventory-store"
import { toast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function InventoryVerification() {
  const { pendingInventory, verifyInventory, holdInventory: placeOnHold } = useInventoryStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [filterLocation, setFilterLocation] = useState("all")
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [isVerifying, setIsVerifying] = useState(false)
  const [isHoldDialogOpen, setIsHoldDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [holdReason, setHoldReason] = useState("")
  const [refreshKey, setRefreshKey] = useState(0) // Add a refresh key

  // Filter pending inventory
  const filteredPendingInventory = Array.isArray(pendingInventory)
    ? pendingInventory.filter((item) => {
        const matchesLocation = filterLocation === "all" || item.location === filterLocation
        const matchesSearch =
          item.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.invoiceNumber && item.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()))

        return matchesLocation && matchesSearch
      })
    : []

  // Toggle item selection
  const toggleItemSelection = (id: string) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter((itemId) => itemId !== id))
    } else {
      setSelectedItems([...selectedItems, id])
    }
  }

  // Select all items
  const selectAllItems = () => {
    if (selectedItems.length === filteredPendingInventory.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(filteredPendingInventory.map((item) => item.id))
    }
  }

  // Verify selected items
  const verifySelectedItems = async () => {
    if (selectedItems.length === 0) return

    setIsVerifying(true)

    try {
      // Verify each selected item
      for (const itemId of selectedItems) {
        await verifyInventory(itemId, "current-user")
      }

      // Show success toast
      toast({
        title: "Inventory verified",
        description: `${selectedItems.length} items have been verified and added to available inventory.`,
        action: <ToastAction altText="OK">OK</ToastAction>,
      })

      // Clear selection
      setSelectedItems([])
      setRefreshKey((prevKey) => prevKey + 1) // Update refresh key instead of reloading
    } catch (error) {
      console.error("Error verifying inventory:", error)
      toast({
        title: "Error",
        description: "There was an error verifying the inventory. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsVerifying(false)
    }
  }

  // Open hold dialog
  const openHoldDialog = (item: any) => {
    setSelectedItem(item)
    setHoldReason("")
    setIsHoldDialogOpen(true)
  }

  // Handle placing inventory on hold
  const handlePlaceOnHold = () => {
    if (!selectedItem || !holdReason) return

    try {
      // Place inventory on hold
      placeOnHold(selectedItem.id, holdReason, "current-user")

      // Show success toast
      toast({
        title: "Inventory placed on hold",
        description: `${selectedItem.quantity} ${selectedItem.type} batteries have been placed on hold. Reason: ${holdReason}`,
        action: <ToastAction altText="OK">OK</ToastAction>,
      })

      // Close dialog and reset
      setIsHoldDialogOpen(false)
      setSelectedItem(null)
      setHoldReason("")
      setRefreshKey((prevKey) => prevKey + 1) // Update refresh key instead of reloading
    } catch (error) {
      console.error("Error placing inventory on hold:", error)
      toast({
        title: "Error",
        description: "There was an error placing the inventory on hold. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    try {
      return new Date(dateString).toLocaleString()
    } catch (error) {
      return "Invalid date"
    }
  }

  // Get category color
  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case "alpha":
        return "bg-green-100 text-green-800"
      case "bravo":
        return "bg-blue-100 text-blue-800"
      case "charlie":
        return "bg-purple-100 text-purple-800"
      case "amg":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Get invoice badge
  const getInvoiceBadge = (invoiceNumber: string) => {
    if (!invoiceNumber) return null

    if (invoiceNumber.startsWith("TARAB-")) {
      return (
        <Badge variant="outline" className="bg-amber-100 text-amber-800">
          {invoiceNumber}
        </Badge>
      )
    }

    return (
      <Badge variant="outline" className="bg-blue-100 text-blue-800">
        {invoiceNumber}
      </Badge>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <CardTitle className="text-xl">Inventory Verification</CardTitle>
            <CardDescription className="text-base">
              Verify received inventory before it can be assigned to trucks
            </CardDescription>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search inventory..."
                className="pl-8 w-full sm:w-[200px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={filterLocation} onValueChange={setFilterLocation}>
              <SelectTrigger className="w-full sm:w-[180px]">
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
      </CardHeader>

      <CardContent className="px-6 pb-2">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={
                      filteredPendingInventory.length > 0 && selectedItems.length === filteredPendingInventory.length
                    }
                    onChange={selectAllItems}
                  />
                </TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Received Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody key={refreshKey}>
              {filteredPendingInventory.length > 0 ? (
                filteredPendingInventory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getCategoryColor(item.type)}>
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.model || "N/A"}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{getInvoiceBadge(item.invoiceNumber || "")}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          item.location?.toLowerCase() === "broadway"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-purple-100 text-purple-800"
                        }
                      >
                        {item.location}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(item.receivedDate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openHoldDialog(item)}
                          className="bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                        >
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Hold
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            toggleItemSelection(item.id)
                            if (!selectedItems.includes(item.id)) {
                              setSelectedItems([...selectedItems, item.id])
                            }
                          }}
                          className="bg-green-50 text-green-800 border-green-200 hover:bg-green-100"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Verify
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Package2 className="h-8 w-8 mb-2 opacity-50" />
                      <p>No pending inventory to verify</p>
                      <p className="text-sm">All items have been verified or no new deliveries have been received</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {selectedItems.length > 0 && (
          <div className="mt-4 flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {selectedItems.length} {selectedItems.length === 1 ? "item" : "items"} selected
            </p>
            <Button onClick={verifySelectedItems} disabled={isVerifying}>
              {isVerifying ? (
                <>
                  <span className="animate-spin mr-2">⟳</span>
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Verify Selected
                </>
              )}
            </Button>
          </div>
        )}

        {filteredPendingInventory.length > 0 && selectedItems.length === 0 && (
          <div className="mt-4 flex items-center justify-center p-2 bg-amber-50 text-amber-800 rounded-md">
            <AlertTriangle className="h-4 w-4 mr-2" />
            <p className="text-sm">Select items to verify them and add them to available inventory</p>
          </div>
        )}
      </CardContent>

      {/* Place on Hold Dialog */}
      <Dialog open={isHoldDialogOpen} onOpenChange={setIsHoldDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Place Inventory on Hold</DialogTitle>
            <DialogDescription>Specify the reason for placing this inventory on hold</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {selectedItem && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Type</p>
                    <p>{selectedItem.type}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Model</p>
                    <p>{selectedItem.model}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Quantity</p>
                    <p>{selectedItem.quantity}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Location</p>
                    <p>{selectedItem.location.charAt(0).toUpperCase() + selectedItem.location.slice(1)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium">Invoice Number</p>
                  <p>{selectedItem.invoiceNumber || "N/A"}</p>
                </div>

                <div>
                  <p className="text-sm font-medium">Received Date</p>
                  <p>{formatDate(selectedItem.receivedDate)}</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="hold-reason" className="text-sm font-medium">
                    Hold Reason <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="hold-reason"
                    placeholder="Enter reason for placing on hold"
                    value={holdReason}
                    onChange={(e) => setHoldReason(e.target.value)}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center text-amber-600 bg-amber-50 p-3 rounded-md">
                  <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
                  <p className="text-sm">
                    Placing inventory on hold will prevent it from being verified or assigned until the issue is
                    resolved.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHoldDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePlaceOnHold} disabled={!holdReason} className="bg-amber-600 hover:bg-amber-700">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Place on Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
