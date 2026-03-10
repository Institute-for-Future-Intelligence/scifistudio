import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { StoryFrame } from './gemini'
import { uploadStorybookImages } from './storage'

export interface Project {
  id?: string
  userId: string
  title: string
  description: string
  type: 'story' | 'video'
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface StorybookRating {
  oderId: string
  rating: number
  createdAt: Timestamp
}

export interface Storybook {
  id?: string
  userId: string
  authorName?: string
  title: string
  prompt: string
  frames: StoryFrame[]
  language?: string
  tags?: string[]
  ratings?: StorybookRating[]
  averageRating?: number
  ratingCount?: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface VideoRating {
  oderId: string
  rating: number
  createdAt: Timestamp
}

export interface Video {
  id?: string
  userId: string
  authorName?: string
  title: string
  prompt: string
  videoUrl: string
  thumbnailUrl?: string
  durationSeconds?: number
  tags?: string[]
  ratings?: VideoRating[]
  averageRating?: number
  ratingCount?: number
  status: 'generating' | 'completed' | 'failed'
  createdAt: Timestamp
  updatedAt: Timestamp
}

const projectsCollection = collection(db, 'projects')
const storybooksCollection = collection(db, 'storybooks')
const videosCollection = collection(db, 'videos')

// Projects
export const getProjects = async (userId: string): Promise<Project[]> => {
  const q = query(
    projectsCollection,
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Project))
}

export const getProject = async (id: string): Promise<Project | null> => {
  const docRef = doc(db, 'projects', id)
  const snapshot = await getDoc(docRef)
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...snapshot.data() } as Project
}

export const createProject = async (
  project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const now = Timestamp.now()
  const docRef = await addDoc(projectsCollection, {
    ...project,
    createdAt: now,
    updatedAt: now,
  })
  return docRef.id
}

export const updateProject = async (
  id: string,
  updates: Partial<Omit<Project, 'id' | 'createdAt'>>
): Promise<void> => {
  const docRef = doc(db, 'projects', id)
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  })
}

export const deleteProject = async (id: string): Promise<void> => {
  const docRef = doc(db, 'projects', id)
  await deleteDoc(docRef)
}

// Storybooks
export const getStorybooks = async (userId: string): Promise<Storybook[]> => {
  const q = query(
    storybooksCollection,
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Storybook))
}

export const getStorybook = async (id: string): Promise<Storybook | null> => {
  const docRef = doc(db, 'storybooks', id)
  const snapshot = await getDoc(docRef)
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...snapshot.data() } as Storybook
}

export const createStorybook = async (
  storybook: Omit<Storybook, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  console.log('Creating storybook:', storybook.title)
  console.log('Frames count:', storybook.frames.length)
  console.log('Tags to save:', storybook.tags)

  // Generate a new document reference to get the ID
  const docRef = doc(storybooksCollection)
  const storybookId = docRef.id
  console.log('Generated storybook ID:', storybookId)

  try {
    // Upload images to Firebase Storage first
    console.log('Uploading images to Storage...')
    const uploadedFrames = await uploadStorybookImages(
      storybook.userId,
      storybookId,
      storybook.frames
    )
    console.log('Images uploaded successfully')

    // Now save to Firestore with Storage URLs instead of base64
    const now = Timestamp.now()
    const dataToSave = {
      ...storybook,
      frames: uploadedFrames,
      createdAt: now,
      updatedAt: now,
    }
    console.log('Final data to save in Firestore:', dataToSave)
    console.log('Tags in final data:', dataToSave.tags)
    await setDoc(docRef, dataToSave)
    console.log('Storybook saved with ID:', storybookId)
    return storybookId
  } catch (error) {
    console.error('Firestore save error:', error)
    throw error
  }
}

