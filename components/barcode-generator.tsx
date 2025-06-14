"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Printer, Download, Copy, Check } from "lucide-react"

export function BarcodeGenerator() {
  const [barcodeValue, setBarcodeValue] = useState("")
  const [barcodeType, setBarcodeType] = useState("code128")
  const [labelSize, setLabelSize] = useState("medium")
  const [includeText, setIncludeText] = useState(true)
  const [additionalText, setAdditionalText] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const generateBarcode = () => {
    setIsGenerating(true)
    // Simulate barcode generation
    setTimeout(() => {
      setIsGenerating(false)
    }, 1000)
  }

  const printBarcode = () => {
    // In a real app, this would trigger printing
    alert("Printing barcode label...")
  }

  const downloadBarcode = () => {
    // In a real app, this would download the barcode image
    alert("Downloading barcode image...")
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(barcodeValue).then(() => {
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    })
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Barcode Label Generator</CardTitle>
        <CardDescription>Create and print barcode labels for inventory</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="single">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">Single Label</TabsTrigger>
            <TabsTrigger value="batch">Batch Labels</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="barcodeValue">Barcode Value</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="barcodeValue"
                      placeholder="Enter value to encode"
                      value={barcodeValue}
                      onChange={(e) => setBarcodeValue(e.target.value)}
                    />
                    <Button variant="outline" size="icon" onClick={copyToClipboard} className="flex-shrink-0">
                      {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="barcodeType">Barcode Type</Label>
                  <Select value={barcodeType} onValueChange={setBarcodeType}>
                    <SelectTrigger id="barcodeType">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="code128">Code 128</SelectItem>
                      <SelectItem value="code39">Code 39</SelectItem>
                      <SelectItem value="ean13">EAN-13</SelectItem>
                      <SelectItem value="qrcode">QR Code</SelectItem>
                      <SelectItem value="datamatrix">Data Matrix</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="labelSize">Label Size</Label>
                  <Select value={labelSize} onValueChange={setLabelSize}>
                    <SelectTrigger id="labelSize">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small (1" x 0.5")</SelectItem>
                      <SelectItem value="medium">Medium (2" x 1")</SelectItem>
                      <SelectItem value="large">Large (3" x 2")</SelectItem>
                      <SelectItem value="custom">Custom Size</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additionalText">Additional Text</Label>
                  <Input
                    id="additionalText"
                    placeholder="Optional text to include on label"
                    value={additionalText}
                    onChange={(e) => setAdditionalText(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Label htmlFor="includeText" className="flex items-center space-x-2 cursor-pointer">
                  <input
                    id="includeText"
                    type="checkbox"
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                    checked={includeText}
                    onChange={(e) => setIncludeText(e.target.checked)}
                  />
                  <span>Include human-readable text</span>
                </Label>
              </div>

              <div className="pt-4">
                <Button onClick={generateBarcode} disabled={!barcodeValue || isGenerating}>
                  {isGenerating ? "Generating..." : "Generate Barcode"}
                </Button>
              </div>
            </div>

            {barcodeValue && !isGenerating && (
              <div className="mt-6 border rounded-lg p-4 flex flex-col items-center">
                <div className="bg-white p-4 border rounded mb-4 w-full max-w-xs flex justify-center">
                  {/* This would be a real barcode in a production app */}
                  <div className="h-20 w-64 bg-gradient-to-r from-gray-200 to-gray-300 flex items-center justify-center">
                    <p className="text-xs text-gray-500">Barcode Preview: {barcodeValue}</p>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button variant="outline" onClick={printBarcode}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </Button>
                  <Button variant="outline" onClick={downloadBarcode}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="batch" className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="batchValues">Barcode Values (one per line)</Label>
                <textarea
                  id="batchValues"
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Enter values, one per line"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="batchBarcodeType">Barcode Type</Label>
                  <Select defaultValue="code128">
                    <SelectTrigger id="batchBarcodeType">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="code128">Code 128</SelectItem>
                      <SelectItem value="code39">Code 39</SelectItem>
                      <SelectItem value="ean13">EAN-13</SelectItem>
                      <SelectItem value="qrcode">QR Code</SelectItem>
                      <SelectItem value="datamatrix">Data Matrix</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="batchLabelSize">Label Size</Label>
                  <Select defaultValue="medium">
                    <SelectTrigger id="batchLabelSize">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small (1" x 0.5")</SelectItem>
                      <SelectItem value="medium">Medium (2" x 1")</SelectItem>
                      <SelectItem value="large">Large (3" x 2")</SelectItem>
                      <SelectItem value="custom">Custom Size</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-4">
                <Button>Generate Batch</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        Compatible with standard label printers and paper sizes
      </CardFooter>
    </Card>
  )
}
