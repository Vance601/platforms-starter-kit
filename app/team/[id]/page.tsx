"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Edit, MapPin, Building2, Phone, Mail, Calendar, ClipboardList } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

export default function TeamMemberPage({ params }: { params: { id: string } }) {
  // In a real app, you would fetch the team member data based on the ID
  const [teamMember, setTeamMember] = useState(() => {
    // Try to get from localStorage first
    try {
      const storedTeamMembers = JSON.parse(localStorage.getItem("teamMembers") || "[]")
      const member = storedTeamMembers.find((tm: any) => tm.id === params.id)

      if (member) {
        return {
          ...member,
          certifications: Array.isArray(member.certifications)
            ? member.certifications
            : member.certifications?.split(",").map((c: string) => c.trim()) || [],
          skills: member.skills || ["Battery Installation", "Diagnostics", "Maintenance", "Troubleshooting"],
          recentAssignments: member.recentAssignments || [
            {
              id: "TASK-1234",
              title: "Battery replacement at Client XYZ",
              date: "2023-04-02",
              status: "Completed",
            },
            {
              id: "TASK-1235",
              title: "Emergency power system check",
              date: "2023-03-28",
              status: "Completed",
            },
            {
              id: "TASK-1236",
              title: "Quarterly maintenance for Building A",
              date: "2023-03-15",
              status: "Completed",
            },
          ],
        }
      }
    } catch (error) {
      console.error("Error loading team member data:", error)
    }

    // Fallback to default data if not found in localStorage
    return {
      id: params.id,
      name: "John Doe",
      role: "Senior Technician",
      department: "Maintenance",
      email: "john.doe@example.com",
      phone: "(555) 123-4567",
      avatar: "/placeholder.svg?height=100&width=100",
      initials: "JD",
      status: "Active",
      location: "Broadway",
      hireDate: "2020-05-15",
      certifications: ["Battery Safety Specialist", "Electrical Systems Expert", "Emergency Response Technician"],
      skills: ["Battery Installation", "Diagnostics", "Maintenance", "Troubleshooting"],
      recentAssignments: [
        {
          id: "TASK-1234",
          title: "Battery replacement at Client XYZ",
          date: "2023-04-02",
          status: "Completed",
        },
        {
          id: "TASK-1235",
          title: "Emergency power system check",
          date: "2023-03-28",
          status: "Completed",
        },
        {
          id: "TASK-1236",
          title: "Quarterly maintenance for Building A",
          date: "2023-03-15",
          status: "Completed",
        },
      ],
      notes:
        "John is one of our most experienced technicians with expertise in emergency battery systems. He has been with the company for over 3 years and has received multiple commendations for his work.",
    }
  })

  // Function to update team member location
  const handleLocationChange = (newLocation: string) => {
    setTeamMember((prev) => {
      const updated = {
        ...prev,
        location: newLocation,
      }

      // Update in localStorage
      try {
        const storedTeamMembers = JSON.parse(localStorage.getItem("teamMembers") || "[]")
        const updatedTeamMembers = storedTeamMembers.map((tm: any) =>
          tm.id === params.id ? { ...tm, location: newLocation } : tm,
        )
        localStorage.setItem("teamMembers", JSON.stringify(updatedTeamMembers))
      } catch (error) {
        console.error("Error updating team member location:", error)
      }

      return updated
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href="/team">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{teamMember.name}</h1>
        <Badge variant={teamMember.status === "Active" ? "default" : "outline"}>{teamMember.status}</Badge>
        <div className="ml-auto">
          <Link href={`/team/${params.id}/edit`}>
            <Button>
              <Edit className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Team member information</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            <Avatar className="h-24 w-24 mb-4">
              <AvatarImage src={teamMember.avatar || "/placeholder.svg"} alt={teamMember.name} />
              <AvatarFallback className="text-2xl">{teamMember.initials}</AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-bold">{teamMember.name}</h2>
            <p className="text-sm text-muted-foreground mb-4">{teamMember.role}</p>

            <div className="w-full space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 text-left">Location</div>
                <Badge variant="outline" className={teamMember.location === "Broadway" ? "bg-blue-50" : "bg-green-50"}>
                  <MapPin className="mr-1 h-3 w-3" />
                  {teamMember.location}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 text-left">Email</div>
                <span className="text-sm">{teamMember.email}</span>
              </div>

              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 text-left">Phone</div>
                <span className="text-sm">{teamMember.phone}</span>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 text-left">Hire Date</div>
                <span className="text-sm">{teamMember.hireDate}</span>
              </div>

              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 text-left">Department</div>
                <span className="text-sm">{teamMember.department}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <div className="w-full">
              <label className="text-sm font-medium mb-2 block">Change Location</label>
              <Select value={teamMember.location} onValueChange={handleLocationChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Broadway">
                    <div className="flex items-center">
                      <Building2 className="mr-2 h-4 w-4 text-blue-500" />
                      Broadway
                    </div>
                  </SelectItem>
                  <SelectItem value="Camelback">
                    <div className="flex items-center">
                      <Building2 className="mr-2 h-4 w-4 text-green-500" />
                      Camelback
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardFooter>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Skills & Certifications</CardTitle>
              <CardDescription>Professional qualifications and expertise</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium mb-2">Certifications</h3>
                  <div className="space-y-2">
                    {teamMember.certifications.map((cert, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <Badge variant="outline">Certified</Badge>
                        <span>{cert}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {teamMember.skills.map((skill, index) => (
                      <Badge key={index} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="assignments" className="w-full">
            <TabsList>
              <TabsTrigger value="assignments">Recent Assignments</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="assignments" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Assignments</CardTitle>
                  <CardDescription>Tasks and projects assigned to this team member</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {teamMember.recentAssignments.map((assignment) => (
                      <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-md">
                        <div>
                          <p className="font-medium">{assignment.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {assignment.id} • {assignment.date}
                          </p>
                        </div>
                        <Badge variant="outline">{assignment.status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                  <CardDescription>Additional information about this team member</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>{teamMember.notes}</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
