// CCTP v2 Standard Transfer via BridgeKit (Circle managed wallets)
import { BridgeKit } from "@circle-fin/bridge-kit";
import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";
import { WALLET1_ADDRESS } from "../config.mjs";
import dotenv from "dotenv";
dotenv.config();

const kit = new BridgeKit();

export function quote({ amount }) {
  return {
    channel: "CCTP_STANDARD",
    estimatedTime: "15-19 minutes",
    estimatedTimeSec: 1020,
    estimatedFee: "0.000000 USDC",
    estimatedFeeNum: 0,
    available: true,
    note: "Zero fee, standard finality (~15 min)",
  };
}

export async function execute({ from, to, amount }) {
  const adapter = createCircleWalletsAdapter({
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
  });

  const fromAddr = from || WALLET1_ADDRESS;
  const toAddr = to || WALLET1_ADDRESS;

  const result = await kit.bridge({
    from: { adapter, chain: "Ethereum_Sepolia", address: fromAddr },
    to: { adapter, chain: "Arc_Testnet", address: toAddr },
    token: "USDC",
    amount: amount.toString(),
  });

  return {
    channel: "CCTP_STANDARD",
    state: result.state,
    steps: result.steps?.map(s => `${s.name}: ${s.state} ${s.txHash || ""}`),
    txHash: result.steps?.find(s => s.txHash)?.txHash || null,
  };
}
