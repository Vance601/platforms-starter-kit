"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Camera, Scan, AlertCircle, Check, Upload, FileText, Info } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface InvoiceItem {
  model: string
  quantity: number
  price: number
  amount: number
  category: "Alpha" | "Bravo" | "Charlie" | "AMG"
}

interface InvoiceData {
  invoiceNumber: string
  date: string
  poNumber: string
  items: InvoiceItem[]
  location: string
}

export function InvoiceScanner({ onProcess }: { onProcess: (data: InvoiceData) => void }) {
  const [activeTab, setActiveTab] = useState("upload")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [poNumber, setPoNumber] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null)
  const [selectedLocation, setSelectedLocation] = useState("broadway")
  const [parsedInvoice, setParsedInvoice] = useState<InvoiceData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  const [invoiceType, setInvoiceType] = useState<string>("standard")

  // Function to categorize batteries based on price
  const categorizeBattery = (price: number): "Alpha" | "Bravo" | "Charlie" | "AMG" => {
    // These thresholds can be adjusted based on your specific pricing
    if (price < 70) return "Alpha"
    if (price < 80) return "Bravo"
    if (price < 175) return "Charlie"
    return "AMG"
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Alpha":
        return "bg-green-100 text-green-800"
      case "Bravo":
        return "bg-blue-100 text-blue-800"
      case "Charlie":
        return "bg-purple-100 text-purple-800"
      case "AMG":
        return "bg-red-100 text-red-800"
      default:
        return ""
    }
  }

  const parseInvoice = (text: string) => {
    // In a real app, this would use OCR and more sophisticated parsing
    // For this example, we'll improve the parsing of the MBS Solutions invoice format

    console.log("Raw invoice text:", text) // Debug log

    // Extract invoice number - improve regex to be more flexible
    const invoiceNumberMatch =
      text.match(/Invoice\s*#?\s*(\d+)/i) ||
      text.match(/Invoice\s*number\s*:?\s*(\d+)/i) ||
      text.match(/Invoice\s*:?\s*(\d+)/i)

    const extractedInvoiceNumber = invoiceNumberMatch
      ? invoiceNumberMatch[1]
      : invoiceNumber || `INV-${Math.floor(1000 + Math.random() * 9000)}`

    console.log("Extracted invoice number:", extractedInvoiceNumber)

    // Extract date
    const dateMatch =
      text.match(/Date\s*:?\s*([A-Za-z]+\s+\d+,?\s+\d{4})/i) || text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/)

    const extractedDate = dateMatch
      ? dateMatch[1]
      : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

    // Extract PO number - improve regex to be more flexible
    const poMatch =
      text.match(/P\.O\.?\s*number\s*:?\s*(\w+[-\w]*)/i) ||
      text.match(/PO\s*number\s*:?\s*(\w+[-\w]*)/i) ||
      text.match(/Purchase\s*Order\s*:?\s*(\w+[-\w]*)/i) ||
      text.match(/PO\s*:?\s*(\w+[-\w]*)/i)

    const extractedPO = poMatch ? poMatch[1].trim() : poNumber || "PO-" + Math.floor(1000 + Math.random() * 9000)

    console.log("Extracted PO number:", extractedPO)

    // Sample items from the provided invoice
    const sampleItems: InvoiceItem[] = [
      { model: "MX-H6/L3/48-Express", quantity: 5, price: 165.92, amount: 829.6, category: "AMG" },
      { model: "MX-H7/L4/94R-Express", quantity: 7, price: 174.92, amount: 1224.44, category: "AMG" },
      { model: "MX-H8/L5/49-Express", quantity: 1, price: 183.92, amount: 183.92, category: "AMG" },
      { model: "S24F-Express", quantity: 6, price: 76.92, amount: 461.52, category: "Charlie" },
      { model: "S35-Express", quantity: 7, price: 66.92, amount: 468.44, category: "Alpha" },
      { model: "S51R-Express", quantity: 2, price: 59.92, amount: 119.84, category: "Alpha" },
      { model: "S65-Express", quantity: 2, price: 79.92, amount: 159.84, category: "Charlie" },
      { model: "S75-Express", quantity: 1, price: 70.92, amount: 70.92, category: "Bravo" },
      { model: "S86-Express", quantity: 1, price: 70.92, amount: 70.92, category: "Bravo" },
      { model: "S-H5/L2/47-Express", quantity: 7, price: 73.92, amount: 517.44, category: "Bravo" },
    ]

    // Create the invoice data object with properly formatted location
    const invoiceData: InvoiceData = {
      invoiceNumber: invoiceType === "tarab" ? "TARAB-" + extractedInvoiceNumber : extractedInvoiceNumber,
      date: extractedDate,
      poNumber: extractedPO,
      items: sampleItems,
      location: selectedLocation === "broadway" ? "Broadway" : "Camelback",
    }

    return invoiceData
  }

  const processInvoice = (invoiceText: string) => {
    try {
      const parsedData = parseInvoice(invoiceText)

      // Validate that we have an invoice number
      if (!parsedData.invoiceNumber || parsedData.invoiceNumber.trim() === "") {
        throw new Error("Failed to extract invoice number")
      }

      setParsedInvoice(parsedData)
      setInvoiceData(parsedData)
      setScanResult({
        success: true,
        message: `Successfully parsed invoice #${parsedData.invoiceNumber} with ${parsedData.items.length} items`,
      })
    } catch (error) {
      console.error("Invoice parsing error:", error)
      setScanResult({
        success: false,
        message: "Failed to parse invoice. Please try again or enter details manually.",
      })
    }
  }

  const confirmInvoice = () => {
    if (parsedInvoice) {
      onProcess(parsedInvoice)
      setParsedInvoice(null)
      setInvoiceData(null)
      setScanResult({
        success: true,
        message: `Invoice #${parsedInvoice.invoiceNumber} has been processed and inventory has been updated.`,
      })
      setTimeout(() => setScanResult(null), 3000)
    }
  }

  const handleManualSubmit = () => {
    if (invoiceNumber.trim()) {
      const manualInvoiceText = `
        Invoice ${invoiceNumber}
        Date Jan 17, 2025
        P.O. number ${poNumber || "N/A"}
      `
      processInvoice(manualInvoiceText)
    }
  }

  const simulateScan = () => {
    setIsScanning(true)
    // Simulate a scanning process
    setTimeout(() => {
      const mbsInvoiceText = `
      MBS Solutions A Company of Wrench Inc
      Bill to
      Ship to
      Emergency road service vancedugger@icloud.com
      5059171099
      Emergency Roadside Inc
      5720 East Mineral Road
      Guadalupe, AZ 85283
      P.O. number: 11625
      Invoice: 24581
      Date: Jan 17, 2025
      Terms
      Due date
      Amount due
      Items
      MX-H6/L3/48-Express
      MX-H6/L3/48-Express
      MX-H7/L4/94R-Express
      MX-H7/L4/94R-Express
      MX-H8/L5/49-Express
      MX-H8/L5/49-Express
      S24F-Express
      S24F-Express
      S35-Express
      S35-Express
      S51R-Express
      S51R-Express
      S65-Express
      S65-Express
      S75-Express
      S75-Express
      S86-Express
      S86-Express
      S-H5/L2/47-Express
      S-H5/L2/47-Express
      Quantity
      5
      7
      1
      6
      7
      2
      2
      1
      7
      Price
      $165.92
      $174.92
      $183.92
      $76.92
      $66.92
      $59.92
      $79.92
      $70.92
      $70.92
      $73.92
      Invoice
      701 5th Avenue
      Suite 7250
      Seattle, WA 98104
      (206) 408-8011
      Net 30 Feb 16, 2025
      $5,590.16
    `
      processInvoice(mbsInvoiceText)
      setIsScanning(false)
    }, 2000)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setIsScanning(true)
      // In a real app, this would use OCR to extract text from the image
      // For this example, we'll simulate processing the MBS invoice
      setTimeout(() => {
        const mbsInvoiceText = `
        MBS Solutions A Company of Wrench Inc
        Invoice: 24581
        Date: Jan 17, 2025
        P.O. number: 11625
        Items
        MX-H6/L3/48-Express
        MX-H7/L4/94R-Express
        MX-H8/L5/49-Express
        S24F-Express
        S35-Express
        S51R-Express
        S65-Express
        S75-Express
        S86-Express
        S-H5/L2/47-Express
        Quantity
        5
        7
        1
        6
        7
        2
        2
        1
        1
        7
        Price
        $165.92
        $174.92
        $183.92
        $76.92
        $66.92
        $59.92
        $79.92
        $70.92
        $70.92
        $73.92
      `
        processInvoice(mbsInvoiceText)
        setIsScanning(false)
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = ""
      }, 2000)
    }
  }

  const handleProcessInvoice = () => {
    if (invoiceData) {
      // Ensure location is properly formatted before processing
      const processedData = {
        ...invoiceData,
        location: invoiceData.location.toLowerCase(), // Ensure location is lowercase for consistency
      }

      onProcess(invoiceData)
      setInvoiceData(null)
      setParsedInvoice(null)
      setScanResult({
        success: true,
        message: `Invoice #${invoiceData.invoiceNumber} has been processed and inventory has been updated.`,
      })
      setTimeout(() => setScanResult(null), 3000)
    }
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-4">
        <div className="mb-4">
          <Label htmlFor="location">Delivery Location</Label>
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger id="location">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="broadway">Broadway</SelectItem>
              <SelectItem value="camelback">Camelback</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!parsedInvoice ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="upload">Upload Invoice</TabsTrigger>
              <TabsTrigger value="camera">Scan Invoice</TabsTrigger>
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
              <TabsTrigger value="tarab">Tarab Invoice</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4 pt-4">
              <div className="flex flex-col items-center">
                {isScanning ? (
                  <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg w-full">
                    <div className="animate-pulse flex flex-col items-center">
                      <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Processing invoice...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg w-full mb-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                      <p className="text-sm font-medium">Click to upload invoice</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF, JPG, or PNG</p>
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                    <Button onClick={() => fileInputRef.current?.click()}>
                      <FileText className="mr-2 h-4 w-4" />
                      Select File
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="camera" className="space-y-4 pt-4">
              {isScanning ? (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg">
                  <div className="animate-pulse flex flex-col items-center">
                    <Camera className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Scanning invoice...</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Button onClick={simulateScan} className="mb-4">
                    <Scan className="mr-2 h-4 w-4" />
                    Start Scanning
                  </Button>
                  <p className="text-sm text-muted-foreground">Position the invoice in front of your camera</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="manual" className="space-y-4 pt-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="invoice-number">Invoice Number</Label>
                  <Input
                    id="invoice-number"
                    placeholder="Enter invoice number"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="mb-2"
                  />
                </div>
                <div>
                  <Label htmlFor="po-number">PO Number</Label>
                  <Input
                    id="po-number"
                    placeholder="Enter PO number"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="mb-4"
                  />
                </div>
                <Button
                  onClick={() => {
                    setInvoiceType("standard")
                    handleManualSubmit()
                  }}
                  className="w-full sm:w-auto"
                >
                  Process Invoice
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="tarab" className="space-y-4 pt-4">
              <div className="space-y-4">
                <div className="bg-amber-50 p-4 rounded-md mb-4">
                  <div className="flex items-center">
                    <Info className="h-5 w-5 text-amber-600 mr-2" />
                    <h3 className="font-medium text-amber-800">Tarab Invoice</h3>
                  </div>
                  <p className="text-sm text-amber-700 mt-1">
                    Use this option for Tarab-specific invoices. The invoice number will be prefixed with "TARAB-".
                  </p>
                </div>

                <div>
                  <Label htmlFor="tarab-invoice-number">Tarab Invoice Number</Label>
                  <Input
                    id="tarab-invoice-number"
                    placeholder="Enter Tarab invoice number"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="mb-2"
                  />
                </div>
                <div>
                  <Label htmlFor="tarab-po-number">PO Number</Label>
                  <Input
                    id="tarab-po-number"
                    placeholder="Enter PO number"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="mb-4"
                  />
                </div>
                <Button
                  onClick={() => {
                    setInvoiceType("tarab")
                    handleManualSubmit()
                  }}
                  className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700"
                >
                  Process Tarab Invoice
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Invoice Preview</h3>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setParsedInvoice(null)
                    setInvoiceData(null)
                  }}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button onClick={confirmInvoice} className="w-full sm:w-auto">
                  Confirm & Update Inventory
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Invoice Number:</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={parsedInvoice.invoiceNumber}
                    onChange={(e) => {
                      setParsedInvoice({
                        ...parsedInvoice,
                        invoiceNumber: e.target.value,
                      })
                      if (invoiceData) {
                        setInvoiceData({
                          ...invoiceData,
                          invoiceNumber: e.target.value,
                        })
                      }
                    }}
                    className="h-8 font-medium"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">You can edit the invoice number before processing</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date:</p>
                <p className="font-medium">{parsedInvoice.date}</p>
              </div>
              <div>
                <p className="text-muted-foreground">PO Number:</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={parsedInvoice.poNumber}
                    onChange={(e) => {
                      setParsedInvoice({
                        ...parsedInvoice,
                        poNumber: e.target.value,
                      })
                      if (invoiceData) {
                        setInvoiceData({
                          ...invoiceData,
                          poNumber: e.target.value,
                        })
                      }
                    }}
                    className="h-8 font-medium"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">You can edit the PO number before processing</p>
              </div>
              <div>
                <p className="text-muted-foreground">Location:</p>
                <p className="font-medium">{parsedInvoice.location}</p>
              </div>
            </div>

            <div className="border rounded-md p-2">
              <div className="flex items-center mb-2">
                <Info className="h-4 w-4 mr-2 text-blue-500" />
                <p className="text-sm text-blue-500">Batteries are categorized by price:</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div className="flex items-center">
                  <Badge variant="outline" className="bg-green-100 text-green-800 mr-2">
                    Alpha
                  </Badge>
                  <span>Cheapest (Under $70)</span>
                </div>
                <div className="flex items-center">
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 mr-2">
                    Bravo
                  </Badge>
                  <span>Mid-range ($70-$80)</span>
                </div>
                <div className="flex items-center">
                  <Badge variant="outline" className="bg-purple-100 text-purple-800 mr-2">
                    Charlie
                  </Badge>
                  <span>Higher-end ($80-$175)</span>
                </div>
                <div className="flex items-center">
                  <Badge variant="outline" className="bg-red-100 text-red-800 mr-2">
                    AMG
                  </Badge>
                  <span>Premium (Over $175)</span>
                </div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedInvoice.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.model}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>${item.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getCategoryColor(item.category)}>
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">${item.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="grid grid-cols-4 gap-4 mt-4">
              {["Alpha", "Bravo", "Charlie", "AMG"].map((category) => {
                const categoryItems = parsedInvoice.items.filter((item) => item.category === category)
                const totalQuantity = categoryItems.reduce((sum, item) => sum + item.quantity, 0)

                return (
                  <Card
                    key={category}
                    className={`border-l-4 ${getCategoryColor(category).replace("bg-", "border-").replace("text-", "")}`}
                  >
                    <CardContent className="p-4">
                      <h4 className="font-medium">{category}</h4>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-2xl font-bold">{totalQuantity}</span>
                        <Badge variant="outline" className={getCategoryColor(category)}>
                          {categoryItems.length} models
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
              <Button onClick={handleProcessInvoice} disabled={!invoiceData} className="w-full sm:w-auto">
                Process Invoice
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200"
                onClick={() => {
                  if (invoiceData) {
                    // Add a hold reason field
                    const holdReason = prompt("Enter reason for placing order on hold:")
                    if (holdReason) {
                      const dataWithHold = {
                        ...invoiceData,
                        status: "holding",
                        holdReason,
                      }
                      onProcess(dataWithHold)
                      setInvoiceData(null)
                      setParsedInvoice(null)
                      setScanResult({
                        success: true,
                        message: `Invoice #${dataWithHold.invoiceNumber} has been placed on hold. Reason: ${holdReason}`,
                      })
                      setTimeout(() => setScanResult(null), 3000)
                    }
                  }
                }}
                disabled={!invoiceData}
              >
                Place on Hold
              </Button>
            </div>
          </div>
        )}

        {scanResult && !parsedInvoice && (
          <Alert className="mt-4" variant={scanResult.success ? "default" : "destructive"}>
            {scanResult.success ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertTitle>{scanResult.success ? "Success" : "Error"}</AlertTitle>
            <AlertDescription>{scanResult.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
