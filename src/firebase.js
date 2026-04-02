import { initializeApp } from 'firebase/app'
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

// ── People ──────────────────────────────────────────────────────────────────
export const subscribePeople = (cb) =>
  onSnapshot(collection(db, 'people'), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )

export const addPerson = (data) =>
  addDoc(collection(db, 'people'), { ...data, createdAt: serverTimestamp() })

export const updatePerson = (id, data) =>
  updateDoc(doc(db, 'people', id), data)

export const deletePerson = (id) => deleteDoc(doc(db, 'people', id))

// ── Teams ───────────────────────────────────────────────────────────────────
export const subscribeTeams = (cb) =>
  onSnapshot(collection(db, 'teams'), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )

export const addTeam = (data) =>
  addDoc(collection(db, 'teams'), { ...data, createdAt: serverTimestamp() })

export const updateTeam = (id, data) =>
  updateDoc(doc(db, 'teams', id), data)

export const deleteTeam = (id) => deleteDoc(doc(db, 'teams', id))

// ── Tasks ───────────────────────────────────────────────────────────────────
export const subscribeTasks = (cb) =>
  onSnapshot(collection(db, 'tasks'), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  )

export const addTask = (data) =>
  addDoc(collection(db, 'tasks'), { ...data, createdAt: serverTimestamp() })

export const updateTask = (id, data) =>
  updateDoc(doc(db, 'tasks', id), data)

export const deleteTask = (id) => deleteDoc(doc(db, 'tasks', id))
