import { useState } from 'react'
import Avatar from '@mui/material/Avatar'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import TextField from '@mui/material/TextField'
import Stack from '@mui/material/Stack'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import AddIcon from '@mui/icons-material/Add'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import LogoutIcon from '@mui/icons-material/Logout'
import { signOutUser, setUserProfile } from '../firebase'
import { getAvatarColor } from '../utils/dateUtils'
import { PhotoPicker } from './Modals'

// Transparent 1×1 GIF — used as invisible drag image
const TRANSPARENT_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

// ── Profile editor panel ──────────────────────────────────────────────────────
function ProfilePanel({ user, profile, onSave, onClose }) {
  const [name,   setName]   = useState(profile?.name  || user?.displayName || '')
  const [photo,  setPhoto]  = useState(profile?.photo || user?.photoURL    || null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try { await onSave({ name: name.trim() || null, photo: photo || null }) } finally { setSaving(false) }
    onClose()
  }

  return (
    <Box sx={{ p: 2, background: '#f9fafb', borderRadius: 2, mb: 1, border: '1px solid', borderColor: 'divider' }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary' }}>Edit profile</Typography>
      <PhotoPicker value={photo} onChange={setPhoto} />
      <TextField
        label="Display name" size="small" fullWidth
        value={name} onChange={e => setName(e.target.value)}
        sx={{ mb: 1.5 }}
        onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
      />
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button size="small" onClick={onClose}>Cancel</Button>
        <Button size="small" variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Stack>
    </Box>
  )
}

export default function LeftNav({
  user, userProfile, onUpdateProfile,
  boards, activeBoardId, favoriteBoardIds = [],
  onSelectBoard, onNewBoard, onReorderBoards, onToggleFavorite,
  isOverlay, onClose, onDock,
  onEditProfile,
}) {
  const [menuAnchor,  setMenuAnchor]  = useState(null)
  const [draggedId,   setDraggedId]   = useState(null)
  const [dragOverId,  setDragOverId]  = useState(null)
  const [dragPosition,setDragPosition]= useState(null)

  const displayName  = userProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'You'
  const photoUrl     = userProfile?.photo || user?.photoURL || null
  const avatarColor  = getAvatarColor(displayName)
  const avatarLetter = displayName.charAt(0).toUpperCase()

  const favoriteBoards = boards.filter(b => favoriteBoardIds.includes(b.id))
  const regularBoards  = boards.filter(b => !favoriteBoardIds.includes(b.id))
  const hasFavorites   = favoriteBoards.length > 0

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (e, boardId) => {
    setDraggedId(boardId)
    e.dataTransfer.effectAllowed = 'move'
    const img = new Image()
    img.src = TRANSPARENT_GIF
    e.dataTransfer.setDragImage(img, 0, 0)
  }

  const handleDragOver = (e, boardId) => {
    e.preventDefault()
    if (boardId === draggedId) return
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOverId(boardId)
    setDragPosition(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after')
  }

  const handleDrop = (e, targetId) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) { resetDrag(); return }
    const ids = boards.map(b => b.id)
    const newIds = ids.filter(id => id !== draggedId)
    const targetIdx = newIds.indexOf(targetId)
    newIds.splice(dragPosition === 'after' ? targetIdx + 1 : targetIdx, 0, draggedId)
    onReorderBoards(newIds)
    resetDrag()
  }

  const resetDrag = () => { setDraggedId(null); setDragOverId(null); setDragPosition(null) }

  const renderBoardItem = (board) => (
    <Box
      key={board.id}
      className={[
        'left-nav__board-wrap',
        dragOverId === board.id && dragPosition === 'before' ? 'left-nav__board-wrap--before' : '',
        dragOverId === board.id && dragPosition === 'after'  ? 'left-nav__board-wrap--after'  : '',
      ].filter(Boolean).join(' ')}
      draggable
      onDragStart={e => handleDragStart(e, board.id)}
      onDragOver={e => handleDragOver(e, board.id)}
      onDrop={e => handleDrop(e, board.id)}
      onDragEnd={resetDrag}
    >
      <Box
        className={`left-nav__board-row${board.id === activeBoardId ? ' left-nav__board-row--active' : ''}${draggedId === board.id ? ' left-nav__board-row--dragging' : ''}`}
        sx={{ display: 'flex', alignItems: 'center', borderRadius: 2, transition: 'background 0.1s' }}
      >
        <Box
          component="button"
          className="left-nav__board-btn"
          onClick={() => { onSelectBoard(board.id); if (isOverlay) onClose?.() }}
          sx={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <Typography variant="body2" noWrap className="left-nav__board-name">{board.name}</Typography>
        </Box>

        <Tooltip title={favoriteBoardIds.includes(board.id) ? 'Remove from favourites' : 'Add to favourites'} placement="right">
          <IconButton
            size="small"
            className={`left-nav__star-btn${favoriteBoardIds.includes(board.id) ? ' left-nav__star-btn--active' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleFavorite(board.id) }}
            sx={{ width: 28, height: 28, opacity: 0 }}
          >
            {favoriteBoardIds.includes(board.id)
              ? <StarIcon sx={{ fontSize: 14 }} />
              : <StarBorderIcon sx={{ fontSize: 14 }} />
            }
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )

  return (
    <nav className={`left-nav${isOverlay ? ' left-nav--overlay' : ''}`}>

      {/* ── Header ── */}
      <Box className="left-nav__header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: '12px 12px 12px 16px' }}>
        <Box className="left-nav__brand" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NavLogo />
          <Typography variant="subtitle1" className="left-nav__brand-name">RoadMap</Typography>
        </Box>
        <Tooltip title={isOverlay ? 'Dock navigation' : 'Collapse navigation'} placement="right">
          <IconButton size="small" className="left-nav__toggle" onClick={isOverlay ? onDock : onClose}>
            {isOverlay ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Body ── */}
      <Box className="left-nav__body" sx={{ flex: 1, overflowY: 'auto', px: 0 }}>

        {hasFavorites && (
          <Box className="left-nav__section" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle2" color="text.secondary" className="left-nav__section-label" sx={{ px: 1.5, py: 0.5 }}>
              Favourites
            </Typography>
            {favoriteBoards.map(renderBoardItem)}
          </Box>
        )}

        <Box className="left-nav__section">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 0.5 }}>
            <Typography variant="subtitle2" color="text.secondary" className="left-nav__section-label">Boards</Typography>
            <Tooltip title="New board" placement="right">
              <IconButton size="small" className="left-nav__new-btn" onClick={onNewBoard} sx={{ width: 24, height: 24 }}>
                <AddIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
          {regularBoards.map(renderBoardItem)}
          {regularBoards.length === 0 && boards.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ px: 1, display: 'block' }}>All boards are in Favourites</Typography>
          )}
          {boards.length === 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ px: 1, display: 'block' }}>No boards yet</Typography>
          )}
        </Box>
      </Box>

      {/* ── Footer ── */}
      <Box className="left-nav__footer" sx={{ p: 1 }}>
        <Box
          onClick={e => setMenuAnchor(e.currentTarget)}
          className="left-nav__user-btn"
          sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '8px', borderRadius: 2, cursor: 'pointer', '&:hover': { background: 'var(--m3-surface-container-high)' } }}
        >
          <Avatar
            src={photoUrl || undefined}
            sx={{ width: 32, height: 32, background: photoUrl ? 'transparent' : avatarColor, fontSize: 14, fontWeight: 700 }}
          >
            {!photoUrl && avatarLetter}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap className="left-nav__user-name">{displayName}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap className="left-nav__user-email" sx={{ display: 'block' }}>{user?.email}</Typography>
          </Box>
        </Box>

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          PaperProps={{ sx: { minWidth: 200, borderRadius: 2 } }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="body2" fontWeight={600}>{displayName}</Typography>
            <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
          </Box>
          <Divider />
          <MenuItem onClick={() => { setMenuAnchor(null); onEditProfile?.() }}>
            <ListItemIcon><PersonOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Edit profile" primaryTypographyProps={{ variant: 'body2' }} />
          </MenuItem>
          <MenuItem onClick={() => {
            // Clear board URL so logout lands on the clean welcome screen
            const url = new URL(window.location)
            url.searchParams.delete('board')
            window.history.replaceState({}, '', url)
            // Prevent the Credential Management API from silently re-signing in
            if (navigator.credentials?.preventSilentAccess) {
              navigator.credentials.preventSilentAccess()
            }
            signOutUser(); setMenuAnchor(null)
          }} sx={{ color: 'error.main' }}>
            <ListItemIcon><LogoutIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
            <ListItemText primary="Sign out" primaryTypographyProps={{ variant: 'body2', color: 'error' }} />
          </MenuItem>
        </Menu>
      </Box>
    </nav>
  )
}

// ── Logo ─────────────────────────────────────────────────────────────────────
function NavLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="var(--m3-primary, #111827)"/>
      <rect x="6" y="10" width="20" height="3" rx="1.5" fill="white"/>
      <rect x="6" y="15" width="14" height="3" rx="1.5" fill="white" opacity="0.75"/>
      <rect x="6" y="20" width="17" height="3" rx="1.5" fill="white" opacity="0.5"/>
    </svg>
  )
}
