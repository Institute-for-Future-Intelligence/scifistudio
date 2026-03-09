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

export const generateStorybook = async (
  prompt: string,
  frameCount: number = 10,
  onProgress?: (status: string, frame: number) => void
): Promise<StoryFrame[]> => {
  const frames: StoryFrame[] = []

  // Step 1: Generate story outline
  onProgress?.(`Creating story outline...`, 0)

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

export const enhanceStoryPrompt = async (userPrompt: string): Promise<string> => {
  const enhancePromptFn = httpsCallable<{ prompt: string }, { text: string }>(
    functions,
    'enhanceStoryPrompt'
  )
  const result = await enhancePromptFn({ prompt: userPrompt })
  return result.data.text
}

export interface VideoResult {
  videoUrl: string
  durationSeconds: number
}

export const generateVideo = async (
  prompt: string,
  onProgress?: (status: string) => void
): Promise<VideoResult> => {
  onProgress?.('Generating video with AI...')

  const generateVideoFn = httpsCallable<
    { prompt: string },
    { videoUrl: string; durationSeconds: number }
  >(functions, 'generateVideo', { timeout: 600000 }) // 10 min timeout

  const result = await generateVideoFn({ prompt })
  onProgress?.('Video generation complete!')
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

export const generateStoryTags = async (prompt: string, title: string): Promise<string[]> => {
  const generateTagsFn = httpsCallable<{ prompt: string; title: string }, { tags: string[] }>(
    functions,
    'generateStoryTags'
  )
  const result = await generateTagsFn({ prompt, title })
  return result.data.tags
}
