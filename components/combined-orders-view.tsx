"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Building2, Printer, Mail, Edit2, Save, Plus, Minus, Star, StarOff, Pencil, Trash2, Search } from "lucide-react"
import { format } from "date-fns"
import { useAutoReorderStore } from "./auto-reorder-store"
import { useToast } from "@/components/ui/use-toast"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Initial list of vendors
const initialVendors = [
  {
    id: "interstate",
    name: "Interstate Batteries",
    isDefault: false,
    email: "orders@interstate.com",
    phone: "800-555-1234",
  },
  { id: "exide", name: "Exide Technologies", isDefault: false, email: "orders@exide.com", phone: "800-555-2345" },
  { id: "optima", name: "Optima Batteries", isDefault: false, email: "orders@optima.com", phone: "800-555-3456" },
  {
    id: "duracell",
    name: "Duracell Automotive",
    isDefault: false,
    email: "orders@duracell.com",
    phone: "800-555-4567",
  },
  { id: "acdelco", name: "ACDelco", isDefault: false, email: "orders@acdelco.com", phone: "800-555-5678" },
  { id: "diehard", name: "DieHard", isDefault: false, email: "orders@diehard.com", phone: "800-555-6789" },
  { id: "odyssey", name: "Odyssey Battery", isDefault: false, email: "orders@odyssey.com", phone: "800-555-7890" },
  { id: "napa", name: "NAPA Batteries", isDefault: false, email: "orders@napa.com", phone: "800-555-8901" },
]

interface Vendor {
  id: string
  name: string
  isDefault: boolean
  email?: string
  phone?: string
  notes?: string
}

interface CombinedOrdersViewProps {
  reorders: any[]
  onProcess: (id: string) => void
  onCancel: (id: string) => void
  singleLocation?: string
  updateReorderItems?: (reorderId: string, items: any[]) => void
  updateReorderNotes?: (reorderId: string, notes: string) => void
}

