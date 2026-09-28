/*
 * Musik bawaan Jarkoman: komposisi orisinal yang disintesis langsung di browser dengan Web Audio API.
 * Tidak ada file audio yang diunduh dan tidak memakai lagu resmi game (bebas masalah hak cipta).
 * Tiap game punya tempo, tangga nada, dan instrumen sendiri yang mengikuti suasananya:
 *   VALORANT  "Protocol"    104 BPM, D minor, synth elektronik tegang
 *   CS2       "Freeze Time"  92 BPM, E Phrygian, drum militer, detak jam, bunyi bom
 *   MLBB      "Land of Dawn" 84 BPM, D minor epik, harpa, pad, drum taiko
 *   R.E.P.O.  "Night Shift"  70 BPM, drone horor, kotak musik sumbang, detak jantung
 */
import type { GameId } from '../../shared/types'

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

interface Voice {
  ctx: BaseAudioContext
  /** Bus kering (langsung ke master) */
  out: AudioNode
  /** Kirim ke reverb */
  rev: AudioNode
  noise: AudioBuffer
}

function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 1.5)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return buf
}

function makeImpulse(ctx: BaseAudioContext, seconds = 2.6, decay = 3.2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

/** Gain dengan envelope attack lalu decay eksponensial. */
function env(v: Voice, t: number, peak: number, attack: number, decay: number, rev = 0): GainNode {
  const g = v.ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  g.connect(v.out)
  if (rev > 0) {
    const s = v.ctx.createGain()
    s.gain.value = rev
    g.connect(s)
    s.connect(v.rev)
  }
  return g
}

function noiseSource(v: Voice, t: number, dur: number): AudioBufferSourceNode {
  const src = v.ctx.createBufferSource()
  src.buffer = v.noise
  // Loop supaya suara panjang (riser beberapa detik) tidak terpotong di akhir buffer 1,5 detik.
  src.loop = true
  src.start(t, Math.random() * 1.2, dur + 0.05)
  return src
}

/* ---------- Instrumen ---------- */

function kick(v: Voice, t: number, o: { vol?: number; f0?: number; f1?: number; dur?: number; rev?: number } = {}) {
  const { vol = 0.8, f0 = 140, f1 = 45, dur = 0.38, rev = 0 } = o
  const osc = v.ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(f0, t)
  osc.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.55)
  osc.connect(env(v, t, vol, 0.003, dur, rev))
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

function hat(v: Voice, t: number, o: { vol?: number; dur?: number; hp?: number } = {}) {
  const { vol = 0.1, dur = 0.04, hp = 7000 } = o
  const src = noiseSource(v, t, dur)
  const f = v.ctx.createBiquadFilter()
  f.type = 'highpass'
  f.frequency.value = hp
  src.connect(f)
  f.connect(env(v, t, vol, 0.001, dur))
}

function snare(v: Voice, t: number, vol = 0.2, rev = 0.1) {
  const src = noiseSource(v, t, 0.2)
  const f = v.ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = 1800
  f.Q.value = 0.7
  src.connect(f)
  f.connect(env(v, t, vol, 0.002, 0.18, rev))
  const body = v.ctx.createOscillator()
  body.type = 'triangle'
  body.frequency.setValueAtTime(190, t)
  body.connect(env(v, t, vol * 0.5, 0.002, 0.08))
  body.start(t)
  body.stop(t + 0.12)
}

function tom(v: Voice, t: number, f: number, vol = 0.45, dur = 0.45, rev = 0.15) {
  const osc = v.ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(f, t)
  osc.frequency.exponentialRampToValueAtTime(f * 0.55, t + dur)
  osc.connect(env(v, t, vol, 0.003, dur, rev))
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

function pluck(
  v: Voice,
  t: number,
  f: number,
  o: { vol?: number; dur?: number; type?: OscillatorType; cutoff?: number; rev?: number; detune?: number } = {},
) {
  const { vol = 0.06, dur = 0.3, type = 'sawtooth', cutoff = 2200, rev = 0.15, detune = 0 } = o
  const osc = v.ctx.createOscillator()
  osc.type = type
  osc.frequency.value = f
  osc.detune.value = detune
  const lp = v.ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 3
  lp.frequency.setValueAtTime(cutoff * 2, t)
  lp.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.3), t + dur)
  osc.connect(lp)
  lp.connect(env(v, t, vol, 0.005, dur, rev))
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

function pad(
  v: Voice,
  t: number,
  freqs: number[],
  dur: number,
  o: { vol?: number; cutoff?: number; rev?: number; attack?: number; type?: OscillatorType } = {},
) {
  const { vol = 0.04, cutoff = 900, rev = 0.35, attack = 0.5, type = 'sawtooth' } = o
  const lp = v.ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = cutoff
  const g = v.ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + attack)
  g.gain.setValueAtTime(vol, t + Math.max(attack, dur - 0.1))
  g.gain.linearRampToValueAtTime(0, t + dur + 0.7)
  lp.connect(g)
  g.connect(v.out)
  const s = v.ctx.createGain()
  s.gain.value = rev
  g.connect(s)
  s.connect(v.rev)
  for (const f of freqs) {
    for (const cents of [-7, 7]) {
      const osc = v.ctx.createOscillator()
      osc.type = type
      osc.frequency.value = f
      osc.detune.value = cents
      osc.connect(lp)
      osc.start(t)
      osc.stop(t + dur + 0.8)
    }
  }
}

