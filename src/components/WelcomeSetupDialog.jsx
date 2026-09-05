import { forwardRef } from 'react'
import Slide from '@mui/material/Slide'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

const SlideUp = forwardRef((props, ref) => <Slide direction="up" ref={ref} {...props} />)

// Shown once, on a brand-new sign-in, as a normal in-app dialog (not a
// full-screen takeover) — greets the user and either lets them jump into a
// board they were already invited to, or drops them straight into the board
// that was just auto-created for them.
export default function WelcomeSetupDialog({
  open, name, isNewUser, boards, activeBoardId, onSelectBoard, onClose,
}) {
  // Auto-select the first board when nothing else in the list is already active.
  const selectedBoardId = boards.some((b) => b.id === activeBoardId) ? activeBoardId : boards[0]?.id

  return (
    <Dialog
      open={open}
      onClose={onClose}
      slots={{ transition: SlideUp }}
      transitionDuration={{ enter: 300, exit: 220 }}
    >
      <DialogTitle sx={{ pr: 5 }}>
        <IconButton onClick={onClose} size="small"
          sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: '0 !important', pb: 3, minWidth: 320, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <img src="/icon.svg" alt="" width={44} height={44} />
        </Box>
        <Typography variant="h6" fontWeight={700} sx={{ mb: isNewUser ? 1 : 2 }}>
          Hi {name}, welcome to Planner
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: isNewUser ? 0 : 2, lineHeight: 1.5, px: '24px' }}>
          Planner helps you map out your team's roadmap on a simple timeline —
          add people, plan tasks, and track progress all in one place.
        </Typography>

        {!isNewUser && (
          <Box sx={{ background: '#f9fafb', borderRadius: 2, p: 1.5, textAlign: 'left' }}>
            <Typography variant="caption" color="text.secondary"
              sx={{ display: 'block', mb: 0.75, fontWeight: 600 }}>
              Boards
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {boards.map((b) => (
                <Box
                  key={b.id}
                  onClick={() => onSelectBoard(b.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 1.5, py: 1.25, borderRadius: 2,
                    background: b.id === selectedBoardId ? 'action.selected' : '#fff',
                    cursor: 'pointer', transition: 'background 0.12s',
                    '&:hover': { background: '#f3f4f6' },
                  }}
                >
                  <Typography variant="body2" fontWeight={600} sx={{ flex: 1, minWidth: 0 }} noWrap>
                    {b.name}
                  </Typography>
                  <ChevronRightIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button variant="contained" fullWidth onClick={() => { if (selectedBoardId) onSelectBoard(selectedBoardId); onClose() }}>
          Let's Get Started
        </Button>
      </DialogActions>
    </Dialog>
  )
}
