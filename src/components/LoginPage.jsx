import { useState, useEffect, useRef } from 'react'
import TextField from '@mui/material/TextField'
import Stack from '@mui/material/Stack'
import { signInWithGoogle, signInEmail, signUpEmail, updateUserProfile, resetPassword, getSignInMethods } from '../firebase'
import { getAvatarColor } from '../utils/dateUtils'

/*
 * Steps:
 *  'account'    — account card for last-used user
 *  'email'      — Google + email + Continue (default when no lastUser)
 *  'password'   — password field (pre-filled if Chrome autofilled it)
 *  'register'   — create account
 *  'reset-sent' — password reset confirmation
 *
 * Chrome autofill fix: a hidden <input type="password"> lives in the email-step
 * form. Chrome fills it when the user selects saved credentials. We read its
 * value when the user clicks Continue and pre-populate the password step.
 */
export default function LoginPage() {
  const [lastUser, setLastUser] = useState(null)
  const [step,     setStep]     = useState('loading')

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  // Ref to the hidden password field in the email step — captures Chrome autofill
  const hiddenPasswordRef = useRef(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('roadmap_lastUser')
      if (stored) {
        const u = JSON.parse(stored)
        setLastUser(u)
        setEmail(u.email)
        setStep('account')
      } else {
        setStep('email')
      }
    } catch {
      setStep('email')
    }
  }, [])

  const clearError = () => setError('')

  // ── Google ────────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setLoading(true); clearError()
    try { await signInWithGoogle() }
    catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') setError(friendlyError(err.code))
    }
    finally { setLoading(false) }
  }

  // ── Email step → password or register step ───────────────────────────────
  // Email enumeration protection is off for this project, so
  // fetchSignInMethodsForEmail reliably reflects whether the account exists —
  // routes a brand-new email straight to account creation.
  const handleEmailContinue = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    // Capture any Chrome-autofilled password from the hidden field
    const autofilled = hiddenPasswordRef.current?.value || ''
    if (autofilled) setPassword(autofilled)
    clearError()
    setLoading(true)
    try {
      const methods = await getSignInMethods(email.trim())
      if (methods.length === 0) {
        setStep('register')
      } else if (!methods.includes('password')) {
        setError(methods.includes('google.com')
          ? 'This email is registered with Google. Use "Continue with Google" above to sign in.'
          : 'This email uses a different sign-in method.')
      } else {
        setStep('password')
      }
    } catch {
      // Network hiccup or similar — fall back to the password step, which
      // still recovers via the "email-already-in-use" redirect in
      // handleRegister if the account turns out to exist.
      setStep('password')
    } finally {
      setLoading(false)
    }
  }

  // ── Account card tap — try saved credential, fall back to password step ───
  const handleAccountCardClick = async () => {
    setLoading(true); clearError()
    try {
      if (window.PasswordCredential && navigator.credentials?.get) {
        const cred = await navigator.credentials.get({ password: true, mediation: 'optional' })
        if (cred?.password) {
          await signInEmail(cred.id || lastUser.email, cred.password)
          return
        }
      }
      setStep('password')
    } catch (err) {
      // Only surface real Firebase Auth errors (string codes like 'auth/...').
      // A browser without Credential Management API support throws a generic
      // DOMException here (e.g. NotSupportedError) — that's not a sign-in
      // failure, so just fall through to the password step quietly.
      if (typeof err?.code === 'string' && err.code.startsWith('auth/')) {
        setError(friendlyError(err.code))
      }
      setStep('password')
    } finally {
      setLoading(false)
    }
  }

  // ── Sign in ───────────────────────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault()
    if (!password) return
    setLoading(true); clearError()
    try {
      await signInEmail(email, password)
      storeCredential(email, password)
    } catch (err) {
      const code = err.code
      if (code === 'auth/user-not-found') { setStep('register'); setError('') }
      else setError(friendlyError(code))
    } finally {
      setLoading(false)
    }
  }

  // ── Register ──────────────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault()
    if (!name.trim() || password.length < 6) return
    setLoading(true); clearError()
    try {
      await signUpEmail(email, password)
      await updateUserProfile({ displayName: name.trim() })
      storeCredential(email, password)
    } catch (err) {
      const code = err.code
      if (code === 'auth/email-already-in-use') {
        setStep('password')
        setError('An account exists with this email. Please enter the correct password.')
      } else {
        setError(friendlyError(code))
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Forgot password ───────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    setLoading(true); clearError()
    try { await resetPassword(email); setStep('reset-sent') }
    catch (err) { setError(friendlyError(err.code)) }
    finally { setLoading(false) }
  }

  if (step === 'loading') return null

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__logo"><RoadmapLogo /></div>

        {/* ── Account card ────────────────────────────────── */}
        {step === 'account' && (
          <>
            <h1 className="login-card__title login-card__title--tight">Welcome back</h1>
            <button type="button" className="login-account-card"
              onClick={handleAccountCardClick} disabled={loading}>
              <LastUserAvatar user={lastUser} />
              <div className="login-account-card__info">
                <div className="login-account-card__name">{lastUser.name || lastUser.email}</div>
                <div className="login-account-card__email">{lastUser.email}</div>
              </div>
              {loading
                ? <div className="login-account-card__spinner" />
                : <svg className="login-account-card__arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>}
            </button>
            {error && <div className="login-error">{error}</div>}
            <button type="button" className="login-forgot"
              onClick={() => { setEmail(''); setPassword(''); clearError(); setStep('email') }}>
              Use another account
            </button>
          </>
        )}

        {/* ── Email step ──────────────────────────────────── */}
        {step === 'email' && (
          <>
            <h1 className="login-card__title">Join or Sign in to Planner</h1>

            <button className="login-google-btn" onClick={handleGoogle} disabled={loading}>
              <GoogleIcon />
              Continue with Google
            </button>
            <div className="login-divider"><span>or</span></div>

            <form onSubmit={handleEmailContinue}>
              <Stack spacing={2} sx={{ mb: 2 }}>
                <TextField
                  label="Email"
                  type="email"
                  name="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError() }}
                  autoFocus
                  fullWidth
                />
              </Stack>
              {/*
                Hidden password — Chrome autofills username+password together.
                We read this value on Continue and pre-populate the password step
                so the user doesn't have to select credentials again.
              */}
              <input
                ref={hiddenPasswordRef}
                type="password"
                name="password"
                autoComplete="current-password"
                style={{ display: 'none' }}
                tabIndex={-1}
                aria-hidden="true"
              />
              {error && <div className="login-error">{error}</div>}
              <button className="login-submit-btn" type="submit" disabled={loading || !email.trim()}>
                {loading ? 'Checking…' : 'Continue'}
              </button>
            </form>
          </>
        )}

        {/* ── Password step ───────────────────────────────── */}
        {step === 'password' && (
          <>
            <h1 className="login-card__title login-card__title--tight">Welcome back</h1>
            <form onSubmit={handleSignIn}>
              <Stack spacing={2} sx={{ mb: 2 }}>
                <div className="login-email-badge">
                  <span>{email}</span>
                  <button type="button"
                    onClick={() => {
                      setStep(lastUser ? 'account' : 'email')
                      setPassword(''); clearError()
                    }}>Change</button>
                </div>
                <TextField
                  label="Password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError() }}
                  autoFocus
                  fullWidth
                />
              </Stack>
              {error && <div className="login-error">{error}</div>}
              <button className="login-submit-btn" type="submit" disabled={loading || !password}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              <button type="button" className="login-forgot" onClick={handleForgotPassword} disabled={loading}>
                Forgot password?
              </button>
              <button type="button" className="login-forgot"
                onClick={() => { setStep('register'); setPassword(''); clearError() }}>
                No account yet? Create one
              </button>
            </form>
          </>
        )}

        {/* ── Register ────────────────────────────────────── */}
        {step === 'register' && (
          <>
            <h1 className="login-card__title">Create your account</h1>
            <form onSubmit={handleRegister}>
              <Stack spacing={2} sx={{ mb: 2 }}>
                {email.trim() ? (
                  <div className="login-email-badge">
                    <span>{email}</span>
                    <button type="button"
                      onClick={() => { setStep('email'); setPassword(''); clearError() }}>Change</button>
                  </div>
                ) : (
                  <TextField label="Email" type="email" name="email" autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError() }}
                    autoFocus fullWidth />
                )}
                <TextField label="Full name" type="text" name="name" autoComplete="name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearError() }}
                  autoFocus={!!email.trim()} fullWidth />
                <TextField label="Password" type="password" name="new-password" autoComplete="new-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError() }}
                  helperText="6+ characters" fullWidth />
              </Stack>
              {error && <div className="login-error">{error}</div>}
              <button className="login-submit-btn" type="submit"
                disabled={loading || !email.trim() || !name.trim() || password.length < 6}>
                {loading ? 'Creating account…' : 'Join Planner'}
              </button>
              <button type="button" className="login-forgot"
                onClick={() => { setStep(email.trim() ? 'password' : 'email'); clearError() }}>
                Already have an account? Sign in
              </button>
            </form>
          </>
        )}

        {/* ── Reset sent ──────────────────────────────────── */}
        {step === 'reset-sent' && (
          <>
            <h1 className="login-card__title">Check your email</h1>
            <div className="login-reset-sent">
              <div className="login-reset-sent__icon">📬</div>
              <p>Password reset email sent to <strong>{email}</strong>.</p>
              <p>Check your inbox, click the link, then come back to sign in.</p>
              <button className="login-submit-btn" style={{ marginTop: 16 }}
                onClick={() => { setStep('password'); setPassword(''); clearError() }}>
                Back to sign in
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function storeCredential(email, password) {
  if (!window.PasswordCredential || !navigator.credentials?.store) return
  try { navigator.credentials.store(new PasswordCredential({ id: email, password })) } catch {}
}

function LastUserAvatar({ user }) {
  const color  = getAvatarColor(user.name || user.email)
  const letter = (user.name || user.email || '?').charAt(0).toUpperCase()
  if (user.photo) return <img className="login-account-card__avatar" src={user.photo} alt="" />
  return (
    <div className="login-account-card__avatar login-account-card__avatar--initial"
      style={{ background: color }}>{letter}</div>
  )
}

function RoadmapLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <img src="/logo-light.svg" alt="Planner" height={36} />
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.174 0 7.548 0 9s.348 2.826.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

function friendlyError(code) {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':  return 'That password didn\'t work. If you don\'t have an account yet, create one below — or try "Forgot password".'
    case 'auth/email-already-in-use':return 'An account already exists with this email.'
    case 'auth/weak-password':       return 'Password must be at least 6 characters.'
    case 'auth/invalid-email':       return 'Please enter a valid email address.'
    case 'auth/too-many-requests':   return 'Too many attempts. Please try again later.'
    case 'auth/network-request-failed': return 'Network error. Check your connection.'
    case 'auth/operation-not-allowed':  return 'Sign-in method not enabled in Firebase Console.'
    case 'auth/unauthorized-domain':    return 'This domain is not authorized in Firebase Console.'
    default: return `Sign-in error (${code || 'unknown'}). Please try again.`
  }
}
