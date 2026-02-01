import { Camera } from "lucide-react"

export function QrScannerPlaceholder() {
  return (
    <div className="w-full aspect-square max-w-sm mx-auto bg-black rounded-2xl overflow-hidden relative">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center text-white/50">
          <Camera className="h-12 w-12 mx-auto mb-4" />
          <p className="text-sm">Camera View</p>
        </div>
      </div>
      {/* Scanner Frame Overlay */}
      <div className="absolute inset-0 border-[40px] border-black/50">
        <div className="w-full h-full border-2 border-primary rounded-lg relative">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary -mt-1 -ml-1"></div>
          <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary -mt-1 -mr-1"></div>
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary -mb-1 -ml-1"></div>
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary -mb-1 -mr-1"></div>
        </div>
      </div>
    </div>
  )
}
