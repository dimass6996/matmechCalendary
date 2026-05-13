import { useMemo, useRef, useCallback } from 'react'
import { format, parseISO, isSameDay, startOfWeek, endOfWeek, addWeeks, addDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useStore } from '@/stores/useStore'
import ScheduleCard from './ScheduleCard'
import type { Lesson } from '@/types'

interface Props {
  isLoading: boolean
  error?: Error | null
  onRetry?: () => void
}

function groupByDay(lessons: Lesson[]) {
  const map = new Map<string, Lesson[]>()
  for (const l of lessons) {
    const arr = map.get(l.date) ?? []
    arr.push(l)
    map.set(l.date, arr)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
}

function generateWeekDays(dateGte: string, dateLte: string) {
  const days: string[] = []
  let d = parseISO(dateGte)
  const end = parseISO(dateLte)
  while (d <= end) {
    days.push(format(d, 'yyyy-MM-dd'))
    d = addDays(d, 1)
  }
  return days
}

function dayLabel(dateStr: string) {
  const d = parseISO(dateStr)
  const isToday = isSameDay(d, new Date())
  const dayName = format(d, 'EEEE', { locale: ru })
  return {
    full: `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${format(d, 'd MMMM', { locale: ru })}`,
    short: dayName.charAt(0).toUpperCase() + dayName.slice(1),
    dayName: format(d, 'EEEEEE', { locale: ru }),
    dayNum: format(d, 'd'),
    month: format(d, 'MMM', { locale: ru }),
    isToday,
  }
}

function isWeekend(dateStr: string) {
  const d = parseISO(dateStr)
  const wd = d.getDay()
  return wd === 0 || wd === 6
}

const START_HOUR = 8
const END_HOUR = 22
const PX_PER_MINUTE = 1
const HOUR_HEIGHT = 60
const TIME_AXIS_WIDTH = 60

interface CalendarEvent extends Lesson {
  topPx: number
  heightPx: number
  widthPercent: number
  leftPercent: number
}

function toMinutes(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number)
  return (h - START_HOUR) * 60 + m
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function layoutEvents(lessons: Lesson[]): CalendarEvent[] {
  const maxMins = (END_HOUR - START_HOUR) * 60
  let events = lessons
    .filter((l) => l.time_start !== '00:00' || l.time_end !== '00:00')
    .map((l) => {
      const startMins = clamp(toMinutes(l.time_start), 0, maxMins)
      const endMins = clamp(toMinutes(l.time_end), 0, maxMins)
      const height = Math.max(endMins - startMins, 20)
      return {
        ...l,
        topPx: startMins * PX_PER_MINUTE,
        heightPx: height * PX_PER_MINUTE,
        widthPercent: 100,
        leftPercent: 0,
      }
    })

  events.sort((a, b) => a.topPx - b.topPx)

  let columns: CalendarEvent[][] = []
  let lastEventEnding: number | null = null

  events.forEach((event) => {
    if (lastEventEnding !== null && event.topPx >= lastEventEnding) {
      assignWidths(columns)
      columns = []
      lastEventEnding = null
    }

    let placed = false
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]
      const lastInCol = col[col.length - 1]
      if (event.topPx >= lastInCol.topPx + lastInCol.heightPx) {
        col.push(event)
        placed = true
        break
      }
    }

    if (!placed) columns.push([event])
    const eventEnd = event.topPx + event.heightPx
    if (lastEventEnding === null || eventEnd > lastEventEnding) lastEventEnding = eventEnd
  })

  if (columns.length > 0) assignWidths(columns)
  return events
}

function assignWidths(columns: CalendarEvent[][]) {
  const count = columns.length
  columns.forEach((col, idx) => {
    col.forEach((event) => {
      event.widthPercent = 100 / count
      event.leftPercent = (100 / count) * idx
    })
  })
}

