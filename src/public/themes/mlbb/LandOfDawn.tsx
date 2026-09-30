import type { CSSProperties } from 'react'
import type { Player } from '../../../shared/types'

/*
 * Minimap Land of Dawn yang digambar ulang (ilustrasi, bukan aset resmi).
 * Tata letak fisik mengikuti peta MLBB: markas biru kiri bawah, merah kanan atas, sungai diagonal
 * kiri atas ke kanan bawah, EXP Lane = jalur atas dan Gold Lane = jalur bawah untuk kedua tim,
 * Turtle di sungai dekat EXP Lane dan Lord dekat Gold Lane, tiga menara per lane per tim.
 * Karena kedua tim memakai jalur yang sama, peta simetris cermin terhadap garis sungai (x, y) -> (y, x).
 * Seperti di game, tim sendiri selalu tampil di kiri bawah: untuk red side seluruh peta diputar 180 derajat.
 */

type Side = 'blue' | 'red'
type Pt = [number, number]

const S = 400
const mirror = ([x, y]: Pt): Pt => [y, x]
const turn = ([x, y]: Pt): Pt => [S - x, S - y]

/** Posisi fisik (sudut pandang blue side). */
const BLUE_TOWERS: Pt[] = [
  [44, 292],
  [44, 222],
  [44, 150],
  [108, 356],
  [178, 356],
  [250, 356],
  [98, 302],
  [132, 268],
  [166, 234],
]
const BLUE_BUFFS: { at: Pt; kind: 'purple' | 'red' }[] = [
  { at: [98, 196], kind: 'purple' },
  { at: [204, 302], kind: 'red' },
]
const TURTLE: Pt = [104, 96]
const LORD: Pt = [296, 304]

/**
 * Posisi chip pemain per lane di tim sendiri, dalam koordinat tampilan (markas sendiri kiri bawah).
 * Chip diletakkan di celah antarmenara; label nama di sisi yang bebas menara.
 */
type Spot = { at: Pt; label: 'right' | 'below' }
const LANE_SPOTS: Record<Side, Record<string, Spot>> = {
  blue: {
    'EXP Lane': { at: [44, 186], label: 'right' },
    'Gold Lane': { at: [214, 356], label: 'below' },
    'Mid Lane': { at: [149, 251], label: 'right' },
    Jungle: { at: [96, 236], label: 'right' },
    Roam: { at: [176, 316], label: 'right' },
  },
  red: {
    'EXP Lane': { at: [214, 356], label: 'below' },
    'Gold Lane': { at: [44, 186], label: 'right' },
    'Mid Lane': { at: [149, 251], label: 'right' },
    Jungle: { at: [234, 300], label: 'right' },
    Roam: { at: [86, 232], label: 'right' },
  },
}

/** Label jalur samping (EXP dan Gold bertukar tempat antara blue side dan red side). */
function laneLabels(side: Side): { text: string; at: Pt; vertical?: boolean }[] {
  const top = side === 'blue' ? 'EXP Lane' : 'Gold Lane'
  const bottom = side === 'blue' ? 'Gold Lane' : 'EXP Lane'
  return [
    { text: top, at: [44, 100], vertical: true },
    { text: bottom, at: [302, 356] },
  ]
}

/** Pseudo-acak dengan seed tetap supaya hutan selalu tergambar sama. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const distToSegment = ([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt) => {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Kanopi hutan: lingkaran-lingkaran yang menjauhi jalur, sungai, dan pit. Dibuat sekali, simetris cermin. */
const CANOPY = (() => {
  const rand = rng(7)
  const lanes: [Pt, Pt][] = [
    [
      [44, 356],
      [44, 44],
    ],
    [
      [44, 44],
      [356, 44],
    ],
    [
      [44, 356],
      [356, 356],
    ],
    [
      [356, 356],
      [356, 44],
    ],
    [
      [44, 356],
      [356, 44],
    ],
  ]
  const clear = (p: Pt) =>
    lanes.every(([a, b]) => distToSegment(p, a, b) > 24) &&
    Math.abs(p[0] - p[1]) > 34 &&
    Math.hypot(p[0] - TURTLE[0], p[1] - TURTLE[1]) > 34 &&
    Math.hypot(p[0] - LORD[0], p[1] - LORD[1]) > 34 &&
    BLUE_BUFFS.every((b) => Math.hypot(p[0] - b.at[0], p[1] - b.at[1]) > 16)
  const out: { at: Pt; r: number; tone: number }[] = []
  for (let y = 60; y < 344; y += 17) {
    for (let x = 60; x < 344; x += 17) {
      // Hanya setengah bawah garis sungai; setengah lainnya hasil cermin.
      if (y <= x) continue
      const p: Pt = [x + (rand() - 0.5) * 12, y + (rand() - 0.5) * 12]
      if (!clear(p) || !clear(mirror(p))) continue
      const r = 6 + rand() * 7
      const tone = Math.floor(rand() * 3)
      out.push({ at: p, r, tone }, { at: mirror(p), r, tone })
    }
  }
  return out
})()

