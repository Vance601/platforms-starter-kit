"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, MapPin, Edit, Trash2 } from "lucide-react"

// Mock data for locations
const initialLocations = [
  {
    id: "1",
    name: "Broadway",
    address: "123 Broadway Ave, Phoenix, AZ 85001",
    phone: "(602) 555-1234",
    isWarehouse: true,
  },
  {
    id: "2",
    name: "Camelback",
    address: "456 Camelback Rd, Phoenix, AZ 85016",
    phone: "(602) 555-5678",
    isWarehouse: true,
  },
]

export function LocationSettings() {
  const [locations, setLocations] = useState(initialLocations)
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false)
  const [isEditLocationOpen, setIsEditLocationOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<any>(null)

  // Form state for new location
  const [newLocation, setNewLocation] = useState({
    name: "",
    address: "",
    phone: "",
    isWarehouse: true,
  })

  // Reset form
  const resetForm = () => {
    setNewLocation({
      name: "",
      address: "",
      phone: "",
      isWarehouse: true,
    })
  }

  // Handle adding a new location
  const handleAddLocation = () => {
    const locationToAdd = {
      ...newLocation,
      id: crypto.randomUUID(),
    }
    setLocations([...locations, locationToAdd])
    setIsAddLocationOpen(false)
    resetForm()
  }

  // Handle editing a location
  const handleEditLocation = () => {
    if (selectedLocation) {
      setLocations(locations.map((loc) => (loc.id === selectedLocation.id ? selectedLocation : loc)))
      setIsEditLocationOpen(false)
      setSelectedLocation(null)
    }
  }

  // Handle deleting a location
  const handleDeleteLocation = (id: string) => {
    if (confirm("Are you sure you want to delete this location?")) {
      setLocations(locations.filter((loc) => loc.id !== id))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Locations</h3>

        <Dialog open={isAddLocationOpen} onOpenChange={setIsAddLocationOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Location</DialogTitle>
              <DialogDescription>Add a new warehouse or service location.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={newLocation.name}
                  onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="address" className="text-right">
                  Address
                </Label>
                <Input
                  id="address"
                  value={newLocation.address}
                  onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">
                  Phone
                </Label>
                <Input
                  id="phone"
                  value={newLocation.phone}
                  onChange={(e) => setNewLocation({ ...newLocation, phone: e.target.value })}
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isWarehouse" className="text-right">
                  Type
                </Label>
                <div className="col-span-3 flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isWarehouse"
                    checked={newLocation.isWarehouse}
                    onChange={(e) => setNewLocation({ ...newLocation, isWarehouse: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isWarehouse" className="text-sm font-normal">
                    This is a warehouse location
                  </Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddLocationOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddLocation}>Add Location</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {locations.map((location) => (
          <Card key={location.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-muted-foreground" />
                {location.name}
              </CardTitle>
              <CardDescription>{location.isWarehouse ? "Warehouse" : "Service Location"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Address:</p>
                <p>{location.address}</p>
              </div>
              <div className="space-y-1 text-sm mt-2">
                <p className="text-muted-foreground">Phone:</p>
                <p>{location.phone}</p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedLocation(location)
                  setIsEditLocationOpen(true)
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={() => handleDeleteLocation(location.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Edit Location Dialog */}
      <Dialog open={isEditLocationOpen} onOpenChange={setIsEditLocationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
            <DialogDescription>Update location information.</DialogDescription>
          </DialogHeader>

          {selectedLocation && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="edit-name"
                  value={selectedLocation.name}
                  onChange={(e) => setSelectedLocation({ ...selectedLocation, name: e.target.value })}
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-address" className="text-right">
                  Address
                </Label>
                <Input
                  id="edit-address"
                  value={selectedLocation.address}
                  onChange={(e) => setSelectedLocation({ ...selectedLocation, address: e.target.value })}
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-phone" className="text-right">
                  Phone
                </Label>
                <Input
                  id="edit-phone"
                  value={selectedLocation.phone}
                  onChange={(e) => setSelectedLocation({ ...selectedLocation, phone: e.target.value })}
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-isWarehouse" className="text-right">
                  Type
                </Label>
                <div className="col-span-3 flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="edit-isWarehouse"
                    checked={selectedLocation.isWarehouse}
                    onChange={(e) => setSelectedLocation({ ...selectedLocation, isWarehouse: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="edit-isWarehouse" className="text-sm font-normal">
                    This is a warehouse location
                  </Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditLocationOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditLocation}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