export function CombinedOrdersView({
  reorders,
  onProcess,
  onCancel,
  singleLocation,
  updateReorderItems,
  updateReorderNotes,
}: CombinedOrdersViewProps) {
  const { toast } = useToast()
  const { updateItemQuantity } = useAutoReorderStore()
  const [editingOrder, setEditingOrder] = useState<any>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editedItems, setEditedItems] = useState<any[]>([])
  const [orderNotes, setOrderNotes] = useState("")
  const [selectedVendor, setSelectedVendor] = useState<string>("")
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<any>(null)

  // Vendor management state
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false)
  const [vendorSearchOpen, setVendorSearchOpen] = useState(false)
  const [vendorSearchQuery, setVendorSearchQuery] = useState("")
  const [editVendorDialogOpen, setEditVendorDialogOpen] = useState(false)
  const [currentVendor, setCurrentVendor] = useState<Vendor | null>(null)
  const [newVendor, setNewVendor] = useState<Vendor>({
    id: "",
    name: "",
    isDefault: false,
    email: "",
    phone: "",
    notes: "",
  })

  // Load vendors from localStorage on component mount
  useEffect(() => {
    const savedVendors = localStorage.getItem("battery-vendors")
    if (savedVendors) {
      setVendors(JSON.parse(savedVendors))
    } else {
      setVendors(initialVendors)
      localStorage.setItem("battery-vendors", JSON.stringify(initialVendors))
    }

    // Set default vendor if one exists
    const defaultVendor = vendors.find((v) => v.isDefault)
    if (defaultVendor) {
      setSelectedVendor(defaultVendor.id)
    }
  }, [])

  // Save vendors to localStorage whenever they change
  useEffect(() => {
    if (vendors.length > 0) {
      localStorage.setItem("battery-vendors", JSON.stringify(vendors))
    }
  }, [vendors])

  // Group pending reorders by location
  const pendingReorders = reorders?.filter((r) => r.status === "pending") || []

  // If singleLocation is provided, only show that location
  const locationGroups = pendingReorders.reduce((groups: any, reorder: any) => {
    if (singleLocation && reorder.location !== singleLocation) {
      return groups
    }

    const location = reorder.location
    if (!groups[location]) {
      groups[location] = []
    }
    groups[location].push(reorder)
    return groups
  }, {})

  // Combine items from all reorders for a location
  const combineOrdersByLocation = (locationReorders: any[]) => {
    const combinedItems: any[] = []

    locationReorders.forEach((reorder) => {
      reorder.items.forEach((item: any) => {
        const existingItem = combinedItems.find((i) => i.type === item.type && i.model === item.model)

        if (existingItem) {
          existingItem.quantity += item.quantity
          existingItem.reorderIds.push({ reorderId: reorder.id, itemId: item.id })
        } else {
          combinedItems.push({
            ...item,
            reorderIds: [{ reorderId: reorder.id, itemId: item.id }],
          })
        }
      })
    })

    return {
      location: locationReorders[0].location,
      date: new Date().toISOString(),
      items: combinedItems,
      reorders: locationReorders,
    }
  }

  const handleEditOrder = (combinedOrder: any) => {
    setEditingOrder(combinedOrder)
    setEditedItems(JSON.parse(JSON.stringify(combinedOrder.items)))
    setOrderNotes("")
    setEditDialogOpen(true)
  }

  const handleUpdateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) newQuantity = 1

    const updatedItems = [...editedItems]
    updatedItems[index] = { ...updatedItems[index], quantity: newQuantity }
    setEditedItems(updatedItems)
  }

  const handleSaveChanges = () => {
    // Update items in the reorder
    editedItems.forEach((item, index) => {
      const originalItem = editingOrder.items[index]

      // Check if type or quantity has changed
      if (item.quantity !== originalItem.quantity || item.type !== originalItem.type) {
        // For combined orders, we need to update the original reorder items
        // We'll update the first reorder that contains this item
        if (item.reorderIds && item.reorderIds.length > 0) {
          const { reorderId, itemId } = item.reorderIds[0]

          // Get the original reorder
          const reorder = reorders.find((r) => r.id === reorderId)
          if (reorder) {
            // Find the item in the reorder
            const reorderItem = reorder.items.find((i) => i.id === itemId)
            if (reorderItem) {
              // Update both quantity and type
              updateItemQuantity(reorderId, itemId, item.quantity)

              // Since we don't have a dedicated function to update the type,
              // we'll update the entire item
              const updatedItems = reorder.items.map((i) =>
                i.id === itemId ? { ...i, quantity: item.quantity, type: item.type } : i,
              )

              // Update all items in the reorder
              if (updateReorderItems) {
                updateReorderItems(reorderId, updatedItems)
              }
            }
          }
        }
      }
    })

    // Update notes if changed
    if (orderNotes !== editingOrder.notes) {
      updateReorderNotes(editingOrder.id, orderNotes)
    }

    toast({
      title: "Order Updated",
      description: "The order has been updated successfully",
    })

    setEditDialogOpen(false)
  }

  const handlePrintOrder = (order: any) => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast({
        title: "Print Failed",
        description: "Unable to open print window. Please check your popup settings.",
        variant: "destructive",
      })
      return
    }

    const orderDate = format(new Date(order.date), "MMM d, yyyy")
    const vendor = vendors.find((v) => v.id === selectedVendor)
    const vendorInfo = vendor
      ? `
        <div class="vendor-info">
          <h2>Vendor Information</h2>
          <p><strong>Name:</strong> ${vendor.name}</p>
          ${vendor.email ? `<p><strong>Email:</strong> ${vendor.email}</p>` : ""}
          ${vendor.phone ? `<p><strong>Phone:</strong> ${vendor.phone}</p>` : ""}
        </div>
      `
      : ""

    printWindow.document.write(`
      <html>
        <head>
          <title>Combined Order for ${order.location} - ${orderDate}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1, h2 { color: #333; }
            .vendor-info { margin: 20px 0; padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f2f2f2; }
            .footer { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; }
          </style>
        </head>
        <body>
          <h1>Combined Order for ${order.location}</h1>
          <p>Date: ${orderDate}</p>
          ${vendorInfo}
          <table>
            <thead>
              <tr>
                <th>Battery Type</th>
                <th>Model</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${order.items
                .map(
                  (item: any) => `
                <tr>
                  <td>${item.type}</td>
                  <td>${item.model || "N/A"}</td>
                  <td>${item.quantity}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
          <div class="footer">
            <p>Notes: ${orderNotes || "None"}</p>
            <p>This is a combined order from ${order.reorders.length} pending reorders.</p>
          </div>
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.print()
  }

  const handleEmailOrder = (order: any) => {
    if (!selectedVendor) {
      setCurrentOrder(order)
      setEmailDialogOpen(true)
      return
    }

    // In a real application, this would send the order to a backend API
    // For now, we'll just show a toast notification
    const vendor = vendors.find((v) => v.id === selectedVendor)
    if (vendor) {
      toast({
        title: "Email Sent",
        description: `Combined order for ${order.location} has been emailed to ${vendor.name} (${vendor.email || "No email provided"}).`,
      })
    } else {
      toast({
        title: "Email Sent",
        description: `Combined order for ${order.location} has been emailed to the vendor.`,
      })
    }
  }

  const handleSendEmail = () => {
    if (!selectedVendor || !currentOrder) {
      toast({
        title: "Vendor Required",
        description: "Please select a vendor to send the order to.",
        variant: "destructive",
      })
      return
    }

    const vendor = vendors.find((v) => v.id === selectedVendor)
    if (vendor) {
      toast({
        title: "Email Sent",
        description: `Combined order for ${currentOrder.location} has been emailed to ${vendor.name} (${vendor.email || "No email provided"}).`,
      })
    } else {
      toast({
        title: "Email Sent",
        description: `Combined order for ${currentOrder.location} has been emailed to the vendor.`,
      })
    }
    setEmailDialogOpen(false)
  }

  // Vendor management functions
  const handleAddVendor = () => {
    // Generate a unique ID based on the name
    const id = newVendor.name.toLowerCase().replace(/\s+/g, "-")

    // Check if vendor with this ID already exists
    if (vendors.some((v) => v.id === id)) {
      toast({
        title: "Vendor Already Exists",
        description: "A vendor with this name already exists.",
        variant: "destructive",
      })
      return
    }

    const vendorToAdd = {
      ...newVendor,
      id,
    }

    // If this is set as default, remove default from other vendors
    let updatedVendors = [...vendors]
    if (vendorToAdd.isDefault) {
      updatedVendors = updatedVendors.map((v) => ({
        ...v,
        isDefault: false,
      }))
    }

    // Add the new vendor
    updatedVendors.push(vendorToAdd)
    setVendors(updatedVendors)

    // If this is the default vendor, select it
    if (vendorToAdd.isDefault) {
      setSelectedVendor(vendorToAdd.id)
    }

    // Reset the form and close the dialog
    setNewVendor({
      id: "",
      name: "",
      isDefault: false,
      email: "",
      phone: "",
      notes: "",
    })

    toast({
      title: "Vendor Added",
      description: `${vendorToAdd.name} has been added to your vendors.`,
    })

    setVendorDialogOpen(false)
  }

  const handleEditVendor = (vendor: Vendor) => {
    setCurrentVendor(vendor)
    setEditVendorDialogOpen(true)
  }

  const handleUpdateVendor = () => {
    if (!currentVendor) return

    // If this vendor is being set as default, remove default from other vendors
    let updatedVendors = [...vendors]
    if (currentVendor.isDefault) {
      updatedVendors = updatedVendors.map((v) => ({
        ...v,
        isDefault: v.id === currentVendor.id ? true : false,
      }))
    }

    // Update the vendor
    updatedVendors = updatedVendors.map((v) => (v.id === currentVendor.id ? currentVendor : v))

    setVendors(updatedVendors)

    // If this is the default vendor, select it
    if (currentVendor.isDefault) {
      setSelectedVendor(currentVendor.id)
    }

    toast({
      title: "Vendor Updated",
      description: `${currentVendor.name} has been updated.`,
    })

    setEditVendorDialogOpen(false)
  }

  const handleDeleteVendor = (vendorId: string) => {
    const vendor = vendors.find((v) => v.id === vendorId)
    if (!vendor) return

    // Remove the vendor
    const updatedVendors = vendors.filter((v) => v.id !== vendorId)
    setVendors(updatedVendors)

    // If this was the selected vendor, clear the selection
    if (selectedVendor === vendorId) {
      setSelectedVendor("")
    }

    toast({
      title: "Vendor Removed",
      description: `${vendor.name} has been removed from your vendors.`,
    })

    // Close the dialog if open
    setEditVendorDialogOpen(false)
  }

  const handleToggleDefault = (vendorId: string) => {
    // Find the vendor
    const vendor = vendors.find((v) => v.id === vendorId)
    if (!vendor) return

    // Update all vendors, setting only this one as default
    const updatedVendors = vendors.map((v) => ({
      ...v,
      isDefault: v.id === vendorId,
    }))

    setVendors(updatedVendors)

    // Select this vendor
    setSelectedVendor(vendorId)

    toast({
      title: "Default Vendor Set",
      description: `${vendor.name} is now your default vendor.`,
    })
  }

  const filteredVendors = vendorSearchQuery
    ? vendors.filter(
        (vendor) =>
          vendor.name.toLowerCase().includes(vendorSearchQuery.toLowerCase()) ||
          (vendor.email && vendor.email.toLowerCase().includes(vendorSearchQuery.toLowerCase())) ||
          (vendor.notes && vendor.notes.toLowerCase().includes(vendorSearchQuery.toLowerCase())),
      )
    : vendors

  if (Object.keys(locationGroups).length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
        <h3 className="mt-4 text-lg font-medium">No pending orders to combine</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Pending reorders will appear here and can be combined by location.
        </p>
      </div>
    )
  }

  // If we're in single location mode, just show the combined order for that location
  if (singleLocation && locationGroups[singleLocation]) {
    const combinedOrder = combineOrdersByLocation(locationGroups[singleLocation])

    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Building2 className="mr-2 h-5 w-5" />
                Combined Order for {singleLocation}
              </div>
              <Badge variant="outline">
                {locationGroups[singleLocation].length} Pending Order
                {locationGroups[singleLocation].length !== 1 ? "s" : ""}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4 mb-4">
                <Label htmlFor="vendor-select" className="whitespace-nowrap">
                  Vendor:
                </Label>
                <div className="flex-1">
                  <Popover open={vendorSearchOpen} onOpenChange={setVendorSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={vendorSearchOpen}
                        className="w-full justify-between"
                      >
                        {selectedVendor
                          ? vendors.find((vendor) => vendor.id === selectedVendor)?.name
                          : "Select a vendor..."}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search vendors..."
                          value={vendorSearchQuery}
                          onValueChange={setVendorSearchQuery}
                        />
                        <CommandList>
                          <CommandEmpty>No vendors found.</CommandEmpty>
                          <CommandGroup heading="Vendors">
                            {filteredVendors.map((vendor) => (
                              <CommandItem
                                key={vendor.id}
                                value={vendor.id}
                                onSelect={(currentValue) => {
                                  setSelectedVendor(currentValue)
                                  setVendorSearchOpen(false)
                                }}
                                className="flex items-center justify-between"
                              >
                                <div className="flex items-center">
                                  {vendor.name}
                                  {vendor.isDefault && (
                                    <Badge variant="outline" className="ml-2">
                                      Default
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleEditVendor(vendor)
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleToggleDefault(vendor.id)
                                    }}
                                  >
                                    {vendor.isDefault ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                          <CommandSeparator />
                          <CommandGroup>
                            <CommandItem
                              onSelect={() => {
                                setVendorDialogOpen(true)
                                setVendorSearchOpen(false)
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add New Vendor
                            </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="rounded-md border">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-muted/50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                      >
                        Battery Type
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                      >
                        Model
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                      >
                        Quantity
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {combinedOrder.items.map((item: any, index: number) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{item.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.model || "N/A"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => handleEditOrder(combinedOrder)}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit Quantities
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handlePrintOrder(combinedOrder)}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button variant="default" onClick={() => handleEmailOrder(combinedOrder)}>
                <Mail className="mr-2 h-4 w-4" />
                Email to Vendor
              </Button>
            </div>
          </CardFooter>
        </Card>

        {/* Email Dialog */}
        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Select Vendor</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-vendor-select">Select a vendor to send this order to:</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={false}
                        className="w-full justify-between"
                      >
                        {selectedVendor
                          ? vendors.find((vendor) => vendor.id === selectedVendor)?.name
                          : "Select a vendor..."}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Search vendors..." />
                        <CommandList>
                          <CommandEmpty>No vendors found.</CommandEmpty>
                          <CommandGroup heading="Vendors">
                            {vendors.map((vendor) => (
                              <CommandItem
                                key={vendor.id}
                                value={vendor.id}
                                onSelect={(currentValue) => {
                                  setSelectedVendor(currentValue)
                                }}
                              >
                                {vendor.name}
                                {vendor.isDefault && (
                                  <Badge variant="outline" className="ml-2">
                                    Default
                                  </Badge>
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                          <CommandSeparator />
                          <CommandGroup>
                            <CommandItem
                              onSelect={() => {
                                setVendorDialogOpen(true)
                                setEmailDialogOpen(false)
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add New Vendor
                            </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-notes">Order Notes (Optional)</Label>
                  <Textarea
                    id="email-notes"
                    placeholder="Add any notes for this order..."
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendEmail}>
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Order Details</DialogTitle>
              <DialogDescription>You can edit both the battery type and quantity for each item.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="rounded-md border">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-muted/50">
                    <tr>
                      <th
                        scope="col"
                        className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                      >
                        Battery Type
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                      >
                        Quantity
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {editedItems.map((item: any, index: number) => (
                      <tr key={index}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                          <Select
                            value={item.type}
                            onValueChange={(value) => {
                              const updatedItems = [...editedItems]
                              updatedItems[index] = { ...updatedItems[index], type: value }
                              setEditedItems(updatedItems)
                            }}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Select battery type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Alpha">Alpha</SelectItem>
                              <SelectItem value="Bravo">Bravo</SelectItem>
                              <SelectItem value="Charlie">Charlie</SelectItem>
                              <SelectItem value="AMG">AMG</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="mt-1 text-xs text-muted-foreground">Model: {item.model || "N/A"}</div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleUpdateQuantity(index, item.quantity - 1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleUpdateQuantity(index, Number.parseInt(e.target.value) || 1)}
                              className="w-16 text-center"
                              min="1"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleUpdateQuantity(index, item.quantity + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Order Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes for this order..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveChanges}>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Vendor Dialog */}
        <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Vendor</DialogTitle>
              <DialogDescription>Add a new vendor to your list of battery suppliers.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="vendor-name">Vendor Name *</Label>
                <Input
                  id="vendor-name"
                  placeholder="Enter vendor name"
                  value={newVendor.name}
                  onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-email">Email Address</Label>
                <Input
                  id="vendor-email"
                  type="email"
                  placeholder="vendor@example.com"
                  value={newVendor.email || ""}
                  onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-phone">Phone Number</Label>
                <Input
                  id="vendor-phone"
                  placeholder="(555) 123-4567"
                  value={newVendor.phone || ""}
                  onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-notes">Notes</Label>
                <Textarea
                  id="vendor-notes"
                  placeholder="Add any notes about this vendor..."
                  value={newVendor.notes || ""}
                  onChange={(e) => setNewVendor({ ...newVendor, notes: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="vendor-default"
                  checked={newVendor.isDefault}
                  onCheckedChange={(checked) => setNewVendor({ ...newVendor, isDefault: checked })}
                />
                <Label htmlFor="vendor-default">Set as default vendor</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVendorDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddVendor} disabled={!newVendor.name}>
                <Plus className="mr-2 h-4 w-4" />
                Add Vendor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Vendor Dialog */}
        <Dialog open={editVendorDialogOpen} onOpenChange={setEditVendorDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Vendor</DialogTitle>
              <DialogDescription>Update vendor information.</DialogDescription>
            </DialogHeader>
            {currentVendor && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-vendor-name">Vendor Name *</Label>
                  <Input
                    id="edit-vendor-name"
                    placeholder="Enter vendor name"
                    value={currentVendor.name}
                    onChange={(e) => setCurrentVendor({ ...currentVendor, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-vendor-email">Email Address</Label>
                  <Input
                    id="edit-vendor-email"
                    type="email"
                    placeholder="vendor@example.com"
                    value={currentVendor.email || ""}
                    onChange={(e) => setCurrentVendor({ ...currentVendor, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-vendor-phone">Phone Number</Label>
                  <Input
                    id="edit-vendor-phone"
                    placeholder="(555) 123-4567"
                    value={currentVendor.phone || ""}
                    onChange={(e) => setCurrentVendor({ ...currentVendor, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-vendor-notes">Notes</Label>
                  <Textarea
                    id="edit-vendor-notes"
                    placeholder="Add any notes about this vendor..."
                    value={currentVendor.notes || ""}
                    onChange={(e) => setCurrentVendor({ ...currentVendor, notes: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-vendor-default"
                    checked={currentVendor.isDefault}
                    onCheckedChange={(checked) => setCurrentVendor({ ...currentVendor, isDefault: checked })}
                  />
                  <Label htmlFor="edit-vendor-default">Set as default vendor</Label>
                </div>
              </div>
            )}
            <DialogFooter className="flex justify-between">
              <Button variant="destructive" onClick={() => currentVendor && handleDeleteVendor(currentVendor.id)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditVendorDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateVendor} disabled={!currentVendor?.name}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <div>
      <Tabs defaultValue={Object.keys(locationGroups)[0]} className="w-full">
        <TabsList className="mb-4">
          {Object.keys(locationGroups).map((location) => (
            <TabsTrigger key={location} value={location}>
              {location}{" "}
              <Badge variant="outline" className="ml-2">
                {locationGroups[location].length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(locationGroups).map(([location, locationReorders]: [string, any]) => {
          const combinedOrder = combineOrdersByLocation(locationReorders)

          return (
            <TabsContent key={location} value={location} className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Building2 className="mr-2 h-5 w-5" />
                      Combined Order for {location}
                    </div>
                    <Badge variant="outline">
                      {locationReorders.length} Pending Order{locationReorders.length !== 1 ? "s" : ""}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4 mb-4">
                      <Label htmlFor={`vendor-select-${location}`} className="whitespace-nowrap">
                        Vendor:
                      </Label>
                      <div className="flex-1">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={false}
                              className="w-full justify-between"
                            >
                              {selectedVendor
                                ? vendors.find((vendor) => vendor.id === selectedVendor)?.name
                                : "Select a vendor..."}
                              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0">
                            <Command>
                              <CommandInput placeholder="Search vendors..." />
                              <CommandList>
                                <CommandEmpty>No vendors found.</CommandEmpty>
                                <CommandGroup heading="Vendors">
                                  {vendors.map((vendor) => (
                                    <CommandItem
                                      key={vendor.id}
                                      value={vendor.id}
                                      onSelect={(currentValue) => {
                                        setSelectedVendor(currentValue)
                                      }}
                                      className="flex items-center justify-between"
                                    >
                                      <div className="flex items-center">
                                        {vendor.name}
                                        {vendor.isDefault && (
                                          <Badge variant="outline" className="ml-2">
                                            Default
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleEditVendor(vendor)
                                          }}
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleToggleDefault(vendor.id)
                                          }}
                                        >
                                          {vendor.isDefault ? (
                                            <StarOff className="h-4 w-4" />
                                          ) : (
                                            <Star className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                                <CommandSeparator />
                                <CommandGroup>
                                  <CommandItem
                                    onSelect={() => {
                                      setVendorDialogOpen(true)
                                    }}
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add New Vendor
                                  </CommandItem>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div className="rounded-md border">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-muted/50">
                          <tr>
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                            >
                              Battery Type
                            </th>
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                            >
                              Model
                            </th>
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                            >
                              Quantity
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {combinedOrder.items.map((item: any, index: number) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{item.type}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {item.model || "N/A"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={() => handleEditOrder(combinedOrder)}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit Quantities
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => handlePrintOrder(combinedOrder)}>
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </Button>
                    <Button variant="default" onClick={() => handleEmailOrder(combinedOrder)}>
                      <Mail className="mr-2 h-4 w-4" />
                      Email to Vendor
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>
          )
        })}
      </Tabs>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Vendor</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-vendor-select">Select a vendor to send this order to:</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={false} className="w-full justify-between">
                      {selectedVendor
                        ? vendors.find((vendor) => vendor.id === selectedVendor)?.name
                        : "Select a vendor..."}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Search vendors..." />
                      <CommandList>
                        <CommandEmpty>No vendors found.</CommandEmpty>
                        <CommandGroup heading="Vendors">
                          {vendors.map((vendor) => (
                            <CommandItem
                              key={vendor.id}
                              value={vendor.id}
                              onSelect={(currentValue) => {
                                setSelectedVendor(currentValue)
                              }}
                            >
                              {vendor.name}
                              {vendor.isDefault && (
                                <Badge variant="outline" className="ml-2">
                                  Default
                                </Badge>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => {
                              setVendorDialogOpen(true)
                              setEmailDialogOpen(false)
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add New Vendor
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-notes">Order Notes (Optional)</Label>
                <Textarea
                  id="email-notes"
                  placeholder="Add any notes for this order..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail}>
              <Mail className="mr-2 h-4 w-4" />
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Vendor Dialog */}
      <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Vendor</DialogTitle>
            <DialogDescription>Add a new vendor to your list of battery suppliers.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-name">Vendor Name *</Label>
              <Input
                id="vendor-name"
                placeholder="Enter vendor name"
                value={newVendor.name}
                onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-email">Email Address</Label>
              <Input
                id="vendor-email"
                type="email"
                placeholder="vendor@example.com"
                value={newVendor.email || ""}
                onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-phone">Phone Number</Label>
              <Input
                id="vendor-phone"
                placeholder="(555) 123-4567"
                value={newVendor.phone || ""}
                onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-notes">Notes</Label>
              <Textarea
                id="vendor-notes"
                placeholder="Add any notes about this vendor..."
                value={newVendor.notes || ""}
                onChange={(e) => setNewVendor({ ...newVendor, notes: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Switch
                id="vendor-default"
                checked={newVendor.isDefault}
                onCheckedChange={(checked) => setNewVendor({ ...newVendor, isDefault: checked })}
              />
              <Label htmlFor="vendor-default">Set as default vendor</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVendorDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddVendor} disabled={!newVendor.name}>
              <Plus className="mr-2 h-4 w-4" />
              Add Vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Vendor Dialog */}
      <Dialog open={editVendorDialogOpen} onOpenChange={setEditVendorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Vendor</DialogTitle>
            <DialogDescription>Update vendor information.</DialogDescription>
          </DialogHeader>
          {currentVendor && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-vendor-name">Vendor Name *</Label>
                <Input
                  id="edit-vendor-name"
                  placeholder="Enter vendor name"
                  value={currentVendor.name}
                  onChange={(e) => setCurrentVendor({ ...currentVendor, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-vendor-email">Email Address</Label>
                <Input
                  id="edit-vendor-email"
                  type="email"
                  placeholder="vendor@example.com"
                  value={currentVendor.email || ""}
                  onChange={(e) => setCurrentVendor({ ...currentVendor, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-vendor-phone">Phone Number</Label>
                <Input
                  id="edit-vendor-phone"
                  placeholder="(555) 123-4567"
                  value={currentVendor.phone || ""}
                  onChange={(e) => setCurrentVendor({ ...currentVendor, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-vendor-notes">Notes</Label>
                <Textarea
                  id="edit-vendor-notes"
                  placeholder="Add any notes about this vendor..."
                  value={currentVendor.notes || ""}
                  onChange={(e) => setCurrentVendor({ ...currentVendor, notes: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-vendor-default"
                  checked={currentVendor.isDefault}
                  onCheckedChange={(checked) => setCurrentVendor({ ...currentVendor, isDefault: checked })}
                />
                <Label htmlFor="edit-vendor-default">Set as default vendor</Label>
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            <Button variant="destructive" onClick={() => currentVendor && handleDeleteVendor(currentVendor.id)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditVendorDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateVendor} disabled={!currentVendor?.name}>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Order Details</DialogTitle>
            <DialogDescription>You can edit both the battery type and quantity for each item.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-md border">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-muted/50">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      Battery Type
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      Quantity
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {editedItems.map((item: any, index: number) => (
                    <tr key={index}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                        <Select
                          value={item.type}
                          onValueChange={(value) => {
                            const updatedItems = [...editedItems]
                            updatedItems[index] = { ...updatedItems[index], type: value }
                            setEditedItems(updatedItems)
                          }}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select battery type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Alpha">Alpha</SelectItem>
                            <SelectItem value="Bravo">Bravo</SelectItem>
                            <SelectItem value="Charlie">Charlie</SelectItem>
                            <SelectItem value="AMG">AMG</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="mt-1 text-xs text-muted-foreground">Model: {item.model || "N/A"}</div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleUpdateQuantity(index, item.quantity - 1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleUpdateQuantity(index, Number.parseInt(e.target.value) || 1)}
                            className="w-16 text-center"
                            min="1"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleUpdateQuantity(index, item.quantity + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Order Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes for this order..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveChanges}>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
