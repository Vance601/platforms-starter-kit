"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, Truck, Filter, Eye, Building2, CheckCircle, AlertTriangle, Clock } from "lucide-react"
import Link from "next/link"
import { AddTruckModal } from "@/components/add-truck-modal"
import { useInventoryStore } from "@/lib/inventory-store"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import { ToastAction } from "@/components/ui/toast"

export default function FleetPage() {
  const { trucks = [], pendingInventory = [], verifyInventory, addTruck } = useInventoryStore()

  const [searchQuery, setSearchQuery] = useState("")
  const [filterLocation, setFilterLocation] = useState("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  const [isLoading, setIsLoading] = useState(false)
  const [localTrucks, setLocalTrucks] = useState(trucks)

  // State for verification dialog
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false)
  const [selectedPendingItem, setSelectedPendingItem] = useState(null)

  // Update local trucks when store trucks change
  useEffect(() => {
    setLocalTrucks(trucks)
  }, [trucks])

  // Get pending inventory count
  const getPendingInventoryCount = (location = "all") => {
    if (!Array.isArray(pendingInventory)) return 0

    return pendingInventory.reduce((total, item) => {
      if (item.status !== "pending") return total

      const matchesLocation =
        location === "all" || (item.location && item.location.toLowerCase() === location.toLowerCase())

      if (matchesLocation) {
        return total + (item.quantity || 0)
      }
      return total
    }, 0)
  }

  // Filter trucks by location and search query
  const filteredTrucks = Array.isArray(localTrucks)
    ? localTrucks.filter((truck) => {
        const matchesLocation =
          activeTab === "all" ||
          (activeTab === "broadway" && truck.location?.toLowerCase() === "broadway") ||
          (activeTab === "camelback" && truck.location?.toLowerCase() === "camelback") ||
          (activeTab === "maintenance" && truck.status === "Maintenance")

        const matchesSearch =
          truck.fleetNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          truck.make?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          truck.model?.toLowerCase().includes(searchQuery.toLowerCase())

        return matchesLocation && matchesSearch
      })
    : []

  // Filter pending inventory
  const filteredPendingInventory = Array.isArray(pendingInventory)
    ? pendingInventory.filter((item) => {
        if (item.status !== "pending") return false

        const matchesLocation =
          activeTab === "all" ||
          (activeTab === "broadway" && item.location?.toLowerCase() === "broadway") ||
          (activeTab === "camelback" && item.location?.toLowerCase() === "camelback")

        const matchesSearch =
          item.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.model?.toLowerCase().includes(searchQuery.toLowerCase())

        return matchesLocation && matchesSearch
      })
    : []

  const handleAddTruck = (newTruck) => {
    try {
      console.log("Adding new truck:", newTruck)
      setIsLoading(true)

      // Call the addTruck function from the inventory store
      addTruck(newTruck)

      // Update local state immediately for a responsive UI
      setLocalTrucks((prev) => (Array.isArray(prev) ? [...prev, newTruck] : [newTruck]))

      // Show success toast
      toast({
        title: "Truck added successfully",
        description: `${newTruck.fleetNumber} (${newTruck.make} ${newTruck.model}) has been added to your fleet.`,
        action: <ToastAction altText="OK">OK</ToastAction>,
      })

      // Close the modal
      setModalOpen(false)

      // Set loading to false after a short delay
      setTimeout(() => {
        setIsLoading(false)
      }, 300)
    } catch (error) {
      console.error("Error adding truck:", error)
      setIsLoading(false)
      toast({
        variant: "destructive",
        title: "Error adding truck",
        description: "There was a problem adding the truck. Please try again.",
        action: <ToastAction altText="Try Again">Try Again</ToastAction>,
      })
    }
  }

  // Open verify dialog
  const openVerifyDialog = (item) => {
    setSelectedPendingItem(item)
    setIsVerifyDialogOpen(true)
  }

  // Handle verifying inventory
  const handleVerifyInventory = () => {
    if (!selectedPendingItem) return

    // Verify the inventory
    verifyInventory(selectedPendingItem.id)

    // Show success toast
    toast({
      title: "Inventory verified",
      description: `${selectedPendingItem.quantity} ${selectedPendingItem.type} batteries have been verified and added to available inventory.`,
      action: <ToastAction altText="OK">OK</ToastAction>,
    })

    // Close dialog and reset
    setIsVerifyDialogOpen(false)
    setSelectedPendingItem(null)
  }

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    try {
      return new Date(dateString).toLocaleString()
    } catch (e) {
      console.error("Error formatting date:", e)
      return "Invalid date"
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dugger's Battery Program</h1>
        <div className="flex gap-2">
          {getPendingInventoryCount() > 0 && (
            <Button
              variant="outline"
              className="bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
              onClick={() => setActiveTab("pending")}
            >
              <Clock className="mr-2 h-4 w-4" />
              Pending Verification ({getPendingInventoryCount()})
            </Button>
          )}
          <Button onClick={() => setModalOpen(true)} disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Processing...
              </>
            ) : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Truck
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trucks</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Array.isArray(localTrucks) ? localTrucks.length : 0}</div>
            <p className="text-xs text-muted-foreground">Across all locations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Trucks</CardTitle>
            <Truck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(localTrucks) ? localTrucks.filter((t) => t.status === "Active").length : 0}
            </div>
            <p className="text-xs text-muted-foreground">Ready for service</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Broadway Fleet</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(localTrucks) ? localTrucks.filter((t) => t.location === "Broadway").length : 0}
            </div>
            <p className="text-xs text-muted-foreground">Trucks at Broadway location</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Camelback Fleet</CardTitle>
            <Building2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(localTrucks) ? localTrucks.filter((t) => t.location === "Camelback").length : 0}
            </div>
            <p className="text-xs text-muted-foreground">Trucks at Camelback location</p>
          </CardContent>
        </Card>
        <Card className={getPendingInventoryCount() > 0 ? "bg-amber-50 border-amber-200" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Verification</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getPendingInventoryCount()}</div>
            <p className="text-xs text-muted-foreground">
              Broadway: {getPendingInventoryCount("broadway")} | Camelback: {getPendingInventoryCount("camelback")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Input
            placeholder="Search by fleet number, make, model..."
            className="w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Trucks</TabsTrigger>
          <TabsTrigger value="broadway">Broadway</TabsTrigger>
          <TabsTrigger value="camelback">Camelback</TabsTrigger>
          <TabsTrigger value="maintenance">In Maintenance</TabsTrigger>
          <TabsTrigger value="pending" className="relative">
            Pending Verification
            {getPendingInventoryCount() > 0 && (
              <Badge className="ml-2 bg-amber-500">{getPendingInventoryCount()}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Trucks</CardTitle>
              <CardDescription>View and manage your entire fleet</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Fleet #</th>
                      <th className="p-3 text-left font-medium">Make/Model</th>
                      <th className="p-3 text-left font-medium">Year</th>
                      <th className="p-3 text-left font-medium">License</th>
                      <th className="p-3 text-left font-medium">Location</th>
                      <th className="p-3 text-left font-medium">Battery</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrucks.map((truck) => (
                      <tr key={truck.id} className="border-b">
                        <td className="p-3 font-medium">{truck.fleetNumber}</td>
                        <td className="p-3">
                          {truck.make} {truck.model}
                        </td>
                        <td className="p-3">{truck.year}</td>
                        <td className="p-3">{truck.licensePlate}</td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={truck.location === "Broadway" ? "bg-blue-50" : "bg-green-50"}
                          >
                            <Building2 className="mr-1 h-3 w-3" />
                            {truck.location}
                          </Badge>
                        </td>
                        <td className="p-3">{truck.batteryType}</td>
                        <td className="p-3">
                          <Badge variant={truck.status === "Active" ? "default" : "outline"}>{truck.status}</Badge>
                        </td>
                        <td className="p-3">
                          <Link href={`/fleet/${truck.id}`}>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}

                    {filteredTrucks.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-3 text-center text-muted-foreground">
                          No trucks found matching your criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="broadway">
          <Card>
            <CardHeader>
              <CardTitle>Broadway Fleet</CardTitle>
              <CardDescription>Trucks stationed at Broadway location</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Fleet #</th>
                      <th className="p-3 text-left font-medium">Make/Model</th>
                      <th className="p-3 text-left font-medium">Year</th>
                      <th className="p-3 text-left font-medium">License</th>
                      <th className="p-3 text-left font-medium">Battery</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrucks.map((truck) => (
                      <tr key={truck.id} className="border-b">
                        <td className="p-3 font-medium">{truck.fleetNumber}</td>
                        <td className="p-3">
                          {truck.make} {truck.model}
                        </td>
                        <td className="p-3">{truck.year}</td>
                        <td className="p-3">{truck.licensePlate}</td>
                        <td className="p-3">{truck.batteryType}</td>
                        <td className="p-3">
                          <Badge variant={truck.status === "Active" ? "default" : "outline"}>{truck.status}</Badge>
                        </td>
                        <td className="p-3">
                          <Link href={`/fleet/${truck.id}`}>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}

                    {filteredTrucks.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-3 text-center text-muted-foreground">
                          No trucks found matching your criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="camelback">
          <Card>
            <CardHeader>
              <CardTitle>Camelback Fleet</CardTitle>
              <CardDescription>Trucks stationed at Camelback location</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Fleet #</th>
                      <th className="p-3 text-left font-medium">Make/Model</th>
                      <th className="p-3 text-left font-medium">Year</th>
                      <th className="p-3 text-left font-medium">License</th>
                      <th className="p-3 text-left font-medium">Battery</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrucks.map((truck) => (
                      <tr key={truck.id} className="border-b">
                        <td className="p-3 font-medium">{truck.fleetNumber}</td>
                        <td className="p-3">
                          {truck.make} {truck.model}
                        </td>
                        <td className="p-3">{truck.year}</td>
                        <td className="p-3">{truck.licensePlate}</td>
                        <td className="p-3">{truck.batteryType}</td>
                        <td className="p-3">
                          <Badge variant={truck.status === "Active" ? "default" : "outline"}>{truck.status}</Badge>
                        </td>
                        <td className="p-3">
                          <Link href={`/fleet/${truck.id}`}>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}

                    {filteredTrucks.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-3 text-center text-muted-foreground">
                          No trucks found matching your criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <CardTitle>Trucks In Maintenance</CardTitle>
              <CardDescription>Trucks currently undergoing maintenance or repairs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Fleet #</th>
                      <th className="p-3 text-left font-medium">Make/Model</th>
                      <th className="p-3 text-left font-medium">Year</th>
                      <th className="p-3 text-left font-medium">License</th>
                      <th className="p-3 text-left font-medium">Location</th>
                      <th className="p-3 text-left font-medium">Battery</th>
                      <th className="p-3 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrucks.map((truck) => (
                      <tr key={truck.id} className="border-b">
                        <td className="p-3 font-medium">{truck.fleetNumber}</td>
                        <td className="p-3">
                          {truck.make} {truck.model}
                        </td>
                        <td className="p-3">{truck.year}</td>
                        <td className="p-3">{truck.licensePlate}</td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={truck.location === "Broadway" ? "bg-blue-50" : "bg-green-50"}
                          >
                            <Building2 className="mr-1 h-3 w-3" />
                            {truck.location}
                          </Badge>
                        </td>
                        <td className="p-3">{truck.batteryType}</td>
                        <td className="p-3">
                          <Link href={`/fleet/${truck.id}`}>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}

                    {filteredTrucks.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-3 text-center text-muted-foreground">
                          No trucks found matching your criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Inventory Verification</CardTitle>
              <CardDescription>Inventory that needs to be verified before it can be assigned to trucks</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredPendingInventory.length > 0 ? (
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">Type</th>
                        <th className="p-3 text-left font-medium">Model</th>
                        <th className="p-3 text-left font-medium">Quantity</th>
                        <th className="p-3 text-left font-medium">Location</th>
                        <th className="p-3 text-left font-medium">Received Date</th>
                        <th className="p-3 text-left font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPendingInventory.map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="p-3 font-medium">{item.type}</td>
                          <td className="p-3">{item.model}</td>
                          <td className="p-3">{item.quantity}</td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={item.location === "broadway" ? "bg-blue-50" : "bg-green-50"}
                            >
                              <Building2 className="mr-1 h-3 w-3" />
                              {item.location.charAt(0).toUpperCase() + item.location.slice(1)}
                            </Badge>
                          </td>
                          <td className="p-3">{formatDate(item.receivedDate)}</td>
                          <td className="p-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openVerifyDialog(item)}
                              className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Verify
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-medium">All inventory has been verified</h3>
                  <p className="text-muted-foreground mt-2">
                    There are no pending inventory items that need verification.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddTruckModal open={modalOpen} onOpenChange={setModalOpen} onAddTruck={handleAddTruck} />

      {/* Verify Inventory Dialog */}
      <Dialog open={isVerifyDialogOpen} onOpenChange={setIsVerifyDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Verify Inventory</DialogTitle>
            <DialogDescription>
              Verify that the inventory has been received and is ready to be assigned
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {selectedPendingItem && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Type</p>
                    <p>{selectedPendingItem.type}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Model</p>
                    <p>{selectedPendingItem.model}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Quantity</p>
                    <p>{selectedPendingItem.quantity}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Location</p>
                    <p>
                      {selectedPendingItem.location.charAt(0).toUpperCase() + selectedPendingItem.location.slice(1)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium">Received Date</p>
                  <p>{formatDate(selectedPendingItem.receivedDate)}</p>
                </div>

                <div className="flex items-center text-amber-600 bg-amber-50 p-3 rounded-md">
                  <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
                  <p className="text-sm">
                    Verifying this inventory will make it available for assignment to trucks. Please ensure that the
                    physical inventory has been received and counted.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVerifyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleVerifyInventory} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="mr-2 h-4 w-4" />
              Verify Inventory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
