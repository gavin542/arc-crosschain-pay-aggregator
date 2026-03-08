// Direct Transfer on Arc Testnet (same-chain USDC transfer)
import { circleClient, WALLET1_ARC_ID, WALLET2_ADDRESS, USDC_ARC } from "../config.mjs";

export function quote({ amount }) {
  return {
    channel: "DIRECT",
    estimatedTime: "<1 second",
    estimatedTimeSec: 1,
    estimatedFee: "0.000000 USDC",
    estimatedFeeNum: 0,
    available: true,
    note: "Same-chain transfer, Arc only",
  };
}

export async function execute({ to, amount }) {
  const toAddr = to || WALLET2_ADDRESS;
  const tx = await circleClient.createTransaction({
    amount: [amount.toString()],
    destinationAddress: toAddr,
    tokenAddress: USDC_ARC,
    blockchain: "ARC-TESTNET",
    walletId: WALLET1_ARC_ID,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  return {
    channel: "DIRECT",
    state: tx.data?.state || "UNKNOWN",
    txHash: tx.data?.txHash || null,
    txId: tx.data?.id,
  };
}
