import { useEffect, useRef } from 'react'

// The cat (3.9, D37): a round "bean" that idles on the dock, does a random bit
// now and then, and reacts to a few things. Purely decorative: no sound, no
// text, and nothing depends on it. Colours come from the theme (--chip and
// the --cat-* tokens).

export type CatMood = 'awake' | 'asleep' // asleep: the empty state's cat

// Things the app tells the cat, sent as a window event.
export type CatSignal = 'typing' | 'checklist' | 'meow'
export const CAT_EVENT = 'scratchpost:cat'
export const signalCat = (signal: CatSignal) => window.dispatchEvent(new CustomEvent(CAT_EVENT, { detail: signal }))

const BIT_MIN_MS = 60_000 // a random bit every one to two minutes
const BIT_SPREAD_MS = 60_000
const NAP_AFTER_MS = 3 * 60_000 // dozes off after this long without typing
const SVG_NS = 'http://www.w3.org/2000/svg'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface CatProps {
  mood: CatMood
  className?: string
}

export function Cat({ mood, className }: CatProps) {
  const root = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = root.current
    if (!svg) return
    const part = (name: string) => svg.querySelector<SVGElement>(`[data-part="${name}"]`)!
    const [cat, body, eyesOpen, eyesClosed, mouth, yawn, paw, phones, fx] = [
      'cat',
      'body',
      'eyes-open',
      'eyes-closed',
      'mouth',
      'yawn',
      'paw',
      'phones',
      'fx'
    ].map(part)

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let alive = true
    let busy = false
    let asleep = false
    let lastTyping = Date.now()

    const show = (el: SVGElement, on: boolean) => {
      el.style.opacity = on ? '1' : '0'
    }
    const eyes = (closed: boolean) => {
      show(eyesOpen, !closed)
      show(eyesClosed, closed)
    }
    const animate = (el: Element, frames: Keyframe[], options: KeyframeAnimationOptions) =>
      el.animate(frames, { easing: 'ease-in-out', ...options }).finished.catch(() => {})
    const hidden = () => document.visibilityState === 'hidden'

    const floater = (kind: 'note' | 'z', x: number, y: number) => {
      if (reduce || hidden()) return
      let el: SVGElement
      if (kind === 'note') {
        el = document.createElementNS(SVG_NS, 'path')
        el.setAttribute(
          'd',
          `M${x} ${y}v-9l6-2v9M${x} ${y}a2.2 2.2 0 1 1-.1 0M${x + 6} ${y - 2}a2.2 2.2 0 1 1-.1 0`
        )
        el.setAttribute('class', 'cat-note')
      } else {
        el = document.createElementNS(SVG_NS, 'text')
        el.setAttribute('x', String(x))
        el.setAttribute('y', String(y))
        el.setAttribute('class', 'cat-z')
        el.textContent = 'z'
      }
      fx.appendChild(el)
      void animate(
        el,
        [
          { transform: 'translate(0, 0)', opacity: 0 },
          { transform: 'translate(4px, -6px)', opacity: 1, offset: 0.25 },
          { transform: 'translate(10px, -26px)', opacity: 0 }
        ],
        { duration: 1600, easing: 'ease-out' }
      ).then(() => el.remove())
    }

    const blink = async () => {
      eyes(true)
      await wait(140)
      if (!asleep) eyes(false)
    }

    const bits: Record<string, () => Promise<void>> = {
      async headphones() {
        await animate(
          phones,
          [
            { transform: 'translateY(-28px)', opacity: 0 },
            { transform: 'translateY(0)', opacity: 1 }
          ],
          { duration: 450, easing: 'cubic-bezier(.3,1.5,.6,1)', fill: 'forwards' }
        )
        eyes(true)
        const notes = setInterval(() => floater('note', Math.random() < 0.5 ? 12 : 102, 40), 380)
        await animate(
          cat,
          [
            { transform: 'rotate(0) translateY(0)' },
            { transform: 'rotate(-7deg) translateY(3px)' },
            { transform: 'rotate(0) translateY(0)' },
            { transform: 'rotate(7deg) translateY(3px)' },
            { transform: 'rotate(0) translateY(0)' }
          ],
          { duration: 520, iterations: 8 }
        )
        clearInterval(notes)
        eyes(false)
        await animate(
          phones,
          [
            { transform: 'translateY(0)', opacity: 1 },
            { transform: 'translateY(-28px)', opacity: 0 }
          ],
          { duration: 380, fill: 'forwards' }
        )
      },
      async yawn() {
        eyes(true)
        show(mouth, false)
        show(yawn, true)
        await Promise.all([
          animate(
            yawn,
            [
              { transform: 'scaleY(.1)' },
              { transform: 'scaleY(1)', offset: 0.4 },
              { transform: 'scaleY(1)', offset: 0.7 },
              { transform: 'scaleY(.1)' }
            ],
            { duration: 1600 }
          ),
          animate(
            cat,
            [{ transform: 'scale(1, 1)' }, { transform: 'scale(.97, 1.06)', offset: 0.45 }, { transform: 'scale(1, 1)' }],
            { duration: 1600 }
          )
        ])
        show(yawn, false)
        show(mouth, true)
        await wait(250)
        eyes(false)
      },
      async groom() {
        show(paw, true)
        eyes(true)
        await animate(
          paw,
          [
            { transform: 'translate(0, 8px) rotate(0)' },
            { transform: 'translate(-3px, -2px) rotate(-12deg)' },
            { transform: 'translate(1px, -4px) rotate(8deg)' },
            { transform: 'translate(-3px, -2px) rotate(-12deg)' },
            { transform: 'translate(1px, -4px) rotate(8deg)' },
            { transform: 'translate(0, 8px) rotate(0)' }
          ],
          { duration: 1800 }
        )
        show(paw, false)
        eyes(false)
      },
      async look() {
        await animate(
          eyesOpen,
          [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-3.5px)', offset: 0.2 },
            { transform: 'translateX(-3.5px)', offset: 0.45 },
            { transform: 'translateX(3.5px)', offset: 0.6 },
            { transform: 'translateX(3.5px)', offset: 0.85 },
            { transform: 'translateX(0)' }
          ],
          { duration: 2600 }
        )
        await blink()
      },
      async catnap() {
        eyes(true)
        body.classList.add('slow')
        for (let i = 0; i < 6 && alive; i++) {
          floater('z', 80, 26)
          await wait(650)
        }
        body.classList.remove('slow')
        await blink()
        await wait(120)
        await blink()
      },
      async hop() {
        await animate(
          cat,
          [
            { transform: 'translateY(0)' },
            { transform: 'translateY(-12px)' },
            { transform: 'translateY(0)' },
            { transform: 'translateY(-6px)' },
            { transform: 'translateY(0)' }
          ],
          { duration: 700, easing: 'ease-out' }
        )
      },
      async purr() {
        eyes(true)
        await animate(
          cat,
          [{ transform: 'rotate(0)' }, { transform: 'rotate(-3deg)' }, { transform: 'rotate(3deg)' }, { transform: 'rotate(0)' }],
          { duration: 260, iterations: 3 }
        )
        if (!asleep) eyes(false)
      },
      async stretch() {
        eyes(true)
        await animate(
          cat,
          [
            { transform: 'scale(1, 1)' },
            { transform: 'scale(1.12, .9)', offset: 0.4 },
            { transform: 'scale(1.12, .9)', offset: 0.6 },
            { transform: 'scale(1, 1)' }
          ],
          { duration: 1400 }
        )
        eyes(false)
      }
    }
    const RANDOM_BITS = ['headphones', 'yawn', 'groom', 'look', 'catnap']

    const run = async (name: string) => {
      if (busy || !alive || hidden()) return
      // Under reduced motion only the calm bits run, without movement.
      if (reduce && name !== 'purr') return
      busy = true
      try {
        await bits[name]()
      } finally {
        busy = false
      }
    }

    const fallAsleep = () => {
      if (asleep) return
      asleep = true
      eyes(true)
      body.classList.add('slow')
    }
    const wake = async () => {
      if (!asleep || mood === 'asleep') return
      asleep = false
      body.classList.remove('slow')
      eyes(false)
      await blink()
    }
    if (mood === 'asleep') fallAsleep()

    // Blinks while awake, z's while asleep, a random bit now and then.
    void (async () => {
      while (alive) {
        await wait(2500 + Math.random() * 3500)
        if (!alive || busy || hidden()) continue
        if (asleep) floater('z', 80, 26)
        else void blink()
        if (mood === 'awake' && !asleep && Date.now() - lastTyping > NAP_AFTER_MS) fallAsleep()
      }
    })()
    void (async () => {
      while (alive) {
        await wait(BIT_MIN_MS + Math.random() * BIT_SPREAD_MS)
        if (alive && !asleep) void run(RANDOM_BITS[Math.floor(Math.random() * RANDOM_BITS.length)])
      }
    })()

    const onSignal = (event: Event) => {
      const signal = (event as CustomEvent<CatSignal>).detail
      if (signal === 'typing') {
        lastTyping = Date.now()
        void wake()
      } else if (signal === 'checklist' && !asleep) {
        void run('hop')
      } else if (signal === 'meow') {
        void wake().then(() => run('stretch'))
      }
    }
    const onClick = () => void run('purr')
    // Nothing moves while the window is hidden or minimised.
    const onVisibility = () => svg.classList.toggle('paused', hidden())

    if (mood === 'awake') window.addEventListener(CAT_EVENT, onSignal)
    svg.addEventListener('click', onClick)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      alive = false
      window.removeEventListener(CAT_EVENT, onSignal)
      svg.removeEventListener('click', onClick)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [mood])

  return (
    <svg
      ref={root}
      className={['cat', className].filter(Boolean).join(' ')}
      viewBox="0 0 120 112"
      role="img"
      aria-label="The Scratchpost cat"
    >
      <title>Meow</title>
      <g transform="translate(0,12)">
        <g data-part="cat" className="cat-all">
          <path className="cat-tail cat-fill-stroke" d="M96 82 C114 80 116 60 104 52" />
          <path
            data-part="body"
            className="cat-body cat-fill"
            d="M32 94 C18 94 16 72 22 56 C28 38 40 30 60 30 C80 30 92 38 98 56 C104 72 102 94 88 94 Z"
          />
          <ellipse className="cat-belly" cx="60" cy="78" rx="20" ry="14" />
          <path className="cat-fill cat-ears" d="M30 46 L33 20 L52 34 Z M90 46 L87 20 L68 34 Z" />
          <path className="cat-pink" d="M35 38 L36 27 L45 34 Z M85 38 L84 27 L75 34 Z" />
          <path className="cat-stripes" d="M56 34 v6 M60 32 v8 M64 34 v6" />
          <g data-part="eyes-open" className="cat-eyes">
            <circle className="cat-ink" cx="47" cy="57" r="4.2" />
            <circle className="cat-ink" cx="73" cy="57" r="4.2" />
            <circle className="cat-shine" cx="48.4" cy="55.6" r="1.4" />
            <circle className="cat-shine" cx="74.4" cy="55.6" r="1.4" />
          </g>
          <path data-part="eyes-closed" className="cat-line cat-hidden" d="M43 57 q4 3.5 8 0 M69 57 q4 3.5 8 0" />
          <path data-part="mouth" className="cat-line cat-mouth" d="M55 64 q2.5 3.5 5 0 q2.5 3.5 5 0" />
          <ellipse data-part="yawn" className="cat-ink cat-yawn cat-hidden" cx="60" cy="68" rx="4.2" ry="5" />
          <ellipse className="cat-pink cat-blush" cx="39" cy="66" rx="5" ry="2.8" />
          <ellipse className="cat-pink cat-blush" cx="81" cy="66" rx="5" ry="2.8" />
          <ellipse data-part="paw" className="cat-paw cat-hidden" cx="70" cy="72" rx="7" ry="5.5" />
          <g data-part="phones" className="cat-phones cat-hidden">
            <path className="cat-band" d="M25 52 C22 8 98 8 95 52" />
            <rect className="cat-gear" x="17" y="42" width="12" height="20" rx="5" />
            <rect className="cat-gear" x="91" y="42" width="12" height="20" rx="5" />
            <rect className="cat-pink" x="20" y="46" width="6" height="12" rx="3" />
            <rect className="cat-pink" x="94" y="46" width="6" height="12" rx="3" />
          </g>
        </g>
        <g data-part="fx" />
      </g>
    </svg>
  )
}