export default function SchedulePane({ isLoading, error, onRetry }: Props) {
  const tab = useStore((s) => s.tab)
  const lessons = useStore((s) => s.lessons)
  const weekOffset = useStore((s) => s.weekOffset)
  const allOffset = useStore((s) => s.allOffset)
  const setSelectedLesson = useStore((s) => s.setSelectedLesson)
  const setWeekOffset = useStore((s) => s.setWeekOffset)
  const setAllOffset = useStore((s) => s.setAllOffset)
  const headerRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const todayStr = format(new Date(), 'EEEE, d MMMM yyyy', { locale: ru })
  const days = useMemo(() => groupByDay(lessons), [lessons])
  const lessonsMap = useMemo(() => new Map(days), [days])

  const weekLabel = useMemo(() => {
    if (tab !== 'week') return ''
    const now = new Date()
    const weekStart = startOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 })
    return `Неделя с ${format(weekStart, 'd MMMM', { locale: ru })}`
  }, [tab, weekOffset])

  const blockLabel = useMemo(() => {
    if (tab !== 'all') return ''
    const now = new Date()
    const blockStart = startOfWeek(addWeeks(now, allOffset), { weekStartsOn: 1 })
    const blockEnd = endOfWeek(addWeeks(now, allOffset), { weekStartsOn: 1 })
    return `${format(blockStart, 'd MMMM', { locale: ru })} — ${format(blockEnd, 'd MMMM', { locale: ru })}`
  }, [tab, allOffset])

  const handlePrev = () => {
    if (tab === 'week') setWeekOffset(weekOffset - 1)
    else if (tab === 'all') setAllOffset(allOffset - 1)
  }

  const handleNext = () => {
    if (tab === 'week') setWeekOffset(weekOffset + 1)
    else if (tab === 'all') setAllOffset(allOffset + 1)
  }

  const syncScroll = useCallback(() => {
    if (headerRef.current && bodyRef.current) {
      headerRef.current.scrollLeft = bodyRef.current.scrollLeft
    }
  }, [])

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

  const isAllTab = tab === 'all'
  const containerWidth = isAllTab ? 'flex-1' : 'w-80'
  const totalHeight = (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT

  // For the "all" tab: generate all 7 day columns and compute event layouts
  const allDays = useMemo(() => {
    if (tab !== 'all') return []
    const now = new Date()
    const ws = format(startOfWeek(addWeeks(now, allOffset), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const we = format(endOfWeek(addWeeks(now, allOffset), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    return generateWeekDays(ws, we)
  }, [tab, allOffset])

  const laidOutMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const [dateStr, dayLessons] of days) {
      map.set(dateStr, layoutEvents(dayLessons))
    }
    return map
  }, [days])

  const hasAnyEvents = useMemo(() => {
    for (const [, vals] of laidOutMap) {
      if (vals.length > 0) return true
    }
    return false
  }, [laidOutMap])

  const title =
    tab === 'today' ? 'Сегодня' : tab === 'week' ? 'Неделя' : 'Все расписание'
  const subtitle = tab === 'today' ? todayStr : tab === 'week' ? weekLabel : blockLabel

  return (
    <div className={`${containerWidth} bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0 relative min-w-0`}>
      <div className="px-5 py-4 border-b border-zinc-800 flex justify-between items-end bg-zinc-900/90 backdrop-blur sticky top-0 z-10 shrink-0">
        <div className="min-w-0">
          <div className="text-xs text-zinc-500 mb-1 tracking-wider uppercase truncate">
            {subtitle}
          </div>
          <div className="font-bold text-xl text-zinc-100">{title}</div>
        </div>
        <div className="flex gap-1 shrink-0">
          {(tab === 'week' || tab === 'all') && (
            <button onClick={() => { setWeekOffset(0); setAllOffset(0) }} className="px-2 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-xs text-zinc-400 hover:text-white transition-colors">Сегодня</button>
          )}
          <button onClick={handlePrev} className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 transition-colors">&lt;</button>
          <button onClick={handleNext} className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 transition-colors">&gt;</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {isLoading && (
          <div className="flex items-center justify-center text-zinc-500 py-8">Загрузка...</div>
        )}

        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center text-zinc-500 py-12 px-4">
            <div className="text-3xl mb-3">{'\u26A0\uFE0F'}</div>
            <p className="text-sm font-medium text-zinc-400 mb-1">Не удалось загрузить расписание</p>
            <p className="text-xs text-zinc-600 mb-4 text-center">{error.message}</p>
            {onRetry && (
              <button onClick={onRetry} className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-md transition-colors border border-zinc-700">
                Повторить
              </button>
            )}
          </div>
        )}

        {/* Today tab */}
        {tab === 'today' && !isLoading && !error && (
          <div className="p-4 space-y-3 overflow-y-auto">
            {days.length === 0 && <div className="text-center text-zinc-500 py-8">Нет пар</div>}
            {days.map(([dateStr, dayLessons]) => (
              <div key={dateStr} className="space-y-3">
                {dayLessons.map((l) => <ScheduleCard key={l.id} lesson={l} />)}
              </div>
            ))}
          </div>
        )}

        {/* Week tab */}
        {tab === 'week' && !isLoading && !error && (
          <div className="overflow-y-auto p-4 space-y-3">
            {days.length === 0 && <div className="text-center text-zinc-500 py-8">Нет пар</div>}
            {days.map(([dateStr, dayLessons]) => {
              const info = dayLabel(dateStr)
              return (
                <div key={dateStr}>
                  <div className="flex items-center gap-2 mb-3 mt-1">
                    <div className={`text-xs font-bold uppercase tracking-wider ${info.isToday ? 'text-blue-400' : 'text-zinc-400'}`}>{info.full}</div>
                    {info.isToday && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-medium">сегодня</span>}
                    <div className="flex-1 border-t border-zinc-800" />
                  </div>
                  <div className="space-y-3">
                    {dayLessons.map((l) => <ScheduleCard key={l.id} lesson={l} />)}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* All tab: Calendar column layout (1 week) */}
        {tab === 'all' && !isLoading && !error && (
          <>
            {!hasAnyEvents && (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-md">
                  <div className="text-3xl mb-4 text-zinc-600">{'\uD83D\uDCC5'}</div>
                  <div className="text-lg font-semibold text-zinc-300 mb-2">Экзамены или каникулы</div>
                  <div className="text-sm text-zinc-500 leading-relaxed">
                    В этом блоке пока нет занятий. В период сессии здесь появятся экзамены, а на каникулах расписание будет пустовать.
                  </div>
                </div>
              </div>
            )}

            {hasAnyEvents && (
              <>
                {/* Day headers */}
                <div ref={headerRef} className="flex overflow-hidden border-b border-zinc-800 bg-zinc-900 shrink-0">
                  <div className="w-[60px] shrink-0 border-r border-zinc-800" />
                  <div className="flex flex-1">
                    {allDays.map((dateStr) => {
                      const info = dayLabel(dateStr)
                      return (
                        <div
                          key={dateStr}
                          className={`flex flex-col items-center justify-center py-2 border-r border-zinc-800 flex-1 min-w-0 ${
                            info.isToday ? 'bg-zinc-800/40' : ''
                          }`}
                        >
                          <div className={`text-[11px] uppercase tracking-wider font-semibold ${info.isToday ? 'text-blue-400' : 'text-zinc-500'}`}>
                            {info.dayName}
                          </div>
                          <div className={`text-lg font-semibold mt-0.5 w-8 h-8 flex items-center justify-center rounded-full ${info.isToday ? 'bg-blue-500 text-white' : 'text-zinc-300'}`}>
                            {info.dayNum}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Calendar body */}
                <div ref={bodyRef} onScroll={syncScroll} className="flex-1 overflow-y-auto overflow-x-hidden">
                  <div className="flex relative" style={{ height: totalHeight }}>
                    {/* Time axis */}
                    <div className="shrink-0 border-r border-zinc-800 bg-zinc-900 sticky left-0 z-20" style={{ width: TIME_AXIS_WIDTH }}>
                      {hours.map((hour) => (
                        <div
                          key={hour}
                          className="absolute right-2 text-[11px] text-zinc-500 font-medium"
                          style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, transform: 'translateY(-50%)' }}
                        >
                          {`${hour.toString().padStart(2, '0')}:00`}
                        </div>
                      ))}
                    </div>

                    {/* Day columns */}
                    <div className="flex flex-1">
                      {allDays.map((dateStr) => {
                        const info = dayLabel(dateStr)
                        const laidOut = laidOutMap.get(dateStr) ?? []
                        const empty = laidOut.length === 0
                        return (
                          <div
                            key={dateStr}
                            className={`relative border-r border-zinc-800 flex-1 min-w-0 ${
                              info.isToday ? 'bg-zinc-800/10' : ''
                            }`}
                            style={{ height: totalHeight }}
                          >
                            {/* Grid lines */}
                            {hours.map((hour) => (
                              <div
                                key={hour}
                                className="absolute left-0 right-0 border-t border-zinc-800/60"
                                style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                              />
                            ))}

                            {/* Empty day placeholder */}
                            {empty && !isWeekend(dateStr) && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="text-[10px] text-zinc-600 text-center px-2 leading-relaxed">
                                  экзамены<br />/ каникулы
                                </div>
                              </div>
                            )}

                            {/* Events */}
                            {laidOut.map((ev) => {
                              const color = ev.color_hex
                              return (
                                <div
                                  key={ev.id}
                                  onClick={() => setSelectedLesson(ev.id)}
                                  className="absolute rounded-md overflow-hidden cursor-pointer transition-transform hover:z-30 hover:-translate-y-0.5 hover:shadow-lg"
                                  style={{
                                    top: ev.topPx,
                                    height: ev.heightPx,
                                    width: `calc(${ev.widthPercent}% - 4px)`,
                                    left: `calc(${ev.leftPercent}% + 2px)`,
                                    backgroundColor: `${color}22`,
                                    borderLeft: `3px solid ${color}`,
                                    zIndex: 10,
                                  }}
                                >
                                  <div className="p-1 h-full flex flex-col overflow-hidden text-[11px] leading-tight">
                                    <div className="font-semibold text-zinc-100 truncate">
                                      {ev.subject_name}
                                    </div>
                                    <div className="text-zinc-400 font-mono mt-0.5 shrink-0">
                                      {ev.time_start}
                                    </div>
                                    {ev.room && (
                                      <div className="text-zinc-400 shrink-0">
                                        {ev.room}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
