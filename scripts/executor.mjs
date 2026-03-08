// Execute a cross-chain payment and record on-chain
import { execute as cctpFastExec } from "./channels/cctp-fast.mjs";
import { execute as cctpStdExec } from "./channels/cctp-standard.mjs";
import { execute as gatewayExec } from "./channels/gateway.mjs";
import { execute as directExec } from "./channels/direct.mjs";
import { run, ROUTER_ADDRESS, DOMAINS } from "./config.mjs";

const executors = {
  CCTP_FAST: cctpFastExec,
  CCTP_STANDARD: cctpStdExec,
  GATEWAY: gatewayExec,
  DIRECT: directExec,
};

const channelEnum = { CCTP_FAST: "0", CCTP_STANDARD: "1", GATEWAY: "2", DIRECT: "3" };

export async function executePayment({ channel, amount, from, to, srcChain, dstChain }) {
  const execFn = executors[channel];
  if (!execFn) throw new Error(`Unknown channel: ${channel}`);

  console.log(`\n  Executing ${channel}: ${amount} USDC (${srcChain} → ${dstChain})...`);

  const result = await execFn({ from, to, amount });
  console.log(`  Result: ${result.state}`);
  if (result.steps) result.steps.forEach(s => console.log(`    ${s}`));
  if (result.error) console.log(`  Error: ${result.error}`);

  // Record on-chain (if router is deployed)
  if (ROUTER_ADDRESS) {
    const txRef = result.txHash
      ? result.txHash
      : "0x" + "0".repeat(64);
    const amountWei = Math.floor(parseFloat(amount) * 1e6).toString();

    await run(
      `Record payment on-chain`,
      ROUTER_ADDRESS,
      "recordPayment(uint8,uint256,uint32,uint32,bytes32)",
      [channelEnum[channel], amountWei, (DOMAINS[srcChain] || 0).toString(), (DOMAINS[dstChain] || 26).toString(), txRef]
    );
  }

  return result;
}
