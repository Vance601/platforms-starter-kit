"use client"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Calendar, FilterIcon } from "lucide-react"

interface DriverData {
  id: string
  name: string
  avatar: string
  initials: string
  batteryUsage: number
  efficiency: number
  responseTime: number
  customerRating: number
  completedJobs: number
  location: string
  batteriesCheckedOut: number
  batteriesSold: number
  conversionRate: number
}

export function DriverPerformanceChart() {
  // Date range state
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    return date.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0])
  const [isFiltering, setIsFiltering] = useState(false)

  // Sample data - in a real app, this would come from your database
  const drivers: DriverData[] = [
    {
      id: "D001",
      name: "John Doe",
      avatar: "/placeholder.svg?height=40&width=40",
      initials: "JD",
      batteryUsage: 85,
      efficiency: 92,
      responseTime: 88,
      customerRating: 4.8,
      completedJobs: 145,
      location: "Broadway",
      batteriesCheckedOut: 180,
      batteriesSold: 162,
      conversionRate: 90,
    },
    {
      id: "D002",
      name: "Sarah Miller",
      avatar: "/placeholder.svg?height=40&width=40",
      initials: "SM",
      batteryUsage: 78,
      efficiency: 85,
      responseTime: 92,
      customerRating: 4.6,
      completedJobs: 132,
      location: "Camelback",
      batteriesCheckedOut: 155,
      batteriesSold: 124,
      conversionRate: 80,
    },
    {
      id: "D003",
      name: "Robert Chen",
      avatar: "/placeholder.svg?height=40&width=40",
      initials: "RC",
      batteryUsage: 92,
      efficiency: 88,
      responseTime: 85,
      customerRating: 4.9,
      completedJobs: 156,
      location: "Broadway",
      batteriesCheckedOut: 190,
      batteriesSold: 171,
      conversionRate: 90,
    },
    {
      id: "D004",
      name: "Maria Garcia",
      avatar: "/placeholder.svg?height=40&width=40",
      initials: "MG",
      batteryUsage: 80,
      efficiency: 90,
      responseTime: 82,
      customerRating: 4.7,
      completedJobs: 128,
      location: "Camelback",
      batteriesCheckedOut: 150,
      batteriesSold: 135,
      conversionRate: 90,
    },
    {
      id: "D005",
      name: "James Wilson",
      avatar: "/placeholder.svg?height=40&width=40",
      initials: "JW",
      batteryUsage: 75,
      efficiency: 82,
      responseTime: 90,
      customerRating: 4.5,
      completedJobs: 118,
      location: "Broadway",
      batteriesCheckedOut: 140,
      batteriesSold: 98,
      conversionRate: 70,
    },
  ]

  // Prepare data for the conversion rate chart
  const conversionData = drivers.map((driver) => ({
    name: driver.name.split(" ")[0], // Just use first name for chart
    conversionRate: driver.conversionRate,
    checkedOut: driver.batteriesCheckedOut,
    sold: driver.batteriesSold,
    location: driver.location,
  }))

  // Prepare data for the performance comparison chart
  const performanceData = drivers.map((driver) => ({
    name: driver.name.split(" ")[0], // Just use first name for chart
    batteryUsage: driver.batteryUsage,
    efficiency: driver.efficiency,
    responseTime: driver.responseTime,
    rating: driver.customerRating * 20, // Scale to 0-100 for consistency
  }))

  // Prepare data for the radar chart
  const radarData = [
    { subject: "Battery Usage", A: drivers[0].batteryUsage, B: drivers[1].batteryUsage, fullMark: 100 },
    { subject: "Efficiency", A: drivers[0].efficiency, B: drivers[1].efficiency, fullMark: 100 },
    { subject: "Response Time", A: drivers[0].responseTime, B: drivers[1].responseTime, fullMark: 100 },
    { subject: "Customer Rating", A: drivers[0].customerRating * 20, B: drivers[1].customerRating * 20, fullMark: 100 },
    {
      subject: "Completed Jobs",
      A: (drivers[0].completedJobs / 200) * 100,
      B: (drivers[1].completedJobs / 200) * 100,
      fullMark: 100,
    },
  ]

  // Prepare data for the jobs completed chart
  const jobsData = drivers.map((driver) => ({
    name: driver.name.split(" ")[0],
    jobs: driver.completedJobs,
    location: driver.location,
  }))

  // Colors for the charts
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"]

  // Custom tooltip for conversion rate chart
  const ConversionTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-md shadow-sm">
          <p className="font-medium">{label}</p>
          <p className="text-sm">
            Conversion Rate: <span className="font-medium">{payload[0].value}%</span>
          </p>
          <p className="text-sm">
            Checked Out: <span className="font-medium">{payload[1].payload.checkedOut}</span>
          </p>
          <p className="text-sm">
            Sold: <span className="font-medium">{payload[1].payload.sold}</span>
          </p>
          <p className="text-sm">
            Location: <span className="font-medium">{payload[1].payload.location}</span>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-4">
      {/* Date Range Filter */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Date Range Filter</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setIsFiltering(!isFiltering)}>
              <FilterIcon className="h-4 w-4 mr-2" />
              {isFiltering ? "Hide Filter" : "Show Filter"}
            </Button>
          </div>
          <CardDescription>Filter driver performance data by date range</CardDescription>
        </CardHeader>
        {isFiltering && (
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <Button>
                <Calendar className="mr-2 h-4 w-4" />
                Apply Filter
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Conversion Rate Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Battery Conversion Rate</CardTitle>
          <CardDescription>Percentage of checked-out batteries that were sold by each driver</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={conversionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip content={<ConversionTooltip />} />
                <Legend />
                <Bar dataKey="conversionRate" name="Conversion Rate %" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Battery Checkout vs Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Battery Checkout vs Sales</CardTitle>
          <CardDescription>Detailed breakdown of batteries checked out vs sold for each driver</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">Driver</th>
                  <th className="p-3 text-left font-medium">Location</th>
                  <th className="p-3 text-left font-medium">Checked Out</th>
                  <th className="p-3 text-left font-medium">Sold</th>
                  <th className="p-3 text-left font-medium">Conversion Rate</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver) => (
                  <tr key={driver.id} className="border-b">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={driver.avatar} alt={driver.name} />
                          <AvatarFallback>{driver.initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{driver.name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={driver.location === "Broadway" ? "bg-amber-50" : "bg-purple-50"}
                      >
                        {driver.location}
                      </Badge>
                    </td>
                    <td className="p-3">{driver.batteriesCheckedOut}</td>
                    <td className="p-3">{driver.batteriesSold}</td>
                    <td className="p-3">
                      <Badge
                        className={
                          driver.conversionRate >= 90
                            ? "bg-green-500"
                            : driver.conversionRate >= 80
                              ? "bg-blue-500"
                              : driver.conversionRate >= 70
                                ? "bg-yellow-500"
                                : "bg-red-500"
                        }
                      >
                        {driver.conversionRate}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={performanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value}%`, ""]} />
              <Legend />
              <Bar dataKey="batteryUsage" name="Battery Usage" fill="#0088FE" />
              <Bar dataKey="efficiency" name="Efficiency" fill="#00C49F" />
              <Bar dataKey="responseTime" name="Response Time" fill="#FFBB28" />
              <Bar dataKey="rating" name="Customer Rating" fill="#FF8042" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          {drivers
            .sort((a, b) => {
              const aScore = (a.batteryUsage + a.efficiency + a.responseTime + a.customerRating * 20) / 4
              const bScore = (b.batteryUsage + b.efficiency + b.responseTime + b.customerRating * 20) / 4
              return bScore - aScore
            })
            .slice(0, 5)
            .map((driver, index) => {
              const overallScore =
                (driver.batteryUsage + driver.efficiency + driver.responseTime + driver.customerRating * 20) / 4

              return (
                <div key={driver.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-sm font-medium">
                      {index + 1}
                    </div>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={driver.avatar} alt={driver.name} />
                      <AvatarFallback>{driver.initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{driver.name}</p>
                      <p className="text-xs text-muted-foreground">{driver.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        overallScore >= 90
                          ? "bg-green-500"
                          : overallScore >= 80
                            ? "bg-blue-500"
                            : overallScore >= 70
                              ? "bg-yellow-500"
                              : "bg-red-500"
                      }
                    >
                      {Math.round(overallScore)}%
                    </Badge>
                    <Badge variant="outline">{driver.completedJobs} jobs</Badge>
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
