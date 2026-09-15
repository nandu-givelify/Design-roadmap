// /api/admin/users
//   GET  — list / search Firebase Auth users, enriched with app data
//   POST — act on one user: disable, enable, delete, set password, reset link,
//          rename, revoke sessions
//
// None of this is possible from the browser: the Firebase client SDK can only
// ever see and act on the currently signed-in user. Listing every account or
// changing someone else's password requires the Admin SDK, which requires a
// server — hence this function.
import {
  requireAdmin, adminAuth, adminDb, audit,
  isAdminEmail, adminEmails, methodNotAllowed, readBody,
} from '../_lib/admin.js'

const shape = (u) => ({
  uid: u.uid,
  email: u.email || null,
  displayName: u.displayName || null,
  photoURL: u.photoURL || null,
  disabled: u.disabled,
  emailVerified: u.emailVerified,
  createdAt: u.metadata.creationTime || null,
  lastSignInAt: u.metadata.lastSignInTime || null,
  providers: u.providerData.map(p => p.providerId),
  isAdmin: isAdminEmail(u.email),
})

async function listAll() {
  let users = []
  let pageToken
  for (let i = 0; i < 10; i++) {
    const page = await adminAuth().listUsers(1000, pageToken)
    users = users.concat(page.users)
    pageToken = page.pageToken
    if (!pageToken) break
  }
  return users
}

export default async function handler(req, res) {
  const actor = await requireAdmin(req, res)
  if (!actor) return

  if (req.method === 'GET')  return listUsers(req, res)
  if (req.method === 'POST') return actOnUser(req, res, actor)
  return methodNotAllowed(res, ['GET', 'POST'])
}

// ── List ─────────────────────────────────────────────────────────────────────
async function listUsers(req, res) {
  try {
    const q = (req.query.q || '').trim().toLowerCase()
    const all = await listAll()

    const filtered = q
      ? all.filter(u =>
          (u.email || '').toLowerCase().includes(q) ||
          (u.displayName || '').toLowerCase().includes(q) ||
          u.uid.toLowerCase() === q)
      : all

    const sorted = filtered.sort((a, b) =>
      new Date(b.metadata.creationTime) - new Date(a.metadata.creationTime))

    // Attach how many boards each person owns or belongs to, so you can see the
    // blast radius of deleting them before you do it.
    const boardsSnap = await adminDb().collection('boards').get()
    const boards = boardsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    const enriched = sorted.map(u => {
      const base = shape(u)
      const email = (u.email || '').toLowerCase()
      return {
        ...base,
        ownedBoards: boards.filter(b => b.ownerId === u.uid).length,
        memberBoards: boards.filter(b =>
          (b.memberEmails || []).some(e => (e || '').toLowerCase() === email)).length,
      }
    })

    res.status(200).json({ users: enriched, total: all.length, admins: adminEmails() })
  } catch (err) {
    res.status(500).json({ error: 'list_failed', message: err.message })
  }
}

// ── Act ──────────────────────────────────────────────────────────────────────
async function actOnUser(req, res, actor) {
  const body = await readBody(req)
  const { action, uid } = body

  if (!action || !uid) {
    return res.status(400).json({ error: 'bad_request', message: 'action and uid are required.' })
  }

  try {
    const target = await adminAuth().getUser(uid)
    const isSelf = target.uid === actor.uid

    // Lockout guards. An admin disabling or deleting their own account — or the
    // last remaining admin account — would leave nobody able to reach this
    // panel, and nothing in the UI could undo it afterwards.
    const destructive = ['disable', 'delete'].includes(action)
    if (destructive && isSelf) {
      return res.status(400).json({
        error: 'self_lockout',
        message: `You can't ${action} your own admin account from here.`,
      })
    }
    if (destructive && isAdminEmail(target.email)) {
      return res.status(400).json({
        error: 'admin_target',
        message: `${target.email} is on the admin allowlist. Remove them from ADMIN_EMAILS in Vercel first.`,
      })
    }

    switch (action) {
      case 'disable':
      case 'enable': {
        const disabled = action === 'disable'
        await adminAuth().updateUser(uid, { disabled })
        // Disabling only blocks new sign-ins; an existing session keeps working
        // until its token expires. Revoking cuts them off now.
        if (disabled) await adminAuth().revokeRefreshTokens(uid)
        await audit(actor, action, { uid, email: target.email })
        return res.status(200).json({ ok: true, user: shape(await adminAuth().getUser(uid)) })
      }

      case 'delete': {
        await adminAuth().deleteUser(uid)
        // Clean up the app-side records keyed by uid. Boards they owned are
        // left alone on purpose — deleting a person shouldn't silently destroy
        // a team's roadmap. The response reports them so you can reassign.
        const db = adminDb()
        await Promise.allSettled([
          db.collection('userProfiles').doc(uid).delete(),
          db.collection('userPrefs').doc(uid).delete(),
        ])
        const owned = await db.collection('boards').where('ownerId', '==', uid).get()
        await audit(actor, 'delete', { uid, email: target.email, orphanedBoards: owned.size })
        return res.status(200).json({
          ok: true,
          deleted: uid,
          orphanedBoards: owned.docs.map(d => ({ id: d.id, name: d.data().name || 'Untitled' })),
        })
      }

      case 'setPassword': {
        const { password } = body
        if (!password || password.length < 8) {
          return res.status(400).json({ error: 'weak_password', message: 'Password must be at least 8 characters.' })
        }
        await adminAuth().updateUser(uid, { password })
        await adminAuth().revokeRefreshTokens(uid) // force other sessions to re-auth
        // The password itself is never audited — only the fact of the change.
        await audit(actor, 'setPassword', { uid, email: target.email })
        return res.status(200).json({ ok: true })
      }

      case 'resetLink': {
        if (!target.email) {
          return res.status(400).json({ error: 'no_email', message: 'This account has no email address.' })
        }
        // Returns a one-time link rather than sending mail, so you can hand it
        // over on whatever channel you already trust.
        const link = await adminAuth().generatePasswordResetLink(target.email)
        await audit(actor, 'resetLink', { uid, email: target.email })
        return res.status(200).json({ ok: true, link })
      }

      case 'rename': {
        const { displayName } = body
        await adminAuth().updateUser(uid, { displayName: displayName || null })
        await adminDb().collection('userProfiles').doc(uid)
          .set({ name: displayName || null }, { merge: true })
        await audit(actor, 'rename', { uid, email: target.email, displayName })
        return res.status(200).json({ ok: true, user: shape(await adminAuth().getUser(uid)) })
      }

      case 'revokeSessions': {
        await adminAuth().revokeRefreshTokens(uid)
        await audit(actor, 'revokeSessions', { uid, email: target.email })
        return res.status(200).json({ ok: true })
      }

      case 'verifyEmail': {
        await adminAuth().updateUser(uid, { emailVerified: true })
        await audit(actor, 'verifyEmail', { uid, email: target.email })
        return res.status(200).json({ ok: true, user: shape(await adminAuth().getUser(uid)) })
      }

      default:
        return res.status(400).json({ error: 'unknown_action', message: `Unknown action: ${action}` })
    }
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'not_found', message: 'No such user.' })
    }
    res.status(500).json({ error: 'action_failed', message: err.message })
  }
}
