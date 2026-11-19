import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Camera, CheckCircle2, ChevronDown, Cloud, Copy, ExternalLink, FileKey2, Globe, KeyRound, PlayCircle, Save, Send, Trash2, Zap } from 'lucide-react'
import { get, post } from '../lib/api'
import { Badge, Button, Card, ErrorBox, Field, Input, Select, Spinner, useToast, cx } from '../components/ui'


function AiCard({ c, allPrios, send }) {
  const [key, setKey] = useState('')
  const [model, setModel] = useState(c.model_value)
  const [prio, setPrio] = useState(String(c.prio ?? ''))
  const [help, setHelp] = useState(!c.is_set)
  const [busy, setBusy] = useState('')
  const dirty = key !== '' || model !== c.model_value || prio !== String(c.prio ?? '')
  const run = async (name, action, clear) => {
    setBusy(name)
    const ok = await send({ values: { ...(key ? { [c.key_field]: key } : {}), [c.model_field]: model }, clear: clear ? [c.key_field] : [], prios: { ...allPrios, [c.id]: prio }, action })
    setBusy('')
    if (ok) setKey('')
  }
  const on = prio !== ''
  return (
    <Card className={cx('flex flex-col p-5', on && c.is_set && 'ring-1 ring-emerald-200')}>
      <div className="flex items-start gap-3">
        <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white', c.free ? 'bg-emerald-500' : 'bg-amber-500')}>{c.label[0]}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{c.label}</h3>
            <Badge className={c.free ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>{c.free ? 'Bepul' : 'Pullik'}</Badge></div>
          <p className="mt-0.5 text-xs text-slate-500">{c.price}</p>
        </div>
        <div className="text-right text-xs">
          {c.is_set ? <span className="inline-flex items-center gap-2 text-emerald-600"><span className="pulse-dot" />Kalit bor</span> : <span className="text-slate-400">Kalit yo'q</span>}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_88px]">
        <Field label="API kalit" hint={c.is_set ? c.masked : null}>
          <Input type="password" autoComplete="new-password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={c.is_set ? "O'zgartirish uchun yangi kalit" : 'Kalitni joylang'} />
        </Field>
        <Field label="Model">
          <Input value={model} list={`m_${c.id}`} onChange={(e) => setModel(e.target.value)} />
          <datalist id={`m_${c.id}`}>{c.models.map((m) => <option key={m} value={m} />)}</datalist>
        </Field>
        <Field label="Tartib" hint="bo'sh = o'chiq"><Input inputMode="numeric" value={prio} placeholder="—" onChange={(e) => setPrio(e.target.value.replace(/\D/g, ''))} /></Field>
      </div>
      {!c.free && !on && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Pullik provayder hozir o'chiq: tartib raqami (masalan 4) yozilmaguncha ishlatilmaydi va pul sarflanmaydi.</p>}

      <button onClick={() => setHelp(!help)} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-brand-600"><BookOpen size={15} />Kalitni qanday olaman?<ChevronDown size={14} className={cx('transition', help && 'rotate-180')} /></button>
      {help && (
        <div className="mt-2 rounded-xl bg-slate-50 p-4 text-sm">
          <ol className="list-decimal space-y-1.5 pl-5 text-slate-700">{c.steps.map((t, i) => <li key={i}>{t}</li>)}</ol>
          <a href={c.url} target="_blank" rel="noreferrer" className="mt-3 inline-block"><Button size="sm" variant="secondary" icon={ExternalLink}>{c.url_label} sahifasini ochish</Button></a>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <Button size="sm" icon={Save} disabled={!dirty} loading={busy === 'save'} onClick={() => run('save', 'save')}>Saqlash</Button>
        <Button size="sm" variant="secondary" icon={Zap} loading={busy === 'test'} onClick={() => run('test', `test_ai_${c.id}`)}>Saqlash va tekshirish</Button>
        {c.is_set && <Button size="sm" variant="danger" icon={Trash2} loading={busy === 'clear'} className="ml-auto" onClick={() => confirm(`${c.label} kalitini o'chirasizmi?`) && run('clear', 'save', true)}>Kalitni o'chirish</Button>}
      </div>
    </Card>
  )
}

const ICONS = { send: Send, cloud: Cloud, globe: Globe, youtube: PlayCircle, instagram: Camera }

function Guide({ open, onToggle, steps, links }) {
  return (
    <>
      <button onClick={onToggle} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-brand-600"><BookOpen size={15} />Qanday sozlanadi?<ChevronDown size={14} className={cx('transition', open && 'rotate-180')} /></button>
      {open && (
        <div className="mt-2 rounded-xl bg-slate-50 p-4 text-sm">
          <ol className="list-decimal space-y-1.5 pl-5 text-slate-700">{steps.map((t, i) => <li key={i}>{t}</li>)}</ol>
          {links?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary" icon={ExternalLink}>{l.label}</Button></a>)}</div>}
        </div>
      )}
    </>
  )
}

function GroupCard({ g, redirectUri, send }) {
  const [values, setValues] = useState({})
  const [clear, setClear] = useState({})
  const [help, setHelp] = useState(!g.ready)
  const [busy, setBusy] = useState('')
  const Icon = ICONS[g.icon] || Globe
  const dirty = Object.keys(values).some((k) => values[k] !== (g.fields.find((f) => f.key === k)?.value ?? '')) || Object.values(clear).some(Boolean)
  const run = async (action) => {
    setBusy(action)
    const keys = new Set(g.fields.map((f) => f.key))
    const v = Object.fromEntries(Object.entries(values).filter(([k]) => keys.has(k)))
    const ok = await send({ values: v, clear: Object.keys(clear).filter((k) => clear[k]), action })
    setBusy('')
    if (ok) { setValues({}); setClear({}) }
  }
  const val = (f) => (f.key in values ? values[f.key] : f.value)
  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }))
  return (
    <Card className={cx('flex flex-col p-5', g.ready && 'ring-1 ring-emerald-200')}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon size={20} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{g.title}</h3>
            <Badge className={g.badge === 'Majburiy' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-50 text-emerald-700'}>{g.badge}</Badge></div>
          <p className="mt-1 text-sm text-slate-600">{g.intro}</p>
        </div>
        <div className="shrink-0 text-xs">{g.ready ? <span className="inline-flex items-center gap-2 text-emerald-600"><span className="pulse-dot" />Sozlangan</span> : <span className="text-amber-600">Sozlanmagan</span>}</div>
      </div>

      {g.redirect && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm">
          <span>Redirect URI:</span><code className="select-all break-all rounded bg-white px-2 py-1 font-semibold">{redirectUri}</code>
          <Button size="sm" variant="secondary" icon={Copy} onClick={() => { navigator.clipboard?.writeText(redirectUri); send.toast('Nusxalandi') }}>Nusxa</Button>
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {g.fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.kind === 'secret' ? (f.is_set ? f.masked : null) : f.help}>
            {f.kind === 'secret' ? (
              <>
                <Input type="password" autoComplete="new-password" value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} placeholder={f.is_set ? "O'zgartirish uchun yangi qiymat" : 'Kiriting'} />
                {f.is_set && <label className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><input type="checkbox" checked={!!clear[f.key]} onChange={(e) => setClear({ ...clear, [f.key]: e.target.checked })} />o'chirib tashlash</label>}
              </>
            ) : <Input value={val(f)} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />}
          </Field>
        ))}
      </div>

      <Guide open={help} onToggle={() => setHelp(!help)} steps={g.steps} links={g.links} />

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <Button size="sm" icon={Save} disabled={!dirty} loading={busy === 'save'} onClick={() => run('save')}>Saqlash</Button>
        {g.test.map((t) => <Button key={t.action} size="sm" variant="secondary" icon={Zap} loading={busy === t.action} onClick={() => run(t.action)}>{t.label}</Button>)}
      </div>
    </Card>
  )
}

export default function AppSettings() {
  const qc = useQueryClient()
  const toast = useToast()
  const { data, isLoading, error } = useQuery({ queryKey: ['app-settings'], queryFn: () => get('/api/settings/') })
  if (isLoading) return <Spinner />
  if (error) return <ErrorBox error={error} />
  const send = async (body) => {
    try {
      const r = await post('/api/settings/', body)
      toast[r.level === 'error' ? 'error' : 'success'](r.message)
      qc.setQueryData(['app-settings'], r)
      return r.level !== 'error'
    } catch (e) { toast.error(e.message); return false }
  }
  send.toast = toast.success
  const allPrios = Object.fromEntries(data.ai_cards.map((c) => [c.id, String(c.prio ?? '')]))
  return (
    <div className="fade-up max-w-6xl space-y-8">
      <div><h1 className="text-2xl font-bold">Sozlamalar</h1>
        <p className="text-sm text-slate-500">Har bir xizmat o'z kartasida: ma'lumotlarni kiriting, «Saqlash» bosing, kerak bo'lsa ulanishni tekshiring. O'zgarishlar dasturni qayta ishga tushirmasdan darhol kuchga kiradi.</p></div>

      <section>
        <div className="mb-1 flex items-center gap-2"><KeyRound size={18} className="text-brand-600" /><h2 className="text-lg font-semibold">AI provayderlar</h2></div>
        <p className="mb-4 text-sm text-slate-600"><b>Tartib</b> raqami kichik bo'lgani birinchi sinaladi, ishlamasa keyingisiga o'tadi. Bo'sh qoldirilgani o'chiq. AI hech qachon o'zi e'lon qilmaydi — faqat taklif beradi.</p>
        <div className="grid gap-4 xl:grid-cols-2">{data.ai_cards.map((c) => <AiCard key={c.id + c.prio + c.model_value + c.is_set} c={c} allPrios={allPrios} send={send} />)}</div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2"><Cloud size={18} className="text-brand-600" /><h2 className="text-lg font-semibold">Ulanishlar va xizmatlar</h2></div>
        <div className="grid gap-4 xl:grid-cols-2">{data.groups.map((g) => <GroupCard key={g.id + g.ready + g.fields.map((f) => f.is_set || f.value).join('|')} g={g} redirectUri={data.redirect_uri} send={send} />)}</div>
      </section>

      <Card className="flex gap-3 border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        <FileKey2 className="mt-0.5 shrink-0 text-slate-500" size={20} />
        <div><div className="font-semibold">MySQL va server sozlamalari bu yerda emas</div>
          <p className="mt-1">Ma'lumotlar bazasi (<code>DB_HOST</code>, <code>DB_NAME</code>, <code>DB_USER</code>, <code>DB_PASSWORD</code>), <code>SECRET_KEY</code>, <code>ALLOWED_HOSTS</code> va <code>DEBUG</code> bir marta o'rnatiladi va faqat <code className="break-all">{data.env_path}</code> faylida turadi. Ularni o'zgartirish kerak bo'lsa, faylni tahrirlab dasturni qayta ishga tushiring.</p>
          <p className="mt-1 text-amber-700"><b>Diqqat:</b> <code>SECRET_KEY</code> ni o'zgartirmang va nusxasini saqlab qo'ying — kanal tokenlari shu kalit bilan shifrlangan, kalit yo'qolsa ularni qayta kiritishga to'g'ri keladi.</p></div>
      </Card>
    </div>
  )
}
