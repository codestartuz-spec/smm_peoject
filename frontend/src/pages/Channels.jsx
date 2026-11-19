import { useEffect, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ExternalLink, Plug, Plus, Trash2, Zap } from 'lucide-react'
import { del, get, post } from '../lib/api'
import { Button, Card, Empty, ErrorBox, Field, Input, PlatformBadge, Spinner, useToast, cx } from '../components/ui'
import { useAct } from '../components/hooks'
import { PLATFORM, fmtNum } from '../lib/meta'

const GUIDE = {
  telegram: { token: 'Bot token (@BotFather)', ext: 'Kanal: @username yoki -100…', note: "Botni kanalga administrator qiling. Izohlarni o'qish uchun botni muhokama guruhiga ham qo'shing.", disc: true },
  instagram: { token: 'Access token (uzoq muddatli)', ext: "Instagram user ID (bo'sh qolsa avtomatik topiladi)", note: "Business/Creator akkaunt Facebook Page'ga ulangan bo'lishi kerak. Media uchun Sozlamalarda ochiq manzil kerak." },
  youtube: { token: null, ext: 'Kanal ID (ixtiyoriy)', note: "Qo'shgach «Google bilan ulash» tugmasini bosing. Sozlamalarda Client ID/Secret kiritilgan bo'lishi kerak." },
  facebook: { token: 'Page access token', ext: 'Page ID', note: 'Facebook sahifasi uchun uzoq muddatli page token kerak.' },
  tiktok: { token: 'Access token', ext: '', note: 'Keyingi bosqichda ishga tushadi (adapter tayyor).' },
  linkedin: { token: 'Access token', ext: '', note: 'Keyingi bosqichda ishga tushadi (adapter tayyor).' },
}

export default function Channels() {
  const { slug } = useOutletContext()
  const toast = useToast()
  const [sp, setSp] = useSearchParams()
  const [f, setF] = useState({ platform: 'telegram', name: '', external_id: '', token: '', discussion: '' })
  const { data, isLoading, error } = useQuery({ queryKey: ['channels', slug], queryFn: () => get(`/api/businesses/${slug}/channels/`) })
  const inv = [['channels', slug], ['overview', slug], ['business', slug], ['businesses']]
  const add = useAct(() => post(`/api/businesses/${slug}/channels/`, f), { invalidate: inv, onSuccess: () => setF({ ...f, name: '', external_id: '', token: '', discussion: '' }) })
  const test = useAct((id) => post(`/api/channels/${id}/test/`), { invalidate: inv })
  const remove = useAct((id) => del(`/api/channels/${id}/`), { success: "Kanal o'chirildi", invalidate: inv })

  useEffect(() => {
    const g = sp.get('google'); if (!g) return
    const m = { ok: ['success', 'YouTube muvaffaqiyatli ulandi ✓'], denied: ['error', 'Google ruxsat berilmadi'], error: ['error', 'Google token olinmadi'], nokey: ['error', 'Sozlamalarda Google Client ID/Secret kiritilmagan'] }[g]
    if (m) toast[m[0]](m[1]); setSp({}, { replace: true })
  }, []) // eslint-disable-line

  const g = GUIDE[f.platform]
  return (
    <div className="fade-up grid gap-5 lg:grid-cols-5">
      <div className="space-y-3 lg:col-span-3">
        <h2 className="font-semibold">Ulangan kanallar</h2>
        {isLoading ? <Spinner /> : error ? <ErrorBox error={error} /> : data.channels.length === 0 ? <Empty icon={Plug} title="Hali kanal ulanmagan" text="O'ng tomondagi shakldan birinchi kanalni qo'shing." /> :
          data.channels.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-center gap-3"><PlatformBadge platform={c.platform} size={36} />
                <div className="min-w-0 flex-1"><div className="truncate font-semibold">{c.name}</div><div className="truncate text-xs text-slate-500">{PLATFORM[c.platform]?.label} · ID: {c.external_id || '—'}</div></div>
                <div className="text-right"><div className="text-lg font-bold">{fmtNum(c.followers)}</div><div className="text-[11px] text-slate-500">obunachi</div></div></div>
              <div className="mt-2 text-xs">{c.last_error ? <span className="flex gap-1.5 text-red-600"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{c.last_error.slice(0, 200)}</span> : c.has_credentials ? <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={13} />Kalit kiritilgan</span> : <span className="text-amber-600">Kalit kiritilmagan</span>}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={Zap} loading={test.isPending && test.variables === c.id} onClick={() => test.mutate(c.id)}>Tekshirish</Button>
                {c.platform === 'youtube' && <a href={`/oauth/google/start/${c.id}/`}><Button size="sm" icon={ExternalLink} className="!bg-red-600 hover:!bg-red-700">Google bilan ulash</Button></a>}
                <Button size="sm" variant="danger" icon={Trash2} className="ml-auto" onClick={() => confirm(`«${c.name}» o'chirilsinmi?`) && remove.mutate(c.id)}>O'chirish</Button>
              </div>
            </Card>
          ))}
      </div>
      <Card className="h-fit space-y-4 p-5 lg:col-span-2">
        <h2 className="font-semibold">Kanal qo'shish</h2>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(PLATFORM).map(([k, v]) => (
            <button key={k} onClick={() => setF({ ...f, platform: k })} className={cx('flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs transition', f.platform === k ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 hover:bg-slate-50')}>
              <PlatformBadge platform={k} size={30} />{v.label}</button>
          ))}
        </div>
        <Field label="Nomi"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Masalan: Elshod Tech kanali" /></Field>
        {g.ext !== '' && <Field label="Kanal / akkaunt ID"><Input value={f.external_id} onChange={(e) => setF({ ...f, external_id: e.target.value })} placeholder={g.ext} /></Field>}
        {g.token && <Field label={g.token}><Input type="password" autoComplete="new-password" value={f.token} onChange={(e) => setF({ ...f, token: e.target.value })} /></Field>}
        {g.disc && <Field label="Muhokama guruhi ID (ixtiyoriy)" hint="Izohlarni o'qish uchun"><Input value={f.discussion} onChange={(e) => setF({ ...f, discussion: e.target.value })} placeholder="-100…" /></Field>}
        <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{g.note}</p>
        <Button className="w-full" icon={Plus} loading={add.isPending} disabled={!f.name.trim()} onClick={() => add.mutate()}>Qo'shish</Button>
        <p className="text-xs text-slate-400">Tokenlar bazada shifrlangan holda saqlanadi.</p>
      </Card>
    </div>
  )
}
