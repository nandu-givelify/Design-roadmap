import { initializeApp } from 'firebase/app'
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, where, getDocs, setDoc, getDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore'
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut as fbSignOut, onAuthStateChanged, updateProfile,
  sendPasswordResetEmail, fetchSignInMethodsForEmail,
} from 'firebase/auth'

export const DEFAULT_BOARD_PHASES = [
  { id: 'discovery',   name: 'Discovery',    color: '#60A5FA' },
  { id: 'ux',          name: 'UX',           color: '#FBBF24' },
  { id: 'ui',          name: 'UI',           color: '#FB923C' },
  { id: 'usertesting', name: 'User testing', color: '#A78BFA', optional: true },
  { id: 'handoff',     name: 'Handoff',      color: '#34D399' },
]

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
// Offline persistence: data is cached in IndexedDB so subsequent loads are instant.
// persistentMultipleTabManager lets you have the app open in multiple tabs safely.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
export const auth = getAuth(app)

// ── Auth ─────────────────────────────────────────────────────────────────────
export const signInWithGoogle   = () => signInWithPopup(auth, new GoogleAuthProvider())
export const signInEmail        = (email, pw) => signInWithEmailAndPassword(auth, email, pw)
export const signUpEmail        = (email, pw) => createUserWithEmailAndPassword(auth, email, pw)
export const signOutUser        = () => fbSignOut(auth)
export const onAuthChange       = (cb) => onAuthStateChanged(auth, cb)
export const updateUserProfile  = (data) => updateProfile(auth.currentUser, data)
export const resetPassword = (email) => sendPasswordResetEmail(auth, email)

// Sign-in methods already registered for this email ([] means no account
// exists yet) — reliable now that email enumeration protection is off for
// this project. Used on the sign-in screen to route a brand-new email
// straight to account creation instead of a dead-end password field.
export const getSignInMethods = (email) => fetchSignInMethodsForEmail(auth, email)

// ── User Profiles (global, cross-board) ──────────────────────────────────────
export const getUserProfile = (uid) =>
  getDoc(doc(db, 'userProfiles', uid)).then(s => s.exists() ? { id: s.id, ...s.data() } : null)

export const subscribeUserProfile = (uid, cb) =>
  onSnapshot(
    doc(db, 'userProfiles', uid),
    s  => cb(s.exists() ? { id: s.id, ...s.data() } : null, null),
    err => cb(null, err)
  )

export const setUserProfile = (uid, data) =>
  setDoc(doc(db, 'userProfiles', uid), data, { merge: true })

export const findProfileByEmail = async (email) => {
  const q = query(collection(db, 'userProfiles'), where('email', '==', email))
  const snap = await getDocs(q)
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
}

export const findBoardsByMemberEmail = async (email) => {
  const q = query(collection(db, 'boards'), where('memberEmails', 'array-contains', email))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ── User prefs (board order, etc.) ───────────────────────────────────────────
export const subscribeUserPrefs = (uid, cb) =>
  onSnapshot(doc(db, 'userPrefs', uid), (s) => cb(s.data() || {}))

export const updateUserPrefs = (uid, data) =>
  setDoc(doc(db, 'userPrefs', uid), data, { merge: true })

// ── Boards ───────────────────────────────────────────────────────────────────
export const subscribeBoards = (uid, email, cb, onError) => {
  let owned = [], membered = [], q1Done = false, q2Done = false
  const merge = () => {
    // Wait for BOTH queries to report at least once — firing after only one
    // has resolved reports a board list that's missing every board the other
    // query would have contributed (e.g. every board this user is a member
    // of but doesn't own), which downstream code reads as "no boards yet"
    // and reacts to by auto-creating a brand-new board.
    if (!q1Done || !q2Done) return
    const map = {}
    ;[...owned, ...membered].forEach((b) => { map[b.id] = b })
    cb(Object.values(map).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)))
  }
  const handleError = (markDone) => (err) => {
    console.error('Firestore boards error:', err.code, err.message)
    markDone()
    if (onError) onError(err)
    else merge() // fire with whatever's available so the app doesn't hang
  }
  const q1 = query(collection(db, 'boards'), where('ownerId', '==', uid))
  const q2 = query(collection(db, 'boards'), where('memberEmails', 'array-contains', email))
  const u1 = onSnapshot(q1, (s) => { owned    = s.docs.map((d) => ({ id: d.id, ...d.data() })); q1Done = true; merge() }, handleError(() => { q1Done = true }))
  const u2 = onSnapshot(q2, (s) => { membered = s.docs.map((d) => ({ id: d.id, ...d.data() })); q2Done = true; merge() }, handleError(() => { q2Done = true }))
  return () => { u1(); u2() }
}

