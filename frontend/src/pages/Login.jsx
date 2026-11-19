import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BarChart3, CalendarDays, Megaphone, ShieldCheck, Sparkles } from 'lucide-react'
import { post } from '../lib/api'
import { Button, Field, Input } from '../components/ui'

export default function Login() {
  const qc = useQueryClient()
  const [f, setF] = useState({ username: '', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { await post('/api/login/', f); await qc.invalidateQueries({ queryKey: ['session'] }) } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  const feats = [[Sparkles, 'AI kontent reja va seriyalar'], [CalendarDays, 'Kalendar va tasdiqlash tizimi'], [BarChart3, 'Har tarmoq bo\'yicha statistika'], [ShieldCheck, 'Siz tasdiqlamaguncha hech narsa chiqmaydi']]
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3 text-xl font-bold"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20"><Megaphone size={20} /></span>SMM Agent</div>
        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight">Ijtimoiy tarmoqlar<br />bitta joyda.</h1>
          <p className="mt-3 max-w-md text-indigo-100">Telegram, Instagram va YouTube — barcha bizneslaringiz uchun reja, nashr, statistika va izohlar.</p>
          <ul className="mt-8 space-y-3">{feats.map(([I, t]) => <li key={t} className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15"><I size={16} /></span>{t}</li>)}</ul>
        </div>
        <div className="relative text-sm text-indigo-200">Elshod | Tech</div>
      </div>
      <div className="grid place-items-center p-6">
        <form onSubmit={submit} className="card fade-up w-full max-w-sm space-y-4 p-8">
          <div><h2 className="text-2xl font-bold">Xush kelibsiz 👋</h2><p className="text-sm text-slate-500">Panelga kirish uchun ma'lumotlarni kiriting</p></div>
          {err && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}
          <Field label="Login"><Input autoFocus value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
          <Field label="Parol"><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <Button className="w-full" loading={busy}>Kirish</Button>
        </form>
      </div>
    </div>
  )
}
