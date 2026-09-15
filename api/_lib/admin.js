// Shared server-side helpers for the admin API.
//
// Everything in here runs ONLY on Vercel's serverless runtime — never in the
// browser bundle. That's the whole point: the Firebase Admin SDK bypasses
// Firestore security rules and can manage Auth users, so its credentials must
// never reach a client. The admin panel in src/admin/ is a thin UI that calls
// these endpoints and has no privileged access of its own.

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

// ── Service account ──────────────────────────────────────────────────────────
// Set FIREBASE_SERVICE_ACCOUNT in Vercel to the full JSON of a service-account
// key (or its base64 encoding — pasting raw JSON with newlines into some UIs
// mangles the private key, so base64 is the safer paste).
function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) return null
  const text = raw.trim().startsWith('{')
    ? raw
    : Buffer.from(raw, 'base64').toString('utf8')
  const parsed = JSON.parse(text)
  // Env vars often arrive with the key's newlines escaped as literal \n.
  if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
  return parsed
}

let initError = null
function ensureApp() {
  if (getApps().length) return true
  try {
    const sa = loadServiceAccount()
    if (!sa) { initError = 'missing'; return false }
    initializeApp({ credential: cert(sa), projectId: sa.project_id })
    return true
  } catch (err) {
    initError = err.message
    return false
  }
}

export const isConfigured = () => ensureApp()
export const configError = () => initError

export const adminAuth = () => { ensureApp(); return getAuth() }
export const adminDb   = () => { ensureApp(); return getFirestore() }
export { FieldValue }

// ── Admin allowlist ──────────────────────────────────────────────────────────
// ADMIN_EMAILS is a comma-separated list, e.g. "you@co.com,cto@co.com".
// It lives in the server environment, so it cannot be edited from the browser.
export function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

export const isAdminEmail = (email) =>
  !!email && adminEmails().includes(email.trim().toLowerCase())

// ── Request auth ─────────────────────────────────────────────────────────────
// Every admin endpoint calls this first. It verifies the Firebase ID token the
// browser sent, then checks the allowlist. A forged or expired token fails
// verification; a valid token for a non-allowlisted user fails the second gate.
// Returns the decoded token on success, or null after having already written
// the error response.
export async function requireAdmin(req, res) {
  if (!ensureApp()) {
    res.status(503).json({
      error: 'not_configured',
      message: initError === 'missing'
        ? 'FIREBASE_SERVICE_ACCOUNT is not set on the server.'
        : `Service account could not be loaded: ${initError}`,
    })
    return null
  }

  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    res.status(401).json({ error: 'unauthenticated', message: 'No ID token supplied.' })
    return null
  }

  let decoded
  try {
    // checkRevoked: a user whose sessions were revoked (e.g. right after you
    // disabled them) loses admin access immediately rather than at token expiry.
    decoded = await getAuth().verifyIdToken(token, true)
  } catch (err) {
    res.status(401).json({ error: 'invalid_token', message: err.message })
    return null
  }

  if (!isAdminEmail(decoded.email)) {
    res.status(403).json({ error: 'forbidden', message: 'This account is not an admin.' })
    return null
  }

  return decoded
}

// ── Audit log ────────────────────────────────────────────────────────────────
// Best-effort: an audit write failing must never make the action it describes
// appear to have failed, since the action itself already happened.
export async function audit(actor, action, details = {}) {
  try {
    await getFirestore().collection('_adminAudit').add({
      actorEmail: actor?.email || null,
      actorUid: actor?.uid || null,
      action,
      details,
      at: FieldValue.serverTimestamp(),
    })
  } catch (err) {
    console.warn('[audit] write failed:', err.message)
  }
}

// ── Small helpers ────────────────────────────────────────────────────────────
export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '))
  res.status(405).json({ error: 'method_not_allowed' })
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string' && req.body) { try { return JSON.parse(req.body) } catch { return {} } }
  return {}
}
