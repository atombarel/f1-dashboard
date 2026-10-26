/**
 * Top-down F1 car in metres (5.6 m × 2 m), nose towards +x, centred on the origin.
 * Meant to be placed with `translate(…) rotate(…) scale(px per metre)`.
 */
export function CarGlyph({ colour, highlight }: { colour: string; highlight?: boolean }) {
  return (
    <g>
      {highlight && <ellipse rx={4.4} ry={2.2} fill={colour} opacity={0.22} />}
      {/* tyres */}
      <g fill="#0b0c0f">
        <rect x={1.35} y={-1.0} width={0.65} height={0.32} rx={0.06} />
        <rect x={1.35} y={0.68} width={0.65} height={0.32} rx={0.06} />
        <rect x={-2.18} y={-1.02} width={0.75} height={0.36} rx={0.06} />
        <rect x={-2.18} y={0.66} width={0.75} height={0.36} rx={0.06} />
      </g>
      {/* suspension arms */}
      <path d="M1.7 -0.7 L1.1 -0.2 M1.7 0.7 L1.1 0.2 M-1.8 -0.68 L-1.3 -0.3 M-1.8 0.68 L-1.3 0.3" stroke="#0b0c0f" strokeWidth={0.07} />
      {/* wings */}
      <rect x={2.36} y={-0.96} width={0.4} height={1.92} rx={0.05} fill={colour} stroke="#0b0c0f" strokeWidth={0.06} />
      <rect x={-2.76} y={-0.52} width={0.4} height={1.04} rx={0.05} fill={colour} stroke="#0b0c0f" strokeWidth={0.06} />
      {/* chassis, sidepods, engine cover */}
      <path
        d="M2.7 -0.1 L2.7 0.1 L1.2 0.24 L0.8 0.72 L-1.2 0.72 L-1.7 0.45 L-2.25 0.3 L-2.25 -0.3 L-1.7 -0.45 L-1.2 -0.72 L0.8 -0.72 L1.2 -0.24 Z"
        fill={colour}
        stroke="#0b0c0f"
        strokeWidth={0.06}
        strokeLinejoin="round"
      />
      {/* cockpit + halo */}
      <ellipse cx={0.2} cy={0} rx={0.38} ry={0.19} fill="#0b0c0f" />
      <path d="M0.62 0 L0.08 -0.2 M0.62 0 L0.08 0.2" stroke="#0b0c0f" strokeWidth={0.07} />
      {/* engine cover spine */}
      <path d="M-0.3 0 L-1.9 0" stroke="#000" strokeOpacity={0.35} strokeWidth={0.14} strokeLinecap="round" />
    </g>
  )
}
