"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, CheckCircle, Clock, Filter, ArrowUpDown, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { useAutoReorderManager } from "@/components/auto-reorder-manager"

// Mock alerts data
const mockAlerts = [
  {
    id: "alert-1",
    type: "inventory",
    severity: "critical",
    item: "Alpha Batteries",
    location: "Broadway",
    threshold: 15,
    current: 8,
    date: "2023-04-01T10:30:00Z",
    status: "active",
  },
  {
    id: "alert-2",
    type: "inventory",
    severity: "warning",
    item: "Bravo Batteries",
    location: "Camelback",
    threshold: 20,
    current: 12,
    date: "2023-04-02T14:15:00Z",
    status: "active",
  },
  {
    id: "alert-3",
    type: "core-return",
    severity: "critical",
    item: "Missing Core Returns",
    location: "Broadway",
    count: 12,
    date: "2023-04-03T09:45:00Z",
    status: "active",
  },
  {
    id: "alert-4",
    type: "inventory",
    severity: "critical",
    item: "Charlie Batteries",
    location: "Broadway",
    threshold: 12,
    current: 5,
    date: "2023-04-04T16:20:00Z",
    status: "active",
  },
  {
    id: "alert-5",
    type: "inventory",
    severity: "warning",
    item: "AMG Batteries",
    location: "Camelback",
    threshold: 8,
    current: 6,
    date: "2023-04-05T11:10:00Z",
    status: "active",
  },
]

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(mockAlerts)
  const [filteredAlerts, setFilteredAlerts] = useState(mockAlerts)
  const [locationFilter, setLocationFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [severityFilter, setSeverityFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState("newest")
  const [activeTab, setActiveTab] = useState("all")
  const { toast } = useToast()
  const autoReorderManager = useAutoReorderManager()

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...alerts]

    // Filter by tab (status)
    if (activeTab !== "all") {
      filtered = filtered.filter((alert) => alert.status === activeTab)
    }

    // Filter by location
    if (locationFilter !== "all") {
      filtered = filtered.filter((alert) => alert.location === locationFilter)
    }

    // Filter by type
    if (typeFilter !== "all") {
      filtered = filtered.filter((alert) => alert.type === typeFilter)
    }

    // Filter by severity
    if (severityFilter !== "all") {
      filtered = filtered.filter((alert) => alert.severity === severityFilter)
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (alert) => alert.item.toLowerCase().includes(query) || alert.location.toLowerCase().includes(query),
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
      case "severity-high":
        filtered.sort((a, b) => {
          const severityOrder = { critical: 0, warning: 1 }
          return (
            severityOrder[a.severity as keyof typeof severityOrder] -
            severityOrder[b.severity as keyof typeof severityOrder]
          )
        })
        break
      case "severity-low":
        filtered.sort((a, b) => {
          const severityOrder = { critical: 0, warning: 1 }
          return (
            severityOrder[b.severity as keyof typeof severityOrder] -
            severityOrder[a.severity as keyof typeof severityOrder]
          )
        })
        break
    }

    setFilteredAlerts(filtered)
  }, [alerts, locationFilter, typeFilter, severityFilter, searchQuery, sortOrder, activeTab])

  // Handle resolving an alert
  const handleResolveAlert = (alertId: string, addToReorder: boolean) => {
    const alertToResolve = alerts.find((alert) => alert.id === alertId)

    if (!alertToResolve) {
      toast({
        title: "Error",
        description: "Alert not found",
        variant: "destructive",
      })
      return
    }

    // If it's an inventory alert and we want to add to reorder
    if (addToReorder && alertToResolve.type === "inventory") {
      try {
        // Calculate quantity needed to reach threshold
        const quantityNeeded = alertToResolve.threshold - alertToResolve.current

        // Add to auto-reorder
        autoReorderManager.addAlertToReorder(
          alertToResolve,
          quantityNeeded,
          `Added from alert resolution: ${alertToResolve.item} at ${alertToResolve.location}`,
        )

        toast({
          title: "Added to Auto-Reorder",
          description: `${quantityNeeded} ${alertToResolve.item} added to reorder for ${alertToResolve.location}`,
        })
      } catch (error) {
        console.error("Error adding to reorder:", error)
        toast({
          title: "Error",
          description: "Failed to add to auto-reorder",
          variant: "destructive",
        })
      }
    }

    // Mark alert as resolved
    setAlerts((prev) => prev.map((alert) => (alert.id === alertId ? { ...alert, status: "resolved" } : alert)))

    toast({
      title: "Alert Resolved",
      description: `${alertToResolve.item} alert has been resolved`,
    })
  }

  // Get counts for tabs
  const activeCount = alerts.filter((alert) => alert.status === "active").length
  const resolvedCount = alerts.filter((alert) => alert.status === "resolved").length

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Alerts & Notifications</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search alerts..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
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
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="inventory">Inventory</SelectItem>
                <SelectItem value="core-return">Core Return</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger>
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
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
                <SelectItem value="severity-high">Highest Severity</SelectItem>
                <SelectItem value="severity-low">Lowest Severity</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="all">
            All Alerts{" "}
            <Badge variant="outline" className="ml-2">
              {alerts.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="active">
            Active{" "}
            <Badge variant="outline" className="ml-2">
              {activeCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="resolved">
            Resolved{" "}
            <Badge variant="outline" className="ml-2">
              {resolvedCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-0">
          <AlertsList alerts={filteredAlerts} onResolve={handleResolveAlert} />
        </TabsContent>

        <TabsContent value="active" className="mt-0">
          <AlertsList alerts={filteredAlerts} onResolve={handleResolveAlert} />
        </TabsContent>

        <TabsContent value="resolved" className="mt-0">
          <AlertsList alerts={filteredAlerts} onResolve={handleResolveAlert} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface AlertsListProps {
  alerts: any[]
  onResolve: (id: string, addToReorder: boolean) => void
}

function AlertsList({ alerts, onResolve }: AlertsListProps) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
        <h3 className="mt-4 text-lg font-medium">No alerts found</h3>
        <p className="mt-2 text-sm text-muted-foreground">There are no alerts matching your current filters.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} onResolve={onResolve} />
      ))}
    </div>
  )
}

