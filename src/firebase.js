import { initializeApp } from 'firebase/app'
import {
  getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, where, getDocs, setDoc, getDoc,
} from 'firebase/firestore'
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut as fbSignOut, onAuthStateChanged, updateProfile,
  fetchSignInMethodsForEmail, sendPasswordResetEmail,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db   = getFirestore(app)
export const auth = getAuth(app)

// ── Auth ─────────────────────────────────────────────────────────────────────
export const signInWithGoogle   = () => signInWithPopup(auth, new GoogleAuthProvider())
export const signInEmail        = (email, pw) => signInWithEmailAndPassword(auth, email, pw)
export const signUpEmail        = (email, pw) => createUserWithEmailAndPassword(auth, email, pw)
export const signOutUser        = () => fbSignOut(auth)
export const onAuthChange       = (cb) => onAuthStateChanged(auth, cb)
export const updateUserProfile  = (data) => updateProfile(auth.currentUser, data)
export const checkEmailExists   = (email) => fetchSignInMethodsForEmail(auth, email).then((m) => m.length > 0)
export const resetPassword      = (email) => sendPasswordResetEmail(auth, email)

// ── Boards ───────────────────────────────────────────────────────────────────
export const subscribeBoards = (uid, email, cb) => {
  let owned = [], membered = []
  const merge = () => {
    const map = {}
    ;[...owned, ...membered].forEach((b) => { map[b.id] = b })
    cb(Object.values(map).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)))
  }
  const q1 = query(collection(db, 'boards'), where('ownerId', '==', uid))
  const q2 = query(collection(db, 'boards'), where('memberEmails', 'array-contains', email))
  const u1 = onSnapshot(q1, (s) => { owned    = s.docs.map((d) => ({ id: d.id, ...d.data() })); merge() })
  const u2 = onSnapshot(q2, (s) => { membered = s.docs.map((d) => ({ id: d.id, ...d.data() })); merge() })
  return () => { u1(); u2() }
}

export const createBoard = (data) =>
  addDoc(collection(db, 'boards'), {
    roles: ['Designer', 'PM', 'Dev'],
    memberEmails: [],
    members: {},
    ...data,
    createdAt: serverTimestamp(),
  })

export const updateBoard = (boardId, data) =>
  updateDoc(doc(db, 'boards', boardId), data)

export const subscribeBoard = (boardId, cb) =>
  onSnapshot(doc(db, 'boards', boardId), (s) =>
    cb(s.exists() ? { id: s.id, ...s.data() } : null))

// ── People (board-scoped) ────────────────────────────────────────────────────
export const subscribePeople = (boardId, cb) =>
  onSnapshot(collection(db, 'boards', boardId, 'people'), (s) =>
    cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))))

export const addPerson = (boardId, data) =>
  addDoc(collection(db, 'boards', boardId, 'people'), { ...data, createdAt: serverTimestamp() })

export const addPersonWithId = (boardId, id, data) =>
  setDoc(doc(db, 'boards', boardId, 'people', id), { ...data, createdAt: serverTimestamp() })

export const updatePerson = (boardId, id, data) =>
  updateDoc(doc(db, 'boards', boardId, 'people', id), data)

export const deletePerson = (boardId, id) =>
  deleteDoc(doc(db, 'boards', boardId, 'people', id))

// ── Tasks (board-scoped) ─────────────────────────────────────────────────────
export const subscribeTasks = (boardId, cb) =>
  onSnapshot(collection(db, 'boards', boardId, 'tasks'), (s) =>
    cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))))

export const addTask = (boardId, data) =>
  addDoc(collection(db, 'boards', boardId, 'tasks'), { ...data, createdAt: serverTimestamp() })

export const updateTask = (boardId, id, data) =>
  updateDoc(doc(db, 'boards', boardId, 'tasks', id), data)

export const deleteTask = (boardId, id) =>
  deleteDoc(doc(db, 'boards', boardId, 'tasks', id))

// ── Migration (one-time from root-level legacy data) ─────────────────────────
// Migrates old top-level people/teams/tasks collections into the first board.
// Marks completion in _meta/migration so it only ever runs once.
export const checkAndRunMigration = async (uid, email) => {
  // Already migrated?
  const metaSnap = await getDoc(doc(db, '_meta', 'migration'))
  if (metaSnap.exists()) return null

  // Check for legacy root-level data
  const [pSnap, tSnap, taskSnap] = await Promise.all([
    getDocs(collection(db, 'people')),
    getDocs(collection(db, 'teams')),
    getDocs(collection(db, 'tasks')),
  ])

  // No legacy data → user is brand new, create empty board elsewhere
  if (pSnap.empty && tSnap.empty && taskSnap.empty) return null

  // Create the board
  const boardRef = await addDoc(collection(db, 'boards'), {
    name: 'Design Board',
    ownerId: uid,
    ownerEmail: email,
    memberEmails: [],
    members: {},
    roles: ['Designer', 'PM', 'Dev'],
    createdAt: serverTimestamp(),
  })
  const boardId = boardRef.id

  // Migrate people → board people with role 'Designer'
  await Promise.all(pSnap.docs.map((d) =>
    setDoc(doc(db, 'boards', boardId, 'people', d.id), {
      ...d.data(),
      role: d.data().role || 'Designer',
    })
  ))

  // Migrate teams → board people with role 'PM'
  await Promise.all(tSnap.docs.map((d) =>
    setDoc(doc(db, 'boards', boardId, 'people', d.id), {
      name:  d.data().name,
      photo: d.data().photo || null,
      color: d.data().color || '#6366f1',
      email: d.data().email || null,
      role:  'PM',
      createdAt: d.data().createdAt || serverTimestamp(),
    })
  ))

  // Migrate tasks: rename teamId → pmId
  await Promise.all(taskSnap.docs.map((d) => {
    const data = { ...d.data() }
    if ('teamId' in data) { data.pmId = data.teamId; delete data.teamId }
    return setDoc(doc(db, 'boards', boardId, 'tasks', d.id), data)
  }))

  // Mark migration done
  await setDoc(doc(db, '_meta', 'migration'), {
    done: true, boardId, migratedAt: serverTimestamp(),
  })

  return boardId
}

// Auto-add board member when a task is assigned to an email
export const ensureBoardMember = async (boardId, email, access = 'view') => {
  if (!email) return
  const boardSnap = await getDoc(doc(db, 'boards', boardId))
  if (!boardSnap.exists()) return
  const { memberEmails = [], members = {} } = boardSnap.data()
  if (memberEmails.includes(email)) return
  await updateDoc(doc(db, 'boards', boardId), {
    memberEmails: [...memberEmails, email],
    [`members.${email.replace(/\./g, '_')}`]: { access, addedAt: serverTimestamp() },
  })
}
