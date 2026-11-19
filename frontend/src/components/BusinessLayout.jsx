import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, CalendarDays, FileText, LayoutGrid, MessageCircle, Plug, Settings2, Sparkles , Images } from 'lucide-react'
import { get } from '../lib/api'
import { Avatar, ErrorBox, PlatformBadge, Spinner, cx } from './ui'

const TABS = [
  ['', 'Umumiy', LayoutGrid, true], ['calendar', 'Kalendar', CalendarDays], ['posts', 'Postlar', FileText], ['media', 'Media', Images], ['ai', 'AI studiya', Sparkles],
  ['stats', 'Statistika', BarChart3], ['comments', 'Izohlar', MessageCircle], ['channels', 'Kanallar', Plug], ['settings', 'Biznes', Settings2],
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
        <Avatar name={b.name} size={44} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{b.name}</h1>
          <div className="text-sm text-slate-500">{b.industry || 'Soha ko\'rsatilmagan'}</div>
        </div>
        <div className="ml-auto flex gap-1.5">{b.platforms.map((p, i) => <PlatformBadge key={i} platform={p} />)}</div>
      </div>
      <nav className="scroll-thin mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map(([to, label, Icon, end]) => (
          <NavLink key={to} to={to} end={!!end}
            className={({ isActive }) => cx('flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition -mb-px',
              isActive ? 'border-brand-600 font-semibold text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>
            <Icon size={16} />{label}
          </NavLink>
        ))}
      </nav>
      <Outlet context={{ business: b, slug }} />
    </div>
  )
}
