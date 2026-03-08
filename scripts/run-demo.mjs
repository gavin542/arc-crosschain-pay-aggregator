// One-click demo: show quotes for all scenarios + execute Direct transfer
import { getQuotes, recommend, printTable } from "./aggregator.mjs";
import { executePayment } from "./executor.mjs";

console.log("╔════════════════════════════════════════════╗");
console.log("║  Cross-Chain Pay Aggregator - Full Demo    ║");
console.log("╚════════════════════════════════════════════╝");

// === Scenario 1: Cross-chain ETH Sepolia → Arc ===
console.log("\n\n=== Scenario 1: Cross-chain (ETH Sepolia → Arc Testnet) ===");
console.log("Amount: 5 USDC\n");

const crossQuotes = getQuotes({ amount: 5, srcChain: "ETH_SEPOLIA", dstChain: "ARC_TESTNET" });
const crossRec = recommend(crossQuotes, "balanced");
printTable(crossQuotes, crossRec);

console.log("\n--- By preference ---");
const fastest = recommend(crossQuotes, "fastest");
console.log(`  Fastest:  ${fastest[0].channel} (${fastest[0].estimatedTime})`);
const cheapest = recommend(crossQuotes, "cheapest");
console.log(`  Cheapest: ${cheapest[0].channel} (${cheapest[0].estimatedFee})`);
console.log(`  Balanced: ${crossRec[0].channel}`);

// === Scenario 2: Same-chain Arc → Arc ===
console.log("\n\n=== Scenario 2: Same-chain (Arc → Arc) ===");
console.log("Amount: 0.1 USDC\n");

const sameQuotes = getQuotes({ amount: 0.1, srcChain: "ARC_TESTNET", dstChain: "ARC_TESTNET" });
const sameRec = recommend(sameQuotes, "balanced");
printTable(sameQuotes, sameRec);

// === Scenario 3: Different amounts ===
console.log("\n\n=== Scenario 3: Fee comparison by amount ===");
for (const amt of [0.01, 1, 10, 100, 1000]) {
  const q = getQuotes({ amount: amt, srcChain: "ETH_SEPOLIA", dstChain: "ARC_TESTNET" });
  const rec = recommend(q, "cheapest");
  const fast = q.find(x => x.channel === "CCTP_FAST");
  const std = q.find(x => x.channel === "CCTP_STANDARD");
  const gw = q.find(x => x.channel === "GATEWAY");
  console.log(`  ${String(amt).padStart(7)} USDC → Best: ${rec[0].channel.padEnd(14)} | Fast: ${fast.estimatedFee} | Std: ${std.estimatedFee} | GW: ${gw.estimatedFee}`);
}

// === Execute: Direct transfer on Arc (produces on-chain tx) ===
console.log("\n\n=== Executing Direct Transfer (Arc → Arc, 0.01 USDC) ===");
try {
  const result = await executePayment({
    channel: "DIRECT",
    amount: "0.01",
    srcChain: "ARC_TESTNET",
    dstChain: "ARC_TESTNET",
  });
  console.log("  Final state:", result.state);
} catch (e) {
  console.error("  Execution failed:", e?.response?.data?.message || e.message);
}

console.log("\n\n╔════════════════════════════════════════════╗");
console.log("║              Demo Complete!                ║");
console.log("╚════════════════════════════════════════════╝");
