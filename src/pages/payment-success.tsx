import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { SuccessState } from "@/components/ui/success-state"

export default function PaymentSuccess() {
  return (
    <DashboardLayout>
      <SuccessState
        title="Payment Successful!"
        description="Your transaction has been processed. The recipient has received 500 USDC on Base."
        actionLabel="Return to Dashboard"
        actionHref="/dashboard"
      />
    </DashboardLayout>
  )
}
