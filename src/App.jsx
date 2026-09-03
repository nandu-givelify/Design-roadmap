import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from './contexts/AuthContext'
import LoginPage from './components/LoginPage'
import LeftNav from './components/LeftNav'
import Header from './components/Header'
import Timeline from './components/Timeline'
import Settings from './components/Settings'
import PersonDetailsDialog from './components/PersonDetailsDialog'
import { TaskModal, EditTaskModal, ShareModal } from './components/Modals'
import {
  subscribeBoards, createBoard, updateBoard, deleteBoard,
  subscribePeople, subscribeTasks, subscribeBoard,
  addPerson, updatePerson, deletePerson,
  addTask, updateTask, deleteTask, addTaskWithId,
  checkAndRunMigration,
  subscribeUserPrefs, updateUserPrefs,
  DEFAULT_BOARD_PHASES,
  getUserProfile, setUserProfile, findBoardsByMemberEmail, subscribeUserProfile,
  getPeopleOnce, addTimeOff, removeTimeOff,
} from './firebase'
import { useHistory } from './hooks/useHistory'
import { parseLocalDate, diffDays, startOfDay, addDays, toDateString } from './utils/dateUtils'

const getQuarterForDate = (d) => Math.floor(d.getMonth() / 3) + 1

const isConfigured = import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'your_api_key_here'

export default function App() {
  const { user } = useAuth()

  const publicBoardId = new URLSearchParams(window.location.search).get('board')

  if (!isConfigured) return <SetupScreen />
  if (user === undefined) return <SplashScreen />  // still loading auth
  if (user === null) {
    if (publicBoardId) return <PublicBoardView boardId={publicBoardId} />
    return <LoginPage />
  }

  return <AuthenticatedApp user={user} />
}

