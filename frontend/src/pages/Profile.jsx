import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Save, UserRound } from 'lucide-react'
import { get, post, put } from '../lib/api'
import { Avatar, Button, Card, ErrorBox, Field, Input, Spinner } from '../components/ui'
import { useAct } from '../components/hooks'
import { fmtDate } from '../lib/meta'

export default function Profile() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['profile'], queryFn: () => get('/api/profile/') })
  const [f, setF] = useState(null)
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm_password: '' })
  useEffect(() => { if (data) setF(data.profile) }, [data])
  const save = useAct(() => put('/api/profile/', f), { success: "Ma'lumotlar saqlandi", invalidate: ['profile', 'session'] })
  const change = useAct(() => post('/api/profile/password/', pw), { onSuccess: () => setPw({ current_password: '', new_password: '', confirm_password: '' }) })
  if (isLoading || !f) return <Spinner />
  if (error) return <ErrorBox error={error} />
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const mismatch = pw.confirm_password && pw.new_password !== pw.confirm_password
  return (
    <div className="fade-up mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={f.first_name || f.username} size={56} />
        <div><h1 className="text-2xl font-bold">Profil</h1>
          <p className="text-sm text-slate-500">Oxirgi kirish: {fmtDate(data.profile.last_login)} · ro'yxatdan o'tgan: {fmtDate(data.profile.date_joined, false)}</p></div>
      </div>
      <Card className="space-y-4 p-5">
        <h2 className="flex items-center gap-2 font-semibold"><UserRound size={18} className="text-brand-600" />Shaxsiy ma'lumotlar</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ism"><Input value={f.first_name} onChange={set('first_name')} /></Field>
          <Field label="Familiya"><Input value={f.last_name} onChange={set('last_name')} /></Field>
          <Field label="Login" hint="Tizimga kirish uchun"><Input value={f.username} onChange={set('username')} autoComplete="username" /></Field>
          <Field label="Email"><Input type="email" value={f.email} onChange={set('email')} /></Field>
        </div>
        <Button icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Saqlash</Button>
      </Card>
      <Card className="space-y-4 p-5">
        <h2 className="flex items-center gap-2 font-semibold"><KeyRound size={18} className="text-brand-600" />Parolni yangilash</h2>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); change.mutate() }}>
          <input type="text" name="username" autoComplete="username" value={f.username} readOnly hidden />
          <Field label="Joriy parol"><Input type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Yangi parol" hint="Kamida 8 belgi"><Input type="password" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></Field>
            <Field label="Yangi parolni tasdiqlang" hint={mismatch ? <span className="text-red-600">Parollar mos emas</span> : null}><Input type="password" autoComplete="new-password" value={pw.confirm_password} onChange={(e) => setPw({ ...pw, confirm_password: e.target.value })} /></Field>
          </div>
          <Button type="submit" icon={KeyRound} loading={change.isPending} disabled={!pw.current_password || pw.new_password.length < 8 || mismatch}>Parolni o'zgartirish</Button>
        </form>
      </Card>
    </div>
  )
}
