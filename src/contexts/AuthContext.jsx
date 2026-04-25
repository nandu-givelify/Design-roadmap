import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthChange } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // undefined = still loading, null = logged out, object = logged in
  const [user, setUser] = useState(undefined)

  useEffect(() => onAuthChange((u) => setUser(u)), [])

  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