function bass(v: Voice, t: number, f: number, dur: number, vol = 0.2) {
  const osc = v.ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.value = f
  const lp = v.ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 380
  lp.Q.value = 2
  const g = v.ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.006)
  g.gain.setValueAtTime(vol, t + dur * 0.8)
  g.gain.linearRampToValueAtTime(0, t + dur)
  osc.connect(lp)
  lp.connect(g)
  g.connect(v.out)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

/** Lonceng / kotak musik: parsial tidak harmonis memberi warna logam. */
function bell(v: Voice, t: number, f: number, o: { vol?: number; dur?: number; rev?: number } = {}) {
  const { vol = 0.05, dur = 2.2, rev = 0.5 } = o
  const partials: [number, number, number][] = [
    [1, 1, 1],
    [2.756, 0.35, 0.6],
    [5.404, 0.12, 0.35],
  ]
  for (const [ratio, amp, len] of partials) {
    const osc = v.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = f * ratio
    osc.connect(env(v, t, vol * amp, 0.003, dur * len, rev))
    osc.start(t)
    osc.stop(t + dur * len + 0.05)
  }
}

function beep(v: Voice, t: number, f = 1850, vol = 0.035) {
  const osc = v.ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.value = f
  const lp = v.ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 3800
  osc.connect(lp)
  lp.connect(env(v, t, vol, 0.002, 0.07))
  osc.start(t)
  osc.stop(t + 0.1)
}

/** Derit logam: noise lewat bandpass sempit yang frekuensinya bergeser. */
function creak(v: Voice, t: number, vol = 0.035) {
  const src = noiseSource(v, t, 0.6)
  const f = v.ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = 14
  f.frequency.setValueAtTime(320 + Math.random() * 200, t)
  f.frequency.exponentialRampToValueAtTime(700 + Math.random() * 500, t + 0.25)
  f.frequency.exponentialRampToValueAtTime(400, t + 0.55)
  src.connect(f)
  f.connect(env(v, t, vol, 0.05, 0.5, 0.6))
}

function riser(v: Voice, t: number, dur: number, vol = 0.04) {
  const src = noiseSource(v, t, dur)
  const f = v.ctx.createBiquadFilter()
  f.type = 'highpass'
  f.frequency.setValueAtTime(400, t)
  f.frequency.exponentialRampToValueAtTime(6000, t + dur)
  const g = v.ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.95)
  g.gain.linearRampToValueAtTime(0, t + dur)
  src.connect(f)
  f.connect(g)
  g.connect(v.out)
}

/** Drone horor yang berbunyi terus: dua sinus rendah yang saling berdenyut + angin (noise terfilter). */
function drone(v: Voice, t: number): () => void {
  const nodes: AudioScheduledSourceNode[] = []
  const g = v.ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.07, t + 3)
  g.connect(v.out)
  for (const f of [55, 55.7, 82.4]) {
    const o = v.ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    o.connect(g)
    o.start(t)
    nodes.push(o)
  }
  const wind = v.ctx.createBufferSource()
  wind.buffer = v.noise
  wind.loop = true
  const bp = v.ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 420
  bp.Q.value = 1.2
  const lfo = v.ctx.createOscillator()
  lfo.frequency.value = 0.06
  const lfoGain = v.ctx.createGain()
  lfoGain.gain.value = 220
  lfo.connect(lfoGain)
  lfoGain.connect(bp.frequency)
  const wg = v.ctx.createGain()
  wg.gain.value = 0.022
  wind.connect(bp)
  bp.connect(wg)
  wg.connect(v.out)
  wg.connect(v.rev)
  wind.start(t)
  lfo.start(t)
  nodes.push(wind, lfo)
  return () => nodes.forEach((n) => n.stop())
}

/* ---------- Lagu ---------- */

interface Song {
  bpm: number
  reverb: number
  start?: (v: Voice, t: number) => () => void
  step: (v: Voice, i: number, t: number, spb: number) => void
}

