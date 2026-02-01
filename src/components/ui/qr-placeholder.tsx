import { QrCode } from "lucide-react"

interface QrPlaceholderProps {
  className?: string
}

export function QrPlaceholder({ className }: QrPlaceholderProps) {
  return (
    <div className={`bg-white p-4 rounded-xl border shadow-sm inline-block ${className}`}>
      <div className="w-48 h-48 bg-muted flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <QrCode className="h-12 w-12 text-gray-400 mx-auto mb-2" />
          <span className="text-xs text-gray-500">QR Code Preview</span>
        </div>
      </div>
    </div>
  )
}
