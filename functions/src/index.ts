import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'

// Define the secret - this will be stored in Google Cloud Secret Manager
const geminiApiKey = defineSecret('GEMINI_API_KEY')

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>
    }
  }>
}

interface ErrorResponse {
  error?: { message?: string }
}

async function fetchGemini(url: string, body: object): Promise<GeminiResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as ErrorResponse
    throw new HttpsError('internal', errorData.error?.message || 'Gemini API error')
  }

  return (await response.json()) as GeminiResponse
}

// Generate text with Gemini
export const generateText = onCall(
  { secrets: [geminiApiKey], cors: true },
  async (request) => {
    const { prompt } = request.data as { prompt?: string }

    if (!prompt) {
      throw new HttpsError('invalid-argument', 'Prompt is required')
    }

    const data = await fetchGemini(
      `${API_BASE}/models/gemini-2.5-flash:generateContent?key=${geminiApiKey.value()}`,
      { contents: [{ parts: [{ text: prompt }] }] }
    )

    return { text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '' }
  }
)

// Generate image with Gemini
export const generateImage = onCall(
  { secrets: [geminiApiKey], cors: true },
  async (request) => {
    const { prompt } = request.data as { prompt?: string }

    if (!prompt) {
      throw new HttpsError('invalid-argument', 'Prompt is required')
    }

    const data = await fetchGemini(
      `${API_BASE}/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${geminiApiKey.value()}`,
      {
        contents: [{ parts: [{ text: `Generate an image: ${prompt}` }] }],
        generationConfig: { responseModalities: ['image', 'text'] },
      }
    )

    for (const part of data.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        return {
          imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
        }
      }
    }

    throw new HttpsError('internal', 'No image generated')
  }
)

// Generate full storybook
export const generateStorybook = onCall(
  { secrets: [geminiApiKey], cors: true, timeoutSeconds: 540 },
  async (request) => {
    const { prompt, frameCount = 10 } = request.data as { prompt?: string; frameCount?: number }

    if (!prompt) {
      throw new HttpsError('invalid-argument', 'Prompt is required')
    }

    const apiKey = geminiApiKey.value()

    // Generate story outline
    const outlinePrompt = `Create a ${frameCount}-page sci-fi storybook based on this concept: "${prompt}"

For each page, provide:
1. A short caption (1-2 sentences) that tells the story
2. A detailed visual description for illustration

Format EXACTLY as:
PAGE 1:
Caption: [story text for this page]
Visual: [detailed illustration description]

PAGE 2:
Caption: [story text for this page]
Visual: [detailed illustration description]

...continue for all ${frameCount} pages.

Make it a compelling narrative with a beginning, middle, and end.`

    const outlineData = await fetchGemini(
      `${API_BASE}/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      { contents: [{ parts: [{ text: outlinePrompt }] }] }
    )

    const outline = outlineData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // Parse the outline
    const pageRegex = /PAGE \d+:\s*Caption:\s*(.*?)\s*Visual:\s*(.*?)(?=PAGE \d+:|$)/gis
    const pages: Array<{ caption: string; visual: string }> = []

    let match
    while ((match = pageRegex.exec(outline)) !== null) {
      pages.push({
        caption: match[1].trim(),
        visual: match[2].trim(),
      })
    }

    if (pages.length === 0) {
      throw new HttpsError('internal', 'Failed to parse story outline')
    }

    // Generate images for each page
    const frames: Array<{ caption: string; imageUrl: string }> = []

    for (let i = 0; i < Math.min(pages.length, frameCount); i++) {
      try {
        const imagePrompt = `Create a beautiful sci-fi storybook illustration: ${pages[i].visual}. Style: cinematic, detailed, vibrant colors, suitable for a storybook.`

        const imageData = await fetchGemini(
          `${API_BASE}/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
          {
            contents: [{ parts: [{ text: `Generate an image: ${imagePrompt}` }] }],
            generationConfig: { responseModalities: ['image', 'text'] },
          }
        )

        let foundImage = false
        for (const part of imageData.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData?.data) {
            frames.push({
              caption: pages[i].caption,
              imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            })
            foundImage = true
            break
          }
        }

        if (!foundImage) {
          frames.push({ caption: pages[i].caption, imageUrl: '' })
        }
      } catch {
        frames.push({ caption: pages[i].caption, imageUrl: '' })
      }

      // Delay between requests
      if (i < pages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return { frames }
  }
)

// Enhance story prompt
export const enhanceStoryPrompt = onCall(
  { secrets: [geminiApiKey], cors: true },
  async (request) => {
    const { prompt } = request.data as { prompt?: string }

    if (!prompt) {
      throw new HttpsError('invalid-argument', 'Prompt is required')
    }

    const systemPrompt = `You are a sci-fi story writer. Enhance the following story concept into a more detailed and compelling narrative premise. Add interesting characters, settings, and plot elements while keeping it suitable for a 10-page illustrated storybook. Keep it under 150 words.

User's concept: ${prompt}

Enhanced concept:`

    const data = await fetchGemini(
      `${API_BASE}/models/gemini-2.5-flash:generateContent?key=${geminiApiKey.value()}`,
      { contents: [{ parts: [{ text: systemPrompt }] }] }
    )

    return { text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '' }
  }
)
