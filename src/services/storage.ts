import { ref, uploadString, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

export const uploadBase64Video = async (
  base64Data: string,
  path: string
): Promise<string> => {
  // Remove data URL prefix if present (e.g., "data:video/mp4;base64,...")
  const base64Content = base64Data.includes(',')
    ? base64Data.split(',')[1]
    : base64Data

  // Detect content type from data URL
  let contentType = 'video/mp4'
  if (base64Data.startsWith('data:')) {
    const match = base64Data.match(/^data:([^;]+);/)
    if (match) contentType = match[1]
  }

  // Convert base64 to Uint8Array for uploadBytes (more efficient for large files)
  const binaryString = atob(base64Content)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, bytes, { contentType })

  const downloadUrl = await getDownloadURL(storageRef)
  return downloadUrl
}

export const uploadBase64Image = async (
  base64Data: string,
  path: string
): Promise<string> => {
  // Remove data URL prefix if present
  const base64Content = base64Data.includes(',')
    ? base64Data.split(',')[1]
    : base64Data

  const storageRef = ref(storage, path)
  await uploadString(storageRef, base64Content, 'base64', {
    contentType: 'image/png',
  })

  const downloadUrl = await getDownloadURL(storageRef)
  return downloadUrl
}

export const deleteVideoFiles = async (userId: string, videoId: string): Promise<void> => {
  const files = ['video.mp4', 'video.png', 'thumbnail.jpg']
  await Promise.all(
    files.map(file =>
      deleteObject(ref(storage, `videos/${userId}/${videoId}/${file}`)).catch(() => {})
    )
  )
}

export const uploadStorybookImages = async (
  userId: string,
  storybookId: string,
  frames: Array<{ caption: string; imageUrl: string }>
): Promise<Array<{ caption: string; imageUrl: string }>> => {
  const uploadedFrames = await Promise.all(
    frames.map(async (frame, index) => {
      if (!frame.imageUrl || !frame.imageUrl.startsWith('data:')) {
        // Already a URL or empty, keep as is
        return frame
      }

      try {
        const path = `storybooks/${userId}/${storybookId}/frame_${index}.png`
        const downloadUrl = await uploadBase64Image(frame.imageUrl, path)
        return {
          caption: frame.caption,
          imageUrl: downloadUrl,
        }
      } catch (error) {
        console.error(`Failed to upload frame ${index}:`, error)
        return {
          caption: frame.caption,
          imageUrl: '', // Clear failed image
        }
      }
    })
  )

  return uploadedFrames
}
