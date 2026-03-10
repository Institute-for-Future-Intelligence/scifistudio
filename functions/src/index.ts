import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'

// Define the secret - this will be stored in Google Cloud Secret Manager
const geminiApiKey = defineSecret('GEMINI_API_KEY')

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Use stable model names
const TEXT_MODEL = 'gemini-2.5-flash'
const IMAGE_MODEL = 'gemini-2.0-flash-exp-image-generation'

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
      `${API_BASE}/models/${TEXT_MODEL}:generateContent?key=${geminiApiKey.value()}`,
      { contents: [{ parts: [{ text: prompt }] }] }
    )

    return { text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '' }
  }
)

// Generate image with Imagen 3.0
export const generateImage = onCall(
  { secrets: [geminiApiKey], cors: true },
  async (request) => {
    const { prompt } = request.data as { prompt?: string }

    if (!prompt) {
      throw new HttpsError('invalid-argument', 'Prompt is required')
    }

    const apiKey = geminiApiKey.value()

    // Try Imagen 3.0 first
    const imagenResponse = await fetch(
      `${API_BASE}/models/${IMAGE_MODEL}:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: prompt }],
          parameters: {
            sampleCount: 1,
          },
        }),
      }
    )

    if (imagenResponse.ok) {
      const result = await imagenResponse.json() as {
        predictions?: Array<{ bytesBase64Encoded?: string }>
      }
      if (result.predictions?.[0]?.bytesBase64Encoded) {
        return {
          imageUrl: `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`,
        }
      }
    }

    // Fallback to Gemini with image generation
    const geminiResponse = await fetch(
      `${API_BASE}/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Create a detailed description for an illustration: ${prompt}` }] }],
        }),
      }
    )

    if (!geminiResponse.ok) {
      throw new HttpsError('internal', 'Image generation failed')
    }

    // For now, return empty - we'll need a working image model
    throw new HttpsError('internal', 'Image generation model not available')
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
      `${API_BASE}/models/${TEXT_MODEL}:generateContent?key=${apiKey}`,
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
          `${API_BASE}/models/${IMAGE_MODEL}:generateContent?key=${apiKey}`,
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
      `${API_BASE}/models/${TEXT_MODEL}:generateContent?key=${geminiApiKey.value()}`,
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

// Generate video with Veo via Gemini API
export const generateVideo = onCall(
  { secrets: [geminiApiKey], cors: true, timeoutSeconds: 540 },
  async (request) => {
    const { prompt } = request.data as { prompt?: string }

    if (!prompt) {
      throw new HttpsError('invalid-argument', 'Prompt is required')
    }

    const apiKey = geminiApiKey.value()

    try {
      console.log('Starting video generation with prompt:', prompt.substring(0, 100))

      // Use Veo 3.1 with predictLongRunning method
      const veoModel = 'veo-3.1-generate-preview'
      const veoUrl = `https://generativelanguage.googleapis.com/v1beta/models/${veoModel}:predictLongRunning?key=${apiKey}`

      console.log('Calling Veo 3.1 with predictLongRunning...')

      const veoResponse = await fetch(veoUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{
            prompt: prompt
          }],
          parameters: {
            aspectRatio: '16:9',
            durationSeconds: 8,
          },
        }),
      })

      console.log('Veo response status:', veoResponse.status)

      if (veoResponse.ok) {
        const result = await veoResponse.json() as {
          name?: string
          done?: boolean
          error?: { message?: string }
        }
        console.log('Veo result:', JSON.stringify(result).substring(0, 500))

        // predictLongRunning returns an operation name for polling
        if (result.name) {
          console.log('Got operation:', result.name)
          return await pollVeoOperation(result.name, apiKey)
        }

        if (result.error) {
          console.log('Veo error:', result.error.message)
        }
      } else {
        const errText = await veoResponse.text()
        console.log('Veo error response:', errText.substring(0, 300))
      }

      // If Veo fails, try using imagen-3.0 to generate images as a fallback
      console.log('Veo not available, falling back to image generation...')

      const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key=${apiKey}`

      const imagenResponse = await fetch(imagenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `A cinematic sci-fi scene: ${prompt}` }]
          }],
          generationConfig: {
            numberOfImages: 1,
          },
        }),
      })

      console.log('Imagen response status:', imagenResponse.status)

      if (imagenResponse.ok) {
        const imagenResult = await imagenResponse.json() as {
          generatedImages?: Array<{ image?: { imageBytes?: string } }>
        }

        if (imagenResult.generatedImages?.[0]?.image?.imageBytes) {
          // Return as image with a note
          return {
            videoUrl: `data:image/png;base64,${imagenResult.generatedImages[0].image.imageBytes}`,
            durationSeconds: 0,
            isImage: true,
            message: 'Video generation not available. Generated image instead.',
          }
        }
      }

      // Final fallback: use gemini-2.0-flash-exp-image-generation for image
      console.log('Trying Gemini image generation...')

      const imageModels = [
        'gemini-2.0-flash-exp-image-generation',
        'gemini-2.0-flash-preview-image-generation',
        'imagen-3.0-generate-001'
      ]

      let flashResponse: Response | null = null
      for (const imgModel of imageModels) {
        const flashUrl = `https://generativelanguage.googleapis.com/v1beta/models/${imgModel}:generateContent?key=${apiKey}`
        console.log('Trying image model:', imgModel)

        const response = await fetch(flashUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `Generate an image: A cinematic sci-fi scene - ${prompt}` }]
            }],
            generationConfig: {
              responseModalities: ['image', 'text'],
            },
          }),
        })

        console.log(`${imgModel} response status:`, response.status)

        if (response.ok) {
          flashResponse = response
          break
        } else {
          const errorText = await response.text()
          console.log(`${imgModel} error:`, errorText.substring(0, 200))
        }
      }

      if (flashResponse) {
        const flashResult = await flashResponse.json() as GeminiResponse
        console.log('Image result candidates:', flashResult.candidates?.length)

        for (const part of flashResult.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData?.data) {
            console.log('Found image data, size:', part.inlineData.data.length, 'mime:', part.inlineData.mimeType)
            return {
              videoUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
              durationSeconds: 0,
              isImage: true,
              message: 'Video generation requires Veo API access. Generated image instead.',
            }
          }
        }
        console.log('No image data found in response')
      }

      throw new HttpsError(
        'unimplemented',
        'Video generation (Veo API) is not available for this project. Please ensure you have access to the Veo API in Google AI Studio.'
      )
    } catch (error) {
      console.error('generateVideo error:', error)
      if (error instanceof HttpsError) {
        throw error
      }
      throw new HttpsError('internal', `Video generation failed: ${(error as Error).message}`)
    }
  }
)

