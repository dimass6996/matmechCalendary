import { useStore } from '@/stores/useStore'
import { useAuthStore } from '@/stores/useAuthStore'

export default function TitleBar() {
  const groupId = useStore((s) => s.groupId)
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const initials = user
    ? `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase()
    : '?'

  return (
    <div className="h-10 bg-zinc-950 border-b border-zinc-800 flex items-center px-4 shrink-0 app-drag-region">
      <div className="flex items-center gap-2 no-drag">
        <span className="text-blue-500 font-bold text-lg leading-none">{'\u26A1'}</span>
        <span className="font-bold tracking-tight">SyncStudy</span>
        <span className="text-xs text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 ml-2">
          {groupId}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-3 text-zinc-400 no-drag">
        <button className="hover:text-white transition-colors text-xs bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
          {'\uD83D\uDD0D'} Поиск (Ctrl+K)
        </button>
        <div className="relative group">
          <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold cursor-pointer hover:bg-zinc-700">
            {initials}
          </div>
          <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
            <div className="px-3 py-2 border-b border-zinc-800">
              <p className="text-sm text-white font-medium">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-zinc-400">{user?.group_id}</p>
            </div>
            <button
              onClick={() => setUser(null)}
              className="w-full text-left px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-b-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