// Shared constant — also used in ShareModal
export const PUBLIC_FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /boards/{boardId} {
      // Board doc: readable if signed in, or board is publicly accessible
      allow read: if request.auth != null
                  || resource.data.publicAccess in ['view', 'edit']
                  || resource.data.isPublic == true;
      // Only signed-in users can change board settings
      allow write: if request.auth != null;

      // Subcollections (tasks, people):
      match /{subcol}/{docId} {
        allow read: if request.auth != null
                    || get(/databases/$(database)/documents/boards/$(boardId))
                         .data.publicAccess in ['view', 'edit']
                    || get(/databases/$(database)/documents/boards/$(boardId))
                         .data.isPublic == true;
        // Write allowed if signed in, or board has public edit access
        allow write: if request.auth != null
                     || get(/databases/$(database)/documents/boards/$(boardId))
                          .data.publicAccess == 'edit';
      }
    }

    match /userPrefs/{uid} {
      allow read, write: if request.auth != null
                         && request.auth.uid == uid;
    }

    match /userProfiles/{uid} {
      allow read, write: if request.auth != null
                         && request.auth.uid == uid;
    }
  }
}`

function PublicBoardView({ boardId }) {
  const [board,  setBoard]  = useState(undefined)
  const [people, setPeople] = useState([])
  const [tasks,  setTasks]  = useState([])
  const [error,  setError]  = useState(null)
  const now = new Date()
  const [viewMode, setViewMode] = useState('quarter')
  const [year,     setYear]     = useState(now.getFullYear())
  const [quarter,  setQuarter]  = useState(Math.floor(now.getMonth() / 3) + 1)
  const [editingTask, setEditingTask] = useState(null)
  const [modal, setModal] = useState(null)

  useEffect(() => {
    const handleError = (err) => {
      if (err.code === 'permission-denied') setError('rules-needed')
      else setError(err.message || 'Unknown error')
    }
    const u1 = subscribeBoard(boardId, (b) => {
      if (!b) { setError('Board not found.'); return }
      // Support both new publicAccess field and legacy isPublic
      const accessible = b.publicAccess === 'view' || b.publicAccess === 'edit' || b.isPublic === true
      if (!accessible) { setError('private'); return }
      setBoard(b)
    }, handleError)
    const u2 = subscribePeople(boardId, setPeople, handleError)
    const u3 = subscribeTasks(boardId, setTasks, handleError)
    return () => { u1(); u2(); u3() }
  }, [boardId])

  if (board === undefined && !error) return <div className="loading-screen"><div>Loading board…</div></div>

  if (error) return (
    <div className="loading-screen">
      <div style={{ fontSize: 32 }}>🔒</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginTop: 12 }}>
        Sign in to access this board
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6, marginBottom: 20 }}>
        {error === 'private'
          ? 'This board is private.'
          : 'This board isn\'t publicly accessible.'}
        {' '}Sign in to request access.
      </div>
      <button style={{ padding: '10px 24px', background: '#111827', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        onClick={() => { window.location.search = '' }}>Sign in</button>
    </div>
  )

  const canEdit   = board.publicAccess === 'edit'
  const boardPhases = board.boardPhases || DEFAULT_BOARD_PHASES

  const handleUpdateTask = canEdit ? (id, data) => updateTask(boardId, id, data) : () => {}
  const handleDeleteTask = canEdit ? (id)       => deleteTask(boardId, id)        : () => {}
  const handleAddTask    = canEdit ? async (data) => { await addTask(boardId, data) } : () => {}

  return (
    <div className="app">
      <div className="main-content">
        <header className="header">
          <span className="header__board-title">{board.name}</span>
          <div className="header__spacer" />
          <div className="header__view-toggle">
            {['year','quarter'].map(m => (
              <button key={m} className={`header__view-btn${viewMode===m?' header__view-btn--active':''}`}
                onClick={() => setViewMode(m)}>{m === 'year' ? 'Year' : 'Quarter'}</button>
            ))}
          </div>
          {canEdit
            ? <div className="header__readonly-badge" style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#6ee7b7' }}>
                Editing as guest · <a href="/" style={{ color: '#065f46' }}>Sign in</a>
              </div>
            : <div className="header__readonly-badge">
                View only · <a href="/" style={{ color: '#92400e' }}>Sign in to edit</a>
              </div>
          }
        </header>

        <Timeline
          viewMode={viewMode} year={year} quarter={quarter}
          people={people} tasks={tasks} groupBy={board.defaultGroupBy || 'none'}
          filterPersonIds={[]}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
          onAddTaskForPerson={canEdit ? (assigneeId, startDate) => setModal({ type: 'task', assigneeId, startDate }) : () => {}}
          onEditTask={canEdit ? (task) => setEditingTask(task) : () => {}}
          boardPhases={boardPhases}
          readOnly={!canEdit}
        />

        {canEdit && modal?.type === 'task' && (
          <TaskModal
            onClose={() => setModal(null)}
            onSave={handleAddTask}
            people={people}
            roles={board.roles || ['Designer', 'PM', 'Dev']}
            boardPhases={boardPhases}
            defaultAssigneeId={modal.assigneeId}
            defaultStartDate={modal.startDate}
            onCreatePerson={() => {}}
            onAddRole={() => {}}
          />
        )}
        {canEdit && editingTask && (
          <EditTaskModal
            task={editingTask}
            onClose={() => setEditingTask(null)}
            onSave={(data) => handleUpdateTask(editingTask.id, data)}
            onDelete={() => handleDeleteTask(editingTask.id)}
            people={people}
            roles={board.roles || ['Designer', 'PM', 'Dev']}
            boardPhases={boardPhases}
            onCreatePerson={() => {}}
            onAddRole={() => {}}
          />
        )}
      </div>
    </div>
  )
}

// Compress a base64 image to max 400px / 80% JPEG before writing to Firestore
// Always compress + convert to JPEG so photos are small enough for Firestore
// (1MB document limit) and consistent across browsers.
// maxPx = 256 gives crisp avatars at ~15-30KB base64 — well within any limit.
async function compressImage(dataUrl, maxPx = 256, quality = 0.82) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl
  try {
    return await new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight
        // Always scale to maxPx (ensures JPEG conversion even for small PNGs)
        if (w > h) { h = Math.round(h * maxPx / w); w = maxPx }
        else        { w = Math.round(w * maxPx / h); h = maxPx }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => resolve(dataUrl)
      img.src = dataUrl
    })
  } catch { return dataUrl }
}

function AuthenticatedApp({ user }) {
  const [boards,        setBoards]        = useState([])
  // Pre-populate from URL so people+tasks subscribe immediately (no wait for boards list).
  const [activeBoardId, setActiveBoardId] = useState(() =>
    new URLSearchParams(window.location.search).get('board') || null
  )
  const [people,        setPeople]        = useState([])
  const [tasks,         setTasks]         = useState([])
  const [tasksLoaded,   setTasksLoaded]   = useState(false)
  const [loadingBoards, setLoadingBoards] = useState(true)
  const [migrating,     setMigrating]     = useState(false)
  const [settingsOpen,  setSettingsOpen]  = useState(false)
  const [dbError,       setDbError]       = useState(null)
  // Initialize from localStorage so the left nav always shows the right photo
  // even on boards where the user isn't a member, and even if Firestore rules
  // block the userProfiles collection.
  const [userProfile, setUserProfile_raw] = useState(() => {
    try {
      const cached = localStorage.getItem(`userProfile_${user?.uid}`)
      return cached ? JSON.parse(cached) : null
    } catch { return null }
  })
  // Wrap setter: always mirror to localStorage
  const setUserProfile_ = (updater) => {
    setUserProfile_raw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try { localStorage.setItem(`userProfile_${user?.uid}`, JSON.stringify(next)) } catch {}
      return next
    })
  }

  // Nav state — collapsed by default on mobile
  const isMobileInit = typeof window !== 'undefined' && window.innerWidth <= 640
  const [isMobile,  setIsMobile]  = useState(isMobileInit)
  const [navOpen,   setNavOpen]   = useState(!isMobileInit)
  const [navDocked, setNavDocked] = useState(!isMobileInit)

  // Timeline controls
  const now = new Date()
  const [viewMode,  setViewMode]  = useState('quarter')
  const [year,      setYear]      = useState(now.getFullYear())
  const [quarter,   setQuarter]   = useState(getQuarterForDate(now))
  const [groupBy,   setGroupBy]   = useState('none')

  // Modals
  const [modal,             setModal]             = useState(null)
  const [editingTask,       setEditingTask]        = useState(null)
  const [defaultAssigneeId, setDefaultAssigneeId]  = useState(null)
  const [defaultStartDate,  setDefaultStartDate]   = useState(null)

  // Person details dialog (unified for timeline click, settings, and profile)
  const [personDetailsOpen, setPersonDetailsOpen] = useState(false)
  const [selectedPersonId,  setSelectedPersonId]  = useState(null)

  // Filters
  const [filterPersonIds, setFilterPersonIds] = useState([])

  // Board ordering + favourites
  const [boardOrder,      setBoardOrder]      = useState([])
  const [favoriteBoardIds,setFavoriteBoardIds]= useState([])
  const boardSetupStarted = useRef(false)  // prevent double-creation

  const timelineRef = useRef(null)

  // Undo/redo
  const { push: pushHistory, undo: undoHistory, redo: redoHistory } = useHistory()
  const [undoToast, setUndoToast] = useState(null)
  const showToast = useCallback((msg) => { setUndoToast(msg); setTimeout(() => setUndoToast(null), 2500) }, [])

  // ── Auto-collapse nav on mobile resize; restore when back to desktop ───────
  useEffect(() => {
    const autoCollapsed = { current: false }
    const handle = () => {
      const mobile = window.innerWidth <= 640
      setIsMobile(mobile)
      if (mobile && !autoCollapsed.current) {
        autoCollapsed.current = true
        setNavOpen(false)
        setNavDocked(false)
      } else if (!mobile && autoCollapsed.current) {
        autoCollapsed.current = false
        setNavOpen(true)
        setNavDocked(true)
      }
    }
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  // ── Subscribe to user prefs (board order + favourites) ───────────────────
  useEffect(() => {
    if (!user) return
    return subscribeUserPrefs(user.uid, (prefs) => {
      setBoardOrder(prefs.boardOrder || [])
      setFavoriteBoardIds(prefs.favoriteBoardIds || [])
    })
  }, [user])

  // ── Sync user profile on login ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    // Seed local state with auth data — but don't overwrite a previously saved photo
    setUserProfile_(prev => ({
      email: user.email,
      ...(user.displayName ? { name: user.displayName } : {}),
      ...(user.photoURL    ? { photo: user.photoURL }   : {}),
      ...(prev || {}),  // locally cached values win over auth defaults
    }))
    // Best-effort write to Firestore (may fail if rules don't cover userProfiles)
    const loginData = { email: user.email }
    if (user.displayName) loginData.name  = user.displayName
    if (user.photoURL)    loginData.photo = user.photoURL
    try { setUserProfile(user.uid, loginData) } catch {}
    return subscribeUserProfile(user.uid, (profile, error) => {
      if (error) {
        console.error('userProfile subscription error (check Firestore rules for userProfiles collection):', error)
        return
      }
      if (!profile) return
      // Merge Firestore data — only use Firestore photo if it's a real value (not null/empty)
      // Firestore can have photo:null if the user's profile panel saved with no photo selected,
      // which would wipe the locally-cached photo on every login.
      setUserProfile_(prev => {
        const next = {
          ...(prev || {}),
          ...profile,
          photo: ('photo' in profile && profile.photo) ? profile.photo : (prev?.photo ?? null),
          name:  'name'  in profile ? profile.name  : (prev?.name  ?? null),
        }
        // Persist last-user info for the login page account picker
        try {
          localStorage.setItem('roadmap_lastUser', JSON.stringify({
            email: user.email,
            name:  next.name  || user.displayName || '',
            photo: next.photo || user.photoURL    || null,
          }))
        } catch {}
        return next
      })
    })
  }, [user]) // eslint-disable-line

  // ── Sorted boards (by user-defined order) ────────────────────────────────
  const sortedBoards = boardOrder.length > 0
    ? [...boards].sort((a, b) => {
        const ai = boardOrder.indexOf(a.id)
        const bi = boardOrder.indexOf(b.id)
        if (ai === -1 && bi === -1) return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
    : boards

  // ── Active board from URL ────────────────────────────────────────────────
  const getBoardIdFromUrl = () => new URLSearchParams(window.location.search).get('board')
  const setBoardIdInUrl   = (id) => {
    const url = new URL(window.location)
    if (id) url.searchParams.set('board', id)
    else url.searchParams.delete('board')
    window.history.replaceState({}, '', url)
  }

  // ── Load boards + run migration if needed ───────────────────────────────
  useEffect(() => {
    if (!user) return
    setLoadingBoards(true)
    const unsub = subscribeBoards(user.uid, user.email, async (bs) => {
      setDbError(null)
      setBoards(bs)
      setLoadingBoards(false)
      if (bs.length > 0) {
        const urlId = getBoardIdFromUrl()
        const found = bs.find((b) => b.id === urlId) || bs[0]
        setActiveBoardId((prev) => {
          if (prev && bs.find((b) => b.id === prev)) return prev
          setBoardIdInUrl(found.id)
          return found.id
        })
      } else if (!boardSetupStarted.current) {
        // No boards yet — guard against double-fire from two onSnapshot listeners
        boardSetupStarted.current = true
        setMigrating(true)
        try {
          const migratedId = await checkAndRunMigration(user.uid, user.email)
          if (!migratedId) {
            // Brand new user — create empty board
            const ref = await createBoard({ name: 'My Board', ownerId: user.uid, ownerEmail: user.email })
            setBoardIdInUrl(ref.id)
            setActiveBoardId(ref.id)
          }
        } finally {
          setMigrating(false)
        }
      }
    }, (err) => {
      setLoadingBoards(false)
      if (err.code === 'permission-denied') {
        setDbError('permission-denied')
      } else {
        setDbError(err.message)
      }
    })
    return unsub
  }, [user]) // eslint-disable-line

  // ── Subscribe to active board's data ────────────────────────────────────
  useEffect(() => {
    if (!activeBoardId) return
    setTasksLoaded(false)
    setPeople([])
    setTasks([])
    const u1 = subscribePeople(activeBoardId, (ps) => {
      setPeople(ps)
      // Cache people to localStorage for "recently added" suggestions
      try {
        const cache = JSON.parse(localStorage.getItem('recentPeople') || '{}')
        ps.forEach(p => {
          if (p.email) cache[p.email] = { name: p.name, email: p.email, photo: p.photo || null, role: p.role || null }
        })
        localStorage.setItem('recentPeople', JSON.stringify(cache))
      } catch {}
    })
    const u2 = subscribeTasks(activeBoardId, (ts) => { setTasks(ts); setTasksLoaded(true) })
    return () => { u1(); u2() }
  }, [activeBoardId])

  // ── Active board object ──────────────────────────────────────────────────
  const activeBoard = boards.find((b) => b.id === activeBoardId) || null
  const boardRoles  = activeBoard?.roles || ['Designer', 'PM', 'Dev']
  const boardPhases = activeBoard?.boardPhases || DEFAULT_BOARD_PHASES

  // ── Enrich people: overlay logged-in user's photo/name from userProfile ──────
  // Ensures the timeline shows the current photo even when the per-board person
  // entry has no email and the push sync couldn't match them.
  const enrichedPeople = useMemo(() => {
    if (!userProfile || !user?.email) return people
    const userEmail = user.email.toLowerCase()
    const userName  = (userProfile.name || user.displayName || '').toLowerCase()
    return people.map(p => {
      const emailMatch = p.email && p.email.toLowerCase() === userEmail
      const nameMatch  = !emailMatch && userName && p.name?.toLowerCase() === userName
      if (!emailMatch && !nameMatch) return p
      return {
        ...p,
        photo: userProfile.photo ?? p.photo ?? null,
        name:  userProfile.name  ?? p.name,
      }
    })
  }, [people, user, userProfile]) // eslint-disable-line

  // ── Recent people (from localStorage cache, excluding current board members) ──
  const recentPeople = useMemo(() => {
    try {
      const cache = JSON.parse(localStorage.getItem('recentPeople') || '{}')
      const currentEmails = new Set(people.map(p => p.email).filter(Boolean))
      return Object.values(cache).filter(p => p.email && !currentEmails.has(p.email))
    } catch { return [] }
  }, [people, activeBoardId]) // eslint-disable-line

  // ── Profile update handler — saves to userProfile + pushes to ALL boards ──
  const handleUpdateProfile = useCallback(async (data) => {
    if (!user) return
    // Compress photo before writing to Firestore (1MB document limit)
    const saveData = { ...data }
    if (saveData.photo) {
      saveData.photo = await compressImage(saveData.photo)
    } else if ('photo' in saveData) {
      // Don't write null/empty photo — ProfilePanel sends photo:null when no photo
      // was selected, which would wipe the existing photo from all storage layers.
      delete saveData.photo
    }
    // Update local state immediately
    setUserProfile_(prev => ({ ...(prev || {}), email: user.email, ...saveData }))
    // Firestore write — not best-effort: we await and surface errors so cloud sync failures are visible
    try {
      await setUserProfile(user.uid, saveData)
    } catch (e) {
      console.error('userProfile Firestore write failed:', e)
      // Surface to user if this was a photo update (most common cross-device sync issue)
      if (saveData.photo) {
        showToast('Photo saved locally but could not sync to cloud. Check Firestore rules for the userProfiles collection.')
      }
    }
    // Push photo/name change to every board the user appears on
    // Use loaded `boards` (includes owned + member boards) — findBoardsByMemberEmail only
    // finds boards where the user's email is in memberEmails, missing owned boards.
    try {
      const ue = user.email.toLowerCase()
      const un = (saveData.name || user.displayName || '').toLowerCase()
      await Promise.all(boards.map(async (board) => {
        const boardPeople = await getPeopleOnce(board.id)
        const match = boardPeople.find(p => p.email?.toLowerCase() === ue)
          || (un ? boardPeople.find(p => !p.email && p.name?.toLowerCase() === un) : null)
        if (!match) return
        const patch = {}
        if (saveData.name  !== undefined) patch.name  = saveData.name
        if (saveData.photo !== undefined) patch.photo = saveData.photo
        if (Object.keys(patch).length) await updatePerson(board.id, match.id, patch)
      }))
    } catch (e) { console.warn('Profile push failed:', e) }
  }, [user, boards, showToast]) // eslint-disable-line

  // ── Board person → profile sync handler ──────────────────────────────────
  const handleUpdatePerson = useCallback(async (id, data) => {
    updatePerson(activeBoardId, id, data)
    const person = people.find(p => p.id === id)

    const patch = {}
    if (data.name  !== undefined) patch.name  = data.name
    if (data.photo !== undefined) patch.photo = data.photo
    if (!Object.keys(patch).length) return

    // Identify if the person being edited is the logged-in user.
    // Match by email first; fall back to name for old entries that have no email stored.
    // Use the EDITED person's current name as the name key (most reliable — it's right here).
    const email     = (data.email ?? person?.email)?.trim()?.toLowerCase() || null
    const userEmail = user?.email?.toLowerCase()
    // Name of the person being edited — use this to find them on other boards
    const personName = (person?.name || '').toLowerCase()
    const myBoardPerson_ = people.find(p =>
      (p.email && p.email.toLowerCase() === userEmail) ||
      (!p.email && personName && p.name?.toLowerCase() === personName)
    )
    const myBoardPersonId = myBoardPerson_?.id

    // Also treat as own profile if this person IS the one found (id match via name/email)
    const isOwnProfile = (email && userEmail && email === userEmail) || (id === myBoardPersonId)

    if (isOwnProfile) {
      // Compress photo before writing to Firestore (1MB document limit)
      if (patch.photo) {
        patch.photo = await compressImage(patch.photo)
      } else if ('photo' in patch) {
        // Don't wipe an existing photo with null — only save real photos
        delete patch.photo
      }
      // Update local state immediately — persists across board switches even if Firestore rules block writes
      setUserProfile_(prev => ({ ...(prev || {}), email: user.email, ...patch }))
      // Best-effort Firestore write to userProfile collection
      try { await setUserProfile(user.uid, patch) } catch (e) { console.warn('userProfile write:', e) }
      // Push directly to ALL other boards using email OR person name for matching
      try {
        const ue = userEmail
        const un = personName  // use the actual person name, not displayName
        await Promise.all(boards.map(async (board) => {
          if (board.id === activeBoardId) return // already updated at top of this handler
          const ppl = await getPeopleOnce(board.id)
          const match = (ue && ppl.find(p => p.email?.toLowerCase() === ue))
            || (un && ppl.find(p => !p.email && p.name?.toLowerCase() === un))
          if (match) await updatePerson(board.id, match.id, patch)
        }))
      } catch (e) { console.warn('Cross-board push failed:', e) }
      return
    }

    // For any other person: push the change to all boards they appear on.
    // Use loaded `boards` state and match by email OR name (for entries without email).
    const pn = (person?.name || '').toLowerCase()
    if (!email && !pn) return
    try {
      await Promise.all(boards.map(async (board) => {
        if (board.id === activeBoardId) return  // already updated above
        const ppl   = await getPeopleOnce(board.id)
        const match = (email && ppl.find(p => p.email?.toLowerCase() === email))
          || (pn && ppl.find(p => !p.email && p.name?.toLowerCase() === pn))
        if (match) await updatePerson(board.id, match.id, patch)
      }))
    } catch (e) { console.warn('Cross-board person sync failed:', e) }
  }, [user, people, activeBoardId, userProfile, boards]) // eslint-disable-line

  // (per-board reconciliation removed — userProfile is now the single source of truth;
  //  the push sync effect below handles propagation to all boards)

  // ── One-time migration: if userProfile has no photo, pull one from any board ──
  // This recovers from the old bug that wiped photo on each login.
  // Runs once per session; never overwrites an explicitly cleared photo.
  const migrationRanRef = useRef(false)
  useEffect(() => {
    if (!user || migrationRanRef.current) return
    if (userProfile === null) return  // still loading (null = not yet subscribed)
    if (userProfile?.photo) { migrationRanRef.current = true; return } // already has photo
    migrationRanRef.current = true
    ;(async () => {
      try {
        const allBoards = await findBoardsByMemberEmail(user.email)
        for (const board of allBoards) {
          const ppl   = await getPeopleOnce(board.id)
          const match = ppl.find(p => p.email?.toLowerCase() === user.email?.toLowerCase())
          if (match?.photo) {
            const compressedPhoto = await compressImage(match.photo)
            await setUserProfile(user.uid, {
              photo: compressedPhoto,
              ...(match.name && !userProfile?.name ? { name: match.name } : {}),
            })
            break  // found one — stop
          }
        }
      } catch (e) { console.warn('Profile migration failed:', e) }
    })()
  }, [user, userProfile]) // eslint-disable-line

  // ── Push sync — whenever userProfile photo/name changes, update ALL boards ──
  // This is the source-of-truth push (not bidirectional — never pulls from boards).
  // No ref-based dedup here — the photo !== match.photo check inside prevents unnecessary
  // writes, and we need this to re-run whenever `boards` loads/changes.
  useEffect(() => {
    if (!user || !userProfile || !boards.length) return
    ;(async () => {
      try {
        // Use loaded `boards` instead of findBoardsByMemberEmail — the latter misses
        // boards the user OWNS (their email isn't in memberEmails on owned boards).
        const userEmail = user.email.toLowerCase()
        const userName  = (userProfile.name || user.displayName || '').toLowerCase()
        await Promise.all(boards.map(async (board) => {
          const ppl = await getPeopleOnce(board.id)
          // Match by email first; fall back to name for old entries that lack an email field
          const match = ppl.find(p => p.email?.toLowerCase() === userEmail)
            || (userName ? ppl.find(p => !p.email && p.name?.toLowerCase() === userName) : null)
          if (!match) return
          const updates = {}
          // Push the current value (including null for removals)
          if (userProfile.photo !== undefined && userProfile.photo !== match.photo) updates.photo = userProfile.photo ?? null
          if (userProfile.name  !== undefined && userProfile.name  !== match.name)  updates.name  = userProfile.name  ?? null
          if (Object.keys(updates).length) await updatePerson(board.id, match.id, updates)
        }))
      } catch (e) { console.warn('Push sync failed:', e) }
    })()
  }, [user, boards, userProfile?.photo, userProfile?.name]) // eslint-disable-line

  // ── Effective profile — userProfile is the source of truth ──────────────
  // - userProfile === null  → still loading, show board person as fast-path
  // effectiveProfile — board-independent. Left nav is the user's own profile,
  // it should never depend on whether they're a member of the active board.
  // Priority: cached userProfile → Google auth photo → initials only.
  const effectiveProfile = {
    ...(userProfile || {}),
    photo: userProfile?.photo ?? user.photoURL ?? null,
    name:  userProfile?.name  ?? user.displayName ?? user.email?.split('@')[0] ?? null,
  }

  // ── Access level ─────────────────────────────────────────────────────────
  const isOwner      = activeBoard?.ownerId === user.uid
  const memberKey    = user.email?.replace(/\./g, '_')
  const memberAccess = activeBoard?.members?.[memberKey]?.access
  const isMember     = activeBoard?.memberEmails?.includes(user.email)
  // Default: members added to the board get edit access unless explicitly restricted to 'view'
  const canEdit   = isOwner || memberAccess === 'edit' || (isMember && memberAccess !== 'view')
  const readOnly  = !canEdit

  // ── GroupBy: persisted to board doc so shared/public viewers see owner's setting ──
  const activeBoardIdRef = useRef(null)
  useEffect(() => {
    // Restore groupBy from board's saved value whenever the active board changes.
    // Wait until boards are loaded — on first render activeBoardId is set from URL
    // but boards may still be empty, so we skip until the board is actually found.
    if (!activeBoardId) return
    const board = boards.find(b => b.id === activeBoardId)
    if (!board) return  // boards not loaded yet; retry when boards updates
    if (activeBoardId === activeBoardIdRef.current) return
    activeBoardIdRef.current = activeBoardId
    setGroupBy(board.defaultGroupBy || 'none')
  }, [activeBoardId, boards]) // eslint-disable-line

  const handleGroupByChange = useCallback((value) => {
    setGroupBy(value)
    if (activeBoardId) updateBoard(activeBoardId, { defaultGroupBy: value })
  }, [activeBoardId])

  // ── Board selection ──────────────────────────────────────────────────────
  const handleSelectBoard = useCallback((id) => {
    setActiveBoardId(id)
    setBoardIdInUrl(id)
    setFilterPersonIds([])
    // groupBy is restored by the activeBoardId effect above
  }, [])

  // ── New board ────────────────────────────────────────────────────────────
  const handleNewBoard = useCallback(async () => {
    const name = window.prompt('Board name:')
    if (!name?.trim()) return
    const ref = await createBoard({ name: name.trim(), ownerId: user.uid, ownerEmail: user.email })
    // Auto-add creator as a person so their photo shows immediately
    const currentProfile = await getUserProfile(user.uid)
    await addPerson(ref.id, {
      name:  currentProfile?.name  || user.displayName || user.email.split('@')[0],
      email: user.email,
      photo: currentProfile?.photo || user.photoURL || null,
      role:  null,
    })
    setBoardIdInUrl(ref.id)
    setActiveBoardId(ref.id)
  }, [user])

  // ── Rename board ──────────────────────────────────────────────────────────
  const handleRenameBoard = useCallback((id, name) => {
    updateBoard(id, { name })
  }, [])

  // ── Delete board ──────────────────────────────────────────────────────────
  const handleDeleteBoard = useCallback((id) => {
    deleteBoard(id)
    if (activeBoardId === id) {
      const next = boards.find(b => b.id !== id)
      if (next) { setActiveBoardId(next.id); setBoardIdInUrl(next.id) }
      else { setActiveBoardId(null); setBoardIdInUrl(null) }
    }
  }, [activeBoardId, boards])

  // ── Share board ───────────────────────────────────────────────────────────
  const handleShareBoard = useCallback(() => {
    setModal('share')
  }, [])

  // ── Reorder boards ────────────────────────────────────────────────────────
  const handleReorderBoards = useCallback((newOrderIds) => {
    updateUserPrefs(user.uid, { boardOrder: newOrderIds })
  }, [user])

  // ── Toggle favourite ──────────────────────────────────────────────────────
  const handleToggleFavorite = useCallback((boardId) => {
    const next = favoriteBoardIds.includes(boardId)
      ? favoriteBoardIds.filter(id => id !== boardId)
      : [...favoriteBoardIds, boardId]
    updateUserPrefs(user.uid, { favoriteBoardIds: next })
  }, [user, favoriteBoardIds])

  // ── View mode ────────────────────────────────────────────────────────────
  const handleViewModeChange = useCallback((mode) => {
    const today = new Date()
    setYear(today.getFullYear())
    if (mode === 'quarter') setQuarter(getQuarterForDate(today))
    setViewMode(mode)
  }, [])

  const handleJumpToday = useCallback(() => {
    const today = new Date()
    setYear(today.getFullYear())
    setQuarter(getQuarterForDate(today))
    setTimeout(() => timelineRef.current?.scrollToToday(), 50)
  }, [])

  // ── Firebase task/person helpers ─────────────────────────────────────────
  const handleAddTask = useCallback(async (data) => {
    if (!activeBoardId) return
    const ref = await addTask(activeBoardId, data)
    pushHistory({
      description: `Created "${data.title}"`,
      undo: () => deleteTask(activeBoardId, ref.id),
      redo: () => addTaskWithId(activeBoardId, ref.id, data),
    })
    return ref
  }, [activeBoardId, pushHistory])

  const handleUpdateTask = useCallback(async (id, data) => {
    if (!activeBoardId) return
    const prevTask = tasks.find(t => t.id === id)
    await updateTask(activeBoardId, id, data)
    if (prevTask) {
      const prevData = Object.keys(data).reduce((acc, k) => ({
        ...acc, [k]: prevTask[k] !== undefined ? prevTask[k] : null
      }), {})
      pushHistory({
        description: `Updated "${prevTask.title}"`,
        undo: () => updateTask(activeBoardId, id, prevData),
        redo: () => updateTask(activeBoardId, id, data),
      })
    }
  }, [activeBoardId, tasks, pushHistory])

  const handleDeleteTask = useCallback(async (id) => {
    if (!activeBoardId) return
    const prevTask = tasks.find(t => t.id === id)
    await deleteTask(activeBoardId, id)
    if (prevTask) {
      const { id: _id, ...taskData } = prevTask
      pushHistory({
        description: `Deleted "${prevTask.title}"`,
        undo: () => addTaskWithId(activeBoardId, id, taskData),
        redo: () => deleteTask(activeBoardId, id),
      })
    }
  }, [activeBoardId, tasks, pushHistory])

  const handleCreatePerson = useCallback(async (data) => {
    if (!activeBoardId) return null
    const ref = await addPerson(activeBoardId, data)
    return ref.id
  }, [activeBoardId])

  // ── Board roles management ───────────────────────────────────────────────
  const handleAddRole = useCallback(async (role) => {
    if (!activeBoardId || !activeBoard) return
    const roles = activeBoard.roles || ['Designer', 'PM', 'Dev']
    if (roles.includes(role)) return
    await updateBoard(activeBoardId, { roles: [...roles, role] })
  }, [activeBoardId, activeBoard])

  // ── Board phases management ──────────────────────────────────────────────
  const handleUpdateBoardPhases = useCallback(async (newPhases) => {
    if (!activeBoardId) return
    await updateBoard(activeBoardId, { boardPhases: newPhases })
  }, [activeBoardId])

  // ── Migrate existing tasks: write smart default phases to tasks that have none ──
  const migratedBoardsRef = useRef(new Set())
  useEffect(() => {
    if (!activeBoardId || migratedBoardsRef.current.has(activeBoardId)) return
    if (!tasks.length || !boardPhases || !boardPhases.length) return
    migratedBoardsRef.current.add(activeBoardId)
    const ids = boardPhases.map(p => p.id)
    const hasSmart = ids.includes('discovery') && ids.includes('handoff') && ids.includes('ux') && ids.includes('ui')
    tasks.forEach(task => {
      if (task.phases && task.phases.length > 0) {
        // Migrate old handoff default of 7 → 3
        const handoffPhase = task.phases.find(p => p.id === 'handoff')
        if (handoffPhase && handoffPhase.days === 7) {
          const newPhases = task.phases.map(p =>
            p.id === 'handoff' ? { ...p, days: 3 } : p
          )
          updateTask(activeBoardId, task.id, { phases: newPhases })
        }
        return
      }
      const d = Math.max(1, Math.round((new Date(task.endDate) - new Date(task.startDate)) / 86400000) + 1)
      const n = boardPhases.length
      let phases
      if (hasSmart) {
        const discovery = Math.max(1, Math.min(7, Math.round(d * 0.25)))
        const handoff   = Math.max(1, Math.min(3, Math.round(d * 0.1)))
        const rem = Math.max(2, d - discovery - handoff)
        const ux = Math.max(1, Math.floor(rem / 2))
        const ui = Math.max(1, rem - ux)
        phases = boardPhases.map(bp => ({
          id: bp.id,
          days: bp.id === 'discovery' ? discovery : bp.id === 'handoff' ? handoff
              : bp.id === 'ux' ? ux : bp.id === 'ui' ? ui
              : Math.max(1, Math.floor(d / n)),
        }))
      } else {
        const eq = Math.max(1, Math.floor(d / n))
        phases = boardPhases.map((bp, i) => ({
          id: bp.id, days: i === n - 1 ? Math.max(1, d - eq * (n - 1)) : eq,
        }))
      }
      updateTask(activeBoardId, task.id, { phases })
    })
  }, [activeBoardId, tasks, boardPhases]) // eslint-disable-line

  // Share: ?board=boardId URL
  const getBoardShareUrl = () => {
    const url = new URL(window.location)
    url.searchParams.set('board', activeBoardId)
    return url.toString()
  }

  // ── Keyboard shortcuts: undo/redo ────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          const desc = redoHistory()
          if (desc) showToast(`Redid: ${desc}`)
        } else {
          const desc = undoHistory()
          if (desc) showToast(`Undid: ${desc}`)
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [undoHistory, redoHistory, showToast])

  if (dbError === 'permission-denied') return <PermissionErrorScreen />
  if (migrating) return <SplashScreen />
  if (loadingBoards) return <SplashScreen />

  const isNavHidden  = !navOpen
  const isNavOverlay = navOpen && !navDocked

  return (
    <div className="app">
      {!isNavHidden && (
        <LeftNav
          user={user}
          userProfile={effectiveProfile}
          onUpdateProfile={handleUpdateProfile}
          boards={sortedBoards}
          activeBoardId={activeBoardId}
          favoriteBoardIds={favoriteBoardIds}
          onSelectBoard={handleSelectBoard}
          onNewBoard={handleNewBoard}
          onReorderBoards={handleReorderBoards}
          onToggleFavorite={handleToggleFavorite}
          isOverlay={isNavOverlay}
          onClose={() => { setNavOpen(false); setNavDocked(false) }}
          onDock={() => setNavDocked(true)}
          onEditProfile={() => {
            const userPerson = enrichedPeople.find(p => p.email?.toLowerCase() === user?.email?.toLowerCase())
            if (userPerson) {
              setSelectedPersonId(userPerson.id)
              setPersonDetailsOpen(true)
            } else {
              // No person entry found — nothing to show
            }
          }}
        />
      )}

      {isNavOverlay && (
        <div className="nav-backdrop" onClick={() => setNavOpen(false)} />
      )}

      <div className="main-content">
        <Header
          board={activeBoard}
          viewMode={viewMode}
          setViewMode={handleViewModeChange}
          year={year} setYear={setYear}
          quarter={quarter} setQuarter={setQuarter}
          onJumpToday={handleJumpToday}
          onShare={() => handleShareBoard()}
          onSettings={() => setSettingsOpen(true)}
          onRenameBoard={handleRenameBoard}
          onDeleteBoard={handleDeleteBoard}
          people={enrichedPeople}
          filterPersonIds={filterPersonIds}
          setFilterPersonIds={setFilterPersonIds}
          groupBy={groupBy}
          setGroupBy={handleGroupByChange}
          roles={boardRoles}
          readOnly={readOnly}
          navCollapsed={isNavHidden}
          onOpenNav={() => { setNavOpen(true); setNavDocked(false) }}
        />

        <Timeline
          ref={timelineRef}
          viewMode={viewMode}
          year={year} quarter={quarter}
          people={enrichedPeople}
          tasks={tasks}
          groupBy={groupBy}
          filterPersonIds={filterPersonIds}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
          onAddTaskForPerson={(assigneeId, startDate) => {
            setDefaultAssigneeId(assigneeId)
            setDefaultStartDate(startDate || null)
            setModal('task')
          }}
          onEditTask={(task) => setEditingTask(task)}
          boardPhases={boardPhases}
          readOnly={readOnly}
          loading={!tasksLoaded}
          personColWidth={isMobile && groupBy !== 'none' ? 52 : undefined}
          onPersonClick={(person) => { setSelectedPersonId(person.id); setPersonDetailsOpen(true) }}
        />

        {/* Add Task modal */}
        {modal === 'task' && (
          <TaskModal
            onClose={() => { setModal(null); setDefaultStartDate(null) }}
            onSave={handleAddTask}
            people={enrichedPeople}
            roles={boardRoles}
            boardPhases={boardPhases}
            defaultAssigneeId={defaultAssigneeId}
            defaultStartDate={defaultStartDate}
            onCreatePerson={handleCreatePerson}
            onAddRole={handleAddRole}
          />
        )}

        {/* Edit Task modal */}
        {editingTask && (
          <EditTaskModal
            task={editingTask}
            onClose={() => setEditingTask(null)}
            onSave={(data) => handleUpdateTask(editingTask.id, data)}
            onDelete={() => handleDeleteTask(editingTask.id)}
            people={enrichedPeople}
            roles={boardRoles}
            boardPhases={boardPhases}
            onCreatePerson={handleCreatePerson}
            onAddRole={handleAddRole}
          />
        )}

        {/* Share modal */}
        {modal === 'share' && (
          <ShareModal
            onClose={() => setModal(null)}
            shareUrl={getBoardShareUrl()}
            board={activeBoard}
            onSetPublicAccess={(access) => updateBoard(activeBoardId, { publicAccess: access })}
          />
        )}

        {/* Settings dialog */}
        {settingsOpen && (
          <Settings
            onClose={() => setSettingsOpen(false)}
            boardId={activeBoardId}
            board={activeBoard}
            people={enrichedPeople}
            roles={boardRoles}
            boardPhases={boardPhases}
            onUpdatePerson={handleUpdatePerson}
            onDeletePerson={(id) => deletePerson(activeBoardId, id)}
            onAddPerson={(data) => addPerson(activeBoardId, data)}
            onAddRole={handleAddRole}
            onUpdateBoardPhases={handleUpdateBoardPhases}
            isOwner={isOwner}
            recentPeople={recentPeople}
            onRenameBoard={handleRenameBoard}
            onDeleteBoard={handleDeleteBoard}
            onPersonClick={(person) => { setSelectedPersonId(person.id); setPersonDetailsOpen(true) }}
          />
        )}

        {/* Unified person details + time off dialog */}
        {(() => {
          const livePerson = enrichedPeople.find(p => p.id === selectedPersonId) || null
          const isOwnProfile = livePerson?.email?.toLowerCase() === user?.email?.toLowerCase()
          const canEditPerson = isOwner || isOwnProfile

          const handleAddTO = async (entry) => {
            if (!livePerson || !activeBoardId) return
            await addTimeOff(activeBoardId, livePerson.id, entry)
            // Auto-extend overlapping tasks
            const toS = parseLocalDate(entry.start)
            const toE = parseLocalDate(entry.end)
            const personTasks = tasks.filter(t =>
              t.assigneeId === livePerson.id || t.pmId === livePerson.id
            )
            for (const task of personTasks) {
              const tS = parseLocalDate(task.startDate)
              const tE = parseLocalDate(task.endDate)
              if (tE < toS || tS > toE) continue
              const overlapStart = tS > toS ? tS : toS
              const overlapEnd   = tE < toE ? tE : toE
              const overlapDays  = diffDays(startOfDay(overlapStart), startOfDay(overlapEnd)) + 1
              if (overlapDays > 0) {
                await updateTask(activeBoardId, task.id, { endDate: toDateString(addDays(tE, overlapDays)) })
              }
            }
          }

          const handleUpdateP = isOwnProfile
            ? async (data) => {
                // Own profile: update global profile + person entry
                await handleUpdateProfile(data)
                await handleUpdatePerson(livePerson.id, data)
              }
            : canEditPerson
              ? async (data) => handleUpdatePerson(livePerson.id, data)
              : null

          return (
            <PersonDetailsDialog
              open={personDetailsOpen}
              person={livePerson}
              onClose={() => { setPersonDetailsOpen(false); setSelectedPersonId(null) }}
              canEdit={canEditPerson}
              roles={boardRoles}
              onUpdatePerson={handleUpdateP}
              onDelete={isOwner && livePerson ? () => { deletePerson(activeBoardId, livePerson.id); setPersonDetailsOpen(false) } : null}
              onAddTimeOff={handleAddTO}
              onRemoveTimeOff={async (entry) => {
                if (!livePerson || !activeBoardId) return
                await removeTimeOff(activeBoardId, livePerson.id, entry)
              }}
            />
          )
        })()}
      </div>

      {undoToast && <div className="undo-toast">{undoToast}</div>}
    </div>
  )
}


function SplashScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-screen__spinner" />
    </div>
  )
}

function PermissionErrorScreen() {
  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-card__icon">🔒</div>
        <div className="setup-card__title">Firestore rules need updating</div>
        <div className="setup-card__sub">
          Your Firebase project is blocking database access. Update the Firestore rules to fix this.
        </div>
        <div className="setup-card__code">
          {'rules_version = \'2\';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}'}
        </div>
        <div className="setup-card__hint">
          Go to Firebase Console → Firestore Database → Rules tab → paste the above → Publish.
        </div>
      </div>
    </div>
  )
}

function SetupScreen() {
  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-card__icon">🗓</div>
        <div className="setup-card__title">Design Roadmap</div>
        <div className="setup-card__sub">Firebase setup required.</div>
        <div className="setup-card__code">
          VITE_FIREBASE_API_KEY=your_apiKey<br/>
          VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com<br/>
          VITE_FIREBASE_PROJECT_ID=your_project_id<br/>
          VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com<br/>
          VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id<br/>
          VITE_FIREBASE_APP_ID=your_app_id
        </div>
        <div className="setup-card__hint">Create a .env file in the project root, then run npm run dev.</div>
      </div>
    </div>
  )
}
