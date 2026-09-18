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

  // Determine which panels are "active" for rendering opacity
  const p1Active = activePanel === 'All' || activePanel === 'Panel 1'
  const p2Active = activePanel === 'All' || activePanel === 'Panel 2'

  const p1Opacity = p1Active ? 1 : 0.2
  const p2Opacity = p2Active ? 1 : 0.2

  const p1Stroke = p1Active ? colors.accent : colors.textMuted
  const p2Stroke = p2Active ? RISK_COLOR.HIGH : colors.textMuted

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
            {activePanel} · Panel Boundary + Sensor Nodes
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
            <pattern id="gm-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke={colors.gridStroke} strokeWidth="0.8" />
            </pattern>
            <radialGradient id="rg-high" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={RISK_COLOR.HIGH} stopOpacity={colors.isDark ? '0.38' : '0.25'} />
              <stop offset="100%" stopColor={RISK_COLOR.HIGH} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="rg-med" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={RISK_COLOR.MEDIUM} stopOpacity={colors.isDark ? '0.22' : '0.18'} />
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
                      <filter id="terrain-noise" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="4" seed="12" result="noise"/>
              <feColorMatrix in="noise" type="matrix" values="0.6 0 0 0 0.16  0 0.5 0 0 0.13  0 0 0.4 0 0.08  0 0 0 1 0"/>
            </filter>
            <radialGradient id="terrain-light" cx="35%" cy="25%" r="90%">
              <stop offset="0%" stop-color="#8A7658"/>
              <stop offset="45%" stop-color="#5B4A36"/>
              <stop offset="100%" stop-color="#2A221A"/>
            </radialGradient>
            <pattern id="terrain-speckle" width="120" height="120" patternUnits="userSpaceOnUse">
              <circle cx="22" cy="30" r="10" fill="#7E6B50" opacity="0.16"/>
              <circle cx="82" cy="74" r="15" fill="#3E352A" opacity="0.22"/>
              <ellipse cx="56" cy="96" rx="22" ry="8" fill="#9A8766" opacity="0.10"/>
            </pattern>
