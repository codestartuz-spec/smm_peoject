import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, CloudUpload, Film, Search } from 'lucide-react'
import { get, uploadForm } from '../lib/api'
import { Button, Empty, ErrorBox, Input, Spinner, useToast, cx } from './ui'
import { fmtSize } from '../lib/meta'

export const useLibrary = (slug, params = '') =>
  useQuery({ queryKey: ['library', slug, params], queryFn: () => get(`/api/businesses/${slug}/library/${params}`) })

/** Fayl yuklash maydoni: R2 kutubxonasiga. */
export function Uploader({ slug, maxMb = 100, compact = false, onDone }) {
  const toast = useToast()
  const qc = useQueryClient()
  const ref = useRef()
  const [pct, setPct] = useState(null)
  const [over, setOver] = useState(false)
  const send = async (files) => {
    if (!files?.length) return
    const fd = new FormData()
    ;[...files].forEach((f) => fd.append('files', f))
    setPct(0)
    try {
      const r = await uploadForm(`/api/businesses/${slug}/library/`, fd, setPct)
      r.errors?.forEach((e) => toast.error(e))
      if (r.assets.length) toast.success(r.message)
      qc.invalidateQueries({ queryKey: ['library', slug] })
      onDone?.(r.assets)
    } catch (e) { toast.error(e.message) } finally { setPct(null) }
  }
  return (
    <div onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer.files) }}
      className={cx('rounded-2xl border-2 border-dashed text-center transition', compact ? 'p-3' : 'p-6', over ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white')}>
      <input ref={ref} type="file" multiple accept="image/*,video/*" hidden onChange={(e) => { send(e.target.files); e.target.value = '' }} />
      {pct !== null ? (
        <div className="mx-auto max-w-xs py-1"><div className="mb-1 text-sm text-slate-600">Cloudflare R2 ga yuklanmoqda… {pct}%</div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} /></div></div>
      ) : (
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          {!compact && <CloudUpload className="text-brand-600" size={28} />}
          <span className="text-sm text-slate-600">{compact ? 'Yangi fayl yuklash' : 'Rasm yoki videoni shu yerga tashlang'}</span>
          <Button size="sm" variant="secondary" onClick={() => ref.current.click()}>Fayl tanlash</Button>
          {!compact && <span className="text-xs text-slate-400">JPG, PNG, WEBP, GIF, MP4, MOV · bittasi {maxMb} MB gacha</span>}
        </div>
      )}
    </div>
  )
}

export function NotConfigured() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 shrink-0" size={18} />
      <div>Cloudflare R2 hali sozlanmagan, shuning uchun fayl yuklab bo'lmaydi. <Link to="/settings" className="font-semibold underline">Sozlamalar → Cloudflare R2</Link> kartasida bosqichma-bosqich yo'riqnoma bor.</div>
    </div>
  )
}

export function Thumb({ m, className }) {
  return m.kind === 'video'
    ? <div className={cx('relative bg-slate-900', className)}><video src={m.url + '#t=0.5'} preload="metadata" muted className="h-full w-full object-cover" /><Film size={18} className="absolute bottom-1.5 left-1.5 text-white drop-shadow" /></div>
    : <img src={m.url} alt={m.name} loading="lazy" className={cx('bg-slate-100 object-cover', className)} />
}

/** Postga biriktirish uchun tanlash oynasi (faqat R2 kutubxonasi). */
export function PickerBody({ slug, attached = [], onPick, busy }) {
  const [kind, setKind] = useState('')
  const [sel, setSel] = useState([])
  const { data, isLoading, error } = useLibrary(slug, kind ? `?kind=${kind}` : '')
  const free = (data?.assets || []).filter((a) => !attached.includes(a.id))
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  if (isLoading) return <Spinner />
  if (error) return <ErrorBox error={error} />
  return (
    <div className="space-y-3">
      {!data.configured ? <NotConfigured /> : <Uploader slug={slug} maxMb={data.max_upload_mb} compact onDone={(a) => setSel((s) => [...s, ...a.map((x) => x.id)])} />}
      <div className="flex gap-1.5">{[['', 'Hammasi'], ['image', 'Rasmlar'], ['video', 'Videolar']].map(([k, l]) => (
        <button key={k} onClick={() => setKind(k)} className={cx('rounded-full px-3 py-1 text-xs', kind === k ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600')}>{l}</button>))}</div>
      {free.length === 0 ? <Empty title="Tanlash uchun fayl yo'q" text="Yuqoridan fayl yuklang — u Cloudflare R2 omboriga tushadi." /> : (
        <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {free.map((m) => (
            <button key={m.id} onClick={() => toggle(m.id)} className={cx('relative aspect-square overflow-hidden rounded-xl ring-2 transition', sel.includes(m.id) ? 'ring-brand-600' : 'ring-transparent')}>
              <Thumb m={m} className="h-full w-full" />
              {sel.includes(m.id) && <span className="absolute right-1 top-1 rounded-full bg-brand-600 p-1 text-white"><Check size={12} /></span>}
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-left text-[10px] text-white">{m.name}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between border-t pt-3">
        <span className="text-xs text-slate-500">{sel.length} ta tanlandi</span>
        <Button icon={Check} disabled={!sel.length} loading={busy} onClick={() => onPick(sel)}>Postga qo'shish</Button>
      </div>
    </div>
  )
}
