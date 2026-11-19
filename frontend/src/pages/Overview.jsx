import { Link, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, FileText, MessageCircle, Plus, Sparkles, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { get, post } from '../lib/api'
import { Button, Card, Empty, ErrorBox, PlatformBadge, Spinner, Stat, StatusBadge } from '../components/ui'
import { useAct } from '../components/hooks'
import { KIND, fmtDate, fmtNum } from '../lib/meta'

export default function Overview() {
  const { slug } = useOutletContext()
  const { data, isLoading, error } = useQuery({ queryKey: ['overview', slug], queryFn: () => get(`/api/businesses/${slug}/overview/`) })
  const approve = useAct((id) => post(`/api/posts/${id}/approve/`), { invalidate: [['overview', slug], ['businesses']] })
  if (isLoading) return <Spinner />
  if (error) return <ErrorBox error={error} />
  const d = data
  const up = d.followers_delta_7d >= 0
  return (
    <div className="fade-up space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} tone="brand" label="Jami obunachilar" value={fmtNum(d.channels.reduce((a, c) => a + c.followers, 0))}
          hint={<div className={`mt-0.5 flex items-center gap-1 text-xs ${up ? 'text-emerald-600' : 'text-red-600'}`}>{up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{up ? '+' : ''}{d.followers_delta_7d} (7 kun)</div>} />
        <Stat icon={FileText} tone="green" label="E'lon qilingan postlar" value={d.counts.published || 0} />
        <Stat icon={Check} tone="amber" label="Tasdiq kutmoqda" value={d.pending.length} />
        <Stat icon={MessageCircle} tone="pink" label="Javob qoralamalari" value={d.replies} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="posts"><Button icon={Plus}>Yangi post</Button></Link>
        <Link to="ai"><Button variant="ai" icon={Sparkles}>AI bilan reja yaratish</Button></Link>
        <Link to="comments"><Button variant="secondary" icon={MessageCircle}>Izohlarga javob</Button></Link>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">✋ Tasdiq kutayotgan postlar</h2>
          {d.pending.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Hozircha yo'q</p> : d.pending.map((p) => (
            <div key={p.id} className="flex items-center gap-2 border-b border-slate-100 py-2.5 last:border-0">
              <Link to={`posts/${p.id}`} className="min-w-0 flex-1"><div className="truncate text-sm font-medium hover:text-brand-700">{KIND[p.kind]?.emoji} {p.title}</div><div className="text-xs text-slate-500">{fmtDate(p.scheduled_at)}</div></Link>
              <Button size="sm" variant="success" loading={approve.isPending && approve.variables === p.id} onClick={() => approve.mutate(p.id)}>Tasdiqlash</Button>
            </div>
          ))}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">📅 Yaqin rejalar</h2>
          {d.upcoming.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Reja bo'sh — AI studiyada oylik reja yarating</p> : d.upcoming.map((p) => (
            <Link key={p.id} to={`posts/${p.id}`} className="flex items-center justify-between gap-2 border-b border-slate-100 py-2.5 last:border-0 hover:bg-slate-50">
              <div className="min-w-0"><div className="truncate text-sm font-medium">{KIND[p.kind]?.emoji} {p.title}</div><div className="text-xs text-slate-500">{fmtDate(p.scheduled_at)}</div></div><StatusBadge status={p.status} />
            </Link>
          ))}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">📡 Kanallar</h2>
          {d.channels.length === 0 ? <Empty title="Kanal ulanmagan" action={<Link to="channels"><Button>Kanal ulash</Button></Link>} /> : d.channels.map((c) => (
            <div key={c.id} className="border-b border-slate-100 py-2.5 last:border-0">
              <div className="flex items-center gap-2"><PlatformBadge platform={c.platform} /><span className="flex-1 truncate text-sm font-medium">{c.name}</span><span className="text-sm text-slate-600">{fmtNum(c.followers)}</span></div>
              {c.last_error && <div className="mt-1 flex gap-1.5 text-xs text-red-600"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{c.last_error.slice(0, 160)}</div>}
            </div>
          ))}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">💬 So'nggi izohlar xulosasi</h2>
          {d.digest ? <><p className="whitespace-pre-line text-sm text-slate-700">{d.digest.text}</p><div className="mt-2 text-xs text-slate-400">{fmtDate(d.digest.created_at)}</div></> : <p className="py-6 text-center text-sm text-slate-400">Xulosa hali yo'q. Izohlar bo'limida yarating.</p>}
        </Card>
      </div>
      {d.failed.length > 0 && (
        <Card className="border-red-200 bg-red-50 p-5">
          <h2 className="mb-2 font-semibold text-red-800">⚠️ Xato bilan tugagan postlar</h2>
          {d.failed.map((p) => <Link key={p.id} to={`posts/${p.id}`} className="block text-sm text-red-700 underline">{p.title}</Link>)}
        </Card>
      )}
    </div>
  )
}
