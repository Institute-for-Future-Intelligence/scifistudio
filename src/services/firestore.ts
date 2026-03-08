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

export interface Storybook {
  id?: string
  userId: string
  title: string
  prompt: string
  frames: StoryFrame[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

const projectsCollection = collection(db, 'projects')
const storybooksCollection = collection(db, 'storybooks')

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
    await setDoc(docRef, {
      ...storybook,
      frames: uploadedFrames,
      createdAt: now,
      updatedAt: now,
    })
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

  await updateDoc(docRef, {
    ...finalUpdates,
    updatedAt: Timestamp.now(),
  })
}

export const deleteStorybook = async (id: string): Promise<void> => {
  const docRef = doc(db, 'storybooks', id)
  await deleteDoc(docRef)
}
