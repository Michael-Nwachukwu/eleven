# Eleven — Programmable Crypto Payments

> A self-custodial payment platform that lets anyone accept crypto and fiat payments through a shareable QR code, powered by an autonomous AI agent wallet with a verifiable on-chain identity on Arbitrum.

---

## Overview

Eleven bridges the gap between on-chain money, autonomous agents, and real-world commerce. Merchants generate a payment QR code, and customers (or their autonomous AI agents) scan/parse and pay in crypto or local fiat. Settlement lands directly on Arbitrum. An embedded AI agent wallet handles signing, routing, and fiat conversion without custodying user funds, natively enabling **Agent-to-Agent** commerce. Each agent can be registered on-chain with a verifiable **ERC-8004** identity and a human-readable **ENS subdomain**, making them discoverable to other agents and humans alike.

---

## Key Features

### AI Agent Wallet

- Non-custodial agent wallets provisioned per user via **Thirdweb Agent Kit**
- Each agent is a smart EOA on **Arbitrum One** that can sign transactions autonomously
- Balances (USDC + ETH) visible on the dashboard in real time
- Agent settings for custom names, ENS, tax configuration, and yield strategy

### Multichain Smart Deposit

- Fund your agent from **5+** supported networks — no manual bridging required
- All transactions are still completely carried out on Arbitrum
- Powered by **LI.FI SDK v3**: automatically finds the best bridge + swap route
- Supported sources: Arbitrum, Base, Optimism, Scroll, zkSync Era (USDC, USDT, ETH)
- If USDC already exists on Arbitrum, it is direct-transferred first; any shortfall is bridged from other chains
- Live execution progress UI: per-step status (Approve → Swap → Bridge → Receive), substep labels, and block explorer links update in real time

### QR Code Payments (x402 Protocol)

- Merchants generate a shareable QR code encoding a signed **x402** payment request
- **Agent-to-Agent Native:** Because the URI follows a strict parseable schema, other AI bots, trading assistants, and intelligent agents can read the code and autonomously execute payments directly to your merchant agent.
- Supports two payment modes from the same QR:
  - **Crypto**: USDC / ETH on Arbitrum, paid directly by a connected human wallet or an autonomous AI agent
  - **Fiat**: Vietnamese Dong (VND) / Nigerian Naira (NGN) via **Aeon** bank settlement
- Human customers can scan with any camera — no app install required
- Payment page shows order amount, merchant name, ENS identity, and (when applicable) a tax line-item breakdown

### Tax Configuration

- Merchants can optionally enable a **tax rate** (e.g. 7.5% VAT) in Agent Settings
- Tax is added **on top** of the merchant's price — the customer pays the full total in one on-chain transfer
- Payment QR codes automatically embed the tax-inclusive total with metadata: `subtotal`, `taxRate`, `taxAmount`, `taxLabel`
- Customer-facing pay pages show a clear line-item breakdown: **Subtotal → Tax (VAT/GST/etc.) → Total**
- Fulfillment records log the tax portion separately for merchant accounting
- Supported labels: VAT, GST, Sales Tax, Service Charge
- Fiat payments are unaffected — tax only applies to crypto QR payments

### Yield Optimization (Aave V3)

- Merchants can enable **autonomous yield** on every incoming crypto payment
- A configurable **allocation percentage** (via a slider, e.g. 40%) of each payment is automatically deposited into **Aave V3 on Arbitrum** (~1.8% APY)
- Funds are held as **aUSDC** — Aave's yield-bearing receipt token — accruing interest every block
- A **monthly investment cap** prevents over-allocation in any single month
- **Auto-harvest**: when the agent needs to make an outgoing payment but has insufficient liquid USDC, it checks the Aave balance and withdraws the needed amount automatically
- Manual deposit / withdraw controls available from the Strategies page
- ETH Accumulation and Liquidity Provision strategies shown as *Coming Soon*
- Fiat payments (Aeon) are **excluded** — only on-chain USDC payments trigger auto-invest

### Fiat Settlement via Aeon

- Integrates **Aeon's x402 QR Code Payment API** for bank-to-crypto settlement
- Supports VietQR (Vietnam) and Nigerian bank account verification
- Customers pay via local internet banking; Aeon settles USDC to the merchant's agent wallet on Arbitrum
- Bank list + account name auto-verified at QR generation time