interface AlertCardProps {
  alert: any
  onResolve: (id: string, addToReorder: boolean) => void
}

function AlertCard({ alert, onResolve }: AlertCardProps) {
  const isInventoryAlert = alert.type === "inventory"
  const isActive = alert.status === "active"

  return (
    <Card className={alert.severity === "critical" ? "border-red-300" : "border-yellow-300"}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{alert.item}</CardTitle>
            <CardDescription>
              {alert.location} • {new Date(alert.date).toLocaleDateString()}
            </CardDescription>
          </div>
          <StatusBadge status={alert.status} severity={alert.severity} />
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="space-y-2">
          {isInventoryAlert ? (
            <div className="text-sm">
              <div className="flex justify-between">
                <span>Current Level:</span>
                <span className="font-medium">{alert.current}</span>
              </div>
              <div className="flex justify-between">
                <span>Threshold:</span>
                <span className="font-medium">{alert.threshold}</span>
              </div>
              <div className="flex justify-between">
                <span>Needed:</span>
                <span className="font-medium">{alert.threshold - alert.current}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm">
              <div className="flex justify-between">
                <span>Missing Core Returns:</span>
                <span className="font-medium">{alert.count}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      {isActive && (
        <CardFooter className="pt-2">
          <div className="flex gap-2 w-full">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onResolve(alert.id, false)}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Resolve
            </Button>
            {isInventoryAlert && (
              <Button variant="default" size="sm" className="flex-1" onClick={() => onResolve(alert.id, true)}>
                Add to Reorder
              </Button>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  )
}

function StatusBadge({ status, severity }: { status: string; severity: string }) {
  if (status === "resolved") {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
        <CheckCircle className="mr-1 h-3 w-3" />
        Resolved
      </Badge>
    )
  }

  if (severity === "critical") {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Critical
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
      <Clock className="mr-1 h-3 w-3" />
      Warning
    </Badge>
  )
}
