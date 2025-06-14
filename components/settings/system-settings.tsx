"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { Save, RefreshCw } from "lucide-react"

export function SystemSettings() {
  const [settings, setSettings] = useState({
    companyName: "Duggers Battery",
    lowStockThreshold: 5,
    defaultLocation: "Broadway",
    enableNotifications: true,
    enableAutoBackup: true,
    backupFrequency: "daily",
    theme: "light",
  })

  const handleSaveSettings = () => {
    // In a real app, this would save to a database or API
    toast({
      title: "Settings saved",
      description: "Your system settings have been updated successfully.",
    })
  }

  const handleResetSettings = () => {
    if (confirm("Are you sure you want to reset all settings to default values?")) {
      setSettings({
        companyName: "Duggers Battery",
        lowStockThreshold: 5,
        defaultLocation: "Broadway",
        enableNotifications: true,
        enableAutoBackup: true,
        backupFrequency: "daily",
        theme: "light",
      })

      toast({
        title: "Settings reset",
        description: "All settings have been reset to their default values.",
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">General Settings</h3>
        <p className="text-sm text-muted-foreground">Configure general system settings and preferences.</p>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={settings.companyName}
              onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
            <Input
              id="lowStockThreshold"
              type="number"
              min="1"
              value={settings.lowStockThreshold.toString()}
              onChange={(e) => {
                const value = e.target.value === "" ? 0 : Number.parseInt(e.target.value, 10)
                setSettings({ ...settings, lowStockThreshold: isNaN(value) ? 0 : value })
              }}
            />
            <p className="text-xs text-muted-foreground">
              Items with stock below this number will be marked as low stock.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultLocation">Default Location</Label>
          <Select
            value={settings.defaultLocation}
            onValueChange={(value) => setSettings({ ...settings, defaultLocation: value })}
          >
            <SelectTrigger id="defaultLocation">
              <SelectValue placeholder="Select default location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Broadway">Broadway</SelectItem>
              <SelectItem value="Camelback">Camelback</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            This location will be selected by default when adding new inventory.
          </p>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-medium">Notifications</h3>
        <p className="text-sm text-muted-foreground">Configure notification settings.</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enableNotifications">Enable Notifications</Label>
            <p className="text-xs text-muted-foreground">
              Receive notifications for low stock, new orders, and other important events.
            </p>
          </div>
          <Switch
            id="enableNotifications"
            checked={settings.enableNotifications}
            onCheckedChange={(checked) => setSettings({ ...settings, enableNotifications: checked })}
          />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-medium">Backup & Data</h3>
        <p className="text-sm text-muted-foreground">Configure backup and data settings.</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enableAutoBackup">Automatic Backups</Label>
            <p className="text-xs text-muted-foreground">Automatically backup your data on a regular schedule.</p>
          </div>
          <Switch
            id="enableAutoBackup"
            checked={settings.enableAutoBackup}
            onCheckedChange={(checked) => setSettings({ ...settings, enableAutoBackup: checked })}
          />
        </div>

        {settings.enableAutoBackup && (
          <div className="space-y-2">
            <Label htmlFor="backupFrequency">Backup Frequency</Label>
            <Select
              value={settings.backupFrequency}
              onValueChange={(value) => setSettings({ ...settings, backupFrequency: value })}
            >
              <SelectTrigger id="backupFrequency">
                <SelectValue placeholder="Select backup frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-medium">Appearance</h3>
        <p className="text-sm text-muted-foreground">Customize the appearance of the application.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="theme">Theme</Label>
          <Select value={settings.theme} onValueChange={(value) => setSettings({ ...settings, theme: value })}>
            <SelectTrigger id="theme">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={handleResetSettings}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reset to Defaults
        </Button>
        <Button onClick={handleSaveSettings}>
          <Save className="mr-2 h-4 w-4" />
          Save Settings
        </Button>
      </div>
    </div>
  )
}
