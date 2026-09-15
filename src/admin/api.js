// Thin client for /api/admin/*.
//
// The panel holds no privileged credentials of its own. Every call carries the
// signed-in user's Firebase ID token, and the server re-verifies that token and
// re-checks the admin allowlist on each request — so nothing here can be
// escalated by editing the bundle, clearing local state, or calling these
// helpers directly from the console.
import { auth } from '../firebase'

class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request(path, { method = 'GET', body, query } = {}) {
  const user = auth.currentUser
  if (!user) throw new ApiError('Not signed in.', 401, 'unauthenticated')

  // Firebase refreshes this automatically when it's close to expiring, so a
  // long admin session doesn't start failing halfway through.
  const token = await user.getIdToken()

  const url = new URL(path, window.location.origin)
  if (query) for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let data
  try { data = text ? JSON.parse(text) : {} }
  catch {
    // A non-JSON body almost always means the request never reached the
    // function — typically index.html served by the SPA rewrite because the
    // /api route isn't deployed. Say that rather than "Unexpected token <".
    throw new ApiError(
      `The server returned ${res.status} and not JSON. If you're running locally, the /api functions only exist on Vercel — use "vercel dev" instead of "npm run dev".`,
      res.status, 'bad_response'
    )
  }

  if (!res.ok) throw new ApiError(data.message || `Request failed (${res.status})`, res.status, data.error)
  return data
}

export const getSession   = ()            => request('/api/admin/session')
export const getStats     = ()            => request('/api/admin/stats')

export const listUsers    = (q)           => request('/api/admin/users', { query: { q } })
export const userAction   = (body)        => request('/api/admin/users', { method: 'POST', body })

export const listBoards   = ()            => request('/api/admin/boards')
export const boardDetail  = (id)          => request('/api/admin/boards', { query: { id } })
export const boardAction  = (body)        => request('/api/admin/boards', { method: 'POST', body })

export const getDirectory = ()            => request('/api/admin/directory')
export const dirAction    = (body)        => request('/api/admin/directory', { method: 'POST', body })

export const getAudit     = (limit = 100) => request('/api/admin/audit', { query: { limit } })

export { ApiError }
