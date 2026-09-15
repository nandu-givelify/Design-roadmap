// GET /api/admin/session — "am I an admin, and is the server set up?"
// The panel calls this on load to decide between showing itself, showing an
// access-denied screen, or showing setup instructions. It deliberately reveals
// nothing beyond a yes/no plus the caller's own email.
import { requireAdmin, isConfigured, configError, methodNotAllowed } from '../_lib/admin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  if (!isConfigured()) {
    return res.status(503).json({
      configured: false,
      isAdmin: false,
      message: configError() === 'missing'
        ? 'FIREBASE_SERVICE_ACCOUNT is not set on the server.'
        : `Service account could not be loaded: ${configError()}`,
    })
  }

  const actor = await requireAdmin(req, res)
  if (!actor) return // requireAdmin already responded

  res.status(200).json({
    configured: true,
    isAdmin: true,
    email: actor.email,
    uid: actor.uid,
  })
}
