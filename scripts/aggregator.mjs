// Cross-chain payment aggregator - compare all channels
import { quote as cctpFastQuote } from "./channels/cctp-fast.mjs";
import { quote as cctpStdQuote } from "./channels/cctp-standard.mjs";
import { quote as gatewayQuote } from "./channels/gateway.mjs";
import { quote as directQuote } from "./channels/direct.mjs";

const channels = [cctpFastQuote, cctpStdQuote, gatewayQuote, directQuote];

export function getQuotes({ amount, srcChain = "ETH_SEPOLIA", dstChain = "ARC_TESTNET" }) {
  const quotes = [];
  for (const quoteFn of channels) {
    const q = quoteFn({ amount, srcChain, dstChain });
    // Direct only available for same-chain
    if (q.channel === "DIRECT" && srcChain !== dstChain) {
      q.available = false;
      q.note = "Only available for same-chain transfers";
    }
    // CCTP/Gateway not needed for same-chain
    if (q.channel !== "DIRECT" && srcChain === dstChain) {
      q.available = false;
      q.note = "Not needed for same-chain transfers";
    }
    quotes.push(q);
  }
  return quotes;
}

export function recommend(quotes, preference = "balanced") {
  const available = quotes.filter(q => q.available);
  if (available.length === 0) return null;

  if (preference === "fastest") {
    available.sort((a, b) => a.estimatedTimeSec - b.estimatedTimeSec);
  } else if (preference === "cheapest") {
    available.sort((a, b) => a.estimatedFeeNum - b.estimatedFeeNum);
  } else {
    // balanced: normalize and weight 50/50
    const maxTime = Math.max(...available.map(q => q.estimatedTimeSec));
    const maxFee = Math.max(...available.map(q => q.estimatedFeeNum));
    available.sort((a, b) => {
      const scoreA = (maxTime > 0 ? a.estimatedTimeSec / maxTime : 0) * 0.5
                   + (maxFee > 0 ? a.estimatedFeeNum / maxFee : 0) * 0.5;
      const scoreB = (maxTime > 0 ? b.estimatedTimeSec / maxTime : 0) * 0.5
                   + (maxFee > 0 ? b.estimatedFeeNum / maxFee : 0) * 0.5;
      return scoreA - scoreB;
    });
  }

  return available;
}

function printTable(quotes, recommended) {
  console.log("\n┌──────────────────┬─────────────────┬──────────────┬─────────┐");
  console.log("│ Channel          │ Time            │ Fee          │ Status  │");
  console.log("├──────────────────┼─────────────────┼──────────────┼─────────┤");
  for (const q of quotes) {
    const star = recommended && recommended[0]?.channel === q.channel ? " *" : "  ";
    const status = q.available ? "OK" + star : "N/A   ";
    const ch = q.channel.padEnd(16);
    const time = q.estimatedTime.padEnd(15);
    const fee = q.estimatedFee.padEnd(12);
    console.log(`│ ${ch} │ ${time} │ ${fee} │ ${status.padEnd(7)} │`);
  }
  console.log("└──────────────────┴─────────────────┴──────────────┴─────────┘");
  if (recommended) {
    console.log(`\n  * Recommended: ${recommended[0].channel} (${recommended[0].note})`);
  }
}

// Run standalone
const isMain = process.argv[1]?.endsWith("aggregator.mjs");
if (isMain) {
  const amount = process.argv[2] || "1";
  const srcChain = process.argv[3] || "ETH_SEPOLIA";
  const dstChain = process.argv[4] || "ARC_TESTNET";
  const preference = process.argv[5] || "balanced";

  console.log(`\n=== Cross-Chain Payment Aggregator ===`);
  console.log(`  Amount: ${amount} USDC`);
  console.log(`  Route:  ${srcChain} → ${dstChain}`);
  console.log(`  Preference: ${preference}`);

  const quotes = getQuotes({ amount: parseFloat(amount), srcChain, dstChain });
  const recommended = recommend(quotes, preference);
  printTable(quotes, recommended);
}

export { printTable };
