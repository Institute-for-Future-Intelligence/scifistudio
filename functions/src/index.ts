import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'

// Define the secret - this will be stored in Google Cloud Secret Manager
const geminiApiKey = defineSecret('GEMINI_API_KEY')

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

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
      'gemini-2.0-flash-exp-image-generation',
      'gemini-2.0-flash-preview-image-generation',
      'imagen-3.0-generate-001'
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
      'gemini-2.0-flash-exp-image-generation',
      'gemini-2.0-flash-preview-image-generation',
      'imagen-3.0-generate-001'
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
          const videoResult = await pollVeoOperation(result.name, apiKey)
          if (videoResult) {
            return videoResult
          }
          // If polling returned null, fall through to image fallback
          console.log('Veo polling completed but no video produced, falling back to image...')
        }

        if (result.error) {
          console.log('Veo error:', result.error.message)
        }
      } else {
        const errText = await veoResponse.text()
        console.log('Veo error response:', errText.substring(0, 300))
      }

      // If Veo fails or returns no video, fall back to image generation
      console.log('Video generation not available, falling back to image generation...')

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
// Returns null if video generation fails (to allow fallback to image)
async function pollVeoOperation(operationName: string, apiKey: string): Promise<{ videoUrl: string; durationSeconds: number } | null> {
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
    console.log('Poll result full:', JSON.stringify(result).substring(0, 1000))

    if (result.error) {
      console.log('Veo operation error:', result.error.message)
      return null // Return null to trigger fallback
    }

    // If done is true, we must exit the loop
    if (result.done) {
      if (result.response?.videos?.[0]) {
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
            return null // Fallback to image
          }
        }
      }

      // done=true but no video - return null to trigger image fallback
      console.log('Operation done but no video found in response')
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
