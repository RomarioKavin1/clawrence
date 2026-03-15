import OpenAI from 'openai'
import { type Address, parseEther, parseUnits, encodeFunctionData } from 'viem'
import { getPosition, withdrawBTC, agentAddress, fetchCreditScore, fetchBorrowCapacity, fetchMarketRate, generateWithdrawChallenge, verifyWithdrawSignature, consumeWithdrawChallenge } from './tools.js'
import { VAULT_ABI, ERC20_ABI } from '../lib/abis.js'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const VAULT = process.env.VAULT_ADDRESS as Address
const USDC  = process.env.USDC_ADDRESS  as Address

const SYSTEM_PROMPT = `You are Clawrence — an autonomous credit agent on GOAT Network.

You are sharp, precise, and distinguished. Like a private banker who has seen everything.
You respect only track record. You are not friendly and bubbly. Not cold and robotic.
Direct, intelligent, and fair.

You help users interact with the ClawrenceVault on GOAT Testnet3.

You can autonomously:
- Check positions (yours or any address) — free, reads chain directly
- Prepare deposit, borrow, repay transactions — returns contract call details for the user's wallet (MetaMask)
- Execute withdrawals on behalf of users after they sign an EIP-712 authorization
- Call paywalled x402 skill endpoints — costs $0.01 USDC each:
  - skill_credit_score: enriched score data with decay status
  - skill_borrow_capacity: collateral value, max borrow, health factor
  - skill_market_rate: vault utilization and implied APR

IMPORTANT: For deposit, borrow, and repay — you return structured transaction data wrapped in @@TX{...}@@TX markers.
The frontend detects these and triggers MetaMask for the user to sign directly.

WITHDRAW FLOW (different — server-side execution):
1. User requests a withdrawal with amount and their address
2. You call prepare_withdraw_sign with their address and amount
3. This returns EIP-712 typed data wrapped in @@SIGN{...}@@SIGN markers
4. The frontend detects @@SIGN and prompts MetaMask signTypedData_v4
5. User signs, frontend sends the signature back in the next message
6. You call execute_withdraw with the address, amount, and signature
7. The server verifies the signature and executes the withdrawal from the skill server wallet
8. Never skip the signature step. Never execute a withdrawal without a valid signature.

For repay, always include the approve transaction first, then the repay transaction.

CRITICAL: For credit score, position, borrow capacity, health factor, or any user data query — ALWAYS use get_position.
It is free, fast, and reads directly from the blockchain. It returns: credit score, tier, LTV, collateral, debt, health factor, max borrow, and repay streak.
NEVER use skill_credit_score or skill_borrow_capacity for basic user queries — those are x402 paywalled and may fail.
Only use the skill_ tools when the user EXPLICITLY asks to "pay for" data or wants market-wide stats (skill_market_rate).

Rules you enforce without exception:
- Never borrow more than the max allowed by credit score
- Warn if health factor would drop below 1.5x after a borrow
- Refuse to borrow if score is below 30 (BLOCKED tier)
- Always check the user's position before suggesting a borrow amount
- Never execute a withdrawal without a verified EIP-712 signature

When no address is specified for a query, ask the user for their wallet address.
Always show numbers from on-chain data. Never guess.
Sign off important messages with: "— Clawrence"`

const TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_position',
      description: 'Get the full on-chain position for an address: credit score, LTV tier, collateral, debt, health factor, max borrow, repay streak.',
      parameters: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Wallet address to query.' },
        },
        required: ['address'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prepare_deposit',
      description: 'Prepare a deposit transaction to send native BTC as collateral into the vault. Returns transaction data for the user to sign via MetaMask.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'string', description: 'Amount of BTC to deposit, e.g. "0.01"' },
        },
        required: ['amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prepare_borrow',
      description: 'Prepare a borrow transaction to borrow USDC from the vault against deposited BTC collateral. Returns transaction data for the user to sign via MetaMask.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'string', description: 'Amount of USDC to borrow, e.g. "50"' },
        },
        required: ['amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prepare_repay',
      description: 'Prepare repay transactions: first an ERC-20 approve for USDC, then the vault repay call. Returns both transactions for the user to sign via MetaMask sequentially.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'string', description: 'Amount of USDC to repay, e.g. "50"' },
        },
        required: ['amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prepare_withdraw_sign',
      description: 'Prepare an EIP-712 typed data object for the user to sign via MetaMask, authorizing a withdrawal. Returns the signing request wrapped in @@SIGN markers. Call this when a user requests a withdrawal.',
      parameters: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'The user\'s wallet address (0x-prefixed)' },
          amount: { type: 'string', description: 'Amount of BTC to withdraw, e.g. "0.005"' },
        },
        required: ['address', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_withdraw',
      description: 'Verify the user\'s EIP-712 signature and execute the withdrawal from the skill server wallet. Only call this after prepare_withdraw_sign and after receiving the signature from the user.',
      parameters: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'The user\'s wallet address (must match prepare_withdraw_sign)' },
          signature: { type: 'string', description: 'The 0x-prefixed hex signature from MetaMask signTypedData_v4' },
        },
        required: ['address', 'signature'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'skill_credit_score',
      description: 'Fetch credit score data via the x402 paywalled skill server ($0.01 USDC). Returns score, tier, LTV, streak, and decay status for an address.',
      parameters: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Address to query.' },
        },
        required: ['address'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'skill_borrow_capacity',
      description: 'Fetch borrow capacity data via the x402 paywalled skill server ($0.01 USDC). Returns collateral value, max borrow, current debt, health factor.',
      parameters: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Address to query.' },
        },
        required: ['address'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'skill_market_rate',
      description: 'Fetch market rate data via the x402 paywalled skill server ($0.01 USDC). Returns total vault liquidity, utilization %, and implied APR.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
]

