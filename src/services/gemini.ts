const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>
    }
  }>
}

interface VideoGenerationResponse {
  name: string
}

interface VideoOperationResult {
  done: boolean
  metadata?: {
    '@type': string
  }
  response?: {
    generateVideoResponse?: {
      generatedSamples?: Array<{
        video?: {
          uri?: string
        }
      }>
    }
  }
  error?: {
    code: number
    message: string
  }
}

export interface StoryFrame {
  caption: string
  imageUrl: string
}

export const generateWithGemini = async (prompt: string): Promise<string> => {
  const response = await fetch(
    `${API_BASE}/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || `Gemini API error: ${response.statusText}`)
  }

  const data: GeminiResponse = await response.json()
  return data.candidates[0]?.content.parts[0]?.text ?? ''
}

export const generateImage = async (prompt: string): Promise<string> => {
  // Use Gemini 2.0 Flash Image Generation
  const response = await fetch(
    `${API_BASE}/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `Generate an image: ${prompt}` }],
          },
        ],
        generationConfig: {
          responseModalities: ['image', 'text'],
        },
      }),
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || `Image generation failed: ${response.statusText}`)
  }

  const data: GeminiResponse = await response.json()

  // Find the image part in the response
  for (const part of data.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData?.data) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
    }
  }

  throw new Error('No image generated')
}

export const generateStorybook = async (
  prompt: string,
  frameCount: number = 10,
  onProgress?: (status: string, frame: number) => void
): Promise<StoryFrame[]> => {
  const frames: StoryFrame[] = []

  onProgress?.('Creating story outline...', 0)

  // Generate story outline with scene descriptions
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

  const outline = await generateWithGemini(outlinePrompt)

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
    throw new Error('Failed to generate story outline')
  }

  // Generate images for each page
  for (let i = 0; i < Math.min(pages.length, frameCount); i++) {
    onProgress?.(`Generating illustration ${i + 1}/${pages.length}...`, i + 1)

    try {
      const imagePrompt = `Create a beautiful sci-fi storybook illustration: ${pages[i].visual}. Style: cinematic, detailed, vibrant colors, suitable for a storybook.`
      const imageUrl = await generateImage(imagePrompt)

      frames.push({
        caption: pages[i].caption,
        imageUrl: imageUrl,
      })
    } catch (error) {
      console.error(`Failed to generate image for page ${i + 1}:`, error)
      // Continue with placeholder
      frames.push({
        caption: pages[i].caption,
        imageUrl: '',
      })
    }

    // Small delay to avoid rate limiting
    if (i < pages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  onProgress?.('Storybook complete!', frameCount)
  return frames
}

export const generateVideo = async (
  prompt: string,
  onProgress?: (status: string) => void
): Promise<string> => {
  onProgress?.('Starting video generation...')

  const response = await fetch(
    `${API_BASE}/models/veo-001:generateVideo?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: {
          text: prompt,
        },
        videoConfig: {
          aspectRatio: '16:9',
          numberOfVideos: 1,
          durationSeconds: 5,
          personGeneration: 'allow_adult',
        },
      }),
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || `Video generation failed: ${response.statusText}`)
  }

  const data: VideoGenerationResponse = await response.json()
  const operationName = data.name

  onProgress?.('Video generation in progress...')

  const videoUrl = await pollVideoOperation(operationName, onProgress)
  return videoUrl
}

const pollVideoOperation = async (
  operationName: string,
  onProgress?: (status: string) => void
): Promise<string> => {
  const maxAttempts = 120
  let attempts = 0

  while (attempts < maxAttempts) {
    const response = await fetch(
      `${API_BASE}/${operationName}?key=${GEMINI_API_KEY}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to check video status: ${response.statusText}`)
    }

    const result: VideoOperationResult = await response.json()

    if (result.done) {
      if (result.error) {
        throw new Error(result.error.message)
      }

      const videoUri = result.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
      if (videoUri) {
        onProgress?.('Video generation complete!')
        return videoUri
      }
      throw new Error('No video generated')
    }

    const progress = Math.min(Math.round((attempts / 60) * 100), 99)
    onProgress?.(`Generating video... ${progress}%`)
    attempts++
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }

  throw new Error('Video generation timed out')
}

export const enhanceVideoPrompt = async (userPrompt: string): Promise<string> => {
  const systemPrompt = `You are a video prompt engineer. Enhance the following video concept into a detailed, cinematic prompt suitable for AI video generation. Include visual details, camera movements, lighting, and atmosphere. Keep it under 200 words.

User's concept: ${userPrompt}

Enhanced prompt:`

  return generateWithGemini(systemPrompt)
}

export const enhanceStoryPrompt = async (userPrompt: string): Promise<string> => {
  const systemPrompt = `You are a sci-fi story writer. Enhance the following story concept into a more detailed and compelling narrative premise. Add interesting characters, settings, and plot elements while keeping it suitable for a 10-page illustrated storybook. Keep it under 150 words.

User's concept: ${userPrompt}

Enhanced concept:`

  return generateWithGemini(systemPrompt)
}
