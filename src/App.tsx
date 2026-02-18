import { Routes, Route } from "react-router-dom"
import { ThemeProvider } from "./components/theme-provider"
import { ThemeSwitcher } from "./components/theme-switcher"

// Pages
import LandingPage from "./pages/landing"
import Dashboard from "./pages/dashboard"
import CreateAgent from "./pages/create-agent"
import EnsSetup from "./pages/ens-setup"
import FundAgent from "./pages/fund-agent"
import Payments from "./pages/payments"
import OrderDetail from "./pages/order-detail"
import QrGenerator from "./pages/qr-generator"
import QrScanner from "./pages/qr-scanner"
import PaymentReview from "./pages/payment-review"
import PaymentSuccess from "./pages/payment-success"
import AgentSettings from "./pages/agent-settings"
import Strategies from "./pages/strategies"
import PayPage from "./pages/pay"
import { Toaster } from "./components/ui/sonner"

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="min-h-screen bg-background text-foreground font-mono">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create-agent" element={<CreateAgent />} />
          <Route path="/ens-setup" element={<EnsSetup />} />
          <Route path="/fund-agent" element={<FundAgent />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/orders/:orderId" element={<OrderDetail />} />
          <Route path="/qr-generator" element={<QrGenerator />} />
          <Route path="/qr-scanner" element={<QrScanner />} />
          <Route path="/payment-review" element={<PaymentReview />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/agent-settings" element={<AgentSettings />} />
          <Route path="/strategies" element={<Strategies />} />
          <Route path="/pay/:paymentData" element={<PayPage />} />
        </Routes>
        <ThemeSwitcher />
        <Toaster />
      </div>
    </ThemeProvider>
  )
}

export default App
