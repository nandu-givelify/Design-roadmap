import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from './contexts/AuthContext'
import LoginPage from './components/LoginPage'
import LeftNav from './components/LeftNav'
import Header from './components/Header'
import Timeline from './components/Timeline'
import Settings from './components/Settings'
import PersonDetailsDialog from './components/PersonDetailsDialog'
import WelcomeSetupDialog from './components/WelcomeSetupDialog'
import { TaskModal, EditTaskModal, ShareModal, NewBoardDialog } from './components/Modals'
import { useMountWhileOpen } from './hooks/useMountWhileOpen'
import { initStackedDialogs } from './utils/stackedDialogs'

initStackedDialogs()
import {
  subscribeBoards, createBoard, updateBoard, deleteBoard,
  subscribePeople, subscribeTasks, subscribeBoard,
  addPerson, addPersonWithId, updatePerson, deletePerson,
  getEmailDomain, isOrgDomain, subscribeOrgMembers,
  addTask, updateTask, deleteTask, addTaskWithId,
  checkAndRunMigration,
  subscribeUserPrefs, updateUserPrefs,
  DEFAULT_BOARD_PHASES,
  getUserProfile, setUserProfile, findBoardsByMemberEmail, subscribeUserProfile,
  getPeopleOnce, addTimeOff, removeTimeOff, addUserTimeOff, removeUserTimeOff,
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
  const taskModalMounted = useMountWhileOpen(modal?.type === 'task')
  const editTaskMounted   = useMountWhileOpen(!!editingTask)

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

  // Not publicly viewable: send them through the real sign-in flow first (keeping
  // ?board=… in the URL) rather than a dead-end message — once they're signed in,
  // AuthenticatedApp re-checks their actual access to this specific board and
  // shows the right state (owner/editor/read-only) instead of guessing up front.
  if (error === 'private') return <LoginPage />

  if (error) return (
    <div className="loading-screen">
      <div style={{ fontSize: 32 }}>🔒</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginTop: 12 }}>
        Can't open this board
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6, marginBottom: 20 }}>
        {error === 'Board not found.' ? 'This board doesn\'t exist or was deleted.' : error}
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
  const handleCreatePerson = canEdit
    ? async (data) => { const ref = await addPerson(boardId, data); return ref.id }
    : () => {}
  const handleCreatePersonWithId = canEdit
    ? (id, data) => { addPersonWithId(boardId, id, data).catch(err => console.warn('[createPerson] failed:', err.message)) }
    : () => {}
  const handleAddRole = canEdit
    ? async (role) => {
        const roles = board.roles || ['Designer', 'PM', 'Dev']
        if (roles.includes(role)) return
        await updateBoard(boardId, { roles: [...roles, role] })
      }
    : () => {}

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

        {canEdit && taskModalMounted && (
          <TaskModal
            open={modal?.type === 'task'}
            onClose={() => setModal(null)}
            onSave={handleAddTask}
            people={people}
            roles={board.roles || ['Designer', 'PM', 'Dev']}
            boardPhases={boardPhases}
            defaultAssigneeId={modal?.assigneeId}
            defaultStartDate={modal?.startDate}
            onCreatePerson={handleCreatePerson}
            onCreatePersonWithId={handleCreatePersonWithId}
            onAddRole={handleAddRole}
          />
        )}
        {canEdit && editTaskMounted && (
          <EditTaskModal
            open={!!editingTask}
            task={editingTask}
            onClose={() => setEditingTask(null)}
            onSave={(data) => handleUpdateTask(editingTask.id, data)}
            onDelete={() => handleDeleteTask(editingTask.id)}
            people={people}
            roles={board.roles || ['Designer', 'PM', 'Dev']}
            boardPhases={boardPhases}
            onCreatePerson={handleCreatePerson}
            onCreatePersonWithId={handleCreatePersonWithId}
            onAddRole={handleAddRole}
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
  const [orgMembers,    setOrgMembers]    = useState([])
  // Fallback fetch for a board opened via link that isn't in this user's own
  // owned/member boards list — lets us tell "not a member, but board allows
  // guest access" apart from "no access at all" instead of just rendering blank.
  const [fetchedBoard,  setFetchedBoard]  = useState(undefined) // undefined = not looked up, null = doesn't exist
  const [tasks,         setTasks]         = useState([])
  const [tasksLoaded,   setTasksLoaded]   = useState(false)
  const [loadingBoards, setLoadingBoards] = useState(true)
  const [migrating,     setMigrating]     = useState(false)
  const [settingsOpen,  setSettingsOpen]  = useState(false)
  const settingsMounted = useMountWhileOpen(settingsOpen)
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
  const isMobileInit = typeof window !== 'undefined' && window.innerWidth <= 740
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
  const taskModalMounted  = useMountWhileOpen(modal === 'task')
  const editTaskMounted   = useMountWhileOpen(!!editingTask)
  const shareModalMounted = useMountWhileOpen(modal === 'share')

  // Person details dialog (unified for timeline click, settings, and profile)
  const [personDetailsOpen, setPersonDetailsOpen] = useState(false)
  const [selectedPersonId,  setSelectedPersonId]  = useState(null)

  // Filters
  const [filterPersonIds, setFilterPersonIds] = useState([])

  // Board ordering + favourites
  const [boardOrder,      setBoardOrder]      = useState([])
  const [favoriteBoardIds,setFavoriteBoardIds]= useState([])
  const boardSetupStarted = useRef(false)  // prevent double-creation

  // First-ever session for this account (Firebase sets these equal only on the
  // sign-in that follows account creation) — gates the one-time welcome
  // dialog so returning users never see it.
  const isFirstSession = !!user?.metadata?.creationTime
    && user.metadata.creationTime === user.metadata.lastSignInTime
  const [welcomeOpen,     setWelcomeOpen]     = useState(false)
  const [welcomeIsNewUser,setWelcomeIsNewUser]= useState(false)
  const welcomeShownRef = useRef(false)  // only ever show once per app load
  const welcomeMounted = useMountWhileOpen(welcomeOpen)
  const [newBoardOpen, setNewBoardOpen] = useState(false)
  const newBoardMounted = useMountWhileOpen(newBoardOpen)

  const timelineRef = useRef(null)

  // Undo/redo
  const { push: pushHistory, undo: undoHistory, redo: redoHistory } = useHistory()
  const [undoToast, setUndoToast] = useState(null)
  const showToast = useCallback((msg) => { setUndoToast(msg); setTimeout(() => setUndoToast(null), 2500) }, [])

  // ── Auto-collapse nav on mobile resize; restore when back to desktop ───────
  useEffect(() => {
    const autoCollapsed = { current: false }
    const handle = () => {
      const mobile = window.innerWidth <= 740
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
      const urlId = getBoardIdFromUrl()
      if (bs.length > 0) {
        const found = bs.find((b) => b.id === urlId) || bs[0]
        setActiveBoardId((prev) => {
          if (prev && bs.find((b) => b.id === prev)) return prev
          setBoardIdInUrl(found.id)
          return found.id
        })
        // First-ever sign-in landing with existing board access (e.g. invited
        // to a board before signing up) — land them on the first one (above)
        // and show the welcome dialog as an overlay so they can jump to a
        // different one or add a new one instead.
        if (isFirstSession && !welcomeShownRef.current) {
          welcomeShownRef.current = true
          setWelcomeIsNewUser(false)
          setWelcomeOpen(true)
        }
      } else if (!boardSetupStarted.current) {
        // No boards yet — guard against double-fire from two onSnapshot listeners
        boardSetupStarted.current = true
        // Claim the welcome-dialog slot synchronously, before any awaits below:
        // once the board we're about to create lands, Firestore's listener
        // fires this same callback again with bs.length > 0, and without
        // claiming it now that second call would win the race and show the
        // wrong ("existing boards") variant instead of the new-user one.
        const showWelcomeAsNewUser = isFirstSession && !welcomeShownRef.current
        if (showWelcomeAsNewUser) welcomeShownRef.current = true
        setMigrating(true)
        try {
          // Migration only ever matters for pre-existing (legacy single-board)
          // accounts — it must never block a brand-new signup from getting
          // their first board just because this lookup failed for some reason.
          let migratedId = null
          try {
            migratedId = await checkAndRunMigration(user.uid, user.email)
          } catch (err) {
            console.warn('[migration] check failed, treating as brand-new user:', err.message)
          }
          if (migratedId) {
            setBoardIdInUrl(migratedId)
            setActiveBoardId(migratedId)
          } else {
            // Brand-new user with no boards — auto-create their first one
            // and greet them with the welcome dialog on top of it.
            const ref = await createBoard({ name: 'Your New Board', ownerId: user.uid, ownerEmail: user.email })
            const currentProfile = await getUserProfile(user.uid)
            await addPerson(ref.id, {
              name:  currentProfile?.name  || user.displayName || user.email.split('@')[0],
              email: user.email,
              photo: currentProfile?.photo || user.photoURL || null,
              role:  null,
            })
            setBoardIdInUrl(ref.id)
            setActiveBoardId(ref.id)
            if (showWelcomeAsNewUser) {
              setWelcomeIsNewUser(true)
              setWelcomeOpen(true)
            }
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
    const u1 = subscribePeople(activeBoardId, setPeople)
    const u2 = subscribeTasks(activeBoardId, (ts) => { setTasks(ts); setTasksLoaded(true) })
    return () => { u1(); u2() }
  }, [activeBoardId])

  // ── Org directory: everyone sharing the signed-in user's company email domain,
  // across all their boards — lets "Add new person" suggest people already known
  // instead of re-adding them per board. No-ops for personal email domains.
  useEffect(() => {
    const domain = getEmailDomain(user?.email)
    if (!isOrgDomain(domain)) { setOrgMembers([]); return }
    return subscribeOrgMembers(domain, setOrgMembers)
  }, [user?.email])

  // ── Active board object ──────────────────────────────────────────────────
  const ownBoard = boards.find((b) => b.id === activeBoardId) || null

  // If the board isn't among this user's own owned/member boards (e.g. they
  // followed a share link they're not a member of), fetch it directly so we
  // can tell "not a member, but board allows guest access" apart from "no
  // access at all" — any signed-in user is allowed to read the board doc itself.
  useEffect(() => {
    setFetchedBoard(undefined)
    if (!activeBoardId || loadingBoards || ownBoard) return
    return subscribeBoard(activeBoardId, setFetchedBoard, () => setFetchedBoard(null))
  }, [activeBoardId, loadingBoards, !!ownBoard]) // eslint-disable-line

  const activeBoard = ownBoard || (fetchedBoard || null)
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
        photo:   userProfile.photo   ?? p.photo   ?? null,
        name:    userProfile.name    ?? p.name,
        // Global time off overrides board-level — applies across all boards
        timeOff: userProfile.timeOff ?? p.timeOff ?? [],
      }
    })
  }, [people, user, userProfile]) // eslint-disable-line

  // ── Org directory members not yet on this board — suggested when adding people ──
  const orgOptions = useMemo(() => {
    const currentEmails = new Set(people.map(p => p.email?.toLowerCase()).filter(Boolean))
    return orgMembers.filter(m => m.email && !currentEmails.has(m.email.toLowerCase()))
  }, [orgMembers, people])

  // ── People from boards I'm actually part of (owned or member), not the whole
  // browser's history — refetched whenever my board list changes. Suggested
  // when adding people so I don't have to re-add someone I already work with
  // elsewhere, without ever surfacing someone I have no shared board with.
  const [myBoardsPeople, setMyBoardsPeople] = useState([])
  const boardIdsKey = boards.map(b => b.id).sort().join(',')
  useEffect(() => {
    if (!boards.length) { setMyBoardsPeople([]); return }
    let cancelled = false
    ;(async () => {
      try {
        const lists = await Promise.all(boards.map(b => getPeopleOnce(b.id)))
        if (cancelled) return
        const byEmail = new Map()
        lists.flat().forEach(p => {
          const key = p.email?.toLowerCase()
          if (!key) return
          const existing = byEmail.get(key)
          if (!existing || (p.createdAt?.seconds || 0) > (existing.createdAt?.seconds || 0)) {
            byEmail.set(key, p)
          }
        })
        setMyBoardsPeople([...byEmail.values()])
      } catch (err) {
        console.warn('[myBoardsPeople] fetch failed:', err.message)
      }
    })()
    return () => { cancelled = true }
  }, [boardIdsKey]) // eslint-disable-line

  // ── Recent people — merges two sources, deduped by email, excluding current
  // board's members: (1) people from boards I actually own/belong to, and
  // (2) org-directory colleagues sharing my company email domain. ──────────
  const recentPeople = useMemo(() => {
    const currentEmails = new Set(people.map(p => p.email?.toLowerCase()).filter(Boolean))
    const seen = new Set()
    return [...myBoardsPeople, ...orgOptions].filter(p => {
      const key = p.email?.toLowerCase()
      if (!key || currentEmails.has(key) || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [myBoardsPeople, orgOptions, people])

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
    // Fire-and-forget: this is one Firestore round-trip per board, so awaiting it here
    // would leave the profile dialog stuck on "Saving…" for several seconds on an
    // account with many boards. The primary write above already completed.
    const ue = user.email.toLowerCase()
    const un = (saveData.name || user.displayName || '').toLowerCase()
    Promise.all(boards.map(async (board) => {
      const boardPeople = await getPeopleOnce(board.id)
      const match = boardPeople.find(p => p.email?.toLowerCase() === ue)
        || (un ? boardPeople.find(p => !p.email && p.name?.toLowerCase() === un) : null)
      if (!match) return
      const patch = {}
      if (saveData.name  !== undefined) patch.name  = saveData.name
      if (saveData.photo !== undefined) patch.photo = saveData.photo
      if (Object.keys(patch).length) await updatePerson(board.id, match.id, patch)
    })).catch((e) => console.warn('Profile push failed:', e))
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
      // Push directly to ALL other boards using email OR person name for matching.
      // Fire-and-forget — one Firestore round-trip per board, so awaiting it would
      // leave the profile dialog stuck on "Saving…" for several seconds on an
      // account with many boards. The primary write above already completed.
      const ue = userEmail
      const un = personName  // use the actual person name, not displayName
      Promise.all(boards.map(async (board) => {
        if (board.id === activeBoardId) return // already updated at top of this handler
        const ppl = await getPeopleOnce(board.id)
        const match = (ue && ppl.find(p => p.email?.toLowerCase() === ue))
          || (un && ppl.find(p => !p.email && p.name?.toLowerCase() === un))
        if (match) await updatePerson(board.id, match.id, patch)
      })).catch((e) => console.warn('Cross-board push failed:', e))
      return
    }

    // For any other person: push the change to all boards they appear on.
    // Use loaded `boards` state and match by email OR name (for entries without email).
    // Fire-and-forget, same reasoning as above.
    const pn = (person?.name || '').toLowerCase()
    if (!email && !pn) return
    Promise.all(boards.map(async (board) => {
      if (board.id === activeBoardId) return  // already updated above
      const ppl   = await getPeopleOnce(board.id)
      const match = (email && ppl.find(p => p.email?.toLowerCase() === email))
        || (pn && ppl.find(p => !p.email && p.name?.toLowerCase() === pn))
      if (match) await updatePerson(board.id, match.id, patch)
    })).catch((e) => console.warn('Cross-board person sync failed:', e))
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
  const hasGuestAccess = activeBoard?.publicAccess === 'edit' || activeBoard?.publicAccess === 'view' || activeBoard?.isPublic === true
  // Default: members added to the board get edit access unless explicitly restricted to 'view'
  const canEdit   = isOwner || memberAccess === 'edit' || (isMember && memberAccess !== 'view') || activeBoard?.publicAccess === 'edit'
  const readOnly  = !canEdit
  const hasBoardAccess = isOwner || isMember || hasGuestAccess

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
  // window.prompt() isn't supported in every environment (some embedded/PWA
  // contexts throw instead of showing it), so this opens a proper dialog.
  const handleNewBoard = useCallback(() => {
    setNewBoardOpen(true)
  }, [])

  const handleCreateBoard = useCallback(async (name) => {
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
    setNewBoardOpen(false)
    setWelcomeOpen(false)
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

  // Fire-and-forget variant: caller already knows the id (generated client-side)
  // so the UI can select the person instantly instead of waiting on the round trip.
  const handleCreatePersonWithId = useCallback((id, data) => {
    if (!activeBoardId) return
    addPersonWithId(activeBoardId, id, data).catch(err => console.warn('[createPerson] failed:', err.message))
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
    // Skip optional phases when computing defaults — they must be opted in per-task
    const activePhases = boardPhases.filter(bp => !bp.optional)
    const ids = activePhases.map(p => p.id)
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
      const n = activePhases.length
      let phases
      if (hasSmart) {
        const discovery = Math.max(1, Math.min(7, Math.round(d * 0.25)))
        const handoff   = Math.max(1, Math.min(3, Math.round(d * 0.1)))
        const rem = Math.max(2, d - discovery - handoff)
        const ux = Math.max(1, Math.floor(rem / 2))
        const ui = Math.max(1, rem - ux)
        phases = activePhases.map(bp => ({
          id: bp.id,
          days: bp.id === 'discovery' ? discovery : bp.id === 'handoff' ? handoff
              : bp.id === 'ux' ? ux : bp.id === 'ui' ? ui
              : Math.max(1, Math.floor(d / n)),
        }))
      } else {
        const eq = Math.max(1, Math.floor(d / n))
        phases = activePhases.map((bp, i) => ({
          id: bp.id, days: i === n - 1 ? Math.max(1, d - eq * (n - 1)) : eq,
        }))
      }
      updateTask(activeBoardId, task.id, { phases })
    })
  }, [activeBoardId, tasks, boardPhases]) // eslint-disable-line

  // ── Migrate existing boards: inject new optional phases if missing ────────
  const migratedPhasesRef = useRef(new Set())
  useEffect(() => {
    boards.forEach(board => {
      if (migratedPhasesRef.current.has(board.id)) return
      const phases = board.boardPhases
      if (!phases) return
      // Only migrate boards that have the 4 standard phases
      if (!phases.some(p => p.id === 'handoff')) return
      // Add usertesting before handoff if not already present
      if (phases.some(p => p.id === 'usertesting')) {
        migratedPhasesRef.current.add(board.id)
        return
      }
      migratedPhasesRef.current.add(board.id)
      const handoffIdx = phases.findIndex(p => p.id === 'handoff')
      const newPhases = [
        ...phases.slice(0, handoffIdx),
        { id: 'usertesting', name: 'User testing', color: '#A78BFA', optional: true },
        ...phases.slice(handoffIdx),
      ]
      updateBoard(board.id, { boardPhases: newPhases })
    })
  }, [boards]) // eslint-disable-line

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

  // A board id in the URL that isn't one of this user's own boards: we already
  // fetched it directly above, so we now know whether it's a guest-accessible
  // board (fine — render normally with fetchedBoard as activeBoard) or one this
  // account genuinely has no access to.
  if (activeBoardId && !ownBoard) {
    if (fetchedBoard === undefined) return <SplashScreen />
    if (fetchedBoard === null) return <BoardNotFoundScreen />
    if (!hasBoardAccess) return <NoBoardAccessScreen board={fetchedBoard} user={user} />
  }

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
            // Always open profile — fall back to '__own_profile__' sentinel when not on a board
            setSelectedPersonId(userPerson ? userPerson.id : '__own_profile__')
            setPersonDetailsOpen(true)
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
        {taskModalMounted && (
          <TaskModal
            open={modal === 'task'}
            onClose={() => { setModal(null); setDefaultStartDate(null) }}
            onSave={handleAddTask}
            people={enrichedPeople}
            roles={boardRoles}
            boardPhases={boardPhases}
            defaultAssigneeId={defaultAssigneeId}
            defaultStartDate={defaultStartDate}
            onCreatePerson={handleCreatePerson}
            onCreatePersonWithId={handleCreatePersonWithId}
            onAddRole={handleAddRole}
            recentPeople={recentPeople}
          />
        )}

        {/* Edit Task modal */}
        {editTaskMounted && (
          <EditTaskModal
            open={!!editingTask}
            task={editingTask}
            onClose={() => setEditingTask(null)}
            onSave={(data) => handleUpdateTask(editingTask.id, data)}
            onDelete={() => handleDeleteTask(editingTask.id)}
            people={enrichedPeople}
            roles={boardRoles}
            boardPhases={boardPhases}
            onCreatePerson={handleCreatePerson}
            onCreatePersonWithId={handleCreatePersonWithId}
            onAddRole={handleAddRole}
            recentPeople={recentPeople}
          />
        )}

        {/* Share modal */}
        {shareModalMounted && (
          <ShareModal
            open={modal === 'share'}
            onClose={() => setModal(null)}
            shareUrl={getBoardShareUrl()}
            board={activeBoard}
            onSetPublicAccess={(access) => updateBoard(activeBoardId, { publicAccess: access })}
          />
        )}

        {/* Settings dialog */}
        {settingsMounted && (
          <Settings
            open={settingsOpen}
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
            onShare={handleShareBoard}
            onPersonClick={(person) => { setSelectedPersonId(person.id); setPersonDetailsOpen(true) }}
          />
        )}

        {/* New board dialog (left nav "+", and welcome dialog's "add new board") */}
        {newBoardMounted && (
          <NewBoardDialog
            open={newBoardOpen}
            onClose={() => setNewBoardOpen(false)}
            onCreate={handleCreateBoard}
          />
        )}

        {/* First-session welcome dialog */}
        {welcomeMounted && (
          <WelcomeSetupDialog
            open={welcomeOpen}
            name={effectiveProfile.name || user?.displayName || user?.email?.split('@')[0] || ''}
            isNewUser={welcomeIsNewUser}
            boards={sortedBoards}
            activeBoardId={activeBoardId}
            onSelectBoard={(id) => { setBoardIdInUrl(id); setActiveBoardId(id); setWelcomeOpen(false) }}
            onClose={() => setWelcomeOpen(false)}
          />
        )}

        {/* Unified person details + time off dialog */}
        {(() => {
          // When opening own profile from left nav while not on a board, use synthetic person
          const boardPerson = enrichedPeople.find(p => p.id === selectedPersonId) || null
          const livePerson = boardPerson || (selectedPersonId === '__own_profile__' ? {
            id: '__own_profile__',
            name: effectiveProfile.name || user?.displayName || user?.email?.split('@')[0] || 'Me',
            email: user?.email || '',
            photo: effectiveProfile.photo || user?.photoURL || null,
            role: userProfile?.role || '',
            timeOff: userProfile?.timeOff || [],
          } : null)
          const isOwnProfile = livePerson?.email?.toLowerCase() === user?.email?.toLowerCase()
          // Anyone who can edit the board (not just its owner) can manage its people —
          // matches the fact that any board editor can already add/remove people freely.
          const canEditPerson = canEdit || isOwnProfile

          const handleAddTO = async (entry) => {
            if (!livePerson) return
            // Own time off → user-level (applies to all boards); others → board-level
            if (isOwnProfile) {
              await addUserTimeOff(user.uid, entry)
            } else if (activeBoardId) {
              await addTimeOff(activeBoardId, livePerson.id, entry)
            }
            // Auto-extend overlapping tasks on the current board
            if (!activeBoardId) return
            const toS = parseLocalDate(entry.start)
            const toE = parseLocalDate(entry.end)
            const personTasks = tasks.filter(t =>
              t.assigneeId === livePerson.id || t.pmId === livePerson.id || t.teamId === livePerson.id
            )
            // Independent writes to different tasks — run in parallel instead
            // of one Firestore round trip at a time, so "Adding…" doesn't sit
            // stuck for however many tasks this person happens to have.
            await Promise.all(personTasks.map((task) => {
              const tS = parseLocalDate(task.startDate)
              const tE = parseLocalDate(task.endDate)
              if (tE < toS || tS > toE) return null
              const overlapStart = tS > toS ? tS : toS
              const overlapEnd   = tE < toE ? tE : toE
              const overlapDays  = diffDays(startOfDay(overlapStart), startOfDay(overlapEnd)) + 1
              if (overlapDays <= 0) return null
              return updateTask(activeBoardId, task.id, { endDate: toDateString(addDays(tE, overlapDays)) })
            }))
          }

          const handleUpdateP = isOwnProfile
            ? async (data) => {
                // Own profile: update global profile; also sync board entry if it exists
                await handleUpdateProfile(data)
                if (livePerson.id !== '__own_profile__') await handleUpdatePerson(livePerson.id, data)
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
              onAddRole={handleAddRole}
              onUpdatePerson={handleUpdateP}
              onDelete={livePerson && !isOwnProfile && canEditPerson ? () => {
                deletePerson(activeBoardId, livePerson.id); setPersonDetailsOpen(false)
              } : null}
              onAddTimeOff={handleAddTO}
              onRemoveTimeOff={async (entry) => {
                if (!livePerson) return
                if (isOwnProfile) {
                  await removeUserTimeOff(user.uid, entry)
                } else if (activeBoardId) {
                  await removeTimeOff(activeBoardId, livePerson.id, entry)
                }
                // Shrink tasks that were extended by this time off block
                if (!activeBoardId) return
                const toS = parseLocalDate(entry.start)
                const toE = parseLocalDate(entry.end)
                const personTasks = tasks.filter(t =>
                  t.assigneeId === livePerson.id || t.pmId === livePerson.id || t.teamId === livePerson.id
                )
                // Independent writes to different tasks — run in parallel (see
                // handleAddTO above for why this isn't a sequential for-loop).
                await Promise.all(personTasks.map((task) => {
                  const tS = parseLocalDate(task.startDate)
                  const tE = parseLocalDate(task.endDate)
                  if (tE < toS || tS > toE) return null
                  const overlapStart = tS > toS ? tS : toS
                  const overlapEnd   = tE < toE ? tE : toE
                  const overlapDays  = diffDays(startOfDay(overlapStart), startOfDay(overlapEnd)) + 1
                  if (overlapDays <= 0) return null
                  return updateTask(activeBoardId, task.id, { endDate: toDateString(addDays(tE, -overlapDays)) })
                }))
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

function BoardNotFoundScreen() {
  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-card__icon">🔍</div>
        <div className="setup-card__title">Board not found</div>
        <div className="setup-card__sub">This board doesn't exist or was deleted.</div>
        <button className="setup-card__hint" style={{ marginTop: 16, cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline', font: 'inherit' }}
          onClick={() => { window.location.search = '' }}>
          Go to your boards
        </button>
      </div>
    </div>
  )
}

function NoBoardAccessScreen({ board, user }) {
  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-card__icon">🔒</div>
        <div className="setup-card__title">You don't have access to "{board?.name || 'this board'}"</div>
        <div className="setup-card__sub">
          You're signed in as {user?.email}, but this board hasn't been shared with you.
          Ask its owner to add you, or share a link they've made public.
        </div>
        <button className="setup-card__hint" style={{ marginTop: 16, cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline', font: 'inherit' }}
          onClick={() => { window.location.search = '' }}>
          Go to your boards
        </button>
      </div>
    </div>
  )
}

function SetupScreen() {
  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-card__icon">🗓</div>
        <div className="setup-card__title">Planner</div>
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
