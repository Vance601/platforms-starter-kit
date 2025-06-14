"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Battery,
  Truck,
  MapPin,
  Search,
  ArrowUpDown,
  Plus,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react"
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
import { useInventoryStore } from "@/lib/inventory-store"
import { useInventorySummary } from "@/components/inventory-summary"

export function InventoryTable({ category = "all" }) {
  // Use shared inventory store
  const {
    inventory,
    pendingInventory = [], // Provide default empty array
    trucks,
    getAvailableInventory,
    getInventoryByLocation,
    verifyInventory,
    addCoresToTruck,
    removeBatteryFromTruck,
  } = useInventoryStore()

  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState("type")
  const [sortDirection, setSortDirection] = useState("asc")
  const [filterLocation, setFilterLocation] = useState("all")
  const [activeTab, setActiveTab] = useState("warehouse")
  const [pendingTab, setPendingTab] = useState("verified")

  // State for core management
  const [selectedTruck, setSelectedTruck] = useState(null)
  const [isManageBatteriesOpen, setIsManageBatteriesOpen] = useState(false)
  const [coreQuantity, setCoreQuantity] = useState(1)
  const [coreType, setCoreType] = useState("")
  const [coreNotes, setCoreNotes] = useState("")

  // State for verification dialog
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false)
  const [selectedPendingItem, setSelectedPendingItem] = useState(null)

  // State for real-time updates
  const [lastUpdate, setLastUpdate] = useState(new Date())

  // Inventory Summary
  const {
    totalBatteries,
    broadwayBatteries,
    camelbackBatteries,
    pendingCount,
    holdCount,
    totalTruckBatteries,
    getCountByType,
  } = useInventorySummary()

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Handle sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  // Sort inventory
  const sortedInventory = Array.isArray(inventory)
    ? [...inventory].sort((a, b) => {
        let aValue = a[sortField]
        let bValue = b[sortField]

        if (sortField === "totalCount") {
          aValue = Number(aValue)
          bValue = Number(bValue)
        }

        if (aValue < bValue) {
          return sortDirection === "asc" ? -1 : 1
        }
        if (aValue > bValue) {
          return sortDirection === "asc" ? 1 : -1
        }
        return 0
      })
    : []

  // Filter inventory by location, category, and search query
  const filteredInventory = sortedInventory.filter((item) => {
    const matchesLocation =
      filterLocation === "all" ||
      (filterLocation === "broadway" && item.locations?.broadway > 0) ||
      (filterLocation === "camelback" && item.locations?.camelback > 0)

    const matchesCategory =
      category === "all" ||
      item.type.toLowerCase() === category.toLowerCase() ||
      (category === "low" && item.totalCount < 5)

    // Add debugging log
    if (category !== "all" && category !== "low") {
      console.log(
        `Filtering ${item.type} against category ${category}: ${item.type.toLowerCase() === category.toLowerCase()}`,
      )
    }

    const matchesSearch =
      item.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.model.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesLocation && matchesCategory && matchesSearch
  })

  // Filter pending inventory - ensure pendingInventory is an array
  const filteredPendingInventory = Array.isArray(pendingInventory)
    ? pendingInventory.filter((item) => {
        const matchesStatus =
          (pendingTab === "pending" && item.status === "pending") ||
          (pendingTab === "verified" && item.status === "verified") ||
          pendingTab === "all"

        const matchesLocation = filterLocation === "all" || item.location === filterLocation

        const matchesSearch =
          item.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.model.toLowerCase().includes(searchQuery.toLowerCase())

        return matchesStatus && matchesLocation && matchesSearch
      })
    : []

  // Filter trucks by location and search query
  const filteredTrucks = Array.isArray(trucks)
    ? trucks.filter((truck) => {
        const matchesLocation = filterLocation === "all" || truck.location.toLowerCase() === filterLocation

        const matchesSearch =
          truck.fleetNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          truck.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
          truck.model.toLowerCase().includes(searchQuery.toLowerCase())

        return matchesLocation && matchesSearch
      })
    : []

  // Get total battery count by location
  const getTotalBatteryCount = (location = "all") => {
    if (location === "all") return totalBatteries || 0
    if (location === "broadway") return broadwayBatteries || 0
    if (location === "camelback") return camelbackBatteries || 0
    return 0
  }

  // Get total pending inventory count
  const getPendingInventoryCount = (status = "all", location = "all") => {
    if (!Array.isArray(pendingInventory)) return 0

    return pendingInventory.reduce((total, item) => {
      const matchesStatus = status === "all" || item.status === status
      const matchesLocation = location === "all" || item.location === location

      if (matchesStatus && matchesLocation) {
        return total + (item.quantity || 0)
      }
      return total
    }, 0)
  }

  // Get total truck battery count by location
  const getTotalTruckBatteryCount = (location = "all") => {
    if (!Array.isArray(trucks)) return 0

    return trucks.reduce((total, truck) => {
      if (location === "all" || truck.location.toLowerCase() === location) {
        return total + (Array.isArray(truck.batteryInventory) ? truck.batteryInventory.length : 0)
      }
      return total
    }, 0)
  }

  // Get total core count by location
  const getTotalCoreCount = (location = "all") => {
    if (!Array.isArray(trucks)) return 0

    return trucks.reduce((total, truck) => {
      if (location === "all" || truck.location.toLowerCase() === location) {
        return total + (Array.isArray(truck.cores) ? truck.cores.length : 0)
      }
      return total
    }, 0)
  }

  // Get battery status badge
  const getBatteryStatusBadge = (status) => {
    switch (status) {
      case "installed":
        return (
          <Badge variant="default" className="bg-green-500">
            Installed
          </Badge>
        )
      case "inventory":
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800">
            Inventory
          </Badge>
        )
      case "core":
        return (
          <Badge variant="outline" className="bg-amber-100 text-amber-800">
            Core
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
            Pending
          </Badge>
        )
      case "verified":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800">
            Verified
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Get location badge
  const getLocationBadge = (location) => {
    if (!location) return null

    const isBroadway = location.toLowerCase() === "broadway"
    return (
      <Badge
        variant="outline"
        className={`flex items-center gap-1 ${
          isBroadway
            ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
            : "bg-purple-100 text-purple-800 hover:bg-purple-100"
        }`}
      >
        <MapPin className="h-3 w-3" />
        {location}
      </Badge>
    )
  }

  // Open manage batteries dialog
  const openManageBatteries = (truck) => {
    setSelectedTruck(truck)
    setCoreQuantity(1)
    setCoreType("")
    setCoreNotes("")
    setIsManageBatteriesOpen(true)
  }

  // Open verify inventory dialog
  const openVerifyDialog = (item) => {
    setSelectedPendingItem(item)
    setIsVerifyDialogOpen(true)
  }

  // Handle verifying inventory
  const handleVerifyInventory = () => {
    if (!selectedPendingItem) return

    try {
      // Verify the inventory
      verifyInventory(selectedPendingItem.id)

      // Show success toast
      toast({
        title: "Inventory verified",
        description: `${selectedPendingItem.quantity} ${selectedPendingItem.type} batteries have been verified and added to available inventory.`,
        action: <ToastAction altText="OK">OK</ToastAction>,
      })
    } catch (error) {
      console.error("Error verifying inventory:", error)
      toast({
        title: "Error",
        description: "There was an error verifying the inventory. Please try again.",
        variant: "destructive",
      })
    }

    // Close dialog and reset
    setIsVerifyDialogOpen(false)
    setSelectedPendingItem(null)
  }

  // Handle adding cores
  const handleAddCores = () => {
    if (!selectedTruck || !coreType) return

    try {
      // Add cores to the truck
      addCoresToTruck(selectedTruck.id, {
        quantity: coreQuantity,
        type: coreType,
        notes: coreNotes,
        timestamp: new Date().toISOString(),
      })

      // Show success toast
      toast({
        title: "Cores added successfully",
        description: `${coreQuantity} ${coreType} cores added to ${selectedTruck.fleetNumber}`,
        action: <ToastAction altText="OK">OK</ToastAction>,
      })
    } catch (error) {
      console.error("Error adding cores:", error)
      toast({
        title: "Error",
        description: "There was an error adding cores. Please try again.",
        variant: "destructive",
      })
    }

    // Close dialog and reset
    setIsManageBatteriesOpen(false)
    setSelectedTruck(null)
    setCoreQuantity(1)
    setCoreType("")
    setCoreNotes("")
  }

  // Handle removing battery
  const handleRemoveBattery = (truck, batteryId) => {
    try {
      // Remove battery from truck
      removeBatteryFromTruck(truck.id, batteryId, "sold")

      // Show success toast
      toast({
        title: "Battery removed",
        description: `Battery removed from ${truck.fleetNumber}`,
        action: <ToastAction altText="OK">OK</ToastAction>,
      })
    } catch (error) {
      console.error("Error removing battery:", error)
      toast({
        title: "Error",
        description: "There was an error removing the battery. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    try {
      return new Date(dateString).toLocaleString()
    } catch (error) {
      console.error("Error formatting date:", error)
      return "Invalid date"
    }
  }

  // Handle errors in the component
  if (!inventory) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Inventory Data Unavailable</h2>
        <p className="text-muted-foreground">The inventory data could not be loaded. Please try refreshing the page.</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Page
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">Battery Inventory</h2>
            <Badge className="ml-2">{getTotalBatteryCount() + getTotalTruckBatteryCount()} Total Batteries</Badge>
            <Badge variant="outline" className="bg-amber-100 text-amber-800">
              {getTotalCoreCount()} Cores
            </Badge>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
              {getPendingInventoryCount("pending")} Pending
            </Badge>
            <div className="text-xs text-muted-foreground ml-2 flex items-center">
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={filterLocation} onValueChange={setFilterLocation}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="broadway">Broadway</SelectItem>
                <SelectItem value="camelback">Camelback</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search inventory..."
                className="w-[200px] pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Verified Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getTotalBatteryCount()}</div>
              <p className="text-xs text-muted-foreground">
                Broadway: {getTotalBatteryCount("broadway")} | Camelback: {getTotalBatteryCount("camelback")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending Verification</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getPendingInventoryCount("pending")}</div>
              <p className="text-xs text-muted-foreground">
                Broadway: {getPendingInventoryCount("pending", "broadway")} | Camelback:{" "}
                {getPendingInventoryCount("pending", "camelback")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Truck Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getTotalTruckBatteryCount()}</div>
              <p className="text-xs text-muted-foreground">
                Broadway: {getTotalTruckBatteryCount("broadway")} | Camelback: {getTotalTruckBatteryCount("camelback")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Core Returns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getTotalCoreCount()}</div>
              <p className="text-xs text-muted-foreground">
                Broadway: {getTotalCoreCount("broadway")} | Camelback: {getTotalCoreCount("camelback")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Fleet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Array.isArray(trucks) ? trucks.length : 0}</div>
              <p className="text-xs text-muted-foreground">
                Broadway:{" "}
                {Array.isArray(trucks) ? trucks.filter((t) => t.location?.toLowerCase() === "broadway").length : 0} |
                Camelback:{" "}
                {Array.isArray(trucks) ? trucks.filter((t) => t.location?.toLowerCase() === "camelback").length : 0}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="warehouse" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="warehouse">Warehouse Inventory</TabsTrigger>
          <TabsTrigger value="pending">Pending Inventory</TabsTrigger>
          <TabsTrigger value="trucks">Truck Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="warehouse" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Verified Warehouse Inventory</CardTitle>
              <CardDescription>Manage your verified battery inventory across all locations</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px] cursor-pointer" onClick={() => handleSort("type")}>
                      <div className="flex items-center">
                        Type
                        {sortField === "type" && (
                          <ArrowUpDown className={`ml-2 h-4 w-4 ${sortDirection === "desc" ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("model")}>
                      <div className="flex items-center">
                        Model
                        {sortField === "model" && (
                          <ArrowUpDown className={`ml-2 h-4 w-4 ${sortDirection === "desc" ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("totalCount")}>
                      <div className="flex items-center">
                        Total Count
                        {sortField === "totalCount" && (
                          <ArrowUpDown className={`ml-2 h-4 w-4 ${sortDirection === "desc" ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </TableHead>
                    <TableHead>Broadway</TableHead>
                    <TableHead>Camelback</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.type}</TableCell>
                      <TableCell>{item.model}</TableCell>
                      <TableCell>{item.totalCount}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-amber-100 text-amber-800">
                            {item.locations?.broadway || 0}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-purple-100 text-purple-800">
                            {item.locations?.camelback || 0}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {filteredInventory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                        No inventory found matching your criteria
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pending Inventory</CardTitle>
                <CardDescription>
                  Inventory that needs to be verified before it can be assigned to trucks
                </CardDescription>
              </div>
              <Tabs defaultValue="pending" value={pendingTab} onValueChange={setPendingTab}>
                <TabsList>
                  <TabsTrigger value="pending">
                    <Clock className="h-4 w-4 mr-2" />
                    Pending
                  </TabsTrigger>
                  <TabsTrigger value="verified">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Verified
                  </TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Received Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPendingInventory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.type}</TableCell>
                      <TableCell>{item.model}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{getLocationBadge(item.location)}</TableCell>
                      <TableCell>{getBatteryStatusBadge(item.status)}</TableCell>
                      <TableCell>{formatDate(item.receivedDate)}</TableCell>
                      <TableCell className="text-right">
                        {item.status === "pending" ? (
                          <Button variant="outline" size="sm" onClick={() => openVerifyDialog(item)}>
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            Verify
                          </Button>
                        ) : (
                          <Badge variant="outline" className="bg-green-100 text-green-800">
                            Verified on {formatDate(item.verifiedDate)}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  {filteredPendingInventory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                        No pending inventory found matching your criteria
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trucks" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Truck Battery Inventory</CardTitle>
              <CardDescription>View batteries assigned to each truck in your fleet</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {filteredTrucks.map((truck) => (
                  <Card key={truck.id} className="overflow-hidden">
                    <CardHeader className="bg-muted/30 pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Truck className="h-5 w-5 text-muted-foreground" />
                            <CardTitle className="text-lg">{truck.fleetNumber}</CardTitle>
                            {getLocationBadge(truck.location)}
                          </div>
                          <CardDescription className="mt-1">
                            {truck.make} {truck.model} ({truck.year}) -{" "}
                            {Array.isArray(truck.batteryInventory) ? truck.batteryInventory.length : 0} Batteries,{" "}
                            {Array.isArray(truck.cores) ? truck.cores.length : 0} Cores
                          </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => openManageBatteries(truck)}>
                          <Battery className="mr-2 h-4 w-4" />
                          Manage Batteries
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <Tabs defaultValue="batteries">
                        <TabsList className="mb-4">
                          <TabsTrigger value="batteries">
                            Batteries ({Array.isArray(truck.batteryInventory) ? truck.batteryInventory.length : 0})
                          </TabsTrigger>
                          <TabsTrigger value="cores">
                            Cores ({Array.isArray(truck.cores) ? truck.cores.length : 0})
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="batteries">
                          {Array.isArray(truck.batteryInventory) && truck.batteryInventory.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Serial</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Model</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Location</TableHead>
                                  <TableHead>Assigned Date</TableHead>
                                  <TableHead>Notes</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {truck.batteryInventory.map((battery) => (
                                  <TableRow key={battery.id}>
                                    <TableCell className="font-medium">{battery.serial}</TableCell>
                                    <TableCell>{battery.type}</TableCell>
                                    <TableCell>{battery.model}</TableCell>
                                    <TableCell>{getBatteryStatusBadge(battery.status)}</TableCell>
                                    <TableCell>{getLocationBadge(battery.location)}</TableCell>
                                    <TableCell>{formatDate(battery.assignedDate)}</TableCell>
                                    <TableCell>{battery.notes || "-"}</TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveBattery(truck, battery.id)}
                                      >
                                        Remove
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <div className="text-center py-4 text-muted-foreground">
                              No batteries assigned to this truck
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="cores">
                          {Array.isArray(truck.cores) && truck.cores.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Quantity</TableHead>
                                  <TableHead>Added On</TableHead>
                                  <TableHead>Notes</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {truck.cores.map((core, index) => (
                                  <TableRow key={core.id || index}>
                                    <TableCell className="font-medium">{core.type}</TableCell>
                                    <TableCell>{core.quantity}</TableCell>
                                    <TableCell>{formatDate(core.timestamp)}</TableCell>
                                    <TableCell>{core.notes || "-"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <div className="text-center py-4 text-muted-foreground">
                              No cores recorded for this truck
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                ))}

                {filteredTrucks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">No trucks found matching your criteria</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Manage Batteries Dialog */}
      <Dialog open={isManageBatteriesOpen} onOpenChange={setIsManageBatteriesOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Batteries & Cores</DialogTitle>
            <DialogDescription>
              {selectedTruck &&
                `Add cores for ${selectedTruck.fleetNumber} (${selectedTruck.make} ${selectedTruck.model})`}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Add Core Returns</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Core Type</label>
                  <Select value={coreType} onValueChange={setCoreType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select core type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Alpha">Alpha</SelectItem>
                      <SelectItem value="Bravo">Bravo</SelectItem>
                      <SelectItem value="Charlie">Charlie</SelectItem>
                      <SelectItem value="AMG">AMG</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Quantity</label>
                  <div className="flex items-center">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCoreQuantity(Math.max(1, coreQuantity - 1))}
                      disabled={coreQuantity <= 1}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <path d="M5 12h14" />
                      </svg>
                    </Button>
                    <Input
                      type="number"
                      value={coreQuantity}
                      onChange={(e) => setCoreQuantity(Math.max(1, Number.parseInt(e.target.value) || 1))}
                      className="h-10 w-16 mx-2 text-center"
                      min="1"
                    />
                    <Button variant="outline" size="icon" onClick={() => setCoreQuantity(coreQuantity + 1)}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <path d="M5 12h14" />
                        <path d="M12 5v14" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Input
                  placeholder="Add any notes about the core return"
                  value={coreNotes}
                  onChange={(e) => setCoreNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2">
              <h3 className="text-sm font-medium mb-2">Current Inventory</h3>
              {selectedTruck && (
                <div className="text-sm">
                  <p>
                    <span className="font-medium">Batteries:</span>{" "}
                    {Array.isArray(selectedTruck.batteryInventory) ? selectedTruck.batteryInventory.length : 0}
                  </p>
                  <p>
                    <span className="font-medium">Cores:</span>{" "}
                    {Array.isArray(selectedTruck.cores) ? selectedTruck.cores.length : 0}
                  </p>
                  <p>
                    <span className="font-medium">Location:</span> {selectedTruck.location}
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManageBatteriesOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCores} disabled={!coreType}>
              <Plus className="mr-2 h-4 w-4" />
              Add Cores
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    <p>{selectedPendingItem.location}</p>
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
            <Button onClick={handleVerifyInventory}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Verify Inventory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
