export interface Subject {
  id: string
  name: string
  color_hex: string
}

export interface Lesson {
  id: string
  group_id: string
  subject_id: string
  subject_name: string
  color_hex: string
  date: string
  time_start: string
  time_end: string
  teacher: string
  room: string
  lesson_type: string
  is_past: boolean
  task_count: number
}

export interface Task {
  id: string
  user_id: string
  lesson_id: string
  subject_name: string
  target_date: string
  content: string
  is_done: boolean
  created_at: string
}

export interface ScheduleResponse {
  date: string
  lessons: Lesson[]
  tasks: Task[]
}

export interface CreateTaskPayload {
  lesson_id: string
  subject_name: string
  target_date: string
  content: string
}

export interface UpdateTaskPayload {
  content?: string
  is_done?: boolean
}

export interface User {
  id: string
  login: string
  first_name: string
  last_name: string
  group_id: string
  created_at: string
}

export interface RegisterPayload {
  login: string
  password: string
  first_name: string
  last_name: string
  group_id: string
}

export interface LoginPayload {
  login: string
  password: string
}

export interface AuthResponse {
  token: string
  user: User
}
