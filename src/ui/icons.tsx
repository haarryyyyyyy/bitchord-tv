// Stroke icons on a 24 grid (Lucide/Feather geometry, ISC/MIT), coloured with currentColor.
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`

const P: Record<string, string[]> = {
  search: [circle(11, 11, 8), 'm21 21-4.3-4.3'],
  settings: ['M14 17H5', 'M19 7h-9', circle(17, 17, 3), circle(7, 7, 3)],
  star: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z'],
  lyrics: ['M3 6h18', 'M3 12h13', 'M3 18h9'],
  queue: ['M21 15V6', 'M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'M12 12H3', 'M16 6H3', 'M12 18H3'],
  more: [circle(5, 12, 1), circle(12, 12, 1), circle(19, 12, 1)],
  next: ['M5 4l10 8-10 8z', 'M19 5v14'],
  prev: ['M19 20 9 12l10-8z', 'M5 19V5'],
  shuffle: ['M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22', 'm18 2 4 4-4 4', 'M2 6h1.9c1.5 0 2.9.9 3.6 2.2', 'M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8', 'm18 14 4 4-4 4'],
  repeat: ['m17 2 4 4-4 4', 'M3 11v-1a4 4 0 0 1 4-4h14', 'm7 22-4-4 4-4', 'M21 13v1a4 4 0 0 1-4 4H3'],
  plus: ['M12 5v14', 'M5 12h14'],
  check: ['M20 6 9 17l-5-5'],
  heart: ['M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'],
  delete: ['M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z', 'm12 9 6 6', 'm18 9-6 6'],
  radio: ['M4.9 19.1C1 15.2 1 8.8 4.9 4.9', 'M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5', circle(12, 12, 2), 'M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5', 'M19.1 4.9C23 8.8 23 15.1 19.1 19'],
  playNext: ['M21 6H9', 'M21 12H9', 'M21 18H9', 'M3 8l4 4-4 4'],
  addQueue: ['M11 12H3', 'M16 6H3', 'M16 18H3', 'M18 9v6', 'M21 12h-6'],
  album: [circle(12, 12, 10), circle(12, 12, 2)],
  artist: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', circle(12, 7, 4)],
  alert: [circle(12, 12, 10), 'M12 8v4', 'M12 16h.01'],
  music: ['M9 18V5l12-2v13', circle(6, 18, 3), circle(18, 16, 3)],
  space: ['M3 13v3h18v-3'],
}

export function Icon({ name, size = 32, fill = false, stroke = 2 }: { name: string; size?: number; fill?: boolean; stroke?: number }) {
  return (
    <svg class="icon" width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {(P[name] || []).map((d) => (
        <path d={d} />
      ))}
    </svg>
  )
}

export const PlayGlyph = ({ size = 40 }: { size?: number }) => (
  <svg class="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    {/* Nudged right of centre: a triangle's visual centre sits towards its point. */}
    <path d="M8 4.6v14.8a1 1 0 0 0 1.5.86l12.2-7.4a1 1 0 0 0 0-1.72L9.5 3.74A1 1 0 0 0 8 4.6z" fill="currentColor" />
  </svg>
)

export const PauseGlyph = ({ size = 40 }: { size?: number }) => (
  <svg class="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="5.5" y="4" width="4.5" height="16" rx="1.4" fill="currentColor" />
    <rect x="14" y="4" width="4.5" height="16" rx="1.4" fill="currentColor" />
  </svg>
)

/** BitChord's mark alone (web/app/src/assets/logo-mark.svg), as the TV tab bar shows it. */
export const LogoMark = ({ height = 40 }: { height?: number }) => (
  <svg width={(height * 730) / 484} height={height} viewBox="0 0 730 484" aria-label="BitChord" role="img">
    <path
      fill="currentColor"
      d="M6.73729 316.937C20.201 294.159 49.6986 286.649 72.4033 300.174H72.4277C237.603 398.282 510.121 407.302 667.823 359.439C693.147 351.759 719.927 366.055 727.602 391.378C735.276 416.715 720.992 443.477 695.649 451.176C514.618 506.132 213.674 495.514 23.5058 382.622C0.678772 369.103 -6.78757 339.685 6.73729 316.937ZM77.8135 154.865C89.38 136.046 113.982 130.11 132.77 141.676C270.528 226.369 480.519 250.891 643.46 201.43C664.592 195.047 686.911 206.957 693.324 228.052C699.689 249.184 687.774 271.46 666.679 277.886C480.555 334.36 249.169 307.004 90.9707 209.79C72.1827 198.224 66.247 173.628 77.8135 154.865ZM140.542 15.3012C149.722 0.246392 169.428 -4.52761 184.482 4.71335C304.811 78.2128 456.29 94.8593 634.684 54.101C651.874 50.1843 669.01 60.9551 672.927 78.1518C676.862 95.3486 666.134 112.484 648.9 116.401C453.677 161.021 286.219 141.799 151.129 59.2417C136.074 50.0006 131.301 30.3561 140.542 15.3012Z"
    />
  </svg>
)
