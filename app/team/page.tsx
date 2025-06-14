"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlusCircle, Search, Building2, MapPin } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Link from "next/link"

export default function TeamPage() {
  // Update the useState and add useEffect to load team members from localStorage
  const [teamMembers, setTeamMembers] = useState([])

  // State for search and filtering
  const [searchQuery, setSearchQuery] = useState("")
  const [locationFilter, setLocationFilter] = useState("all")
  const [filteredMembers, setFilteredMembers] = useState(teamMembers)

  // State for location assignment dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [newLocation, setNewLocation] = useState("")

  // Add useEffect to load team members from localStorage
  useEffect(() => {
    try {
      // Check if we have team members in localStorage
      const storedTeamMembers = localStorage.getItem("teamMembers")

      if (storedTeamMembers) {
        // If we have stored team members, parse and use them
        const parsedTeamMembers = JSON.parse(storedTeamMembers)
        console.log("Loaded team members from localStorage:", parsedTeamMembers)
        setTeamMembers(parsedTeamMembers)
      } else {
        // If no stored team members, initialize localStorage with our default data
        const defaultTeamMembers = [
          {
            id: "TM001",
            name: "John Doe",
            role: "Senior Technician",
            department: "Maintenance",
            email: "john.doe@example.com",
            phone: "(555) 123-4567",
            avatar: "/placeholder.svg?height=40&width=40",
            initials: "JD",
            status: "Active",
            location: "Broadway",
          },
          {
            id: "TM002",
            name: "Sarah Miller",
            role: "Technician",
            department: "Repair",
            email: "sarah.miller@example.com",
            phone: "(555) 234-5678",
            avatar: "/placeholder.svg?height=40&width=40",
            initials: "SM",
            status: "Active",
            location: "Camelback",
          },
          {
            id: "TM003",
            name: "Robert Chen",
            role: "Supervisor",
            department: "Installation",
            email: "robert.chen@example.com",
            phone: "(555) 345-6789",
            avatar: "/placeholder.svg?height=40&width=40",
            initials: "RC",
            status: "On Leave",
            location: "Broadway",
          },
          {
            id: "TM004",
            name: "Maria Garcia",
            role: "Technician",
            department: "Maintenance",
            email: "maria.garcia@example.com",
            phone: "(555) 456-7890",
            avatar: "/placeholder.svg?height=40&width=40",
            initials: "MG",
            status: "Active",
            location: "Camelback",
          },
          {
            id: "TM005",
            name: "James Wilson",
            role: "Driver",
            department: "Logistics",
            email: "james.wilson@example.com",
            phone: "(555) 567-8901",
            avatar: "/placeholder.svg?height=40&width=40",
            initials: "JW",
            status: "Active",
            location: "Broadway",
          },
        ]

        localStorage.setItem("teamMembers", JSON.stringify(defaultTeamMembers))
        console.log("Initialized default team members in localStorage")
        setTeamMembers(defaultTeamMembers)
      }
    } catch (error) {
      console.error("Error loading team members from localStorage:", error)
      // Fallback to empty array if there's an error
      setTeamMembers([])
    }
  }, [])

  // Filter team members based on search query and location filter
  useEffect(() => {
    let filtered = teamMembers

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (member) =>
          member.name.toLowerCase().includes(query) ||
          member.role.toLowerCase().includes(query) ||
          member.department.toLowerCase().includes(query) ||
          member.email.toLowerCase().includes(query),
      )
    }

    // Apply location filter
    if (locationFilter !== "all") {
      filtered = filtered.filter((member) => member.location === locationFilter)
    }

    setFilteredMembers(filtered)
  }, [searchQuery, locationFilter, teamMembers])

  // Handle opening the location assignment dialog
  const handleAssignLocation = (member) => {
    setSelectedMember(member)
    setNewLocation(member.location)
    setIsDialogOpen(true)
  }

  // Update the handleSaveLocation function to also update localStorage
  const handleSaveLocation = () => {
    if (selectedMember && newLocation) {
      const updatedMembers = teamMembers.map((member) =>
        member.id === selectedMember.id ? { ...member, location: newLocation } : member,
      )

      setTeamMembers(updatedMembers)
      localStorage.setItem("teamMembers", JSON.stringify(updatedMembers))
      setIsDialogOpen(false)
    }
  }

  // Get counts for each location
  const broadwayCount = teamMembers.filter((member) => member.location === "Broadway").length
  const camelbackCount = teamMembers.filter((member) => member.location === "Camelback").length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Team</h1>
        <Link href="/team/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Team Member
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Broadway Team</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{broadwayCount}</div>
            <p className="text-xs text-muted-foreground">Team members at Broadway location</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Camelback Team</CardTitle>
            <Building2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{camelbackCount}</div>
            <p className="text-xs text-muted-foreground">Team members at Camelback location</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search team members..."
            className="pl-8 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            <SelectItem value="Broadway">Broadway</SelectItem>
            <SelectItem value="Camelback">Camelback</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>View and manage your team of technicians and drivers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatar || "/placeholder.svg"} alt={member.name} />
                      <AvatarFallback>{member.initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium">{member.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {member.role} • {member.department}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden md:block">
                      <p className="text-sm">{member.email}</p>
                      <p className="text-sm text-muted-foreground">{member.phone}</p>
                    </div>
                    <Badge variant="outline" className={member.location === "Broadway" ? "bg-blue-50" : "bg-green-50"}>
                      <MapPin className="mr-1 h-3 w-3" />
                      {member.location}
                    </Badge>
                    <Badge variant={member.status === "Active" ? "default" : "outline"}>{member.status}</Badge>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleAssignLocation(member)}>
                        Assign
                      </Button>
                      <Link href={`/team/${member.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No team members found</h3>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filter criteria</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Location Assignment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign Location</DialogTitle>
            <DialogDescription>Assign {selectedMember?.name} to a new location.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="location" className="text-right">
                Location
              </label>
              <Select value={newLocation} onValueChange={setNewLocation}>
                <SelectTrigger id="location" className="col-span-3">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLocation}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