const VAL_CHORDS = [
  { root: 38, arp: [62, 65, 69, 74], pad: [50, 57, 62, 65] },
  { root: 34, arp: [58, 62, 65, 70], pad: [46, 53, 58, 62] },
  { root: 41, arp: [65, 69, 72, 77], pad: [53, 57, 60, 65] },
  { root: 36, arp: [60, 64, 67, 72], pad: [48, 55, 60, 64] },
]
const VAL_ARP = [0, 2, 1, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2]

const CS_CHORDS = [
  { root: 40, pad: [40, 47, 52], stab: [52, 59, 64] },
  { root: 41, pad: [41, 48, 53], stab: [53, 60, 65] },
  { root: 40, pad: [40, 47, 52], stab: [52, 59, 64] },
  { root: 38, pad: [38, 45, 50], stab: [50, 57, 62] },
]
const CS_TOMS: Record<number, number> = { 0: 70, 3: 95, 6: 70, 8: 120, 11: 95, 12: 70, 14: 105 }

const ML_CHORDS = [
  { root: 38, run: [50, 53, 57, 62, 65, 69, 74, 69], pad: [50, 57, 62, 65], choir: [69, 74] },
  { root: 34, run: [46, 50, 53, 58, 62, 65, 70, 65], pad: [46, 53, 58, 62], choir: [65, 70] },
  { root: 41, run: [53, 57, 60, 65, 69, 72, 77, 72], pad: [53, 57, 60, 65], choir: [69, 72] },
  { root: 36, run: [48, 52, 55, 60, 64, 67, 72, 67], pad: [48, 55, 60, 64], choir: [67, 72] },
]

/** Tangga nada kotak musik R.E.P.O.: minor dengan nada tritone supaya terasa janggal. */
const REPO_SCALE = [69, 72, 75, 76, 79, 81, 84]

const SONGS: Record<GameId, Song> = {
  valorant: {
    bpm: 104,
    reverb: 0.28,
    step(v, i, t, spb) {
      const bar = Math.floor(i / 16) % 4
      const pos = i % 16
      const cycle = Math.floor(i / 64)
      const ch = VAL_CHORDS[bar]
      if (pos === 0) pad(v, t, ch.pad.map(midi), 16 * spb, { vol: 0.03, cutoff: 1100, rev: 0.35, attack: 0.6 })
      if (pos === 0 || pos === 8 || (pos === 10 && bar % 2 === 1)) kick(v, t, { vol: 0.75 })
      if (pos === 4 || pos === 12) snare(v, t, 0.17)
      if (pos % 2 === 0) hat(v, t, { vol: pos % 4 === 2 ? 0.07 : 0.04 })
      if (pos === 14) hat(v, t, { vol: 0.06, dur: 0.16 })
      if ([0, 3, 6, 8, 11, 14].includes(pos)) bass(v, t, midi(ch.root), spb * 1.6, 0.18)
      // Arpeggio masuk setelah intro 2 bar; filter bergerak pelan supaya tidak monoton.
      if (cycle > 0 || bar >= 2) {
        const sweep = 0.5 + 0.5 * Math.sin((i / 64) * Math.PI * 2)
        pluck(v, t, midi(ch.arp[VAL_ARP[pos]]), { vol: 0.04, dur: spb * 1.8, cutoff: 900 + 2200 * sweep, rev: 0.25 })
      }
      if (bar === 3 && pos === 8) riser(v, t, 8 * spb, 0.035)
    },
  },
  cs2: {
    bpm: 92,
    reverb: 0.22,
    step(v, i, t, spb) {
      const bar = Math.floor(i / 16) % 4
      const pos = i % 16
      const cycle = Math.floor(i / 64)
      const ch = CS_CHORDS[bar]
      if (pos === 0) pad(v, t, ch.pad.map(midi), 16 * spb, { vol: 0.045, cutoff: 650, rev: 0.3, attack: 0.8 })
      if (CS_TOMS[pos]) tom(v, t, CS_TOMS[pos], pos === 0 ? 0.5 : 0.36)
      if (pos % 4 === 0) hat(v, t, { vol: 0.05, dur: 0.018, hp: 9000 })
      if (bar === 3 && pos >= 12) snare(v, t, 0.06 + 0.035 * (pos - 12), 0.05)
      if ((bar === 0 || bar === 2) && pos === 0) {
        for (const n of ch.stab) pluck(v, t, midi(n), { vol: 0.04, dur: 0.5, cutoff: 1400, rev: 0.3 })
      }
      if (pos === 0 || pos === 10) bass(v, t, midi(ch.root - 12), spb * 3, 0.16)
      // Bunyi bom yang sudah ditanam: jarang di awal, makin sering di putaran berikutnya.
      if (pos === 0 && bar % 2 === 0) beep(v, t)
      if (cycle % 2 === 1 && pos === 8) beep(v, t)
    },
  },
  mlbb: {
    bpm: 84,
    reverb: 0.45,
    step(v, i, t, spb) {
      const bar = Math.floor(i / 16) % 4
      const pos = i % 16
      const cycle = Math.floor(i / 64)
      const ch = ML_CHORDS[bar]
      if (pos === 0) {
        pad(v, t, ch.pad.map(midi), 16 * spb, { vol: 0.035, cutoff: 1500, rev: 0.55, attack: 0.9 })
        pad(v, t, ch.choir.map(midi), 16 * spb, { vol: 0.018, cutoff: 2600, rev: 0.7, attack: 1.3, type: 'triangle' })
        bass(v, t, midi(ch.root), 16 * spb * 0.9, 0.1)
      }
      if (pos % 2 === 0) pluck(v, t, midi(ch.run[pos / 2]), { vol: 0.06, dur: 0.9, type: 'triangle', cutoff: 3600, rev: 0.45 })
      if (pos === 0 || pos === 10) kick(v, t, { vol: 0.62, f0: 95, f1: 42, dur: 0.7, rev: 0.35 })
      if (pos === 12 && bar % 2 === 1) tom(v, t, 150, 0.3, 0.5, 0.4)
      if (pos === 0 && bar === 0 && cycle > 0) bell(v, t, midi(86), { vol: 0.035, rev: 0.6 })
    },
  },
  repo: {
    bpm: 70,
    reverb: 0.55,
    start: drone,
    step(v, i, t) {
      const bar = Math.floor(i / 16) % 4
      const pos = i % 16
      const cycle = Math.floor(i / 64)
      if (pos % 4 === 0 && Math.random() < 0.38) {
        const note = REPO_SCALE[Math.floor(Math.random() * REPO_SCALE.length)]
        bell(v, t, midi(note) * Math.pow(2, (Math.random() - 0.5) * 0.02), { vol: 0.04, dur: 3, rev: 0.7 })
      }
      // Detak jantung: lub-dub setiap dua bar.
      if (bar % 2 === 0 && (pos === 0 || pos === 3)) kick(v, t, { vol: pos === 0 ? 0.34 : 0.24, f0: 70, f1: 38, dur: 0.32 })
      if (Math.random() < 0.05) creak(v, t)
      if (bar === 0 && pos === 0 && cycle % 2 === 0) kick(v, t, { vol: 0.4, f0: 55, f1: 28, dur: 1.6, rev: 0.6 })
    },
  },
}

