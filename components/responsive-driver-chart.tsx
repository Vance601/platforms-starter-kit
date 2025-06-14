"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMediaQuery } from "@/hooks/use-media-query"

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
}

export function ResponsiveDriverChart() {
  const isDesktop = useMediaQuery("(min-width: 768px)")

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
    },
  ]

  // Prepare data for the performance comparison chart
  const performanceData = drivers.map((driver) => ({
    name: driver.name.split(" ")[0], // Just use first name for chart
    batteryUsage: driver.batteryUsage,
    efficiency: driver.efficiency,
    responseTime: driver.responseTime,
    rating: driver.customerRating * 20, // Scale to 0-100 for consistency
  }))

  // Prepare data for the jobs completed chart
  const jobsData = drivers.map((driver) => ({
    name: driver.name.split(" ")[0],
    jobs: driver.completedJobs,
    location: driver.location,
  }))

  // Colors for the charts
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"]

  // Mobile-optimized performance data
  const mobilePerformanceData = drivers
    .map((driver) => {
      const overallScore =
        (driver.batteryUsage + driver.efficiency + driver.responseTime + driver.customerRating * 20) / 4
      return {
        name: driver.name.split(" ")[0],
        score: Math.round(overallScore),
        jobs: driver.completedJobs,
        location: driver.location,
      }
    })
    .sort((a, b) => b.score - a.score)

  return (
    <div className="space-y-4 pb-16 md:pb-0">
      {isDesktop ? (
        // Desktop/Tablet View
        <Tabs defaultValue="performance">
          <TabsList className="mb-0 h-12">
            <TabsTrigger value="performance" className="text-base h-full px-4">
              Performance Metrics
            </TabsTrigger>
            <TabsTrigger value="jobs" className="text-base h-full px-4">
              Completed Jobs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="mt-0 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-lg">Driver Performance Metrics</CardTitle>
                  <CardDescription>Key performance indicators by driver</CardDescription>
                </CardHeader>
                <CardContent className="px-2 pb-2">
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-lg">Top Performers</CardTitle>
                  <CardDescription>Drivers ranked by overall performance</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-2">
                  <div className="space-y-4">
                    {drivers
                      .sort((a, b) => {
                        const aScore = (a.batteryUsage + a.efficiency + a.responseTime + a.customerRating * 20) / 4
                        const bScore = (b.batteryUsage + b.efficiency + b.responseTime + b.customerRating * 20) / 4
                        return bScore - aScore
                      })
                      .map((driver, index) => {
                        const overallScore =
                          (driver.batteryUsage + driver.efficiency + driver.responseTime + driver.customerRating * 20) /
                          4

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
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="jobs" className="mt-0 pt-0">
            <Card>
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-lg">Completed Jobs by Driver</CardTitle>
                <CardDescription>Number of jobs completed by each driver</CardDescription>
              </CardHeader>
              <CardContent className="px-2 pb-2">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={jobsData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value} jobs`, ""]} />
                      <Legend />
                      <Bar dataKey="jobs" name="Completed Jobs">
                        {jobsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.location === "Broadway" ? "#0088FE" : "#00C49F"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        // Mobile View
        <div className="space-y-4">
          <Card>
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-lg">Top Performers</CardTitle>
              <CardDescription>Ranked by overall score</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-2">
              <div className="space-y-4">
                {mobilePerformanceData.map((driver, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{driver.name}</p>
                        <p className="text-xs text-muted-foreground">{driver.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          driver.score >= 90
                            ? "bg-green-500"
                            : driver.score >= 80
                              ? "bg-blue-500"
                              : driver.score >= 70
                                ? "bg-yellow-500"
                                : "bg-red-500"
                        }
                      >
                        {driver.score}%
                      </Badge>
                      <span className="text-sm font-medium">{driver.jobs}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-lg">Performance by Location</CardTitle>
              <CardDescription>Jobs completed by location</CardDescription>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        {
                          name: "Broadway",
                          value: drivers
                            .filter((d) => d.location === "Broadway")
                            .reduce((sum, d) => sum + d.completedJobs, 0),
                          fill: "#0088FE",
                        },
                        {
                          name: "Camelback",
                          value: drivers
                            .filter((d) => d.location === "Camelback")
                            .reduce((sum, d) => sum + d.completedJobs, 0),
                          fill: "#00C49F",
                        },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    />
                    <Tooltip formatter={(value) => [`${value} jobs`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
