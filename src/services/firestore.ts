import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

export interface Project {
  id?: string
  userId: string
  title: string
  description: string
  type: 'story' | 'video'
  createdAt: Timestamp
  updatedAt: Timestamp
}

const projectsCollection = collection(db, 'projects')

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
