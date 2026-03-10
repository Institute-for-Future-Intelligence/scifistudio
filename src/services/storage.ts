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
