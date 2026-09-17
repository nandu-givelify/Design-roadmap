// The org directory (orgMembers) and per-account profiles (userProfiles).
//
// orgMembers is what feeds "people you already know" suggestions when adding
// someone to a board. It's keyed by lowercased email, so the same person added
// twice under two addresses becomes two entries — merging those is the main
// reason this panel exists.
import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Checkbox from '@mui/material/Checkbox'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Radio from '@mui/material/Radio'
import ToggleButton from '@mui/material/ToggleButton'
import SearchIcon from '@mui/icons-material/Search'
import RefreshIcon from '@mui/icons-material/Refresh'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import MergeIcon from '@mui/icons-material/CallMerge'
import SyncIcon from '@mui/icons-material/CloudSync'
import CorporateFareIcon from '@mui/icons-material/CorporateFare'

import { getDirectory, dirAction } from './api'
import { SectionHeader, Loading, ErrorNote, EmptyState, ConfirmDialog, BulkBar, BulkConfirmDialog, relativeTime, wideDialog } from './ui'

export default function DirectoryPanel() {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('members')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [editing, setEditing] = useState(null)   // { kind: 'member'|'profile', row }
  const [merging, setMerging] = useState(null)   // group of duplicate members

  const [selected, setSelected] = useState(() => new Set())
  const [groupByOrg, setGroupByOrg] = useState(false)
  const [bulk, setBulk] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await getDirectory()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    setSelected(prev => {
      const ids = new Set((data?.members || []).map(m => m.id))
      const next = new Set([...prev].filter(id => ids.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [data])

  useEffect(() => { setSelected(new Set()) }, [tab])

  const backfill = () => setConfirm({
    title: 'Rebuild the org directory?',
    message: 'Scans every board and registers anyone with a company email address into the directory. Safe to run repeatedly — it only adds and refreshes entries, never deletes.',
    confirmLabel: 'Run backfill',
    onConfirm: async () => {
      const r = await dirAction({ action: 'backfill' })
      setNotice(`Scanned ${r.scanned} people across ${r.boards} boards — ${r.added.length} directory entries registered.`)
      await load()
    },
  })

  if (loading && !data) return <Loading label="Loading directory…" />

  const needle = q.trim().toLowerCase()
  const members = (data?.members || []).filter(m =>
    !needle || (m.name || '').toLowerCase().includes(needle) || (m.email || '').toLowerCase().includes(needle))
  const profiles = (data?.profiles || []).filter(p =>
    !needle || (p.name || '').toLowerCase().includes(needle) || (p.email || '').toLowerCase().includes(needle))

  const toggleOne = (id) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleAll = (list) => setSelected(prev => {
    const allIn = list.every(m => prev.has(m.id))
    if (allIn) return new Set([...prev].filter(id => !list.some(m => m.id === id)))
    return new Set([...prev, ...list.map(m => m.id)])
  })
  const selectedMembers = members.filter(m => selected.has(m.id))

  const memberGroups = groupByOrg
    ? Object.entries(
        members.reduce((acc, m) => {
          const key = m.domain || 'unknown'
          ;(acc[key] ||= []).push(m)
          return acc
        }, {})
      ).sort((a, b) => b[1].length - a[1].length)
    : [['all', members]]

  return (
    <Box>
      <SectionHeader
        title="Directory"
        subtitle="Shared people records that feed suggestions when adding someone to a board."
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            {tab === 'members' && (
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
            )}
            <Button size="small" startIcon={<SyncIcon />} onClick={backfill} sx={{ color: 'text.secondary' }}>
              Backfill
            </Button>
            <Button size="small" startIcon={<RefreshIcon />} onClick={load} disabled={loading} sx={{ color: 'text.secondary' }}>
              Refresh
            </Button>
          </Stack>
        }
      />

      <ErrorNote error={error} onRetry={load} />
      {notice && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}

      {data?.duplicates.length > 0 && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          {data.duplicates.length} name{data.duplicates.length === 1 ? '' : 's'} appear more than once.{' '}
          {data.duplicates.map((g, i) => (
            <Button key={i} size="small" startIcon={<MergeIcon />} onClick={() => setMerging(g)} sx={{ ml: 0.5 }}>
              Merge {g[0].name}
            </Button>
          ))}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0 } }}>
        <Tab value="members"  label={`Org directory (${data?.members.length || 0})`} />
        <Tab value="profiles" label={`Profiles (${data?.profiles.length || 0})`} />
      </Tabs>

      <TextField
        value={q} onChange={e => setQ(e.target.value)}
        placeholder="Search by name or email"
        sx={{ mb: 2, maxWidth: 360 }}
        slotProps={{
          input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} /></InputAdornment> },
        }}
      />

      {tab === 'members' && (
        <BulkBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          actions={[
            { label: 'Remove', danger: true, onClick: () => setBulk({
                title: `Remove ${selectedMembers.length} entr${selectedMembers.length === 1 ? 'y' : 'ies'} from the directory?`,
                message: 'They stay on every board they belong to — this only removes the shared suggestion entries.',
                confirmLabel: 'Remove', danger: true,
                items: selectedMembers, itemLabel: (m) => m.name || m.email,
                onConfirmEach: (m) => dirAction({ action: 'deleteMember', id: m.id }),
              }) },
          ]}
        />
      )}

      {tab === 'members' ? (
        members.length === 0 ? (
          <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
            <EmptyState>No directory entries.</EmptyState>
          </Box>
        ) : (
          <Stack spacing={groupByOrg ? 2 : 0}>
            {memberGroups.map(([org, list]) => (
              <Box key={org} sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
                {groupByOrg && (
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.25, bgcolor: '#fafafa', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Checkbox
                      size="small"
                      checked={list.every(m => selected.has(m.id))}
                      indeterminate={list.some(m => selected.has(m.id)) && !list.every(m => selected.has(m.id))}
                      onChange={() => toggleAll(list)}
                      sx={{ p: 0 }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{org}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {list.length} {list.length === 1 ? 'person' : 'people'}
                    </Typography>
                  </Stack>
                )}
                {list.map((m, i) => (
                  <Row
                    key={m.id} first={!i}
                    checked={selected.has(m.id)}
                    onToggle={() => toggleOne(m.id)}
                    name={m.name} secondary={m.email} photo={m.photo}
                    meta={<Chip label={m.domain} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.625rem' }} />}
                    trailing={relativeTime(m.updatedAt)}
                    onEdit={() => setEditing({ kind: 'member', row: m })}
                    onDelete={() => setConfirm({
                      title: `Remove ${m.name || m.email} from the directory?`,
                      message: 'They stay on every board they belong to — this only removes the shared suggestion entry.',
                      confirmLabel: 'Remove', danger: true,
                      onConfirm: async () => { await dirAction({ action: 'deleteMember', id: m.id }); setNotice('Directory entry removed.'); await load() },
                    })}
                  />
                ))}
              </Box>
            ))}
          </Stack>
        )
      ) : (
        <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
          {profiles.length === 0 ? <EmptyState>No profiles.</EmptyState> : profiles.map((p, i) => (
            <Row
              key={p.uid} first={!i}
              name={p.name} secondary={p.email || p.uid} photo={p.photo}
              meta={p.role && <Chip label={p.role} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.625rem' }} />}
              trailing={p.timeOff ? `${p.timeOff} time off` : ''}
              onEdit={() => setEditing({ kind: 'profile', row: p })}
            />
          ))}
        </Box>
      )}

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} {...(confirm || { title: '', message: '', onConfirm: () => {} })} />

      <EditDialog
        editing={editing}
        onClose={() => setEditing(null)}
        onDone={async (msg) => { setEditing(null); setNotice(msg); await load() }}
      />

      <MergeDialog
        group={merging}
        onClose={() => setMerging(null)}
        onDone={async (msg) => { setMerging(null); setNotice(msg); await load() }}
      />

      <BulkConfirmDialog
        open={!!bulk}
        onClose={() => { setBulk(null); setSelected(new Set()); load() }}
        {...(bulk || { title: '', message: '', items: [], itemLabel: () => '', onConfirmEach: async () => {} })}
      />
    </Box>
  )
}

