// Hand-drawn 24px icons, stroked in currentColor.
const P: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM16 16l5 5',
  library: 'M4 4v16M9 4v16M14 4.5l5 15',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.4z',
  prev: 'M19 5v14L8 12zM5 5v14',
  next: 'M5 5v14l11-7zM19 5v14',
  shuffle: 'M3 7h3.5c2 0 3.2 1 4.3 2.7l2.4 4.6c1.1 1.7 2.3 2.7 4.3 2.7H21M3 17h3.5c1.4 0 2.4-.5 3.2-1.4M13.3 8.4c.8-.9 1.8-1.4 3.2-1.4H21M18 4l3 3-3 3M18 14l3 3-3 3',
  repeat: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4',
  heart: 'M12 20.5s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 3c0 5.9-8 10.5-8 10.5z',
  lyrics: 'M4 5h16M4 10h10M4 15h16M4 20h8',
  queue: 'M4 6h12M4 12h12M4 18h8M18 15v6l4-3z',
  back: 'M15 5l-7 7 7 7',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  plus: 'M12 5v14M5 12h14',
  alert: 'M12 8v5M12 16.5v.5M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
}

export function Icon({ name, size = 32, fill = false }: { name: string; size?: number; fill?: boolean }) {
  return (
    <svg class="icon" width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  )
}

export const PlayGlyph = ({ size = 40 }: { size?: number }) => (
  <svg class="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.4-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" fill="currentColor" />
  </svg>
)

export const PauseGlyph = ({ size = 40 }: { size?: number }) => (
  <svg class="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="5.5" y="4" width="4.5" height="16" rx="1.2" fill="currentColor" />
    <rect x="14" y="4" width="4.5" height="16" rx="1.2" fill="currentColor" />
  </svg>
)

/** BitChord's mark (web/app/src/assets/logo-mark.svg) on its red tile. */
export const Logo = ({ size = 56 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
    <rect width="56" height="56" rx="14" fill="#fa233b" />
    <svg x="12" y="17" width="32" height="22" viewBox="0 0 730 484">
      <path
        fill="#fff"
        d="M6.73729 316.937C20.201 294.159 49.6986 286.649 72.4033 300.174H72.4277C237.603 398.282 510.121 407.302 667.823 359.439C693.147 351.759 719.927 366.055 727.602 391.378C735.276 416.715 720.992 443.477 695.649 451.176C514.618 506.132 213.674 495.514 23.5058 382.622C0.678772 369.103 -6.78757 339.685 6.73729 316.937ZM77.8135 154.865C89.38 136.046 113.982 130.11 132.77 141.676C270.528 226.369 480.519 250.891 643.46 201.43C664.592 195.047 686.911 206.957 693.324 228.052C699.689 249.184 687.774 271.46 666.679 277.886C480.555 334.36 249.169 307.004 90.9707 209.79C72.1827 198.224 66.247 173.628 77.8135 154.865ZM140.542 15.3012C149.722 0.246392 169.428 -4.52761 184.482 4.71335C304.811 78.2128 456.29 94.8593 634.684 54.101C651.874 50.1843 669.01 60.9551 672.927 78.1518C676.862 95.3486 666.134 112.484 648.9 116.401C453.677 161.021 286.219 141.799 151.129 59.2417C136.074 50.0006 131.301 30.3561 140.542 15.3012Z"
      />
    </svg>
  </svg>
)
