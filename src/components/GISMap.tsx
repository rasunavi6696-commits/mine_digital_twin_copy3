import { useState } from 'react'
import type { SensorNode, LayerConfig } from '../types'
import { useTheme } from '../context/ThemeContext'

const PANEL1_PILLARS = [
  { x: 130, y: 165 }, { x: 162, y: 165 }, { x: 194, y: 165 }, { x: 226, y: 165 },
  { x: 130, y: 198 }, { x: 162, y: 198 }, { x: 194, y: 198 }, { x: 226, y: 198 },
  { x: 130, y: 231 }, { x: 162, y: 231 }, { x: 194, y: 231 }, { x: 226, y: 231 },
  { x: 130, y: 264 }, { x: 162, y: 264 }, { x: 194, y: 264 },
]

const PANEL2_PILLARS = [
  { x: 410, y: 130 }, { x: 450, y: 130 }, { x: 490, y: 130 }, { x: 530, y: 130 }, { x: 570, y: 130 }, { x: 610, y: 130 },
  { x: 410, y: 164 }, { x: 450, y: 164 }, { x: 490, y: 164 }, { x: 530, y: 164 }, { x: 570, y: 164 }, { x: 610, y: 164 },
  { x: 410, y: 198 }, { x: 450, y: 198 }, { x: 490, y: 198 }, { x: 530, y: 198 }, { x: 570, y: 198 }, { x: 610, y: 198 },
  { x: 410, y: 232 }, { x: 450, y: 232 }, { x: 490, y: 232 }, { x: 530, y: 232 }, { x: 570, y: 232 },
  { x: 410, y: 266 }, { x: 450, y: 266 }, { x: 490, y: 266 }, { x: 530, y: 266 },
]

interface TooltipData {
  x: number
  y: number
  lines: string[]
}

interface Props {
  nodes: SensorNode[]
  selectedNode: number | null
  onSelectNode: (id: number) => void
  activePanel: string
}

