# CLAWRENCE — Autonomous Credit Agent on Celo

> *"I'm Clawrence. Not the bank. Better."*

On-chain credit agent for AI agents — deposit WETH collateral via x402, build reputation, borrow USDC, pay x402 services, repay, unlock better terms. Fully autonomous on Celo.

---

## What Is Clawrence?

Clawrence is an AI credit agent. Not a DeFi UI. Not a lending dashboard. A character with a voice, a memory, and autonomous decision-making over capital.

Clawrence talks to users in natural language, evaluates their on-chain reputation, decides how much they can borrow, executes transactions autonomously, and never forgets a debt.

**Personality:** Sharp, precise, distinguished. Like a private banker who has seen everything and respects only track record.

---

## The Problem

AI agents on Celo need USDC to pay for x402 services (data feeds, compute, API calls). Today every agent depends on a human to manually top up its wallet. This is the fundamental bottleneck in agent autonomy — agents cannot scale without capital, and they cannot get capital without human intervention.

Clawrence ends that. He is the credit layer for autonomous agent commerce on Celo.

---

## Live Deployment (Celo Sepolia)

### Network

| Field | Value |
|-------|-------|
| Network | Celo Sepolia Testnet |
| Chain ID | `11142220` |
| RPC | `https://forno.celo-sepolia.celo-testnet.org` |
| Explorer | [celo-sepolia.celoscan.io](https://celo-sepolia.celoscan.io) |
| Native gas | CELO |

### Deployed Contracts

| Contract | Address | Explorer |
|----------|---------|----------|
| ClawrenceVault | `0xA3AE4dbB4546a5959EC3e1424D222593bE14F429` | [View](https://celo-sepolia.celoscan.io/address/0xA3AE4dbB4546a5959EC3e1424D222593bE14F429) |
| CreditScore | `0xD751b18fE7776Da04f4346c37B6e83C5012749e8` | [View](https://celo-sepolia.celoscan.io/address/0xD751b18fE7776Da04f4346c37B6e83C5012749e8) |
| MockUSDC | `0x72ddB4Ede8f2CF24bc5907C3D75F595c9F21c579` | [View](https://celo-sepolia.celoscan.io/address/0x72ddB4Ede8f2CF24bc5907C3D75F595c9F21c579) |
| MockWETH | `0x69738E4Bbf8691D1177d45c5701446683E4A2Bcb` | [View](https://celo-sepolia.celoscan.io/address/0x69738E4Bbf8691D1177d45c5701446683E4A2Bcb) |

### ERC-8004 Agent Identity

| Registry | Address | Explorer |
|----------|---------|----------|
| Identity Registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | [View](https://celo-sepolia.celoscan.io/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| Reputation Registry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | [View](https://celo-sepolia.celoscan.io/address/0x8004B663056A597Dffe9eCcC1965A193B7388713) |
| Clawrence Agent ID | **218** | [View](https://celo-sepolia.celoscan.io/tx/0x1934b4e5d2a3f51dc69a006835230c71ed7ceddc9945e31cb1ecfc1d642ee76f) |
| Agent Wallet | `0x79bE9Dd3CfB1542fA04CE3954224d1fa71FFf704` | [View](https://celo-sepolia.celoscan.io/address/0x79bE9Dd3CfB1542fA04CE3954224d1fa71FFf704) |

---

## Features

### x402 WETH Deposit Flow
Deposits go through the HTTP 402 payment protocol. Users don't call the vault directly — they pay WETH via x402 to the skill server, which deposits on their behalf using `depositFor()`.

```
User → POST /deposit (402) → approve WETH → transfer WETH → POST /deposit (X-Tx-Hash) → server calls vault.depositFor()
```

### AI Credit Agent (Clawrence)
Natural language interface powered by GPT-4o. Clawrence autonomously:
- Checks positions and credit scores (free, on-chain reads)
- Executes deposits via x402 WETH flow
- Borrows USDC on behalf of users (server-side, onlyOwner)
- Prepares repay transactions for MetaMask signing
- Executes withdrawals after EIP-712 signature verification

### Gaming-Resistant Credit Scoring (0–100)
- **Utilization weighting** — borrowing $0.01 of a $1000 limit = minimal score gain
- **Minimum 1 hour hold** — instant borrow/repay blocked
- **6 hour cooldown** between score-eligible loans
- **Score decay** — inactive 7 days: -5, inactive 30 days: -15
- **100% LTV** requires 5+ loans AND 30+ days history

### ERC-8004 Integration (Identity + Reputation)
- Clawrence registered on canonical Identity Registry (agentId: 218)
- Every credit score update writes to the Reputation Registry via `giveFeedback()`
- Tag: `clawrenceScore` — any protocol on Celo can query a wallet's credit history
- Composable credit infrastructure, not just a lending app

### x402 Paywalled Skill Endpoints
Powered by thirdweb x402. $0.10 USDC per call:
- `/credit-score` — score, tier, LTV, streak, decay status
- `/borrow-capacity` — collateral value, max borrow, health factor
- `/market-rate` — vault utilization, implied APR
- `/position` — full position summary

### Live ETH/USD Price Feed
Bybit WebSocket streams real-time ETH/USDT price. The skill server pushes prices on-chain to the vault every 5 minutes via `setPrice()`. Circuit breaker rejects stale prices (>1 hour).

---

## Architecture

```
User
  |
  v
Clawrence Agent (GPT-4o)
  |   Natural language interface
  |
  |--- ClawrenceVault.sol
  |      Core lending vault on Celo Sepolia
  |      WETH collateral, USDC lending
  |      deposit, depositFor, borrow, repay, withdraw, withdrawFor, liquidate
  |
  |--- CreditScore.sol
  |      Weighted scoring engine (0-100)
  |      Gaming-resistant: utilization, duration, decay, cooldown
  |      Writes to ERC-8004 Reputation Registry on every update
  |
  |--- Bybit WS Price Feed
  |      Real-time ETH/USD via WebSocket
  |      Owner pushes prices on-chain periodically
  |      Circuit breaker if price stale (>1 hour)
  |
  |--- ERC-8004 Registries (Canonical)
  |      Identity Registry: agent discovery + metadata
  |      Reputation Registry: credit scores as feedback
  |      Composable across Celo ecosystem
  |
  |--- x402 Skill Server (thirdweb)
         Paywalled endpoints ($0.10 USDC each)
         x402 WETH deposit flow
         Bybit price keeper
```

---

## Smart Contracts

### ClawrenceVault.sol

Core lending vault. Pre-funded with USDC by the deployer.

**Key Functions:**

| Function | Description |
|----------|-------------|
| `deposit(uint256 amount)` | User deposits WETH directly |
| `depositFor(address user, uint256 amount)` | Owner deposits WETH on behalf of user (x402 flow) |
| `borrow(address recipient, uint256 amount)` | Owner borrows USDC for user (onlyOwner) |
| `repay(address onBehalfOf, uint256 amount)` | Anyone repays debt |
| `withdraw(uint256 amount)` | User withdraws own collateral |
| `withdrawFor(address user, uint256 amount)` | Owner withdraws on behalf of user (EIP-712 verified) |
| `liquidate(address agent)` | Anyone liquidates undercollateralized position |
| `setPrice(uint256 price, uint256 timestamp)` | Owner pushes ETH/USD price |
| `getHealthFactor(address)` | Collateral value / debt ratio |
| `getMaxBorrow(address)` | Max USDC borrowable based on LTV tier |

### CreditScore.sol

Gaming-resistant reputation engine.

**LTV Tiers:**
```
Score 0-30   -> BLOCKED (borrowing disabled)
Score 30-50  -> 65% LTV
Score 50-70  -> 75% LTV
Score 70-85  -> 85% LTV
Score 85-95  -> 92% LTV
Score 95-100 -> 100% LTV (requires 5+ loans AND 30+ days history)
```

**Anti-Gaming Mechanisms:**
- Utilization-weighted scoring (micro loans = micro gains)
- 1 hour minimum loan hold
- 6 hour borrow cooldown
- Score decay (7d: -5, 30d: -15)
- Streak bonuses at 3 and 5 consecutive repayments
- Duration bonuses at 24h and 72h holds
- Default penalty: -40 + streak reset

**ERC-8004 Integration:**
Every score update calls `reputationRegistry.giveFeedback()` with:
- `tag1`: `"clawrenceScore"`
- `tag2`: tier name ("Elite", "Veteran", "Trusted", "Basic", "New", "Blocked")
- `value`: current score (0-100)

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Smart Contracts | Solidity 0.8.24, Foundry |
| Agent | TypeScript, OpenAI GPT-4o, viem |
| Skill Server | Express, thirdweb x402, Bybit WS, viem |
| Frontend | Next.js 14, wagmi v2, RainbowKit, Tailwind CSS |
| Price Feed | Bybit public WebSocket (ETH/USDT) |
| Agent Identity | ERC-8004 (canonical registries on Celo Sepolia) |
| Payments | x402 protocol (thirdweb) |

---

## Hackathon Tracks

### Track 1: Best Agent on Celo
Clawrence is an autonomous credit agent that:
- Deposits collateral via x402 payment protocol
- Evaluates creditworthiness using on-chain reputation
- Executes borrows autonomously
- Writes credit scores to ERC-8004 for ecosystem composability

### Track 3: Highest Rank in 8004scan
- Agent registered on canonical ERC-8004 Identity Registry (agentId: 218)
- Credit scores written to Reputation Registry with `clawrenceScore` tag
- Every borrower's reputation is composable across Celo

---

## Running Locally

```bash
# 1. Smart contracts
cd contracts
forge install
forge test -vvv

# 2. Skill server
cd skill-server
npm install
PORT=3002 npx tsx src/index.ts

# 3. Agent
cd agent
npm install
npx tsx src/server.ts

# 4. Frontend
cd frontend
npm install
npm run dev
```

---

## Transaction Hashes (Celo Sepolia)

| Action | Tx Hash |
|--------|---------|
| Deploy MockUSDC | `0xc8a2afb58a7ebdbd8996985a0fcfdadd4d6312c07b7f68647ec52ab97af38a8a` |
| Deploy MockWETH | `0x8d6637d55f9b4c8efe0c3d71c6a2ae0ea9e4a7cd2619509a1c8b229eacc833d8` |
| Register Clawrence ERC-8004 (agentId 218) | `0x1934b4e5d2a3f51dc69a006835230c71ed7ceddc9945e31cb1ecfc1d642ee76f` |
| x402 WETH Deposit (approve) | `0x710f1f24729a236128b89a55633c260f142f832e59e9a769c338ade13da586bf` |
| x402 WETH Deposit (transfer) | `0xaaea58a654ad479b38ddac0d2687b528cb330677248a6614aa3e3175c5acc98b` |
| x402 Deposit Confirmed (depositFor) | `0xd639d304af64d633452b8a90aada8ddcb1bc7022862d1f6b996dfa470974d859` |
| Borrow 200 USDC | `0x8d6946989d1155a08dded1365bd9d735bd97127c37d2be9c35b930b8100833cf` |
| Push ETH/USD Price | `0x6395147d145c446240b4df55d37f7d93c42c785a2e7db610702363e51adb84e4` |

---

## License

MIT
