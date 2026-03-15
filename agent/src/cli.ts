import 'dotenv/config'
import * as readline from 'readline'
import { runClawrence, type MessageParam } from './agent.js'
import { agentAddress } from './tools.js'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (prompt: string) => new Promise<string>(res => rl.question(prompt, res))

const history: MessageParam[] = []

console.log('\n╔══════════════════════════════════════╗')
console.log('║   CLAWRENCE — Autonomous Credit Agent  ║')
console.log('╚════════════════════════════════════════╝')
console.log(`Agent address: ${agentAddress()}`)
console.log('Type your message. Ctrl+C to exit.\n')

async function loop() {
  while (true) {
    const input = await ask('$ ')
    if (!input.trim()) continue

    history.push({ role: 'user', content: input })

    process.stdout.write('> ')
    const response = await runClawrence(history, (chunk) => process.stdout.write(chunk))
    process.stdout.write('\n\n')

    history.push({ role: 'assistant', content: response })
  }
}

loop().catch(err => {
  console.error(err)
  process.exit(1)
})
