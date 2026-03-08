// CCTP v2 Fast Transfer via BridgeKit
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { CAST_PRIVATE_KEY, CAST_ADDRESS, WALLET1_ADDRESS } from "../config.mjs";
import dotenv from "dotenv";
dotenv.config();

const kit = new BridgeKit();

export function quote({ amount }) {
  const fee = parseFloat(amount) * 0.0008; // ~8 bps estimate
  return {
    channel: "CCTP_FAST",
    estimatedTime: "8-20 seconds",
    estimatedTimeSec: 15,
    estimatedFee: Math.max(fee, 0.001).toFixed(6) + " USDC",
    estimatedFeeNum: Math.max(fee, 0.001),
    available: true,
    note: "Fast finality via Circle attestation",
  };
}

export async function execute({ from, to, amount, usePrivateKey = true }) {
  let adapter;
  if (usePrivateKey) {
    adapter = createViemAdapterFromPrivateKey({ privateKey: CAST_PRIVATE_KEY });
  } else {
    adapter = createCircleWalletsAdapter({
      apiKey: process.env.CIRCLE_API_KEY,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET,
    });
  }

  const fromAddr = usePrivateKey ? undefined : (from || WALLET1_ADDRESS);
  const toAddr = to || CAST_ADDRESS;

  const result = await kit.bridge({
    from: { adapter, chain: "Ethereum_Sepolia", ...(fromAddr ? { address: fromAddr } : {}) },
    to: { adapter, chain: "Arc_Testnet", address: toAddr },
    token: "USDC",
    amount: amount.toString(),
  });

  return {
    channel: "CCTP_FAST",
    state: result.state,
    steps: result.steps?.map(s => `${s.name}: ${s.state} ${s.txHash || ""}`),
    txHash: result.steps?.find(s => s.txHash)?.txHash || null,
  };
}
