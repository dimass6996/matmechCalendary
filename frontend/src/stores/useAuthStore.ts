import { create } from 'zustand'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  setUser: (user: User | null) => void
  setAuth: (token: string, user: User) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: (() => {
    const raw = localStorage.getItem('user')
    if (raw) {
      try { return JSON.parse(raw) as User } catch { return null }
    }
    return null
  })(),
  setUser: (user) => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user))
    } else {
      localStorage.removeItem('user')
      localStorage.removeItem('token')
    }
    set({ user })
  },
  setAuth: (token, user) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ user })
  },
}))
