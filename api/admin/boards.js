// /api/admin/boards
//   GET            — every board in the project, with counts and members
//   GET ?id=<id>   — one board in detail, including its people and tasks
//   POST           — rename, transfer ownership, add/remove members, change
//                    public access, or delete a board and everything under it
//
// The client SDK can only see boards you own or belong to (see subscribeBoards
// in src/firebase.js). Admin needs the whole picture, which means the server.
import {
  requireAdmin, adminAuth, adminDb, audit, FieldValue,
  methodNotAllowed, readBody,
} from '../_lib/admin.js'

async function countOf(ref) {
  try { return (await ref.count().get()).data().count }
  catch { return (await ref.get()).size }
}

export default async function handler(req, res) {
  const actor = await requireAdmin(req, res)
  if (!actor) return

  if (req.method === 'GET')  return req.query.id ? boardDetail(req, res) : listBoards(req, res)
  if (req.method === 'POST') return actOnBoard(req, res, actor)
  return methodNotAllowed(res, ['GET', 'POST'])
}

// ── List ─────────────────────────────────────────────────────────────────────
async function listBoards(req, res) {
  try {
    const db = adminDb()
    const snap = await db.collection('boards').get()

    const boards = await Promise.all(snap.docs.map(async (d) => {
      const data = d.data()
      const ref = db.collection('boards').doc(d.id)
      return {
        id: d.id,
        name: data.name || 'Untitled',
        ownerId: data.ownerId || null,
        ownerEmail: data.ownerEmail || null,
        memberEmails: data.memberEmails || [],
        publicAccess: data.publicAccess || (data.isPublic ? 'view' : null),
        phases: (data.boardPhases || []).length,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        tasks:  await countOf(ref.collection('tasks')),
        people: await countOf(ref.collection('people')),
      }
    }))

    boards.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    res.status(200).json({ boards })
  } catch (err) {
    res.status(500).json({ error: 'list_failed', message: err.message })
  }
}

// ── Detail ───────────────────────────────────────────────────────────────────
async function boardDetail(req, res) {
  try {
    const db = adminDb()
    const ref = db.collection('boards').doc(req.query.id)
    const doc = await ref.get()
    if (!doc.exists) return res.status(404).json({ error: 'not_found' })

    const [peopleSnap, tasksSnap] = await Promise.all([
      ref.collection('people').get(),
      ref.collection('tasks').get(),
    ])

    const data = doc.data()
    res.status(200).json({
      board: {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      },
      people: peopleSnap.docs.map(d => {
        const p = d.data()
        return {
          id: d.id, name: p.name || null, email: p.email || null,
          role: p.role || null, photo: p.photo || null,
          timeOff: (p.timeOff || []).length,
        }
      }),
      tasks: tasksSnap.docs.map(d => {
        const t = d.data()
        return {
          id: d.id, name: t.name || t.title || 'Untitled',
          start: t.start || null, end: t.end || null,
          assigneeId: t.assigneeId || null, pmId: t.pmId || null,
        }
      }),
    })
  } catch (err) {
    res.status(500).json({ error: 'detail_failed', message: err.message })
  }
}

// ── Act ──────────────────────────────────────────────────────────────────────
async function actOnBoard(req, res, actor) {
  const body = await readBody(req)
  const { action, boardId } = body
  if (!action || !boardId) {
    return res.status(400).json({ error: 'bad_request', message: 'action and boardId are required.' })
  }

  try {
    const db = adminDb()
    const ref = db.collection('boards').doc(boardId)
    const doc = await ref.get()
    if (!doc.exists) return res.status(404).json({ error: 'not_found' })
    const board = doc.data()

    switch (action) {
      case 'rename': {
        const name = (body.name || '').trim()
        if (!name) return res.status(400).json({ error: 'bad_request', message: 'name is required.' })
        await ref.update({ name })
        await audit(actor, 'board.rename', { boardId, from: board.name, to: name })
        return res.status(200).json({ ok: true })
      }

      case 'transferOwner': {
        const email = (body.email || '').trim().toLowerCase()
        if (!email) return res.status(400).json({ error: 'bad_request', message: 'email is required.' })
        // Ownership is checked by uid in subscribeBoards, so a transfer that
        // only set ownerEmail would leave the new owner unable to see the board.
        // Look the account up and set both, and make sure they're a member too.
        let user
        try { user = await adminAuth().getUserByEmail(email) }
        catch { return res.status(404).json({ error: 'no_account', message: `No Firebase account for ${email}.` }) }

        await ref.update({
          ownerId: user.uid,
          ownerEmail: email,
          memberEmails: FieldValue.arrayUnion(email),
        })
        await audit(actor, 'board.transferOwner', { boardId, from: board.ownerEmail, to: email })
        return res.status(200).json({ ok: true })
      }

      case 'addMember': {
        const email = (body.email || '').trim().toLowerCase()
        if (!email) return res.status(400).json({ error: 'bad_request', message: 'email is required.' })
        await ref.update({
          memberEmails: FieldValue.arrayUnion(email),
          [`members.${email.replace(/\./g, '_')}`]: { access: body.access || 'edit', addedAt: FieldValue.serverTimestamp() },
        })
        await audit(actor, 'board.addMember', { boardId, email })
        return res.status(200).json({ ok: true })
      }

      case 'removeMember': {
        const email = (body.email || '').trim().toLowerCase()
        await ref.update({
          memberEmails: FieldValue.arrayRemove(email),
          [`members.${email.replace(/\./g, '_')}`]: FieldValue.delete(),
        })
        await audit(actor, 'board.removeMember', { boardId, email })
        return res.status(200).json({ ok: true })
      }

      case 'setPublicAccess': {
        // null = private, 'view' = read-only link, 'edit' = anyone with the link
        // can change tasks. Mirrors the Share dialog in the app.
        const access = body.access === 'view' || body.access === 'edit' ? body.access : null
        await ref.update({ publicAccess: access, isPublic: access === 'view' || access === 'edit' })
        await audit(actor, 'board.setPublicAccess', { boardId, access })
        return res.status(200).json({ ok: true })
      }

      case 'delete': {
        // recursiveDelete removes the people and tasks subcollections too;
        // deleting only the board doc would orphan them, and Firestore keeps
        // subcollections alive under a deleted parent.
        const people = await countOf(ref.collection('people'))
        const tasks  = await countOf(ref.collection('tasks'))
        await db.recursiveDelete(ref)
        await audit(actor, 'board.delete', { boardId, name: board.name, people, tasks })
        return res.status(200).json({ ok: true, deleted: { people, tasks } })
      }

      default:
        return res.status(400).json({ error: 'unknown_action', message: `Unknown action: ${action}` })
    }
  } catch (err) {
    res.status(500).json({ error: 'action_failed', message: err.message })
  }
}