export default function GISMap({ nodes, selectedNode, onSelectNode, activePanel }: Props) {
  const { colors } = useTheme()
  const [layers, setLayers] = useState<LayerConfig>({ heatmap: true, pillars: true, vectors: true, grid: true })
  const [hoveredNode, setHoveredNode] = useState<number | null>(null)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  const RISK_COLOR: Record<string, string> = colors.isDark
    ? { LOW: '#4C8C6B', MEDIUM: '#D98E3B', HIGH: '#B3492E' }
    : { LOW: '#15803D', MEDIUM: '#B45309', HIGH: '#DC2626' }

  const toggle = (k: keyof LayerConfig) => setLayers(p => ({ ...p, [k]: !p[k] }))

  const showTooltip = (node: SensorNode) => {
    setHoveredNode(node.id)
    const tiltStr = node.tilt != null ? `${Number(node.tilt) > 0 ? '+' : ''}${Number(node.tilt).toFixed(2)}°` : '—'
    const vibStr = node.vibration != null ? String(node.vibration) : '—'
    const soilStr = node.soilMoisture != null ? `${node.soilMoisture}%` : '—'
    const tempStr = node.temp != null ? `${node.temp}°C` : '—'
    setTooltip({
      x: Math.min(node.gisX || 150, 580),
      y: Math.max((node.gisY || 150) - 56, 4),
      lines: [
        `${node.label} · ${node.panel} (${node.status.toUpperCase()})`,
        `Risk: ${node.risk} · Tilt: ${tiltStr}`,
        `Vib: ${vibStr} · Soil: ${soilStr} · Temp: ${tempStr}`,
        `Updated: ${node.lastUpdate ?? 0}s ago`,
      ],
    })
  }

  const p1Active = activePanel === 'All' || activePanel === 'Panel 1'
  const p2Active = activePanel === 'All' || activePanel === 'Panel 2'

  const p1Opacity = p1Active ? 1 : 0.2
  const p2Opacity = p2Active ? 1 : 0.2

  const p1Stroke = p1Active ? colors.accent : colors.textMuted
  const p2Stroke = p2Active ? RISK_COLOR.HIGH : colors.textMuted

  // Satellite terrain palette — different for light/dark themes
  const terrain = colors.isDark
    ? {
        base1: '#1F2A24', base2: '#2C3528', base3: '#3A3F2E',
        veg1: '#243828', veg2: '#1A2B1F', veg3: '#2E4230',
        soil1: '#3B2F24', soil2: '#4A3A28', rock1: '#4A4A48',
        haze: '#0F1512', road: '#5A5347',
      }
    : {
        base1: '#8B8574', base2: '#A39B85', base3: '#B8AD93',
        veg1: '#6B7A4E', veg2: '#5A6B42', veg3: '#7C8A5C',
        soil1: '#9A8468', soil2: '#B09878', rock1: '#A8A29A',
        haze: '#C8BFA8', road: '#8A8272',
      }

  return (
    <div
      className="flex flex-col h-full rounded-md"
      style={{
        background: colors.bgCanvas,
        border: `1px solid ${colors.borderPrimary}`,
        boxShadow: colors.shadowSm,
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{
          borderBottom: `1px solid ${colors.borderPrimary}`,
          background: colors.bgCardSubtle,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif', color: colors.accent }}>
            GIS MAP
          </span>
          <span style={{ color: colors.textMuted, fontSize: '10px' }}>—</span>
          <span style={{ color: colors.textMuted, fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px' }}>
            {activePanel} · Satellite View + Sensor Nodes
          </span>
          {activePanel !== 'All' && (
            <span style={{
              fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', fontWeight: 600,
              color: colors.accent, background: colors.accentBg,
              border: `1px solid ${colors.accentBorder}`, padding: '1px 6px', borderRadius: '3px',
            }}>
              FILTERING: {activePanel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {(['heatmap', 'pillars', 'vectors', 'grid'] as (keyof LayerConfig)[]).map(k => (
            <label key={k} className="flex items-center gap-1 cursor-pointer select-none">
              <input type="checkbox" checked={layers[k]} onChange={() => toggle(k)} className="w-3 h-3" style={{ accentColor: colors.accent }} />
              <span className="text-[10px] capitalize font-medium" style={{ color: colors.textSecondary, fontFamily: 'IBM Plex Mono, monospace' }}>{k}</span>
            </label>
          ))}
        </div>
      </div>

      {/* SVG Mine Map */}
      <div className="flex-1 overflow-hidden relative">
        <svg viewBox="0 0 800 360" className="w-full h-full" style={{ cursor: 'crosshair' }}>
          <defs>
            {/* ============ SATELLITE TERRAIN FILTERS ============ */}

            {/* Fine grain — soil/rock texture */}
            <filter id="sat-grain" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" seed="11" result="noise" />
              <feColorMatrix in="noise" type="saturate" values="0" result="grayNoise" />
              <feComponentTransfer in="grayNoise" result="softNoise">
                <feFuncA type="linear" slope="0.22" intercept="0" />
              </feComponentTransfer>
              <feBlend in="SourceGraphic" in2="softNoise" mode="overlay" />
            </filter>

            {/* Vegetation patches — low-frequency color mottling */}
            <filter id="sat-veg" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="3" seed="7" result="vegNoise" />
              <feColorMatrix in="vegNoise" type="matrix"
                values="0 0 0 0 0.20
                        0 0 0 0 0.32
                        0 0 0 0 0.18
                        0 0 0 0.9 0" result="vegColor" />
              <feComposite in="vegColor" in2="SourceGraphic" operator="over" />
            </filter>

            {/* Rock outcrop — high contrast patches */}
            <filter id="sat-rock" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="23" result="rockNoise" />
              <feColorMatrix in="rockNoise" type="matrix"
                values="0 0 0 0 0.45
                        0 0 0 0 0.42
                        0 0 0 0 0.38
                        0 0 0 0.7 0" result="rockColor" />
              <feComposite in="rockColor" in2="SourceGraphic" operator="over" />
            </filter>

            {/* Elevation shading — soft light from NW */}
            <filter id="sat-elevation" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="2" seed="3" result="elev" />
              <feGaussianBlur in="elev" stdDeviation="6" result="elevBlur" />
              <feSpecularLighting in="elevBlur" surfaceScale="4" specularConstant="0.35" specularExponent="18" lightingColor="#ffffff" result="spec">
                <feDistantLight azimuth="315" elevation="55" />
              </feSpecularLighting>
              <feComposite in="spec" in2="SourceGraphic" operator="over" />
            </filter>

            {/* Overall atmospheric haze */}
            <filter id="sat-haze" x="0" y="0" width="100%" height="100%">
              <feGaussianBlur stdDeviation="0.4" />
            </filter>

            {/* Radial gradients for natural terrain variation */}
            <radialGradient id="terrain-vignette" cx="50%" cy="50%" r="75%">
              <stop offset="0%" stopColor={terrain.haze} stopOpacity="0" />
              <stop offset="70%" stopColor={terrain.haze} stopOpacity="0.15" />
              <stop offset="100%" stopColor={terrain.haze} stopOpacity="0.55" />
            </radialGradient>

            <radialGradient id="terrain-light" cx="30%" cy="25%" r="60%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity={colors.isDark ? '0.04' : '0.18'} />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>

            {/* Farm field / plot pattern (subtle agricultural look) */}
            <pattern id="sat-fields" x="0" y="0" width="64" height="64" patternUnits="userSpaceOnUse">
              <rect width="64" height="64" fill={terrain.base2} />
              <rect x="2" y="2" width="28" height="28" fill={terrain.veg3} opacity="0.55" />
              <rect x="34" y="2" width="28" height="28" fill={terrain.soil2} opacity="0.45" />
              <rect x="2" y="34" width="28" height="28" fill={terrain.soil1} opacity="0.5" />
              <rect x="34" y="34" width="28" height="28" fill={terrain.veg1} opacity="0.5" />
            </pattern>

            {/* Grid pattern (kept for the toggle) */}
            <pattern id="gm-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke={colors.gridStroke} strokeWidth="0.6" />
            </pattern>

            {/* Heatmap gradients */}
            <radialGradient id="rg-high" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={RISK_COLOR.HIGH} stopOpacity={colors.isDark ? '0.42' : '0.30'} />
              <stop offset="60%" stopColor={RISK_COLOR.HIGH} stopOpacity={colors.isDark ? '0.18' : '0.12'} />
              <stop offset="100%" stopColor={RISK_COLOR.HIGH} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="rg-med" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={RISK_COLOR.MEDIUM} stopOpacity={colors.isDark ? '0.28' : '0.22'} />
              <stop offset="100%" stopColor={RISK_COLOR.MEDIUM} stopOpacity="0" />
            </radialGradient>

            <filter id="glow-hi">
              <feGaussianBlur stdDeviation="3.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            <marker id="arr-high" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M 0 0 L 6 3 L 0 6 z" fill={RISK_COLOR.HIGH} />
            </marker>
            <marker id="arr-medium" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M 0 0 L 6 3 L 0 6 z" fill={RISK_COLOR.MEDIUM} />
            </marker>

            {/* Clip for terrain to rounded corners */}
            <clipPath id="map-clip">
              <rect x="0" y="0" width="800" height="360" rx="4" />
            </clipPath>
          </defs>

          {/* ================= SATELLITE TERRAIN BASE ================= */}
          <g clipPath="url(#map-clip)">
            {/* Layer 1: Base soil tone */}
            <rect width="800" height="360" fill={terrain.base1} />

            {/* Layer 2: Agricultural / field pattern */}
            <rect width="800" height="360" fill="url(#sat-fields)" opacity={colors.isDark ? 0.35 : 0.55} />

            {/* Layer 3: Vegetation mottling */}
            <rect width="800" height="360" fill={terrain.base2} filter="url(#sat-veg)" opacity={colors.isDark ? 0.55 : 0.65} />

            {/* Layer 4: Rock outcrops */}
            <rect width="800" height="360" fill={terrain.rock1} filter="url(#sat-rock)" opacity={colors.isDark ? 0.28 : 0.35} />

            {/* Layer 5: Elevation shading */}
            <rect width="800" height="360" fill="transparent" filter="url(#sat-elevation)" opacity="0.55" />

            {/* Layer 6: Fine grain texture */}
            <rect width="800" height="360" fill={terrain.base3} filter="url(#sat-grain)" opacity={colors.isDark ? 0.35 : 0.45} />

            {/* Layer 7: Directional light highlight */}
            <rect width="800" height="360" fill="url(#terrain-light)" />

            {/* Layer 8: Vignette / atmospheric haze */}
            <rect width="800" height="360" fill="url(#terrain-vignette)" />

            {/* Layer 9: Dark theme dim overlay to keep UI readable */}
            {colors.isDark && (
              <rect width="800" height="360" fill="#0A0F0C" opacity="0.42" />
            )}

            {/* Optional grid overlay */}
            {layers.grid && (
              <rect width="800" height="360" fill="url(#gm-grid)" opacity="0.35" />
            )}

            {/* Coordinate labels */}
            {layers.grid && (
              <g fontFamily="IBM Plex Mono, monospace" fontSize="8" fill={colors.coordFill} opacity="0.85">
                {[0, 160, 320, 480, 640, 800].map((x, i) => (
                  <text key={i} x={x + 2} y={354} style={{ paintOrder: 'stroke', stroke: colors.bgCanvas, strokeWidth: 2 }}>
                    E{562000 + i * 200}
                  </text>
                ))}
                {[0, 90, 180, 270].map((y, i) => (
                  <text key={i} x={2} y={y + 10} style={{ paintOrder: 'stroke', stroke: colors.bgCanvas, strokeWidth: 2 }}>
                    N{2340 + (3 - i) * 100}
                  </text>
                ))}
              </g>
            )}

            {/* Dirt road / haul route */}
            <path
              d="M 0 335 Q 250 326 500 332 Q 680 337 800 328"
              fill="none"
              stroke={terrain.road}
              strokeWidth="9"
              opacity="0.75"
            />
            <path
              d="M 0 335 Q 250 326 500 332 Q 680 337 800 328"
              fill="none"
              stroke={colors.isDark ? '#1A1A18' : '#6B6357'}
              strokeWidth="1.2"
              strokeDasharray="2,4"
              opacity="0.6"
            />

            {/* Secondary access track */}
            <path
              d="M 55 0 L 62 360"
              fill="none"
              stroke={terrain.road}
              strokeWidth="5"
              opacity="0.65"
            />

            {/* A couple of small natural water bodies for realism */}
            <ellipse cx="720" cy="80" rx="26" ry="14" fill={colors.isDark ? '#1A2A32' : '#5A7A88'} opacity="0.55" />
            <ellipse cx="720" cy="80" rx="26" ry="14" fill="none" stroke={colors.isDark ? '#2A3A42' : '#7A9AA8'} strokeWidth="0.8" opacity="0.7" />
            <ellipse cx="120" cy="320" rx="18" ry="9" fill={colors.isDark ? '#1A2A32' : '#5A7A88'} opacity="0.5" />
          </g>

          {/* Panel 1 boundary */}
          <g opacity={p1Opacity} style={{ transition: 'opacity 0.35s ease' }}>
            <polygon
              points="78,88 294,70 318,295 93,310"
              fill={p1Active ? (colors.isDark ? 'rgba(76,140,107,0.06)' : 'rgba(21,128,61,0.06)') : 'transparent'}
              stroke={p1Stroke}
              strokeWidth={p1Active ? 1.8 : 0.8}
              strokeDasharray="9,5"
              style={{ filter: p1Active ? 'drop-shadow(0 0 3px rgba(0,0,0,0.35))' : 'none' }}
            />
            <text x="155" y="66" fontFamily="Space Grotesk, sans-serif" fontSize="11" fontWeight="700"
              fill={p1Stroke} style={{ paintOrder: 'stroke', stroke: colors.bgCanvas, strokeWidth: 3 }}>
              Panel 1
            </text>
            <text x="155" y="78" fontFamily="IBM Plex Mono, monospace" fontSize="8" fill={colors.textMuted}
              style={{ paintOrder: 'stroke', stroke: colors.bgCanvas, strokeWidth: 2.5 }}>
              DEPILLARED · 36 mo · LOW RISK
            </text>
          </g>

          {/* Panel 2 boundary */}
          <g opacity={p2Opacity} style={{ transition: 'opacity 0.35s ease' }}>
            <polygon
              points="365,70 648,58 670,312 384,322"
              fill={p2Active ? (colors.isDark ? 'rgba(179,73,46,0.06)' : 'rgba(220,38,38,0.06)') : 'transparent'}
              stroke={p2Stroke}
              strokeWidth={p2Active ? 1.8 : 0.8}
              strokeDasharray="9,5"
              style={{ filter: p2Active ? 'drop-shadow(0 0 3px rgba(0,0,0,0.35))' : 'none' }}
            />
            <text x="488" y="54" fontFamily="Space Grotesk, sans-serif" fontSize="11" fontWeight="700"
              fill={p2Stroke} style={{ paintOrder: 'stroke', stroke: colors.bgCanvas, strokeWidth: 3 }}>
              Panel 2
            </text>
            <text x="488" y="66" fontFamily="IBM Plex Mono, monospace" fontSize="8" fill={colors.textMuted}
              style={{ paintOrder: 'stroke', stroke: colors.bgCanvas, strokeWidth: 2.5 }}>
              DEPILLARED · 18 mo · HIGH RISK
            </text>
          </g>

          {/* Risk heatmap */}
          {layers.heatmap && (
            <>
              {p2Active && <ellipse cx="518" cy="192" rx="148" ry="122" fill="url(#rg-high)" />}
              {p1Active && <ellipse cx="186" cy="210" rx="88" ry="74" fill="url(#rg-med)" />}
            </>
          )}

          {/* Pillar footprints — Panel 1 */}
          {layers.pillars && (
            <g opacity={p1Opacity} style={{ transition: 'opacity 0.35s ease' }}>
              {PANEL1_PILLARS.map((p, i) => (
                <g key={`p1-${i}`}>
                  <rect x={p.x - 12} y={p.y - 9} width="24" height="18"
                    fill={colors.isDark ? 'rgba(76,140,107,0.08)' : 'rgba(21,128,61,0.08)'}
                    stroke={RISK_COLOR.LOW} strokeWidth="0.9" strokeDasharray="3,2" opacity="0.75" />
                </g>
              ))}
            </g>
          )}

          {/* Pillar footprints — Panel 2 */}
          {layers.pillars && (
            <g opacity={p2Opacity} style={{ transition: 'opacity 0.35s ease' }}>
              {PANEL2_PILLARS.map((p, i) => {
                const col = i < 18 ? RISK_COLOR.HIGH : RISK_COLOR.MEDIUM
                return (
                  <g key={`p2-${i}`}>
                    <rect x={p.x - 12} y={p.y - 9} width="24" height="18"
                      fill={i < 18
                        ? (colors.isDark ? 'rgba(179,73,46,0.10)' : 'rgba(220,38,38,0.08)')
                        : (colors.isDark ? 'rgba(217,142,59,0.08)' : 'rgba(180,83,9,0.06)')}
                      stroke={col} strokeWidth="0.9" strokeDasharray="3,2" opacity="0.85" />
                  </g>
                )
              })}
            </g>
          )}

          {/* Deformation vectors */}
          {layers.vectors && nodes.filter(n => n.risk !== 'LOW' && n.displacement != null).map(n => {
            const active = activePanel === 'All' || n.panel === activePanel
            const disp = n.displacement || 0
            return (
              <line
                key={`v-${n.id}`}
                x1={n.gisX} y1={n.gisY}
                x2={n.gisX + disp * 0.28} y2={n.gisY + disp * 0.22}
                stroke={RISK_COLOR[n.risk]}
                strokeWidth="1.8"
                opacity={active ? 0.9 : 0.1}
                markerEnd={active ? `url(#arr-${n.risk.toLowerCase()})` : undefined}
                style={{ transition: 'opacity 0.35s ease', filter: active ? 'drop-shadow(0 0 2px rgba(0,0,0,0.4))' : 'none' }}
              />
            )
          })}

          {/* Sensor nodes */}
          {nodes.map(node => {
            const isActivePanel = activePanel === 'All' || node.panel === activePanel
            const col = RISK_COLOR[node.risk]
            const isSelected = selectedNode === node.id
            const isHovered = hoveredNode === node.id
            const isHigh = node.risk === 'HIGH'
            const nodeOpacity = isActivePanel ? 1 : 0.15

            return (
              <g
                key={node.id}
                transform={`translate(${node.gisX},${node.gisY})`}
                style={{ cursor: isActivePanel ? 'pointer' : 'default', opacity: nodeOpacity, transition: 'opacity 0.35s ease' }}
                onClick={() => isActivePanel && onSelectNode(node.id)}
                onMouseEnter={() => isActivePanel && showTooltip(node)}
                onMouseLeave={() => { setHoveredNode(null); setTooltip(null) }}
              >
                {/* Halo behind label for readability over satellite imagery */}
                <circle r="14" fill={colors.bgCanvas} opacity="0.0" />

                {isHigh && isActivePanel && (
                  <circle r="18" fill="none" stroke={col} strokeWidth="1.4" opacity="0.55" className="pulse-high" />
                )}
                {isSelected && (
                  <circle r="14" fill="none" stroke={colors.accent} strokeWidth="2.2"
                    style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.55))' }} />
                )}
                {isHigh && isActivePanel && (
                  <circle r="9" fill={col} opacity="0.25" filter="url(#glow-hi)" className="pulse-high" />
                )}
                {/* White outline ring for contrast over imagery */}
                <circle r={isSelected || isHovered ? 9 : 7} fill="none"
                  stroke={colors.isDark ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.85)'} strokeWidth="1.4" />
                <circle
                  r={isSelected || isHovered ? 8 : 6}
                  fill={col}
                  opacity={node.status === 'offline' ? 0.45 : 1}
                  filter={isHigh && isActivePanel ? 'url(#glow-hi)' : undefined}
                  style={{ transition: 'r 0.12s ease' }}
                />
                {node.status === 'offline' && (
                  <circle r="3" fill="none" stroke={RISK_COLOR.HIGH} strokeWidth="1.5" />
                )}
                <text x="10" y="-11" fontFamily="IBM Plex Mono, monospace" fontSize="9" fontWeight="700"
                  fill={col}
                  style={{ paintOrder: 'stroke', stroke: colors.bgCanvas, strokeWidth: 3, strokeLinejoin: 'round' }}>
                  {node.label}
                </text>
              </g>
            )
          })}

          {/* Tooltip */}
          {tooltip && hoveredNode !== null && (() => {
            const node = nodes.find(n => n.id === hoveredNode)
            if (!node) return null
            const tx = Math.min(node.gisX + 12, 572)
            const ty = Math.max(node.gisY - 56, 4)
            return (
              <g style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }}>
                <rect x={tx} y={ty} width="220" height={tooltip.lines.length * 15 + 10} rx="4"
                  fill={colors.tooltipBg} stroke={colors.borderSubtle} strokeWidth="1" />
                {tooltip.lines.map((line, i) => (
                  <text key={i} x={tx + 8} y={ty + 15 + i * 15}
                    fontFamily="IBM Plex Mono, monospace" fontSize="9"
                    fontWeight={i === 0 ? '700' : '400'}
                    fill={i === 0 ? colors.accent : colors.tooltipText}>
                    {line}
                  </text>
                ))}
              </g>
            )
          })()}

          {/* North arrow */}
          <g transform="translate(756,52)" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}>
            <circle r="22" fill={colors.bgCardSubtle} stroke={colors.borderPrimary} strokeWidth="1" opacity="0.92" />
            <path d="M 0 -15 L 5 6 L 0 1 L -5 6 Z" fill={colors.accent} />
            <path d="M 0 15 L 5 -6 L 0 -1 L -5 -6 Z" fill={colors.borderSubtle} />
            <text x="0" y="-18" textAnchor="middle" fontSize="9" fill={colors.accent} fontFamily="Space Grotesk, sans-serif" fontWeight="700">N</text>
          </g>

          {/* Scale bar */}
          <g transform="translate(28,340)" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
            <rect x="0" y="0" width="80" height="4" fill={colors.borderSubtle} />
            <rect x="0" y="0" width="40" height="4" fill={colors.textMuted} />
            <text x="0" y="13" fontSize="8" fill={colors.textMuted} fontFamily="IBM Plex Mono, monospace"
              style={{ paintOrder: 'stroke', stroke: colors.bgCanvas, strokeWidth: 2 }}>0</text>
            <text x="33" y="13" fontSize="8" fill={colors.textMuted} fontFamily="IBM Plex Mono, monospace"
              style={{ paintOrder: 'stroke', stroke: colors.bgCanvas, strokeWidth: 2 }}>100m</text>
            <text x="70" y="13" fontSize="8" fill={colors.textMuted} fontFamily="IBM Plex Mono, monospace"
              style={{ paintOrder: 'stroke', stroke: colors.bgCanvas, strokeWidth: 2 }}>200m</text>
          </g>
          <text x="650" y="354" fontSize="8" fill={colors.coordFill} fontFamily="IBM Plex Mono, monospace"
            style={{ paintOrder: 'stroke', stroke: colors.bgCanvas, strokeWidth: 2 }}>
            UTM Zone 44N · WGS84
          </text>
        </svg>
      </div>
    </div>
  )
}