### Email Notifications

- Transactional receipts sent to payers via **Resend**
- Beautiful HTML emails built with **React Email**
- Notifications fire automatically after successful payment confirmation

### Payment Dashboard

- Real-time USDC and ETH balance display
- Full payment history with status tracking (pending → confirmed → settled)
- Per-order detail view with on-chain transaction links
- Send modal for direct USDC transfers

### ENS Subdomains (NameStone)

- Each agent can claim a free, gasless ENS subdomain under `0xkitchens.eth` (e.g. `mystore.0xkitchens.eth`)
- Powered by **NameStone CCIP-Read** — names resolve on Mainnet without gas costs
- ENS names are shown as the **payment recipient** on customer-facing pay pages and QR codes
- Real-time availability checking during agent creation and in settings
- Existing agents can claim a name at any time from the Agent Settings page

### Agent Identity (ERC-8004)

- Each agent can mint a verifiable **ERC-8004** identity NFT
- Off-chain MVP stores metadata in Redis: agent name, capabilities, ENS handle, wallet address
- "Mint Identity" button in settings — prepares agents for on-chain migration when the Identity Registry contract is deployed
- Identity metadata follows the ERC-8004 JSON standard for cross-platform agent discovery

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Vite + React)              │
│  Dashboard │ QR Generator │ Pay Page │ Strategies       │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼─────────────────────────────────┐
│               Vercel Serverless API (Node.js)            │
│  /api/payment   /api/aeon   /api/agent   /api/notifications │
└────────┬──────────────┬────────────┬────────────────────┘
         │              │            │
    ┌────▼────┐   ┌─────▼────┐  ┌───▼───────────┐
    │  Redis  │   │  Resend  │  │ Coinbase CDP  │
    │ (Orders)│   │ (Email)  │  │ (Agent Wallet)│
    └─────────┘   └──────────┘  └───────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                 Arbitrum One (Primary Chain)              │
│  USDC Settlement · Agent Wallets · ERC-8004 · Aave V3    │
└─────────────────────────────────────────────────────────┘
                        │
    ┌───────────────────┼───────────────────┐
    ▼                   ▼                   ▼
┌───────────┐    ┌────────────┐    ┌────────────────┐
│  LI.FI    │    │  NameStone │    │   Aave V3      │
│ (Bridging)│    │ (ENS Names)│    │ (Yield ~1.8%)  │
└───────────┘    └────────────┘    └────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, TypeScript, TailwindCSS v4, shadcn/ui, Radix UI |
| **Auth** | Privy (embedded + external wallet support) |
| **Agent Wallets** | Thirdweb Agent Kit |
| **Multichain Bridging** | LI.FI SDK v3 |
| **Transaction Signing** | Thirdweb SDK, Viem |
| **Blockchain** | Arbitrum One (primary), Base, Optimism, Scroll, zkSync Era |
| **Fiat Settlement** | Aeon x402 API |
| **ENS Subdomains** | NameStone CCIP-Read API |
| **Agent Identity** | ERC-8004 (off-chain MVP) |
| **Yield** | Aave V3 on Arbitrum (~1.8% APY on USDC) |
| **Email** | Resend + React Email |
| **API / Backend** | Vercel Serverless Functions (Node.js) |
| **State / Orders** | Redis (Upstash) |
| **Payment Protocol** | x402 (EIP-compliant signed payment URIs) |
| **Charts & UI** | Recharts, TanStack Table, Lucide Icons |
| **Deployment** | Vercel |

---

## Supported Networks

| Network | Chain ID | Supported Tokens |
|---|---|---|
| **Arbitrum One** *(primary)* | 42161 | USDC, ETH |
| Base | 8453 | USDC, ETH |
| Optimism | 10 | USDC, ETH |
| Scroll | 534352 | USDC, ETH |
| zkSync Era | 324 | USDC, ETH |

---

## User Flows

### Merchant Flow

