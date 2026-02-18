"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Camera, Upload, X, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { Html5Qrcode } from "html5-qrcode"

interface QrCodeReaderProps {
    onResult: (qrString: string) => void
    disabled?: boolean
}

export function QrCodeReader({ onResult, disabled }: QrCodeReaderProps) {
    const [scanning, setScanning] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [decodedValue, setDecodedValue] = useState("")
    const fileInputRef = useRef<HTMLInputElement>(null)
    const scannerRef = useRef<Html5Qrcode | null>(null)
    const scannerContainerId = "qr-reader-container"

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setProcessing(true)
        try {
            const scanner = new Html5Qrcode("qr-file-temp")
            const result = await scanner.scanFile(file, true)
            setDecodedValue(result)
            onResult(result)
            toast.success("QR code decoded successfully!")
            await scanner.clear()
        } catch (err: any) {
            console.error("QR decode error:", err)
            toast.error("Could not read QR code from image. Try a clearer image or enter the code manually.")
        } finally {
            setProcessing(false)
            // Reset file input
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const startCamera = async () => {
        setScanning(true)
        try {
            const scanner = new Html5Qrcode(scannerContainerId)
            scannerRef.current = scanner

            await scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    setDecodedValue(decodedText)
                    onResult(decodedText)
                    toast.success("QR code scanned!")
                    stopCamera()
                },
                () => { } // ignore scan failures
            )
        } catch (err: any) {
            console.error("Camera error:", err)
            toast.error("Could not access camera. Try uploading an image instead.")
            setScanning(false)
        }
    }

    const stopCamera = async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop()
                await scannerRef.current.clear()
            } catch { }
            scannerRef.current = null
        }
        setScanning(false)
    }

    const clearResult = () => {
        setDecodedValue("")
        onResult("")
    }

    return (
        <div className="space-y-3">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={disabled || processing}
            />

            {/* Hidden div for file scanning */}
            <div id="qr-file-temp" className="hidden" />

            {/* Decoded result */}
            {decodedValue && (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-green-700">QR Code Decoded</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{decodedValue}</p>
                    </div>
                    {!disabled && (
                        <Button variant="ghost" size="sm" onClick={clearResult} className="h-6 w-6 p-0">
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            )}

            {/* Scanner view */}
            {scanning && (
                <div className="relative rounded-lg overflow-hidden border">
                    <div id={scannerContainerId} className="w-full" />
                    <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 z-10"
                        onClick={stopCamera}
                    >
                        <X className="h-3 w-3 mr-1" /> Close
                    </Button>
                </div>
            )}

            {/* Action buttons */}
            {!decodedValue && !scanning && (
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={startCamera}
                        disabled={disabled || processing}
                    >
                        <Camera className="h-4 w-4" />
                        Scan QR
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled || processing}
                    >
                        {processing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Upload className="h-4 w-4" />
                        )}
                        Upload Image
                    </Button>
                </div>
            )}
        </div>
    )
}
