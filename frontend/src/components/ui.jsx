import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Loader2, X, XCircle, Info } from 'lucide-react'
import { PLATFORM, STATUS } from '../lib/meta'
import { cx } from '../lib/cx'
import { AnimIcon, CountUp, RingAvatar } from './fx'

export { cx }

const VARIANTS = {
  primary: 'btn-primary text-white',
  secondary: 'bg-white/90 text-slate-700 border border-slate-200 hover:bg-white hover:border-brand-200 hover:text-brand-700',
  ghost: 'text-slate-600 hover:bg-slate-900/5',
  danger: 'bg-red-50 text-red-700 hover:bg-red-100',
  success: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/30 hover:brightness-105',
  warn: 'bg-amber-500 text-white hover:bg-amber-600',
  ai: 'btn-ai text-white',
}

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, children, className, ...p }) {
  return (
    <button
      {...p}
      disabled={p.disabled || loading}
      className={cx(
        'btn hov inline-flex items-center justify-center gap-2 rounded-xl font-medium disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        VARIANTS[variant], className,
      )}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : Icon ? <AnimIcon icon={Icon} a={variant === 'ai' ? 'twinkle' : 'pop'} size={size === 'sm' ? 14 : 16} /> : null}
      {children}
    </button>
  )
}

export const Card = ({ className, children, ...p }) => <div {...p} className={cx('card', className)}>{children}</div>

export const Badge = ({ className, children }) => (
  <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>{children}</span>
)
export const StatusBadge = ({ status }) => <Badge className={STATUS[status]?.cls}>{STATUS[status]?.label || status}</Badge>

export function PlatformBadge({ platform, size = 26, withName }) {
  const m = PLATFORM[platform] || { short: '?', color: '#64748b', label: platform }
  return (
    <span className="inline-flex items-center gap-1.5" title={m.label}>
      <span className="grid place-items-center rounded-lg text-[10px] font-bold text-white" style={{ width: size, height: size, background: m.bg || m.color }}>{m.short}</span>
      {withName && <span className="text-sm font-medium">{m.label}</span>}
    </span>
  )
}

export const Avatar = ({ name, size = 36, live }) => <RingAvatar name={name} size={size} live={live} />

export const Spinner = ({ label = 'Yuklanmoqda' }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-slate-500"><div className="dots" aria-hidden="true"><span /><span /><span /></div>{label}</div>
)

export const Empty = ({ icon: Icon, title, text, action }) => (
  <div className="card p-10 text-center">
    {Icon && <div className="bob-soft mx-auto mb-3 grid h-14 w-14 place-items-center rounded-[1.1rem] bg-gradient-to-br from-brand-50 to-pink-50 text-brand-600 ring-1 ring-brand-100"><Icon size={24} /></div>}
    <div className="font-semibold">{title}</div>
    {text && <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">{text}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
)

export const ErrorBox = ({ error }) => error ? (
  <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">{error.message || String(error)}</div>
) : null

export function Stat({ icon: Icon, label, value, hint, tone = 'brand' }) {
  const tones = {
    brand: 'from-brand-500 to-fuchsia-500 shadow-brand-500/35', green: 'from-emerald-400 to-teal-500 shadow-emerald-500/35',
    amber: 'from-amber-400 to-orange-500 shadow-amber-500/35', pink: 'from-pink-500 to-rose-500 shadow-pink-500/35', sky: 'from-sky-400 to-blue-500 shadow-sky-500/35',
  }
  return (
    <Card className="hov flex items-center gap-3.5 p-4">
      {Icon && <div className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg', tones[tone])}><AnimIcon icon={Icon} a="pop" size={22} /></div>}
      <div className="min-w-0">
        <div className="font-display text-[1.7rem] font-bold leading-none tracking-tight">{typeof value === 'number' || /^[\d\s]+$/.test(String(value)) ? <CountUp value={value} /> : value}</div>
        <div className="mt-1 truncate text-xs text-slate-500">{label}</div>
        {hint}
      </div>
    </Card>
  )
}

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50'
export const Input = ({ className, ...p }) => <input {...p} className={cx(inputCls, className)} />
export const Textarea = ({ className, ...p }) => <textarea {...p} className={cx(inputCls, 'resize-y', className)} />
export const Select = ({ className, children, ...p }) => <select {...p} className={cx(inputCls, className)}>{children}</select>
export const Field = ({ label, hint, children, className }) => (
  <label className={cx('block', className)}>
    {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
    {children}
    {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
  </label>
)

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className={cx('card pop-in w-full p-6', width)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>, document.body)
}

/* ---------- Toast ---------- */
const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((type, message) => {
    const id = Math.random().toString(36).slice(2)
    setItems((s) => [...s, { id, type, message }])
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), type === 'error' ? 7000 : 4000)
  }, [])
  const api = { success: (m) => push('success', m), error: (m) => push('error', m), info: (m) => push('info', m) }
  const icon = { success: <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path className="check-draw" d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>, error: <XCircle size={18} className="text-red-500" />, info: <Info size={18} className="text-sky-500" /> }
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed right-4 top-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className="card toast-in flex items-start gap-2.5 p-3 text-sm shadow-xl">{icon[t.type]}<div className="flex-1 whitespace-pre-line break-words">{t.message}</div></div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
