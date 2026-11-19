import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Loader2, X, XCircle, Info } from 'lucide-react'
import { PLATFORM, STATUS, initials, colorFor } from '../lib/meta'

export const cx = (...a) => a.filter(Boolean).join(' ')

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20',
  secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-red-50 text-red-700 hover:bg-red-100',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
  warn: 'bg-amber-500 text-white hover:bg-amber-600',
  ai: 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 shadow-sm shadow-fuchsia-600/20',
}

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, children, className, ...p }) {
  return (
    <button
      {...p}
      disabled={p.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        VARIANTS[variant], className,
      )}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : Icon ? <Icon size={size === 'sm' ? 14 : 16} /> : null}
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
      <span className="grid place-items-center rounded-lg text-[10px] font-bold text-white" style={{ width: size, height: size, background: m.color }}>{m.short}</span>
      {withName && <span className="text-sm font-medium">{m.label}</span>}
    </span>
  )
}

export const Avatar = ({ name, size = 36 }) => (
  <span className="grid place-items-center rounded-xl font-bold text-white shrink-0" style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.38 }}>{initials(name)}</span>
)

export const Spinner = ({ label = 'Yuklanmoqda…' }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-slate-500"><Loader2 className="animate-spin" size={18} />{label}</div>
)

export const Empty = ({ icon: Icon, title, text, action }) => (
  <div className="card p-10 text-center">
    {Icon && <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Icon size={22} /></div>}
    <div className="font-semibold">{title}</div>
    {text && <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">{text}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
)

export const ErrorBox = ({ error }) => error ? (
  <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">{error.message || String(error)}</div>
) : null

export function Stat({ icon: Icon, label, value, hint, tone = 'brand' }) {
  const tones = { brand: 'bg-brand-50 text-brand-600', green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', pink: 'bg-pink-50 text-pink-600', sky: 'bg-sky-50 text-sky-600' }
  return (
    <Card className="p-4 flex items-center gap-3">
      {Icon && <div className={cx('grid h-11 w-11 place-items-center rounded-xl shrink-0', tones[tone])}><Icon size={20} /></div>}
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-tight">{value}</div>
        <div className="text-xs text-slate-500 truncate">{label}</div>
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className={cx('card w-full p-6 fade-up', width)} onMouseDown={(e) => e.stopPropagation()}>
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
  const icon = { success: <CheckCircle2 size={18} className="text-emerald-500" />, error: <XCircle size={18} className="text-red-500" />, info: <Info size={18} className="text-sky-500" /> }
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className="card fade-up flex items-start gap-2 p-3 text-sm shadow-lg">{icon[t.type]}<div className="flex-1 whitespace-pre-line break-words">{t.message}</div></div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
