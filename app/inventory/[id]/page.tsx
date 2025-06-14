import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Edit, FileText } from "lucide-react"
import { InventoryUsageChart } from "@/components/inventory-usage-chart"
import { InventoryHistory } from "@/components/inventory-history"
import Link from "next/link"

export default function InventoryItemPage({ params }: { params: { id: string } }) {
  // In a real app, you would fetch the item data based on the ID
  const item = {
    id: params.id,
    name: "Lithium-Ion Cell 18650",
    sku: "BAT-LI-18650",
    description:
      "High-performance lithium-ion battery cell with 3.7V nominal voltage and 2600mAh capacity. Used in various battery pack configurations.",
    category: "battery-parts",
    quantity: 245,
    minQuantity: 50,
    maxQuantity: 500,
    location: "Warehouse A-12",
    unitPrice: 8.99,
    totalValue: 2203.55,
    supplier: "BatteryTech Industries",
    supplierContact: "supplier@batterytech.com",
    lastRestocked: "2023-03-15",
    reorderLeadTime: "14 days",
    notes:
      "These cells are compatible with all PowerCell X200 battery packs. Quality testing required before installation.",
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href="/inventory">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{item.name}</h1>
        <Badge variant="outline">{item.sku}</Badge>
        <div className="ml-auto">
          <Link href={`/inventory/${params.id}/edit`}>
            <Button>
              <Edit className="mr-2 h-4 w-4" />
              Edit Item
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Item Information</CardTitle>
            <CardDescription>Details and specifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Category</p>
                <p>Battery Parts</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Location</p>
                <p>{item.location}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Quantity</p>
                <p>{item.quantity} units</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Min Quantity</p>
                <p>{item.minQuantity} units</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Unit Price</p>
                <p>${item.unitPrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                <p>${item.totalValue.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Supplier</p>
                <p>{item.supplier}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Restocked</p>
                <p>{item.lastRestocked}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory Management</CardTitle>
            <CardDescription>Stock levels and reordering information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Stock Level</p>
              <div className="h-4 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, (item.quantity / item.maxQuantity) * 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0</span>
                <span>Min: {item.minQuantity}</span>
                <span>Max: {item.maxQuantity}</span>
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Current Stock:</span>
                <span>{item.quantity} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Reorder Point:</span>
                <span>{item.minQuantity} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Reorder Lead Time:</span>
                <span>{item.reorderLeadTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Supplier Contact:</span>
                <span>{item.supplierContact}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <div className="flex gap-2 w-full">
              <Button className="flex-1">Restock</Button>
              <Button variant="outline" className="flex-1">
                Adjust Quantity
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{item.description}</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="usage" className="w-full">
        <TabsList>
          <TabsTrigger value="usage">Usage History</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Usage History</CardTitle>
              <CardDescription>Consumption patterns over time</CardDescription>
            </CardHeader>
            <CardContent>
              <InventoryUsageChart />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>Record of all inventory movements</CardDescription>
            </CardHeader>
            <CardContent>
              <InventoryHistory itemId={params.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Specifications, manuals, and certificates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>Lithium_Ion_18650_Spec_Sheet.pdf</span>
                  </div>
                  <Button variant="ghost" size="sm">
                    Download
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>Safety_Data_Sheet.pdf</span>
                  </div>
                  <Button variant="ghost" size="sm">
                    Download
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>Quality_Certificate.pdf</span>
                  </div>
                  <Button variant="ghost" size="sm">
                    Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{item.notes}</p>
        </CardContent>
      </Card>
    </div>
  )
}
