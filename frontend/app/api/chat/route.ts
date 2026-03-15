const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://localhost:3001'

export async function POST(req: Request) {
  const body = await req.json()

  // Map clawrence role → assistant for the agent
  const messages = body.messages.map((m: { role: string; content: string }) => ({
    role: m.role === 'clawrence' ? 'assistant' : 'user',
    content: m.content,
  }))

  const upstream = await fetch(`${OPENCLAW_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })

  return new Response(upstream.body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
