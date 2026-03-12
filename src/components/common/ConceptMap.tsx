/*
 * Copyright 2026 Institute for Future Intelligence, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { useMemo } from 'react'
import { Spin } from 'antd'
import { useTranslation } from 'react-i18next'
import type { ConceptMap as ConceptMapType } from '../../services/firestore'

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  science: { bg: '#e6f7ff', border: '#1890ff', text: '#0050b3' },
  technology: { bg: '#f6ffed', border: '#52c41a', text: '#237804' },
  engineering: { bg: '#fff7e6', border: '#fa8c16', text: '#ad4e00' },
  mathematics: { bg: '#f9f0ff', border: '#722ed1', text: '#391085' },
}

interface ConceptMapProps {
  conceptMap: ConceptMapType
  loading?: boolean
}

function ConceptMap({ conceptMap, loading }: ConceptMapProps) {
  const { t } = useTranslation()

  const layout = useMemo(() => {
    if (!conceptMap?.nodes?.length) return { nodes: [], edges: [] }

    const width = 700
    const height = 450
    const cx = width / 2
    const cy = height / 2
    const rx = 260
    const ry = 160

    const nodePositions = conceptMap.nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / conceptMap.nodes.length - Math.PI / 2
      return {
        ...node,
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle),
      }
    })

    const nodeMap = new Map(nodePositions.map((n) => [n.id, n]))

    const edges = conceptMap.edges
      .map((edge) => {
        const source = nodeMap.get(edge.source)
        const target = nodeMap.get(edge.target)
        if (!source || !target) return null
        return { ...edge, x1: source.x, y1: source.y, x2: target.x, y2: target.y }
      })
      .filter(Boolean) as Array<{
      source: string
      target: string
      label: string
      x1: number
      y1: number
      x2: number
      y2: number
    }>

    return { nodes: nodePositions, edges }
  }, [conceptMap])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Spin size="small" />
        <span style={{ marginLeft: 8, color: '#999' }}>{t('conceptMap.generating')}</span>
      </div>
    )
  }

  if (!conceptMap?.nodes?.length) return null

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
        {Object.entries(CATEGORY_COLORS).map(([cat, colors]) => (
          <span key={cat} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: colors.bg,
                border: `2px solid ${colors.border}`,
                display: 'inline-block',
              }}
            />
            {t(`conceptMap.${cat}`)}
          </span>
        ))}
      </div>
      <svg
        viewBox="0 0 700 450"
        style={{ width: '100%', maxHeight: 450, background: '#fafafa', borderRadius: 8 }}
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#bbb" />
          </marker>
        </defs>

        {/* Edges */}
        {layout.edges.map((edge, i) => {
          const mx = (edge.x1 + edge.x2) / 2
          const my = (edge.y1 + edge.y2) / 2
          // Shorten lines so they don't overlap nodes
          const dx = edge.x2 - edge.x1
          const dy = edge.y2 - edge.y1
          const len = Math.sqrt(dx * dx + dy * dy)
          const offset = 45
          const sx = edge.x1 + (dx / len) * offset
          const sy = edge.y1 + (dy / len) * offset
          const ex = edge.x2 - (dx / len) * offset
          const ey = edge.y2 - (dy / len) * offset

          return (
            <g key={`edge-${i}`}>
              <line
                x1={sx}
                y1={sy}
                x2={ex}
                y2={ey}
                stroke="#ccc"
                strokeWidth={1.5}
                markerEnd="url(#arrowhead)"
              />
              <rect
                x={mx - edge.label.length * 3.5 - 4}
                y={my - 8}
                width={edge.label.length * 7 + 8}
                height={16}
                rx={4}
                fill="white"
                opacity={0.9}
              />
              <text
                x={mx}
                y={my + 4}
                textAnchor="middle"
                fontSize={11}
                fill="#888"
              >
                {edge.label}
              </text>
            </g>
          )
        })}

        {/* Nodes */}
        {layout.nodes.map((node) => {
          const colors = CATEGORY_COLORS[node.category] || CATEGORY_COLORS.science
          const textWidth = node.label.length * 7 + 24
          const rectWidth = Math.max(textWidth, 60)

          return (
            <g key={node.id}>
              <rect
                x={node.x - rectWidth / 2}
                y={node.y - 16}
                width={rectWidth}
                height={32}
                rx={16}
                fill={colors.bg}
                stroke={colors.border}
                strokeWidth={2}
              />
              <text
                x={node.x}
                y={node.y + 5}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                fill={colors.text}
              >
                {node.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default ConceptMap