function Row({ first, name, secondary, photo, meta, trailing, onEdit, onDelete, checked, onToggle }) {
  return (
    <Stack direction="row" alignItems="center" spacing={2}
      sx={{ px: 2.5, py: 1.5, borderTop: first ? 'none' : '1px solid', borderColor: 'divider' }}>
      {onToggle && <Checkbox size="small" checked={!!checked} onChange={onToggle} sx={{ p: 0 }} />}
      <Avatar src={photo || undefined} sx={{ width: 30, height: 30 }}>
        {(name || secondary || '?')[0].toUpperCase()}
      </Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{name || '—'}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {secondary}
        </Typography>
      </Box>
      {meta}
      <Typography variant="caption" color="text.secondary" sx={{ width: 90, display: { xs: 'none', sm: 'block' } }}>
        {trailing}
      </Typography>
      {onEdit && <IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton>}
      {onDelete && <IconButton size="small" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton>}
    </Stack>
  )
}

function EditDialog({ editing, onClose, onDone }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!editing) return
    setName(editing.row.name || '')
    setEmail(editing.row.email || '')
    setRole(editing.row.role || '')
    setErr(null)
  }, [editing])

  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      if (editing.kind === 'member') {
        await dirAction({ action: 'updateMember', id: editing.row.id, name: name.trim(), email: email.trim(), photo: editing.row.photo })
      } else {
        await dirAction({ action: 'updateProfile', uid: editing.row.uid, name: name.trim(), role: role.trim() || null })
      }
      onDone('Saved.')
    } catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={!!editing} onClose={() => !busy && onClose()}>
      <DialogTitle>{editing?.kind === 'member' ? 'Edit directory entry' : 'Edit profile'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField label="Name" value={name} onChange={e => setName(e.target.value)} autoFocus />
          {editing?.kind === 'member' ? (
            <TextField
              label="Email" value={email} onChange={e => setEmail(e.target.value)}
              helperText="The entry's document ID stays the original address; this is the displayed one."
            />
          ) : (
            <TextField label="Role" value={role} onChange={e => setRole(e.target.value)} placeholder="Designer, PM, Dev…" />
          )}
        </Stack>
        {err && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{err}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  )
}

