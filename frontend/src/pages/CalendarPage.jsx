import { useMemo } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import { put, post, get } from '../lib/api'
import { Card, ErrorBox, Spinner, useToast } from '../components/ui'
import { KIND, STATUS } from '../lib/meta'

export default function CalendarPage() {
  const { slug } = useOutletContext()
  const nav = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { data, isLoading, error } = useQuery({ queryKey: ['posts', slug, 'all'], queryFn: () => get(`/api/businesses/${slug}/posts/`) })
  const events = useMemo(() => (data?.posts || []).filter((p) => p.scheduled_at).map((p) => ({
    id: String(p.id), title: `${KIND[p.kind]?.emoji || ''} ${p.title}`, start: p.scheduled_at,
    backgroundColor: STATUS[p.status]?.color, borderColor: STATUS[p.status]?.color, startEditable: p.status !== 'published',
  })), [data])
  if (isLoading) return <Spinner />
  if (error) return <ErrorBox error={error} />
  const move = async (info) => {
    try { await put(`/api/posts/${info.event.id}/`, { scheduled_at: info.event.start.toISOString() }); qc.invalidateQueries({ queryKey: ['posts', slug] }); toast.success('Sana o\'zgartirildi') }
    catch (e) { info.revert(); toast.error(e.message) }
  }
  const create = async (info) => {
    const d = new Date(info.date); if (info.view.type === 'dayGridMonth') d.setHours(12, 0, 0, 0)
    try { const r = await post(`/api/businesses/${slug}/posts/`, { scheduled_at: d.toISOString() }); nav(`../posts/${r.post.id}`) } catch (e) { toast.error(e.message) }
  }
  return (
    <div className="fade-up space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {Object.entries(STATUS).map(([k, v]) => <span key={k} className="flex items-center gap-1.5 text-slate-600"><i className="inline-block h-2.5 w-2.5 rounded" style={{ background: v.color }} />{v.label}</span>)}
        <span className="ml-auto text-slate-400">Kunni bosing — yangi post · Postni sudrang — sanani o'zgartirish</span>
      </div>
      <Card className="p-4">
        <FullCalendar plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]} initialView="dayGridMonth" firstDay={1} height="auto"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' }}
          buttonText={{ today: 'Bugun', month: 'Oy', week: 'Hafta', list: 'Ro\'yxat' }}
          events={events} editable eventDrop={move} dateClick={create} eventClick={(i) => nav(`../posts/${i.event.id}`)}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }} dayMaxEvents={4} />
      </Card>
    </div>
  )
}
