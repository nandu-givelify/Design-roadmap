// GET /api/admin/stats — dashboard counters and recent activity.
import { requireAdmin, adminAuth, adminDb, methodNotAllowed } from '../_lib/admin.js'

// Firestore's count() aggregation avoids reading every document just to size a
// collection. It's not available against every emulator/older SDK, so fall back
// to a plain read when it throws.
async function countOf(ref) {
  try {
    const snap = await ref.count().get()
    return snap.data().count
  } catch {
    const snap = await ref.get()
    return snap.size
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])
  const actor = await requireAdmin(req, res)
  if (!actor) return

  try {
    const db = adminDb()

    // Auth users: listUsers pages at 1000. We walk up to 10 pages (10k users),
    // which is far beyond this app's scale but stops a runaway loop.
    let users = []
    let pageToken
    for (let i = 0; i < 10; i++) {
      const page = await adminAuth().listUsers(1000, pageToken)
      users = users.concat(page.users)
      pageToken = page.pageToken
      if (!pageToken) break
    }

    const boardsSnap = await db.collection('boards').get()

    // Task and people counts are per-board subcollections, so they need one
    // aggregation query each. Run them in parallel rather than serially.
    const perBoard = await Promise.all(boardsSnap.docs.map(async (d) => ({
      id: d.id,
      name: d.data().name || 'Untitled',
      ownerEmail: d.data().ownerEmail || null,
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() || null,
      tasks:  await countOf(db.collection('boards').doc(d.id).collection('tasks')),
      people: await countOf(db.collection('boards').doc(d.id).collection('people')),
    })))

    const now = Date.now()
    const dayMs = 86400000
    const signupsByDay = {}
    for (const u of users) {
      const created = new Date(u.metadata.creationTime).getTime()
      if (now - created > 90 * dayMs) continue
      const key = new Date(created).toISOString().slice(0, 10)
      signupsByDay[key] = (signupsByDay[key] || 0) + 1
    }

    const activeLast30 = users.filter(u => {
      const last = u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime).getTime() : 0
      return now - last < 30 * dayMs
    }).length

    const [orgMembers, profiles] = await Promise.all([
      countOf(db.collection('orgMembers')),
      countOf(db.collection('userProfiles')),
    ])

    res.status(200).json({
      users: {
        total: users.length,
        disabled: users.filter(u => u.disabled).length,
        activeLast30,
        newLast7: users.filter(u => now - new Date(u.metadata.creationTime).getTime() < 7 * dayMs).length,
      },
      boards: {
        total: boardsSnap.size,
        tasks:  perBoard.reduce((n, b) => n + b.tasks, 0),
        people: perBoard.reduce((n, b) => n + b.people, 0),
      },
      orgMembers,
      profiles,
      signupsByDay,
      busiestBoards: [...perBoard].sort((a, b) => b.tasks - a.tasks).slice(0, 5),
    })
  } catch (err) {
    res.status(500).json({ error: 'stats_failed', message: err.message })
  }
}
