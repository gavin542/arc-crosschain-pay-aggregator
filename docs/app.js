const RPC = "https://rpc.testnet.arc.network";
const ROUTER = "0xaa42673dfb295335962a9D64d8C04126f0315bb4";
const ARC_CHAIN_ID = "0x4cef52";
const CHANNEL_NAMES = ["CCTP_FAST", "CCTP_STANDARD", "GATEWAY", "DIRECT"];
const DOMAIN_NAMES = { 0: "ETH Sepolia", 26: "Arc Testnet" };

let userAddress = null;

// ============ RPC Helpers ============
async function ethCall(to, data) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
  });
  return (await res.json()).result;
}

function pad32(v) {
  const hex = typeof v === "string" && v.startsWith("0x") ? v.slice(2) : BigInt(v).toString(16);
  return hex.padStart(64, "0");
}

function decodeUint(hex, offset = 0) {
  const s = hex.startsWith("0x") ? hex.slice(2) : hex;
  return BigInt("0x" + s.slice(offset, offset + 64));
}

function decodeAddr(hex, offset) {
  const s = hex.startsWith("0x") ? hex.slice(2) : hex;
  return "0x" + s.slice(offset + 24, offset + 64);
}

// Function selectors (cast sig verified)
const SEL_TOTAL = "0x005b4487"; // totalPayments()
const SEL_GET = "0x3280a836";   // getPayment(uint256)

// ============ Wallet ============
window.connectWallet = async function () {
  if (!window.ethereum) { alert("Please install MetaMask."); return; }
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    userAddress = accounts[0];
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_CHAIN_ID }] });
    } catch (e) {
      if (e.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{ chainId: ARC_CHAIN_ID, chainName: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: [RPC] }],
        });
      }
    }
    document.getElementById("connectBtn").textContent = "Connected";
    document.getElementById("connectBtn").classList.add("connected");
    document.getElementById("walletInfo").textContent = userAddress.slice(0, 6) + "..." + userAddress.slice(-4);
  } catch (e) { console.error(e); }
};

// ============ Quote Engine (client-side) ============
function getQuotes(amount, srcChain, dstChain) {
  const isCrossChain = srcChain !== dstChain;
  return [
    {
      channel: "CCTP_FAST",
      time: "8-20 sec",
      timeSec: 15,
      fee: Math.max(amount * 0.0008, 0.001),
      available: isCrossChain,
      note: "Fast finality via Circle attestation",
    },
    {
      channel: "CCTP_STANDARD",
      time: "15-19 min",
      timeSec: 1020,
      fee: 0,
      available: isCrossChain,
      note: "Zero fee, standard finality",
    },
    {
      channel: "GATEWAY",
      time: "1-2 min",
      timeSec: 90,
      fee: 2.0 + amount * 0.00005,
      available: isCrossChain,
      note: "Unified balance, needs prior deposit",
    },
    {
      channel: "DIRECT",
      time: "<1 sec",
      timeSec: 1,
      fee: 0,
      available: !isCrossChain,
      note: "Same-chain transfer",
    },
  ];
}

function sortQuotes(quotes, pref) {
  const avail = quotes.filter(q => q.available);
  if (pref === "fastest") avail.sort((a, b) => a.timeSec - b.timeSec);
  else if (pref === "cheapest") avail.sort((a, b) => a.fee - b.fee);
  else {
    const mt = Math.max(...avail.map(q => q.timeSec));
    const mf = Math.max(...avail.map(q => q.fee));
    avail.sort((a, b) => {
      const sa = (mt > 0 ? a.timeSec / mt : 0) * 0.5 + (mf > 0 ? a.fee / mf : 0) * 0.5;
      const sb = (mt > 0 ? b.timeSec / mt : 0) * 0.5 + (mf > 0 ? b.fee / mf : 0) * 0.5;
      return sa - sb;
    });
  }
  return avail;
}

window.getQuote = function () {
  const amount = parseFloat(document.getElementById("quoteAmount").value) || 1;
  const src = document.getElementById("srcChain").value;
  const dst = document.getElementById("dstChain").value;
  const pref = document.getElementById("preference").value;

  const quotes = getQuotes(amount, src, dst);
  const ranked = sortQuotes(quotes, pref);
  const bestChannel = ranked.length > 0 ? ranked[0].channel : null;

  let html = `<table><tr><th>Channel</th><th>Time</th><th>Fee</th><th>Note</th></tr>`;
  for (const q of quotes) {
    const isBest = q.channel === bestChannel;
    const cls = !q.available ? "unavailable" : isBest ? "recommended" : "";
    const badge = isBest ? '<span class="badge-rec">BEST</span>' : (!q.available ? '<span class="badge-na">N/A</span>' : "");
    html += `<tr class="${cls}">
      <td><strong>${q.channel}</strong>${badge}</td>
      <td>${q.time}</td>
      <td>${q.fee.toFixed(6)} USDC</td>
      <td>${q.note}</td>
    </tr>`;
  }
  html += "</table>";
  document.getElementById("quoteResult").innerHTML = html;
};

// ============ Payment History ============
async function loadHistory() {
  document.getElementById("routerAddr").textContent = ROUTER;
  try {
    const totalHex = await ethCall(ROUTER, SEL_TOTAL);
    if (!totalHex || totalHex === "0x") {
      document.getElementById("totalPayments").textContent = "0";
      document.getElementById("totalVolume").textContent = "0";
      return;
    }
    const total = Number(decodeUint(totalHex));
    document.getElementById("totalPayments").textContent = total;

    let totalVol = 0;
    const items = [];
    for (let i = 0; i < total; i++) {
      const data = SEL_GET + pad32(i);
      const result = await ethCall(ROUTER, data);
      if (!result || result === "0x") continue;
      const hex = result.startsWith("0x") ? result.slice(2) : result;

      const sender = "0x" + hex.slice(24, 64);
      const channel = Number(decodeUint(hex, 64));
      const amount = Number(decodeUint(hex, 128)) / 1e6;
      const srcDomain = Number(decodeUint(hex, 192));
      const dstDomain = Number(decodeUint(hex, 256));
      const txRef = "0x" + hex.slice(320, 384);
      const timestamp = Number(decodeUint(hex, 384));

      totalVol += amount;
      items.push({ id: i, sender, channel, amount, srcDomain, dstDomain, txRef, timestamp });
    }

    document.getElementById("totalVolume").textContent = totalVol.toFixed(2);

    const grid = document.getElementById("historyList");
    if (items.length === 0) {
      grid.innerHTML = '<p style="color:#6b7280;text-align:center;padding:1rem">No payments recorded yet.</p>';
      return;
    }

    grid.innerHTML = items.reverse().map(p => {
      const ch = CHANNEL_NAMES[p.channel] || "UNKNOWN";
      const src = DOMAIN_NAMES[p.srcDomain] || `Domain ${p.srcDomain}`;
      const dst = DOMAIN_NAMES[p.dstDomain] || `Domain ${p.dstDomain}`;
      const time = p.timestamp > 0 ? new Date(p.timestamp * 1000).toLocaleString() : "";
      return `<div class="history-item">
        <span class="channel">${ch}</span>
        <span class="route">${src} → ${dst}</span>
        <span class="amount">${p.amount.toFixed(6)} USDC</span>
        <span class="time">${time}</span>
      </div>`;
    }).join("");
  } catch (e) {
    console.error("Failed to load history:", e);
  }
}

// ============ Verify selectors then init ============
async function init() {
  // First verify selectors by trying the call
  try {
    await loadHistory();
  } catch (e) {
    console.error("Init error:", e);
  }
}

init();
