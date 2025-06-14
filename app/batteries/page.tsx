"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BatteryStats } from "@/components/battery-stats"
import { Button } from "@/components/ui/button"
import {
  PlusCircle,
  Download,
  Filter,
  Building2,
  PackagePlus,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  ShoppingCart,
  Plus,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ReorderBatteryModal } from "@/components/reorder-battery-modal"
import { useInventoryStore } from "@/stores/inventory-store"
import { useInventorySummary } from "@/components/inventory-summary"
import { useToast } from "@/components/ui/use-toast"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function BatteriesPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [parLevelModalOpen, setParLevelModalOpen] = useState(false)
  const [selectedBatteryType, setSelectedBatteryType] = useState<string>("")
  const [parLevel, setParLevel] = useState<number>(0)
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    Alpha: false,
    Bravo: false,
    Charlie: false,
    AMG: false,
  })
  const [reorderModalOpen, setReorderModalOpen] = useState(false)
  const [selectedStockNumber, setSelectedStockNumber] = useState<string>("")
  const [reorderQuantity, setReorderQuantity] = useState<number>(1)
  const [reorderLocation, setReorderLocation] = useState<string>("Broadway")

  const { inventory, parLevels, updateBatteryParLevel } = useInventoryStore()
  const { getCountByType } = useInventorySummary()
  const { toast } = useToast()

  // Calculate battery inventory from the inventory store
  const batteryInventory = {
    Alpha: {
      total: getCountByType("Alpha") || 0,
      broadway: getCountByType("Alpha", "broadway") || 0,
      camelback: getCountByType("Alpha", "camelback") || 0,
      timeToReorder: 72,
      parLevel: parLevels?.Alpha || 0,
      model: "Standard 24F",
      description: "Standard automotive battery for most vehicles",
      stockItems: [
        { stockNumber: "A-24F-STD", description: "Standard 24F Battery", quantity: 8 },
        { stockNumber: "A-24F-HD", description: "Heavy Duty 24F Battery", quantity: 5 },
        { stockNumber: "A-35-STD", description: "Standard Group 35 Battery", quantity: 2 },
      ],
    },
    Bravo: {
      total: getCountByType("Bravo") || 0,
      broadway: getCountByType("Bravo", "broadway") || 0,
      camelback: getCountByType("Bravo", "camelback") || 0,
      timeToReorder: 85,
      parLevel: parLevels?.Bravo || 0,
      model: "Heavy Duty 65H",
      description: "Heavy duty battery for trucks and SUVs",
      stockItems: [
        { stockNumber: "B-65H-STD", description: "Standard 65H Battery", quantity: 4 },
        { stockNumber: "B-65H-HD", description: "Heavy Duty 65H Battery", quantity: 3 },
        { stockNumber: "B-78DT-HD", description: "Heavy Duty 78DT Battery", quantity: 1 },
      ],
    },
    Charlie: {
      total: getCountByType("Charlie") || 0,
      broadway: getCountByType("Charlie", "broadway") || 0,
      camelback: getCountByType("Charlie", "camelback") || 0,
      timeToReorder: 65,
      parLevel: parLevels?.Charlie || 0,
      model: "Economy 35E",
      description: "Economy battery for compact cars",
      stockItems: [
        { stockNumber: "C-35E-ECO", description: "Economy 35E Battery", quantity: 6 },
        { stockNumber: "C-35E-STD", description: "Standard 35E Battery", quantity: 4 },
        { stockNumber: "C-51R-ECO", description: "Economy 51R Battery", quantity: 2 },
      ],
    },
    AMG: {
      total: getCountByType("AMG") || 0,
      broadway: getCountByType("AMG", "broadway") || 0,
      camelback: getCountByType("AMG", "camelback") || 0,
      timeToReorder: 78,
      parLevel: parLevels?.AMG || 0,
      model: "Premium AGM",
      description: "Premium AGM battery for high-performance vehicles",
      stockItems: [
        { stockNumber: "AGM-H6-PRE", description: "Premium H6 AGM Battery", quantity: 2 },
        { stockNumber: "AGM-H7-PRE", description: "Premium H7 AGM Battery", quantity: 2 },
        { stockNumber: "AGM-L3-PRE", description: "Premium L3 AGM Battery", quantity: 2 },
      ],
    },
  }

  // Get all stock items for dropdown
  const getAllStockItems = () => {
    const allItems: { stockNumber: string; description: string; type: string; quantity: number }[] = []

    Object.entries(batteryInventory).forEach(([type, data]) => {
      data.stockItems.forEach((item) => {
        allItems.push({
          ...item,
          type,
        })
      })
    })

    return allItems
  }

  const allStockItems = getAllStockItems()

  const handleReorder = (batteryType: string, location: string, quantity: number) => {
    // This would be handled by the inventory store in a real implementation
    console.log(`Reordering ${quantity} ${batteryType} batteries for ${location}`)
  }

  const handleStockItemReorder = () => {
    if (!selectedStockNumber || reorderQuantity <= 0) return

    // Find the stock item details
    const stockItem = allStockItems.find((item) => item.stockNumber === selectedStockNumber)
    if (!stockItem) return

    // In a real app, this would call an API to place the order
    console.log(
      `Reordering ${reorderQuantity} of ${selectedStockNumber} (${stockItem.description}) for ${reorderLocation}`,
    )

    toast({
      title: "Reorder placed",
      description: `Ordered ${reorderQuantity} of ${stockItem.description} for ${reorderLocation}`,
      variant: "default",
    })

    setReorderModalOpen(false)
    setSelectedStockNumber("")
    setReorderQuantity(1)
  }

  const openParLevelModal = (batteryType: string) => {
    setSelectedBatteryType(batteryType)
    setParLevel(batteryInventory[batteryType as keyof typeof batteryInventory].parLevel)
    setParLevelModalOpen(true)
  }

  const handleParLevelSave = () => {
    if (selectedBatteryType) {
      updateBatteryParLevel(selectedBatteryType, parLevel)
      toast({
        title: "Par level updated",
        description: `Par level for ${selectedBatteryType} batteries has been set to ${parLevel} units.`,
        variant: "default",
      })
      setParLevelModalOpen(false)
    }
  }

  const toggleCardExpand = (batteryType: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [batteryType]: !prev[batteryType],
    }))
  }

  const updateParLevelDirectly = (batteryType: string, newParLevel: number) => {
    updateBatteryParLevel(batteryType, newParLevel)
  }

  // Calculate total batteries at each location
  const totalBroadway = Object.values(batteryInventory).reduce((sum, item) => sum + (item.broadway || 0), 0)
  const totalCamelback = Object.values(batteryInventory).reduce((sum, item) => sum + (item.camelback || 0), 0)

  // Helper function to get status badge for inventory vs par level
  const getStatusBadge = (current: number, parLevel: number) => {
    if (current === 0) return { label: "Out of Stock", variant: "destructive" as const }
    if (current < parLevel) return { label: `${parLevel - current} Below Par`, variant: "destructive" as const }
    if (current === parLevel) return { label: "At Par", variant: "warning" as const }
    if (current <= parLevel * 1.2) return { label: "Near Par", variant: "warning" as const }
    return { label: `${current - parLevel} Above Par`, variant: "default" as const }
  }

  // Calculate how many to reorder
  const getReorderQuantity = (current: number, parLevel: number) => {
    if (current >= parLevel) return 0
    return parLevel - current
  }

  // Get battery type color class
  const getBatteryTypeClass = (type: string) => {
    switch (type) {
      case "Alpha":
        return "bg-blue-50"
      case "Bravo":
        return "bg-green-50"
      case "Charlie":
        return "bg-amber-50"
      case "AMG":
        return "bg-purple-50"
      default:
        return ""
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <style jsx global>{`
        @keyframes flash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .flash-warning {
          animation: flash 1s infinite;
          color: #ef4444;
          font-weight: 600;
        }
      `}</style>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Battery Inventory</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setModalOpen(true)}>
            <PackagePlus className="mr-2 h-4 w-4" />
            Receive Order
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Link href="/batteries/new">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Battery
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Broadway Location</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBroadway}</div>
            <p className="text-xs text-muted-foreground">Batteries at Broadway location</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Camelback Location</CardTitle>
            <Building2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCamelback}</div>
            <p className="text-xs text-muted-foreground">Batteries at Camelback location</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(batteryInventory).map(([type, data]) => {
          const status = getStatusBadge(data.total, data.parLevel)
          const isExpanded = expandedCards[type]
          const stockPercentage =
            data.parLevel > 0 ? Math.min(Math.round((data.total / data.parLevel) * 100), 200) : 100
          const reorderQuantity = getReorderQuantity(data.total, data.parLevel)
          const needsReorder = data.total < data.parLevel

          return (
            <Card key={type} className={isExpanded ? "md:col-span-2" : ""}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{type} Batteries</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      type === "Alpha"
                        ? "bg-blue-50"
                        : type === "Bravo"
                          ? "bg-green-50"
                          : type === "Charlie"
                            ? "bg-amber-50"
                            : "bg-purple-50"
                    }
                  >
                    {type}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => toggleCardExpand(type)}>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="text-2xl font-bold">{data.total}</div>
                  <Badge variant={status.variant}>
                    {status.variant === "destructive" ? <AlertCircle className="h-3.5 w-3.5 mr-1" /> : null}
                    {status.variant === "default" ? <Check className="h-3.5 w-3.5 mr-1" /> : null}
                    {status.label}
                  </Badge>
                </div>

                <div className="mt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Current Stock</span>
                    <span>Par Level: {data.parLevel}</span>
                  </div>
                  <Progress
                    value={stockPercentage}
                    className="h-2"
                    indicatorClassName={
                      data.total < data.parLevel
                        ? "bg-red-500"
                        : data.total === data.parLevel
                          ? "bg-yellow-500"
                          : "bg-green-500"
                    }
                  />
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-1">Model: {data.model}</h4>
                      <p className="text-xs text-muted-foreground">{data.description}</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Location Breakdown</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md bg-muted p-2">
                          <div className="text-xs text-muted-foreground">Broadway</div>
                          <div className="font-medium">{data.broadway} units</div>
                        </div>
                        <div className="rounded-md bg-muted p-2">
                          <div className="text-xs text-muted-foreground">Camelback</div>
                          <div className="font-medium">{data.camelback} units</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mt-4">
                      <h4 className="text-sm font-medium">Stock Items</h4>
                      <div className="rounded-md border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="p-2 text-left font-medium">Stock #</th>
                              <th className="p-2 text-left font-medium">Description</th>
                              <th className="p-2 text-right font-medium">Quantity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.stockItems.map((item, index) => (
                              <tr
                                key={item.stockNumber}
                                className={index !== data.stockItems.length - 1 ? "border-b" : ""}
                              >
                                <td className="p-2 font-mono text-xs">{item.stockNumber}</td>
                                <td className="p-2">{item.description}</td>
                                <td className="p-2 text-right">{item.quantity}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium">Par Level</h4>
                        <span className="text-sm">{data.parLevel} units</span>
                      </div>
                      <div className="pt-2">
                        <Slider
                          defaultValue={[data.parLevel]}
                          max={100}
                          step={1}
                          onValueChange={(value) => updateParLevelDirectly(type, value[0])}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0</span>
                        <span>50</span>
                        <span>100</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <div
                          className={`text-xs flex items-center ${needsReorder ? "flash-warning" : "text-muted-foreground"}`}
                        >
                          {needsReorder ? (
                            <ShoppingCart className="h-3 w-3 mr-1" />
                          ) : (
                            <Clock className="h-3 w-3 mr-1" />
                          )}
                          {needsReorder ? "Reorder Needed" : "Time to Reorder"}
                        </div>
                        <div className={`font-medium ${needsReorder ? "flash-warning" : ""}`}>
                          {needsReorder ? `${reorderQuantity} units needed` : `${data.timeToReorder} days`}
                        </div>
                      </div>
                      <Button
                        variant={needsReorder ? "default" : "outline"}
                        size="sm"
                        onClick={() => setModalOpen(true)}
                      >
                        Re-order
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
              {!isExpanded && (
                <CardFooter className="pt-0">
                  <div className="flex justify-between items-center w-full">
                    <div
                      className={`text-xs flex items-center ${needsReorder ? "flash-warning" : "text-muted-foreground"}`}
                    >
                      {needsReorder ? <ShoppingCart className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                      {needsReorder ? "Reorder:" : "Time to Reorder:"}
                      {needsReorder ? ` ${reorderQuantity} units` : ` ${data.timeToReorder} days`}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => toggleCardExpand(type)}>
                      Details
                    </Button>
                  </div>
                </CardFooter>
              )}
            </Card>
          )
        })}
      </div>

      <Tabs defaultValue="all" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="all">All Batteries</TabsTrigger>
            <TabsTrigger value="broadway">Broadway</TabsTrigger>
            <TabsTrigger value="camelback">Camelback</TabsTrigger>
            <TabsTrigger value="reorder">Re-order</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
            <div className="relative">
              <Input placeholder="Search batteries..." className="w-64" />
            </div>
          </div>
        </div>

        <TabsContent value="all" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>All Batteries</CardTitle>
              <CardDescription>View and manage all batteries in the inventory</CardDescription>
            </CardHeader>
            <CardContent>
              <BatteryStats />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="broadway" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Broadway Batteries</CardTitle>
              <CardDescription>Batteries at the Broadway location</CardDescription>
            </CardHeader>
            <CardContent>
              <BatteryStats location="Broadway" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="camelback" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Camelback Batteries</CardTitle>
              <CardDescription>Batteries at the Camelback location</CardDescription>
            </CardHeader>
            <CardContent>
              <BatteryStats location="Camelback" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reorder" className="mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Re-order Batteries</CardTitle>
                <CardDescription>Manage battery orders and inventory levels</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setModalOpen(true)}>
                  <PackagePlus className="mr-2 h-4 w-4" />
                  Receive Order
                </Button>
                <Button onClick={() => setReorderModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Reorder
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div>
                      <label htmlFor="stockNumber" className="text-sm font-medium mb-1 block">
                        Select Stock Number
                      </label>
                      <Select onValueChange={setSelectedStockNumber} value={selectedStockNumber}>
                        <SelectTrigger id="stockNumber" className="w-full">
                          <SelectValue placeholder="Select a stock number" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Alpha Batteries</SelectLabel>
                            {batteryInventory.Alpha.stockItems.map((item) => (
                              <SelectItem key={item.stockNumber} value={item.stockNumber}>
                                <div className="flex items-center">
                                  <Badge variant="outline" className="bg-blue-50 mr-2">
                                    {item.stockNumber}
                                  </Badge>
                                  {item.description}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>Bravo Batteries</SelectLabel>
                            {batteryInventory.Bravo.stockItems.map((item) => (
                              <SelectItem key={item.stockNumber} value={item.stockNumber}>
                                <div className="flex items-center">
                                  <Badge variant="outline" className="bg-green-50 mr-2">
                                    {item.stockNumber}
                                  </Badge>
                                  {item.description}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>Charlie Batteries</SelectLabel>
                            {batteryInventory.Charlie.stockItems.map((item) => (
                              <SelectItem key={item.stockNumber} value={item.stockNumber}>
                                <div className="flex items-center">
                                  <Badge variant="outline" className="bg-amber-50 mr-2">
                                    {item.stockNumber}
                                  </Badge>
                                  {item.description}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>AMG Batteries</SelectLabel>
                            {batteryInventory.AMG.stockItems.map((item) => (
                              <SelectItem key={item.stockNumber} value={item.stockNumber}>
                                <div className="flex items-center">
                                  <Badge variant="outline" className="bg-purple-50 mr-2">
                                    {item.stockNumber}
                                  </Badge>
                                  {item.description}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end space-x-4">
                      <div className="flex-1">
                        <label htmlFor="quantity" className="text-sm font-medium mb-1 block">
                          Quantity
                        </label>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          value={reorderQuantity}
                          onChange={(e) => setReorderQuantity(Number.parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="flex-1">
                        <label htmlFor="location" className="text-sm font-medium mb-1 block">
                          Location
                        </label>
                        <Select onValueChange={setReorderLocation} value={reorderLocation}>
                          <SelectTrigger id="location">
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Broadway">Broadway</SelectItem>
                            <SelectItem value="Camelback">Camelback</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleStockItemReorder} disabled={!selectedStockNumber || reorderQuantity <= 0}>
                        Reorder
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stock Number</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Current Inventory</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allStockItems.map((item) => {
                        const batteryType = item.type
                        const parLevel = batteryInventory[batteryType as keyof typeof batteryInventory].parLevel
                        const needsReorder =
                          item.quantity <
                          parLevel / batteryInventory[batteryType as keyof typeof batteryInventory].stockItems.length
                        const reorderQty = needsReorder
                          ? Math.ceil(
                              parLevel /
                                batteryInventory[batteryType as keyof typeof batteryInventory].stockItems.length -
                                item.quantity,
                            )
                          : 0

                        return (
                          <TableRow key={item.stockNumber}>
                            <TableCell>
                              <Badge variant="outline" className={getBatteryTypeClass(batteryType)}>
                                {item.stockNumber}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getBatteryTypeClass(batteryType)}>
                                {batteryType}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>
                              <Badge
                                variant={needsReorder ? "destructive" : "default"}
                                className={needsReorder ? "flash-warning" : ""}
                              >
                                {needsReorder ? `Need ${reorderQty}` : "Sufficient"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant={needsReorder ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                  setSelectedStockNumber(item.stockNumber)
                                  setReorderQuantity(needsReorder ? reorderQty : 1)
                                  setReorderModalOpen(true)
                                }}
                              >
                                Reorder
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="rounded-md border p-4">
                  <h3 className="text-lg font-medium mb-4">Recent Orders</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                      <div>
                        <p className="font-medium">Order #12345</p>
                        <p className="text-sm text-muted-foreground">Alpha Batteries - 20 units</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">Broadway Location</p>
                        <p className="text-xs text-muted-foreground">Received: 04/02/2023</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                      <div>
                        <p className="font-medium">Order #12344</p>
                        <p className="text-sm text-muted-foreground">Bravo Batteries - 15 units</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">Camelback Location</p>
                        <p className="text-xs text-muted-foreground">Received: 03/28/2023</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                      <div>
                        <p className="font-medium">Order #12343</p>
                        <p className="text-sm text-muted-foreground">AMG Batteries - 10 units</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">Broadway Location</p>
                        <p className="text-xs text-muted-foreground">Received: 03/15/2023</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ReorderBatteryModal open={modalOpen} onOpenChange={setModalOpen} onReorder={handleReorder} />

      <Dialog open={reorderModalOpen} onOpenChange={setReorderModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Reorder Battery</DialogTitle>
            <DialogDescription>Create a new reorder for the selected battery stock number.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label htmlFor="modalStockNumber" className="text-sm font-medium">
                Stock Number
              </label>
              <Select onValueChange={setSelectedStockNumber} value={selectedStockNumber}>
                <SelectTrigger id="modalStockNumber">
                  <SelectValue placeholder="Select a stock number" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Alpha Batteries</SelectLabel>
                    {batteryInventory.Alpha.stockItems.map((item) => (
                      <SelectItem key={item.stockNumber} value={item.stockNumber}>
                        <div className="flex items-center">
                          <Badge variant="outline" className="bg-blue-50 mr-2">
                            {item.stockNumber}
                          </Badge>
                          {item.description}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Bravo Batteries</SelectLabel>
                    {batteryInventory.Bravo.stockItems.map((item) => (
                      <SelectItem key={item.stockNumber} value={item.stockNumber}>
                        <div className="flex items-center">
                          <Badge variant="outline" className="bg-green-50 mr-2">
                            {item.stockNumber}
                          </Badge>
                          {item.description}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Charlie Batteries</SelectLabel>
                    {batteryInventory.Charlie.stockItems.map((item) => (
                      <SelectItem key={item.stockNumber} value={item.stockNumber}>
                        <div className="flex items-center">
                          <Badge variant="outline" className="bg-amber-50 mr-2">
                            {item.stockNumber}
                          </Badge>
                          {item.description}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>AMG Batteries</SelectLabel>
                    {batteryInventory.AMG.stockItems.map((item) => (
                      <SelectItem key={item.stockNumber} value={item.stockNumber}>
                        <div className="flex items-center">
                          <Badge variant="outline" className="bg-purple-50 mr-2">
                            {item.stockNumber}
                          </Badge>
                          {item.description}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="modalQuantity" className="text-sm font-medium">
                Quantity
              </label>
              <Input
                id="modalQuantity"
                type="number"
                min="1"
                value={reorderQuantity}
                onChange={(e) => setReorderQuantity(Number.parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="modalLocation" className="text-sm font-medium">
                Location
              </label>
              <Select onValueChange={setReorderLocation} value={reorderLocation}>
                <SelectTrigger id="modalLocation">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Broadway">Broadway</SelectItem>
                  <SelectItem value="Camelback">Camelback</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReorderModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStockItemReorder} disabled={!selectedStockNumber || reorderQuantity <= 0}>
              Place Reorder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
