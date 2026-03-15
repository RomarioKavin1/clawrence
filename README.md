# Clawrence

> *"I'm Clawrence. Not the bank. Better."*

**Clawrence is an autonomous AI credit agent on GOAT Network.** Not a DeFi UI. Not a lending dashboard. A character with a voice, a memory, and autonomous decision-making over capital.

Clawrence talks to users in natural language, evaluates their on-chain reputation, decides how much they can borrow, executes transactions autonomously, and never forgets a debt.

---

## Pitch

**[View the Clawrence Pitch Deck →](https://pitch.com/v/clawrence-23igm7)**

---

## The Problem

AI agents on GOAT Network need USDC to pay for x402 services — data feeds, compute, API calls. Today every agent depends on a human to manually top up its wallet. This is the fundamental bottleneck in agent autonomy.

Agents cannot scale without capital. They cannot get capital without human intervention.

**Clawrence ends that.** He is the credit layer for autonomous agent commerce on GOAT Network.

---

## What Clawrence Does

- Evaluates on-chain reputation via a gaming-resistant credit scoring engine (0–100)
- Lends USDC against WETH collateral with dynamic LTV tiers based on score
- Executes deposits, borrows, repayments, and liquidations autonomously
- Writes every borrower's credit history to the ERC-8004 identity registry — composable across all GOAT protocols
- Monetizes its own data endpoints via x402 micropayments (the same USDC it lends)

---

## Deployed Contracts — GOAT Testnet3

| Contract | Address | Explorer |
|---|---|---|
| ClawrenceVault | `0x9cBF61D82adf61417cD2e513629fD8aABAD85B32` | [View ↗](https://explorer.testnet3.goat.network/address/0x9cBF61D82adf61417cD2e513629fD8aABAD85B32) |
| CreditScore | `0x65617c310059961f68916Cb592Aa9cec3B404863` | [View ↗](https://explorer.testnet3.goat.network/address/0x65617c310059961f68916Cb592Aa9cec3B404863) |
| USDC | `0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1` | [View ↗](https://explorer.testnet3.goat.network/address/0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1) |
| DIA Oracle | `0xef094fff94a7954ba3e5ed81dbafe7350e7e9720` | [View ↗](https://explorer.testnet3.goat.network/address/0xef094fff94a7954ba3e5ed81dbafe7350e7e9720) |
| ERC-8004 Registry | `0x556089008Fc0a60cD09390Eca93477ca254A5522` | [View ↗](https://explorer.testnet3.goat.network/address/0x556089008Fc0a60cD09390Eca93477ca254A5522) |

---

## Network

| Detail | Value |
|---|---|
| Network | GOAT Testnet3 |
| Chain ID | 48816 |
| RPC | `https://rpc.testnet3.goat.network` |
| Explorer | `https://explorer.testnet3.goat.network` |
| Faucet | `https://bridge.testnet3.goat.network/faucet` |
| USDC | `0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1` |
| USDT | `0xdce0af57e8f2ce957b3838cd2a2f3f3677965dd3` |
| Native Gas | BTC (wrapped) |

---

## Architecture

```
User
  │
  ▼
Clawrence Agent (OpenClaw)
  │   Natural language interface
  │
  ├──▶ ClawrenceVault.sol       Core lending vault — deposit, borrow, repay, liquidate
  ├──▶ CreditScore.sol          Weighted on-chain scoring engine (0–100)
  ├──▶ DIA Oracle               Live ETH/USD price feed, circuit breaker if stale >1 hour
  ├──▶ ERC-8004 Registry        Agent identity — composable credit history on GOAT
  └──▶ x402 Skill Server        3 paywalled endpoints at $0.01 USDC each
```

---

## Smart Contracts

### ClawrenceVault.sol

Core lending vault. Pre-funded with test USDC by the deployer.

| Function | Description |
|---|---|
| `deposit(uint256 amount)` | Accepts WETH, records collateral balance |
| `borrow(uint256 amount)` | Score >30 required, health factor ≥1.2 post-borrow, 6-hour cooldown |
| `repay(uint256 amount)` | Min 1-hour hold required, triggers score update on repayment |
| `liquidate(address agent)` | Anyone can call if health factor <1.0, seizes collateral, penalizes score |
| `getHealthFactor(address)` | Returns `collateralValueUSD * 100 / debt` — below 100 = undercollateralized |
| `getMaxBorrow(address)` | Returns `collateralValueUSD * LTV / 100` based on score tier |
| `getCollateralValueUSD(address)` | Live collateral value via DIA oracle |

### CreditScore.sol

Gaming-resistant reputation engine. Scores start at 50 and move based on real borrowing behavior.

**LTV Tiers by Score:**

| Score Range | Tier | LTV |
|---|---|---|
| 0–30 | Blocked | Borrowing disabled |
| 30–50 | New | 65% |
| 50–70 | Basic | 75% |
| 70–85 | Trusted | 85% |
| 85–95 | Veteran | 92% |
| 95–100 | Elite | 100% (requires 5+ loans AND 30+ days history) |

**Score Gains (on repayment):**

| Utilization | Base Gain |
|---|---|
| <10% | +2 (micro loan — anti-farming) |
| 10–50% | +5 |
| 50–80% | +10 |
| >80% | +15 |

Duration bonuses: +3 if held >24h, +5 if held >72h

Streak bonuses: +5 at 3 consecutive repayments, +10 at 5

**Score Penalties:**

| Event | Penalty |
|---|---|
| Late repayment (>30 days) | -15 |
| Health factor dipped below 1.2 | -5 |
| Liquidation / default | -40, streak reset |
| Inactive 7 days | -5 (decay) |
| Inactive 30 days | -15 (decay) |

**Why Gaming-Resistant:**
- Micro borrows earn negligible score (utilization-weighted)
- Instant repay doesn't trigger score update (1-hour min hold)
- 6-hour cooldown between score-eligible loans
- Decay prevents farming to 100 then waiting to drain the vault
- 100% LTV requires 5+ loans AND 30+ days of history — time-locked regardless of score

---

## Oracle Integration (DIA)

Live ETH/USD price feeds on GOAT Testnet3. Circuit breaker rejects stale prices older than 1 hour.

```solidity
interface IDIAOracle {
    function getValue(string memory key)
        external view returns (uint128 price, uint128 timestamp);
}
```

---

## ERC-8004 Integration

Clawrence has his own agent identity registered on the ERC-8004 canonical registry (agentId ERC-721 NFT, `x402Support: true`).

After every score update, the borrower's credit profile is written to the registry:

```json
{
  "name": "Agent 0x1234...",
  "clawrenceScore": 72,
  "clawrenceTier": "Trusted",
  "totalLoans": 5,
  "totalRepaid": "210 USDC",
  "consecutiveRepayments": 3,
  "lastUpdated": "<block timestamp>"
}
```

This makes Clawrence credit scores **composable** — any protocol on GOAT can query a wallet's Clawrence reputation. Clawrence becomes credit infrastructure for the ecosystem, not just a lending app.

---

## x402 Skill Server

Three paywalled data endpoints, each costing $0.01 USDC.

| Endpoint | Description |
|---|---|
| `GET /credit-score?address=0x...` | Score, tier, LTV, streak, decay status |
| `GET /borrow-capacity?address=0x...` | Collateral value, max borrow, current debt, health factor |
| `GET /market-rate` | Total deposited, total borrowed, utilization %, implied APR |

**Stack:** TypeScript · Express · goatx402-sdk-server · Viem · Railway

**Self-referential design:** The skill server requires x402 USDC payments — the same USDC Clawrence lends. Agents borrow from Clawrence to pay Clawrence's own endpoints. Closed autonomous loop.

---

## Clawrence Agent (OpenClaw)

**Personality:** Sharp, precise, distinguished. Like a private banker who has seen everything and respects only track record. Not friendly and bubbly. Not cold and robotic.

**Supported commands:**

```
"What's my credit score?"       → score, tier, LTV, streak
"How much can I borrow?"        → max borrow via DIA oracle
"Deposit [amount] WETH"         → executes deposit()
"Borrow [amount] USDC"          → validates + executes borrow()
"Repay my loan"                 → executes repay(), shows updated score
"Check my health factor"        → warns if approaching liquidation
"Pay for market rate"           → hits x402 endpoint, pays $0.01 USDC
"Show me the leaderboard"       → top scores from CreditScore.sol
"What happens if I default?"    → explains -40 penalty and recovery path
"How do I improve my score?"    → utilization, duration, streak, decay explanation
```

*"— Clawrence"*

---

## Frontend

**Stack:** Next.js 14 App Router · Tailwind CSS · wagmi v2 · viem · RainbowKit · Vercel

**Pages:**

| Route | Description |
|---|---|
| `/` | Dashboard — Clawrence chat + live position panel (collateral, debt, health factor, score) |
| `/vault` | Direct actions — deposit WETH, borrow USDC, repay |
| `/leaderboard` | Live agent credit rankings, refreshes every 30s |
| `/identity` | ERC-8004 agent cards for Clawrence and connected wallet |

**Tier badges on leaderboard:**

| Score | Badge |
|---|---|
| 95–100 | ⭐ Elite |
| 85–95 | 🔷 Veteran |
| 70–85 | ✓ Trusted |
| 50–70 | Basic |
| 30–50 | New |
| 0–30 | ⚠️ Blocked |

---

## Project Structure

```
clawrence/
├── contracts/          Foundry — ClawrenceVault.sol, CreditScore.sol
├── frontend/           Next.js 14 frontend
├── skill-server/       TypeScript x402 skill server
├── agent/              OpenClaw agent config
└── docs/               Additional documentation
```

---

## Local Setup

### Contracts

```bash
cd contracts
forge install
forge test -vvv
forge script script/Deploy.s.sol --rpc-url goat --broadcast --verify
```

### Skill Server

```bash
cd skill-server
npm install
cp .env.example .env   # fill in credentials
npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in contract addresses
npm run dev
```

---

## Environment Variables

### Contracts
```
PRIVATE_KEY=
GOAT_RPC=https://rpc.testnet3.goat.network
DIA_ORACLE_ADDRESS=0xef094fff94a7954ba3e5ed81dbafe7350e7e9720
ERC8004_REGISTRY=0x556089008Fc0a60cD09390Eca93477ca254A5522
VAULT_ADDRESS=0x9cBF61D82adf61417cD2e513629fD8aABAD85B32
CREDIT_SCORE_ADDRESS=0x65617c310059961f68916Cb592Aa9cec3B404863
USDC_ADDRESS=0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1
```

### Skill Server
```
GOATX402_API_URL=https://x402-api-lx58aabp0r.testnet3.goat.network
GOATX402_MERCHANT_ID=clawrence
GOATX402_API_KEY=
GOATX402_API_SECRET=
VAULT_ADDRESS=0x9cBF61D82adf61417cD2e513629fD8aABAD85B32
CREDIT_SCORE_ADDRESS=0x65617c310059961f68916Cb592Aa9cec3B404863
USDC_ADDRESS=0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1
GOAT_RPC=https://rpc.testnet3.goat.network
```

### Frontend
```
NEXT_PUBLIC_VAULT_ADDRESS=0x9cBF61D82adf61417cD2e513629fD8aABAD85B32
NEXT_PUBLIC_CREDIT_SCORE_ADDRESS=0x65617c310059961f68916Cb592Aa9cec3B404863
NEXT_PUBLIC_CHAIN_ID=48816
NEXT_PUBLIC_SKILL_SERVER_URL=http://localhost:3000
```

---

## Deployment Order

1. DM `@goathackbot` — receive `.env` credentials, test USDC, ERC-8004 agentId for Clawrence
2. Get BTC gas from the faucet: `https://bridge.testnet3.goat.network/faucet`
3. Deploy `ClawrenceVault.sol` and `CreditScore.sol` on GOAT Testnet3
4. Pre-fund `ClawrenceVault` with test USDC from goathackbot funds
5. Verify both contracts on the explorer
6. Find DIA oracle address on explorer, set in vault config
7. Deploy skill server to Railway, set env vars, confirm 402 responses
8. Deploy frontend to Vercel, set env vars, test wallet connection on chain 48816
9. Configure OpenClaw with Clawrence personality prompt and vault skills
10. Update Clawrence ERC-8004 metadata URI on registry

---

## Built With

- [GOAT Network](https://goat.network) — L2 on Bitcoin
- [DIA Oracle](https://diadata.org) — live price feeds on GOAT Testnet3
- [ERC-8004](https://github.com/goat-sdk/erc-8004) — agent identity standard
- [goatx402-sdk-server](https://github.com/goat-sdk/goatx402) — x402 payment middleware
- [OpenZeppelin Contracts](https://openzeppelin.com/contracts)
- [Foundry](https://getfoundry.sh)
- [wagmi](https://wagmi.sh) + [RainbowKit](https://rainbowkit.com)
