import { useState, useEffect } from 'react'
import type { SensorNode } from '../types'
import { useTheme } from '../context/ThemeContext'

/* ------------------------------------------------------------------ *
 * Geological strata
 * depth values are SVG px measured down from the surface (SY).
 * Scale: 24px = 25m (matches the depth axis), so ~1.04 m per px.
 * Each layer carries a top->bottom gradient, a procedural grain
 * filter, an overlay texture pattern, and 2-4 internal sub-bands so
 * it reads as deposited sediment rather than a flat fill.
 * ------------------------------------------------------------------ */
const STRATA = [
  {
    label: 'TOPSOIL',
    note: 'O/A horizon',
    from: 0, to: 15,
    light: ['#5F4028', '#7A5936', '#4C331F'],
    dark: ['#372416', '#4A3220', '#2A1B10'],
    texture: 'organic',
    grain: 'fine',
    wave: 1.3,
    seed: 0.4,
    bands: 3,
  },
  {
    label: 'ALLUVIUM',
    note: 'gravel · subsoil',
    from: 15, to: 40,
    light: ['#8F7350', '#A88E68', '#7A6244'],
    dark: ['#5E4C34', '#6E5A3D', '#4A3B28'],
    texture: 'gravel',
    grain: 'coarse',
    wave: 2.6,
    seed: 1.7,
    bands: 3,
  },
  {
    label: 'SANDSTONE',
    note: 'aquifer',
    from: 40, to: 82,
    light: ['#C2A473', '#D3B686', '#B39561', '#C7AA78'],
    dark: ['#83693F', '#93794C', '#735B34', '#886E43'],
    texture: 'sand',
    grain: 'medium',
    wave: 3,
    seed: 2.9,
    bands: 5,
  },
  {
    label: 'SHALE',
    note: 'laminated',
    from: 82, to: 108,
    light: ['#66605A', '#767068', '#524C46'],
    dark: ['#463F3A', '#524B45', '#37312C'],
    texture: 'shale',
    grain: 'fine',
    wave: 2.2,
    seed: 4.1,
    bands: 4,
  },
  {
    label: 'COAL SEAM',
    note: 'worked',
    from: 108, to: 138,
    light: ['#1B1614', '#242019', '#0E0B09'],
    dark: ['#120E0C', '#1A1512', '#070504'],
    texture: 'coal',
    grain: 'fine',
    wave: 1.7,
    seed: 5.3,
    bands: 3,
  },
  {
    label: 'MUDSTONE',
    note: 'floor',
    from: 138, to: 178,
    light: ['#6F5340', '#7F614C', '#5C4433'],
    dark: ['#4C3729', '#5A4232', '#3B2A1F'],
    texture: 'mud',
    grain: 'medium',
    wave: 2,
    seed: 6.6,
    bands: 3,
  },
]

// Pillars: x is their SVG x position (content starts at x=32, runs 768px wide)
const PILLARS = [
  { id: 3,  x: 147, panel: 'Panel 1', risk: 'LOW' },
  { id: 4,  x: 247, panel: 'Panel 1', risk: 'LOW' },
  { id: 12, x: 362, panel: 'Panel 2', risk: 'HIGH' },
  { id: 13, x: 460, panel: 'Panel 2', risk: 'HIGH' },
  { id: 14, x: 538, panel: 'Panel 2', risk: 'HIGH' },
  { id: 15, x: 638, panel: 'Panel 2', risk: 'HIGH' },
]

// Content area: x=32..800, y=22..200 (depth 0..178px)
const CX = 32     // content x start
const CW = 768    // content width
const SY = 22     // surface y (top of strata)
const MAXD = 178  // deepest drawn depth
const STEPS = 96  // boundary resolution
const MPX = 25 / 24 // metres per SVG pixel

// Subsidence trough spans the Panel 2 zone
const P2_START = CX + 0.38 * CW
const P2_END   = CX + 0.88 * CW

interface Props {
  nodes: SensorNode[]
  selectedNode: number | null
  activePanel: string
}