export const SONG_TITLES: Record<GameId, string> = {
  valorant: 'Protocol',
  cs2: 'Freeze Time',
  mlbb: 'Land of Dawn',
  repo: 'Night Shift',
}

/** Penjadwal langkah 1/16 yang bisa dipakai context online (real-time) maupun offline (render). */
export class Sequencer {
  private v: Voice
  private song: Song
  private spb: number
  private step = 0
  private next: number
  private stopDrone: (() => void) | null = null

  constructor(ctx: BaseAudioContext, dest: AudioNode, game: GameId, startAt: number) {
    this.song = SONGS[game]
    this.spb = 60 / this.song.bpm / 4
    const rev = ctx.createConvolver()
    rev.buffer = makeImpulse(ctx)
    const revOut = ctx.createGain()
    revOut.gain.value = this.song.reverb
    rev.connect(revOut)
    revOut.connect(dest)
    this.v = { ctx, out: dest, rev, noise: makeNoise(ctx) }
    this.next = startAt
    if (this.song.start) this.stopDrone = this.song.start(this.v, startAt)
  }

  scheduleUntil(time: number) {
    while (this.next < time) {
      this.song.step(this.v, this.step, this.next, this.spb)
      this.step++
      this.next += this.spb
    }
  }

  dispose() {
    this.stopDrone?.()
  }
}

export interface Playback {
  stop(): void
}

/** Mainkan musik bawaan secara real-time di AudioContext yang sudah di-resume. */
export function startSong(ctx: AudioContext, game: GameId, volume = 0.55): Playback {
  const master = ctx.createGain()
  master.gain.setValueAtTime(0, ctx.currentTime)
  master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.6)
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.ratio.value = 3
  comp.attack.value = 0.005
  comp.release.value = 0.25
  const bus = ctx.createGain()
  bus.connect(comp)
  comp.connect(master)
  master.connect(ctx.destination)

  const seq = new Sequencer(ctx, bus, game, ctx.currentTime + 0.1)
  const tick = () => seq.scheduleUntil(ctx.currentTime + 0.15)
  tick()
  const timer = window.setInterval(tick, 25)
  let stopped = false

  return {
    stop() {
      if (stopped) return
      stopped = true
      const now = ctx.currentTime
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(master.gain.value, now)
      master.gain.linearRampToValueAtTime(0, now + 0.6)
      window.setTimeout(() => {
        window.clearInterval(timer)
        seq.dispose()
        master.disconnect()
      }, 700)
    },
  }
}
