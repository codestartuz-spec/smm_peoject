import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarRange, LineChart, Link2, Sparkles } from 'lucide-react'
import { get, post } from '../lib/api'
import { Button, Card, Field, Input, Spinner, StatusBadge } from '../components/ui'
import { useAct } from '../components/hooks'
import { KIND } from '../lib/meta'

export default function AiStudio() {
  const { slug } = useOutletContext()
  const [plan, setPlan] = useState({ start: new Date().toISOString().slice(0, 10), days: 30, per_week: 4 })
  const [ser, setSer] = useState({ topic: '', parts: 5, every: 2 })
  const [insight, setInsight] = useState('')
  const inv = [['series', slug], ['posts', slug], ['overview', slug], ['businesses']]
  const series = useQuery({ queryKey: ['series', slug], queryFn: () => get(`/api/businesses/${slug}/series/`) })
  const mPlan = useAct(() => post(`/api/businesses/${slug}/ai/plan/`, plan), { invalidate: inv })
  const mSer = useAct(() => post(`/api/businesses/${slug}/ai/series/`, ser), { invalidate: inv, onSuccess: () => setSer({ ...ser, topic: '' }) })
  const mIns = useAct(() => post(`/api/businesses/${slug}/ai/insights/`), { onSuccess: (d) => setInsight(d.text) })
  return (
    <div className="fade-up space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 p-5 text-white">
        <div className="flex items-center gap-2 text-lg font-semibold"><Sparkles size={20} />AI studiya</div>
        <p className="mt-1 text-sm text-violet-100">AI faqat <b>taklif</b> beradi: hammasi «G'oya / Qoralama» bo'lib tushadi. Nashr faqat siz «Tasdiqlash» bosganingizdan keyin.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="space-y-3 p-5">
          <div className="flex items-center gap-2 font-semibold"><CalendarRange size={18} className="text-brand-600" />Oylik kontent reja</div>
          <Field label="Boshlanish sanasi"><Input type="date" value={plan.start} onChange={(e) => setPlan({ ...plan, start: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Necha kun"><Input type="number" value={plan.days} onChange={(e) => setPlan({ ...plan, days: e.target.value })} /></Field>
            <Field label="Haftasiga"><Input type="number" value={plan.per_week} onChange={(e) => setPlan({ ...plan, per_week: e.target.value })} /></Field></div>
          <Button variant="ai" icon={Sparkles} className="w-full" loading={mPlan.isPending} onClick={() => mPlan.mutate()}>Reja yaratish</Button>
        </Card>
        <Card className="space-y-3 p-5">
          <div className="flex items-center gap-2 font-semibold"><Link2 size={18} className="text-brand-600" />Seriya (ketma-ket g'oyalar)</div>
          <Field label="Mavzu"><Input value={ser.topic} onChange={(e) => setSer({ ...ser, topic: e.target.value })} placeholder="Masalan: Noldan Telegram bot yasash" /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Qismlar soni"><Input type="number" value={ser.parts} onChange={(e) => setSer({ ...ser, parts: e.target.value })} /></Field>
            <Field label="Har necha kunda"><Input type="number" value={ser.every} onChange={(e) => setSer({ ...ser, every: e.target.value })} /></Field></div>
          <Button variant="ai" icon={Sparkles} className="w-full" disabled={!ser.topic.trim()} loading={mSer.isPending} onClick={() => mSer.mutate()}>Seriya yaratish</Button>
        </Card>
        <Card className="space-y-3 p-5">
          <div className="flex items-center gap-2 font-semibold"><LineChart size={18} className="text-brand-600" />Haftalik tahlil</div>
          <p className="text-sm text-slate-600">Oxirgi 7 kunlik statistika asosida nima ishlagani va keyingi hafta uchun tavsiyalar.</p>
          <Button variant="ai" icon={Sparkles} className="w-full" loading={mIns.isPending} onClick={() => mIns.mutate()}>Tahlil qilish</Button>
        </Card>
      </div>
      {insight && <Card className="whitespace-pre-line p-5 text-sm leading-relaxed">{insight}</Card>}
      <div>
        <h2 className="mb-3 font-semibold">Seriyalar</h2>
        {series.isLoading ? <Spinner /> : (series.data?.series.length === 0 ? <Card className="p-6 text-center text-sm text-slate-400">Hali seriya yo'q</Card> : (
          <div className="grid gap-4 md:grid-cols-2">
            {series.data.series.map((s) => (
              <Card key={s.id} className="p-5">
                <div className="font-semibold">{s.name}</div><p className="mb-3 text-sm text-slate-500">{s.concept}</p>
                <ol className="relative space-y-2 border-l-2 border-indigo-100 pl-4">
                  {s.posts.map((p) => (
                    <li key={p.id} className="relative"><span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
                      <Link to={`../posts/${p.id}`} className="flex items-center justify-between gap-2 rounded-lg p-1.5 hover:bg-slate-50">
                        <span className="truncate text-sm">{KIND[p.kind]?.emoji} <b>{p.part_no}.</b> {p.title.split(': ').slice(1).join(': ') || p.title}</span><StatusBadge status={p.status} /></Link></li>
                  ))}
                </ol>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
