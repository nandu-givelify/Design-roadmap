import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#111827',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#6b7280',
    },
    error: {
      main: '#dc2626',
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff',
    },
    text: {
      primary: '#111827',
      secondary: '#666',
    },
    divider: '#e5e7eb',
  },
  typography: {
    fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
    // Base = 16px (browser default). All sizes in rem match that.
    h5: { fontWeight: 700, fontSize: '1.5rem',   lineHeight: 1.3 },  // 24px — large titles
    h6: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.35 }, // 18px — dialog titles, panel headings
    subtitle1: { fontWeight: 600, fontSize: '1rem',    lineHeight: 1.4 }, // 16px — section headers
    subtitle2: { fontWeight: 600, fontSize: '0.875rem',lineHeight: 1.4 }, // 14px — sub-section labels
    body1: { fontSize: '1rem',      lineHeight: 1.55 }, // 16px — primary body text (browser default)
    body2: { fontSize: '0.875rem', lineHeight: 1.5  }, // 14px — secondary body, list items
    caption: { fontSize: '0.75rem', lineHeight: 1.4, color: '#666' }, // 12px — hints, metadata (minimum size)
    overline: { fontSize: '0.6875rem', letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase', lineHeight: 1.4 }, // 11px — only for intentional overlines
    button: { textTransform: 'none', fontWeight: 500, fontSize: '0.875rem', lineHeight: 1.4 }, // 14px
  },
  shape: { borderRadius: 8 },
  spacing: 8,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          padding: '6px 16px',
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        sizeSmall: { padding: '4px 14px', fontSize: '0.8125rem' },
        contained: {
          backgroundColor: '#111827',
          color: '#ffffff',
          '&:hover': { backgroundColor: '#1f2937' },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: '50%',
          width: 32,
          height: 32,
          padding: 0,
          '& .MuiSvgIcon-root': { fontSize: '1rem' },
        },
        sizeSmall: {
          width: 32,
          height: 32,
          '& .MuiSvgIcon-root': { fontSize: '1rem' },
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small', variant: 'outlined', fullWidth: true },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            backgroundColor: '#ffffff',
          },
        },
      },
    },
    MuiSelect: {
      defaultProps: { size: 'small', variant: 'outlined' },
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiInputLabel: {
      defaultProps: { size: 'small' },
    },
    MuiDialog: {
      defaultProps: { maxWidth: false },
      styleOverrides: {
        paper: {
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          width: '100%',
          maxWidth: 480,
          margin: 16,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { padding: '20px 24px 12px', fontWeight: 600, fontSize: '1rem' },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: { padding: '12px 24px' },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: { padding: '12px 24px 20px', gap: 8 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { fontSize: '0.875rem', borderRadius: 4 },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true, placement: 'right' },
      styleOverrides: {
        tooltip: { fontSize: '0.75rem' },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: { fontSize: '0.875rem', fontWeight: 600 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6 },
      },
    },
  },
})

export default theme
