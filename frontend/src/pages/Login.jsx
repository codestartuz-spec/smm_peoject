import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Heart, LogIn, MessageCircle, Send, Sparkles } from 'lucide-react'
import { post } from '../lib/api'
import { Button, Field, Input, PlatformBadge } from '../components/ui'
import { Logo } from '../components/fx'
import { fmtNum } from '../lib/meta'

/** Chap tomondagi jonli maket: post, tasdiq belgisi va AI javobi — tizim aynan nima qilishini ko'rsatadi. */
function LiveMock() {
  const [likes, setLikes] = useState(1248)
  useEffect(() => { const t = setInterval(() => setLikes((n) => n + 1 + Math.floor(Math.random() * 3)), 1800); return () => clearInterval(t) }, [])
  return (
    <div className="relative mt-10 hidden h-[330px] max-w-xl lg:block" aria-hidden="true">
      <div className="card absolute left-0 top-2 w-60 p-3" style={{ animation: 'float-a 7s ease-in-out infinite' }}>
        <div className="flex items-center gap-2"><PlatformBadge platform="instagram" size={26} /><div className="text-xs font-semibold">elshod.tech</div></div>
        <div className="mt-2 grid h-32 place-items-center rounded-xl text-white" style={{ background: 'linear-gradient(135deg,#7657ff,#d946ef 55%,#ffb02e)' }}>
          <div className="text-center font-display text-lg font-bold leading-tight">Python bilan<br />birinchi bot</div>
        </div>
        <div className="mt-2.5 flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1 font-semibold"><Heart size={17} className="heart-beat fill-pink-500 text-pink-500" />{fmtNum(likes)}</span>
          <span className="flex items-center gap-1 text-slate-500"><MessageCircle size={16} />86</span><Send size={16} className="ml-auto text-slate-400" />
        </div>
      </div>

      <div className="card absolute left-56 top-0 flex items-center gap-2.5 px-3.5 py-2.5" style={{ animation: 'float-b 6s ease-in-out infinite' }}>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500 text-white"><BadgeCheck size={18} /></span>
        <div><div className="text-sm font-semibold">Tasdiqlandi</div><div className="text-xs text-slate-500">Bugun 18:00 da chiqadi</div></div>
      </div>

      <div className="absolute left-60 top-24 w-64 space-y-2" style={{ animation: 'float-c 8s ease-in-out infinite' }}>
        <div className="card ml-0 w-fit max-w-[14rem] rounded-2xl rounded-bl-md px-3.5 py-2 text-sm"><span className="text-xs font-semibold text-slate-500">ali_dev</span><br />Kursingiz narxi qancha?</div>
        <div className="ml-6 w-fit rounded-2xl rounded-br-md bg-gradient-to-br from-brand-600 to-fuchsia-500 px-3.5 py-2 text-sm text-white shadow-lg shadow-brand-600/30">
          <span className="mb-0.5 flex items-center gap-1 text-xs font-medium text-white/80"><Sparkles size={12} />AI javob tayyorladi</span>
          <span className="inline-flex gap-1 py-1">{[0, 1, 2].map((i) => <i key={i} className="h-1.5 w-1.5 rounded-full bg-white" style={{ animation: `type-dot 1.2s ${i * 0.18}s infinite` }} />)}</span>
        </div>
      </div>
    </div>
  )
}

export default function Login() {
  const qc = useQueryClient()
  const [f, setF] = useState({ username: '', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { await post('/api/login/', f); await qc.invalidateQueries({ queryKey: ['session'] }) } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  return (
    <div className="relative z-10 grid min-h-full lg:grid-cols-[1.15fr_1fr]">
      <section className="flex flex-col justify-center px-6 pb-4 pt-10 sm:px-12 lg:py-12 xl:px-20">
        <div className="flex items-center gap-3"><Logo size={42} /><span className="font-display text-2xl font-bold tracking-tight">SMM Agent</span></div>
        <h1 className="mt-10 max-w-xl text-[clamp(2.2rem,4.6vw,3.9rem)] font-bold leading-[1.04]">Kontentni rejalang, tasdiqlang. Qolganini tizim qiladi.</h1>
        <p className="mt-5 max-w-md text-[1.05rem] leading-relaxed text-slate-600">Telegram, Instagram va YouTube uchun g'oya, matn va ssenariyni AI tayyorlaydi. Siz tasdiqlamaguncha hech narsa e'lon qilinmaydi.</p>
        <LiveMock />
      </section>
      <section className="grid place-items-center px-6 pb-12 pt-4 lg:p-12">
        <form onSubmit={submit} className="card pop-in w-full max-w-sm space-y-4 p-8">
          <div><h2 className="text-2xl font-bold">Qaytganingiz bilan</h2><p className="mt-1 text-sm text-slate-500">Panelga kirish uchun login va parolni kiriting.</p></div>
          {err && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}
          <Field label="Login"><Input autoFocus autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
          <Field label="Parol"><Input type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <Button className="w-full" icon={LogIn} loading={busy}>Kirish</Button>
        </form>
      </section>
    </div>
  )
}
