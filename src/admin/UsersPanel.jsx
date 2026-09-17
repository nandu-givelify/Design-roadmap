// Every Firebase Auth account, with the actions the client SDK can't perform.
import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Checkbox from '@mui/material/Checkbox'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import ToggleButton from '@mui/material/ToggleButton'
import SearchIcon from '@mui/icons-material/Search'
import MoreVertIcon from '@mui/icons-material/MoreHoriz'
import RefreshIcon from '@mui/icons-material/Refresh'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import GoogleIcon from '@mui/icons-material/Google'
import EmailIcon from '@mui/icons-material/AlternateEmail'
import CorporateFareIcon from '@mui/icons-material/CorporateFare'

import { listUsers, userAction } from './api'
import { SectionHeader, Loading, ErrorNote, EmptyState, ConfirmDialog, BulkBar, BulkConfirmDialog, relativeTime, formatDate, wideDialog } from './ui'

// Users have no stored "organization" — the domain half of their email is the
// closest proxy and needs no extra data or server change.
const orgOf = (email) => (email || '').split('@')[1]?.toLowerCase() || 'unknown'

export default function UsersPanel() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [menu, setMenu] = useState(null)         // { anchorEl, user }
  const [confirm, setConfirm] = useState(null)   // { ...ConfirmDialog props }
  const [pwFor, setPwFor] = useState(null)       // user we're setting a password for
  const [renameFor, setRenameFor] = useState(null)
  const [resetLink, setResetLink] = useState(null)

  const [selected, setSelected] = useState(() => new Set())
  const [groupByOrg, setGroupByOrg] = useState(false)
  const [bulk, setBulk] = useState(null)         // { ...BulkConfirmDialog props }

  const load = useCallback(async (search) => {
    setLoading(true); setError(null)
    try {
      const data = await listUsers(search)
      setUsers(data.users)
      setTotal(data.total)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load('') }, [load])

  // Debounced search — the server refilters the full list on each call, so
  // firing on every keystroke would be a request per character.
  useEffect(() => {
    const t = setTimeout(() => load(q), 300)
    return () => clearTimeout(t)
  }, [q, load])

  // Drop any selected uid that no longer appears in the loaded list (a search,
  // a refresh, or a completed bulk action can all change the set).
  useEffect(() => {
    setSelected(prev => {
      const ids = new Set(users.map(u => u.uid))
      const next = new Set([...prev].filter(uid => ids.has(uid)))
      return next.size === prev.size ? prev : next
    })
  }, [users])

  const run = async (body, successMessage) => {
    const result = await userAction(body)
    setNotice(successMessage)
    await load(q)
    return result
  }

  const closeMenu = () => setMenu(null)

  const act = (user) => ({
    disable: () => setConfirm({
      title: `Disable ${user.email}?`,
      message: 'They will be signed out immediately and unable to sign in again until you re-enable them. Their boards and tasks are untouched.',
      confirmLabel: 'Disable',
      danger: true,
      onConfirm: () => run({ action: 'disable', uid: user.uid }, `${user.email} disabled.`),
    }),
    enable: () => run({ action: 'enable', uid: user.uid }, `${user.email} re-enabled.`).catch(e => setError(e.message)),
    revoke: () => setConfirm({
      title: 'Sign out everywhere?',
      message: `${user.email} will be signed out of every device and asked to sign in again. Their password is unchanged.`,
      confirmLabel: 'Sign out everywhere',
      onConfirm: () => run({ action: 'revokeSessions', uid: user.uid }, `Sessions revoked for ${user.email}.`),
    }),
    verify: () => run({ action: 'verifyEmail', uid: user.uid }, 'Email marked verified.').catch(e => setError(e.message)),
    resetLink: async () => {
      try {
        const r = await userAction({ action: 'resetLink', uid: user.uid })
        setResetLink({ user, link: r.link })
      } catch (e) { setError(e.message) }
    },
    remove: () => setConfirm({
      title: `Delete ${user.email}?`,
      message: user.ownedBoards
        ? `This permanently deletes their account. They own ${user.ownedBoards} board${user.ownedBoards === 1 ? '' : 's'} — those are kept, but will have no owner until you reassign them under Boards.`
        : 'This permanently deletes their account, profile and preferences. It cannot be undone.',
      confirmLabel: 'Delete account',
      danger: true,
      requirePhrase: user.email,
      onConfirm: async () => {
        const r = await run({ action: 'delete', uid: user.uid }, `${user.email} deleted.`)
        if (r.orphanedBoards?.length) {
          setNotice(`${user.email} deleted. ${r.orphanedBoards.length} board(s) now have no owner: ${r.orphanedBoards.map(b => b.name).join(', ')}.`)
        }
      },
    }),
  })

  const toggleOne = (uid) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(uid)) next.delete(uid); else next.add(uid)
    return next
  })
  const toggleAll = (list) => setSelected(prev => {
    const allIn = list.every(u => prev.has(u.uid))
    if (allIn) return new Set([...prev].filter(uid => !list.some(u => u.uid === uid)))
    return new Set([...prev, ...list.map(u => u.uid)])
  })

  const selectedUsers = users.filter(u => selected.has(u.uid))

  const bulkActions = [
    { label: 'Disable', onClick: () => setBulk({
        title: `Disable ${selectedUsers.length} account${selectedUsers.length === 1 ? '' : 's'}?`,
        message: 'Each account will be signed out immediately and unable to sign in until re-enabled. Admin accounts and your own account are skipped automatically.',
        confirmLabel: 'Disable', danger: true,
        items: selectedUsers, itemLabel: (u) => u.email,
        onConfirmEach: (u) => userAction({ action: 'disable', uid: u.uid }),
      }) },
    { label: 'Enable', onClick: () => setBulk({
        title: `Re-enable ${selectedUsers.length} account${selectedUsers.length === 1 ? '' : 's'}?`,
        message: 'Each account will be able to sign in again.',
        confirmLabel: 'Enable',
        items: selectedUsers, itemLabel: (u) => u.email,
        onConfirmEach: (u) => userAction({ action: 'enable', uid: u.uid }),
      }) },
    { label: 'Sign out everywhere', onClick: () => setBulk({
        title: `Sign out ${selectedUsers.length} account${selectedUsers.length === 1 ? '' : 's'} everywhere?`,
        message: 'Each account will be signed out of every device and asked to sign in again. Passwords are unchanged.',
        confirmLabel: 'Sign out everywhere',
        items: selectedUsers, itemLabel: (u) => u.email,
        onConfirmEach: (u) => userAction({ action: 'revokeSessions', uid: u.uid }),
      }) },
    { label: 'Delete', danger: true, onClick: () => setBulk({
        title: `Delete ${selectedUsers.length} account${selectedUsers.length === 1 ? '' : 's'}?`,
        message: 'This permanently deletes each account, profile and preferences. Boards they own are kept but become unowned. Admin accounts and your own account are skipped automatically. This cannot be undone.',
        confirmLabel: 'Delete accounts', danger: true,
        items: selectedUsers, itemLabel: (u) => u.email,
        onConfirmEach: (u) => userAction({ action: 'delete', uid: u.uid }),
      }) },
  ]

  const groups = groupByOrg
    ? Object.entries(
        users.reduce((acc, u) => {
          const key = orgOf(u.email)
          ;(acc[key] ||= []).push(u)
          return acc
        }, {})
      ).sort((a, b) => b[1].length - a[1].length)
    : [['all', users]]

  const renderRow = (u, i, list) => (
    <Box key={u.uid} sx={{ borderTop: i ? '1px solid' : 'none', borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ px: 2.5, py: 1.75 }}>
        <Checkbox
          size="small"
          checked={selected.has(u.uid)}
          onChange={() => toggleOne(u.uid)}
          sx={{ p: 0 }}
        />
        <Avatar src={u.photoURL || undefined} sx={{ width: 34, height: 34, opacity: u.disabled ? 0.4 : 1 }}>
          {(u.displayName || u.email || '?')[0].toUpperCase()}
        </Avatar>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 500, textDecoration: u.disabled ? 'line-through' : 'none' }}>
              {u.displayName || '—'}
            </Typography>
            {u.isAdmin && <Chip label="Admin" size="small" sx={{ height: 17, fontSize: '0.625rem' }} />}
            {u.disabled && <Chip label="Disabled" size="small" color="error" variant="outlined" sx={{ height: 17, fontSize: '0.625rem' }} />}
            {!u.emailVerified && <Chip label="Unverified" size="small" variant="outlined" sx={{ height: 17, fontSize: '0.625rem' }} />}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {u.email || 'no email'}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
          {u.providers.includes('google.com') && (
            <Tooltip title="Google sign-in"><GoogleIcon sx={{ fontSize: 15, color: 'text.secondary' }} /></Tooltip>
          )}
          {u.providers.includes('password') && (
            <Tooltip title="Email + password"><EmailIcon sx={{ fontSize: 15, color: 'text.secondary' }} /></Tooltip>
          )}
        </Stack>

        <Box sx={{ width: 96, display: { xs: 'none', sm: 'block' } }}>
          <Typography variant="caption" color="text.secondary">
            {u.ownedBoards + u.memberBoards} board{u.ownedBoards + u.memberBoards === 1 ? '' : 's'}
          </Typography>
        </Box>

        <Tooltip title={`Joined ${formatDate(u.createdAt)}`}>
          <Box sx={{ width: 96, display: { xs: 'none', sm: 'block' } }}>
            <Typography variant="caption" color="text.secondary">
              {relativeTime(u.lastSignInAt)}
            </Typography>
          </Box>
        </Tooltip>

        <IconButton size="small" onClick={(e) => setMenu({ anchorEl: e.currentTarget, user: u })}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Box>
  )

  return (
    <Box>
      <SectionHeader
        title="Users"
        subtitle={`${total} account${total === 1 ? '' : 's'} in Firebase Auth.`}
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <ToggleButton
              size="small"
              value="groupByOrg"
              selected={groupByOrg}
              onChange={() => setGroupByOrg(g => !g)}
              sx={{ textTransform: 'none', px: 1.25, py: 0.5, gap: 0.75 }}
            >
              <CorporateFareIcon sx={{ fontSize: 16 }} />
              Group by organization
            </ToggleButton>
            <Button size="small" startIcon={<RefreshIcon />} onClick={() => load(q)} disabled={loading} sx={{ color: 'text.secondary' }}>
              Refresh
            </Button>
          </Stack>
        }
      />

      <ErrorNote error={error} onRetry={() => load(q)} />
      {notice && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}

      <TextField
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search by email, name or UID"
        sx={{ mb: 2, maxWidth: 360 }}
        slotProps={{
          input: {
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} /></InputAdornment>,
          },
        }}
      />

      <BulkBar count={selected.size} onClear={() => setSelected(new Set())} actions={bulkActions} />

      {loading && users.length === 0 ? <Loading /> : users.length === 0 ? (
        <EmptyState>{q ? `No accounts match “${q}”.` : 'No accounts yet.'}</EmptyState>
      ) : (
        <Stack spacing={groupByOrg ? 2 : 0}>
          {groups.map(([org, list]) => (
            <Box key={org} sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
              {groupByOrg && (
                <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.25, bgcolor: '#fafafa', borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Checkbox
                    size="small"
                    checked={list.every(u => selected.has(u.uid))}
                    indeterminate={list.some(u => selected.has(u.uid)) && !list.every(u => selected.has(u.uid))}
                    onChange={() => toggleAll(list)}
                    sx={{ p: 0 }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{org}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {list.length} account{list.length === 1 ? '' : 's'}
                  </Typography>
                </Stack>
              )}
              {list.map((u, i) => renderRow(u, i, list))}
            </Box>
          ))}
        </Stack>
      )}

      {/* Row menu */}
      <Menu
        open={!!menu}
        anchorEl={menu?.anchorEl}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 220, borderRadius: 2 } } }}
      >
        {menu && [
          <MenuItem key="reset" onClick={() => { act(menu.user).resetLink(); closeMenu() }}>
            Send password reset link…
          </MenuItem>,
          <MenuItem key="pw" onClick={() => { setPwFor(menu.user); closeMenu() }}>
            Set a new password…
          </MenuItem>,
          <MenuItem key="rename" onClick={() => { setRenameFor(menu.user); closeMenu() }}>
            Change display name…
          </MenuItem>,
          <Divider key="d1" />,
          !menu.user.emailVerified && (
            <MenuItem key="verify" onClick={() => { act(menu.user).verify(); closeMenu() }}>
              Mark email verified
            </MenuItem>
          ),
          <MenuItem key="revoke" onClick={() => { act(menu.user).revoke(); closeMenu() }}>
            Sign out everywhere
          </MenuItem>,
          menu.user.disabled ? (
            <MenuItem key="enable" onClick={() => { act(menu.user).enable(); closeMenu() }}>
              Re-enable account
            </MenuItem>
          ) : (
            <MenuItem key="disable" onClick={() => { act(menu.user).disable(); closeMenu() }}>
              Disable account
            </MenuItem>
          ),
          <Divider key="d2" />,
          <MenuItem key="del" onClick={() => { act(menu.user).remove(); closeMenu() }} sx={{ color: 'error.main' }}>
            Delete account…
          </MenuItem>,
        ].filter(Boolean)}
      </Menu>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        {...(confirm || { title: '', message: '', onConfirm: () => {} })}
      />

      <SetPasswordDialog
        user={pwFor}
        onClose={() => setPwFor(null)}
        onDone={(email) => { setPwFor(null); setNotice(`Password changed for ${email}. They've been signed out everywhere.`) }}
      />

      <RenameDialog
        user={renameFor}
        onClose={() => setRenameFor(null)}
        onDone={async (name) => { setRenameFor(null); setNotice(`Display name set to “${name}”.`); await load(q) }}
      />

      <ResetLinkDialog data={resetLink} onClose={() => setResetLink(null)} />

      <BulkConfirmDialog
        open={!!bulk}
        onClose={() => { setBulk(null); setSelected(new Set()); load(q) }}
        {...(bulk || { title: '', message: '', items: [], itemLabel: () => '', onConfirmEach: async () => {} })}
      />
    </Box>
  )
}