function MergeDialog({ group, onClose, onDone }) {
  const [keepId, setKeepId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => { if (group) { setKeepId(group[0].id); setErr(null) } }, [group])

  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      const removeIds = group.filter(m => m.id !== keepId).map(m => m.id)
      await dirAction({ action: 'mergeMembers', keepId, removeIds })
      onDone(`Merged — ${removeIds.length} duplicate entr${removeIds.length === 1 ? 'y' : 'ies'} removed.`)
    } catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <Dialog open={!!group} onClose={() => !busy && onClose()} slotProps={wideDialog(520)}>
      <DialogTitle>Merge duplicate entries</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose the entry to keep. The others are removed from the directory — board memberships
          and tasks are untouched.
        </Typography>
        <Stack>
          {(group || []).map(m => (
            <Stack key={m.id} direction="row" alignItems="center" spacing={1.5}
              sx={{ py: 1, cursor: 'pointer' }} onClick={() => setKeepId(m.id)}>
              <Radio checked={keepId === m.id} size="small" />
              <Avatar src={m.photo || undefined} sx={{ width: 28, height: 28 }}>
                {(m.name || m.email || '?')[0].toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2">{m.name || '—'}</Typography>
                <Typography variant="caption" color="text.secondary">{m.email}</Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
        {err && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{err}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy || !keepId}>{busy ? 'Merging…' : 'Merge'}</Button>
      </DialogActions>
    </Dialog>
  )
}
