import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, CalendarDays, FileText, LayoutGrid, MessageCircle, Plug, Settings2, Sparkles , Images } from 'lucide-react'
import { get } from '../lib/api'
import { Avatar, ErrorBox, PlatformBadge, Spinner, cx } from './ui'
import { AnimIcon } from './fx'

const TABS = [
  ['', 'Umumiy', LayoutGrid, 'flip', true], ['calendar', 'Kalendar', CalendarDays, 'wiggle'], ['posts', 'Postlar', FileText, 'pop'], ['media', 'Media', Images, 'pop'],
  ['ai', 'AI studiya', Sparkles, 'twinkle'], ['stats', 'Statistika', BarChart3, 'bob'], ['comments', 'Izohlar', MessageCircle, 'pop'], ['channels', 'Kanallar', Plug, 'fly'], ['settings', 'Biznes', Settings2, 'spin'],
]

export default function BusinessLayout() {
  const { slug } = useParams()
  const { data, error, isLoading } = useQuery({ queryKey: ['business', slug], queryFn: () => get(`/api/businesses/${slug}/`) })
  if (isLoading) return <Spinner />
  if (error) return <ErrorBox error={error} />
  const b = data.business
  return (
    <div className="fade-up">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Avatar name={b.name} size={52} live={b.pending > 0} />
        <div className="min-w-0">
          <h1 className="truncate text-[1.7rem] font-bold leading-tight">{b.name}</h1>
          <div className="text-sm text-slate-500">{b.industry || 'Soha ko\'rsatilmagan'}</div>
        </div>
        <div className="ml-auto flex gap-1.5">{b.platforms.map((p, i) => <PlatformBadge key={i} platform={p} />)}</div>
      </div>
      <nav className="scroll-thin mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-white/80 bg-white/70 p-1 shadow-sm backdrop-blur-md">
        {TABS.map(([to, label, Icon, anim, end]) => (
          <NavLink key={to} to={to} end={!!end}
            className={({ isActive }) => cx('hov flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm transition-all',
              isActive ? 'bg-gradient-to-br from-brand-600 to-brand-500 font-semibold text-white shadow-md shadow-brand-600/30' : 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900')}>
            <AnimIcon icon={Icon} a={anim} size={16} />{label}
          </NavLink>
        ))}
      </nav>
      <Outlet context={{ business: b, slug }} />
    </div>
  )
}
