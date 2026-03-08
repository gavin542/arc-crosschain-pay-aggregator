// Gateway Transfer (EIP-712 signed BurnIntent)
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import crypto from "crypto";
import {
  CAST_PRIVATE_KEY, CAST_ADDRESS,
  GATEWAY_API, GATEWAY_WALLET, GATEWAY_MINTER,
  USDC_SEPOLIA, USDC_ARC,
  DOMAINS,
} from "../config.mjs";

export function quote({ amount }) {
  const protocolFee = parseFloat(amount) * 0.00005; // 0.5 bps
  const gasFee = 2.0;
  const totalFee = protocolFee + gasFee;
  return {
    channel: "GATEWAY",
    estimatedTime: "1-2 minutes",
    estimatedTimeSec: 90,
    estimatedFee: totalFee.toFixed(6) + " USDC",
    estimatedFeeNum: totalFee,
    available: true,
    note: "Unified balance, needs prior Gateway deposit",
  };
}

function padAddress(addr) {
  return "0x" + addr.replace("0x", "").toLowerCase().padStart(64, "0");
}

export async function execute({ amount }) {
  // amount in USDC (human readable), convert to 6 decimals
  const amountRaw = Math.floor(parseFloat(amount) * 1e6).toString();

  // Step 1: Check Gateway balance
  const balRes = await fetch(`${GATEWAY_API}/v1/balances`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: "USDC",
      sources: [{ domain: DOMAINS.ETH_SEPOLIA, depositor: CAST_ADDRESS }],
    }),
  });
  const balData = await balRes.json();
  const balance = balData.balances?.[0]?.balance || "0";
  console.log(`    Gateway balance: ${balance} USDC`);

  const needed = parseFloat(amount) + 2.5; // amount + fees
  if (parseFloat(balance) < needed) {
    return {
      channel: "GATEWAY",
      state: "INSUFFICIENT_BALANCE",
      error: `Need ${needed} USDC in Gateway, have ${balance}`,
      txHash: null,
    };
  }

  // Step 2: Sign EIP-712 BurnIntent
  const account = privateKeyToAccount(CAST_PRIVATE_KEY);
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http() });
  const salt = "0x" + crypto.randomBytes(32).toString("hex");

  const message = {
    maxBlockHeight: 999999999n,
    maxFee: 3000000n,
    spec: {
      version: 1,
      sourceDomain: DOMAINS.ETH_SEPOLIA,
      destinationDomain: DOMAINS.ARC_TESTNET,
      sourceContract: padAddress(GATEWAY_WALLET),
      destinationContract: padAddress(GATEWAY_MINTER),
      sourceToken: padAddress(USDC_SEPOLIA),
      destinationToken: padAddress(USDC_ARC),
      sourceDepositor: padAddress(CAST_ADDRESS),
      destinationRecipient: padAddress(CAST_ADDRESS),
      sourceSigner: padAddress(CAST_ADDRESS),
      destinationCaller: "0x" + "0".repeat(64),
      value: BigInt(amountRaw),
      salt,
      hookData: "0x",
    },
  };

  const signature = await walletClient.signTypedData({
    domain: { name: "GatewayWallet", version: "1" },
    types: {
      TransferSpec: [
        { name: "version", type: "uint32" },
        { name: "sourceDomain", type: "uint32" },
        { name: "destinationDomain", type: "uint32" },
        { name: "sourceContract", type: "bytes32" },
        { name: "destinationContract", type: "bytes32" },
        { name: "sourceToken", type: "bytes32" },
        { name: "destinationToken", type: "bytes32" },
        { name: "sourceDepositor", type: "bytes32" },
        { name: "destinationRecipient", type: "bytes32" },
        { name: "sourceSigner", type: "bytes32" },
        { name: "destinationCaller", type: "bytes32" },
        { name: "value", type: "uint256" },
        { name: "salt", type: "bytes32" },
        { name: "hookData", type: "bytes" },
      ],
      BurnIntent: [
        { name: "maxBlockHeight", type: "uint256" },
        { name: "maxFee", type: "uint256" },
        { name: "spec", type: "TransferSpec" },
      ],
    },
    primaryType: "BurnIntent",
    message,
  });

  // Step 3: Submit to Gateway API
  const messageForApi = {
    maxBlockHeight: message.maxBlockHeight.toString(),
    maxFee: message.maxFee.toString(),
    spec: { ...message.spec, value: message.spec.value.toString() },
  };

  const transferRes = await fetch(`${GATEWAY_API}/v1/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ burnIntent: messageForApi, signature }]),
  });

  const transferData = await transferRes.json();
  const result = Array.isArray(transferData) ? transferData[0] : transferData;

  if (result?.attestation) {
    return {
      channel: "GATEWAY",
      state: "ATTESTATION_RECEIVED",
      attestation: result.attestation,
      operatorSig: result.signature || result.operatorSig,
      txHash: null,
      note: "Run gatewayMint on Arc to complete",
    };
  }

  return {
    channel: "GATEWAY",
    state: "SUBMITTED",
    response: result,
    txHash: null,
  };
}
