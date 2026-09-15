// Admin panel shell — mounted at /admin by src/App.jsx.
//
// Access model, in order:
//   1. You must be signed in with a normal Firebase account (the app's own
//      login screen handles that).
//   2. /api/admin/session re-verifies your ID token on the server and checks
//      your email against the ADMIN_EMAILS allowlist.
//   3. Every panel action repeats step 2 on its own endpoint.
//
// Nothing below decides who is an admin — it only reflects what the server
// already decided. Editing this file (or the bundle it compiles to) grants no
// access, because the data lives behind those endpoints.
import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import DashboardIcon from '@mui/icons-material/SpaceDashboard'
import PeopleIcon from '@mui/icons-material/Group'
import BoardsIcon from '@mui/icons-material/ViewTimeline'
import DirectoryIcon from '@mui/icons-material/ContactPage'
import HistoryIcon from '@mui/icons-material/History'
import LogoutIcon from '@mui/icons-material/Logout'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import LockIcon from '@mui/icons-material/Lock'

import { useAuth } from '../contexts/AuthContext'
import { signOutUser } from '../firebase'
import LoginPage from '../components/LoginPage'
import { getSession } from './api'
import { Loading } from './ui'

import Dashboard from './Dashboard'
import UsersPanel from './UsersPanel'
import BoardsPanel from './BoardsPanel'
import DirectoryPanel from './DirectoryPanel'
import AuditPanel from './AuditPanel'

const TABS = [
  { id: 'dashboard', label: 'Overview',  icon: DashboardIcon, Component: Dashboard },
  { id: 'users',     label: 'Users',     icon: PeopleIcon,    Component: UsersPanel },
  { id: 'boards',    label: 'Boards',    icon: BoardsIcon,    Component: BoardsPanel },
  { id: 'directory', label: 'Directory', icon: DirectoryIcon, Component: DirectoryPanel },
  { id: 'audit',     label: 'Audit log', icon: HistoryIcon,   Component: AuditPanel },
]

export default function AdminApp() {
  const { user } = useAuth()
  const [session, setSession] = useState(undefined) // undefined = checking
  const [error, setError] = useState(null)
  // Sub-tab lives in the hash so a reload or a bookmark lands back on the same
  // panel — /admin#users rather than always bouncing to the overview.
  const [tab, setTab] = useState(() => {
    const h = window.location.hash.replace('#', '')
    return TABS.some(t => t.id === h) ? h : 'dashboard'
  })

  const check = useCallback(async () => {
    setError(null)
    try {
      setSession(await getSession())
    } catch (err) {
      setError(err)
      setSession(null)
    }
  }, [])

  useEffect(() => {
    if (user) check()
    else if (user === null) setSession(null)
  }, [user, check])

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#', '')
      if (TABS.some(t => t.id === h)) setTab(h)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const selectTab = (id) => { setTab(id); window.location.hash = id }

  if (user === undefined) return <Loading label="Checking your session…" />
  if (user === null) return <LoginPage />
  if (session === undefined) return <Loading label="Verifying admin access…" />

  if (!session?.isAdmin) {
    return <AccessDenied user={user} error={error} onRetry={check} />
  }

  const active = TABS.find(t => t.id === tab) || TABS[0]
  const Panel = active.Component

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#fafafa' }}>
      {/* Sidebar */}
      <Box
        component="nav"
        sx={{
          width: 232, flexShrink: 0, bgcolor: '#fff',
          borderRight: '1px solid', borderColor: 'divider',
          display: 'flex', flexDirection: 'column',
          position: 'sticky', top: 0, height: '100vh',
        }}
      >
        <Box sx={{ p: 2.5, pb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <LockIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="subtitle2">Admin</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Design Roadmap
          </Typography>
        </Box>

        <Divider />

        <Stack sx={{ p: 1.5, gap: 0.25, flex: 1 }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <Box
              key={id}
              role="button"
              tabIndex={0}
              onClick={() => selectTab(id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTab(id) } }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.25,
                px: 1.5, py: 1, borderRadius: 2, cursor: 'pointer',
                bgcolor: tab === id ? '#f3f4f6' : 'transparent',
                color: tab === id ? 'text.primary' : 'text.secondary',
                fontWeight: tab === id ? 600 : 400,
                fontSize: '0.875rem',
                '&:hover': { bgcolor: tab === id ? '#f3f4f6' : '#fafafa' },
              }}
            >
              <Icon sx={{ fontSize: 18 }} />
              {label}
            </Box>
          ))}
        </Stack>

        <Divider />

        <Box sx={{ p: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 0.5, py: 1 }}>
            <Avatar src={user.photoURL || undefined} sx={{ width: 28, height: 28 }}>
              {(user.displayName || user.email || '?')[0].toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Tooltip title={user.email} placement="top">
                <Typography variant="caption" sx={{ display: 'block', color: 'text.primary', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </Typography>
              </Tooltip>
              <Chip label="Admin" size="small" sx={{ height: 16, fontSize: '0.625rem', mt: 0.25 }} />
            </Box>
          </Stack>

          <Stack spacing={0.5} sx={{ mt: 1 }}>
            <Button
              size="small" startIcon={<ArrowBackIcon />}
              onClick={() => { window.location.href = '/' }}
              sx={{ justifyContent: 'flex-start', color: 'text.secondary' }}
            >
              Back to app
            </Button>
            <Button
              size="small" startIcon={<LogoutIcon />}
              onClick={() => signOutUser()}
              sx={{ justifyContent: 'flex-start', color: 'text.secondary' }}
            >
              Sign out
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* Content */}
      <Box component="main" sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 4 }, maxWidth: 1200 }}>
        <Panel />
      </Box>
    </Box>
  )
}

// ── Denied / not configured ──────────────────────────────────────────────────
function AccessDenied({ user, error, onRetry }) {
  const notConfigured = error?.code === 'not_configured' || error?.status === 503

  return (
    <Stack alignItems="center" justifyContent="center" sx={{ minHeight: '100vh', p: 3, bgcolor: '#fafafa' }}>
      <Box sx={{
        maxWidth: 480, width: '100%', bgcolor: '#fff', p: 4,
        borderRadius: 4, border: '1px solid', borderColor: 'divider',
      }}>
        <LockIcon sx={{ fontSize: 24, color: 'text.secondary', mb: 1.5 }} />

        {notConfigured ? (
          <>
            <Typography variant="h6" sx={{ mb: 1 }}>Admin API isn't set up yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {error?.message}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add <code>FIREBASE_SERVICE_ACCOUNT</code> and <code>ADMIN_EMAILS</code> to your
              Vercel environment variables, then redeploy. The full steps are in{' '}
              <strong>ADMIN.md</strong> in the repo.
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="h6" sx={{ mb: 1 }}>No admin access</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              You're signed in as <strong>{user.email}</strong>, which isn't on the admin allowlist.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Admins are set server-side via the <code>ADMIN_EMAILS</code> environment variable in
              Vercel — it can't be changed from the browser.
            </Typography>
          </>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
          <Button variant="contained" onClick={() => { window.location.href = '/' }}>Back to app</Button>
          <Button onClick={onRetry} sx={{ color: 'text.secondary' }}>Try again</Button>
          <Button onClick={() => signOutUser()} sx={{ color: 'text.secondary' }}>Sign out</Button>
        </Stack>
      </Box>
    </Stack>
  )
}
