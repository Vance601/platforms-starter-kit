import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarcodeReader } from "@/components/barcode-reader"
import { BarcodeGenerator } from "@/components/barcode-generator"

export default function BarcodePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Barcode Tools</h1>
      </div>

      <Tabs defaultValue="scanner" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="scanner">Barcode Scanner</TabsTrigger>
          <TabsTrigger value="generator">Label Generator</TabsTrigger>
        </TabsList>

        <TabsContent value="scanner" className="mt-6">
          <BarcodeReader />
        </TabsContent>

        <TabsContent value="generator" className="mt-6">
          <BarcodeGenerator />
        </TabsContent>
      </Tabs>
    </div>
  )
}
