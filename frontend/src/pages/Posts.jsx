import { useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, Link2, Plus, Search } from 'lucide-react'
import { get, post } from '../lib/api'
import { Badge, Button, Card, Empty, ErrorBox, Input, PlatformBadge, Select, Spinner, StatusBadge, cx } from '../components/ui'
import { useAct } from '../components/hooks'
import { KIND, STATUS, fmtDate } from '../lib/meta'

export default function Posts() {
  const { slug } = useOutletContext()
  const nav = useNavigate()
  const [status, setStatus] = useState('')
  const [kind, setKind] = useState('')
  const [q, setQ] = useState('')
  const qs = new URLSearchParams({ ...(status && { status }), ...(kind && { kind }), ...(q && { q }) }).toString()
  const { data, isLoading, error } = useQuery({ queryKey: ['posts', slug, qs], queryFn: () => get(`/api/businesses/${slug}/posts/?${qs}`), placeholderData: (p) => p })
  const create = useAct(() => post(`/api/businesses/${slug}/posts/`, {}), { onSuccess: (d) => nav(`${d.post.id}`) })
  const counts = data?.counts || {}
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><Input className="pl-9" placeholder="Qidirish…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select className="!w-auto" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Barcha formatlar</option>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
        <Button className="ml-auto" icon={Plus} loading={create.isPending} onClick={() => create.mutate()}>Yangi post</Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setStatus('')} className={cx('rounded-full px-3 py-1 text-sm', !status ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25' : 'bg-white/80 text-slate-600 border border-slate-200 hover:border-brand-200')}>Hammasi {total}</button>
        {Object.entries(STATUS).map(([k, v]) => (
          <button key={k} onClick={() => setStatus(k)} className={cx('rounded-full px-3 py-1 text-sm', status === k ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200')}>{v.label} {counts[k] || 0}</button>
        ))}
      </div>
      {isLoading ? <Spinner /> : error ? <ErrorBox error={error} /> : data.posts.length === 0 ? (
        <Empty icon={FileText} title="Postlar topilmadi" text="AI studiyadan oylik reja yarating yoki qo'lda post qo'shing." action={<Button icon={Plus} onClick={() => create.mutate()}>Yangi post</Button>} />
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {data.posts.map((p) => (
            <Link key={p.id} to={`${p.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-lg">{KIND[p.kind]?.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.title}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{KIND[p.kind]?.label}</span>
                  {p.series_name && <Badge className="bg-indigo-50 text-indigo-700"><Link2 size={11} />{p.series_name}{p.part_no ? ` · ${p.part_no}` : ''}</Badge>}
                  {p.ai_generated && <Badge className="bg-fuchsia-50 text-fuchsia-700">AI</Badge>}
                </div>
              </div>
              <div className="hidden gap-1 sm:flex">{p.platforms.map((x) => <PlatformBadge key={x} platform={x} size={22} />)}</div>
              <div className="hidden w-36 text-right text-xs text-slate-500 md:block">{fmtDate(p.scheduled_at)}</div>
              <StatusBadge status={p.status} />
            </Link>
          ))}
        </Card>
      )}
    </div>
  )
}
