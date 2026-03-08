// Check PaymentRouter on-chain status
import { createPublicClient, http } from "viem";
import dotenv from "dotenv";
dotenv.config();

const ROUTER = process.env.ROUTER_ADDRESS;
const RPC = process.env.ARC_RPC || "https://rpc.testnet.arc.network";
const CHANNEL_NAMES = ["CCTP_FAST", "CCTP_STANDARD", "GATEWAY", "DIRECT"];

const abi = [
  { name: "totalPayments", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    name: "getPayment", type: "function", stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "sender", type: "address" },
        { name: "channel", type: "uint8" },
        { name: "amount", type: "uint256" },
        { name: "srcDomain", type: "uint32" },
        { name: "dstDomain", type: "uint32" },
        { name: "txRef", type: "bytes32" },
        { name: "timestamp", type: "uint256" },
      ],
    }],
  },
];

const client = createPublicClient({ transport: http(RPC) });

const total = await client.readContract({ address: ROUTER, abi, functionName: "totalPayments" });
console.log(`=== PaymentRouter Status ===`);
console.log(`Contract: ${ROUTER}`);
console.log(`Total Payments: ${total}\n`);

for (let i = 0; i < Number(total); i++) {
  const p = await client.readContract({ address: ROUTER, abi, functionName: "getPayment", args: [BigInt(i)] });
  const channel = CHANNEL_NAMES[p.channel] || `UNKNOWN(${p.channel})`;
  const amountUSDC = (Number(p.amount) / 1e6).toFixed(6);
  const time = new Date(Number(p.timestamp) * 1000).toLocaleString();
  console.log(`#${i} | ${channel.padEnd(14)} | ${amountUSDC} USDC | Domain ${p.srcDomain}→${p.dstDomain} | ${time}`);
  console.log(`     Sender: ${p.sender} | TxRef: ${p.txRef}`);
}
