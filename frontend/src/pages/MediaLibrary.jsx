import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Copy, Images, Trash2, X } from 'lucide-react'
import { del } from '../lib/api'
import { Button, Card, Empty, ErrorBox, Input, Spinner, useToast, cx } from '../components/ui'
import { useAct } from '../components/hooks'
import { NotConfigured, Thumb, Uploader, useLibrary } from '../components/Library'
import { fmtDate, fmtSize } from '../lib/meta'

export default function MediaLibrary() {
  const { slug } = useOutletContext()
  const toast = useToast()
  const [kind, setKind] = useState('')
  const [q, setQ] = useState('')
  const [view, setView] = useState(null)
  const params = `?${new URLSearchParams({ ...(kind && { kind }), ...(q && { q }) })}`
  const { data, isLoading, error } = useLibrary(slug, params)
  const remove = useAct((id) => del(`/api/media/${id}/`), { invalidate: [['library', slug]], onSuccess: () => setView(null) })
  if (isLoading) return <Spinner />
  if (error) return <ErrorBox error={error} />
  const copy = (t) => { navigator.clipboard?.writeText(t); toast.success('Havola nusxalandi') }
  return (
    <div className="fade-up space-y-4">
      {!data.configured ? <NotConfigured /> : <Uploader slug={slug} maxMb={data.max_upload_mb} />}
      <div className="flex flex-wrap items-center gap-2">
        {[['', 'Hammasi'], ['image', 'Rasmlar'], ['video', 'Videolar']].map(([k, l]) => (
          <button key={k} onClick={() => setKind(k)} className={cx('rounded-full px-3.5 py-1.5 text-sm', kind === k ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200')}>{l}</button>))}
        <Input className="!w-full sm:!ml-auto sm:!w-60" placeholder="Fayl nomi bo'yicha qidirish…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="text-xs text-slate-500">{data.assets.length} ta fayl · jami {fmtSize(data.total_size)} · Cloudflare R2 (bepul 10 GB)</div>
      {data.assets.length === 0 ? <Empty icon={Images} title="Kutubxona bo'sh" text="Postlar uchun rasm va videolar faqat shu yerdan olinadi." /> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data.assets.map((m) => (
            <Card key={m.id} className="group overflow-hidden">
              <button onClick={() => setView(m)} className="block aspect-square w-full"><Thumb m={m} className="h-full w-full" /></button>
              <div className="p-2.5">
                <div className="truncate text-sm font-medium" title={m.name}>{m.name}</div>
                <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-500"><span>{fmtSize(m.size)}</span><span>{fmtDate(m.created_at, false)}</span></div>
                <div className="mt-2 flex items-center gap-1">
                  {m.used > 0 && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">{m.used} postda</span>}
                  <button onClick={() => copy(m.url)} title="Havolani nusxalash" className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><Copy size={15} /></button>
                  <button onClick={() => confirm(`«${m.name}» R2 dan butunlay o'chirilsinmi?`) && remove.mutate(m.id)} title="O'chirish" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {view && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setView(null)}>
          <button className="absolute right-4 top-4 text-white"><X /></button>
          <div onClick={(e) => e.stopPropagation()} className="max-h-full max-w-4xl">
            {view.kind === 'video' ? <video src={view.url} controls autoPlay className="max-h-[80vh] rounded-xl" /> : <img src={view.url} alt={view.name} className="max-h-[80vh] rounded-xl" />}
            <div className="mt-3 flex items-center justify-between gap-3 text-sm text-white"><span className="truncate">{view.name} · {fmtSize(view.size)}</span>
              <Button size="sm" variant="secondary" icon={Copy} onClick={() => copy(view.url)}>Havola</Button></div>
          </div>
        </div>
      )}
    </div>
  )
}
