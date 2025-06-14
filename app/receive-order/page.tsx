"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InvoiceScanner } from "@/components/invoice-scanner"
import { useInventoryStore } from "@/lib/inventory-store"
import { toast } from "@/components/ui/use-toast"
import { InventoryVerification } from "@/components/inventory-verification"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle } from "lucide-react"

export default function ReceiveOrderPage() {
  const { receiveInventory } = useInventoryStore()
  const [activeTab, setActiveTab] = useState("scan")
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  const handleProcessInvoice = (invoiceData: any) => {
    try {
      // Extract items from the invoice data
      const items = invoiceData.items.map((item: any) => ({
        type: item.category,
        model: item.model,
        quantity: item.quantity,
        location: invoiceData.location.toLowerCase(),
        status: invoiceData.status || "pending",
        notes: invoiceData.holdReason || "",
      }))

      // Process the inventory
      receiveInventory(items, invoiceData.invoiceNumber)

      // Show success message
      setSuccessMessage(`Successfully processed invoice #${invoiceData.invoiceNumber}`)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)

      // Switch to verify tab
      setActiveTab("verify")

      // Show toast
      toast({
        title: "Invoice Processed",
        description: `Invoice #${invoiceData.invoiceNumber} has been processed. ${items.length} items added to pending inventory.`,
      })
    } catch (error) {
      console.error("Error processing invoice:", error)
      toast({
        title: "Error",
        description: "There was an error processing the invoice. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Receive Order</h1>
        <p className="text-muted-foreground">
          Scan invoices, manually enter order details, or verify pending inventory
        </p>
      </div>

      {showSuccess && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Success</AlertTitle>
          <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scan">Scan Invoice</TabsTrigger>
          <TabsTrigger value="verify">Verify Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scan or Upload Invoice</CardTitle>
              <CardDescription>
                Scan an invoice using your camera, upload a file, or manually enter invoice details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InvoiceScanner onProcess={handleProcessInvoice} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verify" className="space-y-4">
          <InventoryVerification />
        </TabsContent>
      </Tabs>
    </div>
  )
}
