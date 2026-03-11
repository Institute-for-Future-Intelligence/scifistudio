/*
 * Copyright 2026 Institute for Future Intelligence, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { GoogleAuth } from 'google-auth-library'

// Define the secret - this will be stored in Google Cloud Secret Manager
const geminiApiKey = defineSecret('GEMINI_API_KEY')

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Vertex AI config
const GCP_PROJECT = 'sci-fi-studio'
const GCP_REGION = 'us-central1'
const VERTEX_BASE = `https://${GCP_REGION}-aiplatform.googleapis.com/v1beta1`

// Get access token for Vertex AI (uses Cloud Functions service account)
async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
  const client = await auth.getClient()
  const token = await client.getAccessToken()
  return token.token || ''
}

// Use stable model names
// v2.2 - image generation with fallback models
const TEXT_MODEL = 'gemini-2.5-flash'

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

// Generate image with fallback models
export const generateImage = onCall(
  { secrets: [geminiApiKey], cors: true },
  async (request) => {
    const { prompt } = request.data as { prompt?: string }

    if (!prompt) {
      throw new HttpsError('invalid-argument', 'Prompt is required')
    }

    const apiKey = geminiApiKey.value()
    const imageModels = [
      'gemini-2.5-flash-image',
      'gemini-3.1-flash-image-preview',
      'gemini-3-pro-image-preview'
    ]

    // Try each model until one works
    for (const model of imageModels) {
      try {
        console.log(`generateImage: Trying model ${model}`)
        const response = await fetch(
          `${API_BASE}/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `Generate an image: ${prompt}` }] }],
              generationConfig: { responseModalities: ['image', 'text'] },
            }),
          }
        )

        if (!response.ok) {
          const errText = await response.text()
          console.log(`Model ${model} failed:`, errText.substring(0, 200))
          continue
        }

        const imageData = await response.json() as GeminiResponse
        for (const part of imageData.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData?.data) {
            console.log(`generateImage: Got image from ${model}`)
            return {
              imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            }
          }
        }
      } catch (err) {
        console.log(`Model ${model} error:`, err)
      }
    }

    throw new HttpsError('internal', 'Image generation failed - no models available')
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

    // Generate images for each page with fallback models
    const frames: Array<{ caption: string; imageUrl: string }> = []
    const imageModels = [
      'gemini-2.5-flash-image',
      'gemini-3.1-flash-image-preview',
      'gemini-3-pro-image-preview'
    ]

    for (let i = 0; i < Math.min(pages.length, frameCount); i++) {
      const imagePrompt = `Create a beautiful sci-fi storybook illustration: ${pages[i].visual}. Style: cinematic, detailed, vibrant colors, suitable for a storybook.`
      let imageUrl = ''

      // Try each model until one works
      for (const model of imageModels) {
        try {
          console.log(`Page ${i + 1}: Trying model ${model}`)
          const response = await fetch(
            `${API_BASE}/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `Generate an image: ${imagePrompt}` }] }],
                generationConfig: { responseModalities: ['image', 'text'] },
              }),
            }
          )

          if (!response.ok) {
            const errText = await response.text()
            console.log(`Model ${model} failed:`, errText.substring(0, 200))
            continue
          }

          const imageData = await response.json() as GeminiResponse
          for (const part of imageData.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData?.data) {
              imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
              console.log(`Page ${i + 1}: Got image from ${model}`)
              break
            }
          }

          if (imageUrl) break
        } catch (err) {
          console.log(`Model ${model} error:`, err)
        }
      }

      frames.push({ caption: pages[i].caption, imageUrl })

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
    const { prompt, title, language = 'en' } = request.data as { prompt?: string; title?: string; language?: string }

    if (!prompt && !title) {
      throw new HttpsError('invalid-argument', 'Prompt or title is required')
    }

    const langName = languageNames[language] || 'English'

    const tagPrompt = `Analyze this story and generate 5-8 relevant tags in ${langName}.

Title: ${title || 'Untitled'}
Story concept: ${prompt || 'No description'}

Generate tags that describe:
- Genre (e.g., space opera, cyberpunk, dystopian)
- Themes (e.g., exploration, survival, first contact)
- Setting (e.g., space station, alien planet, future earth)
- Mood (e.g., adventure, mystery, action)

IMPORTANT: Write ALL tags in ${langName} language.
Return ONLY a comma-separated list of lowercase tags in ${langName}, nothing else.
Example for English: space exploration, alien contact, mystery, adventure, mars colony`

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

// Generate video with Veo via Vertex AI
export const generateVideo = onCall(
  { secrets: [geminiApiKey], cors: true, timeoutSeconds: 540 },
  async (request) => {
    const { prompt, durationSeconds = 8 } = request.data as { prompt?: string; durationSeconds?: number }

    if (!prompt) {
      throw new HttpsError('invalid-argument', 'Prompt is required')
    }

    const apiKey = geminiApiKey.value()
    // Veo supports durations: 4, 6, 8 seconds
    const validDurations = [4, 6, 8]
    const videoDuration = validDurations.reduce((prev, curr) =>
      Math.abs(curr - durationSeconds) < Math.abs(prev - durationSeconds) ? curr : prev
    )

    try {
      console.log('Starting video generation with prompt:', prompt.substring(0, 100), 'duration:', videoDuration)

      const accessToken = await getAccessToken()
      const veoModel = 'veo-3.1-generate-preview'
      const veoUrl = `${VERTEX_BASE}/projects/${GCP_PROJECT}/locations/${GCP_REGION}/publishers/google/models/${veoModel}:predictLongRunning`

      // Simplify prompt for Veo — strip overly detailed/cinematic language that triggers content filters
      const simplifyPrompt = (p: string): string => {
        // Keep it under 150 chars, remove common trigger patterns
        let simplified = p
          .replace(/cinematic|dramatic|intense|violent|dark|bloody|gritty|brutal|destruction|explod|attack|weapon|gun|shoot|kill|death|die|dead/gi, '')
          .replace(/\s+/g, ' ')
          .trim()
        if (simplified.length > 150) {
          simplified = simplified.substring(0, 147) + '...'
        }
        return simplified || p.substring(0, 150)
      }

      // Try Veo with original prompt, then retry with simplified prompt if content-filtered
      const promptsToTry = [prompt, simplifyPrompt(prompt)]
      for (let attempt = 0; attempt < promptsToTry.length; attempt++) {
        const currentPrompt = promptsToTry[attempt]
        console.log(`Veo attempt ${attempt + 1} with prompt:`, currentPrompt.substring(0, 100))

        const veoResponse = await fetch(veoUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            instances: [{ prompt: currentPrompt }],
            parameters: {
              aspectRatio: '16:9',
              durationSeconds: videoDuration,
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

          if (result.name) {
            console.log('Got operation:', result.name)
            const videoResult = await pollVertexVeoOperation(result.name, accessToken, videoDuration)

            if (videoResult && 'videoUrl' in videoResult) {
              return videoResult
            }

            // Content filtered — retry with simplified prompt
            if (videoResult && 'contentFiltered' in videoResult) {
              console.log('Content filtered on attempt', attempt + 1)
              if (attempt < promptsToTry.length - 1) {
                console.log('Retrying with simplified prompt...')
                continue
              }
              // Both attempts filtered — fall through to image with error message
              console.log('Both Veo attempts content-filtered, falling back to image...')
            } else {
              console.log('Veo polling returned null, falling back to image...')
            }
          }

          if (result.error) {
            console.log('Veo error:', result.error.message)
          }
        } else {
          const errText = await veoResponse.text()
          console.log('Veo Vertex AI error response:', errText.substring(0, 500))

          if (veoResponse.status === 429) {
            throw new HttpsError(
              'resource-exhausted',
              'Veo API rate limit exceeded. Please wait a few minutes and try again.'
            )
          }
        }

        // If we got here without continue or return, break to fall through
        break
      }

      // If Veo fails or returns no video, fall back to image generation
      console.log('Video generation not available, falling back to image generation...')

      const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`

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
            message: 'Veo content filter blocked the prompt. Try rephrasing your concept. Generated image instead.',
          }
        }
      }

      // Final fallback: use Gemini image generation
      console.log('Trying Gemini image generation...')

      const imageModels = [
        'gemini-2.5-flash-image',
        'gemini-3.1-flash-image-preview',
        'gemini-3-pro-image-preview'
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
              message: 'Veo video generation failed. Try a different or simpler prompt. Generated image instead.',
            }
          }
        }
        console.log('No image data found in response')
      }

      throw new HttpsError(
        'unimplemented',
        'Video and image generation both failed. Please try again later.'
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

// Poll Vertex AI Veo operation for video completion
// Returns null if video generation fails (to allow fallback to image)
type VeoResult = { videoUrl: string; durationSeconds: number } | { contentFiltered: true } | null

async function pollVertexVeoOperation(operationName: string, accessToken: string, videoDuration: number = 8): Promise<VeoResult> {
  const maxWaitTime = 300000 // 5 minutes
  const pollInterval = 5000 // 5 seconds
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, pollInterval))

    // Vertex AI Veo: poll using fetchPredictOperation on the model endpoint
    const modelMatch = operationName.match(/(projects\/[^/]+\/locations\/[^/]+\/publishers\/google\/models\/[^/]+)\/operations\//)
    const modelPath = modelMatch ? modelMatch[1] : `projects/${GCP_PROJECT}/locations/${GCP_REGION}/publishers/google/models/veo-3.1-generate-preview`
    const locationMatch = operationName.match(/locations\/([^/]+)/)
    const region = locationMatch ? locationMatch[1] : GCP_REGION
    const pollUrl = `https://${region}-aiplatform.googleapis.com/v1beta1/${modelPath}:fetchPredictOperation`
    console.log('Polling Vertex AI Veo operation:', pollUrl, 'opName:', operationName)

    const pollResponse = await fetch(pollUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ operationName }),
    })

    if (!pollResponse.ok) {
      console.log('Poll error:', pollResponse.status)
      const errText = await pollResponse.text()
      console.log('Poll error body:', errText.substring(0, 200))

      // If token expired during long poll, refresh it
      if (pollResponse.status === 401) {
        console.log('Token expired, refreshing...')
        accessToken = await getAccessToken()
      }
      continue
    }

    interface VeoPollResult {
      name?: string
      done?: boolean
      error?: { message?: string; code?: number }
      metadata?: unknown
      response?: {
        generateVideoResponse?: {
          generatedSamples?: Array<{
            video?: {
              uri?: string
              gcsUri?: string
              bytesBase64Encoded?: string
            }
          }>
        }
        videos?: Array<{
          uri?: string
          encoding?: string
          bytesBase64Encoded?: string
        }>
      }
    }

    const result = await pollResponse.json() as VeoPollResult
    console.log('Poll result done:', result.done, 'error:', result.error?.message)
    console.log('Poll result full:', JSON.stringify(result).substring(0, 500))

    if (result.error) {
      console.log('Veo operation error:', result.error.message)
      if (result.error.message?.includes('usage guidelines') || result.error.message?.includes('violate')) {
        return { contentFiltered: true }
      }
      return null // Return null to trigger fallback
    }

    // If done is true, we must exit the loop
    if (result.done) {
      // Check for inline base64 video data first (Veo returns this format)
      const inlineVideo = result.response?.videos?.[0]
      if (inlineVideo?.bytesBase64Encoded) {
        console.log('Video ready! Inline base64, size:', inlineVideo.bytesBase64Encoded.length)
        return {
          videoUrl: `data:video/mp4;base64,${inlineVideo.bytesBase64Encoded}`,
          durationSeconds: videoDuration,
        }
      }

      // Check generateVideoResponse format
      const sample = result.response?.generateVideoResponse?.generatedSamples?.[0]
      if (sample?.video?.bytesBase64Encoded) {
        console.log('Video ready! Inline base64 from generatedSamples, size:', sample.video.bytesBase64Encoded.length)
        return {
          videoUrl: `data:video/mp4;base64,${sample.video.bytesBase64Encoded}`,
          durationSeconds: videoDuration,
        }
      }

      // Check for URI-based video
      const videoUri = sample?.video?.uri || sample?.video?.gcsUri || inlineVideo?.uri

      if (videoUri) {
        console.log('Video ready! URI:', videoUri.substring(0, 100))

        // Fetch the video - use auth header for Vertex AI URIs
        let videoResponse: Response
        if (videoUri.startsWith('https://')) {
          const separator = videoUri.includes('?') ? '&' : '?'
          videoResponse = await fetch(`${videoUri}${separator}key=${geminiApiKey.value()}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          })
          if (!videoResponse.ok) {
            console.log('Fetch with auth failed:', videoResponse.status, ', retrying without auth...')
            videoResponse = await fetch(`${videoUri}${separator}key=${geminiApiKey.value()}`)
          }
        } else {
          const gcsUrl = videoUri.replace('gs://', 'https://storage.googleapis.com/')
          videoResponse = await fetch(gcsUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          })
        }

        if (videoResponse.ok) {
          const buffer = await videoResponse.arrayBuffer()
          const base64 = Buffer.from(buffer).toString('base64')
          console.log('Video fetched successfully, size:', buffer.byteLength)
          return {
            videoUrl: `data:video/mp4;base64,${base64}`,
            durationSeconds: videoDuration,
          }
        } else {
          console.log('Failed to fetch video:', videoResponse.status)
          const errText = await videoResponse.text()
          console.log('Fetch error:', errText.substring(0, 200))
          return null
        }
      }

      // done=true but no video - return null to trigger image fallback
      console.log('Operation done but no video found in response')
      console.log('Response keys:', JSON.stringify(Object.keys(result.response || {})))
      return null
    }
  }

  // Timeout - return null to trigger fallback
  console.log('Video generation timed out, falling back to image')
  return null
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

// Language name mapping
const languageNames: Record<string, string> = {
  'en': 'English',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'de': 'German',
  'es': 'Spanish',
  'fr': 'French',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'ar': 'Arabic',
  'el': 'Greek',
  'fa': 'Persian',
  'id': 'Indonesian',
  'th': 'Thai',
  'tr': 'Turkish',
  'uk': 'Ukrainian',
}

// Enhance story prompt
export const enhanceStoryPrompt = onCall(
  { secrets: [geminiApiKey], cors: true },
  async (request) => {
    const { prompt, language = 'en' } = request.data as { prompt?: string; language?: string }

    if (!prompt) {
      throw new HttpsError('invalid-argument', 'Prompt is required')
    }

    const langName = languageNames[language] || 'English'

    const systemPrompt = `You are a sci-fi story writer. Enhance the following story concept into a more detailed and compelling narrative premise. Add interesting characters, settings, and plot elements while keeping it suitable for a 10-page illustrated storybook. Keep it under 150 words.

IMPORTANT: Write your response in ${langName} language.

User's concept: ${prompt}

Enhanced concept (in ${langName}):`

    const data = await fetchGemini(
      `${API_BASE}/models/${TEXT_MODEL}:generateContent?key=${geminiApiKey.value()}`,
      { contents: [{ parts: [{ text: systemPrompt }] }] }
    )

    return { text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '' }
  }
)

// Text-to-Speech with mom/dad voice options
export const generateSpeech = onCall(
  { secrets: [geminiApiKey], cors: true },
  async (request) => {
    const { text, voice = 'mom', languageCode = 'en-US' } = request.data as {
      text?: string
      voice?: 'mom' | 'dad'
      languageCode?: string
    }

    if (!text) {
      throw new HttpsError('invalid-argument', 'Text is required')
    }

    const apiKey = geminiApiKey.value()

    // Voice configurations for mom and dad
    // Using Neural2 voices for natural sound
    const voiceConfigs: Record<string, { name: string; ssmlGender: string }> = {
      'mom': { name: `${languageCode}-Neural2-F`, ssmlGender: 'FEMALE' },
      'dad': { name: `${languageCode}-Neural2-D`, ssmlGender: 'MALE' },
    }

    // Fallback voice names for languages that might not have Neural2
    const fallbackVoices: Record<string, { mom: string; dad: string }> = {
      'en-US': { mom: 'en-US-Wavenet-F', dad: 'en-US-Wavenet-D' },
      'en-GB': { mom: 'en-GB-Wavenet-F', dad: 'en-GB-Wavenet-D' },
      'zh-CN': { mom: 'cmn-CN-Wavenet-A', dad: 'cmn-CN-Wavenet-B' },
      'zh-TW': { mom: 'cmn-TW-Wavenet-A', dad: 'cmn-TW-Wavenet-B' },
      'ja-JP': { mom: 'ja-JP-Wavenet-B', dad: 'ja-JP-Wavenet-D' },
      'ko-KR': { mom: 'ko-KR-Wavenet-A', dad: 'ko-KR-Wavenet-C' },
      'de-DE': { mom: 'de-DE-Wavenet-F', dad: 'de-DE-Wavenet-D' },
      'es-ES': { mom: 'es-ES-Wavenet-C', dad: 'es-ES-Wavenet-B' },
      'fr-FR': { mom: 'fr-FR-Wavenet-C', dad: 'fr-FR-Wavenet-D' },
      'it-IT': { mom: 'it-IT-Wavenet-A', dad: 'it-IT-Wavenet-C' },
      'pt-BR': { mom: 'pt-BR-Wavenet-A', dad: 'pt-BR-Wavenet-B' },
      'ru-RU': { mom: 'ru-RU-Wavenet-C', dad: 'ru-RU-Wavenet-D' },
      'ar-XA': { mom: 'ar-XA-Wavenet-A', dad: 'ar-XA-Wavenet-B' },
      'el-GR': { mom: 'el-GR-Wavenet-A', dad: 'el-GR-Standard-B' },
      'id-ID': { mom: 'id-ID-Wavenet-A', dad: 'id-ID-Wavenet-B' },
      'th-TH': { mom: 'th-TH-Standard-A', dad: 'th-TH-Standard-A' },
      'tr-TR': { mom: 'tr-TR-Wavenet-C', dad: 'tr-TR-Wavenet-B' },
      'uk-UA': { mom: 'uk-UA-Wavenet-A', dad: 'uk-UA-Standard-A' },
    }

    const selectedVoice = voiceConfigs[voice]
    const fallback = fallbackVoices[languageCode]

    // Try Neural2 first, then Wavenet fallback
    const voicesToTry = [
      selectedVoice.name,
      fallback?.[voice] || selectedVoice.name.replace('Neural2', 'Wavenet'),
      fallback?.[voice] || selectedVoice.name.replace('Neural2', 'Standard'),
    ]

    console.log('generateSpeech: text length:', text.length, 'voice:', voice, 'language:', languageCode)

    for (const voiceName of voicesToTry) {
      try {
        console.log('Trying voice:', voiceName)
        const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`

        const response = await fetch(ttsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text },
            voice: {
              languageCode: languageCode,
              name: voiceName,
              ssmlGender: selectedVoice.ssmlGender,
            },
            audioConfig: {
              audioEncoding: 'MP3',
              speakingRate: 0.9, // Slightly slower for storytelling
              pitch: voice === 'mom' ? 1.0 : -2.0, // Lower pitch for dad
            },
          }),
        })

        if (response.ok) {
          const result = await response.json() as { audioContent?: string }
          if (result.audioContent) {
            console.log('Speech generated successfully with voice:', voiceName)
            return {
              audioUrl: `data:audio/mp3;base64,${result.audioContent}`,
              voice: voiceName,
            }
          }
        } else {
          const errText = await response.text()
          console.log(`Voice ${voiceName} failed:`, errText.substring(0, 200))
        }
      } catch (err) {
        console.log(`Voice ${voiceName} error:`, err)
      }
    }

    throw new HttpsError('internal', 'Text-to-speech generation failed. Please try again.')
  }
)