/** Kunci warna lane (EXP, Gold, Mid, Jungle, Roam) yang dipakai kartu lineup, pemilih lane, dan titik di peta. */
export function laneKey(role: string): string | undefined {
  const map: Record<string, string> = { 'EXP Lane': 'exp', 'Gold Lane': 'gold', 'Mid Lane': 'mid', Jungle: 'jungle', Roam: 'roam' }
  return map[role]
}

const pct = ([x, y]: Pt): CSSProperties => ({ left: `${(x / S) * 100}%`, top: `${(y / S) * 100}%` })

export function LandOfDawn({ players, side, hot, onHot }: { players: Player[]; side: Side; hot?: string | null; onHot?: (id: string | null) => void }) {
  const view = (p: Pt) => (side === 'blue' ? p : turn(p))
  // Menara dan buff fisik milik blue; milik red adalah cerminnya. Tim sendiri = sisi yang dipilih host.
  const own = (team: Side) => (team === side ? 'ally' : 'enemy')
  const towers = [...BLUE_TOWERS.map((p) => ({ at: view(p), team: own('blue') })), ...BLUE_TOWERS.map((p) => ({ at: view(mirror(p)), team: own('red') }))]
  const buffs = [...BLUE_BUFFS.map((b) => ({ at: view(b.at), kind: b.kind })), ...BLUE_BUFFS.map((b) => ({ at: view(mirror(b.at)), kind: b.kind }))]
  const turtle = view(TURTLE)
  const lord = view(LORD)
  // Sungai: kurva S dari sudut kiri atas ke kanan bawah (ikut diputar untuk red side).
  const river = side === 'blue' ? 'M58 58 C 118 88, 158 150, 200 200 S 282 312, 342 342' : 'M342 342 C 282 312, 242 250, 200 200 S 118 88, 58 58'

  const counts: Record<string, number> = {}
  const chips = players
    .filter((p) => LANE_SPOTS[side][p.role])
    .map((p) => {
      const n = counts[p.role] ?? 0
      counts[p.role] = n + 1
      const {
        at: [x, y],
        label,
      } = LANE_SPOTS[side][p.role]
      // Pemain kedua di lane yang sama digeser sedikit supaya tidak tertumpuk.
      return { p, label, at: [x + n * 12, y - n * 12] as Pt }
    })

  return (
    <figure className="ml-map" data-side={side} aria-label={`Peta Land of Dawn: ${chips.length} pemain di lane masing-masing`}>
      <div className="ml-map__frame">
        <svg viewBox={`0 0 ${S} ${S}`} aria-hidden="true">
          <defs>
            <radialGradient id="ml-terrain" cx="50%" cy="50%" r="72%">
              <stop offset="0" stopColor="#2a6a45" />
              <stop offset="0.55" stopColor="#174230" />
              <stop offset="1" stopColor="#0a1f17" />
            </radialGradient>
            {/* Cahaya bulan dari kiri atas dan bayangan di kanan bawah, supaya hutan terasa bervolume. */}
            <linearGradient id="ml-moon" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#bfe6ff" stopOpacity="0.14" />
              <stop offset="0.5" stopColor="#bfe6ff" stopOpacity="0" />
              <stop offset="1" stopColor="#050b20" stopOpacity="0.35" />
            </linearGradient>
            <radialGradient id="ml-leaf-0" cx="35%" cy="30%" r="75%">
              <stop offset="0" stopColor="#3f8f5c" />
              <stop offset="1" stopColor="#163d29" />
            </radialGradient>
            <radialGradient id="ml-leaf-1" cx="35%" cy="30%" r="75%">
              <stop offset="0" stopColor="#5cb877" />
              <stop offset="1" stopColor="#23603d" />
            </radialGradient>
            <radialGradient id="ml-leaf-2" cx="35%" cy="30%" r="75%">
              <stop offset="0" stopColor="#2c6e4a" />
              <stop offset="1" stopColor="#0f2c1f" />
            </radialGradient>
            <linearGradient id="ml-water" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#1f6fc0" />
              <stop offset="0.3" stopColor="#3fb6f0" />
              <stop offset="0.5" stopColor="#8ae4ff" />
              <stop offset="0.7" stopColor="#3fb6f0" />
              <stop offset="1" stopColor="#1f6fc0" />
            </linearGradient>
            <linearGradient id="ml-stone" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e7d09c" />
              <stop offset="0.5" stopColor="#c9a86c" />
              <stop offset="1" stopColor="#a8864f" />
            </linearGradient>
            <radialGradient id="ml-tower" cx="40%" cy="35%" r="70%">
              <stop offset="0" stopColor="#23326e" />
              <stop offset="1" stopColor="#070d2a" />
            </radialGradient>
            <radialGradient id="ml-glow-ally">
              <stop offset="0" stopColor="#8fd4ff" stopOpacity="0.9" />
              <stop offset="1" stopColor="#4fb3ff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="ml-glow-enemy">
              <stop offset="0" stopColor="#ffb0b9" stopOpacity="0.9" />
              <stop offset="1" stopColor="#ff5b6e" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="ml-glow-lord">
              <stop offset="0" stopColor="#d6a8ff" stopOpacity="0.85" />
              <stop offset="1" stopColor="#8e4dff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="ml-glow-turtle">
              <stop offset="0" stopColor="#9ff0d4" stopOpacity="0.8" />
              <stop offset="1" stopColor="#2fc9a0" stopOpacity="0" />
            </radialGradient>
            <clipPath id="ml-map-clip">
              <rect x="10" y="10" width="380" height="380" rx="20" />
            </clipPath>
          </defs>

          <g clipPath="url(#ml-map-clip)">
            <rect x="0" y="0" width={S} height={S} fill="url(#ml-terrain)" />

            <g className="ml-map__canopy">
              {CANOPY.map(({ at: [x, y], r, tone }, i) => {
                const [vx, vy] = view([x, y])
                return <circle key={i} cx={vx} cy={vy} r={r} className={`tone-${tone}`} />
              })}
            </g>

            <g className="ml-map__river">
              <path d={river} className="ml-map__water-edge" />
              <path d={river} className="ml-map__water" />
              <path d={river} className="ml-map__water-shine" />
            </g>

            <g className="ml-map__lanes">
              <path d="M44 356 V 70 Q 44 44 70 44 H 356" className="ml-map__lane-edge" />
              <path d="M44 356 H 330 Q 356 356 356 330 V 44" className="ml-map__lane-edge" />
              <path d="M44 356 L 356 44" className="ml-map__lane-edge" />
              <path d="M44 356 V 70 Q 44 44 70 44 H 356" className="ml-map__lane" />
              <path d="M44 356 H 330 Q 356 356 356 330 V 44" className="ml-map__lane" />
              <path d="M44 356 L 356 44" className="ml-map__lane" />
              <path d="M44 356 V 70 Q 44 44 70 44 H 356" className="ml-map__lane-line" />
              <path d="M44 356 H 330 Q 356 356 356 330 V 44" className="ml-map__lane-line" />
              <path d="M44 356 L 356 44" className="ml-map__lane-line" />
            </g>

            {/* Pit Turtle dan Lord di sungai */}
            <g className="ml-map__pit ml-map__pit--turtle" transform={`translate(${turtle[0]} ${turtle[1]})`}>
              <circle r="30" fill="url(#ml-glow-turtle)" />
              <circle r="17" className="ml-map__pit-ring" />
              <path d="M0 -9 L 8 -4.5 L 8 4.5 L 0 9 L -8 4.5 L -8 -4.5 Z" className="ml-map__pit-icon" />
              <path d="M0 -9 V 9 M -8 -4.5 L 8 4.5 M 8 -4.5 L -8 4.5" className="ml-map__pit-lines" />
            </g>
            <g className="ml-map__pit ml-map__pit--lord" transform={`translate(${lord[0]} ${lord[1]})`}>
              <circle r="32" fill="url(#ml-glow-lord)" />
              <circle r="18" className="ml-map__pit-ring" />
              <path d="M-9 5 L -9 -6 L -4.5 -1 L 0 -9 L 4.5 -1 L 9 -6 L 9 5 Z" className="ml-map__pit-icon" />
            </g>

            {buffs.map(({ at: [x, y], kind }, i) => (
              <g key={i} className={`ml-map__buff ml-map__buff--${kind}`} transform={`translate(${x} ${y})`}>
                <circle r="11" className="ml-map__buff-glow" />
                <circle r="5.5" className="ml-map__buff-core" />
              </g>
            ))}

            {towers.map(({ at: [x, y], team }, i) => (
              <g key={i} className={`ml-map__tower ml-map__tower--${team}`} transform={`translate(${x} ${y})`}>
                <circle r="9" className="ml-map__tower-base" />
                <path d="M0 -5.5 L 4.5 0 L 0 5.5 L -4.5 0 Z" className="ml-map__tower-gem" />
              </g>
            ))}

            {/* Markas: kristal dengan cahaya warna tim (sekutu biru, lawan merah seperti minimap game) */}
            <g className="ml-map__base ml-map__base--ally" transform="translate(44 356)">
              <circle r="42" fill="url(#ml-glow-ally)" />
              <path d="M0 -20 L 17 -10 L 17 10 L 0 20 L -17 10 L -17 -10 Z" className="ml-map__base-hex" />
              <path d="M0 -11 L 7 0 L 0 11 L -7 0 Z" className="ml-map__base-gem" />
            </g>
            <g className="ml-map__base ml-map__base--enemy" transform="translate(356 44)">
              <circle r="42" fill="url(#ml-glow-enemy)" />
              <path d="M0 -20 L 17 -10 L 17 10 L 0 20 L -17 10 L -17 -10 Z" className="ml-map__base-hex" />
              <path d="M0 -11 L 7 0 L 0 11 L -7 0 Z" className="ml-map__base-gem" />
            </g>
            <rect x="0" y="0" width={S} height={S} fill="url(#ml-moon)" pointerEvents="none" />
          </g>
          <rect x="10" y="10" width="380" height="380" rx="20" className="ml-map__rim" />
        </svg>

        {laneLabels(side).map(({ text, at, vertical }) => (
          <span key={text} className={`ml-map__lane-label ${vertical ? 'is-vertical' : ''}`} style={pct(at)} aria-hidden="true">
            {text}
          </span>
        ))}
        <span className="ml-map__obj" style={pct([turtle[0], turtle[1] + (side === 'blue' ? 30 : -30)])} aria-hidden="true">
          Turtle
        </span>
        <span className="ml-map__obj ml-map__obj--lord" style={pct([lord[0], lord[1] + (side === 'blue' ? -32 : 32)])} aria-hidden="true">
          Lord
        </span>
        <span className="ml-map__base-label ml-map__base-label--ally" aria-hidden="true">
          Markas kita
        </span>
        <span className="ml-map__base-label ml-map__base-label--enemy" aria-hidden="true">
          Markas lawan
        </span>

        {chips.map(({ p, at, label }) => (
          <span
            key={p.id}
            className={`ml-map__hero ml-map__hero--${label} ${p.status === 'maybe' ? 'is-maybe' : ''} ${p.id === hot ? 'is-hot' : ''}`}
            data-lane={laneKey(p.role)}
            style={pct(at)}
            onMouseEnter={() => onHot?.(p.id)}
            onMouseLeave={() => onHot?.(null)}
          >
            <span className="ml-map__avatar" aria-hidden="true">
              {p.name.slice(0, 1)}
            </span>
            <span className="ml-map__name">{p.name}</span>
          </span>
        ))}
      </div>
      <figcaption className="ml-map__legend">
        <span className="ml-map__key ml-map__key--ally">Tim kita</span>
        <span className="ml-map__key ml-map__key--enemy">Lawan</span>
        <span className="ml-map__key ml-map__key--purple">Buff ungu</span>
        <span className="ml-map__key ml-map__key--red">Buff merah</span>
        <span className="ml-map__note">Ilustrasi Land of Dawn. Pemain tampil di lane yang dipilih.</span>
      </figcaption>
    </figure>
  )
}