1. **Sign in** with Privy (email, Google, or external wallet)
2. **Create agent** — a non-custodial wallet is provisioned on Arbitrum
3. **Claim ENS name** *(optional)* — register a human-readable subdomain like `mystore.0xkitchens.eth`
4. **Fund agent** — deposit USDC from any supported chain via the Smart Multichain Deposit
5. **Mint identity** *(optional)* — create a verifiable ERC-8004 agent profile
6. **Configure tax** *(optional)* — set a VAT/GST rate; all QR payments will include a customer-facing tax breakdown
7. **Enable yield** *(optional)* — set an allocation % in Agent Settings; a portion of every incoming crypto payment is automatically deposited into Aave V3
8. **Generate QR** — configure amount, token, description, and optionally link a bank account for fiat
9. **Share QR** — share the link or QR image; payments arrive directly to the agent wallet
10. **Receive email receipt** — payers get a confirmation email automatically

### Customer Flow

1. **Scan QR** — open the payment URL in any browser
2. **Connect wallet** (or log in with Privy) — no app install required
3. **Choose payment method** — crypto (USDC/ETH via agent or external wallet) or fiat (bank transfer via Aeon)
4. **Confirm & pay** — transaction signed and submitted to Arbitrum
5. **Receipt** — on-chain confirmation + optional email receipt

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Privy](https://privy.io) App ID
- A [Coinbase CDP](https://portal.cdp.coinbase.com/) API key
- A [Thirdweb](https://thirdweb.com) Client ID + Secret Key
- A [Resend](https://resend.com) API key
- A Redis instance (e.g. [Upstash](https://upstash.com))
- Aeon App ID (use `TEST000001` for sandbox)

### Installation

```bash
git clone https://github.com/your-org/eleven.git
cd eleven
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
# Auth
VITE_PRIVY_APP_ID=your-privy-app-id

# Payment Splitter
VITE_SPLITTER_ADDRESS=your-splitter-contract-address

# Thirdweb
VITE_THIRDWEB_CLIENT_ID=your-thirdweb-client-id
THIRDWEB_SECRET_KEY=your-thirdweb-secret-key

# Aeon (fiat settlement)
VITE_ENABLE_AEON_PAYMENTS=true
VITE_AEON_APP_ID=TEST000001

# Network
VITE_DEFAULT_NETWORK=arbitrum
VITE_ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Backend
ENCRYPTION_SECRET=your-secret-key
REDIS_URL=your-redis-url

# ENS Subdomains (NameStone)
NAMESTONE_API_KEY=your-namestone-api-key
VITE_ENS_DOMAIN=0xkitchens.eth
```

### Run locally

```bash
npm run dev        # Vite dev server
vercel dev         # Full stack (API + frontend) via Vercel CLI
```

### Build

```bash
npm run build
```

---

## Project Structure

```
pp/
├── src/
│   ├── pages/             # Route-level components
│   │   ├── dashboard.tsx       # Agent wallet overview
│   │   ├── fund-agent.tsx      # Multichain deposit UI
│   │   ├── qr-generator.tsx    # Payment QR creation
│   │   ├── pay.tsx             # Customer payment page
│   │   ├── order-detail.tsx    # Per-order tracking
│   │   └── ...
│   ├── services/
│   │   ├── lifi-service.ts     # Multichain deposit orchestration
│   │   ├── payment-service.ts  # x402 payment execution
│   │   ├── aave-service.ts     # Aave V3 supply/withdraw/position (yield)
│   │   ├── namestone-service.ts # ENS subdomain registration (NameStone API)
│   │   ├── erc8004-service.ts  # Agent identity minting (ERC-8004 MVP)
│   │   ├── aeon-x402-clientt.ts # Aeon fiat settlement client
│   │   └── thirdweb-agent-service.ts
│   ├── lib/
│   │   ├── x402.ts            # x402 URI encode/decode
│   │   ├── db.ts              # Redis order + agent metadata storage
│   │   └── email-service.ts   # Resend integration
│   └── types/
│       └── lifi-types.ts      # Multichain deposit types
├── api/
│   ├── payment/           # Order create/fulfill/query
│   ├── aeon/              # Aeon API proxy (banks, orders)
│   ├── agent/             # Agent provisioning, ENS, ERC-8004
│   └── notifications/     # Email receipt dispatch
└── contracts/             # On-chain references
```

---

## License

MIT