export const updateStorybook = async (
  id: string,
  updates: Partial<Omit<Storybook, 'id' | 'createdAt'>>,
  userId?: string
): Promise<void> => {
  console.log('Updating storybook:', id)
  console.log('Tags in updates:', updates.tags)

  const docRef = doc(db, 'storybooks', id)

  let finalUpdates = { ...updates }

  // If frames are being updated and contain base64 images, upload them first
  if (updates.frames && userId) {
    const hasBase64Images = updates.frames.some(
      (frame) => frame.imageUrl?.startsWith('data:')
    )
    if (hasBase64Images) {
      console.log('Uploading new images to Storage...')
      const uploadedFrames = await uploadStorybookImages(userId, id, updates.frames)
      finalUpdates = { ...finalUpdates, frames: uploadedFrames }
      console.log('Images uploaded successfully')
    }
  }

  const dataToUpdate = {
    ...finalUpdates,
    updatedAt: Timestamp.now(),
  }
  console.log('Final data to update in Firestore:', dataToUpdate)
  await updateDoc(docRef, dataToUpdate)
}

export const deleteStorybook = async (id: string): Promise<void> => {
  const docRef = doc(db, 'storybooks', id)
  await deleteDoc(docRef)
}

// Videos
export const getVideos = async (userId: string): Promise<Video[]> => {
  const q = query(
    videosCollection,
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Video))
}

export const getVideo = async (id: string): Promise<Video | null> => {
  const docRef = doc(db, 'videos', id)
  const snapshot = await getDoc(docRef)
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...snapshot.data() } as Video
}

export const createVideo = async (
  video: Omit<Video, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const now = Timestamp.now()
  const docRef = await addDoc(videosCollection, {
    ...video,
    createdAt: now,
    updatedAt: now,
  })
  return docRef.id
}

export const updateVideo = async (
  id: string,
  updates: Partial<Omit<Video, 'id' | 'createdAt'>>
): Promise<void> => {
  const docRef = doc(db, 'videos', id)
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  })
}

export const deleteVideo = async (id: string): Promise<void> => {
  const docRef = doc(db, 'videos', id)
  await deleteDoc(docRef)
}

export const rateVideo = async (
  videoId: string,
  oderId: string,
  rating: number
): Promise<{ averageRating: number; ratingCount: number }> => {
  const docRef = doc(db, 'videos', videoId)
  const snapshot = await getDoc(docRef)

  if (!snapshot.exists()) {
    throw new Error('Video not found')
  }

  const data = snapshot.data() as Video
  const existingRatings = data.ratings || []

  // Check if user already rated
  const existingIndex = existingRatings.findIndex(r => r.oderId === oderId)

  const newRating: VideoRating = {
    oderId,
    rating,
    createdAt: Timestamp.now(),
  }

  let updatedRatings: VideoRating[]
  if (existingIndex >= 0) {
    // Update existing rating
    updatedRatings = [...existingRatings]
    updatedRatings[existingIndex] = newRating
  } else {
    // Add new rating
    updatedRatings = [...existingRatings, newRating]
  }

  // Calculate average
  const totalRating = updatedRatings.reduce((sum, r) => sum + r.rating, 0)
  const averageRating = totalRating / updatedRatings.length
  const ratingCount = updatedRatings.length

  await updateDoc(docRef, {
    ratings: updatedRatings,
    averageRating,
    ratingCount,
  })

  return { averageRating, ratingCount }
}

export const rateStorybook = async (
  storybookId: string,
  oderId: string,
  rating: number
): Promise<{ averageRating: number; ratingCount: number }> => {
  const docRef = doc(db, 'storybooks', storybookId)
  const snapshot = await getDoc(docRef)

  if (!snapshot.exists()) {
    throw new Error('Storybook not found')
  }

  const data = snapshot.data() as Storybook
  const existingRatings = data.ratings || []

  // Check if user already rated
  const existingIndex = existingRatings.findIndex(r => r.oderId === oderId)

  const newRating: StorybookRating = {
    oderId,
    rating,
    createdAt: Timestamp.now(),
  }

  let updatedRatings: StorybookRating[]
  if (existingIndex >= 0) {
    // Update existing rating
    updatedRatings = [...existingRatings]
    updatedRatings[existingIndex] = newRating
  } else {
    // Add new rating
    updatedRatings = [...existingRatings, newRating]
  }

  // Calculate average
  const totalRating = updatedRatings.reduce((sum, r) => sum + r.rating, 0)
  const averageRating = totalRating / updatedRatings.length
  const ratingCount = updatedRatings.length

  await updateDoc(docRef, {
    ratings: updatedRatings,
    averageRating,
    ratingCount,
  })

  return { averageRating, ratingCount }
}
