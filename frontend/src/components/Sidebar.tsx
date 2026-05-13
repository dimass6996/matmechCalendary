import { useStore } from '@/stores/useStore'
import type { Tab } from '@/stores/useStore'

const tabs: { key: Tab; icon: string; label: string }[] = [
  { key: 'today', icon: '\uD83D\uDCC5', label: 'Сегодня' },
  { key: 'week', icon: '\uD83D\uDCCB', label: 'Неделя' },
  { key: 'all', icon: '\uD83D\uDCC4', label: 'Все расписание' },
  { key: 'tasks', icon: '\u2704', label: 'Задачи' },
]

export default function Sidebar() {
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)
  const lessons = useStore((s) => s.lessons)

  const subjectMap = new Map<string, { name: string; color: string }>()
  lessons.forEach((l) => {
    if (!subjectMap.has(l.subject_name)) {
      subjectMap.set(l.subject_name, {
        name: l.subject_name,
        color: l.color_hex,
      })
    }
  })

  return (
    <div className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col shrink-0">
      <div className="p-3 space-y-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-colors ${
              tab === t.key
                ? 'bg-zinc-800 text-blue-400'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <span className="text-lg leading-none">{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex-1 flex flex-col min-h-0">
        <div className="px-5 text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 flex justify-between items-center">
          Предметы
        </div>
        <div className="space-y-0.5 px-2 overflow-y-auto flex-1">
          {Array.from(subjectMap.values()).map((sub) => (
            <button
              key={sub.name}
              className="w-full flex items-center gap-3 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800/50 rounded-md group transition-colors"
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: sub.color }}
              />
              {sub.name}
              <span className="ml-auto text-xs text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                {'\u22EE'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 text-xs text-zinc-600 flex justify-between items-center border-t border-zinc-800/50">
        <span>Синхронизировано</span>
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
      </div>
    </div>
  )
}
