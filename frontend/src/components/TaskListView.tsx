import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '@/stores/useStore'
import { api } from '@/api/client'
import TaskItem from './TaskItem'

export default function TaskListView() {
  const tasks = useStore((s) => s.tasks)
  const addTask = useStore((s) => s.addTask)
  const [newText, setNewText] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all')

  const createMutation = useMutation({
    mutationFn: api.createTask,
    onSuccess: (task) => {
      addTask(task)
      setNewText('')
    },
  })

  const filtered = tasks.filter((t) => {
    if (filter === 'active') return !t.is_done
    if (filter === 'done') return t.is_done
    return true
  })

  const subjectGroups = new Map<string, typeof filtered>()
  for (const t of filtered) {
    const list = subjectGroups.get(t.subject_name) ?? []
    list.push(t)
    subjectGroups.set(t.subject_name, list)
  }

  const handleAdd = () => {
    if (!newText.trim()) return
    createMutation.mutate({
      lesson_id: '',
      subject_name: 'Общее',
      target_date: new Date().toISOString().slice(0, 10),
      content: newText.trim(),
    })
  }

  return (
    <div className="flex-1 bg-zinc-950 flex flex-col overflow-hidden">
      <div className="h-14 border-b border-zinc-800 flex items-center px-6 shrink-0">
        <h2 className="font-bold text-white text-lg">{'\u2704'} Все задачи</h2>
        <div className="ml-auto flex gap-2">
          {(['all', 'active', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === f
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 bg-zinc-800/50'
              }`}
            >
              {f === 'all' ? 'Все' : f === 'active' ? 'Активные' : 'Выполненные'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {subjectGroups.size === 0 && (
          <div className="text-center text-zinc-500 mt-20">
            <div className="text-4xl mb-4">{'\u2704'}</div>
            <p className="font-medium">Задач пока нет</p>
            <p className="text-sm mt-1">Добавьте задачу из расписания или ниже</p>
          </div>
        )}

        {Array.from(subjectGroups.entries()).map(([subject, subjectTasks]) => (
          <div key={subject} className="mb-8">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
              {subject}
            </h3>
            <div className="space-y-0.5">
              {subjectTasks.map((t) => (
                <TaskItem key={t.id} task={t} />
              ))}
            </div>
          </div>
        ))}

        <div className="flex gap-3 items-center p-3 border border-dashed border-zinc-800 rounded-lg focus-within:border-zinc-600 transition-colors mt-4">
          <div className="w-4 h-4 rounded border border-zinc-700 flex-shrink-0" />
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAdd()
              }
            }}
            placeholder="Добавить задачу без привязки к паре..."
            className="bg-transparent text-sm text-zinc-200 w-full outline-none placeholder-zinc-600"
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  )
}
