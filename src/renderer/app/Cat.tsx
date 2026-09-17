import { useEffect, useRef } from 'react'

// Bean, the cat (3.9, D37, D42): a round bean that idles in its spot, does a
// random bit now and then, and reacts to a few things. Purely decorative: no
// sound, no text, and nothing depends on it. Colours come from the theme
// (--chip and the --cat-* tokens).

export const CAT_NAME = 'Bean'

export type CatMood = 'awake' | 'asleep' // asleep: the empty state's Bean

// Where Bean sits while a note is open (D42).
export type CatSpot = 'dock' | 'top' | 'date' | 'corner' | 'tags'

// Things the app tells Bean, sent as a window event.
export type CatSignal = 'typing' | 'checklist' | 'meow' | 'party'
export const CAT_EVENT = 'scratchpost:cat'
export const signalCat = (signal: CatSignal) => window.dispatchEvent(new CustomEvent(CAT_EVENT, { detail: signal }))

const BIT_MIN_MS = 60_000 // a random bit every one to two minutes
const BIT_SPREAD_MS = 60_000
const NAP_AFTER_MS = 3 * 60_000 // dozes off after this long without typing
const SVG_NS = 'http://www.w3.org/2000/svg'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Fx = 'note' | 'z' | 'heart' | 'purr'

