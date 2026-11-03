// Battery City logo: a red 12V car battery with + / - posts and a warning
// mark, signalling a battery that needs replacing. Same art as app/icon.svg.
export function BatteryIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} role="img" aria-label="Battery City logo">
      <rect x="6" y="5" width="5" height="4" rx="1" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8"/><rect x="21" y="5" width="5" height="4" rx="1" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8"/><rect x="2" y="8.5" width="28" height="20" rx="3" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.2"/><rect x="2.6" y="9.1" width="26.8" height="4" rx="2" fill="#991b1b"/><path d="M6.5 11.1h4M8.5 9.1v4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/><path d="M21.5 11.1h4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/><path d="M16 15.5 L22 25.5 H10 Z" fill="#facc15" stroke="#78350f" strokeWidth="0.8" strokeLinejoin="round"/><path d="M16 18.5v3.6" stroke="#1f2937" strokeWidth="1.6" strokeLinecap="round"/><circle cx="16" cy="24" r="0.9" fill="#1f2937"/>
    </svg>
  )
}

export default function BrandLogo({
  size = 24,
  text = "Battery City",
  className,
  style,
}: {
  size?: number
  text?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 8, ...style }}>
      <BatteryIcon size={size} />
      <span>{text}</span>
    </span>
  )
}
