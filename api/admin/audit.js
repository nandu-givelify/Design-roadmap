// GET /api/admin/audit — the admin action log, newest first.
//
// Written by audit() in api/_lib/admin.js on every state-changing admin call.
// The collection is `_adminAudit`; the hardened Firestore rules deny all client
// access to it, so it can only be read through this endpoint.
import { requireAdmin, adminDb, methodNotAllowed } from '../_lib/admin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])
  const actor = await requireAdmin(req, res)
  if (!actor) return

  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500)
    const snap = await adminDb()
      .collection('_adminAudit')
      .orderBy('at', 'desc')
      .limit(limit)
      .get()

    res.status(200).json({
      entries: snap.docs.map(d => {
        const e = d.data()
        return {
          id: d.id,
          actorEmail: e.actorEmail || null,
          action: e.action,
          details: e.details || {},
          at: e.at?.toDate?.()?.toISOString() || null,
        }
      }),
    })
  } catch (err) {
    // An empty collection has no index requirement, but orderBy on a field that
    // has never been written returns nothing rather than erroring — so a real
    // error here is worth surfacing rather than swallowing into an empty list.
    res.status(500).json({ error: 'audit_failed', message: err.message })
  }
}
