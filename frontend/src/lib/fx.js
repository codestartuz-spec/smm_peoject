/** Muvaffaqiyat effekti (tasdiqlash / nashr): reaksiya va konfetti zarralari. Faqat foydalanuvchi amaliga javob. */
const GLYPHS = ['❤️', '✨', '🎉', '💜', '⭐', '🚀']
const COLORS = ['#ffb02e', '#ff5d7d', '#d946ef', '#7657ff', '#2ea9ff', '#14c8a4']

export function celebrate(x = window.innerWidth / 2, y = window.innerHeight * 0.75) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const layer = document.createElement('div')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:90;overflow:hidden'
  document.body.appendChild(layer)
  const n = 26
  for (let i = 0; i < n; i++) {
    const el = document.createElement('span')
    const emoji = i % 3 === 0
    el.textContent = emoji ? GLYPHS[i % GLYPHS.length] : ''
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;font-size:${emoji ? 18 + Math.random() * 10 : 0}px;` +
      (emoji ? '' : `width:${6 + Math.random() * 6}px;height:${8 + Math.random() * 8}px;border-radius:2px;background:${COLORS[i % COLORS.length]};`)
    layer.appendChild(el)
    const ang = (-Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 1.1
    const dist = 90 + Math.random() * 170
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist
    el.animate([
      { transform: 'translate(-50%,-50%) scale(.3) rotate(0)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(${Math.random() * 300 - 150}deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(calc(-50% + ${dx * 1.1}px), calc(-50% + ${dy + 120}px)) scale(.9) rotate(${Math.random() * 500 - 250}deg)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' })
  }
  setTimeout(() => layer.remove(), 1800)
}
