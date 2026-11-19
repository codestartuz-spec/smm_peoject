import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, LogOut, Menu, Plus, Settings, UserRound, X } from 'lucide-react'
import { get, post } from '../lib/api'
import { Avatar, Button, Field, Input, Modal, cx } from './ui'
import { AnimIcon, Logo } from './fx'
import { useAct } from './hooks'

export default function Layout({ user, name }) {
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', industry: '' })
  const nav = useNavigate()
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['businesses'], queryFn: () => get('/api/businesses/') })
  const create = useAct(() => post('/api/businesses/', form), {
    success: 'Biznes qo\'shildi. Endi kanallarni ulang.', invalidate: ['businesses'],
    onSuccess: (d) => { setModal(false); setForm({ name: '', industry: '' }); nav(`/b/${d.business.slug}/channels`) },
  })
  const logout = useAct(() => post('/api/logout/'), { onSuccess: () => qc.invalidateQueries({ queryKey: ['session'] }) })

  const link = ({ isActive }) => cx('hov group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors', isActive ? 'bg-white/[.09] font-medium text-white' : 'text-slate-300 hover:bg-white/[.06] hover:text-white')
  const bar = (isActive) => <span className={cx('absolute -left-4 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-amber-300 via-pink-400 to-brand-400 transition-all duration-300', isActive ? 'opacity-100' : 'h-0 opacity-0')} />

  const sidebar = (
    <div className="relative flex h-full flex-col overflow-hidden bg-slate-950 p-4 text-slate-200" style={{ backgroundImage: 'radial-gradient(420px 260px at 0% 0%, rgba(118,87,255,.32), transparent 70%), radial-gradient(380px 300px at 100% 100%, rgba(255,93,125,.2), transparent 70%)' }}>
      <NavLink to="/" className="hov mb-7 flex items-center gap-3 px-2" onClick={() => setOpen(false)}>
        <Logo size={38} />
        <span className="font-display text-xl font-bold tracking-tight text-white">SMM Agent</span>
      </NavLink>
      <NavLink to="/" end className={link} onClick={() => setOpen(false)}>{({ isActive }) => <>{bar(isActive)}<AnimIcon icon={LayoutDashboard} a="flip" />Boshqaruv paneli</>}</NavLink>
      <div className="mb-2 mt-6 flex items-center justify-between px-3 text-xs font-medium text-slate-400">
        Bizneslar
        <button onClick={() => setModal(true)} className="hov grid h-6 w-6 place-items-center rounded-lg bg-white/10 text-slate-200 transition hover:bg-white/20" title="Yangi biznes"><AnimIcon icon={Plus} a="spin" size={14} /></button>
      </div>
      <div className="scroll-thin -mr-2 flex-1 space-y-0.5 overflow-y-auto pr-2">
        {data?.businesses.map((b) => (
          <NavLink key={b.id} to={`/b/${b.slug}`} className={link} onClick={() => setOpen(false)}>
            {({ isActive }) => <>{bar(isActive)}<Avatar name={b.name} size={30} live={b.pending > 0} /><span className="truncate">{b.name}</span>
              {b.pending > 0 && <span className="ml-auto rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-slate-900">{b.pending}</span>}</>}
          </NavLink>
        ))}
        {data && data.businesses.length === 0 && <div className="px-3 text-xs text-slate-400">Hali biznes yo'q</div>}
      </div>
      <div className="mt-4 space-y-0.5 border-t border-white/10 pt-4">
        <NavLink to="/profile" className={link} onClick={() => setOpen(false)}>{({ isActive }) => <>{bar(isActive)}<AnimIcon icon={UserRound} a="bob" />Profil<span className="ml-auto max-w-[90px] truncate text-xs text-slate-500">{name || user}</span></>}</NavLink>
        <NavLink to="/settings" className={link} onClick={() => setOpen(false)}>{({ isActive }) => <>{bar(isActive)}<AnimIcon icon={Settings} a="spin" />Sozlamalar</>}</NavLink>
        <button onClick={() => logout.mutate()} className="hov flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/[.06] hover:text-white">
          <AnimIcon icon={LogOut} a="fly" />Chiqish
        </button>
      </div>
    </div>
  )

  return (
    <div className="relative z-10 flex h-full">
      <aside className="hidden w-64 shrink-0 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64"><button className="absolute right-2 top-2 z-10 text-white" onClick={() => setOpen(false)}><X /></button>{sidebar}</div>
        </div>
      )}
      <main className="scroll-thin h-full min-w-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/60 bg-white/70 px-4 py-2.5 backdrop-blur-xl lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 hover:bg-slate-900/5" aria-label="Menyu"><Menu /></button><Logo size={28} /><span className="font-display font-bold">SMM Agent</span>
        </div>
        <div className="mx-auto max-w-[1400px] p-4 sm:p-6"><Outlet /></div>
      </main>
      <Modal open={modal} onClose={() => setModal(false)} title="Yangi biznes">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate() }}>
          <Field label="Nomi"><Input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Masalan: Elshod | Tech" /></Field>
          <Field label="Soha (ixtiyoriy)"><Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="IT, dasturlash, ta'lim…" /></Field>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={() => setModal(false)}>Bekor qilish</Button><Button loading={create.isPending}>Qo'shish</Button></div>
        </form>
      </Modal>
    </div>
  )
}