export const createBoard = (data) =>
  addDoc(collection(db, 'boards'), {
    roles: ['Designer', 'PM', 'Dev'],
    memberEmails: [],
    members: {},
    boardPhases: DEFAULT_BOARD_PHASES,
    isPublic: false,
    ...data,
    createdAt: serverTimestamp(),
  })

export const updateBoard = (boardId, data) =>
  updateDoc(doc(db, 'boards', boardId), data)

export const deleteBoard = (boardId) =>
  deleteDoc(doc(db, 'boards', boardId))

export const subscribeBoard = (boardId, cb, onError) =>
  onSnapshot(
    doc(db, 'boards', boardId),
    (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null),
    onError || (() => {})
  )

// ── Org directory ─────────────────────────────────────────────────────────────
// People whose email is on a company domain (not gmail/outlook/etc.) are treated
// as belonging to one shared "organization" behind the scenes: we keep a single
// canonical orgMembers/{email} record for them so they can be found and reused
// across every board that shares that domain, instead of being re-entered per board.
const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com',
  'icloud.com', 'aol.com', 'live.com', 'msn.com',
  'protonmail.com', 'gmx.com',
])

export const getEmailDomain = (email) => email?.split('@')[1]?.trim().toLowerCase() || null
export const isOrgDomain = (domain) => !!domain && !GENERIC_EMAIL_DOMAINS.has(domain)

// Create/update the canonical org-directory entry for this person, keyed by email.
// No-ops for people without an email or on a generic personal-email domain.
// Best-effort: this is a nice-to-have directory sync, so a failure here (e.g.
// Firestore rules not yet updated to allow the `orgMembers` collection) must
// never block or fail the actual add/update-person action it's attached to.
const upsertOrgMember = async ({ name, email, photo }) => {
  const domain = getEmailDomain(email)
  if (!isOrgDomain(domain)) return false
  try {
    await setDoc(doc(db, 'orgMembers', email.trim().toLowerCase()), {
      name: name || null, email: email.trim().toLowerCase(), photo: photo || null, domain,
      updatedAt: serverTimestamp(),
    }, { merge: true })
    return true
  } catch (err) {
    console.warn('[orgMembers] sync skipped:', err.message)
    return false
  }
}

