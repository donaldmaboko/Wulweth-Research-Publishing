/**
 * The Wulweth mark — a rounded double-peak zigzag with a red angled accent,
 * drawn as inline SVG so it stays crisp at any size and can invert for dark
 * backgrounds (`light` renders the zigzag in white).
 */
export function LogoMark({ className = "h-8 w-auto", light = false }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox="0 0 368 228" className={className} role="img" aria-label="Wulweth"
      aria-hidden={undefined}>
      <path d="M301 10 L357 10 L323 100 L267 100 Z" fill="#E63B2E" />
      <path d="M34 186 L102 56 L170 186 L238 56 L306 186 L352 119"
        fill="none" stroke={light ? "#FFFFFF" : "#262B3D"} strokeWidth={46}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
