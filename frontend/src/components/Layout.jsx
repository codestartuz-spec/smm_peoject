import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, LogOut, Megaphone, Menu, Plus, Settings, UserRound, X } from 'lucide-react'
import { get, post } from '../lib/api'
import { Avatar, Button, Field, Input, Modal, cx } from './ui'
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

  const link = ({ isActive }) => cx('flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition', isActive ? 'bg-white/10 text-white font-medium' : 'text-slate-300 hover:bg-white/5 hover:text-white')

  const sidebar = (
    <div className="flex h-full flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 p-4 text-slate-200">
      <NavLink to="/" className="mb-6 flex items-center gap-2.5 px-2" onClick={() => setOpen(false)}>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white"><Megaphone size={18} /></span>
        <span className="text-lg font-bold text-white">SMM Agent</span>
      </NavLink>
      <NavLink to="/" end className={link} onClick={() => setOpen(false)}><LayoutDashboard size={17} />Boshqaruv paneli</NavLink>
      <div className="mt-6 mb-2 flex items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Bizneslar
        <button onClick={() => setModal(true)} className="rounded-md p-1 hover:bg-white/10" title="Yangi biznes"><Plus size={14} /></button>
      </div>
      <div className="scroll-thin -mr-2 flex-1 space-y-0.5 overflow-y-auto pr-2">
        {data?.businesses.map((b) => (
          <NavLink key={b.id} to={`/b/${b.slug}`} className={link} onClick={() => setOpen(false)}>
            <Avatar name={b.name} size={26} /><span className="truncate">{b.name}</span>
            {b.pending > 0 && <span className="ml-auto rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-slate-900">{b.pending}</span>}
          </NavLink>
        ))}
        {data && data.businesses.length === 0 && <div className="px-3 text-xs text-slate-400">Hali biznes yo'q</div>}
      </div>
      <div className="mt-4 space-y-0.5 border-t border-white/10 pt-4">
        <NavLink to="/profile" className={link} onClick={() => setOpen(false)}><UserRound size={17} />Profil<span className="ml-auto max-w-[90px] truncate text-xs text-slate-500">{name || user}</span></NavLink>
        <NavLink to="/settings" className={link} onClick={() => setOpen(false)}><Settings size={17} />Sozlamalar</NavLink>
        <button onClick={() => logout.mutate()} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
          <LogOut size={17} />Chiqish
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64"><button className="absolute right-2 top-2 z-10 text-white" onClick={() => setOpen(false)}><X /></button>{sidebar}</div>
        </div>
      )}
      <main className="scroll-thin h-full min-w-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)}><Menu /></button><span className="font-semibold">SMM Agent</span>
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
