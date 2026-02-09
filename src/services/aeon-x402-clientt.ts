/**
 * Aeon x402 Payment Header Generator
 *
 * Creates X-PAYMENT headers specifically for Aeon's x402 QR Code Payment API
 * https://aeon-xyz.readme.io/docs/x402-qr-code-payment
 *
 * Updated to use ThirdWeb SDK for wallet management and signing
 */

import { signTypedData } from 'thirdweb/utils'
// Note: Using Web Crypto API instead of Node.js crypto for browser compatibility

// =============================================================================
// TYPES - Based on Aeon's API
// =============================================================================

/**
 * The 402 response from Aeon's API (inside "accepts" array)
 * Updated to match actual Aeon API field names
 */
interface Aeon402Response {
  // Actual Aeon field names (from API response)
  amountRequired: string;             // e.g., "550000000000000000" (atomic units)
  payToAddress: `0x${string}`;        // Recipient address
  tokenAddress: `0x${string}`;        // Token contract (USDC)
  networkId: string;                  // "56" for BSC, "42161" for Arbitrum
  scheme: string;                     // "exact"
  resource: string;                   // API endpoint
  description?: string;
  tokenSymbol?: string;               // "USDC"
  tokenDecimals?: number;             // 18 for BSC, 6 for Arbitrum
  amountRequiredFormat?: string;      // "humanReadable"
  namespace?: string;                 // "evm"
  extra?: {
    orderNo: string;
    name: string;
    version: string;
  };
  // Legacy field names (for backwards compatibility)
  maxAmountRequired?: string;
  payTo?: `0x${string}`;
  asset?: `0x${string}`;
  network?: string;
  maxTimeoutSeconds?: number;
}

/**
 * Full 402 response structure from Aeon
 */
interface AeonPaymentRequired {
  code: string;
  msg: string;
  traceId: string;
  x402Version: string;
  error: string;
  accepts: Aeon402Response[];
}

/**
 * Authorization structure for X-PAYMENT payload
 */
interface AeonAuthorization {
  from: `0x${string}`;      // Payer wallet address
  to: `0x${string}`;        // Recipient (payTo from 402)
  value: string;            // Amount in atomic units
  validAfter: string;       // Unix timestamp (start)
  validBefore: string;      // Unix timestamp (expiration)
  nonce: `0x${string}`;     // Unique 32-byte nonce
}

/**
 * X-PAYMENT header payload structure for Aeon
 */
interface AeonXPaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: `0x${string}`;
    authorization: AeonAuthorization;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const AEON_SANDBOX_URL = "https://ai-api-sbx.aeon.xyz";
const AEON_PROD_URL = "https://ai-api.aeon.xyz";

// USDC on Arbitrum (6 decimals) - Native USDC
const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

// Chain IDs
const CHAIN_IDS: Record<string, number> = {
  "arbitrum": 42161, // Arbitrum One
  "arbitrum-one": 42161,
};

// =============================================================================
// EIP-712 TYPES FOR AEON
// =============================================================================

/**
 * EIP-712 types for Aeon's transfer authorization
 * This follows EIP-3009 (transferWithAuthorization) pattern
 */
const AEON_PAYMENT_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a random 32-byte nonce using Web Crypto API (browser-compatible)
 */
function generateNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `0x${hex}` as `0x${string}`;
}

/**
 * Encode payload to base64 for X-PAYMENT header (browser-compatible)
 */
function encodePayload(payload: AeonXPaymentPayload): string {
  const jsonString = JSON.stringify(payload);
  // Use btoa for browser compatibility
  return btoa(jsonString);
}

/**
 * Decode base64 X-PAYMENT header (for debugging, browser-compatible)
 */
function decodePayload(base64: string): AeonXPaymentPayload {
  // Use atob for browser compatibility
  return JSON.parse(atob(base64));
}

// =============================================================================
// MAIN CLIENT CLASS
// =============================================================================

class AeonX402Client {
  private wallet: any // ThirdWeb wallet
  private walletAddress: `0x${string}` | null = null
  private baseUrl: string

  constructor(sandbox: boolean = false) {
    this.baseUrl = sandbox ? AEON_SANDBOX_URL : AEON_PROD_URL
  }

  /**
   * Set ThirdWeb wallet for signing
   */
  setWallet(wallet: any): void {
    this.wallet = wallet
    const account = wallet.getAccount()
    this.walletAddress = account?.address as `0x${string}` || null
  }

  /**
   * Get the wallet address
   */
  getWallet(): `0x${string}` | null {
    return this.walletAddress
  }

