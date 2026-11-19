import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, CheckSquare, MessageCircle, Plus, Users } from 'lucide-react'
import { get } from '../lib/api'
import { Avatar, Badge, Card, Empty, ErrorBox, PlatformBadge, Spinner, Stat, StatusBadge } from '../components/ui'
import { fmtDate, fmtNum, KIND } from '../lib/meta'

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ['businesses'], queryFn: () => get('/api/businesses/') })
  if (isLoading) return <Spinner />
  if (error) return <ErrorBox error={error} />
  const { businesses, totals, upcoming } = data
  return (
    <div className="fade-up space-y-6">
      <div><h1 className="text-[1.7rem] font-bold">Boshqaruv paneli</h1><p className="text-sm text-slate-500">Barcha bizneslar va tarmoqlar bo'yicha qisqacha holat</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} label="Jami obunachilar" value={fmtNum(totals.followers)} tone="brand" />
        <Stat icon={CalendarClock} label="Bugungi postlar" value={totals.today} tone="sky" />
        <Stat icon={CheckSquare} label="Tasdiq kutmoqda" value={totals.pending} tone="amber" />
        <Stat icon={MessageCircle} label="Javob qoralamalari" value={totals.replies} tone="pink" />
      </div>
      {businesses.length === 0 ? (
        <Empty icon={Plus} title="Birinchi biznesni qo'shing" text="Chap paneldagi «+» tugmasi orqali biznes yarating (masalan: Elshod | Tech, Nova CRM), so'ng kanallarini ulang." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="grid content-start gap-4 sm:grid-cols-2 lg:col-span-2">
            {businesses.map((b) => (
              <Link key={b.id} to={`/b/${b.slug}`} className="card card-hover hov group p-5">
                <div className="flex items-start gap-3">
                  <Avatar name={b.name} size={48} live={b.pending > 0} />
                  <div className="min-w-0 flex-1"><div className="truncate font-semibold group-hover:text-brand-700">{b.name}</div><div className="truncate text-xs text-slate-500">{b.industry || '—'}</div></div>
                  <div className="flex gap-1">{b.platforms.map((p, i) => <PlatformBadge key={i} platform={p} size={22} />)}</div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[[fmtNum(b.followers), 'obunachi'], [b.published, "e'lon qilingan"], [b.today, 'bugun']].map(([v, l]) => (
                    <div key={l} className="rounded-xl bg-slate-50/80 py-2"><div className="font-display text-lg font-bold">{v}</div><div className="text-[11px] text-slate-500">{l}</div></div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {b.pending > 0 && <Badge className="bg-amber-100 text-amber-800">{b.pending} tasdiq kutmoqda</Badge>}
                  {b.ideas > 0 && <Badge className="bg-slate-100 text-slate-700">{b.ideas} g'oya</Badge>}
                  {b.replies > 0 && <Badge className="bg-pink-100 text-pink-700">{b.replies} javob qoralamasi</Badge>}
                  {!b.pending && !b.ideas && !b.replies && <span className="text-xs text-slate-400">Hammasi tartibda ✓</span>}
                </div>
              </Link>
            ))}
          </div>
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Yaqin nashrlar</h2>
            <div className="space-y-1">
              {upcoming.map((p) => (
                <Link key={p.id} to={`/b/${p.slug}/posts/${p.id}`} className="block rounded-xl p-2.5 hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{KIND[p.kind]?.emoji} {p.title}</span><StatusBadge status={p.status} /></div>
                  <div className="mt-0.5 text-xs text-slate-500">{p.business} · {fmtDate(p.scheduled_at)}</div>
                </Link>
              ))}
              {upcoming.length === 0 && <div className="py-6 text-center text-sm text-slate-400">Rejalashtirilgan post yo'q</div>}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
