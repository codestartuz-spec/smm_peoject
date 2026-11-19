import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Brain, Download, MessageCircle, RefreshCw, Send, SkipForward, Target } from 'lucide-react'
import { get, post } from '../lib/api'
import { Badge, Button, Card, Empty, ErrorBox, PlatformBadge, Spinner, Textarea, useToast, cx } from '../components/ui'
import { useAct } from '../components/hooks'
import { SENTIMENT, fmtDate } from '../lib/meta'

const FILTERS = [['suggested', 'Javob kutmoqda'], ['leads', 'Leadlar'], ['questions', 'Savollar'], ['negative', 'Salbiy'], ['all', 'Hammasi']]

export default function Comments() {
  const { slug } = useOutletContext()
  const [f, setF] = useState('suggested')
  const qc = useQueryClient()
  const key = ['comments', slug, f]
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => get(`/api/businesses/${slug}/comments/?f=${f}`) })
  const inv = [['comments', slug], ['overview', slug], ['businesses']]
  const bulk = useAct((action) => post(`/api/businesses/${slug}/comments/action/`, { action }), { invalidate: inv })
  if (error) return <ErrorBox error={error} />
  const sent = data?.sentiment || {}
  const totalS = Object.values(sent).reduce((a, b) => a + b, 0) || 1
  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" icon={Download} loading={bulk.isPending && bulk.variables === 'sync'} onClick={() => bulk.mutate('sync')}>Izohlarni olish</Button>
        <Button variant="ai" icon={Brain} loading={bulk.isPending && bulk.variables === 'analyze'} onClick={() => bulk.mutate('analyze')}>Tahlil + javob qoralamasi</Button>
        <Button variant="secondary" icon={Send} loading={bulk.isPending && bulk.variables === 'digest'} onClick={() => bulk.mutate('digest')}>Xulosani Telegramga</Button>
      </div>
      {data && totalS > 1 && (
        <Card className="p-4"><div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium">Kayfiyat</span>
          <span className="flex gap-3 text-xs">{Object.entries(SENTIMENT).map(([k, v]) => <span key={k}>{v.emoji} {v.label}: <b>{sent[k] || 0}</b></span>)}</span></div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">{Object.entries(SENTIMENT).map(([k, v]) => <div key={k} style={{ width: `${((sent[k] || 0) / totalS) * 100}%`, background: v.color }} />)}</div></Card>
      )}
      {data?.digests?.length > 0 && (
        <Card className="p-4"><details><summary className="cursor-pointer text-sm font-semibold">📝 So'nggi xulosa · <span className="font-normal text-slate-400">{fmtDate(data.digests[0].created_at)}</span></summary>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{data.digests[0].text}</p></details></Card>
      )}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(([k, l]) => <button key={k} onClick={() => setF(k)} className={cx('rounded-full px-3 py-1 text-sm', f === k ? 'bg-brand-600 text-white' : 'border border-slate-200 bg-white text-slate-600')}>{l} {data?.counts?.[k] ?? ''}</button>)}
      </div>
      {isLoading ? <Spinner /> : data.comments.length === 0 ? <Empty icon={MessageCircle} title="Bu bo'limda izoh yo'q" text="«Izohlarni olish» va «Tahlil» tugmalarini bosing." /> : (
        <div className="space-y-3">{data.comments.map((c) => <CommentCard key={c.id} c={c} slug={slug} onDone={() => qc.invalidateQueries({ queryKey: ['comments', slug] })} />)}</div>
      )}
    </div>
  )
}

function CommentCard({ c, slug, onDone }) {
  const [reply, setReply] = useState(c.suggested_reply)
  const toast = useToast()
  const act = useAct((action) => post(`/api/businesses/${slug}/comments/action/`, { action, id: c.id, reply }), {
    onSuccess: (d, a) => { if (a === 'regen') setReply(d.comment.suggested_reply); else toast.success(a === 'send' ? 'Javob yuborildi' : 'Bajarildi'); onDone(); },
  })
  const s = SENTIMENT[c.sentiment]
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm"><PlatformBadge platform={c.platform} size={22} /><b>{c.author || 'anonim'}</b>
        <span className="text-xs text-slate-400">{fmtDate(c.posted_at)}</span>{c.post_title && <span className="truncate text-xs text-slate-400">· {c.post_title.slice(0, 40)}</span>}
        <span className="ml-auto flex items-center gap-1.5">{c.is_lead && <Badge className="bg-emerald-100 text-emerald-700"><Target size={11} />lead</Badge>}{c.is_question && <Badge className="bg-sky-100 text-sky-700">savol</Badge>}
          {s && <span className={cx('text-xs', s.cls)}>{s.emoji} {s.label}</span>}{c.topic && <Badge className="bg-slate-100 text-slate-600">{c.topic}</Badge>}</span></div>
      <p className="my-2.5 text-[15px]">{c.text}</p>
      {c.reply_status === 'suggested' && (
        <div className="flex flex-col gap-2 sm:flex-row"><Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} className="flex-1" />
          <div className="flex gap-2 sm:flex-col"><Button size="sm" variant="success" icon={Send} loading={act.isPending && act.variables === 'send'} onClick={() => act.mutate('send')}>Yuborish</Button>
            <Button size="sm" variant="secondary" icon={RefreshCw} loading={act.isPending && act.variables === 'regen'} onClick={() => act.mutate('regen')}>Qayta yozish</Button>
            <Button size="sm" variant="ghost" icon={SkipForward} onClick={() => act.mutate('skip')}>O'tkazish</Button></div></div>
      )}
      {c.reply_status === 'sent' && <div className="rounded-xl bg-emerald-50 p-2.5 text-sm text-emerald-800">↩ Javob berildi: {c.reply_text}</div>}
    </Card>
  )
}
