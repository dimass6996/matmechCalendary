import { useState, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '@/stores/useStore'
import { api } from '@/api/client'
import TaskItem from './TaskItem'

export default function ContextPane() {
  const selected = useStore(
    useShallow((s) => s.lessons.find((l) => l.id === s.selectedLessonId) ?? null)
  )
  const tasks = useStore(
    useShallow((s) => s.tasks.filter((t) => t.lesson_id === s.selectedLessonId))
  )
  const addTask = useStore((s) => s.addTask)
  const [newTaskText, setNewTaskText] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [noteLoaded, setNoteLoaded] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const noteElRef = useRef<HTMLDivElement>(null)

  // Load note when lesson changes
  useEffect(() => {
    if (!selected) return
    setNoteLoaded(false)
    api.getNote(selected.id).then((res) => {
      setNoteContent(res.content)
      setNoteLoaded(true)
    }).catch(() => {
      setNoteContent('')
      setNoteLoaded(true)
    })
  }, [selected?.id])

  // Sync note content to DOM element when loaded
  useEffect(() => {
    if (noteLoaded && noteElRef.current) {
      noteElRef.current.textContent = noteContent
    }
  }, [noteLoaded, selected?.id])

  // Auto-save note with debounce
  const noteMutation = useMutation({
    mutationFn: (content: string) => api.saveNote(selected!.id, content),
  })

  const handleNoteChange = (content: string) => {
    setNoteContent(content)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      noteMutation.mutate(content)
    }, 1000)
  }

  const createMutation = useMutation({
    mutationFn: api.createTask,
    onSuccess: (task) => {
      addTask(task)
      setNewTaskText('')
    },
  })

  const handleAddTask = () => {
    if (!newTaskText.trim() || !selected) return
    createMutation.mutate({
      lesson_id: selected.id,
      subject_name: selected.subject_name,
      target_date: selected.date,
      content: newTaskText.trim(),
    })
  }

  if (!selected) {
    return (
      <div className="flex-1 bg-zinc-950 flex flex-col min-w-0 items-center justify-center text-zinc-500">
        <div className="text-4xl mb-4">{'\uD83D\uDC49'}</div>
        <p className="font-medium">Выберите пару из расписания, чтобы увидеть детали</p>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-zinc-950 flex flex-col min-w-0">
      <div className="h-16 border-b border-zinc-800 px-8 flex justify-between items-center shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: selected.color_hex,
                boxShadow: `0 0 8px ${selected.color_hex}80`,
              }}
            />
            <h2 className="font-bold text-lg text-white">{selected.subject_name}</h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-300 border border-zinc-700">
              {selected.lesson_type}
            </span>
            <span>&bull;</span>
            <span className="font-mono">
              {selected.time_start} - {selected.time_end}
            </span>
            <span>&bull;</span>
            <span>{selected.teacher}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md text-xs font-medium transition-colors border border-zinc-700 text-zinc-300 flex items-center gap-2">
            <span>{'\uD83D\uDD17'}</span> Поделиться ДЗ
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-4xl">
        <div className="mb-10">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span>{'\u2704'}</span> Задачи к этой паре
          </h3>

          <div className="space-y-1">
            {tasks.length === 0 && (
              <div className="text-sm text-zinc-600 italic px-3 py-2">
                Нет задач. Отдыхайте!
              </div>
            )}
            {tasks.map((t) => (
              <TaskItem key={t.id} task={t} />
            ))}
          </div>

          <div className="flex gap-3 items-center p-3 -mx-3 mt-2 group border border-transparent rounded-lg focus-within:border-zinc-800 focus-within:bg-zinc-900/50 transition-colors">
            <div className="w-4 h-4 rounded border border-zinc-700 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTask()
                }
              }}
              placeholder="Добавить задачу (нажмите Enter)..."
              className="bg-transparent text-sm text-zinc-200 w-full outline-none placeholder-zinc-600"
              autoComplete="off"
            />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span>{'\uD83D\uDCE1'}</span> Заметки и конспекты
          </h3>
          <div
            ref={noteElRef}
            className="prose prose-invert prose-sm max-w-none text-zinc-300 outline-none min-h-[200px] p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-xl"
            contentEditable
            data-placeholder="Начните писать конспект или вставьте ссылки..."
            suppressContentEditableWarning
            onInput={(e) => handleNoteChange(e.currentTarget.textContent ?? '')}
            onBlur={(e) => handleNoteChange(e.currentTarget.textContent ?? '')}
          />
        </div>
      </div>
    </div>
  )
}
