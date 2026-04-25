import { useState } from 'react'
import { signInWithGoogle, signInEmail, signUpEmail, updateUserProfile } from '../firebase'

export default function LoginPage() {
  const [mode,     setMode]     = useState('login') // 'login' | 'signup'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const clearError = () => setError('')

  const handleGoogle = async () => {
    setLoading(true); setError('')
    try { await signInWithGoogle() }
    catch (e) { setError(friendlyError(e.code)) }
    finally { setLoading(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true); setError('')
    try {
      if (mode === 'signup') {
        if (!name.trim()) { setError('Please enter your name.'); setLoading(false); return }
        const cred = await signUpEmail(email, password)
        await updateUserProfile({ displayName: name.trim() })
        // auth state change in AuthContext handles the rest
      } else {
        await signInEmail(email, password)
      }
    } catch (e) {
      setError(friendlyError(e.code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#6366f1"/>
            <rect x="6" y="10" width="20" height="3" rx="1.5" fill="white"/>
            <rect x="6" y="15" width="14" height="3" rx="1.5" fill="white" opacity="0.7"/>
            <rect x="6" y="20" width="17" height="3" rx="1.5" fill="white" opacity="0.5"/>
          </svg>
        </div>
        <h1 className="login-card__title">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="login-card__sub">
          {mode === 'login' ? 'Sign in to your roadmap' : 'Get started for free'}
        </p>

        <button className="login-google-btn" onClick={handleGoogle} disabled={loading}>
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="login-divider"><span>or</span></div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <input
              className="login-input"
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => { setName(e.target.value); clearError() }}
              autoFocus
            />
          )}
          <input
            className="login-input"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearError() }}
            autoFocus={mode === 'login'}
          />
          <input
            className="login-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); clearError() }}
          />
          {error && <div className="login-error">{error}</div>}
          <button className="login-submit-btn" type="submit" disabled={loading || !email || !password}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="login-toggle">
          {mode === 'login' ? (
            <>Don't have an account? <button onClick={() => { setMode('signup'); clearError() }}>Sign up</button></>
          ) : (
            <>Already have an account? <button onClick={() => { setMode('login'); clearError() }}>Sign in</button></>
          )}
        </p>
      </div>
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
    case 'auth/invalid-credential': return 'Incorrect email or password.'
    case 'auth/email-already-in-use': return 'An account with this email already exists.'
    case 'auth/weak-password': return 'Password must be at least 6 characters.'
    case 'auth/invalid-email': return 'Please enter a valid email address.'
    case 'auth/too-many-requests': return 'Too many attempts. Please try again later.'
    case 'auth/popup-closed-by-user': return ''
    default: return 'Something went wrong. Please try again.'
  }
}
