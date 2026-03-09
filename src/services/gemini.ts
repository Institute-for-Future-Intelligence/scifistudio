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
  onProgress?.('Generating storybook (this may take a few minutes)...', 0)

  const generateStorybookFn = httpsCallable<
    { prompt: string; frameCount: number },
    { frames: StoryFrame[] }
  >(functions, 'generateStorybook', { timeout: 540000 })

  const result = await generateStorybookFn({ prompt, frameCount })

  onProgress?.('Storybook complete!', frameCount)
  return result.data.frames
}

export const enhanceStoryPrompt = async (userPrompt: string): Promise<string> => {
  const enhancePromptFn = httpsCallable<{ prompt: string }, { text: string }>(
    functions,
    'enhanceStoryPrompt'
  )
  const result = await enhancePromptFn({ prompt: userPrompt })
  return result.data.text
}

export const generateVideo = async (
    _prompt: string,
  onProgress?: (status: string) => void
): Promise<string> => {
  onProgress?.('Video generation not yet available via Cloud Functions')
  throw new Error('Video generation requires additional setup')
}

export const enhanceVideoPrompt = async (userPrompt: string): Promise<string> => {
  return generateWithGemini(
    `You are a video prompt engineer. Enhance the following video concept into a detailed, cinematic prompt suitable for AI video generation. Include visual details, camera movements, lighting, and atmosphere. Keep it under 200 words.\n\nUser's concept: ${userPrompt}\n\nEnhanced prompt:`
  )
}
