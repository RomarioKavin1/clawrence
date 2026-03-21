# x402 WETH Deposit Flow

## Overview

Replace direct contract deposits with an x402-style flow through the skill server. Users pay WETH via a custom HTTP 402 pattern to a `/deposit` endpoint. The server verifies the transfer on-chain and calls `vault.depositFor()` to credit collateral to the user.

## Contract Change

Add to `ClawrenceVault.sol`:

```solidity
/// @notice Owner deposits WETH on behalf of a user (used by skill server x402 flow)
function depositFor(address user, uint256 amount) external onlyOwner nonReentrant {
    if (amount == 0) revert ZeroAmount();
    weth.safeTransferFrom(msg.sender, address(this), amount);
    collateral[user] += amount;
    emit Deposited(user, amount);
}
```

- `onlyOwner` — only the skill server wallet (vault owner) can call it
- WETH is transferred from the server wallet (which received it from the user)
- Collateral is credited to `user`, not `msg.sender`

## Skill Server — `/deposit` Route

### Flow

```
Client                          Server
  |                                |
  |  POST /deposit                 |
  |  X-From-Address: 0xUser       |
  |  ?amount=1.0                   |
  |------------------------------->|
  |                                |
  |  HTTP 402                      |
  |  {token, payTo, amountWei}     |
  |<-------------------------------|
  |                                |
  |  [approve WETH to payTo]       |
  |  [transfer WETH to payTo]      |
  |                                |
  |  POST /deposit                 |
  |  X-From-Address: 0xUser       |
  |  X-Tx-Hash: 0xabc...          |
  |  ?amount=1.0                   |
  |------------------------------->|
  |                                |
  |  [verify transfer on-chain]    |
  |  [approve WETH to vault]       |
  |  [call vault.depositFor(user)] |
  |                                |
  |  HTTP 200                      |
  |  {depositTxHash, collateral}   |
  |<-------------------------------|
```

### 402 Response

```json
{
  "error": "Payment required",
  "token": "WETH",
  "tokenContract": "<WETH_ADDRESS>",
  "payTo": "<SERVER_WALLET_ADDRESS>",
  "amountWei": "1000000000000000000",
  "chainId": 11142220,
  "instructions": "Approve and transfer WETH to payTo, then retry with X-Tx-Hash header"
}
```

### 200 Response

```json
{
  "status": "deposited",
  "user": "0x...",
  "amount": "1.0",
  "amountWei": "1000000000000000000",
  "depositTxHash": "0x...",
  "collateral": "2500000000000000000"
}
```

### Verification Logic

When `X-Tx-Hash` is provided:
1. Fetch the transaction receipt
2. Parse Transfer event logs for WETH contract
3. Verify: `from` matches `X-From-Address`, `to` matches server wallet, `amount` >= requested
4. If valid: approve WETH to vault, call `depositFor(user, amount)`
5. Return 200 with deposit confirmation

### Security
- Verify tx hash is real and confirmed (not pending)
- Verify transfer recipient is the server wallet
- Verify transfer amount matches requested amount
- Each tx hash can only be used once (in-memory set of consumed hashes)

## Agent Changes

Update `prepare_deposit` in `agent/src/agent.ts` to use the x402 deposit flow instead of returning raw contract tx data. The agent calls the `/deposit` endpoint, handles the 402 → transfer → retry flow.

## Frontend Changes

Update `VaultActions.tsx` deposit action:
1. Call `POST /deposit?amount=X` with user's address
2. Parse 402 response
3. Prompt MetaMask for WETH approve + transfer to `payTo`
4. Retry with `X-Tx-Hash` header
5. Show success

## Files Changed

- `contracts/src/ClawrenceVault.sol` — add `depositFor(address, uint256)`
- `contracts/test/ClawrenceVault.t.sol` — test depositFor
- `skill-server/src/routes/deposit.ts` — new route (custom x402 WETH flow)
- `skill-server/src/index.ts` — register `/deposit` route
- `skill-server/src/lib/abis.ts` — add `depositFor` to VAULT_ABI
- `agent/src/agent.ts` — update prepare_deposit tool
- `agent/lib/abis.ts` — add `depositFor` to VAULT_ABI
- `frontend/components/vault/VaultActions.tsx` — deposit via skill server API
- `frontend/lib/contracts.ts` — add `depositFor` to VAULT_ABI
