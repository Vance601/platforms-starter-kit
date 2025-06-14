import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Edit, Battery, History, TrendingUp, FileText, ScanBarcode } from "lucide-react"
import { BarcodeReader } from "@/components/barcode-reader"
import Link from "next/link"

export default function BatteryDetailPage({ params }: { params: { id: string } }) {
  // In a real app, you would fetch the battery data based on the ID
  const battery = {
    id: params.id,
    type: "Lithium-Ion",
    model: "PowerCell X200",
    manufacturer: "BatteryTech Industries",
    serialNumber: "SN-2023-45678",
    currentInventory: 42,
    powerLevel: 87,
    location: "Building A - Room 203",
    installDate: "2022-06-15",
    lastMaintenance: "2023-04-01",
    nextMaintenance: "2023-07-01",
    health: "Excellent",
    status: "Active",
    cycleCount: 124,
    temperatureRange: "10°C - 35°C",
    currentTemperature: "22°C",
    notes: "Upgraded firmware on last maintenance. Battery performing above expectations.",
    barcodeValue: "BAT-2023-089",
  }

  const maintenanceHistory = [
    {
      date: "2023-04-01",
      technician: "John Doe",
      type: "Routine Inspection",
      findings: "All cells functioning normally. Cleaned terminals and updated firmware.",
    },
    {
      date: "2023-01-15",
      technician: "Sarah Miller",
      type: "Performance Test",
      findings: "Battery capacity at 98% of rated value. No issues detected.",
    },
    {
      date: "2022-10-22",
      technician: "Robert Chen",
      type: "Preventive Maintenance",
      findings: "Replaced cooling fan. Adjusted terminal connections.",
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href="/batteries">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{battery.id}</h1>
        <Badge
          variant={
            battery.status === "Active"
              ? "default"
              : battery.status === "Maintenance Required"
                ? "outline"
                : "destructive"
          }
        >
          {battery.status}
        </Badge>
        <div className="ml-auto flex gap-2">
          <Link href="/barcode">
            <Button variant="outline">
              <ScanBarcode className="mr-2 h-4 w-4" />
              Barcode Tools
            </Button>
          </Link>
          <Link href={`/batteries/${params.id}/edit`}>
            <Button>
              <Edit className="mr-2 h-4 w-4" />
              Edit Battery
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Battery Information</CardTitle>
            <CardDescription>Technical specifications and details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Type</p>
                <p>{battery.type}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Model</p>
                <p>{battery.model}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Manufacturer</p>
                <p>{battery.manufacturer}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Serial Number</p>
                <p>{battery.serialNumber}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Inventory</p>
                <p>{battery.currentInventory} units</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Power Level</p>
                <p>{battery.powerLevel}%</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Location</p>
                <p>{battery.location}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Install Date</p>
                <p>{battery.installDate}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
            <CardDescription>Real-time battery performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Battery className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Health Status</span>
                </div>
                <Badge
                  variant={
                    battery.health === "Excellent"
                      ? "default"
                      : battery.health === "Good"
                        ? "secondary"
                        : battery.health === "Fair"
                          ? "outline"
                          : "destructive"
                  }
                >
                  {battery.health}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <TrendingUp className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Charge Level</span>
                </div>
                <span>{battery.chargeLevel}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <History className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Cycle Count</span>
                </div>
                <span>{battery.cycleCount}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <TrendingUp className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Temperature</span>
                </div>
                <span>{battery.currentTemperature}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <ScanBarcode className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Barcode</span>
                </div>
                <span>{battery.barcodeValue}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Barcode Scanner</CardTitle>
          <CardDescription>Scan a barcode to quickly find a battery</CardDescription>
        </CardHeader>
        <CardContent>
          <BarcodeReader />
        </CardContent>
      </Card>

      <Tabs defaultValue="history" className="w-full">
        <TabsList>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="performance">Performance Data</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Battery History</CardTitle>
              <CardDescription>Record of all activities performed on this battery</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {maintenanceHistory.map((record, index) => (
                  <div key={index} className="border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-medium">{record.type}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{record.date}</span>
                        <Badge variant="outline">{record.technician}</Badge>
                      </div>
                    </div>
                    <p className="text-sm">{record.findings}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Data</CardTitle>
              <CardDescription>Historical performance metrics and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-64 border rounded-md">
                <p className="text-muted-foreground">Performance chart would be displayed here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Technical documentation and reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>Battery_Manual_PowerCellX200.pdf</span>
                  </div>
                  <Button variant="ghost" size="sm">
                    Download
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>Warranty_Certificate.pdf</span>
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
          <p>{battery.notes}</p>
        </CardContent>
      </Card>
    </div>
  )
}
