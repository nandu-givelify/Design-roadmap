import { useState, useEffect, useRef, useCallback } from 'react'
import Header from './components/Header'
import Timeline from './components/Timeline'
import Settings from './components/Settings'
import { TaskModal, EditTaskModal, PersonModal, TeamModal, ShareModal } from './components/Modals'
import {
  subscribePeople, subscribeTeams, subscribeTasks,
  addPerson, addTeam, addTask, updateTask, deleteTask,
} from './firebase'

const getQuarterForDate = (d) => Math.floor(d.getMonth() / 3) + 1

export default function App() {
  const params   = new URLSearchParams(window.location.search)
  const readOnly = params.get('mode') === 'view'

  const now = new Date()
  const [viewMode, setViewMode] = useState('quarter')
  const [year,     setYear]     = useState(now.getFullYear())
  const [quarter,  setQuarter]  = useState(getQuarterForDate(now))

  const [people,  setPeople]  = useState([])
  const [teams,   setTeams]   = useState([])
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [firebaseError, setFirebaseError] = useState(false)

  useEffect(() => {
    const errTimeout = setTimeout(() => setFirebaseError(true), 8000)
    const unsubs = [
      subscribePeople((d) => { setPeople(d); clearTimeout(errTimeout); setLoading(false) }),
      subscribeTeams((d)  => setTeams(d)),
      subscribeTasks((d)  => setTasks(d)),
    ]
    return () => { unsubs.forEach((u) => u()); clearTimeout(errTimeout) }
  }, [])

  const [filterPersonIds,   setFilterPersonIds]   = useState([])
  const [filterTeamIds,     setFilterTeamIds]     = useState([])
  const [modal,             setModal]             = useState(null) // 'task' | 'person' | 'team' | 'share'
  const [defaultAssigneeId, setDefaultAssigneeId] = useState(null)
  const [editingTask,       setEditingTask]       = useState(null) // task object or null
  const [settingsOpen,      setSettingsOpen]      = useState(false)

  const timelineRef = useRef(null)

  // Today: update year/quarter to match current date, then scroll to today
  const handleJumpToday = useCallback(() => {
    const today = new Date()
    setYear(today.getFullYear())
    setQuarter(getQuarterForDate(today))
    setTimeout(() => timelineRef.current?.scrollToToday(), 50)
  }, [])

  // Year view: jump to current year; Quarter view: jump to current quarter
  const handleViewModeChange = useCallback((mode) => {
    const today = new Date()
    if (mode === 'year') {
      setYear(today.getFullYear())
    } else {
      setYear(today.getFullYear())
      setQuarter(getQuarterForDate(today))
    }
    setViewMode(mode)
  }, [])

  // Create person inline (called from task modal combobox)
  const handleCreatePerson = async (data) => {
    const ref = await addPerson(data)
    return ref.id
  }

  // Create team inline
  const handleCreateTeam = async (data) => {
    const ref = await addTeam(data)
    return ref.id
  }

  const isConfigured = import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_API_KEY !== 'your_api_key_here'

  if (!isConfigured) return <SetupScreen />

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-screen__icon">🗓</div>
      <div className="loading-screen__text">Loading roadmap…</div>
    </div>
  )

  if (firebaseError) return (
    <div className="loading-screen">
      <div className="loading-screen__icon">⚠️</div>
      <div className="loading-screen__text">Could not connect to Firebase. Check your .env file.</div>
    </div>
  )

  return (
    <div className="app">
      <Header
        viewMode={viewMode} setViewMode={handleViewModeChange}
        year={year} setYear={setYear}
        quarter={quarter} setQuarter={setQuarter}
        onJumpToday={handleJumpToday}
        onAddTask={() => { setDefaultAssigneeId(null); setModal('task') }}
        onShare={() => setModal('share')}
        onSettings={() => setSettingsOpen(true)}
        people={people} teams={teams}
        filterPersonIds={filterPersonIds} setFilterPersonIds={setFilterPersonIds}
        filterTeamIds={filterTeamIds} setFilterTeamIds={setFilterTeamIds}
        readOnly={readOnly}
      />

      <Timeline
        ref={timelineRef}
        viewMode={viewMode}
        year={year} quarter={quarter}
        people={people} teams={teams} tasks={tasks}
        filterPersonIds={filterPersonIds} filterTeamIds={filterTeamIds}
        onUpdateTask={(id, data) => updateTask(id, data)}
        onDeleteTask={(id) => deleteTask(id)}
        onAddTaskForPerson={(assigneeId) => { setDefaultAssigneeId(assigneeId); setModal('task') }}
        onEditTask={(task) => setEditingTask(task)}
        readOnly={readOnly}
      />

      {/* Add Task modal */}
      {modal === 'task' && (
        <TaskModal
          onClose={() => setModal(null)}
          onSave={(data) => addTask(data)}
          people={people} teams={teams}
          defaultAssigneeId={defaultAssigneeId}
          onCreatePerson={handleCreatePerson}
          onCreateTeam={handleCreateTeam}
        />
      )}

      {/* Edit Task modal */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={(data) => updateTask(editingTask.id, data)}
          onDelete={() => deleteTask(editingTask.id)}
          people={people} teams={teams}
          onCreatePerson={handleCreatePerson}
          onCreateTeam={handleCreateTeam}
        />
      )}

      {modal === 'person' && (
        <PersonModal onClose={() => setModal(null)} onSave={(d) => addPerson(d)} teams={teams} />
      )}
      {modal === 'team' && (
        <TeamModal onClose={() => setModal(null)} onSave={(d) => addTeam(d)} />
      )}
      {modal === 'share' && <ShareModal onClose={() => setModal(null)} />}

      {/* Settings panel */}
      {settingsOpen && (
        <Settings
          onClose={() => setSettingsOpen(false)}
          people={people}
          teams={teams}
        />
      )}
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
