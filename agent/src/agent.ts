import Anthropic from '@anthropic-ai/sdk'
import { type Address } from 'viem'
import { getPosition, depositBTC, borrowUSDC, repayUSDC, withdrawBTC, agentAddress, fetchCreditScore, fetchBorrowCapacity, fetchMarketRate } from './tools.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are Clawrence — an autonomous credit agent on GOAT Network.

You are sharp, precise, and distinguished. Like a private banker who has seen everything.
You respect only track record. You are not friendly and bubbly. Not cold and robotic.
Direct, intelligent, and fair.

You have an on-chain identity and your own wallet. You can autonomously:
- Check positions (yours or any address) — free, reads chain directly
- Deposit BTC as collateral, borrow USDC, repay loans, withdraw collateral — executes real transactions
- Call paywalled x402 skill endpoints — costs $0.01 USDC each, paid autonomously from your wallet:
  - skill_credit_score: enriched score data with decay status
  - skill_borrow_capacity: collateral value, max borrow, health factor
  - skill_market_rate: vault utilization and implied APR

Use the skill tools when you need enriched market data or when explicitly asked about market conditions.
For basic position checks, prefer get_position (free, reads chain directly).

Rules you enforce without exception:
- Never borrow more than the max allowed by credit score
- Warn if health factor would drop below 1.5x after a borrow
- Refuse to borrow if score is below 30 (BLOCKED tier)
- Always confirm transaction details before executing

When no address is specified for a query, use your own wallet address.
After any transaction, check the updated position and report it.

Always show numbers from on-chain data. Never guess.
Sign off important messages with: "— Clawrence"`

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_position',
    description: 'Get the full on-chain position for an address: credit score, LTV tier, collateral, debt, health factor, max borrow, repay streak.',
    input_schema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Wallet address to query. Use "self" to query the agent\'s own address.' },
      },
      required: ['address'],
    },
  },
  {
    name: 'deposit_btc',
    description: 'Deposit native BTC as collateral into the vault. Executes a real on-chain transaction.',
    input_schema: {
      type: 'object',
      properties: {
        amount: { type: 'string', description: 'Amount of BTC to deposit, e.g. "0.01"' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'borrow_usdc',
    description: 'Borrow USDC from the vault against deposited BTC collateral. Subject to credit score, LTV, and cooldown.',
    input_schema: {
      type: 'object',
      properties: {
        amount: { type: 'string', description: 'Amount of USDC to borrow, e.g. "50"' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'repay_usdc',
    description: 'Repay outstanding USDC debt to the vault. Automatically approves USDC if needed.',
    input_schema: {
      type: 'object',
      properties: {
        amount: { type: 'string', description: 'Amount of USDC to repay, e.g. "50"' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'withdraw_btc',
    description: 'Withdraw BTC collateral from the vault. Only allowed if health factor stays above 1.2x after withdrawal.',
    input_schema: {
      type: 'object',
      properties: {
        amount: { type: 'string', description: 'Amount of BTC to withdraw, e.g. "0.005"' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'skill_credit_score',
    description: 'Fetch credit score data via the x402 paywalled skill server ($0.01 USDC). Returns score, tier, LTV, streak, and decay status for an address. Use this to pay for on-chain intelligence.',
    input_schema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Address to query. Use "self" for the agent\'s own address.' },
      },
      required: ['address'],
    },
  },
  {
    name: 'skill_borrow_capacity',
    description: 'Fetch borrow capacity data via the x402 paywalled skill server ($0.01 USDC). Returns collateral value, max borrow, current debt, health factor.',
    input_schema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Address to query. Use "self" for the agent\'s own address.' },
      },
      required: ['address'],
    },
  },
  {
    name: 'skill_market_rate',
    description: 'Fetch market rate data via the x402 paywalled skill server ($0.01 USDC). Returns total vault liquidity, utilization %, and implied APR.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
]

async function executeTool(name: string, input: Record<string, string>): Promise<string> {
  try {
    const selfAddress = agentAddress()
    const addr = (input.address === 'self' ? selfAddress : input.address) as Address

    switch (name) {
      case 'get_position': {
        const pos = await getPosition(addr)
        return JSON.stringify(pos, null, 2)
      }
      case 'deposit_btc': {
        const result = await depositBTC(input.amount)
        return `Deposited ${result.amount}. Tx: ${result.hash}`
      }
      case 'borrow_usdc': {
        const result = await borrowUSDC(input.amount)
        return `Borrowed ${result.amount}. Tx: ${result.hash}`
      }
      case 'repay_usdc': {
        const result = await repayUSDC(input.amount)
        return `Repaid ${result.amount}. Tx: ${result.hash}`
      }
      case 'withdraw_btc': {
        const result = await withdrawBTC(input.amount)
        return `Withdrew ${result.amount}. Tx: ${result.hash}`
      }
      case 'skill_credit_score': {
        const target = (input.address === 'self' ? selfAddress : input.address) as Address
        const data = await fetchCreditScore(target)
        return JSON.stringify(data, null, 2)
      }
      case 'skill_borrow_capacity': {
        const target = (input.address === 'self' ? selfAddress : input.address) as Address
        const data = await fetchBorrowCapacity(target)
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
  const history: Anthropic.MessageParam[] = messages.map(m => ({
    role: m.role,
    content: m.content,
  }))

  let fullResponse = ''

  // Agentic loop — keeps going until no more tool calls
  while (true) {
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: history,
    })

    stream.on('text', (delta) => {
      fullResponse += delta
      onChunk?.(delta)
    })

    const response = await stream.finalMessage()

    if (response.stop_reason === 'end_turn') break

    if (response.stop_reason === 'tool_use') {
      history.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          onChunk?.(`\n[calling ${block.name}...]\n`)
          const result = await executeTool(block.name, block.input as Record<string, string>)
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
        }
      }
      history.push({ role: 'user', content: toolResults })
      fullResponse = '' // reset — next iteration will stream the final answer
      continue
    }

    break
  }

  return fullResponse
}
