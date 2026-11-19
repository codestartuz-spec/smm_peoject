import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Plus, Save, Trash2 } from 'lucide-react'
import { put } from '../lib/api'
import { Button, Card, Field, Input, Textarea, cx } from '../components/ui'
import { useAct } from '../components/hooks'

export default function BusinessSettings() {
  const { business, slug } = useOutletContext()
  const [f, setF] = useState(business)
  useEffect(() => setF(business), [business])
  const save = useAct(() => put(`/api/businesses/${slug}/`, f), { success: 'Saqlandi', invalidate: [['business', slug], ['businesses'], ['overview', slug]] })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const pillars = f.pillars || []
  const total = pillars.reduce((a, p) => a + Number(p.share || 0), 0)
  const setP = (i, patch) => setF({ ...f, pillars: pillars.map((p, j) => (j === i ? { ...p, ...patch } : p)) })
  return (
    <div className="fade-up grid max-w-6xl gap-5 pb-20 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">Brend profili <span className="text-xs font-normal text-slate-400">— AI shu ma'lumotlarga tayanib yozadi</span></h2>
        <Field label="Nomi"><Input value={f.name} onChange={set('name')} /></Field>
        <Field label="Soha"><Input value={f.industry} onChange={set('industry')} /></Field>
        <Field label="Biznes haqida"><Textarea rows={3} value={f.description} onChange={set('description')} /></Field>
        <Field label="Maqsadli auditoriya"><Textarea rows={3} value={f.audience} onChange={set('audience')} /></Field>
        <Field label="Ovoz ohangi"><Input value={f.tone} onChange={set('tone')} /></Field>
        <Field label="Afzalliklari (USP)"><Textarea rows={3} value={f.usp} onChange={set('usp')} /></Field>
      </Card>
      <div className="space-y-5">
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Kontent qoidalari</h2>
          <Field label="Doimiy hashtaglar"><Input value={f.hashtags} onChange={set('hashtags')} placeholder="#elshodtech #dasturlash" /></Field>
          <Field label="Ishlatilmaydigan so'zlar"><Input value={f.forbidden_words} onChange={set('forbidden_words')} /></Field>
          <Field label="Maqsadlar (KPI)"><Textarea rows={3} value={f.goals} onChange={set('goals')} placeholder="Oyiga +500 obunachi, 20 ta lead…" /></Field>
          <Field label="Hisobot Telegram chat ID" hint="Bo'sh bo'lsa umumiy chat ishlatiladi"><Input value={f.report_chat_id} onChange={set('report_chat_id')} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />Faol biznes</label>
        </Card>
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Kontent ustunlari</h2><span className={cx('text-xs', total === 100 ? 'text-emerald-600' : 'text-amber-600')}>Jami: {total}%</span></div>
          <p className="text-xs text-slate-500">AI oylik rejani shu ulushlarga qarab tuzadi.</p>
          {pillars.map((p, i) => (
            <div key={p.id ?? `n${i}`} className="flex items-center gap-2">
              <Input value={p.name} onChange={(e) => setP(i, { name: e.target.value })} placeholder="Masalan: Foydali maslahat" />
              <Input type="number" className="!w-20" value={p.share} onChange={(e) => setP(i, { share: e.target.value })} />
              <button onClick={() => setF({ ...f, pillars: pillars.filter((_, j) => j !== i) })} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ))}
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => setF({ ...f, pillars: [...pillars, { name: '', share: 20 }] })}>Ustun qo'shish</Button>
        </Card>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 px-4 py-3 backdrop-blur lg:left-64"><div className="mx-auto flex max-w-[1400px]"><Button icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Saqlash</Button></div></div>
    </div>
  )
}
