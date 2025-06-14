"use client"

import type React from "react"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export default function NewInventoryItemPage() {
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    description: "",
    quantity: "",
    minQuantity: "",
    maxQuantity: "",
    location: "",
    unitPrice: "",
    supplier: "",
    supplierContact: "",
    reorderLeadTime: "",
    notes: "",
  })

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In a real app, you would save the data to your database here
    console.log("Form submitted:", formData)
    // Then redirect to the inventory page
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link href="/inventory">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Add New Inventory Item</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle>Item Information</CardTitle>
            <CardDescription>Enter the details of the new inventory item</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name</Label>
                <Input
                  id="name"
                  placeholder="Enter item name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  placeholder="Enter SKU"
                  value={formData.sku}
                  onChange={(e) => handleChange("sku", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => handleChange("category", value)}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="battery-parts">Battery Parts</SelectItem>
                    <SelectItem value="tools">Tools</SelectItem>
                    <SelectItem value="supplies">Supplies</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Storage Location</Label>
                <Input
                  id="location"
                  placeholder="Enter storage location"
                  value={formData.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Initial Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  placeholder="Enter initial quantity"
                  value={formData.quantity}
                  onChange={(e) => handleChange("quantity", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitPrice">Unit Price ($)</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter unit price"
                  value={formData.unitPrice}
                  onChange={(e) => handleChange("unitPrice", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minQuantity">Minimum Quantity</Label>
                <Input
                  id="minQuantity"
                  type="number"
                  min="0"
                  placeholder="Enter minimum quantity"
                  value={formData.minQuantity}
                  onChange={(e) => handleChange("minQuantity", e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Alert will be triggered when stock falls below this level
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxQuantity">Maximum Quantity</Label>
                <Input
                  id="maxQuantity"
                  type="number"
                  min="0"
                  placeholder="Enter maximum quantity"
                  value={formData.maxQuantity}
                  onChange={(e) => handleChange("maxQuantity", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter item description"
                rows={3}
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  id="supplier"
                  placeholder="Enter supplier name"
                  value={formData.supplier}
                  onChange={(e) => handleChange("supplier", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplierContact">Supplier Contact</Label>
                <Input
                  id="supplierContact"
                  placeholder="Enter supplier contact"
                  value={formData.supplierContact}
                  onChange={(e) => handleChange("supplierContact", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reorderLeadTime">Reorder Lead Time</Label>
                <Input
                  id="reorderLeadTime"
                  placeholder="E.g., 14 days"
                  value={formData.reorderLeadTime}
                  onChange={(e) => handleChange("reorderLeadTime", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
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
            <Link href="/inventory">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button type="submit">Add Item</Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
