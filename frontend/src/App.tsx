import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  startOfDay,
  endOfDay,
} from 'date-fns'
import { api } from '@/api/client'
import { useStore } from '@/stores/useStore'
import { useAuthStore } from '@/stores/useAuthStore'
import type { Tab } from '@/stores/useStore'
import Sidebar from '@/components/Sidebar'
import SchedulePane from '@/components/SchedulePane'
import ContextPane from '@/components/ContextPane'
import TitleBar from '@/components/TitleBar'
import AuthPage from '@/components/AuthPage'
import TaskListView from '@/components/TaskListView'

function getDateRange(tab: Tab, weekOffset: number, allOffset: number) {
  const now = new Date()
  switch (tab) {
    case 'today':
      return {
        dateGte: format(startOfDay(now), 'yyyy-MM-dd'),
        dateLte: format(endOfDay(now), 'yyyy-MM-dd'),
      }
    case 'week':
    case 'tasks': {
      const weekStart = startOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 })
      const weekEnd = endOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 })
      return {
        dateGte: format(weekStart, 'yyyy-MM-dd'),
        dateLte: format(weekEnd, 'yyyy-MM-dd'),
      }
    }
    case 'all': {
      const weekStart = startOfWeek(addWeeks(now, allOffset), { weekStartsOn: 1 })
      const weekEnd = endOfWeek(addWeeks(now, allOffset), { weekStartsOn: 1 })
      return {
        dateGte: format(weekStart, 'yyyy-MM-dd'),
        dateLte: format(weekEnd, 'yyyy-MM-dd'),
      }
    }
  }
}

export default function App() {
  const user = useAuthStore((s) => s.user)
  const groupId = useStore((s) => s.groupId)
  const setGroupId = useStore((s) => s.setGroupId)
  const tab = useStore((s) => s.tab)
  const weekOffset = useStore((s) => s.weekOffset)
  const allOffset = useStore((s) => s.allOffset)
  const setLessons = useStore((s) => s.setLessons)
  const setTasks = useStore((s) => s.setTasks)

  // Sync user's group into the store
  useEffect(() => {
    if (user && user.group_id !== groupId) {
      setGroupId(user.group_id)
    }
  }, [user, groupId, setGroupId])

  const effectiveGroup = user?.group_id ?? groupId

  const { dateGte, dateLte } = useMemo(
    () => getDateRange(tab, weekOffset, allOffset),
    [tab, weekOffset, allOffset]
  )

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['schedule', effectiveGroup, dateGte, dateLte],
    queryFn: () => api.getSchedule(effectiveGroup, dateGte, dateLte),
    enabled: !!user,
    retry: 2,
    staleTime: 30000,
  })

  useEffect(() => {
    if (data) {
      setLessons(data.lessons ?? [])
      setTasks(data.tasks ?? [])
    }
  }, [data, setLessons, setTasks])

  if (!user) {
    return <AuthPage />
  }

  return (
    <>
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        {tab === 'tasks' ? (
          <TaskListView />
        ) : (
          <>
            <SchedulePane isLoading={isLoading} error={error} onRetry={() => refetch()} />
            {tab !== 'all' && <ContextPane />}
          </>
        )}
      </div>
    </>
  )
}
