"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Camera, Scan, AlertCircle, Check } from "lucide-react"

export function BarcodeReader({ onScan }: { onScan?: (value: string) => void }) {
  const [activeTab, setActiveTab] = useState("manual")
  const [barcodeValue, setBarcodeValue] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleManualSubmit = () => {
    if (barcodeValue.trim()) {
      onScan?.(barcodeValue)
      setScanResult({ success: true, message: `Successfully processed barcode: ${barcodeValue}` })
      setTimeout(() => setScanResult(null), 3000)
    }
  }

  const simulateScan = () => {
    setIsScanning(true)
    // Simulate a scanning process
    setTimeout(() => {
      const mockBarcodeValue = `BAT-${Math.floor(1000 + Math.random() * 9000)}`
      setBarcodeValue(mockBarcodeValue)
      onScan?.(mockBarcodeValue)
      setIsScanning(false)
      setScanResult({ success: true, message: `Successfully scanned barcode: ${mockBarcodeValue}` })
      setTimeout(() => setScanResult(null), 3000)
    }, 2000)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setIsScanning(true)
      // Simulate processing an image with a barcode
      setTimeout(() => {
        const mockBarcodeValue = `BAT-${Math.floor(1000 + Math.random() * 9000)}`
        setBarcodeValue(mockBarcodeValue)
        onScan?.(mockBarcodeValue)
        setIsScanning(false)
        setScanResult({ success: true, message: `Successfully extracted barcode from image: ${mockBarcodeValue}` })
        setTimeout(() => setScanResult(null), 3000)
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = ""
      }, 2000)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Barcode Scanner</CardTitle>
        <CardDescription>Scan or enter a barcode to find a battery</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="camera">Camera Scan</TabsTrigger>
            <TabsTrigger value="file">Upload Image</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 pt-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Enter barcode number"
                value={barcodeValue}
                onChange={(e) => setBarcodeValue(e.target.value)}
              />
              <Button onClick={handleManualSubmit}>Submit</Button>
            </div>
          </TabsContent>

          <TabsContent value="camera" className="space-y-4 pt-4">
            {isScanning ? (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg">
                <div className="animate-pulse flex flex-col items-center">
                  <Camera className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Scanning...</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Button onClick={simulateScan} className="mb-4">
                  <Scan className="mr-2 h-4 w-4" />
                  Start Scanning
                </Button>
                <p className="text-sm text-muted-foreground">Position the barcode in front of your camera</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="file" className="space-y-4 pt-4">
            <div className="flex flex-col items-center">
              <Input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="mb-4" />
              <p className="text-sm text-muted-foreground">Upload an image containing a barcode</p>
            </div>
          </TabsContent>
        </Tabs>

        {scanResult && (
          <Alert className="mt-4" variant={scanResult.success ? "default" : "destructive"}>
            {scanResult.success ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertTitle>{scanResult.success ? "Success" : "Error"}</AlertTitle>
            <AlertDescription>{scanResult.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        Supports standard 1D and 2D barcodes including QR codes
      </CardFooter>
    </Card>
  )
}
