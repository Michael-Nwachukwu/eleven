"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Upload, Camera, X } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { toast } from "sonner"
import { decodeX402Payment, type X402PaymentRequest } from "@/lib/x402"

export default function QrScanner() {
  const navigate = useNavigate()
  const [scanning, setScanning] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [paymentRequest, setPaymentRequest] = useState<X402PaymentRequest | null>(null)
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [])

  const startScanning = async () => {
    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(track => track.stop()) // Stop immediately, html5-qrcode will handle it
      setHasPermission(true)

      // Initialize scanner
      const html5QrCode = new Html5Qrcode("qr-reader")
      html5QrCodeRef.current = html5QrCode

      // Start scanning
      await html5QrCode.start(
        { facingMode: "environment" }, // Use back camera on mobile
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          // QR Code detected
          console.log("QR Code detected:", decodedText)
          await handleQRDetected(decodedText)
        },
        (errorMessage) => {
          // Scanning errors (can be ignored, happens frequently)
          // console.log("Scanning...", errorMessage)
        }
      )

      setScanning(true)
      toast.success("Camera started successfully!")

    } catch (error) {
      console.error("Error starting camera:", error)
      setHasPermission(false)
      toast.error("Failed to access camera. Please grant camera permissions.")
    }
  }

  const stopScanning = async () => {
    if (html5QrCodeRef.current && scanning) {
      try {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current = null
        setScanning(false)
      } catch (error) {
        console.error("Error stopping scanner:", error)
      }
    }
  }

  const handleQRDetected = async (qrData: string) => {
    try {
      // Stop scanning
      await stopScanning()

      console.log('=== QR Code Scanned ===')
      console.log('Raw QR Data:', qrData)

      // Parse x402 payment request
      const payment = decodeX402Payment(qrData)

      console.log('Decoded Payment Request:', payment)
      console.log('Payment Metadata:', payment.metadata)
      console.log('Amount:', payment.maxAmountRequired, payment.metadata?.token)
      console.log('Network:', payment.network)
      console.log('Recipient:', payment.payTo)

      // Navigate to payment review with payment data
      navigate("/payment-review", { state: { paymentRequest: payment } })

    } catch (error) {
      console.error("Error parsing QR code:", error)
      toast.error("Invalid QR code. Please scan a valid x402 payment QR code.")
      // Resume scanning
      if (!scanning) {
        startScanning()
      }
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const html5QrCode = new Html5Qrcode("qr-file-reader")

      const result = await html5QrCode.scanFile(file, true)
      console.log("QR Code from file:", result)

      await handleQRDetected(result)

    } catch (error) {
      console.error("Error reading QR from file:", error)
      toast.error("Could not read QR code from image. Please try again.")
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <Link to="/payments" className="text-muted-foreground hover:text-foreground flex items-center mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Payments
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Scan QR Code</h1>
          <p className="text-muted-foreground mt-2">
            Point your camera at an x402 payment QR code to make a payment.
          </p>
        </div>

        <div className="space-y-6">
          {/* Camera View */}
          <Card>
            <CardContent className="p-0">
              {!scanning ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-6">
                  <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
                    <Camera className="h-12 w-12 text-primary" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="font-semibold text-lg">Ready to Scan</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Click the button below to start your camera and scan a payment QR code.
                    </p>
                  </div>
                  <Button onClick={startScanning} size="lg" className="w-full">
                    <Camera className="mr-2 h-5 w-5" />
                    Start Camera
                  </Button>

                  {hasPermission === false && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 w-full">
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Camera permission denied. Please enable camera access in your browser settings and try again.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  {/* QR Scanner Video Container */}
                  <div id="qr-reader" className="w-full" />

                  {/* Overlay Instructions */}
                  <div className="absolute top-4 left-4 right-4 bg-black/70 text-white rounded-lg p-3 text-center">
                    <p className="text-sm font-medium">Align QR code within the frame</p>
                  </div>

                  {/* Stop Button */}
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                    <Button
                      onClick={stopScanning}
                      variant="destructive"
                      size="lg"
                      className="shadow-lg"
                    >
                      <X className="mr-2 h-5 w-5" />
                      Stop Scanning
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hidden div for file upload scanning */}
          <div id="qr-file-reader" className="hidden" />

          {/* Upload Alternative */}
          {!scanning && (
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <Button
                variant="outline"
                className="w-full"
                onClick={triggerFileInput}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload QR Image
              </Button>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="text-sm space-y-2">
                  <p className="font-medium text-blue-500">How to scan:</p>
                  <ol className="list-decimal list-inside text-muted-foreground space-y-1 ml-2">
                    <li>Click "Start Camera" to begin scanning</li>
                    <li>Point your camera at the QR code</li>
                    <li>Hold steady until the code is detected</li>
                    <li>Review and confirm the payment details</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