// Where effects start, in the 120 by 100 drawing.
const FX_NOTE_Y = 34
const FX_HEART: [number, number] = [60, 20]
const FX_PURR: [number, number][] = [
  [20, 64],
  [100, 64]
]
const FX_Z: [number, number] = [84, 22]

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
    const [all, body, ears, eyesOpen, eyesHappy, eyesClosed, mouth, yawn, tongue, paw, phones, blush, fx] = [
      'all',
      'body',
      'ears',
      'eyes-open',
      'eyes-happy',
      'eyes-closed',
      'mouth',
      'yawn',
      'tongue',
      'paw',
      'phones',
      'blush',
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
    const eyes = (kind: 'open' | 'happy' | 'closed') => {
      show(eyesOpen, kind === 'open')
      show(eyesHappy, kind === 'happy')
      show(eyesClosed, kind === 'closed')
    }
    const animate = (el: Element, frames: Keyframe[], options: KeyframeAnimationOptions) =>
      el.animate(frames, { easing: 'ease-in-out', ...options }).finished.catch(() => {})
    const hidden = () => document.visibilityState === 'hidden'

    const floater = (kind: Fx, x: number, y: number) => {
      if (hidden() || (reduce && kind !== 'heart')) return
      const el = document.createElementNS(SVG_NS, kind === 'z' ? 'text' : 'path')
      if (kind === 'note') {
        el.setAttribute('d', `M${x} ${y}v-9l6-2v9M${x} ${y}a2.2 2.2 0 1 1-.1 0M${x + 6} ${y - 2}a2.2 2.2 0 1 1-.1 0`)
      } else if (kind === 'heart') {
        el.setAttribute(
          'd',
          `M${x} ${y + 5}C${x - 9} ${y - 1} ${x - 4} ${y - 8} ${x} ${y - 3}C${x + 4} ${y - 8} ${x + 9} ${y - 1} ${x} ${y + 5}Z`
        )
      } else if (kind === 'purr') {
        el.setAttribute('d', `M${x} ${y - 6}q${x < 60 ? -4 : 4} 6 0 12`)
      } else {
        el.setAttribute('x', String(x))
        el.setAttribute('y', String(y))
        el.textContent = 'z'
      }
      el.setAttribute('class', `cat-fx-${kind}`)
      fx.appendChild(el)
      const frames: Keyframe[] =
        kind === 'purr'
          ? [
              { transform: 'translateX(0)', opacity: 0 },
              { opacity: 1, offset: 0.3 },
              { transform: `translateX(${x < 60 ? -10 : 10}px)`, opacity: 0 }
            ]
          : reduce
            ? [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }]
            : [
                { transform: 'translate(0, 0) scale(.6)', opacity: 0 },
                {
                  transform: 'translate(3px, -6px) scale(1)',
                  opacity: 1,
                  offset: 0.25
                },
                { transform: 'translate(9px, -26px) scale(1)', opacity: 0 }
              ]
      void animate(el, frames, {
        duration: kind === 'purr' ? 700 : 1600,
        easing: 'ease-out'
      }).then(() => el.remove())
    }

    const blink = async () => {
      eyes('closed')
      await wait(130)
      if (!asleep) eyes('open')
    }

    const bits: Record<string, () => Promise<void>> = {
      // Petting: happy eyes, ears flick, a slow squish, purr waves and a heart.
      async pet() {
        eyes('happy')
        blush.style.opacity = '1'
        floater('heart', ...FX_HEART)
        const waves = setInterval(() => FX_PURR.forEach(([x, y]) => floater('purr', x, y)), 450)
        floater('purr', ...FX_PURR[0])
        floater('purr', ...FX_PURR[1])
        if (reduce) {
          await wait(1600)
        } else {
          void animate(ears, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(.88)' }, { transform: 'scaleY(1)' }], {
            duration: 320
          })
          await animate(
            body,
            [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.04, .95)' }, { transform: 'scale(1, 1)' }],
            { duration: 900, iterations: 2 }
          )
        }
        clearInterval(waves)
        blush.style.opacity = ''
        await wait(200)
        if (!asleep) eyes('open')
      },
      async headphones() {
        await animate(
          phones,
          [
            { transform: 'translateY(-24px)', opacity: 0 },
            { transform: 'translateY(0)', opacity: 1 }
          ],
          {
            duration: 450,
            easing: 'cubic-bezier(.3,1.5,.6,1)',
            fill: 'forwards'
          }
        )
        eyes('happy')
        const notes = setInterval(() => floater('note', Math.random() < 0.5 ? 12 : 102, FX_NOTE_Y), 420)
        // A nod to the beat.
        const nod: Keyframe[] = [
          { transform: 'translateY(0) rotate(0)' },
          { transform: 'translateY(3px) rotate(-2deg)', offset: 0.3 },
          { transform: 'translateY(0) rotate(0)' }
        ]
        await Promise.all([
          animate(body, nod, { duration: 480, iterations: 8 }),
          animate(phones, nod, {
            duration: 480,
            iterations: 8,
            composite: 'add'
          })
        ])
        clearInterval(notes)
        eyes('open')
        await animate(
          phones,
          [
            { transform: 'translateY(0)', opacity: 1 },
            { transform: 'translateY(-24px)', opacity: 0 }
          ],
          { duration: 380, fill: 'forwards' }
        )
      },
      async yawn() {
        eyes('closed')
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
            body,
            [
              { transform: 'scale(1, 1)' },
              { transform: 'scale(.97, 1.06)', offset: 0.45 },
              { transform: 'scale(1, 1)' }
            ],
            { duration: 1600 }
          )
        ])
        show(yawn, false)
        show(mouth, true)
        await wait(250)
        eyes('open')
      },
      // A paw fades in, comes up to the mouth and gets a few licks.
      async groom() {
        await animate(
          paw,
          [
            { transform: 'translate(0, 14px)', opacity: 0 },
            { transform: 'translate(0, 0)', opacity: 1 }
          ],
          { duration: 500, easing: 'ease-out', fill: 'forwards' }
        )
        eyes('happy')
        show(mouth, false)
        show(tongue, true)
        for (let i = 0; i < 4 && alive; i++) {
          await Promise.all([
            animate(tongue, [{ transform: 'scaleY(.3)' }, { transform: 'scaleY(1)' }, { transform: 'scaleY(.3)' }], {
              duration: 380
            }),
            animate(
              paw,
              [
                { transform: 'translate(0, 0) rotate(0)' },
                { transform: 'translate(-1px, -3px) rotate(-8deg)' },
                { transform: 'translate(0, 0) rotate(0)' }
              ],
              { duration: 380, composite: 'add' }
            )
          ])
        }
        show(tongue, false)
        show(mouth, true)
        eyes('open')
        await animate(
          paw,
          [
            { transform: 'translate(0, 0)', opacity: 1 },
            { transform: 'translate(0, 14px)', opacity: 0 }
          ],
          { duration: 450, easing: 'ease-in', fill: 'forwards' }
        )
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
        eyes('closed')
        body.classList.add('slow')
        for (let i = 0; i < 6 && alive; i++) {
          floater('z', ...FX_Z)
          await wait(650)
        }
        body.classList.remove('slow')
        await blink()
        await wait(120)
        await blink()
      },
      // A hop with a squash on take-off and landing.
      async hop() {
        await animate(
          all,
          [
            { transform: 'translateY(0) scale(1, 1)' },
            { transform: 'translateY(0) scale(1.06, .92)', offset: 0.15 },
            { transform: 'translateY(-14px) scale(.96, 1.05)', offset: 0.45 },
            { transform: 'translateY(0) scale(1.08, .9)', offset: 0.75 },
            { transform: 'translateY(0) scale(1, 1)' }
          ],
          { duration: 750 }
        )
      },
      async stretch() {
        eyes('closed')
        await animate(
          all,
          [
            { transform: 'scale(1, 1)' },
            { transform: 'scale(1.12, .9)', offset: 0.4 },
            { transform: 'scale(1.12, .9)', offset: 0.6 },
            { transform: 'scale(1, 1)' }
          ],
          { duration: 1400 }
        )
        eyes('open')
      }
    }
    const RANDOM_BITS = ['headphones', 'yawn', 'groom', 'look', 'catnap']
    // Under reduced motion only these run, and without movement.
    const CALM_BITS = new Set(['pet'])

    const run = async (name: string) => {
      if (busy || !alive || hidden()) return
      if (reduce && !CALM_BITS.has(name)) return
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
      eyes('closed')
      body.classList.add('slow')
      ears.classList.add('droop')
    }
    const wake = async () => {
      if (!asleep || mood === 'asleep') return
      asleep = false
      body.classList.remove('slow')
      ears.classList.remove('droop')
      eyes('open')
      await blink()
    }
    if (mood === 'asleep') fallAsleep()

    // Blinks while awake, z's while asleep, a random bit now and then.
    void (async () => {
      while (alive) {
        await wait(2500 + Math.random() * 3500)
        if (!alive || busy || hidden()) continue
        if (asleep) floater('z', ...FX_Z)
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
      } else if (signal === 'party') {
        void wake().then(() => run('headphones'))
      }
    }
    // Petting doesn't wake a sleeping Bean; it just purrs in its sleep.
    const onClick = () => void run('pet')
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

  const eyeY = 58
  return (
    <svg
      ref={root}
      className={['cat', className].filter(Boolean).join(' ')}
      viewBox="0 0 120 100"
      role="img"
      aria-label={`${CAT_NAME}, the cat`}
    >
      <title>{CAT_NAME}</title>
      <g data-part="all" className="cat-all">
        <g className="cat-tail">
          <path className="cat-tail-body" d="M94 86 C114 84 118 62 106 52" />
          <path className="cat-tail-tip" d="M108 58 C107 55 107 54 106 52" />
        </g>
        <g data-part="body" className="cat-body">
          <path
            className="cat-fill"
            d="M32 96 C18 96 16 74 22 58 C28 40 40 32 60 32 C80 32 92 40 98 58 C104 74 102 96 88 96 Z"
          />
          <path className="cat-shade" d="M24 80 C30 96 90 96 96 80 C98 90 96 96 88 96 L32 96 C24 96 22 90 24 80 Z" />
          <ellipse className="cat-belly" cx="60" cy="80" rx="19" ry="13" />
          <g data-part="ears" className="cat-ears">
            <path className="cat-fill" d="M29 50 Q30 24 34 21 Q37 20 52 35 Z M91 50 Q90 24 86 21 Q83 20 68 35 Z" />
            <path className="cat-pink" d="M34 41 Q35 30 37 28 L45 35 Z M86 41 Q85 30 83 28 L75 35 Z" />
          </g>
          <path className="cat-stripes" d="M56 36 v6 M60 34 v8 M64 36 v6" />
          <g data-part="eyes-open" className="cat-eyes">
            <ellipse className="cat-ink" cx="47" cy={eyeY} rx="5" ry="5.6" />
            <ellipse className="cat-ink" cx="73" cy={eyeY} rx="5" ry="5.6" />
            <circle className="cat-shine" cx="48.8" cy={eyeY - 2} r="1.8" />
            <circle className="cat-shine" cx="74.8" cy={eyeY - 2} r="1.8" />
            <circle className="cat-shine" cx="45.6" cy={eyeY + 2.2} r="0.8" />
            <circle className="cat-shine" cx="71.6" cy={eyeY + 2.2} r="0.8" />
          </g>
          <path
            data-part="eyes-happy"
            className="cat-line cat-hidden"
            d={`M42 ${eyeY + 1.5} q5 -6 10 0 M68 ${eyeY + 1.5} q5 -6 10 0`}
          />
          <path
            data-part="eyes-closed"
            className="cat-line cat-hidden"
            d={`M42 ${eyeY} q5 4 10 0 M68 ${eyeY} q5 4 10 0`}
          />
          <path className="cat-pink" d={`M57.4 ${eyeY + 6} h5.2 l-2.6 3 z`} />
          <path data-part="mouth" className="cat-line cat-mouth" d={`M55 ${eyeY + 10} q2.5 3 5 0 q2.5 3 5 0`} />
          <ellipse
            data-part="tongue"
            className="cat-pink cat-tongue cat-hidden"
            cx="60"
            cy={eyeY + 13}
            rx="2.6"
            ry="3"
          />
          <ellipse data-part="yawn" className="cat-ink cat-yawn cat-hidden" cx="60" cy={eyeY + 12} rx="4.4" ry="5.2" />
          <g data-part="blush" className="cat-blush">
            <ellipse className="cat-pink" cx="38" cy={eyeY + 8} rx="5" ry="2.6" />
            <ellipse className="cat-pink" cx="82" cy={eyeY + 8} rx="5" ry="2.6" />
          </g>
          <path
            className="cat-whiskers"
            d={`M31 ${eyeY + 6} l-11 -2 M31 ${eyeY + 9} l-11 2 M89 ${eyeY + 6} l11 -2 M89 ${eyeY + 9} l11 2`}
          />
          <g data-part="paw" className="cat-paw cat-hidden">
            <ellipse className="cat-fill cat-paw-outline" cx="70" cy={eyeY + 18} rx="7" ry="6" />
            <ellipse className="cat-belly" cx="70" cy={eyeY + 20} rx="4" ry="2.6" />
          </g>
        </g>
        <g data-part="phones" className="cat-phones cat-hidden">
          <path className="cat-band" d="M26 56 C22 12 98 12 94 56" />
          <rect className="cat-gear" x="18" y="46" width="12" height="20" rx="5" />
          <rect className="cat-gear" x="90" y="46" width="12" height="20" rx="5" />
          <rect className="cat-pink" x="21" y="50" width="6" height="12" rx="3" />
          <rect className="cat-pink" x="93" y="50" width="6" height="12" rx="3" />
        </g>
      </g>
      <g data-part="fx" />
    </svg>
  )
}
