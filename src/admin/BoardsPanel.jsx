// Every board in the project — including ones you aren't a member of.
import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import Select from '@mui/material/Select'
import SearchIcon from '@mui/icons-material/Search'
import MoreVertIcon from '@mui/icons-material/MoreHoriz'
import RefreshIcon from '@mui/icons-material/Refresh'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PublicIcon from '@mui/icons-material/Public'
import CloseIcon from '@mui/icons-material/Close'

import { listBoards, boardDetail, boardAction } from './api'
import { SectionHeader, Loading, ErrorNote, EmptyState, ConfirmDialog, BulkBar, BulkConfirmDialog, formatDate, wideDialog } from './ui'

export default function BoardsPanel() {
  const [boards, setBoards] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [menu, setMenu] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [prompt, setPrompt] = useState(null) // { kind, board }

  const [selected, setSelected] = useState(() => new Set())
  const [bulk, setBulk] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setBoards((await listBoards()).boards) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    setSelected(prev => {
      const ids = new Set(boards.map(b => b.id))
      const next = new Set([...prev].filter(id => ids.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [boards])

  const run = async (body, message) => {
    await boardAction(body)
    setNotice(message)
    await load()
  }

  const needle = q.trim().toLowerCase()
  const shown = needle
    ? boards.filter(b =>
        b.name.toLowerCase().includes(needle) ||
        (b.ownerEmail || '').toLowerCase().includes(needle) ||
        b.memberEmails.some(e => (e || '').toLowerCase().includes(needle)))
    : boards

  const toggleOne = (id) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const allSelected = shown.length > 0 && shown.every(b => selected.has(b.id))
  const someSelected = shown.some(b => selected.has(b.id))
  const toggleAll = () => setSelected(prev => {
    if (allSelected) return new Set([...prev].filter(id => !shown.some(b => b.id === id)))
    return new Set([...prev, ...shown.map(b => b.id)])
  })
  const selectedBoards = boards.filter(b => selected.has(b.id))

  return (
    <Box>
      <SectionHeader
        title="Boards"
        subtitle={`${boards.length} board${boards.length === 1 ? '' : 's'} across all accounts.`}
        action={
          <Button size="small" startIcon={<RefreshIcon />} onClick={load} disabled={loading} sx={{ color: 'text.secondary' }}>
            Refresh
          </Button>
        }
      />

      <ErrorNote error={error} onRetry={load} />
      {notice && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}

      <TextField
        value={q} onChange={e => setQ(e.target.value)}
        placeholder="Search by board name, owner or member"
        sx={{ mb: 2, maxWidth: 360 }}
        slotProps={{
          input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} /></InputAdornment> },
        }}
      />

      <BulkBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          { label: 'Delete', danger: true, onClick: () => setBulk({
              title: `Delete ${selectedBoards.length} board${selectedBoards.length === 1 ? '' : 's'}?`,
              message: 'This permanently deletes each board along with its tasks and people. It cannot be undone.',
              confirmLabel: 'Delete boards', danger: true,
              items: selectedBoards, itemLabel: (b) => b.name,
              onConfirmEach: (b) => boardAction({ action: 'delete', boardId: b.id }),
            }) },
        ]}
      />

      {loading && boards.length === 0 ? <Loading /> : shown.length === 0 ? (
        <EmptyState>{q ? `No boards match “${q}”.` : 'No boards yet.'}</EmptyState>
      ) : (
        <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
          <Stack direction="row" alignItems="center" sx={{ px: 2.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#fafafa' }}>
            <Checkbox
              size="small"
              checked={allSelected}
              indeterminate={someSelected && !allSelected}
              onChange={toggleAll}
              sx={{ p: 0 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1.5 }}>Select all</Typography>
          </Stack>
          {shown.map((b, i) => (
            <Stack
              key={b.id} direction="row" alignItems="center" spacing={2}
              sx={{
                px: 2.5, py: 1.75, gap: 2,
                borderTop: i ? '1px solid' : 'none', borderColor: 'divider',
                cursor: 'pointer', '&:hover': { bgcolor: '#fafafa' },
              }}
              onClick={() => setDetailId(b.id)}
            >
              <Checkbox
                size="small"
                checked={selected.has(b.id)}
                onChange={() => toggleOne(b.id)}
                onClick={(e) => e.stopPropagation()}
                sx={{ p: 0 }}
              />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.name}
                  </Typography>
                  {b.publicAccess && (
                    <Chip
                      icon={<PublicIcon sx={{ fontSize: '0.75rem !important' }} />}
                      label={b.publicAccess === 'edit' ? 'Public — can edit' : 'Public — view only'}
                      size="small"
                      color={b.publicAccess === 'edit' ? 'warning' : 'default'}
                      variant="outlined"
                      sx={{ height: 18, fontSize: '0.625rem' }}
                    />
                  )}
                  {!b.ownerEmail && (
                    <Chip label="No owner" size="small" color="error" variant="outlined" sx={{ height: 18, fontSize: '0.625rem' }} />
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {b.ownerEmail || 'unowned'} · {b.memberEmails.length} member{b.memberEmails.length === 1 ? '' : 's'}
                </Typography>
              </Box>

              <Box sx={{ width: 130, display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="caption" color="text.secondary">
                  {b.tasks} tasks · {b.people} people
                </Typography>
              </Box>

              <Box sx={{ width: 96, display: { xs: 'none', md: 'block' } }}>
                <Typography variant="caption" color="text.secondary">{formatDate(b.createdAt)}</Typography>
              </Box>

              <IconButton size="small" onClick={(e) => { e.stopPropagation(); setMenu({ anchorEl: e.currentTarget, board: b }) }}>
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Box>
      )}

      <Menu
        open={!!menu} anchorEl={menu?.anchorEl} onClose={() => setMenu(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 230, borderRadius: 2 } } }}
      >
        {menu && [
          <MenuItem key="open" onClick={() => { setDetailId(menu.board.id); setMenu(null) }}>
            Inspect board
          </MenuItem>,
          <MenuItem key="view" onClick={() => { window.open(`/?board=${menu.board.id}`, '_blank'); setMenu(null) }}>
            Open in app <OpenInNewIcon sx={{ fontSize: 13, ml: 1, color: 'text.secondary' }} />
          </MenuItem>,
          <Divider key="d0" />,
          <MenuItem key="rename" onClick={() => { setPrompt({ kind: 'rename', board: menu.board }); setMenu(null) }}>
            Rename…
          </MenuItem>,
          <MenuItem key="owner" onClick={() => { setPrompt({ kind: 'transferOwner', board: menu.board }); setMenu(null) }}>
            Transfer ownership…
          </MenuItem>,
          <MenuItem key="member" onClick={() => { setPrompt({ kind: 'addMember', board: menu.board }); setMenu(null) }}>
            Add a member…
          </MenuItem>,
          <MenuItem key="public" onClick={() => { setPrompt({ kind: 'setPublicAccess', board: menu.board }); setMenu(null) }}>
            Change public access…
          </MenuItem>,
          <Divider key="d1" />,
          <MenuItem
            key="del"
            sx={{ color: 'error.main' }}
            onClick={() => {
              const b = menu.board
              setMenu(null)
              setConfirm({
                title: `Delete “${b.name}”?`,
                message: `This permanently deletes the board along with its ${b.tasks} task${b.tasks === 1 ? '' : 's'} and ${b.people} person record${b.people === 1 ? '' : 's'}. It cannot be undone.`,
                confirmLabel: 'Delete board',
                danger: true,
                requirePhrase: b.name,
                onConfirm: () => run({ action: 'delete', boardId: b.id }, `“${b.name}” deleted.`),
              })
            }}
          >
            Delete board…
          </MenuItem>,
        ]}
      </Menu>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} {...(confirm || { title: '', message: '', onConfirm: () => {} })} />

      <BoardPromptDialog
        prompt={prompt}
        onClose={() => setPrompt(null)}
        onDone={async (message) => { setPrompt(null); setNotice(message); await load() }}
      />

      <BoardDetailDialog
        boardId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={async (message) => { setNotice(message); await load() }}
      />

      <BulkConfirmDialog
        open={!!bulk}
        onClose={() => { setBulk(null); setSelected(new Set()); load() }}
        {...(bulk || { title: '', message: '', items: [], itemLabel: () => '', onConfirmEach: async () => {} })}
      />
    </Box>
  )
}

// ── One dialog for the four single-field board actions ───────────────────────
const PROMPTS = {
  rename:           { title: 'Rename board',       label: 'Board name',    field: 'name'  },
  transferOwner:    { title: 'Transfer ownership', label: 'New owner email', field: 'email',
                      help: 'They need an existing account — ownership is tracked by Firebase UID, so the email is looked up. They are added as a member automatically.' },
  addMember:        { title: 'Add a member',       label: 'Email address', field: 'email',
                      help: "The board appears in their sidebar once they sign in with this address." },
  setPublicAccess:  { title: 'Public access',      field: 'access' },
}

function BoardPromptDialog({ prompt, onClose, onDone }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const spec = prompt ? PROMPTS[prompt.kind] : null

  useEffect(() => {
    if (!prompt) return
    setErr(null)
    if (prompt.kind === 'rename') setValue(prompt.board.name)
    else if (prompt.kind === 'setPublicAccess') setValue(prompt.board.publicAccess || 'private')
    else setValue('')
  }, [prompt])

  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      const body = { action: prompt.kind, boardId: prompt.board.id }
      if (prompt.kind === 'setPublicAccess') body.access = value === 'private' ? null : value
      else body[spec.field] = value.trim()
      await boardAction(body)
      onDone(`“${prompt.board.name}” updated.`)
    } catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  const disabled = busy || (prompt?.kind !== 'setPublicAccess' && !value.trim())

  return (
    <Dialog open={!!prompt} onClose={() => !busy && onClose()}>
      <DialogTitle>{spec?.title}</DialogTitle>
      <DialogContent>
        {spec?.help && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{spec.help}</Typography>
        )}

        {prompt?.kind === 'setPublicAccess' ? (
          <>
            <Select value={value} onChange={e => setValue(e.target.value)} fullWidth>
              <MenuItem value="private">Private — members only</MenuItem>
              <MenuItem value="view">Public link — view only</MenuItem>
              <MenuItem value="edit">Public link — anyone can edit</MenuItem>
            </Select>
            {value === 'edit' && (
              <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                Anyone with the link can add, change and delete tasks without signing in.
              </Alert>
            )}
          </>
        ) : (
          <TextField
            label={spec?.label} value={value} autoFocus
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !disabled) submit() }}
          />
        )}

        {err && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{err}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={disabled}>{busy ? 'Saving…' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Detail ───────────────────────────────────────────────────────────────────
function BoardDetailDialog({ boardId, onClose, onChanged }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!boardId) return
    setData(null); setError(null)
    try { setData(await boardDetail(boardId)) }
    catch (e) { setError(e.message) }
  }, [boardId])

  useEffect(() => { load() }, [load])

  const removeMember = async (email) => {
    await boardAction({ action: 'removeMember', boardId, email })
    await load()
    onChanged(`${email} removed from the board.`)
  }

  return (
    <Dialog open={!!boardId} onClose={onClose} slotProps={wideDialog(720)}>
      <DialogTitle sx={{ pr: 5 }}>
        {data?.board.name || 'Board'}
        <IconButton size="small" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <ErrorNote error={error} onRetry={load} />
        {!data && !error ? <Loading /> : data && (
          <Stack spacing={2.5} sx={{ pb: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Board ID</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem' }}>
                {data.board.id}
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Members ({data.board.memberEmails?.length || 0})
              </Typography>
              {(data.board.memberEmails || []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">Nobody but the owner.</Typography>
              ) : (
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                  {data.board.memberEmails.map(email => (
                    <Chip
                      key={email} label={email} size="small" variant="outlined"
                      onDelete={() => removeMember(email)}
                      sx={{ fontSize: '0.75rem' }}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>People ({data.people.length})</Typography>
              {data.people.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No people on this board.</Typography>
              ) : (
                <Stack spacing={0.5}>
                  {data.people.map(p => (
                    <Stack key={p.id} direction="row" justifyContent="space-between" sx={{ gap: 2 }}>
                      <Typography variant="body2">{p.name || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {p.role || 'no role'}{p.email ? ` · ${p.email}` : ''}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Tasks ({data.tasks.length})</Typography>
              {data.tasks.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No tasks yet.</Typography>
              ) : (
                <Stack spacing={0.5} sx={{ maxHeight: 220, overflow: 'auto' }}>
                  {data.tasks.map(t => (
                    <Stack key={t.id} direction="row" justifyContent="space-between" sx={{ gap: 2 }}>
                      <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                        {t.start || '?'} → {t.end || '?'}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
