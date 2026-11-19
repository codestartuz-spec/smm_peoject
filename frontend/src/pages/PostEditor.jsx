import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ImagePlus, Rocket, Save, Send, Sparkles, Trash2, X } from 'lucide-react'
import { PickerBody, Thumb } from '../components/Library'
import { api, del, get, post, put } from '../lib/api'
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PlatformBadge, Select, Spinner, StatusBadge, Textarea, useToast, cx } from '../components/ui'
import { KIND, PLATFORM, fmtDate, toLocalInput } from '../lib/meta'

const LIMITS = { telegram: 4096, instagram: 2200, youtube: 5000, facebook: 63206, tiktok: 2200, linkedin: 3000 }

function hydrate(post, channels) {
  const byCh = Object.fromEntries(post.variants.map((v) => [v.channel_id, v]))
  return {
    title: post.title, kind: post.kind, brief: post.brief, script: post.script || {},
    scheduled_at: toLocalInput(post.scheduled_at), pillar_id: post.pillar_id || '', series_id: post.series_id || '',
    variants: Object.fromEntries(channels.map((c) => [c.id, { on: !!byCh[c.id], caption: byCh[c.id]?.caption || '', hashtags: byCh[c.id]?.hashtags || '', status: byCh[c.id]?.status, url: byCh[c.id]?.url, error: byCh[c.id]?.error }])),
  }
}

