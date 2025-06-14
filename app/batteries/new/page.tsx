"use client"

import type React from "react"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function NewBatteryPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    type: "",
    model: "",
    manufacturer: "",
    serialNumber: "",
    capacity: "",
    voltage: "",
    location: "",
    notes: "",
  })

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate API call with timeout
    setTimeout(() => {
      console.log("Battery added:", formData)
      setIsSubmitting(false)
      // Redirect to batteries page after successful submission
      router.push("/batteries")
    }, 1000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href="/batteries">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Add New Battery</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Battery Information</CardTitle>
            <CardDescription>Enter the details of the new battery</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="type">Battery Type</Label>
                <Select value={formData.type} onValueChange={(value) => handleChange("type", value)} required>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lithium-ion">Lithium-Ion</SelectItem>
                    <SelectItem value="lead-acid">Lead-Acid</SelectItem>
                    <SelectItem value="agm">AGM</SelectItem>
                    <SelectItem value="gel">Gel</SelectItem>
                    <SelectItem value="nimh">NiMH</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  placeholder="Enter model number"
                  value={formData.model}
                  onChange={(e) => handleChange("model", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input
                  id="manufacturer"
                  placeholder="Enter manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => handleChange("manufacturer", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serialNumber">Serial Number</Label>
                <Input
                  id="serialNumber"
                  placeholder="Enter serial number"
                  value={formData.serialNumber}
                  onChange={(e) => handleChange("serialNumber", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  placeholder="E.g., 120 Ah"
                  value={formData.capacity}
                  onChange={(e) => handleChange("capacity", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="voltage">Voltage</Label>
                <Input
                  id="voltage"
                  placeholder="E.g., 12V"
                  value={formData.voltage}
                  onChange={(e) => handleChange("voltage", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="Enter installation location"
                  value={formData.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Enter any additional notes"
                rows={4}
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Link href="/batteries">
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Battery"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
