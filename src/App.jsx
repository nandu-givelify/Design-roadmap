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
  subscribePeople, subscribeTasks,
  addPerson, updatePerson, deletePerson,
  addTask, updateTask, deleteTask,
  checkAndRunMigration,
  subscribeUserPrefs, updateUserPrefs,
} from './firebase'

const getQuarterForDate = (d) => Math.floor(d.getMonth() / 3) + 1

const isConfigured = import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'your_api_key_here'

export default function App() {
  const { user } = useAuth()

  if (!isConfigured) return <SetupScreen />
  if (user === undefined) return <SplashScreen />  // still loading auth
  if (user === null) return <LoginPage />

  return <AuthenticatedApp user={user} />
}

function AuthenticatedApp({ user }) {
  const [boards,        setBoards]        = useState([])
  const [activeBoardId, setActiveBoardId] = useState(null)
  const [people,        setPeople]        = useState([])
  const [tasks,         setTasks]         = useState([])
  const [loadingBoards, setLoadingBoards] = useState(true)
  const [migrating,     setMigrating]     = useState(false)
  const [settingsOpen,  setSettingsOpen]  = useState(false)

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
  const handleShareBoard = useCallback((id) => {
    const url = new URL(window.location)
    url.searchParams.set('board', id)
    navigator.clipboard.writeText(url.toString())
      .then(() => alert('Board link copied!'))
      .catch(() => prompt('Copy this link:', url.toString()))
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
  const handleAddTask = useCallback((data) => {
    if (!activeBoardId) return
    return addTask(activeBoardId, data)
  }, [activeBoardId])

  const handleUpdateTask = useCallback((id, data) => {
    if (!activeBoardId) return
    return updateTask(activeBoardId, id, data)
  }, [activeBoardId])

  const handleDeleteTask = useCallback((id) => {
    if (!activeBoardId) return
    return deleteTask(activeBoardId, id)
  }, [activeBoardId])

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

  // Share: copy ?board=boardId URL
  const getBoardShareUrl = () => {
    const url = new URL(window.location)
    url.searchParams.set('board', activeBoardId)
    return url.toString()
  }

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
          onShare={() => handleShareBoard(activeBoardId)}
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
          readOnly={readOnly}
        />

        {/* Add Task modal */}
        {modal === 'task' && (
          <TaskModal
            onClose={() => { setModal(null); setDefaultStartDate(null) }}
            onSave={handleAddTask}
            people={people}
            roles={boardRoles}
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
            onCreatePerson={handleCreatePerson}
            onAddRole={handleAddRole}
          />
        )}

        {/* Share modal */}
        {modal === 'share' && (
          <ShareModal
            onClose={() => setModal(null)}
            shareUrl={getBoardShareUrl()}
          />
        )}

        {/* Settings panel */}
        {settingsOpen && (
          <Settings
            onClose={() => setSettingsOpen(false)}
            boardId={activeBoardId}
            people={people}
            roles={boardRoles}
            onUpdatePerson={(id, data) => updatePerson(activeBoardId, id, data)}
            onDeletePerson={(id) => deletePerson(activeBoardId, id)}
            onAddPerson={(data) => addPerson(activeBoardId, data)}
            onAddRole={handleAddRole}
            isOwner={isOwner}
          />
        )}
      </div>
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
