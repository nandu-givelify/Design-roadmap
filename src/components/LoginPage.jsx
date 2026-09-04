import { useState, useEffect, useRef } from 'react'
import { signInWithGoogle, signInEmail, signUpEmail, updateUserProfile, resetPassword } from '../firebase'
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

  // ── Email step → password step ────────────────────────────────────────────
  const handleEmailContinue = (e) => {
    e.preventDefault()
    if (!email.trim()) return
    // Capture any Chrome-autofilled password from the hidden field
    const autofilled = hiddenPasswordRef.current?.value || ''
    if (autofilled) setPassword(autofilled)
    setStep('password')
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
      if (err?.code) { setError(friendlyError(err.code)); setStep('password') }
      else setStep('password')
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
    if (!name.trim() || password.length < 6) { setError('Password must be at least 6 characters.'); return }
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
            <h1 className="login-card__title">Welcome back</h1>
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
            <h1 className="login-card__title">Welcome to RoadMap</h1>
            <p className="login-card__sub">Sign in or create a new account</p>

            <button className="login-google-btn" onClick={handleGoogle} disabled={loading}>
              <GoogleIcon />
              Continue with Google
            </button>
            <div className="login-divider"><span>or</span></div>

            <form onSubmit={handleEmailContinue}>
              <input
                className="login-input"
                type="email"
                name="email"
                autoComplete="username"
                placeholder="Your email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError() }}
                autoFocus
              />
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
                Continue
              </button>
              <button type="button" className="login-forgot"
                onClick={() => { clearError(); setStep('register') }}>
                New to RoadMap? Create an account
              </button>
            </form>
          </>
        )}

        {/* ── Password step ───────────────────────────────── */}
        {step === 'password' && (
          <>
            <h1 className="login-card__title">Welcome back</h1>
            <form onSubmit={handleSignIn}>
              <div className="login-email-badge">
                <span>{email}</span>
                <button type="button"
                  onClick={() => {
                    setStep(lastUser ? 'account' : 'email')
                    setPassword(''); clearError()
                  }}>Change</button>
              </div>
              <input
                className="login-input"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearError() }}
                autoFocus
              />
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
              {email.trim() ? (
                <div className="login-email-badge">
                  <span>{email}</span>
                  <button type="button"
                    onClick={() => { setStep('email'); setPassword(''); clearError() }}>Change</button>
                </div>
              ) : (
                <input className="login-input" type="email" name="email" autoComplete="email"
                  placeholder="Your email" value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError() }} autoFocus />
              )}
              <input className="login-input" type="text" name="name" autoComplete="name"
                placeholder="Your full name" value={name}
                onChange={(e) => { setName(e.target.value); clearError() }}
                autoFocus={!!email.trim()} />
              <input className="login-input" type="password" name="new-password" autoComplete="new-password"
                placeholder="Create a password (6+ chars)" value={password}
                onChange={(e) => { setPassword(e.target.value); clearError() }} />
              {error && <div className="login-error">{error}</div>}
              <button className="login-submit-btn" type="submit"
                disabled={loading || !email.trim() || !name.trim() || password.length < 6}>
                {loading ? 'Creating account…' : 'Join RoadMap'}
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width="48" height="48" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="lp_shadow" x="8" y="14" width="184" height="174" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dy="1"/>
            <feGaussianBlur stdDeviation="1"/>
            <feComposite in2="hardAlpha" operator="out"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
          </filter>
          <linearGradient id="lp_grad" x1="139.761" y1="17.0932" x2="59.2775" y2="183.632" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFCC00"/>
            <stop offset="0.5" stopColor="#FF6F00"/>
            <stop offset="1" stopColor="#FF0000"/>
          </linearGradient>
        </defs>
        <g filter="url(#lp_shadow)">
          <path d="M189.741 104.936C187.297 140.166 158.676 163.138 129.798 180.244C88.6943 204.592 132.915 125.93 26.7776 157.701C-28.2389 174.169 64.8715 21.9895 121.642 15.4134C169.767 9.83879 192.737 61.7385 189.741 104.936Z" fill="url(#lp_grad)"/>
          <path d="M122.103 19.3867C144.349 16.81 160.763 27.3786 171.499 44.0508C182.338 60.8834 187.199 83.7669 185.75 104.659C183.459 137.684 156.599 159.719 127.759 176.803C122.79 179.746 119.616 180.81 117.595 180.977C115.914 181.115 115.026 180.652 114.181 179.766C113.075 178.606 112.085 176.724 110.774 173.799C109.555 171.075 108.108 167.578 106.134 164.18C102.019 157.096 95.4648 150.154 82.7354 147.338C70.3345 144.595 52.4202 145.85 25.6309 153.869C19.1187 155.818 16.5292 154.723 15.5527 153.751C14.395 152.598 13.4573 149.743 14.3594 143.957C16.1058 132.756 23.9791 115.651 35.6611 97.3506C47.2622 79.1773 62.3001 60.32 77.875 45.6475C93.6152 30.8192 109.27 20.8732 122.103 19.3867Z" stroke="white" strokeWidth="8"/>
        </g>
        <path d="M133.366 98.7796C133.366 98.7796 149.495 105.12 159.713 104.221C169.932 103.322 183.658 95.0716 183.658 95.0716" stroke="white" strokeWidth="8" strokeLinecap="round"/>
      </svg>
      <span style={{ fontSize: 22, fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>RoadMap</span>
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
    case 'auth/invalid-credential':  return 'Incorrect password. Try again or use "Forgot password".'
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
