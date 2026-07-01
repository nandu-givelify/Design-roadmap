import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './contexts/AuthContext'
import LoginPage from './components/LoginPage'
import LeftNav from './components/LeftNav'
import Header from './components/Header'
import Timeline from './components/Timeline'
import Settings from './components/Settings'
import { TaskModal, EditTaskModal, ShareModal } from './components/Modals'
import {
  subscribeBoards, createBoard, updateBoard, deleteBoard,
  subscribePeople, subscribeTasks, subscribeBoard,
  addPerson, updatePerson, deletePerson,
  addTask, updateTask, deleteTask, addTaskWithId,
  checkAndRunMigration,
  subscribeUserPrefs, updateUserPrefs,
  DEFAULT_BOARD_PHASES,
} from './firebase'
import { useHistory } from './hooks/useHistory'

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

function PublicBoardView({ boardId }) {
  const [board,  setBoard]  = useState(undefined)
  const [people, setPeople] = useState([])
  const [tasks,  setTasks]  = useState([])
  const [error,  setError]  = useState(null)
  const now = new Date()
  const [viewMode, setViewMode] = useState('quarter')
  const [year,     setYear]     = useState(now.getFullYear())
  const [quarter,  setQuarter]  = useState(Math.floor(now.getMonth() / 3) + 1)

  useEffect(() => {
    const u1 = subscribeBoard(boardId, (b) => {
      if (!b) { setError('Board not found.'); return }
      if (!b.isPublic) { setError('This board is private. Please sign in to access it.'); return }
      setBoard(b)
    })
    const u2 = subscribePeople(boardId, setPeople)
    const u3 = subscribeTasks(boardId, setTasks)
    return () => { u1(); u2(); u3() }
  }, [boardId])

  if (board === undefined && !error) return <div className="loading-screen"><div>Loading board…</div></div>
  if (error) return (
    <div className="loading-screen">
      <div style={{ fontSize: 32 }}>🔒</div>
      <div style={{ fontSize: 15, color: '#374151', marginTop: 12 }}>{error}</div>
      <button style={{ marginTop: 16, padding: '8px 18px', background: '#111827', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600 }}
        onClick={() => { window.location.search = '' }}>Sign in</button>
    </div>
  )

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
          <div className="header__readonly-badge">View only · <a href="/" style={{ color: '#92400e' }}>Sign in to edit</a></div>
        </header>
        <Timeline
          viewMode={viewMode} year={year} quarter={quarter}
          people={people} tasks={tasks} groupBy="none"
          filterPersonIds={[]}
          onUpdateTask={() => {}} onDeleteTask={() => {}}
          onAddTaskForPerson={() => {}} onEditTask={() => {}}
          boardPhases={board.boardPhases || DEFAULT_BOARD_PHASES}
          readOnly
        />
      </div>
    </div>
  )
}

