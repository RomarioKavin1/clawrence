import 'dotenv/config'
import express from 'express'
import { runClawrence, type MessageParam } from './agent.js'

const app = express()
app.use(express.json())

// Allow frontend to call this
app.use((_, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  next()
})

/**
 * POST /chat
 * Body: { messages: Array<{ role: 'user' | 'assistant', content: string }> }
 * Streams the response as plain text (SSE-compatible).
 */
app.post('/chat', async (req, res) => {
  const { messages } = req.body as { messages: MessageParam[] }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Transfer-Encoding', 'chunked')

  try {
    await runClawrence(messages, (chunk) => {
      res.write(chunk)
    })
  } catch (err) {
    res.write(`\nError: ${err instanceof Error ? err.message : String(err)}`)
  }

  res.end()
})

app.get('/health', (_, res) => res.json({ status: 'ok', agent: 'clawrence' }))

const PORT = parseInt(process.env.PORT || '3001')
app.listen(PORT, () => {
  console.log(`OpenClaw agent running on http://localhost:${PORT}`)
})