export default function PostEditor() {
  const { id } = useParams()
  const { business, slug } = useOutletContext()
  const nav = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const [picker, setPicker] = useState(false)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState('')
  const [dirty, setDirty] = useState(false)
  const [rawScript, setRawScript] = useState(null)

  const pq = useQuery({ queryKey: ['post', id], queryFn: () => get(`/api/posts/${id}/`) })
  const cq = useQuery({ queryKey: ['channels', slug], queryFn: () => get(`/api/businesses/${slug}/channels/`) })
  const sq = useQuery({ queryKey: ['series', slug], queryFn: () => get(`/api/businesses/${slug}/series/`) })
  const channels = cq.data?.channels || []
  const post_ = pq.data?.post

  useEffect(() => { if (post_ && cq.data) { setForm(hydrate(post_, channels)); setDirty(false); setRawScript(null) } /* eslint-disable-next-line */ }, [post_?.id, pq.dataUpdatedAt, cq.dataUpdatedAt])

  if (pq.isLoading || cq.isLoading || !form) return pq.error ? <ErrorBox error={pq.error} /> : <Spinner />
  const locked = post_.status === 'published'
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setDirty(true) }
  const setVar = (cid, patch) => { setForm((f) => ({ ...f, variants: { ...f.variants, [cid]: { ...f.variants[cid], ...patch } } })); setDirty(true) }

  const payload = () => ({
    title: form.title, kind: form.kind, brief: form.brief, script: form.script, pillar_id: form.pillar_id || null, series_id: form.series_id || null,
    scheduled_at: form.scheduled_at || null,
    variants: Object.entries(form.variants).filter(([, v]) => v.on).map(([cid, v]) => ({ channel_id: Number(cid), caption: v.caption, hashtags: v.hashtags })),
  })
  const refresh = (p) => { qc.setQueryData(['post', id], { post: p }); qc.invalidateQueries({ queryKey: ['posts', slug] }); qc.invalidateQueries({ queryKey: ['overview', slug] }); qc.invalidateQueries({ queryKey: ['businesses'] }) }
  const run = async (name, fn, okMsg) => {
    setBusy(name)
    try { const r = await fn(); if (r?.post) refresh(r.post); const m = okMsg || r?.message; if (m) toast.success(m); return r } catch (e) { toast.error(e.message); if (e.data?.post) refresh(e.data.post) } finally { setBusy('') }
  }
  const save = () => run('save', async () => { const r = await put(`/api/posts/${id}/`, payload()); setDirty(false); return r }, 'Saqlandi')
  const action = (a, msg) => run(a, async () => { if (dirty && !locked) await put(`/api/posts/${id}/`, payload()); return post(`/api/posts/${id}/${a}/`) }, msg)
  const attach = (ids) => run('upload', () => post(`/api/posts/${id}/media/`, { asset_ids: ids }), 'Fayllar postga qo\'shildi').then(() => setPicker(false))
  const removeMedia = (mid) => run('media', () => del(`/api/posts/${id}/media/${mid}/`))
  const remove = async () => { if (!confirm("Post o'chirilsinmi?")) return; await run('del', () => del(`/api/posts/${id}/`)); qc.invalidateQueries({ queryKey: ['posts', slug] }); nav(`/b/${slug}/posts`) }

  const st = post_.status
  const sc = form.script
  const firstOn = channels.find((c) => form.variants[c.id]?.on)
  const firstImg = post_.media.find((m) => m.kind === 'image')
  const hasAnyScript = ['scenes', 'slides', 'frames'].some((k) => sc[k]?.length) || sc.hook || sc.image_prompt

  return (
    <div className="fade-up pb-24">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => nav(`/b/${slug}/posts`)}>Postlar</Button>
        <StatusBadge status={st} />
        {post_.series_name && <Badge className="bg-indigo-50 text-indigo-700">Seriya: {post_.series_name}{post_.part_no ? ` · ${post_.part_no}-qism` : ''}</Badge>}
        {post_.ai_generated && <Badge className="bg-fuchsia-50 text-fuchsia-700">AI yaratgan</Badge>}
        {dirty && <Badge className="bg-amber-100 text-amber-800">Saqlanmagan o'zgarishlar</Badge>}
        <Button variant="ghost" size="sm" icon={Trash2} className="ml-auto text-red-600" onClick={remove}>O'chirish</Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card className="space-y-4 p-5">
            <Input value={form.title} onChange={(e) => set({ title: e.target.value })} disabled={locked} className="!text-lg font-semibold" placeholder="Post sarlavhasi / g'oyasi" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Format"><Select value={form.kind} onChange={(e) => set({ kind: e.target.value })} disabled={locked}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}</Select></Field>
              <Field label="Kontent ustuni"><Select value={form.pillar_id} onChange={(e) => set({ pillar_id: e.target.value })} disabled={locked}><option value="">—</option>{business.pillars.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
              <Field label="Seriya"><Select value={form.series_id} onChange={(e) => set({ series_id: e.target.value })} disabled={locked}><option value="">—</option>{(sq.data?.series || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
              <Field label="Chiqish vaqti"><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => set({ scheduled_at: e.target.value })} disabled={locked} /></Field>
            </div>
            <Field label="Qisqacha mazmun"><Textarea rows={3} value={form.brief} onChange={(e) => set({ brief: e.target.value })} disabled={locked} /></Field>
          </Card>

          <div className="space-y-3">
            <h2 className="font-semibold">Qaysi kanallarga chiqadi</h2>
            {channels.length === 0 && <Card className="p-5 text-sm text-slate-500">Avval «Kanallar» bo'limida kanal ulang.</Card>}
            {channels.map((c) => {
              const v = form.variants[c.id]; const lim = LIMITS[c.platform]
              return (
                <Card key={c.id} className={cx('p-4 transition', v.on ? 'ring-2 ring-brand-100' : 'opacity-80')}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={v.on} disabled={locked || v.status === 'published'} onChange={(e) => setVar(c.id, { on: e.target.checked })} />
                    <PlatformBadge platform={c.platform} withName /><span className="text-sm text-slate-500">· {c.name}</span>
                    {v.status === 'published' && <a href={v.url} target="_blank" rel="noreferrer" className="ml-auto text-sm text-emerald-700 underline">✓ e'lon qilingan</a>}
                    {v.status === 'failed' && <Badge className="ml-auto bg-red-100 text-red-700">xato</Badge>}
                  </label>
                  {v.on && (
                    <div className="mt-3 space-y-2">
                      <Textarea rows={6} value={v.caption} onChange={(e) => setVar(c.id, { caption: e.target.value })} disabled={locked || v.status === 'published'} placeholder="Matn (caption)" />
                      <div className="flex items-center gap-2">
                        <Input value={v.hashtags} onChange={(e) => setVar(c.id, { hashtags: e.target.value })} disabled={locked || v.status === 'published'} placeholder="#hashtaglar" />
                        <span className={cx('whitespace-nowrap text-xs', (v.caption.length + v.hashtags.length) > lim ? 'text-red-600' : 'text-slate-400')}>{v.caption.length + v.hashtags.length}/{lim}</span>
                      </div>
                      {v.error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{v.error}</div>}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Media</h2>
              <Button size="sm" variant="secondary" icon={ImagePlus} disabled={locked} onClick={() => setPicker(true)}>Kutubxonadan tanlash</Button></div>
            <div className="grid grid-cols-3 gap-2 rounded-xl border-2 border-dashed border-slate-200 p-2">
              {post_.media.map((m) => (
                <div key={m.id} className="group relative aspect-square overflow-hidden rounded-lg">
                  <Thumb m={m} className="h-full w-full" />
                  {!locked && <button onClick={() => removeMedia(m.id)} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"><X size={12} /></button>}
                </div>
              ))}
              {post_.media.length === 0 && <div className="col-span-3 py-6 text-center text-xs text-slate-400">Fayl biriktirilmagan. Fayllar faqat Cloudflare R2 kutubxonasidan olinadi.</div>}
            </div>
            <p className="mt-2 text-xs text-slate-500">Yangi fayl kerak bo'lsa, «Media» bo'limiga yoki tanlash oynasiga yuklang.</p>
            <Modal open={picker} onClose={() => setPicker(false)} title="Media kutubxonasi" width="max-w-2xl"><PickerBody slug={slug} attached={post_.media.map((m) => m.id)} onPick={attach} busy={busy === 'upload'} /></Modal>
          </Card>

          {firstOn && (
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">Ko'rinishi (preview)</h2>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2 border-b bg-white p-2.5"><PlatformBadge platform={firstOn.platform} size={24} /><span className="text-sm font-semibold">{firstOn.name}</span></div>
                {firstImg && <img src={firstImg.url} alt="" className="max-h-64 w-full object-cover" />}
                <div className="whitespace-pre-line p-3 text-sm">{(form.variants[firstOn.id].caption || 'Matn bu yerda ko\'rinadi…').slice(0, 400)}<div className="mt-1 text-sky-600">{form.variants[firstOn.id].hashtags}</div></div>
              </div>
            </Card>
          )}

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">🎬 Ssenariy / dizayn rejasi</h2>
              <Button size="sm" variant="ai" icon={Sparkles} loading={busy === 'ai'} disabled={locked} onClick={() => action('ai', "AI matn va ssenariyni tayyorladi. Ko'rib chiqing va tasdiqlang.")}>AI yozsin</Button></div>
            {!hasAnyScript && <p className="py-4 text-center text-sm text-slate-400">Hali ssenariy yo'q. «AI yozsin» tugmasi matn va to'liq ishlab chiqarish rejasini yaratadi.</p>}
            <Script sc={sc} />
            <details className="mt-3"><summary className="cursor-pointer text-xs text-slate-500">JSON ni tahrirlash</summary>
              <Textarea rows={10} className="mt-2 font-mono text-xs" value={rawScript ?? JSON.stringify(sc, null, 2)} onChange={(e) => { setRawScript(e.target.value); try { set({ script: JSON.parse(e.target.value) }) } catch { /* yozilmoqda */ } }} />
            </details>
          </Card>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 px-4 py-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2">
          <span className="mr-auto text-xs text-slate-500">{post_.scheduled_at ? `Chiqish: ${fmtDate(post_.scheduled_at)}` : 'Vaqt belgilanmagan (tasdiqlansa hoziroq chiqadi)'}</span>
          {!locked && <Button variant="secondary" icon={Save} loading={busy === 'save'} onClick={save}>Saqlash</Button>}
          {['draft', 'idea', 'rejected', 'failed'].includes(st) && <Button variant="warn" icon={Send} loading={busy === 'submit'} onClick={() => action('submit')}>Tasdiqlashga yuborish</Button>}
          {['pending', 'draft', 'failed', 'idea', 'rejected'].includes(st) && <Button icon={Check} loading={busy === 'approve'} onClick={() => action('approve')}>Tasdiqlash</Button>}
          {st === 'pending' && <Button variant="secondary" loading={busy === 'reject'} onClick={() => action('reject')}>Rad etish</Button>}
          {st === 'approved' && <><Button variant="secondary" loading={busy === 'reopen'} onClick={() => action('reopen')}>Qoralamaga qaytarish</Button><Button variant="success" icon={Rocket} loading={busy === 'publish_now'} onClick={() => action('publish_now')}>Hoziroq e'lon qilish</Button></>}
        </div>
      </div>
    </div>
  )
}

function Script({ sc }) {
  const Row = ({ k, v }) => v ? <div className="text-sm"><b className="text-slate-700">{k}:</b> <span className="text-slate-600">{v}</span></div> : null
  return (
    <div className="space-y-3">
      <Row k="Hook" v={sc.hook} /><Row k="Rasm tavsifi" v={sc.image_prompt} />
      {sc.scenes?.length > 0 && <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Sahnalar</div>
        <div className="space-y-2">{sc.scenes.map((s, i) => (
          <div key={i} className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm"><span className="h-fit rounded-md bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">{s.time}</span>
            <div className="space-y-0.5"><div>🎥 {s.visual}</div>{s.voiceover && <div className="italic text-slate-600">🎙 {s.voiceover}</div>}{s.on_screen_text && <div className="text-slate-600">📝 {s.on_screen_text}</div>}</div></div>))}</div></div>}
      {sc.slides?.length > 0 && <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Karusel slaydlari</div>
        <div className="space-y-2">{sc.slides.map((s, i) => (
          <div key={i} className="rounded-xl border border-pink-100 bg-pink-50/50 p-3 text-sm"><div className="font-semibold">{i + 1}. {s.title}</div><div>{s.text}</div><div className="mt-1 text-xs text-slate-500">🖼 {s.visual}</div></div>))}</div></div>}
      {sc.frames?.length > 0 && <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Story kadrlari</div>
        <div className="space-y-2">{sc.frames.map((s, i) => (
          <div key={i} className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-sm"><b>{i + 1}.</b> {s.visual}{s.text && <div className="text-slate-600">📝 {s.text}</div>}{s.sticker && <div className="text-xs text-slate-500">Stiker: {s.sticker}</div>}</div>))}</div></div>}
      <Row k="CTA" v={sc.cta} /><Row k="Musiqa" v={sc.music} /><Row k="Thumbnail" v={sc.thumbnail} /><Row k="Suratga olish" v={sc.shooting_tips} /><Row k="Keyingi qismga ishora" v={sc.teaser} />
    </div>
  )
}
