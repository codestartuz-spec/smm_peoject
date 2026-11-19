export const PLATFORM = {
  telegram: { label: 'Telegram', short: 'TG', color: '#229ED9', soft: '#e6f4fb' },
  instagram: { label: 'Instagram', short: 'IG', color: '#d6249f', soft: '#fbe8f5', bg: 'linear-gradient(45deg,#feda75,#fa7e1e 25%,#d62976 55%,#962fbf 80%,#4f5bd5)' },
  youtube: { label: 'YouTube', short: 'YT', color: '#ef1c1c', soft: '#fde8e8' },
  facebook: { label: 'Facebook', short: 'FB', color: '#1877f2', soft: '#e7f0fe' },
  tiktok: { label: 'TikTok', short: 'TT', color: '#111827', soft: '#e5e7eb' },
  linkedin: { label: 'LinkedIn', short: 'IN', color: '#0a66c2', soft: '#e5eff9' },
}

export const STATUS = {
  idea: { label: "G'oya", cls: 'bg-slate-100 text-slate-700', color: '#94a3b8' },
  draft: { label: 'Qoralama', cls: 'bg-slate-200 text-slate-800', color: '#64748b' },
  pending: { label: 'Tasdiq kutmoqda', cls: 'bg-amber-100 text-amber-800', color: '#f59e0b' },
  approved: { label: 'Tasdiqlangan', cls: 'bg-blue-100 text-blue-800', color: '#3b82f6' },
  published: { label: "E'lon qilindi", cls: 'bg-emerald-100 text-emerald-800', color: '#22c55e' },
  failed: { label: 'Xato', cls: 'bg-red-100 text-red-800', color: '#ef4444' },
  rejected: { label: 'Rad etildi', cls: 'bg-purple-100 text-purple-800', color: '#a855f7' },
}

export const KIND = {
  post: { label: 'Post', emoji: '🖼️' },
  carousel: { label: 'Karusel', emoji: '🗂️' },
  reel: { label: 'Reels / Shorts', emoji: '🎬' },
  video: { label: 'Video', emoji: '📹' },
  story: { label: 'Story', emoji: '⏳' },
}

export const SENTIMENT = {
  positive: { label: 'Ijobiy', emoji: '😊', cls: 'text-emerald-600', color: '#10b981' },
  neutral: { label: 'Neytral', emoji: '😐', cls: 'text-slate-500', color: '#94a3b8' },
  negative: { label: 'Salbiy', emoji: '😠', cls: 'text-red-600', color: '#ef4444' },
}

const pad = (n) => String(n).padStart(2, '0')
export function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export function fmtDate(iso, withTime = true) {
  if (!iso) return '—'
  const d = new Date(iso)
  const base = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
  return withTime ? `${base} ${pad(d.getHours())}:${pad(d.getMinutes())}` : base
}
export const fmtNum = (n) => new Intl.NumberFormat('uz-UZ').format(n || 0).replace(/,/g, ' ')
export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?'
const PALETTE = ['#7657ff', '#2ea9ff', '#14c8a4', '#ff9f1c', '#ff5d7d', '#a855f7', '#0fb5b0', '#f0506e']
export const colorFor = (s = '') => PALETTE[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length]

export function fmtSize(b = 0) {
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`
  return `${(b / 1024 ** 3).toFixed(2)} GB`
}
