import { useState, useEffect, useRef, useCallback } from 'react'
import Header from './components/Header'
import Timeline from './components/Timeline'
import { TaskModal, PersonModal, TeamModal, ShareModal } from './components/Modals'
import {
  subscribePeople, subscribeTeams, subscribeTasks,
  addPerson, addTeam, addTask, updateTask, deleteTask
} from './firebase'
import { getYearRange, getQuarterRange } from './utils/dateUtils'

const getQuarterForDate = (d) => Math.floor(d.getMonth() / 3) + 1

export default function App() {
  // ── Auth mode ───────────────────────────────────────────────────────────────
  const params = new URLSearchParams(window.location.search)
  const readOnly = params.get('mode') === 'view'

  // ── View state ──────────────────────────────────────────────────────────────
  const now = new Date()
  const [viewMode, setViewMode] = useState('quarter')
  const [year, setYear] = useState(now.getFullYear())
  const [quarter, setQuarter] = useState(getQuarterForDate(now))

  // ── Firebase data ────────────────────────────────────────────────────────────
  const [people, setPeople] = useState([])
  const [teams, setTeams] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [firebaseError, setFirebaseError] = useState(false)

  useEffect(() => {
    let errTimeout = setTimeout(() => setFirebaseError(true), 8000)
    const unsubs = [
      subscribePeople((d) => { setPeople(d); clearTimeout(errTimeout); setLoading(false) }),
      subscribeTeams((d) => setTeams(d)),
      subscribeTasks((d) => setTasks(d)),
    ]
    return () => { unsubs.forEach((u) => u()); clearTimeout(errTimeout) }
  }, [])

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [filterPersonIds, setFilterPersonIds] = useState([])
  const [filterTeamIds, setFilterTeamIds] = useState([])

  // ── Modals ───────────────────────────────────────────────────────────────────
  const [modal, setModal] = useState(null) // 'task' | 'person' | 'team' | 'share'
  const [defaultAssigneeId, setDefaultAssigneeId] = useState(null)

  const openAddTask = (assigneeId = null) => {
    setDefaultAssigneeId(assigneeId)
    setModal('task')
  }

  // ── Date range from view ─────────────────────────────────────────────────────
  const { start: rangeStart, end: rangeEnd } = viewMode === 'year'
    ? getYearRange(year)
    : getQuarterRange(year, quarter)

  // ── Jump to today ────────────────────────────────────────────────────────────
  const timelineRef = useRef(null)
  const jumpToToday = useCallback(() => {
    if (timelineRef.current?.__scrollToToday) timelineRef.current.__scrollToToday()
  }, [])

  // ── Firebase ops ─────────────────────────────────────────────────────────────
  const handleAddTask = async (data) => { await addTask(data) }
  const handleAddPerson = async (data) => { await addPerson(data) }
  const handleAddTeam = async (data) => { await addTeam(data) }
  const handleUpdateTask = async (id, updates) => { await updateTask(id, updates) }
  const handleDeleteTask = async (id) => { await deleteTask(id) }

  // ── Firebase config check ─────────────────────────────────────────────────────
  const isFirebaseConfigured = import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_API_KEY !== 'your_api_key_here'

  if (!isFirebaseConfigured) {
    return <SetupScreen />
  }

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 12, fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ fontSize: 24 }}>🗓</div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>Loading roadmap…</div>
      </div>
    )
  }

  if (firebaseError) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 12, fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ fontSize: 24 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Could not connect to Firebase</div>
        <div style={{ fontSize: 13, color: '#6b7280', maxWidth: 360, textAlign: 'center' }}>
          Check that your <code>.env</code> file has valid Firebase credentials and that Firestore is enabled in your project.
        </div>
      </div>
    )
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, -apple-system, sans-serif',
      background: '#fff', overflow: 'hidden',
    }}>
      <Header
        viewMode={viewMode} setViewMode={setViewMode}
        year={year} setYear={setYear}
        quarter={quarter} setQuarter={setQuarter}
        onJumpToday={jumpToToday}
        onAddTask={() => openAddTask()}
        onAddPerson={() => setModal('person')}
        onAddTeam={() => setModal('team')}
        onShare={() => setModal('share')}
        people={people} teams={teams}
        filterPersonIds={filterPersonIds} setFilterPersonIds={setFilterPersonIds}
        filterTeamIds={filterTeamIds} setFilterTeamIds={setFilterTeamIds}
        readOnly={readOnly}
      />

      <Timeline
        ref={timelineRef}
        viewMode={viewMode}
        year={year} quarter={quarter}
        rangeStart={rangeStart} rangeEnd={rangeEnd}
        people={people} teams={teams} tasks={tasks}
        filterPersonIds={filterPersonIds}
        filterTeamIds={filterTeamIds}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onAddTaskForPerson={openAddTask}
        readOnly={readOnly}
      />

      {modal === 'task' && (
        <TaskModal
          onClose={() => setModal(null)}
          onSave={handleAddTask}
          people={people} teams={teams}
          defaultAssigneeId={defaultAssigneeId}
        />
      )}
      {modal === 'person' && (
        <PersonModal
          onClose={() => setModal(null)}
          onSave={handleAddPerson}
          teams={teams}
        />
      )}
      {modal === 'team' && (
        <TeamModal
          onClose={() => setModal(null)}
          onSave={handleAddTeam}
        />
      )}
      {modal === 'share' && (
        <ShareModal onClose={() => setModal(null)} />
      )}
    </div>
  )
}

// ── Setup screen shown when Firebase isn't configured yet ────────────────────
function SetupScreen() {
  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif', background: '#f9fafb',
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 32,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        maxWidth: 520, width: '90%',
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🗓</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Design Roadmap</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
          Firebase setup required to enable data persistence and sharing.
        </div>
        <div style={{
          background: '#f3f4f6', borderRadius: 8, padding: 16,
          fontFamily: 'monospace', fontSize: 12, color: '#374151',
          marginBottom: 16, lineHeight: 1.8,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Create a <code>.env</code> file in the project root:</div>
          <div>VITE_FIREBASE_API_KEY=your_api_key</div>
          <div>VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com</div>
          <div>VITE_FIREBASE_PROJECT_ID=your_project_id</div>
          <div>VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com</div>
          <div>VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id</div>
          <div>VITE_FIREBASE_APP_ID=your_app_id</div>
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          Get these values from: Firebase Console → Project Settings → Your apps → Web app config.
          Then restart the dev server with <code>npm run dev</code>.
        </div>
      </div>
    </div>
  )
}