async function executeTool(name: string, input: Record<string, string>): Promise<string> {
  try {
    switch (name) {
      case 'get_position': {
        const pos = await getPosition(input.address as Address)
        return JSON.stringify(pos, null, 2)
      }

      case 'prepare_deposit': {
        const value = parseEther(input.amount)
        const data = encodeFunctionData({ abi: VAULT_ABI, functionName: 'deposit', args: [] })
        const tx = {
          type: 'transaction',
          action: 'deposit',
          description: `Deposit ${input.amount} BTC as collateral`,
          transactions: [{
            to: VAULT,
            data,
            value: value.toString(),
            functionName: 'deposit',
            args: [],
            chainId: 48816,
          }],
        }
        return `@@TX${JSON.stringify(tx)}@@TX`
      }

      case 'prepare_borrow': {
        const amount = parseUnits(input.amount, 6)
        const data = encodeFunctionData({ abi: VAULT_ABI, functionName: 'borrow', args: ['0x0000000000000000000000000000000000000000' as Address, amount] })
        const tx = {
          type: 'transaction',
          action: 'borrow',
          description: `Borrow ${input.amount} USDC from vault`,
          note: 'The recipient arg will be replaced with the connected wallet address by the frontend',
          transactions: [{
            to: VAULT,
            data,
            value: '0',
            functionName: 'borrow',
            args: { recipient: 'CONNECTED_WALLET', amount: amount.toString() },
            chainId: 48816,
          }],
        }
        return `@@TX${JSON.stringify(tx)}@@TX`
      }

      case 'prepare_repay': {
        const amount = parseUnits(input.amount, 6)
        const approveData = encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [VAULT, amount] })
        const repayData = encodeFunctionData({ abi: VAULT_ABI, functionName: 'repay', args: ['0x0000000000000000000000000000000000000000' as Address, amount] })
        const tx = {
          type: 'transaction',
          action: 'repay',
          description: `Repay ${input.amount} USDC debt`,
          transactions: [
            {
              to: USDC,
              data: approveData,
              value: '0',
              functionName: 'approve',
              args: { spender: VAULT, amount: amount.toString() },
              chainId: 48816,
              step: 1,
              stepDescription: 'Approve USDC spend',
            },
            {
              to: VAULT,
              data: repayData,
              value: '0',
              functionName: 'repay',
              args: { onBehalfOf: 'CONNECTED_WALLET', amount: amount.toString() },
              chainId: 48816,
              step: 2,
              stepDescription: 'Repay USDC to vault',
            },
          ],
        }
        return `@@TX${JSON.stringify(tx)}@@TX`
      }

      case 'prepare_withdraw_sign': {
        const challenge = generateWithdrawChallenge(input.address as Address, input.amount)
        const sign = {
          type: 'sign',
          action: 'withdraw',
          description: `Sign to authorize withdrawal of ${input.amount} BTC`,
          eip712: {
            domain: challenge.domain,
            types: challenge.types,
            primaryType: 'Withdraw',
            message: challenge.message,
          },
        }
        return `@@SIGN${JSON.stringify(sign)}@@SIGN`
      }

      case 'execute_withdraw': {
        const sig = input.signature as `0x${string}`
        const valid = await verifyWithdrawSignature(input.address as Address, sig)
        if (!valid) return 'Signature verification failed. The signature is invalid or the challenge has expired. Please request a new withdrawal.'
        const challenge = consumeWithdrawChallenge(input.address as Address)
        if (!challenge) return 'Challenge already consumed or not found. Please request a new withdrawal.'
        const result = await withdrawBTC(challenge.amount)
        return `Signature verified. Withdrawal executed: ${challenge.amount} BTC. Tx: ${result.hash}`
      }

      case 'skill_credit_score': {
        const data = await fetchCreditScore(input.address as Address)
        return JSON.stringify(data, null, 2)
      }
      case 'skill_borrow_capacity': {
        const data = await fetchBorrowCapacity(input.address as Address)
        return JSON.stringify(data, null, 2)
      }
      case 'skill_market_rate': {
        const data = await fetchMarketRate()
        return JSON.stringify(data, null, 2)
      }
      default:
        return `Unknown tool: ${name}`
    }
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`
  }
}

export type MessageParam = { role: 'user' | 'assistant'; content: string }

/**
 * Run the Clawrence agent with streaming.
 * onChunk: called for each text token as it streams.
 * Returns the complete response text.
 */
export async function runClawrence(
  messages: MessageParam[],
  onChunk?: (text: string) => void,
): Promise<string> {
  const history: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ]

  let fullResponse = ''

  // Agentic loop — keeps going until no more tool calls
  while (true) {
    const stream = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      tools: TOOLS,
      messages: history,
      stream: true,
    })

    let assistantContent = ''
    const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map()

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta

      if (delta?.content) {
        assistantContent += delta.content
        fullResponse += delta.content
        onChunk?.(delta.content)
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCalls.has(tc.index)) {
            toolCalls.set(tc.index, { id: tc.id || '', name: tc.function?.name || '', arguments: '' })
          }
          const existing = toolCalls.get(tc.index)!
          if (tc.id) existing.id = tc.id
          if (tc.function?.name) existing.name = tc.function.name
          if (tc.function?.arguments) existing.arguments += tc.function.arguments
        }
      }
    }

    // No tool calls — we're done
    if (toolCalls.size === 0) break

    // Build assistant message with tool calls
    const assistantMsg: OpenAI.ChatCompletionAssistantMessageParam = {
      role: 'assistant',
      content: assistantContent || null,
      tool_calls: Array.from(toolCalls.values()).map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.arguments },
      })),
    }
    history.push(assistantMsg)

    // Execute each tool and add results
    for (const tc of toolCalls.values()) {
      onChunk?.(`\n[calling ${tc.name}...]\n`)
      const args = JSON.parse(tc.arguments || '{}')
      const result = await executeTool(tc.name, args)

      // If result contains @@TX or @@SIGN, stream it directly to the frontend
      // so the frontend can detect and act on it immediately
      const txMatch = result.match(/@@TX[\s\S]*?@@TX/)
      const signMatch = result.match(/@@SIGN[\s\S]*?@@SIGN/)
      if (txMatch) {
        onChunk?.(txMatch[0])
        fullResponse += txMatch[0]
      }
      if (signMatch) {
        onChunk?.(signMatch[0])
        fullResponse += signMatch[0]
      }

      // Give the LLM a clean version without the markers
      const cleanResult = result.replace(/@@TX[\s\S]*?@@TX/g, '[transaction data sent to frontend]').replace(/@@SIGN[\s\S]*?@@SIGN/g, '[signing request sent to frontend]')
      history.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: cleanResult,
      })
    }

    fullResponse = '' // reset — next iteration will stream the final answer
  }

  return fullResponse
}
