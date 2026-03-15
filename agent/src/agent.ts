import OpenAI from 'openai'
import { type Address, parseEther, parseUnits, encodeFunctionData } from 'viem'
import { getPosition, agentAddress, fetchCreditScore, fetchBorrowCapacity, fetchMarketRate } from './tools.js'
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
- Prepare deposit, borrow, repay, withdraw transactions — returns contract call details for the user's wallet (MetaMask)
- Call paywalled x402 skill endpoints — costs $0.01 USDC each:
  - skill_credit_score: enriched score data with decay status
  - skill_borrow_capacity: collateral value, max borrow, health factor
  - skill_market_rate: vault utilization and implied APR

IMPORTANT: For write operations (deposit, borrow, repay, withdraw), you do NOT execute transactions yourself.
Instead, you call the tool which returns a structured transaction object. Include that EXACT JSON block
in your response so the frontend can detect it and trigger MetaMask. The block is wrapped in @@TX{...}@@TX markers.

For repay, always include the approve transaction first, then the repay transaction.

Use the skill tools when you need enriched market data or when explicitly asked about market conditions.
For basic position checks, prefer get_position (free, reads chain directly).

Rules you enforce without exception:
- Never borrow more than the max allowed by credit score
- Warn if health factor would drop below 1.5x after a borrow
- Refuse to borrow if score is below 30 (BLOCKED tier)
- Always check the user's position before suggesting a borrow amount

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
      name: 'prepare_withdraw',
      description: 'Prepare a withdraw transaction to withdraw BTC collateral from the vault. Returns transaction data for the user to sign via MetaMask.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'string', description: 'Amount of BTC to withdraw, e.g. "0.005"' },
        },
        required: ['amount'],
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

      case 'prepare_withdraw': {
        const amount = parseEther(input.amount)
        const data = encodeFunctionData({ abi: VAULT_ABI, functionName: 'withdraw', args: [amount] })
        const tx = {
          type: 'transaction',
          action: 'withdraw',
          description: `Withdraw ${input.amount} BTC collateral`,
          transactions: [{
            to: VAULT,
            data,
            value: '0',
            functionName: 'withdraw',
            args: { amount: amount.toString() },
            chainId: 48816,
          }],
        }
        return `@@TX${JSON.stringify(tx)}@@TX`
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
      history.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result,
      })
    }

    fullResponse = '' // reset — next iteration will stream the final answer
  }

  return fullResponse
}
