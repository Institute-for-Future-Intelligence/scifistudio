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
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions'
import app from './firebase'

const functions = getFunctions(app)

// Connect to emulator in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, 'localhost', 5001)
}

export interface StoryFrame {
  caption: string
  imageUrl: string
}

export const generateWithGemini = async (prompt: string): Promise<string> => {
  const generateText = httpsCallable<{ prompt: string }, { text: string }>(
    functions,
    'generateText'
  )
  const result = await generateText({ prompt })
  return result.data.text
}

export const generateImage = async (prompt: string): Promise<string> => {
  const generateImageFn = httpsCallable<{ prompt: string }, { imageUrl: string }>(
    functions,
    'generateImage'
  )
  const result = await generateImageFn({ prompt })
  return result.data.imageUrl
}

// Language name mapping for prompts
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

export const generateStorybook = async (
  prompt: string,
  frameCount: number = 10,
  language: string = 'en',
  onProgress?: (status: string, frame: number) => void
): Promise<StoryFrame[]> => {
  const frames: StoryFrame[] = []
  const langName = languageNames[language] || 'English'

  // Step 1: Generate story outline
  onProgress?.(`Creating story outline...`, 0)

  const outlinePrompt = `Create a ${frameCount}-page sci-fi storybook based on this concept: "${prompt}"

IMPORTANT: Write ALL captions in ${langName} language.

For each page, provide:
1. A short caption (1-2 sentences) that tells the story - MUST be in ${langName}
2. A detailed visual description for illustration (in English for the image generator)

Format EXACTLY as:
PAGE 1:
Caption: [story text in ${langName}]
Visual: [detailed illustration description in English]

PAGE 2:
Caption: [story text in ${langName}]
Visual: [detailed illustration description in English]

...continue for all ${frameCount} pages.

Make it a compelling narrative with a beginning, middle, and end. Remember: Captions MUST be in ${langName}.`

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

  // Step 2: Generate images for each page one by one
  const totalPages = Math.min(pages.length, frameCount)

  for (let i = 0; i < totalPages; i++) {
    onProgress?.(`Generating image ${i + 1} of ${totalPages}...`, i + 1)

    try {
      const imagePrompt = `Create a beautiful sci-fi storybook illustration: ${pages[i].visual}. Style: cinematic, detailed, vibrant colors, suitable for a storybook.`
      const imageUrl = await generateImage(imagePrompt)

      frames.push({
        caption: pages[i].caption,
        imageUrl: imageUrl,
      })
    } catch (error) {
      console.error(`Failed to generate image for page ${i + 1}:`, error)
      // Continue with empty image
      frames.push({
        caption: pages[i].caption,
        imageUrl: '',
      })
    }
  }

  onProgress?.('Storybook complete!', totalPages)
  return frames
}

export const enhanceStoryPrompt = async (userPrompt: string, language: string = 'en'): Promise<string> => {
  const enhancePromptFn = httpsCallable<{ prompt: string; language: string }, { text: string }>(
    functions,
    'enhanceStoryPrompt'
  )
  const result = await enhancePromptFn({ prompt: userPrompt, language })
  return result.data.text
}

export interface VideoResult {
  videoUrl: string
  durationSeconds: number
  isImage?: boolean
  message?: string
}

export const generateVideo = async (
  prompt: string,
  durationSeconds: number = 8,
  onProgress?: (status: string) => void
): Promise<VideoResult> => {
  onProgress?.('Generating video with AI...')

  const generateVideoFn = httpsCallable<
    { prompt: string; durationSeconds: number },
    { videoUrl: string; durationSeconds: number; isImage?: boolean; message?: string }
  >(functions, 'generateVideo', { timeout: 600000 }) // 10 min timeout

  const result = await generateVideoFn({ prompt, durationSeconds })
  onProgress?.('Generation complete!')
  return result.data
}

export const enhanceVideoPrompt = async (userPrompt: string): Promise<string> => {
  const enhancePromptFn = httpsCallable<{ prompt: string }, { text: string }>(
    functions,
    'enhanceVideoPrompt'
  )
  const result = await enhancePromptFn({ prompt: userPrompt })
  return result.data.text
}

export const generateVideoTags = async (prompt: string, title: string): Promise<string[]> => {
  const generateTagsFn = httpsCallable<{ prompt: string; title: string }, { tags: string[] }>(
    functions,
    'generateVideoTags'
  )
  const result = await generateTagsFn({ prompt, title })
  return result.data.tags
}

export const generateStoryTags = async (prompt: string, title: string, language: string = 'en'): Promise<string[]> => {
  const generateTagsFn = httpsCallable<{ prompt: string; title: string; language: string }, { tags: string[] }>(
    functions,
    'generateStoryTags'
  )
  const result = await generateTagsFn({ prompt, title, language })
  return result.data.tags
}

export interface SpeechResult {
  audioUrl: string
  voice: string
}

export const generateSpeech = async (
  text: string,
  voice: 'mom' | 'dad' = 'mom',
  languageCode: string = 'en-US'
): Promise<SpeechResult> => {
  const generateSpeechFn = httpsCallable<
    { text: string; voice: 'mom' | 'dad'; languageCode: string },
    { audioUrl: string; voice: string }
  >(functions, 'generateSpeech', { timeout: 60000 })

  const result = await generateSpeechFn({ text, voice, languageCode })
  return result.data
}
