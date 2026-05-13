import { useState } from 'react'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/useAuthStore'

type Mode = 'login' | 'register'

const reLogin = /^[a-zA-Z0-9]+$/
const rePassword = /^[a-zA-Z0-9]+$/
const reName = /^[А-ЯЁ][а-яё]+$/
const reGroup = /^[А-ЯЁ]{3}-\d{6}$/

function normalizeName(s: string) {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1).toLowerCase()
}

function validate(mode: Mode, login: string, password: string, firstName: string, lastName: string, groupId: string): string | null {
  if (!login) return 'Login is required'
  if (!reLogin.test(login)) return 'Login must contain only English letters'

  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (!rePassword.test(password)) return 'Password must contain only English letters and digits'

  if (mode === 'register') {
    if (!firstName) return 'First name is required'
    if (!reName.test(firstName)) return 'First name must start with a capital Russian letter followed by lowercase Russian letters'

    if (!lastName) return 'Last name is required'
    if (!reName.test(lastName)) return 'Last name must start with a capital Russian letter followed by lowercase Russian letters'

    if (!groupId) return 'Academic group is required'
    if (!reGroup.test(groupId)) return 'Group must be 3 Russian letters, a dash, and 6 digits (e.g. МЕН-151001)'
  }

  return null
}

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [groupId, setGroupId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const validationError = validate(mode, login, password, firstName, lastName, groupId)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      if (mode === 'register') {
        const res = await api.register({
          login,
          password,
          first_name: normalizeName(firstName),
          last_name: normalizeName(lastName),
          group_id: groupId.toUpperCase(),
        })
        setAuth(res.token, res.user)
      } else {
        const res = await api.login({ login, password })
        setAuth(res.token, res.user)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <span className="text-blue-500 font-bold text-3xl">{'\u26A1'}</span>
          <h1 className="text-2xl font-bold text-white mt-2">SyncStudy</h1>
          <p className="text-zinc-400 text-sm mt-1">Contextual schedule for UrFU</p>
        </div>

        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
          <div className="flex mb-6 bg-zinc-800 rounded-lg p-1">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'login' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
              }`}
              onClick={() => { setMode('login'); setError('') }}
            >
              Login
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'register' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
              }`}
              onClick={() => { setMode('register'); setError('') }}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Login</label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="ivanov"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="at least 8 characters"
                required
                minLength={8}
              />
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value.replace(/[^а-яА-ЯёЁ]/g, ''))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="Иван"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value.replace(/[^а-яА-ЯёЁ]/g, ''))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="Иванов"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Academic Group</label>
                  <input
                    type="text"
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value.toUpperCase().replace(/[^А-ЯЁ\d-]/g, ''))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="МЕН-151001"
                    required
                  />
                </div>
              </>
            )}

            {error && (
              <div className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium py-2 rounded text-sm transition-colors"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
