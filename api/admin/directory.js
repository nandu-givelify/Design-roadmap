// /api/admin/directory
//   GET  — the orgMembers directory and every userProfile
//   POST — edit or delete a directory entry, merge duplicates, or run the
//          org backfill that scans all boards for company-domain emails
//
// src/firebase.js keeps orgMembers as a cross-board people directory keyed by
// lowercased email. Duplicates creep in when the same person is added with a
// different capitalisation or a second address, so merging is the main job here.
import {
  requireAdmin, adminDb, audit, methodNotAllowed, readBody,
} from '../_lib/admin.js'

// Kept in sync with GENERIC_EMAIL_DOMAINS in src/firebase.js — a personal
// address isn't part of anyone's org directory.
const GENERIC_DOMAINS = new Set([
  'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com',
  'icloud.com', 'aol.com', 'live.com', 'msn.com',
  'protonmail.com', 'gmx.com',
])
const domainOf = (email) => email?.split('@')[1]?.trim().toLowerCase() || null
const isOrgDomain = (d) => !!d && !GENERIC_DOMAINS.has(d)

export default async function handler(req, res) {
  const actor = await requireAdmin(req, res)
  if (!actor) return
  if (req.method === 'GET')  return listDirectory(req, res)
  if (req.method === 'POST') return actOnDirectory(req, res, actor)
  return methodNotAllowed(res, ['GET', 'POST'])
}

async function listDirectory(req, res) {
  try {
    const db = adminDb()
    const [orgSnap, profSnap] = await Promise.all([
      db.collection('orgMembers').get(),
      db.collection('userProfiles').get(),
    ])

    const members = orgSnap.docs.map(d => {
      const m = d.data()
      return {
        id: d.id, name: m.name || null, email: m.email || d.id,
        photo: m.photo || null, domain: m.domain || domainOf(d.id),
        updatedAt: m.updatedAt?.toDate?.()?.toISOString() || null,
      }
    }).sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''))

    // Same person, two entries: group by normalised name so near-duplicates
    // surface for merging instead of hiding in a long alphabetical list.
    const byName = {}
    for (const m of members) {
      const key = (m.name || '').trim().toLowerCase()
      if (!key) continue
      ;(byName[key] ||= []).push(m)
    }
    const duplicates = Object.values(byName).filter(g => g.length > 1)

    res.status(200).json({
      members,
      duplicates,
      profiles: profSnap.docs.map(d => {
        const p = d.data()
        return {
          uid: d.id, name: p.name || null, email: p.email || null,
          photo: p.photo || null, role: p.role || null,
          timeOff: (p.timeOff || []).length,
        }
      }),
    })
  } catch (err) {
    res.status(500).json({ error: 'list_failed', message: err.message })
  }
}

async function actOnDirectory(req, res, actor) {
  const body = await readBody(req)
  const { action } = body

  try {
    const db = adminDb()

    switch (action) {
      case 'updateMember': {
        const { id, name, email, photo } = body
        if (!id) return res.status(400).json({ error: 'bad_request', message: 'id is required.' })
        await db.collection('orgMembers').doc(id).set(
          { name: name ?? null, email: email ?? id, photo: photo ?? null },
          { merge: true }
        )
        await audit(actor, 'directory.updateMember', { id, name })
        return res.status(200).json({ ok: true })
      }

      case 'deleteMember': {
        const { id } = body
        await db.collection('orgMembers').doc(id).delete()
        await audit(actor, 'directory.deleteMember', { id })
        return res.status(200).json({ ok: true })
      }

      case 'mergeMembers': {
        // Keep `keepId`, delete the rest. Board-level people docs are left
        // untouched: they're per-board records with their own ids, and the
        // directory only feeds suggestions.
        const { keepId, removeIds = [] } = body
        if (!keepId) return res.status(400).json({ error: 'bad_request', message: 'keepId is required.' })
        await Promise.all(removeIds
          .filter(id => id !== keepId)
          .map(id => db.collection('orgMembers').doc(id).delete()))
        await audit(actor, 'directory.merge', { keepId, removed: removeIds })
        return res.status(200).json({ ok: true, removed: removeIds.length })
      }

      case 'updateProfile': {
        const { uid, name, photo, role } = body
        if (!uid) return res.status(400).json({ error: 'bad_request', message: 'uid is required.' })
        const patch = {}
        if (name  !== undefined) patch.name  = name
        if (photo !== undefined) patch.photo = photo
        if (role  !== undefined) patch.role  = role
        await db.collection('userProfiles').doc(uid).set(patch, { merge: true })
        await audit(actor, 'directory.updateProfile', { uid, ...patch })
        return res.status(200).json({ ok: true })
      }

      case 'backfill': {
        // Server-side equivalent of backfillOrgDirectory in src/firebase.js:
        // walk every board's people and register company-domain emails.
        const boardsSnap = await db.collection('boards').get()
        let scanned = 0
        const added = new Set()
        for (const boardDoc of boardsSnap.docs) {
          const peopleSnap = await db.collection('boards').doc(boardDoc.id).collection('people').get()
          for (const personDoc of peopleSnap.docs) {
            const p = personDoc.data()
            scanned++
            const email = p.email?.trim().toLowerCase()
            const domain = domainOf(email)
            if (!isOrgDomain(domain)) continue
            await db.collection('orgMembers').doc(email).set({
              name: p.name || null, email, photo: p.photo || null, domain,
              updatedAt: new Date(),
            }, { merge: true })
            added.add(email)
          }
        }
        await audit(actor, 'directory.backfill', { boards: boardsSnap.size, scanned, added: added.size })
        return res.status(200).json({ ok: true, boards: boardsSnap.size, scanned, added: [...added] })
      }

      default:
        return res.status(400).json({ error: 'unknown_action', message: `Unknown action: ${action}` })
    }
  } catch (err) {
    res.status(500).json({ error: 'action_failed', message: err.message })
  }
}