function AuthenticatedApp({ user }) {
  const [boards,        setBoards]        = useState([])
  const [activeBoardId, setActiveBoardId] = useState(null)
  const [people,        setPeople]        = useState([])
  const [tasks,         setTasks]         = useState([])
  const [loadingBoards, setLoadingBoards] = useState(true)
  const [migrating,     setMigrating]     = useState(false)
  const [settingsOpen,  setSettingsOpen]  = useState(false)
  const [dbError,       setDbError]       = useState(null)

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

  // ── Subscribe to user prefs (board order + favourites) ───────────────────
  useEffect(() => {
    if (!user) return
    return subscribeUserPrefs(user.uid, (prefs) => {
      setBoardOrder(prefs.boardOrder || [])
      setFavoriteBoardIds(prefs.favoriteBoardIds || [])
    })
  }, [user])

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
    setPeople([])
    setTasks([])
    const u1 = subscribePeople(activeBoardId, setPeople)
    const u2 = subscribeTasks(activeBoardId, setTasks)
    return () => { u1(); u2() }
  }, [activeBoardId])

  // ── Active board object ──────────────────────────────────────────────────
  const activeBoard = boards.find((b) => b.id === activeBoardId) || null
  const boardRoles  = activeBoard?.roles || ['Designer', 'PM', 'Dev']
  const boardPhases = activeBoard?.boardPhases || DEFAULT_BOARD_PHASES

  // ── Access level ─────────────────────────────────────────────────────────
  const isOwner   = activeBoard?.ownerId === user.uid
  const memberKey = user.email?.replace(/\./g, '_')
  const memberAccess = activeBoard?.members?.[memberKey]?.access
  const canEdit   = isOwner || memberAccess === 'edit'
  const readOnly  = !canEdit

  // ── Board selection ──────────────────────────────────────────────────────
  const handleSelectBoard = useCallback((id) => {
    setActiveBoardId(id)
    setBoardIdInUrl(id)
    setFilterPersonIds([])
    setGroupBy('none')
  }, [])

  // ── New board ────────────────────────────────────────────────────────────
  const handleNewBoard = useCallback(async () => {
    const name = window.prompt('Board name:')
    if (!name?.trim()) return
    const ref = await createBoard({ name: name.trim(), ownerId: user.uid, ownerEmail: user.email })
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
  if (migrating) return <SplashScreen label="Setting up your board…" />
  if (loadingBoards) return <SplashScreen />

  return (
    <div className="app">
      <LeftNav
        user={user}
        boards={sortedBoards}
        activeBoardId={activeBoardId}
        favoriteBoardIds={favoriteBoardIds}
        onSelectBoard={handleSelectBoard}
        onNewBoard={handleNewBoard}
        onSettings={() => setSettingsOpen(true)}
        onReorderBoards={handleReorderBoards}
        onToggleFavorite={handleToggleFavorite}
      />

      <div className="main-content">
        <Header
          board={activeBoard}
          viewMode={viewMode}
          setViewMode={handleViewModeChange}
          year={year} setYear={setYear}
          quarter={quarter} setQuarter={setQuarter}
          onJumpToday={handleJumpToday}
          onShare={() => handleShareBoard()}
          onRenameBoard={handleRenameBoard}
          onDeleteBoard={handleDeleteBoard}
          people={people}
          filterPersonIds={filterPersonIds}
          setFilterPersonIds={setFilterPersonIds}
          groupBy={groupBy}
          setGroupBy={setGroupBy}
          roles={boardRoles}
          readOnly={readOnly}
        />

        <Timeline
          ref={timelineRef}
          viewMode={viewMode}
          year={year} quarter={quarter}
          people={people}
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
        />

        {/* Add Task modal */}
        {modal === 'task' && (
          <TaskModal
            onClose={() => { setModal(null); setDefaultStartDate(null) }}
            onSave={handleAddTask}
            people={people}
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
            people={people}
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
            onTogglePublic={(isPublic) => updateBoard(activeBoardId, { isPublic })}
          />
        )}

        {/* Settings panel */}
        {settingsOpen && (
          <Settings
            onClose={() => setSettingsOpen(false)}
            boardId={activeBoardId}
            people={people}
            roles={boardRoles}
            boardPhases={boardPhases}
            onUpdatePerson={(id, data) => updatePerson(activeBoardId, id, data)}
            onDeletePerson={(id) => deletePerson(activeBoardId, id)}
            onAddPerson={(data) => addPerson(activeBoardId, data)}
            onAddRole={handleAddRole}
            onUpdateBoardPhases={handleUpdateBoardPhases}
            isOwner={isOwner}
          />
        )}
      </div>

      {undoToast && <div className="undo-toast">{undoToast}</div>}
    </div>
  )
}

function SplashScreen({ label = 'Loading…' }) {
  return (
    <div className="loading-screen">
      <div className="loading-screen__icon">🗓</div>
      <div className="loading-screen__text">{label}</div>
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
