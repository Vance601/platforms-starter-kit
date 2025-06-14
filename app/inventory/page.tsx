"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlusCircle, Battery, Truck, ArrowRightLeft, AlertTriangle, CheckCircle, Package } from "lucide-react"
import Link from "next/link"
import { InventoryTable } from "@/components/inventory-table"
import { BatteryTruckAssignment } from "@/components/battery-truck-assignment"
import { InventoryVerification } from "@/components/inventory-verification"
import { useInventoryStore } from "@/lib/inventory-store"
import { Badge } from "@/components/ui/badge"
import { WarehouseTransfer } from "@/components/warehouse-transfer"

export default function InventoryPage() {
  const { inventory = [] } = useInventoryStore()
  const [activeView, setActiveView] = useState<string | null>(null)

  // Calculate totals for each battery type
  const getTotalByType = (type: string) => {
    const item = inventory.find((i) => i.type.toLowerCase() === type.toLowerCase())
    return item ? item.totalCount : 0
  }

  const getTotalByLocation = (type: string, location: string) => {
    const item = inventory.find((i) => i.type.toLowerCase() === type.toLowerCase())
    return item && item.locations ? item.locations[location.toLowerCase()] || 0 : 0
  }

  const getTotalInventory = () => {
    return inventory.reduce((total, item) => total + item.totalCount, 0)
  }

  const getLowStockItems = () => {
    return inventory.filter((item) => item.totalCount < 5).length
  }

  // Render the main inventory dashboard
  const renderInventoryDashboard = () => (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Inventory Control</h1>
        <div className="flex gap-2">
          <Link href="/inventory/new">
            <Button className="text-base h-11">
              <PlusCircle className="mr-2 h-5 w-5" />
              Add Inventory
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card
          className="bg-white hover:bg-gray-50 transition-colors cursor-pointer border-l-4 border-l-blue-500"
          onClick={() => setActiveView("all")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Package className="mr-2 h-5 w-5 text-blue-500" />
              Total Inventory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{getTotalInventory()}</div>
            <p className="text-sm text-muted-foreground">All battery types across all locations</p>
          </CardContent>
        </Card>

        <Card
          className="bg-white hover:bg-gray-50 transition-colors cursor-pointer border-l-4 border-l-green-500"
          onClick={() => setActiveView("verification")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
              Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                Pending
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Verify received inventory</p>
          </CardContent>
        </Card>

        <Card
          className="bg-white hover:bg-gray-50 transition-colors cursor-pointer border-l-4 border-l-blue-500"
          onClick={() => setActiveView("assign")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Truck className="mr-2 h-5 w-5 text-blue-500" />
              Assign to Trucks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Assign batteries from inventory to trucks</div>
          </CardContent>
        </Card>

        <Card
          className="bg-white hover:bg-gray-50 transition-colors cursor-pointer border-l-4 border-l-purple-500"
          onClick={() => setActiveView("transfer")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <ArrowRightLeft className="mr-2 h-5 w-5 text-purple-500" />
              Warehouse Transfer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Transfer inventory between locations</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card
          className={`bg-white hover:bg-gray-50 transition-colors cursor-pointer border-l-4 border-l-blue-600 ${activeView === "alpha" ? "border-2 border-blue-600" : ""}`}
          onClick={() => setActiveView("alpha")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Battery className="mr-2 h-5 w-5 text-blue-600" />
              Alpha Batteries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{getTotalByType("alpha")}</div>
            <div className="flex items-center gap-2 mt-1 text-sm">
              <span className="text-amber-700">Broadway: {getTotalByLocation("alpha", "broadway")}</span>
              <span className="text-purple-700">Camelback: {getTotalByLocation("alpha", "camelback")}</span>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`bg-white hover:bg-gray-50 transition-colors cursor-pointer border-l-4 border-l-green-600 ${activeView === "bravo" ? "border-2 border-green-600" : ""}`}
          onClick={() => setActiveView("bravo")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Battery className="mr-2 h-5 w-5 text-green-600" />
              Bravo Batteries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{getTotalByType("bravo")}</div>
            <div className="flex items-center gap-2 mt-1 text-sm">
              <span className="text-amber-700">Broadway: {getTotalByLocation("bravo", "broadway")}</span>
              <span className="text-purple-700">Camelback: {getTotalByLocation("bravo", "camelback")}</span>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`bg-white hover:bg-gray-50 transition-colors cursor-pointer border-l-4 border-l-amber-600 ${activeView === "charlie" ? "border-2 border-amber-600" : ""}`}
          onClick={() => setActiveView("charlie")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Battery className="mr-2 h-5 w-5 text-amber-600" />
              Charlie Batteries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{getTotalByType("charlie")}</div>
            <div className="flex items-center gap-2 mt-1 text-sm">
              <span className="text-amber-700">Broadway: {getTotalByLocation("charlie", "broadway")}</span>
              <span className="text-purple-700">Camelback: {getTotalByLocation("charlie", "camelback")}</span>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`bg-white hover:bg-gray-50 transition-colors cursor-pointer border-l-4 border-l-red-600 ${activeView === "amg" ? "border-2 border-red-600" : ""}`}
          onClick={() => setActiveView("amg")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Battery className="mr-2 h-5 w-5 text-red-600" />
              AMG Batteries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{getTotalByType("amg")}</div>
            <div className="flex items-center gap-2 mt-1 text-sm">
              <span className="text-amber-700">Broadway: {getTotalByLocation("amg", "broadway")}</span>
              <span className="text-purple-700">Camelback: {getTotalByLocation("amg", "camelback")}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card
        className={`bg-white hover:bg-gray-50 transition-colors cursor-pointer mb-6 border-l-4 border-l-amber-500 ${activeView === "low" ? "border-2 border-amber-500" : ""}`}
        onClick={() => setActiveView("low")}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5 text-amber-500" />
            Low Stock Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{getLowStockItems()}</div>
          <p className="text-sm text-muted-foreground">Items that need to be reordered soon</p>
        </CardContent>
      </Card>
    </>
  )

  // Render the active view content
  const renderActiveViewContent = () => {
    if (!activeView) return renderInventoryDashboard()

    return (
      <>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setActiveView(null)}>
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">
              {activeView === "all" && "All Inventory"}
              {activeView === "verification" && "Inventory Verification"}
              {activeView === "assign" && "Assign to Trucks"}
              {activeView === "transfer" && "Warehouse Transfer"}
              {activeView === "alpha" && "Alpha Batteries"}
              {activeView === "bravo" && "Bravo Batteries"}
              {activeView === "charlie" && "Charlie Batteries"}
              {activeView === "amg" && "AMG Batteries"}
              {activeView === "low" && "Low Stock Items"}
            </h1>
          </div>

          {activeView !== "verification" && activeView !== "assign" && activeView !== "transfer" && (
            <Link href="/inventory/new">
              <Button className="text-base h-11">
                <PlusCircle className="mr-2 h-5 w-5" />
                Add Inventory
              </Button>
            </Link>
          )}
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            {activeView === "all" && <InventoryTable />}
            {activeView === "verification" && <InventoryVerification />}
            {activeView === "assign" && <BatteryTruckAssignment />}
            {activeView === "transfer" && <WarehouseTransfer />}
            {activeView === "alpha" && <InventoryTable category="alpha" />}
            {activeView === "bravo" && <InventoryTable category="bravo" />}
            {activeView === "charlie" && <InventoryTable category="charlie" />}
            {activeView === "amg" && <InventoryTable category="amg" />}
            {activeView === "low" && <InventoryTable category="low" />}
          </CardContent>
        </Card>
      </>
    )
  }

  return <div className="flex flex-col gap-2">{renderActiveViewContent()}</div>
}
