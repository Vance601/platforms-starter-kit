"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { useAutoReorderManager } from "@/components/auto-reorder-manager"
import { PackagePlus, CheckCircle, XCircle, Clock, Filter, ArrowUpDown, Search, Building2, Edit2 } from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/components/ui/use-toast"
import { CombinedOrdersView } from "@/components/combined-orders-view"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Minus, Layers } from "lucide-react"

export default function AutoReordersPage() {
  const { reorders, updateReorderStatus, updateReorderItems, updateReorderNotes } = useAutoReorderManager()
  const [filteredReorders, setFilteredReorders] = useState<any[]>([])
  const [locationFilter, setLocationFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [sortOrder, setSortOrder] = useState<string>("newest")
  const [activeTab, setActiveTab] = useState<string>("all")
  const { toast } = useToast()
  const [editingReorder, setEditingReorder] = useState<any>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editedItems, setEditedItems] = useState<any[]>([])
  const [orderNotes, setOrderNotes] = useState("")
  const [locationSpecificView, setLocationSpecificView] = useState<string | null>(null)
  const [showCombinedView, setShowCombinedView] = useState(false)

  // Apply filters and sorting
  useEffect(() => {
    if (!reorders) {
      setFilteredReorders([])
      return
    }

    let filtered = [...reorders]

    // Filter by tab (status)
    if (activeTab !== "all" && activeTab !== "combined") {
      filtered = filtered.filter((order) => order.status === activeTab)
    }

    // Filter by location dropdown
    if (locationFilter !== "all") {
      filtered = filtered.filter((order) => order.location === locationFilter)
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (order) =>
          order.location.toLowerCase().includes(query) ||
          order.notes?.toLowerCase().includes(query) ||
          order.items.some((item) => item.type.toLowerCase().includes(query)),
      )
    }

    // Apply sorting
    switch (sortOrder) {
      case "newest":
        filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        break
      case "oldest":
        filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        break
      case "most-items":
        filtered.sort((a, b) => b.items.length - a.items.length)
        break
      case "fewest-items":
        filtered.sort((a, b) => a.items.length - b.items.length)
        break
    }

    setFilteredReorders(filtered)
  }, [reorders, locationFilter, searchQuery, sortOrder, activeTab])

  // Handle processing a reorder
  const handleProcessReorder = (reorderId: string) => {
    updateReorderStatus(reorderId, "processed")
    toast({
      title: "Reorder Processed",
      description: "The reorder has been marked as processed",
    })
  }

  // Handle cancelling a reorder
  const handleCancelReorder = (reorderId: string) => {
    updateReorderStatus(reorderId, "cancelled")
    toast({
      title: "Reorder Cancelled",
      description: "The reorder has been cancelled",
    })
  }

  // Handle editing a reorder
  const handleEditReorder = (reorder: any) => {
    setEditingReorder(reorder)
    setEditedItems(JSON.parse(JSON.stringify(reorder.items)))
    setOrderNotes(reorder.notes || "")
    setEditDialogOpen(true)
  }

  // Handle updating quantity
  const handleUpdateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) newQuantity = 1

    const updatedItems = [...editedItems]
    updatedItems[index] = { ...updatedItems[index], quantity: newQuantity }
    setEditedItems(updatedItems)
  }

  // Handle saving changes
  const handleSaveChanges = () => {
    // Update items in the reorder
    updateReorderItems(editingReorder.id, editedItems)

    // Update notes if changed
    if (orderNotes !== editingReorder.notes) {
      updateReorderNotes(editingReorder.id, orderNotes)
    }

    toast({
      title: "Order Updated",
      description: "The order has been updated successfully",
    })

    setEditDialogOpen(false)
  }

  // Handle showing combined view for a specific location
  const handleShowCombinedLocation = (location: string) => {
    setLocationSpecificView(location)
    setShowCombinedView(true)
  }

  // Get counts for tabs
  const pendingCount = reorders?.filter((order) => order.status === "pending").length || 0
  const processedCount = reorders?.filter((order) => order.status === "processed").length || 0
  const cancelledCount = reorders?.filter((order) => order.status === "cancelled").length || 0
  const camelbackCount =
    reorders?.filter((order) => order.location === "Camelback" && order.status === "pending").length || 0
  const broadwayCount =
    reorders?.filter((order) => order.location === "Broadway" && order.status === "pending").length || 0

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Automatic Reorders</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reorders..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-40">
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger>
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="Broadway">Broadway</SelectItem>
                <SelectItem value="Camelback">Camelback</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger>
                <ArrowUpDown className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="most-items">Most Items</SelectItem>
                <SelectItem value="fewest-items">Fewest Items</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Combine Orders Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button variant="outline" onClick={() => handleShowCombinedLocation("Broadway")} className="flex items-center">
          <Layers className="mr-2 h-4 w-4" />
          Combine Broadway Orders
          <Badge variant="secondary" className="ml-2">
            {broadwayCount}
          </Badge>
        </Button>
        <Button variant="outline" onClick={() => handleShowCombinedLocation("Camelback")} className="flex items-center">
          <Layers className="mr-2 h-4 w-4" />
          Combine Camelback Orders
          <Badge variant="secondary" className="ml-2">
            {camelbackCount}
          </Badge>
        </Button>
      </div>

      {/* Tabs */}
      {!showCombinedView ? (
        <Tabs defaultValue="all" className="w-full" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 mb-6">
            <TabsTrigger value="all">
              All Reorders{" "}
              <Badge variant="outline" className="ml-2">
                {reorders?.length || 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending{" "}
              <Badge variant="outline" className="ml-2">
                {pendingCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="processed">
              Processed{" "}
              <Badge variant="outline" className="ml-2">
                {processedCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="cancelled">
              Cancelled{" "}
              <Badge variant="outline" className="ml-2">
                {cancelledCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="combined">Combined Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
            <ReordersList
              reorders={filteredReorders}
              onProcess={handleProcessReorder}
              onCancel={handleCancelReorder}
              onEdit={handleEditReorder}
            />
          </TabsContent>

          <TabsContent value="pending" className="mt-0">
            <ReordersList
              reorders={filteredReorders}
              onProcess={handleProcessReorder}
              onCancel={handleCancelReorder}
              onEdit={handleEditReorder}
            />
          </TabsContent>

          <TabsContent value="processed" className="mt-0">
            <ReordersList
              reorders={filteredReorders}
              onProcess={handleProcessReorder}
              onCancel={handleCancelReorder}
              onEdit={handleEditReorder}
            />
          </TabsContent>

          <TabsContent value="cancelled" className="mt-0">
            <ReordersList
              reorders={filteredReorders}
              onProcess={handleProcessReorder}
              onCancel={handleCancelReorder}
              onEdit={handleEditReorder}
            />
          </TabsContent>

          <TabsContent value="combined" className="mt-0">
            <CombinedOrdersView reorders={reorders} onProcess={handleProcessReorder} onCancel={handleCancelReorder} />
          </TabsContent>
        </Tabs>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Combined Orders for {locationSpecificView}
              <Badge variant="outline" className="ml-2">
                {locationSpecificView === "Broadway" ? broadwayCount : camelbackCount} orders
              </Badge>
            </h2>
            <Button variant="outline" onClick={() => setShowCombinedView(false)}>
              Back to All Orders
            </Button>
          </div>
          <CombinedOrdersView
            reorders={reorders?.filter(
              (order) => order.location === locationSpecificView && order.status === "pending",
            )}
            onProcess={handleProcessReorder}
            onCancel={handleCancelReorder}
            singleLocation={locationSpecificView || undefined}
          />
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-md border">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-muted/50">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      Battery Type
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      Quantity
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {editedItems.map((item: any, index: number) => (
                    <tr key={index}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                        {item.type} ({item.model || "N/A"})
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleUpdateQuantity(index, item.quantity - 1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleUpdateQuantity(index, Number.parseInt(e.target.value) || 1)}
                            className="w-16 text-center"
                            min="1"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleUpdateQuantity(index, item.quantity + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Order Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes for this order..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveChanges}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface ReordersListProps {
  reorders: any[]
  onProcess: (id: string) => void
  onCancel: (id: string) => void
  onEdit: (reorder: any) => void
}

function ReordersList({ reorders, onProcess, onCancel, onEdit }: ReordersListProps) {
  if (!reorders || reorders.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <PackagePlus className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
        <h3 className="mt-4 text-lg font-medium">No reorders found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Reorders will be automatically generated when inventory levels are low.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {reorders.map((reorder) => (
        <ReorderCard key={reorder.id} reorder={reorder} onProcess={onProcess} onCancel={onCancel} onEdit={onEdit} />
      ))}
    </div>
  )
}

interface ReorderCardProps {
  reorder: any
  onProcess: (id: string) => void
  onCancel: (id: string) => void
  onEdit: (reorder: any) => void
}

function ReorderCard({ reorder, onProcess, onCancel, onEdit }: ReorderCardProps) {
  return (
    <Card className={reorder.fromAlert ? "border-amber-300" : ""}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">
              <Building2 className="inline-block mr-2 h-4 w-4" />
              {reorder.location} Reorder
            </CardTitle>
            <CardDescription>{format(new Date(reorder.date), "MMM d, yyyy 'at' h:mm a")}</CardDescription>
          </div>
          <StatusBadge status={reorder.status} />
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="space-y-2">
          {reorder.fromAlert && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 mb-2">
              Created from Alert
            </Badge>
          )}
          <div className="text-sm font-medium">Items to Reorder:</div>
          <ul className="space-y-1">
            {reorder.items &&
              reorder.items.map((item: any, index: number) => (
                <li key={index} className="text-sm flex justify-between">
                  <span>
                    {item.type} Batteries ({item.quantity})
                  </span>
                  <span className="text-muted-foreground">
                    Current: {item.current}/{item.threshold}
                  </span>
                </li>
              ))}
          </ul>
          {reorder.notes && (
            <div className="mt-2">
              <div className="text-sm font-medium">Notes:</div>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{reorder.notes}</p>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        {reorder.status === "pending" ? (
          <div className="flex gap-2 w-full">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(reorder)}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onProcess(reorder.id)}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Process
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onCancel(reorder.id)}>
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        ) : (
          <div className="w-full text-center text-sm text-muted-foreground">
            {reorder.status === "processed" ? "This reorder has been processed" : "This reorder has been cancelled"}
          </div>
        )}
      </CardFooter>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
          <Clock className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      )
    case "processed":
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
          <CheckCircle className="mr-1 h-3 w-3" />
          Processed
        </Badge>
      )
    case "cancelled":
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
          <XCircle className="mr-1 h-3 w-3" />
          Cancelled
        </Badge>
      )
    default:
      return null
  }
}
