"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Building2 } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function EditTeamMemberPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    id: params.id,
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "",
    department: "",
    location: "",
    certifications: "",
    notes: "",
    status: "Active",
    hireDate: "",
  })

  // Fetch team member data on component mount
  useEffect(() => {
    // In a real app, you would fetch this from an API
    // For now, we'll simulate with a mock team member
    const mockTeamMember = {
      id: params.id,
      name: "John Doe",
      firstName: "John",
      lastName: "Doe",
      role: "Senior Technician",
      department: "Maintenance",
      email: "john.doe@example.com",
      phone: "(555) 123-4567",
      status: "Active",
      location: "Broadway",
      hireDate: "2020-05-15",
      certifications: "Battery Safety Specialist, Electrical Systems Expert",
      notes: "John is one of our most experienced technicians with expertise in emergency battery systems.",
    }

    // Try to get from localStorage first
    try {
      const storedTeamMembers = JSON.parse(localStorage.getItem("teamMembers") || "[]")
      const teamMember = storedTeamMembers.find((tm: any) => tm.id === params.id)

      if (teamMember) {
        // Split the name into first and last name
        const nameParts = teamMember.name.split(" ")
        const firstName = nameParts[0]
        const lastName = nameParts.slice(1).join(" ")

        setFormData({
          id: teamMember.id,
          firstName,
          lastName,
          email: teamMember.email || "",
          phone: teamMember.phone || "",
          role: teamMember.role || "",
          department: teamMember.department || "",
          location: teamMember.location || "",
          certifications: teamMember.certifications || "",
          notes: teamMember.notes || "",
          status: teamMember.status || "Active",
          hireDate: teamMember.hireDate || "",
        })
      } else {
        // Fall back to mock data if not found in localStorage
        setFormData({
          id: mockTeamMember.id,
          firstName: mockTeamMember.firstName,
          lastName: mockTeamMember.lastName,
          email: mockTeamMember.email,
          phone: mockTeamMember.phone,
          role: mockTeamMember.role,
          department: mockTeamMember.department,
          location: mockTeamMember.location,
          certifications: mockTeamMember.certifications,
          notes: mockTeamMember.notes,
          status: mockTeamMember.status,
          hireDate: mockTeamMember.hireDate,
        })
      }
    } catch (error) {
      console.error("Error loading team member data:", error)
      // Fall back to mock data
      setFormData({
        id: mockTeamMember.id,
        firstName: mockTeamMember.firstName,
        lastName: mockTeamMember.lastName,
        email: mockTeamMember.email,
        phone: mockTeamMember.phone,
        role: mockTeamMember.role,
        department: mockTeamMember.department,
        location: mockTeamMember.location,
        certifications: mockTeamMember.certifications,
        notes: mockTeamMember.notes,
        status: mockTeamMember.status,
        hireDate: mockTeamMember.hireDate,
      })
    }
  }, [params.id])

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Update the team member object
    const updatedTeamMember = {
      id: params.id,
      name: `${formData.firstName} ${formData.lastName}`,
      role: formData.role,
      department: formData.department,
      email: formData.email,
      phone: formData.phone,
      avatar: "/placeholder.svg?height=40&width=40",
      initials: `${formData.firstName.charAt(0)}${formData.lastName.charAt(0)}`,
      status: formData.status,
      location: formData.location,
      certifications: formData.certifications,
      notes: formData.notes,
      hireDate: formData.hireDate,
    }

    // Update the team member in localStorage
    try {
      const existingTeamMembers = JSON.parse(localStorage.getItem("teamMembers") || "[]")
      const updatedTeamMembers = existingTeamMembers.map((tm: any) => (tm.id === params.id ? updatedTeamMember : tm))
      localStorage.setItem("teamMembers", JSON.stringify(updatedTeamMembers))
      console.log("Team member updated and saved to localStorage:", updatedTeamMember)
    } catch (error) {
      console.error("Error saving team member to localStorage:", error)
    }

    // Simulate API call with timeout
    setTimeout(() => {
      setIsSubmitting(false)
      // Redirect to team member page after successful submission
      router.push(`/team/${params.id}`)
    }, 1000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href={`/team/${params.id}`}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Edit Team Member</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Team Member Information</CardTitle>
            <CardDescription>Update the details of the team member</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2 flex justify-center mb-4">
                <div className="flex flex-col items-center gap-2">
                  <Avatar className="h-24 w-24">
                    <AvatarFallback>
                      {formData.firstName.charAt(0)}
                      {formData.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-sm text-muted-foreground">Avatar preview</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="Enter first name"
                  value={formData.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Enter last name"
                  value={formData.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="Enter phone number"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(value) => handleChange("role", value)} required>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="senior-technician">Senior Technician</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => handleChange("department", value)}
                  required
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="installation">Installation</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="logistics">Logistics</SelectItem>
                    <SelectItem value="administration">Administration</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleChange("status", value)} required>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="On Leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Select value={formData.location} onValueChange={(value) => handleChange("location", value)} required>
                  <SelectTrigger id="location">
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

            <div className="space-y-2">
              <Label htmlFor="certifications">Certifications</Label>
              <Textarea
                id="certifications"
                placeholder="List relevant certifications"
                rows={2}
                value={formData.certifications}
                onChange={(e) => handleChange("certifications", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Enter any additional notes"
                rows={3}
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Link href={`/team/${params.id}`}>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
