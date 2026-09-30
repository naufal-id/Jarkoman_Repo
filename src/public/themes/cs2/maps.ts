// Data overview resmi CS2 (posisi ikon loading screen dari resource/overviews/*.txt) dan aset map
// (radar, emblem, screenshot pemilihan map). Aset milik Valve, diekstrak dari depot game oleh
// github.com/MurkyYT/cs2-map-icons lalu dikonversi ke WebP.

const files = import.meta.glob<string>('./maps/*.webp', { eager: true, query: '?url', import: 'default' })
const asset = (name: string) => files[`./maps/${name}.webp`]

export interface MapPoint {
  x: number
  y: number
}

export interface MapMark extends MapPoint {
  /** A/B = bombsite, H = sandera (map hostage) */
  kind: 'A' | 'B' | 'H'
  /** Ada di radar lantai bawah (hanya site B Nuke). Spawn dan ikon lain ada di lantai atas. */
  lower?: boolean
}

export interface Cs2Map {
  code: string
  radar: string
  /** Radar lantai bawah untuk map bertingkat (Nuke, Train, Vertigo) */
  lower?: string
  icon: string
  shot: string
  ct: MapPoint
  t: MapPoint
  marks: MapMark[]
  /** Potongan persegi yang ditampilkan (0 sampai 1): area berisi map, supaya margin kosong radar tidak memperkecil map */
  view: { x: number; y: number; size: number }
  /** Warna khas map (rata-rata berbobot saturasi dari screenshot pemilihan map), untuk cahaya latar halaman */
  tint?: string
}