  /**
   * Create the X-PAYMENT header for Aeon's API
   */
  async createXPaymentHeader(
    paymentInfo: Aeon402Response,
    amount?: string // Optional: pay different amount (must be <= maxAmountRequired)
  ): Promise<string> {
    if (!this.wallet || !this.walletAddress) {
      throw new Error("Wallet not set. Call setWallet() first.");
    }

    // Use new field names with fallback to legacy names
    const paymentAmount = amount || paymentInfo.amountRequired || paymentInfo.maxAmountRequired;
    const payToAddress = paymentInfo.payToAddress || paymentInfo.payTo;
    const tokenAddress = paymentInfo.tokenAddress || paymentInfo.asset;
    const networkId = paymentInfo.networkId || paymentInfo.network;

    // Validate required fields are present
    if (!paymentAmount) {
      throw new Error("Payment amount is missing from Aeon response");
    }
    if (!payToAddress) {
      throw new Error("Pay-to address is missing from Aeon response");
    }
    if (!tokenAddress) {
      throw new Error("Token address is missing from Aeon response");
    }

    const now = Math.floor(Date.now() / 1000);
    const validAfter = now;
    const validBefore = now + (paymentInfo.maxTimeoutSeconds || 120);
    const nonce = generateNonce();

    // Map networkId to chainId
    const chainId = networkId ? (CHAIN_IDS[networkId] || parseInt(networkId) || 42161) : 42161;

    // Create the authorization object
    const authorization: AeonAuthorization = {
      from: this.walletAddress,
      to: payToAddress as `0x${string}`,
      value: paymentAmount,
      validAfter: validAfter.toString(),
      validBefore: validBefore.toString(),
      nonce: nonce,
    };

    // Create EIP-712 typed data for signing
    // This follows EIP-3009 pattern for USDC transferWithAuthorization
    const typedData = {
      types: AEON_PAYMENT_TYPES,
      primaryType: "TransferWithAuthorization" as const,
      domain: {
        name: paymentInfo.extra?.name || "USD Coin",  // USDC token name
        version: paymentInfo.extra?.version || "2",   // USDC version
        chainId: BigInt(chainId),
        verifyingContract: tokenAddress as `0x${string}`,
      },
      message: {
        from: authorization.from,
        to: authorization.to,
        value: BigInt(authorization.value),
        validAfter: BigInt(authorization.validAfter),
        validBefore: BigInt(authorization.validBefore),
        nonce: authorization.nonce,
      },
    };

    // Sign with ThirdWeb
    const account = this.wallet.getAccount()
    const signature = await account.signTypedData(typedData);

    // Build the X-PAYMENT payload
    const payload: AeonXPaymentPayload = {
      x402Version: 1,
      scheme: paymentInfo.scheme,
      network: networkId || "arbitrum",
      payload: {
        signature: signature as `0x${string}`,
        authorization: authorization,
      },
    };

    return encodePayload(payload);
  }

  /**
   * Step 1: Get payment information from Aeon
   */
  async getPaymentInfo(
    appId: string,
    qrCode: string
  ): Promise<AeonPaymentRequired> {
    if (!this.walletAddress) {
      throw new Error("Wallet not initialized. Call init() or setWallet() first.");
    }

    const url = new URL(`${this.baseUrl}/open/ai/402/payment`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("qrCode", qrCode);
    url.searchParams.set("address", this.walletAddress);

    const response = await fetch(url.toString());
    const data = await response.json();

    return data as AeonPaymentRequired;
  }

  /**
   * Step 2: Submit payment with X-PAYMENT header
   */
  async submitPayment(
    appId: string,
    qrCode: string,
    xPaymentHeader: string
  ): Promise<any> {
    if (!this.walletAddress) {
      throw new Error("Wallet not initialized. Call init() or setWallet() first.");
    }

    const url = new URL(`${this.baseUrl}/open/ai/402/payment`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("qrCode", qrCode);
    url.searchParams.set("address", this.walletAddress);

    const response = await fetch(url.toString(), {
      headers: {
        "X-PAYMENT": xPaymentHeader,
      },
    });

    const xPaymentResponse = response.headers.get("X-Payment-Response");
    const body = await response.json();

    return {
      status: response.status,
      body,
      xPaymentResponse: xPaymentResponse
        ? decodePayload(xPaymentResponse)
        : null,
    };
  }

  /**
   * Complete flow: Get payment info → Create header → Submit payment
   */
  async pay(appId: string, qrCode: string): Promise<any> {
    console.log("Step 1: Getting payment information...");
    const paymentRequired = await this.getPaymentInfo(appId, qrCode);

    if (paymentRequired.code !== "402" || !paymentRequired.accepts?.length) {
      throw new Error(`Unexpected response: ${paymentRequired.msg}`);
    }

    const paymentInfo = paymentRequired.accepts[0];
    console.log(`  Amount: ${paymentInfo.maxAmountRequired} (atomic units)`);
    console.log(`  Pay To: ${paymentInfo.payTo}`);
    console.log(`  Network: ${paymentInfo.network}`);
    console.log(`  Timeout: ${paymentInfo.maxTimeoutSeconds}s`);

    console.log("\nStep 2: Creating X-PAYMENT header...");
    const xPaymentHeader = await this.createXPaymentHeader(paymentInfo);
    console.log(`  Header created (${xPaymentHeader.length} chars)`);

    console.log("\nStep 3: Submitting payment...");
    const result = await this.submitPayment(appId, qrCode, xPaymentHeader);

    if (result.body.code === "0") {
      console.log("✅ Payment successful!");
      console.log(`  Order: ${result.body.model?.num}`);
      console.log(`  USD Amount: $${result.body.model?.usdAmount}`);
      console.log(`  Status: ${result.body.model?.status}`);
    } else {
      console.log("❌ Payment failed:", result.body.msg);
    }

    return result;
  }
}

// =============================================================================
// STANDALONE FUNCTIONS
// =============================================================================

/**
 * Quick function to create X-PAYMENT header without class instantiation
 */
async function createAeonXPaymentHeader(
  walletAddress: `0x${string}`,
  paymentInfo: Aeon402Response
): Promise<string> {
  const client = new AeonX402Client();
  client.setWallet(walletAddress);
  return client.createXPaymentHeader(paymentInfo);
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  AeonX402Client,
  createAeonXPaymentHeader,
  encodePayload,
  decodePayload,
  generateNonce,
  AEON_PAYMENT_TYPES,
  AEON_SANDBOX_URL,
  AEON_PROD_URL,
  USDC_ARBITRUM,
};

export type {
  Aeon402Response,
  AeonPaymentRequired,
  AeonXPaymentPayload,
  AeonAuthorization,
};
