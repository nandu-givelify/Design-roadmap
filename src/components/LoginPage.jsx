import { useState } from 'react'
import { signInWithGoogle, signInEmail, signUpEmail, updateUserProfile, checkEmailExists, resetPassword } from '../firebase'

// Steps: 'email' → 'password' (existing) | 'register' (new) | 'reset-sent'
export default function LoginPage() {
  const [step,      setStep]      = useState('email')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [name,      setName]      = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)

  const clearError = () => setError('')

  // ── Step 1: check if email exists ────────────────────────────────────────
  const handleEmailContinue = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true); setError('')
    try {
      const exists = await checkEmailExists(email.trim())
      setIsNewUser(!exists)
      setStep(exists ? 'password' : 'register')
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2a: sign in existing user ───────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault()
    if (!password) return
    setLoading(true); setError('')
    try {
      await signInEmail(email, password)
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2b: register new user ───────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault()
    if (!name.trim() || !password) return
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true); setError('')
    try {
      await signUpEmail(email, password)
      await updateUserProfile({ displayName: name.trim() })
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  // ── Forgot password ──────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    setLoading(true); setError('')
    try {
      await resetPassword(email)
      setStep('reset-sent')
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  // ── Google ───────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setLoading(true); setError('')
    try { await signInWithGoogle() }
    catch (err) { setError(friendlyError(err.code)) }
    finally { setLoading(false) }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-card__logo">
          <RoadmapLogo />
        </div>

        <h1 className="login-card__title">Welcome to RoadMap</h1>
        <p className="login-card__sub">Sign in or join to start your roadmap</p>

        {/* Google */}
        <button className="login-google-btn" onClick={handleGoogle} disabled={loading}>
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="login-divider"><span>or</span></div>

        {/* ── Step: email ─────────────────────────────────────── */}
        {step === 'email' && (
          <form onSubmit={handleEmailContinue}>
            <input
              className="login-input"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError() }}
              autoFocus
            />
            {error && <div className="login-error">{error}</div>}
            <button className="login-submit-btn" type="submit" disabled={loading || !email.trim()}>
              {loading ? 'Checking…' : 'Continue'}
            </button>
          </form>
        )}

        {/* ── Step: password (existing user) ─────────────────── */}
        {step === 'password' && (
          <form onSubmit={handleSignIn}>
            <div className="login-email-badge">
              <span>{email}</span>
              <button type="button" onClick={() => { setStep('email'); setPassword(''); clearError() }}>
                Change
              </button>
            </div>
            <input
              className="login-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError() }}
              autoFocus
            />
            {error && <div className="login-error">{error}</div>}
            <button className="login-submit-btn" type="submit" disabled={loading || !password}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <button
              type="button"
              className="login-forgot"
              onClick={handleForgotPassword}
              disabled={loading}
            >
              Forgot password?
            </button>
          </form>
        )}

        {/* ── Step: register (new user) ───────────────────────── */}
        {step === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="login-email-badge">
              <span>{email}</span>
              <button type="button" onClick={() => { setStep('email'); setPassword(''); clearError() }}>
                Change
              </button>
            </div>
            <p className="login-new-user-hint">New here! Just set your name and password.</p>
            <input
              className="login-input"
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => { setName(e.target.value); clearError() }}
              autoFocus
            />
            <input
              className="login-input"
              type="password"
              placeholder="Create a password (6+ chars)"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError() }}
            />
            {error && <div className="login-error">{error}</div>}
            <button className="login-submit-btn" type="submit" disabled={loading || !name.trim() || !password}>
              {loading ? 'Creating account…' : 'Join RoadMap'}
            </button>
          </form>
        )}

        {/* ── Step: reset email sent ──────────────────────────── */}
        {step === 'reset-sent' && (
          <div className="login-reset-sent">
            <div className="login-reset-sent__icon">📬</div>
            <p>Password reset email sent to <strong>{email}</strong>.</p>
            <p>Check your inbox and follow the link, then come back to sign in.</p>
            <button
              className="login-submit-btn"
              style={{ marginTop: 16 }}
              onClick={() => { setStep('password'); clearError() }}
            >
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function RoadmapLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#6366f1"/>
        <rect x="6" y="10" width="20" height="3" rx="1.5" fill="white"/>
        <rect x="6" y="15" width="14" height="3" rx="1.5" fill="white" opacity="0.7"/>
        <rect x="6" y="20" width="17" height="3" rx="1.5" fill="white" opacity="0.5"/>
      </svg>
      <span style={{ fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>RoadMap</span>
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
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Incorrect password. Try again or use "Forgot password".'
    case 'auth/email-already-in-use': return 'An account with this email already exists.'
    case 'auth/weak-password': return 'Password must be at least 6 characters.'
    case 'auth/invalid-email': return 'Please enter a valid email address.'
    case 'auth/too-many-requests': return 'Too many attempts. Please try again later.'
    case 'auth/popup-closed-by-user': return ''
    case 'auth/network-request-failed': return 'Network error. Check your connection.'
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.'
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized. Add it in Firebase Console → Authentication → Settings → Authorized domains.'
    case 'auth/configuration-not-found':
      return 'Firebase Auth is not set up. Go to Firebase Console → Authentication and click "Get started".'
    default: return `Error: ${code || 'unknown'}. Check Firebase Console → Authentication is enabled.`
  }
}
