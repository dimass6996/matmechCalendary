import { useStore } from '@/stores/useStore'
import type { Lesson } from '@/types'

interface Props {
  lesson: Lesson
}

export default function ScheduleCard({ lesson }: Props) {
  const selectedId = useStore((s) => s.selectedLessonId)
  const setSelected = useStore((s) => s.setSelectedLesson)
  const isActive = selectedId === lesson.id

  const badgeHtml =
    lesson.task_count > 0
      ? `<div class="absolute -right-1.5 -top-1.5 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm font-bold flex items-center gap-1 z-10" style="background-color:${lesson.color_hex}">
          \uD83D\uDCCC ${lesson.task_count}
        </div>`
      : ''

  return (
    <div
      onClick={() => setSelected(lesson.id)}
      className={`p-3.5 rounded-xl border cursor-pointer transition-all relative ${
        isActive
          ? 'bg-zinc-800/40 border-blue-500/50 shadow-[0_0_15px_rgba(0,0,0,0.2)]'
          : lesson.is_past
            ? 'bg-zinc-800/30 border-zinc-700/30 hover:border-zinc-600 opacity-60'
            : 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600'
      }`}
      dangerouslySetInnerHTML={{
        __html: `${badgeHtml}
          <div class="flex justify-between text-xs ${isActive ? 'text-white/80' : 'text-zinc-400'} mb-2 font-medium">
            <span class="font-mono">${lesson.time_start} - ${lesson.time_end}</span>
            <span class="${isActive ? 'bg-blue-500/20' : 'bg-zinc-800'} px-1.5 rounded">${lesson.room}</span>
          </div>
          <div class="font-bold mb-1 flex items-center gap-2 ${isActive ? 'text-white' : 'text-zinc-200'}">
            <div class="w-1.5 h-4 rounded-full" style="background-color:${lesson.color_hex};${isActive ? 'box-shadow:0 0 8px ' + lesson.color_hex : ''}"></div>
            ${lesson.subject_name}
          </div>
          <div class="text-xs ${isActive ? 'text-white/60' : 'text-zinc-500'}">${lesson.lesson_type} &bull; ${lesson.teacher}</div>`,
      }}
    />
  )
}
