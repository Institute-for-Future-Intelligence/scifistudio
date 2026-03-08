const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY

interface ClaudeResponse {
  content: Array<{
    type: string
    text: string
  }>
}

export const generateWithClaude = async (prompt: string): Promise<string> => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.statusText}`)
  }

  const data: ClaudeResponse = await response.json()
  const textContent = data.content.find((c) => c.type === 'text')
  return textContent?.text ?? ''
}