</defs>

          {/* Satellite-style terrain */}
          <rect width="800" height="360" fill="url(#terrain-light)"/>
          <rect width="800" height="360" fill="url(#terrain-speckle)" opacity="0.9"/>
          <rect width="800" height="360" filter="url(#terrain-noise)" opacity="0.45"/>
          <path d="M 0 80 C 120 50 240 95 340 70 C 450 45 590 100 800 55 L 800 0 L 0 0 Z" fill="#A08B69" opacity="0.18"/>
          <path d="M 20 230 C 160 185 310 235 420 210 C 560 180 670 250 800 205" fill="none" stroke="#8C785C" stroke-width="24" opacity="0.12" stroke-linecap="round"/>
          {layers.grid && <rect width="800" height="360" fill="url(#gm-grid)" opacity="0.22"/>}

          {/* Coordinate labels */}
          {layers.grid && (
            <g fontFamily="IBM Plex Mono, monospace" fontSize="8" fill={colors.coordFill}>
              {[0, 160, 320, 480, 640, 800].map((x, i) => (
                <text key={i} x={x + 2} y={354}>E{562000 + i * 200}</text>
              ))}
              {[0, 90, 180, 270].map((y, i) => (
                <text key={i} x={2} y={y + 10}>N{2340 + (3 - i) * 100}</text>
              ))}
            </g>
          )}

          {/* Road/surface features */}
          <path d="M 0 335 Q 250 326 500 332 Q 680 337 800 328" fill="none" stroke="#B7A07A" strokeWidth="11" opacity="0.75" strokeLinecap="round" />
          <path d="M 55 0 L 62 360" fill="none" stroke="#C9B28A" strokeWidth="7" opacity="0.65" strokeLinecap="round" />

          {/* Panel 1 boundary */}
          <g opacity={p1Opacity} style={{ transition: 'opacity 0.35s ease' }}>
            <polygon
              points="78,88 294,70 318,295 93,310"
              fill={p1Active ? colors.accentBg : 'transparent'}
              stroke={p1Stroke}
              strokeWidth={p1Active ? 1.6 : 0.8}
              strokeDasharray="9,5"
            />
            <text x="155" y="66" fontFamily="Space Grotesk, sans-serif" fontSize="11" fontWeight="700" fill={p1Stroke}>Panel 1</text>
            <text x="155" y="78" fontFamily="IBM Plex Mono, monospace" fontSize="8" fill={colors.textMuted}>DEPILLARED · 36 mo · LOW RISK</text>
          </g>

          {/* Panel 2 boundary */}
          <g opacity={p2Opacity} style={{ transition: 'opacity 0.35s ease' }}>
            <polygon
              points="365,70 648,58 670,312 384,322"
              fill={p2Active ? (colors.isDark ? 'rgba(179,73,46,0.05)' : 'rgba(220,38,38,0.05)') : 'transparent'}
              stroke={p2Stroke}
              strokeWidth={p2Active ? 1.6 : 0.8}
              strokeDasharray="9,5"
            />
            <text x="488" y="54" fontFamily="Space Grotesk, sans-serif" fontSize="11" fontWeight="700" fill={p2Stroke}>Panel 2</text>
            <text x="488" y="66" fontFamily="IBM Plex Mono, monospace" fontSize="8" fill={colors.textMuted}>DEPILLARED · 18 mo · HIGH RISK</text>
          </g>

          {/* Risk heatmap */}
          {layers.heatmap && (
            <>
              {p2Active && <ellipse cx="518" cy="192" rx="148" ry="122" fill="url(#rg-high)" opacity={p2Active ? 1 : 0.1} />}
              {p1Active && <ellipse cx="186" cy="210" rx="88" ry="74" fill="url(#rg-med)" opacity={p1Active ? 1 : 0.1} />}
            </>
          )}

          {/* Pillar footprints — Panel 1 */}
          {layers.pillars && (
            <g opacity={p1Opacity} style={{ transition: 'opacity 0.35s ease' }}>
              {PANEL1_PILLARS.map((p, i) => (
                <rect key={`p1-${i}`} x={p.x - 12} y={p.y - 9} width="24" height="18"
                  fill="none" stroke={RISK_COLOR.LOW} strokeWidth="0.8" strokeDasharray="3,2" opacity={colors.isDark ? 0.38 : 0.6} />
              ))}
            </g>
          )}

          {/* Pillar footprints — Panel 2 */}
          {layers.pillars && (
            <g opacity={p2Opacity} style={{ transition: 'opacity 0.35s ease' }}>
              {PANEL2_PILLARS.map((p, i) => (
                <rect key={`p2-${i}`} x={p.x - 12} y={p.y - 9} width="24" height="18"
                  fill="none" stroke={i < 18 ? RISK_COLOR.HIGH : RISK_COLOR.MEDIUM} strokeWidth="0.8" strokeDasharray="3,2" opacity={colors.isDark ? 0.45 : 0.7} />
              ))}
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
                strokeWidth="1.6"
                opacity={active ? 0.85 : 0.1}
                markerEnd={active ? `url(#arr-${n.risk.toLowerCase()})` : undefined}
                style={{ transition: 'opacity 0.35s ease' }}
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
                {isHigh && isActivePanel && (
                  <circle r="18" fill="none" stroke={col} strokeWidth="1.4" opacity="0.5" className="pulse-high" />
                )}
                {isSelected && (
                  <circle r="14" fill="none" stroke={colors.accent} strokeWidth="2" />
                )}
                {isHigh && isActivePanel && (
                  <circle r="9" fill={col} opacity="0.22" filter="url(#glow-hi)" className="pulse-high" />
                )}
                <circle
                  r={isSelected || isHovered ? 8 : 6}
                  fill={col}
                  opacity={node.status === 'offline' ? 0.4 : 0.95}
                  filter={isHigh && isActivePanel ? 'url(#glow-hi)' : undefined}
                  style={{ transition: 'r 0.12s ease' }}
                />
                {node.status === 'offline' && (
                  <circle r="3" fill="none" stroke={RISK_COLOR.HIGH} strokeWidth="1.5" />
                )}
                <text x="10" y="-11" fontFamily="IBM Plex Mono, monospace" fontSize="9" fontWeight="600" fill={col}>
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
              <g>
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
          <g transform="translate(756,52)">
            <circle r="22" fill={colors.bgCardSubtle} stroke={colors.borderPrimary} strokeWidth="1" />
            <path d="M 0 -15 L 5 6 L 0 1 L -5 6 Z" fill={colors.accent} />
            <path d="M 0 15 L 5 -6 L 0 -1 L -5 -6 Z" fill={colors.borderSubtle} />
            <text x="0" y="-18" textAnchor="middle" fontSize="9" fill={colors.accent} fontFamily="Space Grotesk, sans-serif" fontWeight="700">N</text>
          </g>

          {/* Scale bar */}
          <g transform="translate(28,340)">
            <rect x="0" y="0" width="80" height="4" fill={colors.borderSubtle} />
            <rect x="0" y="0" width="40" height="4" fill={colors.textMuted} />
            <text x="0" y="13" fontSize="8" fill={colors.textMuted} fontFamily="IBM Plex Mono, monospace">0</text>
            <text x="33" y="13" fontSize="8" fill={colors.textMuted} fontFamily="IBM Plex Mono, monospace">100m</text>
            <text x="70" y="13" fontSize="8" fill={colors.textMuted} fontFamily="IBM Plex Mono, monospace">200m</text>
          </g>
          <text x="650" y="354" fontSize="8" fill={colors.coordFill} fontFamily="IBM Plex Mono, monospace">UTM Zone 44N · WGS84</text>
        </svg>
      </div>
    </div>
  )
}
