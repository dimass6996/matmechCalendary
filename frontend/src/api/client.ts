import type { ScheduleResponse, Task, CreateTaskPayload, UpdateTaskPayload, AuthResponse, RegisterPayload, LoginPayload } from '@/types'

const BASE = import.meta.env.PROD ? 'http://localhost:8080/api' : '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    headers: { ...headers, ...init?.headers as Record<string, string> | undefined },
    ...init,
  })
  if (!res.ok) {
    const err = await res.text()
    if (res.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.reload()
    }
    throw new Error(err || res.statusText)
  }
  return res.json()
}

export const api = {
  register(payload: RegisterPayload) {
    return request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(payload) })
  },

  login(payload: LoginPayload) {
    return request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(payload) })
  },

  getSchedule(groupId: string, dateGte: string, dateLte: string) {
    const params = new URLSearchParams({ group_id: groupId, date_gte: dateGte, date_lte: dateLte })
    return request<ScheduleResponse>(`/schedule?${params}`)
  },

  createTask(payload: CreateTaskPayload) {
    return request<Task>('/tasks', { method: 'POST', body: JSON.stringify(payload) })
  },

  updateTask(id: string, payload: UpdateTaskPayload) {
    return request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },

  deleteTask(id: string) {
    return request<void>(`/tasks/${id}`, { method: 'DELETE' })
  },

  saveNote(lessonId: string, content: string) {
    return request<{ status: string }>('/notes', { method: 'POST', body: JSON.stringify({ lesson_id: lessonId, content }) })
  },

  getNote(lessonId: string) {
    return request<{ content: string }>(`/notes?lesson_id=${encodeURIComponent(lessonId)}`)
  },
}
