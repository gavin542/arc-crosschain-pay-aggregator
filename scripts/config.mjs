BigInt.prototype.toJSON = function () { return this.toString(); };

import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import dotenv from "dotenv";
dotenv.config();

export const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

// Wallets
export const CAST_PRIVATE_KEY = process.env.CAST_PRIVATE_KEY;
export const CAST_ADDRESS = process.env.CAST_ADDRESS;
export const WALLET1_ADDRESS = process.env.WALLET1_ADDRESS;
export const WALLET1_ARC_ID = process.env.WALLET1_ARC_ID;
export const WALLET1_SEPOLIA_ID = process.env.WALLET1_SEPOLIA_ID;
export const WALLET2_ADDRESS = process.env.WALLET2_ADDRESS;
export const SCA_WALLET_ID = process.env.SCA_WALLET_ID;
export const SCA_WALLET_ADDRESS = process.env.SCA_WALLET_ADDRESS;

// Contracts
export const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS;
export const ARC_RPC = process.env.ARC_RPC || "https://rpc.testnet.arc.network";

// USDC addresses
export const USDC_ARC = "0x3600000000000000000000000000000000000000";
export const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

// Gateway
export const GATEWAY_API = "https://gateway-api-testnet.circle.com";
export const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
export const GATEWAY_MINTER = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

// Domain IDs
export const DOMAINS = {
  "ETH_SEPOLIA": 0,
  "ARC_TESTNET": 26,
};

// Channel labels
export const CHANNEL_NAMES = ["CCTP_FAST", "CCTP_STANDARD", "GATEWAY", "DIRECT"];

// Helper: execute contract call via Circle SCA wallet
export async function run(label, contractAddress, abiFunctionSignature, abiParameters) {
  console.log(`  [TX] ${label}`);
  try {
    const tx = await circleClient.createContractExecutionTransaction({
      walletId: SCA_WALLET_ID,
      contractAddress,
      abiFunctionSignature,
      abiParameters,
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });
    console.log(`    State: ${tx.data?.state}, ID: ${tx.data?.id}`);
    return tx.data;
  } catch (e) {
    console.error(`    Failed:`, e?.response?.data || e?.message);
    return null;
  }
}
