import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useStore } from '@/stores/useStore'
import { api } from '@/api/client'
import type { Task } from '@/types'

interface Props {
  task: Task
}

export default function TaskItem({ task }: Props) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(task.content)
  const inputRef = useRef<HTMLInputElement>(null)
  const updateTask = useStore((s) => s.updateTask)
  const removeTask = useStore((s) => s.removeTask)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const toggleMutation = useMutation({
    mutationFn: () => api.updateTask(task.id, { is_done: !task.is_done }),
    onMutate: () => {
      updateTask(task.id, { is_done: !task.is_done })
    },
  })

  const saveMutation = useMutation({
    mutationFn: (content: string) => api.updateTask(task.id, { content }),
    onMutate: (content) => {
      updateTask(task.id, { content })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTask(task.id),
    onMutate: () => {
      removeTask(task.id)
    },
  })

  const saveEdit = () => {
    setEditing(false)
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== task.content) {
      saveMutation.mutate(trimmed)
    } else {
      setEditValue(task.content)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit()
    } else if (e.key === 'Escape') {
      setEditValue(task.content)
      setEditing(false)
    }
  }

  return (
    <div className="group flex gap-3 items-start p-3 -mx-3 rounded-lg hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors">
      <div className="mt-0.5 relative flex items-center justify-center">
        <input
          type="checkbox"
          checked={task.is_done}
          onChange={() => toggleMutation.mutate()}
          className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 cursor-pointer appearance-none checked:bg-blue-500 checked:border-blue-500 transition-colors"
        />
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            className="w-full bg-zinc-700 border border-blue-500 rounded px-2 py-0.5 text-sm text-white outline-none"
          />
        ) : (
          <div
            className={`text-sm font-medium outline-none mb-1 cursor-text ${
              task.is_done ? 'text-zinc-500 line-through' : 'text-zinc-200'
            }`}
            onDoubleClick={() => { setEditing(true); setEditValue(task.content) }}
          >
            {task.content}
          </div>
        )}
      </div>
      <button
        onClick={() => deleteMutation.mutate()}
        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-500 px-2 transition-opacity"
        title="Удалить"
      >
        {'\u2716'}
      </button>
    </div>
  )
}
