import { useEffect, useRef, useState } from 'react'
import { Bell, Camera, Eye, Heart, MessageCircle, Play, Send, Share2, Sparkles, ThumbsUp } from 'lucide-react'
import { cx } from '../lib/cx'
import { fmtNum, initials, colorFor } from '../lib/meta'

/** Hover/amalga javob beradigan animatsion ikon. a: wiggle | pop | bob | spin | fly | twinkle | flip. Ota element `.hov` bo'lsin. */
export function AnimIcon({ icon: Icon, a = 'wiggle', size = 17, always, className }) {
  return <span className={cx('ai-ico', always && 'always', className)} data-a={a}><Icon size={size} /></span>
}

const RX = [
  [Heart, '#ff5d7d', 4, 26, -2, 22], [MessageCircle, '#2ea9ff', 12, 22, -9, 28], [Play, '#7657ff', 21, 24, -15, 24], [Send, '#14c8a4', 30, 20, -5, 31],
  [Bell, '#ffb02e', 39, 22, -19, 26], [Sparkles, '#d946ef', 48, 26, -11, 29], [ThumbsUp, '#2ea9ff', 57, 22, -23, 25], [Heart, '#ff5d7d', 66, 20, -7, 33],
  [Camera, '#d946ef', 74, 24, -17, 27], [Share2, '#14c8a4', 83, 20, -3, 30], [Eye, '#7657ff', 91, 22, -21, 23], [Sparkles, '#ffb02e', 17, 18, -13, 35],
  [Heart, '#7657ff', 62, 18, -25, 32], [MessageCircle, '#ff5d7d', 95, 20, -8, 36],
]

/** Butun ilova orqa foni: sekin suzuvchi aurora + pastdan ko'tarilayotgan reaksiyalar (like, izoh, play…). */
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="blob blob-a" /><div className="blob blob-b" /><div className="blob blob-c" />
      {RX.map(([I, c, left, size, delay, dur], i) => (
        <span key={i} className="rx" style={{ left: `${left}%`, '--c': c, '--delay': `${delay}s`, '--d': `${dur}s`, '--sway': `${i % 2 ? 30 : -30}px` }}><I size={size} strokeWidth={1.8} /></span>
      ))}
    </div>
  )
}

/** Raqam 0 dan qiymatga silliq sanaydi. */
export function CountUp({ value, format = fmtNum, duration = 900 }) {
  const target = Number(String(value).replace(/\s/g, ''))
  const [n, setN] = useState(0)
  const raf = useRef()
  useEffect(() => {
    if (!Number.isFinite(target)) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(target); return }
    const t0 = performance.now()
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration)
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return <>{Number.isFinite(target) ? format(n) : value}</>
}

/** Story halqali avatar. live=true bo'lsa halqa sekin aylanadi (tasdiq kutayotgan ish bor). */
export function RingAvatar({ name, size = 40, live }) {
  const inner = size - 6
  return (
    <span className={cx('ring shrink-0', live && 'live')} style={{ width: size, height: size }}>
      <span className="ring-in font-display font-bold text-white" style={{ width: inner, height: inner, background: colorFor(name), fontSize: inner * 0.4 }}>{initials(name)}</span>
    </span>
  )
}

/** Animatsion logotip: karnay + ovoz to'lqinlari. */
export function Logo({ size = 36 }) {
  return (
    <span className="relative grid place-items-center rounded-[28%] text-white" style={{ width: size, height: size, background: 'linear-gradient(135deg,#7657ff,#d946ef 60%,#ff5d7d)', boxShadow: '0 8px 20px -6px rgba(217,70,239,.6)' }}>
      <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10v4a1 1 0 0 0 1 1h2.5L12 19V5L6.5 9H4a1 1 0 0 0-1 1Z" fill="currentColor" fillOpacity=".25" />
        <path d="M15.5 9a4 4 0 0 1 0 6" className="wave w1" /><path d="M18.5 6.5a8 8 0 0 1 0 11" className="wave w2" />
      </svg>
      <style>{`.wave{animation:wave 2.4s ease-in-out infinite}.w2{animation-delay:.25s}@keyframes wave{0%,100%{opacity:.35}40%{opacity:1}}`}</style>
    </span>
  )
}