// ── Set password ─────────────────────────────────────────────────────────────
function SetPasswordDialog({ user, onClose, onDone }) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => { if (user) { setPw(''); setErr(null) } }, [user])

  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      await userAction({ action: 'setPassword', uid: user.uid, password: pw })
      onDone(user.email)
    } catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={!!user} onClose={() => !busy && onClose()}>
      <DialogTitle>Set a new password</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Sets the password for <strong>{user?.email}</strong> directly and signs them out of every
          device. They won't be told — you'll need to pass the new password on yourself.
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          A reset link is usually the better option: it lets them choose their own password and
          nothing secret passes through you.
        </Typography>
        <TextField
          type="text"
          label="New password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          autoFocus
          autoComplete="off"
          helperText="At least 8 characters."
          onKeyDown={e => { if (e.key === 'Enter' && pw.length >= 8) submit() }}
        />
        {err && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{err}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy || pw.length < 8}>
          {busy ? 'Saving…' : 'Set password'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Rename ───────────────────────────────────────────────────────────────────
function RenameDialog({ user, onClose, onDone }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => { if (user) { setName(user.displayName || ''); setErr(null) } }, [user])

  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      await userAction({ action: 'rename', uid: user.uid, displayName: name.trim() })
      onDone(name.trim())
    } catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={!!user} onClose={() => !busy && onClose()}>
      <DialogTitle>Change display name</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Updates both the Auth account and their app profile.
        </Typography>
        <TextField
          label="Display name" value={name} autoFocus
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
        />
        {err && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{err}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Reset link ───────────────────────────────────────────────────────────────
function ResetLinkDialog({ data, onClose }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => { if (data) setCopied(false) }, [data])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.link)
      setCopied(true)
    } catch { /* clipboard blocked — the link is selectable below */ }
  }

  return (
    <Dialog open={!!data} onClose={onClose} slotProps={wideDialog(560)}>
      <DialogTitle>Password reset link</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          A one-time link for <strong>{data?.user.email}</strong>. Send it to them however you
          normally would — it lets them set their own password, so you never handle it.
        </Typography>
        <Box sx={{
          p: 1.5, bgcolor: '#f9fafb', border: '1px solid', borderColor: 'divider',
          borderRadius: 2, fontSize: '0.75rem', fontFamily: 'ui-monospace, monospace',
          wordBreak: 'break-all', maxHeight: 140, overflow: 'auto',
        }}>
          {data?.link}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          Treat it like a password — anyone with this link can take over the account until it's used
          or expires.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Close</Button>
        <Button variant="contained" startIcon={<ContentCopyIcon />} onClick={copy}>
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