export const CS2_MAPS: Record<string, Cs2Map> = {
  Ancient: {
    code: 'de_ancient',
    radar: asset('de_ancient-radar'),
    icon: asset('de_ancient-icon'),
    shot: asset('de_ancient-shot'),
    ct: { x: 0.51, y: 0.17 },
    t: { x: 0.485, y: 0.87 },
    marks: [
      { kind: 'A', x: 0.31, y: 0.25 },
      { kind: 'B', x: 0.8, y: 0.4 },
    ],
    view: { x: 0.043, y: 0.049, size: 0.89 },
    tint: '#5f9a5a',
  },
  // File overview Anubis dibuat auto-radar tanpa bombsite dan posisi spawn-nya meleset, jadi diukur dari radarnya.
  Anubis: {
    code: 'de_anubis',
    radar: asset('de_anubis-radar'),
    icon: asset('de_anubis-icon'),
    shot: asset('de_anubis-shot'),
    ct: { x: 0.42, y: 0.22 },
    t: { x: 0.47, y: 0.9 },
    marks: [
      { kind: 'A', x: 0.752, y: 0.25 },
      { kind: 'B', x: 0.327, y: 0.493 },
    ],
    view: { x: 0, y: 0, size: 1 },
    tint: '#d4a646',
  },
  'Dust II': {
    code: 'de_dust2',
    radar: asset('de_dust2-radar'),
    icon: asset('de_dust2-icon'),
    shot: asset('de_dust2-shot'),
    ct: { x: 0.62, y: 0.21 },
    t: { x: 0.39, y: 0.91 },
    marks: [
      { kind: 'A', x: 0.8, y: 0.16 },
      { kind: 'B', x: 0.21, y: 0.12 },
    ],
    view: { x: 0, y: 0, size: 1 },
    tint: '#c9a26b',
  },
  Inferno: {
    code: 'de_inferno',
    radar: asset('de_inferno-radar'),
    icon: asset('de_inferno-icon'),
    shot: asset('de_inferno-shot'),
    ct: { x: 0.9, y: 0.35 },
    t: { x: 0.1, y: 0.67 },
    marks: [
      { kind: 'A', x: 0.81, y: 0.69 },
      { kind: 'B', x: 0.49, y: 0.22 },
    ],
    view: { x: 0.033, y: 0.025, size: 0.943 },
    tint: '#c8703f',
  },
  Mirage: {
    code: 'de_mirage',
    radar: asset('de_mirage-radar'),
    icon: asset('de_mirage-icon'),
    shot: asset('de_mirage-shot'),
    ct: { x: 0.28, y: 0.7 },
    t: { x: 0.87, y: 0.36 },
    marks: [
      { kind: 'A', x: 0.54, y: 0.76 },
      { kind: 'B', x: 0.23, y: 0.28 },
    ],
    view: { x: 0.081, y: 0.069, size: 0.865 },
    tint: '#c99a62',
  },
  Nuke: {
    code: 'de_nuke',
    radar: asset('de_nuke-radar'),
    lower: asset('de_nuke-lower'),
    icon: asset('de_nuke-icon'),
    shot: asset('de_nuke-shot'),
    ct: { x: 0.82, y: 0.45 },
    t: { x: 0.19, y: 0.54 },
    marks: [
      { kind: 'A', x: 0.58, y: 0.48 },
      { kind: 'B', x: 0.58, y: 0.58, lower: true },
    ],
    view: { x: 0.035, y: 0.029, size: 0.969 },
    tint: '#6eaee0',
  },
  Overpass: {
    code: 'de_overpass',
    radar: asset('de_overpass-radar'),
    icon: asset('de_overpass-icon'),
    shot: asset('de_overpass-shot'),
    ct: { x: 0.49, y: 0.2 },
    t: { x: 0.66, y: 0.93 },
    marks: [
      { kind: 'A', x: 0.55, y: 0.23 },
      { kind: 'B', x: 0.7, y: 0.31 },
    ],
    view: { x: 0, y: 0, size: 1 },
    tint: '#8fa36a',
  },
  Train: {
    code: 'de_train',
    radar: asset('de_train-radar'),
    lower: asset('de_train-lower'),
    icon: asset('de_train-icon'),
    shot: asset('de_train-shot'),
    ct: { x: 0.86, y: 0.77 },
    t: { x: 0.12, y: 0.25 },
    marks: [
      { kind: 'A', x: 0.63, y: 0.49 },
      { kind: 'B', x: 0.52, y: 0.76 },
    ],
    view: { x: 0, y: 0, size: 1 },
    tint: '#7a8cae',
  },
  Cache: {
    code: 'de_cache',
    radar: asset('de_cache-radar'),
    icon: asset('de_cache-icon'),
    shot: asset('de_cache-shot'),
    ct: { x: 0.098, y: 0.473 },
    t: { x: 0.887, y: 0.585 },
    marks: [
      { kind: 'A', x: 0.325, y: 0.26 },
      { kind: 'B', x: 0.345, y: 0.79 },
    ],
    view: { x: 0.004, y: 0.031, size: 0.965 },
    tint: '#7fa3b0',
  },
  Vertigo: {
    code: 'de_vertigo',
    radar: asset('de_vertigo-radar'),
    lower: asset('de_vertigo-lower'),
    icon: asset('de_vertigo-icon'),
    shot: asset('de_vertigo-shot'),
    ct: { x: 0.54, y: 0.25 },
    t: { x: 0.2, y: 0.75 },
    marks: [
      { kind: 'A', x: 0.705, y: 0.585 },
      { kind: 'B', x: 0.222, y: 0.223 },
    ],
    view: { x: 0.088, y: 0.12, size: 0.745 },
    tint: '#7197cc',
  },
  Office: {
    code: 'cs_office',
    radar: asset('cs_office-radar'),
    icon: asset('cs_office-icon'),
    shot: asset('cs_office-shot'),
    ct: { x: 0.16, y: 0.89 },
    t: { x: 0.78, y: 0.3 },
    marks: [
      { kind: 'H', x: 0.84, y: 0.27 },
      { kind: 'H', x: 0.84, y: 0.48 },
      { kind: 'H', x: 0.91, y: 0.48 },
      { kind: 'H', x: 0.77, y: 0.48 },
      { kind: 'H', x: 0.77, y: 0.55 },
    ],
    view: { x: 0, y: 0, size: 1 },
    tint: '#6f9cc0',
  },
  Italy: {
    code: 'cs_italy',
    radar: asset('cs_italy-radar'),
    icon: asset('cs_italy-icon'),
    shot: asset('cs_italy-shot'),
    ct: { x: 0.41, y: 0.91 },
    t: { x: 0.6, y: 0.1 },
    marks: [
      { kind: 'H', x: 0.43, y: 0.29 },
      { kind: 'H', x: 0.48, y: 0.24 },
      { kind: 'H', x: 0.64, y: 0.03 },
      { kind: 'H', x: 0.72, y: 0.05 },
    ],
    view: { x: 0, y: 0, size: 1 },
    tint: '#cf7a4a',
  },
}
