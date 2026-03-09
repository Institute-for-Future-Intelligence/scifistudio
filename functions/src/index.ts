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

// Generate story tags
export const generateStoryTags = onCall(
  { secrets: [geminiApiKey], cors: true },
  async (request) => {
    const { prompt, title } = request.data as { prompt?: string; title?: string }

    if (!prompt && !title) {
      throw new HttpsError('invalid-argument', 'Prompt or title is required')
    }

    const tagPrompt = `Analyze this story and generate 5-8 relevant tags.

Title: ${title || 'Untitled'}
Story concept: ${prompt || 'No description'}

Generate tags that describe:
- Genre (e.g., space opera, cyberpunk, dystopian)
- Themes (e.g., exploration, survival, first contact)
- Setting (e.g., space station, alien planet, future earth)
- Mood (e.g., adventure, mystery, action)

Return ONLY a comma-separated list of lowercase tags, nothing else.
Example: space exploration, alien contact, mystery, adventure, mars colony`

    const data = await fetchGemini(
      `${API_BASE}/models/gemini-2.5-flash:generateContent?key=${geminiApiKey.value()}`,
      { contents: [{ parts: [{ text: tagPrompt }] }] }
    )

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // Parse and clean the tags
    const tags = responseText
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0 && tag.length <= 30)
      .slice(0, 8)

    return { tags }
  }
)

// Generate video with Veo
export const generateVideo = onCall(
  { secrets: [geminiApiKey], cors: true, timeoutSeconds: 540 },
  async (request) => {
    const { prompt } = request.data as { prompt?: string }

    if (!prompt) {
      throw new HttpsError('invalid-argument', 'Prompt is required')
    }

    const apiKey = geminiApiKey.value()

    // Step 1: Submit video generation request
    const submitResponse = await fetch(
      `${API_BASE}/models/veo-2.0-generate-001:predictLongRunning?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            aspectRatio: '16:9',
            durationSeconds: 8,
            personGeneration: 'allow_adult',
            numberOfVideos: 1,
          },
        }),
      }
    )

    if (!submitResponse.ok) {
      const errorData = await submitResponse.json().catch(() => ({})) as ErrorResponse
      throw new HttpsError('internal', errorData.error?.message || 'Video generation failed to start')
    }

    const submitResult = await submitResponse.json() as { name?: string }
    const operationName = submitResult.name

    if (!operationName) {
      throw new HttpsError('internal', 'No operation name returned')
    }

    // Step 2: Poll for completion (with timeout)
    const maxWaitTime = 480000 // 8 minutes
    const pollInterval = 5000 // 5 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      const pollResponse = await fetch(
        `${API_BASE}/${operationName}?key=${apiKey}`,
        { method: 'GET' }
      )

      if (!pollResponse.ok) {
        continue // Retry on error
      }

      const pollResult = await pollResponse.json() as {
        done?: boolean
        response?: {
          generatedVideos?: Array<{ video?: { uri?: string } }>
        }
        error?: { message?: string }
      }

      if (pollResult.error) {
        throw new HttpsError('internal', pollResult.error.message || 'Video generation failed')
      }

      if (pollResult.done && pollResult.response?.generatedVideos?.[0]?.video?.uri) {
        const videoUri = pollResult.response.generatedVideos[0].video.uri

        // Fetch the video content and convert to data URL
        const videoResponse = await fetch(`${videoUri}&key=${apiKey}`)
        if (!videoResponse.ok) {
          throw new HttpsError('internal', 'Failed to fetch generated video')
        }

        const videoBuffer = await videoResponse.arrayBuffer()
        const base64Video = Buffer.from(videoBuffer).toString('base64')
        const videoUrl = `data:video/mp4;base64,${base64Video}`

        return { videoUrl, durationSeconds: 8 }
      }
    }

    throw new HttpsError('deadline-exceeded', 'Video generation timed out')
  }
)

// Enhance video prompt
export const enhanceVideoPrompt = onCall(
  { secrets: [geminiApiKey], cors: true },
  async (request) => {
    const { prompt } = request.data as { prompt?: string }

    if (!prompt) {
      throw new HttpsError('invalid-argument', 'Prompt is required')
    }

    const enhancePrompt = `You are a video prompt engineer. Enhance the following video concept into a detailed, cinematic prompt suitable for AI video generation. Include visual details, camera movements, lighting, and atmosphere. Keep it under 200 words.

User's concept: ${prompt}

Enhanced prompt:`

    const data = await fetchGemini(
      `${API_BASE}/models/gemini-2.5-flash:generateContent?key=${geminiApiKey.value()}`,
      { contents: [{ parts: [{ text: enhancePrompt }] }] }
    )

    return { text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '' }
  }
)

// Generate video tags
export const generateVideoTags = onCall(
  { secrets: [geminiApiKey], cors: true },
  async (request) => {
    const { prompt, title } = request.data as { prompt?: string; title?: string }

    if (!prompt && !title) {
      throw new HttpsError('invalid-argument', 'Prompt or title is required')
    }

    const tagPrompt = `Analyze this video concept and generate 5-8 relevant tags.

Title: ${title || 'Untitled'}
Video concept: ${prompt || 'No description'}

Generate tags that describe:
- Genre (e.g., space opera, cyberpunk, action)
- Themes (e.g., exploration, battle, discovery)
- Setting (e.g., space station, alien world, future city)
- Style (e.g., cinematic, dramatic, epic)

Return ONLY a comma-separated list of lowercase tags, nothing else.
Example: space battle, epic, cinematic, sci-fi, alien invasion`

    const data = await fetchGemini(
      `${API_BASE}/models/gemini-2.5-flash:generateContent?key=${geminiApiKey.value()}`,
      { contents: [{ parts: [{ text: tagPrompt }] }] }
    )

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    const tags = responseText
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0 && tag.length <= 30)
      .slice(0, 8)

    return { tags }
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