// All org-directory members sharing a company domain, e.g. everyone @givelify.com
// across every board — used to suggest already-known people instead of re-adding them.
export const subscribeOrgMembers = (domain, cb, onError) => {
  if (!isOrgDomain(domain)) { cb([]); return () => {} }
  return onSnapshot(
    query(collection(db, 'orgMembers'), where('domain', '==', domain)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError || (() => {})
  )
}

// One-time (safely re-runnable) backfill: scan every board's people and register
// anyone on a company email domain into the org directory, so existing colleagues
// show up as suggestions immediately instead of only people added from now on.
export const backfillOrgDirectory = async () => {
  const boardsSnap = await getDocs(collection(db, 'boards'))
  let scanned = 0, added = 0
  const addedEmails = []
  for (const boardDoc of boardsSnap.docs) {
    const peopleSnap = await getDocs(collection(db, 'boards', boardDoc.id, 'people'))
    for (const personDoc of peopleSnap.docs) {
      const data = personDoc.data()
      scanned++
      const domain = getEmailDomain(data.email)
      if (!isOrgDomain(domain)) continue
      const ok = await upsertOrgMember(data)
      if (ok) { added++; addedEmails.push(data.email.toLowerCase()) }
    }
  }
  return { boards: boardsSnap.size, scanned, added, addedEmails: [...new Set(addedEmails)] }
}

// ── People (board-scoped) ────────────────────────────────────────────────────
export const subscribePeople = (boardId, cb, onError) =>
  onSnapshot(
    collection(db, 'boards', boardId, 'people'),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError || (() => {})
  )

export const addPerson = async (boardId, data) => {
  const ref = await addDoc(collection(db, 'boards', boardId, 'people'), { ...data, createdAt: serverTimestamp() })
  if (data.email) {
    await updateDoc(doc(db, 'boards', boardId), { memberEmails: arrayUnion(data.email) })
    await upsertOrgMember(data)
  }
  return ref
}

export const addPersonWithId = async (boardId, id, data) => {
  await setDoc(doc(db, 'boards', boardId, 'people', id), { ...data, createdAt: serverTimestamp() })
  if (data.email) {
    await updateDoc(doc(db, 'boards', boardId), { memberEmails: arrayUnion(data.email) })
    await upsertOrgMember(data)
  }
}

export const updatePerson = async (boardId, id, data) => {
  await updateDoc(doc(db, 'boards', boardId, 'people', id), data)
  // If an email is being added/changed, keep board's memberEmails in sync
  // so findBoardsByMemberEmail can discover this board for that person
  if (data.email) {
    await updateDoc(doc(db, 'boards', boardId), { memberEmails: arrayUnion(data.email) })
    await upsertOrgMember(data)
  }
}

export const deletePerson = (boardId, id) =>
  deleteDoc(doc(db, 'boards', boardId, 'people', id))

export const getPeopleOnce = (boardId) =>
  getDocs(collection(db, 'boards', boardId, 'people'))
    .then(s => s.docs.map(d => ({ id: d.id, ...d.data() })))

// ── Time off (stored as array field on person document) ──────────────────────
// Each entry: { id: string, start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', reason?: string }
export const addTimeOff = (boardId, personId, entry) =>
  updateDoc(doc(db, 'boards', boardId, 'people', personId), { timeOff: arrayUnion(entry) })

export const removeTimeOff = (boardId, personId, entry) =>
  updateDoc(doc(db, 'boards', boardId, 'people', personId), { timeOff: arrayRemove(entry) })

// User-level time off — stored in userProfiles so it applies across all boards
export const addUserTimeOff = (uid, entry) =>
  setDoc(doc(db, 'userProfiles', uid), { timeOff: arrayUnion(entry) }, { merge: true })
export const removeUserTimeOff = (uid, entry) =>
  setDoc(doc(db, 'userProfiles', uid), { timeOff: arrayRemove(entry) }, { merge: true })

// ── Tasks (board-scoped) ─────────────────────────────────────────────────────
export const subscribeTasks = (boardId, cb, onError) =>
  onSnapshot(
    collection(db, 'boards', boardId, 'tasks'),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError || (() => {})
  )

export const addTask = (boardId, data) =>
  addDoc(collection(db, 'boards', boardId, 'tasks'), { ...data, createdAt: serverTimestamp() })

export const updateTask = (boardId, id, data) =>
  updateDoc(doc(db, 'boards', boardId, 'tasks', id), data)

export const deleteTask = (boardId, id) =>
  deleteDoc(doc(db, 'boards', boardId, 'tasks', id))

// addTaskWithId — used for undo (restore deleted task with original ID)
export const addTaskWithId = (boardId, id, data) =>
  setDoc(doc(db, 'boards', boardId, 'tasks', id), data)

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