export default function CrossSection({ nodes, selectedNode, activePanel }: Props) {
  const { colors } = useTheme()
  const [expanded, setExpanded] = useState(false)
  const [sagAmt, setSagAmt] = useState(0)

  const RISK_COLOR: Record<string, string> = colors.isDark
    ? { LOW: '#4C8C6B', MEDIUM: '#D98E3B', HIGH: '#B3492E' }
    : { LOW: '#15803D', MEDIUM: '#B45309', HIGH: '#DC2626' }

  function pillarColor(risk: string) { return RISK_COLOR[risk] ?? RISK_COLOR.LOW }

  const hasHigh = nodes.some(n => n.risk === 'HIGH' && (activePanel === 'All' || n.panel === activePanel))

  // Animate sag in/out
  useEffect(() => {
    const target = hasHigh ? 24 : 0
    if (sagAmt === target) return
    const dir = hasHigh ? 1 : -1
    const t = setTimeout(() => setSagAmt(p => Math.max(0, Math.min(24, p + dir))), 28)
    return () => clearTimeout(t)
  }, [sagAmt, hasHigh])

  /* --------------------------------------------------------------- *
   * Geometry helpers
   * --------------------------------------------------------------- */

  // Bell-shaped trough profile across the mined-out span (0..1)
  function sagProfile(x: number) {
    if (x <= P2_START - 30 || x >= P2_END + 30) return 0
    const t = (x - (P2_START - 30)) / ((P2_END + 30) - (P2_START - 30))
    return 0.5 * (1 - Math.cos(2 * Math.PI * t))
  }

  // Strata above the worked seam sag; the floor below it does not.
  function sagDamping(depth: number) {
    if (depth <= 108) return 1 - (depth / 108) * 0.28
    if (depth >= 138) return 0
    return 0.72 * (1 - (depth - 108) / 30)
  }

  function sagAt(x: number, depth: number) {
    return sagProfile(x) * sagAmt * sagDamping(depth)
  }

  // An irregular (non-straight) bedding boundary at a given depth.
  // Four octaves of sine noise at different frequencies/phases give an
  // eroded, unconformity-like contact instead of a smooth wave.
  function boundary(depth: number, amp: number, seed: number) {
    const pts: string[] = []
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS
      const x = CX + CW * t
      const wob =
        Math.sin(t * 6.2 + seed) * amp * 0.42 +
        Math.sin(t * 14.5 + seed * 1.9) * amp * 0.28 +
        Math.sin(t * 33 + seed * 3.1) * amp * 0.16 +
        Math.sin(t * 61 + seed * 5.7) * amp * 0.09
      const y = SY + depth + wob + sagAt(x, depth)
      pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`)
    }
    return pts
  }

  function layerPath(s: typeof STRATA[number]) {
    const top = boundary(s.from, s.wave, s.seed)
    const bot = boundary(s.to, s.wave, s.seed + 0.9).reverse()
    return `M ${top.join(' L ')} L ${bot.join(' L ')} Z`
  }

  // Top of the topsoil = ground surface, reused for the highlight line + grass
  const surfacePts = boundary(0, STRATA[0].wave, STRATA[0].seed)
  const surfaceLine = `M ${surfacePts.join(' L ')}`

  function surfaceYAt(x: number) {
    const t = (x - CX) / CW
    const s = STRATA[0]
    const wob =
      Math.sin(t * 6.2 + s.seed) * s.wave * 0.42 +
      Math.sin(t * 14.5 + s.seed * 1.9) * s.wave * 0.28 +
      Math.sin(t * 33 + s.seed * 3.1) * s.wave * 0.16 +
      Math.sin(t * 61 + s.seed * 5.7) * s.wave * 0.09
    return SY + wob + sagAt(x, 0)
  }

  // Compute sensor node SVG positions — filter by active panel
  const csNodes = nodes
    .filter(n => activePanel === 'All' || n.panel === activePanel)
    .map(n => {
      const svgX = CX + n.csX * CW
      return { ...n, svgX, groundY: surfaceYAt(svgX) }
    })

  const sagMid = (P2_START + P2_END) / 2
  const sagMidY = surfaceYAt(sagMid)

  /* --------------------------------------------------------------- *
   * Palette values shared across textures
   * --------------------------------------------------------------- */
  const grassA = colors.isDark ? '#3E6437' : '#4E8235'
  const grassB = colors.isDark ? '#5A8348' : '#6FA348'
  const grassC = colors.isDark ? '#2E4E29' : '#3B6428'
  const waterCol = colors.isDark ? '#6FA8DC' : '#2F7FD1'
  const rockLine = colors.isDark ? '#E4D6B8' : '#FFF6E2'
  const pebbleLt = colors.isDark ? '#C4B191' : '#E9D7AF'
  const pebbleDk = colors.isDark ? '#332A20' : '#4E3D27'

  const panelHeight = expanded ? 240 : 172

  // Grass tuft positions along the surface (irregular spacing feels less mechanical)
  const tufts: number[] = []
  { let x = CX + 6; let i = 0
    while (x < CX + CW - 4) { tufts.push(x); x += 12 + ((i * 37) % 11); i++ } }

  // Scattered surface pebbles/clumps between tufts
  const clumps: number[] = []
  { let x = CX + 14; let i = 0
    while (x < CX + CW - 8) { clumps.push(x); x += 26 + ((i * 53) % 19); i++ } }

  return (
    <div
      className="flex flex-col rounded-md"
      style={{
        height: `${panelHeight}px`,
        background: colors.bgCanvas,
        border: `1px solid ${colors.borderPrimary}`,
        boxShadow: colors.shadowSm,
        transition: 'height 0.28s ease, background-color 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0 cursor-pointer select-none"
        style={{ borderBottom: `1px solid ${colors.borderPrimary}`, background: colors.bgCardSubtle }}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif', color: colors.accent }}>
            CROSS-SECTION
          </span>
          <span className="text-[10px]" style={{ color: colors.textMuted }}>—</span>
          <span className="text-[10px]" style={{ color: colors.textMuted, fontFamily: 'IBM Plex Mono, monospace' }}>
            Geological Layers · Pillars · Subsidence
          </span>
          {hasHigh && sagAmt > 4 && (
            <span className="text-[10px] px-2 py-0.5 rounded pulse-high font-semibold" style={{ fontFamily: 'IBM Plex Mono, monospace', color: RISK_COLOR.HIGH, background: colors.isDark ? 'rgba(179,73,46,0.15)' : 'rgba(220,38,38,0.12)', border: `1px solid ${RISK_COLOR.HIGH}44` }}>
              ⚠ SUBSIDENCE ACTIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px]" style={{ color: colors.textMuted, fontFamily: 'IBM Plex Mono, monospace' }}>
            0m surface → −108m coal seam
          </span>
          <span className="text-[10px] font-bold" style={{ color: colors.accent, fontFamily: 'IBM Plex Mono, monospace' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* SVG Cross-section */}
      <div className="flex-1 overflow-hidden">
        <svg
          viewBox="0 0 820 200"
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Per-layer vertical gradients (multi-stop for banded sediment look) */}
            {STRATA.map(s => {
              const stops = colors.isDark ? s.dark : s.light
              return (
                <linearGradient key={`g-${s.label}`} id={`cs-g-${s.texture}`} x1="0" y1="0" x2="0" y2="1">
                  {stops.map((c, i) => (
                    <stop key={i} offset={`${(i / (stops.length - 1)) * 100}%`} stopColor={c} />
                  ))}
                </linearGradient>
              )
            })}

            {/* Procedural grain noise — one per grain size, reused across layers */}
            <filter id="cs-noise-fine" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9 0.35" numOctaves="2" seed="7" result="n" />
              <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.9 0.9 0.9 0 -0.55" result="a" />
              <feComponentTransfer in="a" result="a2"><feFuncA type="linear" slope="0.5" /></feComponentTransfer>
              <feBlend in="SourceGraphic" in2="a2" mode="multiply" />
            </filter>
            <filter id="cs-noise-medium" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.35 0.18" numOctaves="3" seed="14" result="n" />
              <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 1 1 0 -0.5" result="a" />
              <feComponentTransfer in="a" result="a2"><feFuncA type="linear" slope="0.55" /></feComponentTransfer>
              <feBlend in="SourceGraphic" in2="a2" mode="multiply" />
            </filter>
            <filter id="cs-noise-coarse" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.14 0.09" numOctaves="3" seed="21" result="n" />
              <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.1 1.1 1.1 0 -0.45" result="a" />
              <feComponentTransfer in="a" result="a2"><feFuncA type="linear" slope="0.6" /></feComponentTransfer>
              <feBlend in="SourceGraphic" in2="a2" mode="multiply" />
            </filter>

            {/* Organic topsoil: root threads + humus specks */}
            <pattern id="cs-tx-organic" width="26" height="15" patternUnits="userSpaceOnUse">
              <path d="M4 0 C5 5 3 8 6 14" fill="none" stroke="#170D06" strokeWidth="0.5" opacity="0.4" />
              <path d="M17 1 C15 6 19 9 16 15" fill="none" stroke="#170D06" strokeWidth="0.4" opacity="0.32" />
              <path d="M23 2 C22 6 24 9 21 14" fill="none" stroke="#170D06" strokeWidth="0.35" opacity="0.24" />
              <circle cx="10" cy="5" r="0.7" fill="#0B0603" opacity="0.45" />
              <circle cx="22" cy="9" r="0.6" fill="#0B0603" opacity="0.4" />
              <circle cx="13" cy="12" r="0.5" fill={rockLine} opacity="0.2" />
              <circle cx="2" cy="7" r="0.45" fill={rockLine} opacity="0.16" />
            </pattern>

            {/* Alluvium: rounded gravel clasts with a highlight + shadow edge for a 3-D pebble look */}
            <pattern id="cs-tx-gravel" width="32" height="24" patternUnits="userSpaceOnUse">
              {[
                [6, 6, 3.1, 2.3], [19, 4, 2, 1.5], [27, 12, 2.6, 1.9],
                [12, 15, 3.4, 2.3], [2, 19, 2.1, 1.5], [23, 20, 2.4, 1.6], [30, 3, 1.1, 0.9],
              ].map(([cx, cy, rx, ry], i) => (
                <g key={i}>
                  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={i % 2 ? pebbleDk : pebbleLt} opacity="0.5" />
                  <ellipse cx={cx - rx * 0.3} cy={cy - ry * 0.3} rx={rx * 0.35} ry={ry * 0.25} fill={rockLine} opacity="0.28" />
                  <path d={`M ${cx - rx} ${cy + ry * 0.2} A ${rx} ${ry} 0 0 0 ${cx + rx * 0.6} ${cy + ry * 0.8}`} fill="none" stroke="#000" strokeWidth="0.4" opacity="0.22" />
                </g>
              ))}
            </pattern>

            {/* Sandstone: cross-bedding sweeps (Liesegang-style curves) + grain stipple */}
            <pattern id="cs-tx-sand" width="46" height="16" patternUnits="userSpaceOnUse">
              <path d="M0 12 Q11 5 23 11 T46 10" fill="none" stroke={pebbleDk} strokeWidth="0.5" opacity="0.34" />
              <path d="M0 5 Q13 1 25 6 T46 4" fill="none" stroke={rockLine} strokeWidth="0.45" opacity="0.24" />
              <path d="M0 15 Q10 10 22 14 T46 13" fill="none" stroke={pebbleDk} strokeWidth="0.35" opacity="0.2" />
              {[[5,7],[14,12],[24,6],[33,12],[37,7],[42,14],[9,3],[29,3]].map(([cx,cy],i)=>(
                <circle key={i} cx={cx} cy={cy} r={i%2?0.4:0.5} fill={i%3===0?rockLine:pebbleDk} opacity={i%3===0?0.3:0.4} />
              ))}
            </pattern>

            {/* Shale: fine fissile laminations, slightly offset per band for a sheared look */}
            <pattern id="cs-tx-shale" width="38" height="7" patternUnits="userSpaceOnUse">
              <line x1="0" y1="1.4" x2="24" y2="1.1" stroke="#050403" strokeWidth="0.45" opacity="0.4" />
              <line x1="26" y1="1.2" x2="38" y2="1.6" stroke="#050403" strokeWidth="0.45" opacity="0.32" />
              <line x1="0" y1="3.6" x2="16" y2="3.9" stroke={rockLine} strokeWidth="0.32" opacity="0.14" />
              <line x1="18" y1="3.7" x2="38" y2="3.5" stroke="#050403" strokeWidth="0.4" opacity="0.3" />
              <line x1="2" y1="5.8" x2="30" y2="6.1" stroke="#050403" strokeWidth="0.35" opacity="0.22" />
            </pattern>

            {/* Coal: vitreous conchoidal sheen + cleat joints */}
            <pattern id="cs-tx-coal" width="28" height="18" patternUnits="userSpaceOnUse">
              <path d="M0 14 L28 5" stroke="#C7BFAE" strokeWidth="0.5" opacity="0.18" />
              <path d="M0 4 L28 16" stroke="#C7BFAE" strokeWidth="0.35" opacity="0.11" />
              <path d="M6 0 L20 18" stroke="#C7BFAE" strokeWidth="0.3" opacity="0.08" />
              <line x1="9" y1="0" x2="9" y2="18" stroke="#000000" strokeWidth="0.6" opacity="0.55" />
              <line x1="22" y1="0" x2="22" y2="18" stroke="#000000" strokeWidth="0.5" opacity="0.42" />
              <circle cx="15" cy="10" r="0.6" fill="#E0D8C6" opacity="0.2" />
              <circle cx="4" cy="9" r="0.4" fill="#E0D8C6" opacity="0.14" />
            </pattern>

            {/* Mudstone: mottled blocky clay peds */}
            <pattern id="cs-tx-mud" width="30" height="22" patternUnits="userSpaceOnUse">
              <ellipse cx="7" cy="6" rx="5.4" ry="3.2" fill="#000000" opacity="0.14" />
              <ellipse cx="22" cy="15" rx="6.4" ry="3.6" fill="#000000" opacity="0.12" />
              <ellipse cx="18" cy="3" rx="3.6" ry="2" fill={rockLine} opacity="0.09" />
              <path d="M0 18 Q10 16 19 19 T30 17" fill="none" stroke="#000000" strokeWidth="0.4" opacity="0.2" />
              <path d="M0 9 Q8 7 15 9" fill="none" stroke="#000000" strokeWidth="0.3" opacity="0.14" />
            </pattern>

            <filter id="cs-glow">
              <feGaussianBlur stdDeviation="2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <clipPath id="cs-clip">
              <rect x={CX} y="0" width={CW} height="200" />
            </clipPath>
          </defs>

          {/* Depth axis */}
          <g fontFamily="IBM Plex Mono, monospace" fontSize="7" fill={colors.coordFill}>
            {[0, 25, 50, 75, 100, 125, 150].map((d, i) => (
              <g key={d}>
                <line x1="28" y1={SY + i * 24} x2={CX} y2={SY + i * 24} stroke={colors.borderPrimary} strokeWidth="0.8" />
                <text x="1" y={SY + i * 24 + 3} textAnchor="start">-{d}m</text>
              </g>
            ))}
          </g>

          {/* ---------------- Strata ---------------- */}
          <g clipPath="url(#cs-clip)">
            {STRATA.map(s => {
              const d = layerPath(s)
              // internal sub-bedding lines within the layer, spaced by its band count
              const subLines = []
              for (let b = 1; b < s.bands; b++) {
                const depth = s.from + ((s.to - s.from) * b) / s.bands
                subLines.push(
                  <path
                    key={`sub-${s.label}-${b}`}
                    d={`M ${boundary(depth, s.wave * 0.7, s.seed + b * 0.37).join(' L ')}`}
                    fill="none"
                    stroke={colors.isDark ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.14)'}
                    strokeWidth="0.5"
                  />
                )
              }
              return (
                <g key={s.label}>
                  {/* base sediment colour */}
                  <path d={d} fill={`url(#cs-g-${s.texture})`} />
                  {/* procedural grain noise, clipped to this layer's own shape */}
                  <clipPath id={`clip-${s.texture}`}><path d={d} /></clipPath>
                  <g clipPath={`url(#clip-${s.texture})`}>
                    <rect x={CX} y={SY + s.from - 4} width={CW} height={s.to - s.from + 8} fill={`url(#cs-g-${s.texture})`} filter={`url(#cs-noise-${s.grain})`} />
                  </g>
                  {/* internal bedding bands */}
                  {subLines}
                  {/* decorative overlay texture (pebbles/laminae/cleats) */}
                  <path d={d} fill={`url(#cs-tx-${s.texture})`} />
                  {/* contact shadow: soft dark line under the boundary for depth */}
                  <path
                    d={`M ${boundary(s.to, s.wave, s.seed + 0.9).join(' L ')}`}
                    fill="none"
                    stroke={colors.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.45)'}
                    strokeWidth="0.9"
                  />
                  <path
                    d={`M ${boundary(s.to, s.wave, s.seed + 0.9).join(' L ')}`}
                    fill="none"
                    stroke={rockLine}
                    strokeWidth="0.4"
                    opacity="0.18"
                    transform="translate(0,-1)"
                  />
                </g>
              )
            })}
          </g>

          {/* ---------------- Water table in the sandstone aquifer ---------------- */}
          <g clipPath="url(#cs-clip)" opacity="0.85">
            <path
              d={`M ${boundary(64, 1.6, 8.2).join(' L ')}`}
              fill="none"
              stroke={waterCol}
              strokeWidth="1"
              strokeDasharray="5,3"
              opacity="0.8"
            />
            <ellipse cx={CX + 120} cy={SY + 70} rx="16" ry="2.4" fill={waterCol} opacity="0.3" />
            <ellipse cx={CX + 330} cy={SY + 73} rx="22" ry="2.6" fill={waterCol} opacity="0.26" />
            <ellipse cx={CX + 600} cy={SY + 69} rx="18" ry="2.2" fill={waterCol} opacity="0.28" />
            <text
              x={CX + 6} y={SY + 61}
              fontSize="6.5"
              fontFamily="IBM Plex Mono, monospace"
              fontWeight="600"
              fill={waterCol}
            >
              WATER TABLE
            </text>
          </g>

          {/* Mined-out goaf */}
          <rect
            x={CX + 80} y={SY + 110}
            width={CW - 140} height="22"
            fill={colors.isDark ? '#050403' : '#161311'}
            opacity={colors.isDark ? '0.85' : '0.92'}
            clipPath="url(#cs-clip)"
          />
          <rect
            x={CX + 80} y={SY + 110}
            width={CW - 140} height="22"
            fill="url(#cs-tx-coal)"
            opacity="0.5"
            clipPath="url(#cs-clip)"
          />
          <text
            x={CX + CW / 2} y={SY + 124}
            textAnchor="middle"
            fontSize="8"
            fontWeight="600"
            fontFamily="IBM Plex Mono, monospace"
            fill="#EDE6DA"
          >
            ← MINED-OUT GOAF AREA →
          </text>

          {/* Pillars — filtered by active panel, others dimmed */}
          {PILLARS.map(p => {
            const pillarActive = activePanel === 'All' || p.panel === activePanel
            const color = pillarColor(p.risk)
            const isHigh = p.risk === 'HIGH'
            const linkedNode = nodes.find(n => n.pillarId === p.id)
            const isSelected = linkedNode && selectedNode === linkedNode.id
            return (
              <g key={p.id} opacity={pillarActive ? 1 : 0.15} style={{ transition: 'opacity 0.35s ease' }}>
                {/* Pillar body */}
                <rect
                  x={p.x - 17} y={SY + 42}
                  width="34" height={92}
                  fill={isHigh ? (colors.isDark ? '#13100C' : '#28211C') : (colors.isDark ? '#2A2420' : '#3E3630')}
                  stroke={pillarActive ? color : colors.borderSubtle}
                  strokeWidth={isSelected ? 2.2 : 0.9}
                  opacity="0.95"
                  filter={isHigh && pillarActive ? 'url(#cs-glow)' : undefined}
                />
                {/* Risk color wash */}
                <rect
                  x={p.x - 17} y={SY + 42}
                  width="34" height={92}
                  fill={color}
                  opacity={isHigh && pillarActive ? 0.22 : 0.05}
                  className={isHigh && pillarActive ? 'pulse-high' : undefined}
                />
                {/* Crack lines for HIGH risk */}
                {isHigh && pillarActive && (
                  <g opacity="0.75">
                    <path d={`M ${p.x - 7} ${SY + 50} L ${p.x - 3} ${SY + 80} L ${p.x - 9} ${SY + 116}`} fill="none" stroke={RISK_COLOR.HIGH} strokeWidth="0.9" />
                    <path d={`M ${p.x + 5} ${SY + 62} L ${p.x + 2} ${SY + 92} L ${p.x + 8} ${SY + 122}`} fill="none" stroke={RISK_COLOR.HIGH} strokeWidth="0.9" />
                  </g>
                )}
                {/* Pillar label */}
                <text
                  x={p.x} y={SY + 148}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="600"
                  fontFamily="IBM Plex Mono, monospace"
                  fill={pillarActive ? colors.textPrimary : colors.textMuted}
                >
                  P{p.id}
                </text>
              </g>
            )
          })}

          {/* ---------------- Ground surface detail: pebbles + vegetation ---------------- */}
          <g clipPath="url(#cs-clip)">
            {clumps.map((x, i) => {
              const y = surfaceYAt(x)
              return i % 4 === 0 ? (
                <ellipse key={`peb-${x}`} cx={x} cy={y + 0.6} rx="1.3" ry="0.8" fill={pebbleDk} opacity="0.5" />
              ) : null
            })}
            {tufts.map((x, i) => {
              const y = surfaceYAt(x)
              const h = 3 + ((i * 17) % 5)
              const col = i % 3 === 0 ? grassC : i % 3 === 1 ? grassA : grassB
              return (
                <g key={`tuft-${x}`} stroke={col} strokeWidth="0.7" strokeLinecap="round" fill="none" opacity="0.95">
                  <path d={`M ${x} ${y} Q ${x - 1.7} ${y - h * 0.6} ${x - 2.8} ${y - h}`} />
                  <path d={`M ${x} ${y} L ${x + 0.2} ${y - h - 1}`} />
                  <path d={`M ${x} ${y} Q ${x + 1.9} ${y - h * 0.55} ${x + 2.9} ${y - h * 0.95}`} />
                </g>
              )
            })}
          </g>

          {/* Ground surface line */}
          <path
            d={surfaceLine}
            fill="none"
            stroke={colors.isDark ? '#6FA348' : '#3F6B2B'}
            strokeWidth="1.3"
            opacity="0.9"
            clipPath="url(#cs-clip)"
          />

          {/* Subsidence drop indicator */}
          {sagAmt > 5 && (
            <g>
              <line
                x1={sagMid + 4} y1={SY}
                x2={sagMid + 4} y2={sagMidY}
                stroke={RISK_COLOR.HIGH}
                strokeWidth="1.2"
                strokeDasharray="3,2"
              />
              <line
                x1={sagMid - 26} y1={SY}
                x2={sagMid + 26} y2={SY}
                stroke={RISK_COLOR.HIGH}
                strokeWidth="0.7"
                strokeDasharray="2,2"
                opacity="0.7"
              />
              <text
                x={sagMid + 8}
                y={(SY + sagMidY) / 2 + 3}
                fontSize="8"
                fontWeight="700"
                fontFamily="IBM Plex Mono, monospace"
                fill={RISK_COLOR.HIGH}
              >
                ↓ {(sagAmt * 0.05).toFixed(2)}m
              </text>
            </g>
          )}

          {/* ---------------- Layer labels (right side, readable on any fill) ---------------- */}
          <g clipPath="url(#cs-clip)" fontFamily="IBM Plex Mono, monospace">
            {STRATA.map(s => {
              const mid = SY + s.from + (s.to - s.from) / 2
              const d0 = Math.round(s.from * MPX)
              const d1 = Math.round(s.to * MPX)
              const tall = s.to - s.from >= 24
              return (
                <g key={`lbl-${s.label}`}>
                  <rect
                    x={CX + CW - 104} y={mid - (tall ? 9 : 5.5)}
                    width="98" height={tall ? 18 : 11}
                    rx="2"
                    fill="rgba(8,6,4,0.55)"
                  />
                  <text
                    x={CX + CW - 10} y={mid + (tall ? -1 : 3)}
                    textAnchor="end"
                    fontSize="6.8"
                    fontWeight="700"
                    fill="#F3EBDD"
                    letterSpacing="0.4"
                  >
                    {s.label} · {d0}–{d1}m
                  </text>
                  {tall && (
                    <text
                      x={CX + CW - 10} y={mid + 7}
                      textAnchor="end"
                      fontSize="6"
                      fill="rgba(243,235,221,0.65)"
                    >
                      {s.note}
                    </text>
                  )}
                </g>
              )
            })}
          </g>

          {/* Sensor nodes above surface */}
          {csNodes.map(n => {
            const col = RISK_COLOR[n.risk]
            const isSelected = selectedNode === n.id
            const nodeY = n.groundY - 26
            return (
              <g
                key={`csn-${n.id}`}
                transform={`translate(${n.svgX}, ${nodeY})`}
                style={{ transition: 'transform 0.4s ease-in-out' }}
              >
                {/* Stem to surface */}
                <line x1="0" y1="0" x2="0" y2="22" stroke={col} strokeWidth="1.2" opacity="0.6" />
                {/* Marker */}
                <circle
                  r={isSelected ? 7 : 5}
                  fill={col}
                  opacity="0.95"
                  filter={n.risk === 'HIGH' ? 'url(#cs-glow)' : undefined}
                  className={n.risk === 'HIGH' ? 'pulse-high' : undefined}
                  style={{ transition: 'r 0.12s ease' }}
                />
                {/* Label */}
                <text
                  x="0" y="-10"
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="600"
                  fontFamily="IBM Plex Mono, monospace"
                  fill={col}
                >
                  N{n.id}
                </text>
              </g>
            )
          })}

          {/* Panel labels */}
          <text x={CX + 160} y="11" textAnchor="middle" fontSize="10" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fill={RISK_COLOR.LOW}>
            Panel 1
          </text>
          <text x={CX + 490} y="11" textAnchor="middle" fontSize="10" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fill={RISK_COLOR.HIGH}>
            Panel 2 — HIGH RISK
          </text>

          {/* X distance axis */}
          <g fontFamily="IBM Plex Mono, monospace" fontSize="7" fill={colors.coordFill}>
            {[0, 100, 200, 300, 400, 500, 600, 700].map((d, i) => (
              <g key={d}>
                <line x1={CX + i * 96} y1="186" x2={CX + i * 96} y2="190" stroke={colors.borderPrimary} strokeWidth="1" />
                <text x={CX + i * 96} y="198" textAnchor="middle">{d}m</text>
              </g>
            ))}
            <line x1={CX} y1="188" x2={CX + CW} y2="188" stroke={colors.borderPrimary} strokeWidth="0.8" />
          </g>
        </svg>
      </div>
    </div>
  )
}
