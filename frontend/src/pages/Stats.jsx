import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { get, post } from '../lib/api'
import { Button, Card, Empty, ErrorBox, PlatformBadge, Spinner, cx } from '../components/ui'
import { useAct } from '../components/hooks'
import { KIND, PLATFORM, SENTIMENT, fmtDate, fmtNum } from '../lib/meta'

const dshort = (d) => { const x = new Date(d); return `${x.getDate()}.${String(x.getMonth() + 1).padStart(2, '0')}` }

export default function Stats() {
  const { slug } = useOutletContext()
  const [days, setDays] = useState(30)
  const { data, isLoading, error } = useQuery({ queryKey: ['stats', slug, days], queryFn: () => get(`/api/businesses/${slug}/stats/?days=${days}`) })
  const refresh = useAct(() => post(`/api/businesses/${slug}/stats/refresh/`), { invalidate: [['stats', slug], ['overview', slug]] })
  if (isLoading) return <Spinner />
  if (error) return <ErrorBox error={error} />
  const d = data
  // har kanal uchun bitta jadval: sana bo'yicha
  const dates = [...new Set(d.channels.flatMap((c) => c.points.map((p) => p.date)))].sort()
  const multi = dates.map((dt) => Object.fromEntries([['date', dt], ...d.channels.map((c) => [`c${c.channel_id}`, c.points.find((p) => p.date === dt)?.followers ?? null])]))
  const sentimentData = Object.entries(d.sentiment).map(([k, v]) => ({ name: SENTIMENT[k].label, value: v, color: SENTIMENT[k].color })).filter((x) => x.value > 0)
  const kindData = d.kinds.map((k) => ({ name: KIND[k.kind]?.label || k.kind, n: k.n }))
  return (
    <div className="fade-up space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {[7, 30, 90].map((n) => <button key={n} onClick={() => setDays(n)} className={cx('rounded-full px-3 py-1 text-sm', days === n ? 'bg-brand-600 text-white' : 'border border-slate-200 bg-white text-slate-600')}>{n} kun</button>)}
        <Button className="ml-auto" variant="secondary" icon={RefreshCw} loading={refresh.isPending} onClick={() => refresh.mutate()}>Hozir yangilash</Button>
      </div>
      {d.summary.length === 0 ? <Empty title="Kanal ulanmagan" text="Statistika kanallar ulangandan keyin to'planadi." /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {d.summary.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="flex items-center gap-2"><PlatformBadge platform={s.platform} /><span className="truncate text-sm text-slate-600">{s.name}</span></div>
              <div className="mt-3 flex items-end gap-3"><div className="text-3xl font-bold">{fmtNum(s.followers)}</div>
                <div className={cx('mb-1 flex items-center gap-1 text-sm', s.delta >= 0 ? 'text-emerald-600' : 'text-red-600')}>{s.delta >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}{s.delta >= 0 ? '+' : ''}{s.delta}</div></div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">{Object.entries(s.extra).map(([k, v]) => <span key={k}>{k}: <b className="text-slate-700">{typeof v === 'number' ? fmtNum(Math.round(v)) : v}</b></span>)}</div>
              {s.last_error && <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{s.last_error.slice(0, 140)}</div>}
            </Card>
          ))}
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5"><h2 className="mb-3 font-semibold">Jami obunachilar</h2>
          {d.total_series.length < 2 ? <p className="py-12 text-center text-sm text-slate-400">Grafik uchun kamida 2 kunlik ma'lumot kerak (har 3 soatda avtomatik yig'iladi)</p> : (
            <ResponsiveContainer width="100%" height={260}><AreaChart data={d.total_series}><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7657ff" stopOpacity={0.35} /><stop offset="100%" stopColor="#7657ff" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" /><XAxis dataKey="date" tickFormatter={dshort} fontSize={12} /><YAxis fontSize={12} width={45} domain={['auto', 'auto']} /><Tooltip labelFormatter={dshort} />
              <Area type="monotone" dataKey="followers" name="Obunachi" stroke="#7657ff" strokeWidth={2.5} fill="url(#g)" /></AreaChart></ResponsiveContainer>)}
        </Card>
        <Card className="p-5"><h2 className="mb-3 font-semibold">Kanallar bo'yicha o'sish</h2>
          {multi.length < 2 ? <p className="py-12 text-center text-sm text-slate-400">Ma'lumot yetarli emas</p> : (
            <ResponsiveContainer width="100%" height={260}><LineChart data={multi}><CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" /><XAxis dataKey="date" tickFormatter={dshort} fontSize={12} /><YAxis fontSize={12} width={45} domain={['auto', 'auto']} /><Tooltip labelFormatter={dshort} /><Legend />
              {d.channels.map((c) => <Line key={c.channel_id} type="monotone" dataKey={`c${c.channel_id}`} name={`${PLATFORM[c.platform]?.label} · ${c.name}`} stroke={PLATFORM[c.platform]?.color} strokeWidth={2.5} dot={false} connectNulls />)}</LineChart></ResponsiveContainer>)}
        </Card>
        <Card className="p-5"><h2 className="mb-3 font-semibold">E'lon qilingan formatlar</h2>
          {kindData.length === 0 ? <p className="py-12 text-center text-sm text-slate-400">Hali e'lon qilingan post yo'q</p> : (
            <ResponsiveContainer width="100%" height={220}><BarChart data={kindData}><CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" /><XAxis dataKey="name" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} width={30} /><Tooltip /><Bar dataKey="n" name="Postlar" fill="#8b5cf6" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>)}
        </Card>
        <Card className="p-5"><h2 className="mb-3 font-semibold">Izohlar kayfiyati</h2>
          {sentimentData.length === 0 ? <p className="py-12 text-center text-sm text-slate-400">Tahlil qilingan izoh yo'q</p> : (
            <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={sentimentData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>{sentimentData.map((s) => <Cell key={s.name} fill={s.color} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>)}
        </Card>
      </div>
      <Card className="overflow-hidden">
        <div className="p-5 pb-3 font-semibold">Postlar samaradorligi</div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-2">Post</th><th>Tarmoq</th><th>Format</th><th>Sana</th><th>Ko'rsatkichlar</th></tr></thead>
          <tbody>{d.perf.map((r, i) => (
            <tr key={i} className="border-t border-slate-100"><td className="max-w-xs truncate px-5 py-2.5">{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-brand-700 hover:underline">{r.title}</a> : r.title}</td>
              <td><PlatformBadge platform={r.platform} size={22} /></td><td>{KIND[r.kind]?.emoji} {KIND[r.kind]?.label}</td><td className="whitespace-nowrap text-slate-500">{fmtDate(r.published_at, false)}</td>
              <td className="text-xs text-slate-600">{Object.entries(r.metrics).map(([k, v]) => <span key={k} className="mr-3">{k}: <b>{fmtNum(v)}</b></span>)}</td></tr>))}
            {d.perf.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">Ma'lumot hali yo'q</td></tr>}</tbody></table></div>
      </Card>
    </div>
  )
}
