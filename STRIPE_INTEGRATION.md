# Stripe Crypto Onramp Integration Guide

## Overview

Stripe's Crypto Onramp allows users to buy crypto (USDC, ETH) using credit cards or bank transfers directly within your application. Stripe handles the KYC, payments, and crypto delivery.

## Requirements

1.  **Stripe Business Account**: You must have a verified Stripe business account in a supported country.
2.  **Crypto Onramp Enabled**: You need to request access to the Crypto Onramp feature in the Stripe Dashboard.
3.  **Publishable Key**: Your Stripe publishable key.

## Integration Steps

### 1. Install SDK

```bash
npm install @stripe/crypto
```

### 2. Initialize Onramp

In your funding page (`fund-agent.tsx`):

```tsx
import { StripeOnramp } from '@stripe/crypto';

// Initialize with your publishable key
const stripeOnramp = StripeOnramp.load('pk_test_...');

const handleBuyCrypto = () => {
  const onrampSession = stripeOnramp.createSession({
    customer_email: user.email,
    wallet_address: agentAddress,
    networks: ['arbitrum'],
    supported_destination_currencies: ['usdc', 'eth'],
  });

  onrampSession.mount('#onramp-element');
};
```

### 3. Server-Side (Optional but Recommended)

You may want to listen for webhooks to know when a purchase is completed.

## User Experience

1.  User clicks "Buy Crypto with Card".
2.  Stripe UI appears (modal or embedded).
3.  User enters email and payment details.
4.  First-time users verify identity (KYC) with Stripe.
5.  Payment processes.
6.  Crypto arrives in their Agent Wallet.

## Fees

-   Stripe charges a fee per transaction (typically ~1% + network fees).
-   You can add your own platform fee on top if desired.

## Alternatives

-   **Coinbase Pay**: Similar ease of use, integrated with Coinbase accounts.
-   **Transak / MoonPay**: specialized on-ramp providers, often support more regions/tokens.
