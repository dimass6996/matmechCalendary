import { create } from 'zustand'
import type { Lesson, Task } from '@/types'

export type Tab = 'today' | 'week' | 'all' | 'tasks'

interface AppState {
  groupId: string
  selectedLessonId: string | null
  lessons: Lesson[]
  tasks: Task[]
  tab: Tab
  weekOffset: number
  allOffset: number

  setGroupId: (id: string) => void
  setSelectedLesson: (id: string | null) => void
  setLessons: (lessons: Lesson[]) => void
  setTasks: (tasks: Task[]) => void
  setTab: (tab: Tab) => void
  setWeekOffset: (n: number) => void
  setAllOffset: (n: number) => void
  addTask: (task: Task) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  removeTask: (id: string) => void
}

export const useStore = create<AppState>((set) => ({
  groupId: 'МЕН-151001',
  selectedLessonId: null,
  lessons: [],
  tasks: [],
  tab: 'today',
  weekOffset: 0,
  allOffset: 0,

  setGroupId: (id) => set({ groupId: id }),
  setSelectedLesson: (id) => set({ selectedLessonId: id }),
  setLessons: (lessons) => set({ lessons }),
  setTasks: (tasks) => set({ tasks }),
  setTab: (tab) => set({ tab }),
  setWeekOffset: (n) => set({ weekOffset: n }),
  setAllOffset: (n) => set({ allOffset: n }),

  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
  updateTask: (id, patch) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),
  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
}))
