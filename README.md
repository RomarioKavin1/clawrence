# Clawrence

> *"I'm Clawrence. Not the bank. Better."*

**Clawrence is an autonomous AI credit agent on Celo.** Not a DeFi UI. Not a lending dashboard. A character with a voice, a memory, and autonomous decision-making over capital.

Clawrence talks to users in natural language, evaluates their on-chain reputation, decides how much they can borrow, executes transactions autonomously, and never forgets a debt.

---

## Pitch

**[View the Clawrence Pitch Deck](https://pitch.com/v/clawrence-23igm7)**

---

## The Problem

AI agents on Celo need USDC to pay for x402 services — data feeds, compute, API calls. Today every agent depends on a human to manually top up its wallet. This is the fundamental bottleneck in agent autonomy.

Agents cannot scale without capital. They cannot get capital without human intervention.

**Clawrence ends that.** He is the credit layer for autonomous agent commerce on Celo.

---

## What Clawrence Does

- Evaluates on-chain reputation via a gaming-resistant credit scoring engine (0–100)
- Lends USDC against WETH collateral with dynamic LTV tiers based on score
- Executes deposits, borrows, repayments, and liquidations autonomously
- Writes every borrower's credit history to the ERC-8004 identity registry — composable across all Celo protocols
- Monetizes its own data endpoints via x402 micropayments (the same USDC it lends)

---

## Deployed Contracts — Celo Sepolia

| Contract | Address | Explorer |
|---|---|---|
| ClawrenceVault | `<pending deployment>` | [View](https://celo-sepolia.celoscan.io) |
| CreditScore | `<pending deployment>` | [View](https://celo-sepolia.celoscan.io) |
| USDC | `<pending deployment>` | [View](https://celo-sepolia.celoscan.io) |
| Price Feed | `<pending deployment>` | [View](https://celo-sepolia.celoscan.io) |
| ERC-8004 Identity Registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | [View](https://celo-sepolia.celoscan.io/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| ERC-8004 Reputation Registry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | [View](https://celo-sepolia.celoscan.io/address/0x8004B663056A597Dffe9eCcC1965A193B7388713) |

---

## Network

| Detail | Value |
|---|---|
| Network | Celo Sepolia |
| Chain ID | 11142220 |
| RPC | `https://forno.celo-sepolia.celo-testnet.org` |
| Explorer | `https://celo-sepolia.celoscan.io` |
| Native Gas | CELO |

---

## Architecture

```
User
  |
  v
Clawrence Agent (OpenClaw)
  |   Natural language interface
  |
  |---> ClawrenceVault.sol       Core lending vault — deposit, borrow, repay, liquidate
  |---> CreditScore.sol          Weighted on-chain scoring engine (0–100)
  |---> Price Feed               ETH/USD via Bybit WS, owner-pushed on-chain
  |---> ERC-8004 Registry        Agent identity — composable credit history on Celo
  `---> x402 Skill Server        3 paywalled endpoints at $0.01 USDC each
```

---

## Smart Contracts

### ClawrenceVault.sol

Core lending vault. Pre-funded with test USDC by the deployer.

| Function | Description |
|---|---|
| `deposit(uint256 amount)` | Accepts WETH (ERC-20 transferFrom), records collateral balance |
| `borrow(uint256 amount)` | Score >30 required, health factor >=1.2 post-borrow, 6-hour cooldown |
| `repay(uint256 amount)` | Min 1-hour hold required, triggers score update on repayment |
| `liquidate(address agent)` | Anyone can call if health factor <1.0, seizes collateral, penalizes score |
| `getHealthFactor(address)` | Returns `collateralValueUSD * 100 / debt` — below 100 = undercollateralized |
| `getMaxBorrow(address)` | Returns `collateralValueUSD * LTV / 100` based on score tier |
| `getCollateralValueUSD(address)` | Live collateral value via price feed |

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

## Price Feed Integration

Owner-pushed ETH/USD price feed via Bybit WebSocket. Circuit breaker rejects stale prices older than 1 hour.

```solidity
interface IClawrencePriceFeed {
    function getETHUSDPrice() external view returns (uint256 price);
    function pushPrice(uint256 price) external; // onlyOwner
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

This makes Clawrence credit scores **composable** — any protocol on Celo can query a wallet's Clawrence reputation. Clawrence becomes credit infrastructure for the ecosystem, not just a lending app.

---

## x402 Skill Server

Three paywalled data endpoints, each costing $0.01 USDC.

| Endpoint | Description |
|---|---|
| `GET /credit-score?address=0x...` | Score, tier, LTV, streak, decay status |
| `GET /borrow-capacity?address=0x...` | Collateral value, max borrow, current debt, health factor |
| `GET /market-rate` | Total deposited, total borrowed, utilization %, implied APR |

**Stack:** TypeScript, Express, thirdweb x402 middleware, Viem, Railway

**Self-referential design:** The skill server requires x402 USDC payments — the same USDC Clawrence lends. Agents borrow from Clawrence to pay Clawrence's own endpoints. Closed autonomous loop.

---

## Clawrence Agent (OpenClaw)

**Personality:** Sharp, precise, distinguished. Like a private banker who has seen everything and respects only track record. Not friendly and bubbly. Not cold and robotic.

**Supported commands:**

```
"What's my credit score?"       -> score, tier, LTV, streak
"How much can I borrow?"        -> max borrow via price feed
"Deposit [amount] WETH"         -> executes approve + deposit()
"Borrow [amount] USDC"          -> validates + executes borrow()
"Repay my loan"                 -> executes repay(), shows updated score
"Check my health factor"        -> warns if approaching liquidation
"Pay for market rate"           -> hits x402 endpoint, pays $0.01 USDC
"Show me the leaderboard"       -> top scores from CreditScore.sol
"What happens if I default?"    -> explains -40 penalty and recovery path
"How do I improve my score?"    -> utilization, duration, streak, decay explanation
```

*"— Clawrence"*

---

## Frontend

**Stack:** Next.js 14 App Router, Tailwind CSS, wagmi v2, viem, RainbowKit, Vercel

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
| 95–100 | Elite |
| 85–95 | Veteran |
| 70–85 | Trusted |
| 50–70 | Basic |
| 30–50 | New |
| 0–30 | Blocked |

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
forge script script/Deploy.s.sol --rpc-url celo --broadcast --verify
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
CELO_RPC=https://forno.celo-sepolia.celo-testnet.org
IDENTITY_REGISTRY=0x8004A818BFB912233c491871b3d84c89A494BD9e
REPUTATION_REGISTRY=0x8004B663056A597Dffe9eCcC1965A193B7388713
```

### Skill Server
```
THIRDWEB_CLIENT_ID=
THIRDWEB_SECRET_KEY=
VAULT_ADDRESS=
CREDIT_SCORE_ADDRESS=
CELO_RPC=https://forno.celo-sepolia.celo-testnet.org
USDC_ADDRESS=
WETH_ADDRESS=
RECEIVER_ADDRESS=
PORT=3001
```

### Frontend
```
NEXT_PUBLIC_VAULT_ADDRESS=
NEXT_PUBLIC_CREDIT_SCORE_ADDRESS=
NEXT_PUBLIC_CHAIN_ID=11142220
NEXT_PUBLIC_SKILL_SERVER_URL=http://localhost:3000
NEXT_PUBLIC_USDC_ADDRESS=
NEXT_PUBLIC_WETH_ADDRESS=
```

---

## Deployment Order

1. Get CELO testnet gas from the Celo Sepolia faucet
2. Deploy `ClawrenceVault.sol` and `CreditScore.sol` on Celo Sepolia
3. Pre-fund `ClawrenceVault` with test USDC
4. Verify both contracts on Celoscan
5. Deploy price feed contract, start Bybit WS price pusher
6. Deploy skill server to Railway, set env vars, confirm 402 responses
7. Deploy frontend to Vercel, set env vars, test wallet connection on chain 11142220
8. Configure OpenClaw with Clawrence personality prompt and vault skills
9. Register Clawrence identity on ERC-8004 Identity Registry
10. Update Clawrence ERC-8004 metadata URI on registry

---

## Built With

- [Celo](https://celo.org) — EVM-compatible L1
- [ERC-8004](https://github.com/goat-sdk/erc-8004) — agent identity standard
- [thirdweb](https://thirdweb.com) — x402 payment middleware
- [OpenZeppelin Contracts](https://openzeppelin.com/contracts)
- [Foundry](https://getfoundry.sh)
- [wagmi](https://wagmi.sh) + [RainbowKit](https://rainbowkit.com)