// Poll Veo API operation for video completion
async function pollVeoOperation(operationName: string, apiKey: string) {
  const maxWaitTime = 300000 // 5 minutes
  const pollInterval = 5000 // 5 seconds
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, pollInterval))

    // The operation name format is like "operations/xxx" - we need full URL
    const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
    console.log('Polling Veo operation:', operationName)

    const pollResponse = await fetch(pollUrl)

    if (!pollResponse.ok) {
      console.log('Poll error:', pollResponse.status)
      const errText = await pollResponse.text()
      console.log('Poll error body:', errText.substring(0, 200))
      continue
    }

    interface VeoPollResult {
      name?: string
      done?: boolean
      error?: { message?: string; code?: number }
      metadata?: unknown
      response?: {
        videos?: Array<{
          uri?: string
          encoding?: string
        }>
      }
    }

    const result = await pollResponse.json() as VeoPollResult
    console.log('Poll result done:', result.done, 'error:', result.error?.message)

    if (result.error) {
      throw new HttpsError('internal', result.error.message || 'Video generation failed')
    }

    if (result.done && result.response?.videos?.[0]) {
      const video = result.response.videos[0]
      console.log('Video ready! URI:', video.uri?.substring(0, 100))

      if (video.uri) {
        // Fetch the video from the URI
        const videoFetchUrl = `${video.uri}?key=${apiKey}`
        const videoResponse = await fetch(videoFetchUrl)

        if (videoResponse.ok) {
          const buffer = await videoResponse.arrayBuffer()
          const base64 = Buffer.from(buffer).toString('base64')
          return {
            videoUrl: `data:video/mp4;base64,${base64}`,
            durationSeconds: 8,
          }
        } else {
          console.log('Failed to fetch video:', videoResponse.status)
        }
      }

      throw new HttpsError('internal', 'Video completed but could not download')
    }
  }

  throw new HttpsError('deadline-exceeded', 'Video generation timed out after 5 minutes')
}

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
      `${API_BASE}/models/${TEXT_MODEL}:generateContent?key=${geminiApiKey.value()}`,
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
      `${API_BASE}/models/${TEXT_MODEL}:generateContent?key=${geminiApiKey.value()}`,
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
      `${API_BASE}/models/${TEXT_MODEL}:generateContent?key=${geminiApiKey.value()}`,
      { contents: [{ parts: [{ text: systemPrompt }] }] }
    )

    return { text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '' }
  }
)
