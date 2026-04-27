import type { ReactElement } from 'react';

export type IconName =
  | 'check' | 'plus' | 'minus' | 'x' | 'chevron' | 'chevronDown' | 'arrow'
  | 'flame' | 'dumbbell' | 'bowl' | 'bag' | 'pill' | 'book' | 'chat'
  | 'chart' | 'camera' | 'upload' | 'sparkle' | 'heart' | 'bell' | 'target'
  | 'weight' | 'cal' | 'home' | 'user' | 'cart' | 'leaf' | 'run' | 'moon'
  | 'sun' | 'eye' | 'eyeOff' | 'settings';

const paths: Record<IconName, ReactElement> = {
  check: <path d="M4 10l4 4 8-8" />,
  plus: <path d="M10 4v12M4 10h12" />,
  minus: <path d="M4 10h12" />,
  x: <path d="M5 5l10 10M15 5L5 15" />,
  chevron: <path d="M7 4l6 6-6 6" />,
  chevronDown: <path d="M4 7l6 6 6-6" />,
  arrow: <path d="M4 10h12M11 5l5 5-5 5" />,
  flame: <path d="M10 17c3 0 5-2 5-5 0-2-1-3-2-4 0 1-1 2-2 2 0-2-1-4-3-6-1 3-3 5-3 8 0 3 2 5 5 5z" />,
  dumbbell: <><path d="M3 8v4M5 6v8M15 6v8M17 8v4M5 10h10" /></>,
  bowl: <><path d="M3 9h14M4 9c0 5 3 7 6 7s6-2 6-7M9 5c0-1 1-2 2-2" /></>,
  bag: <><path d="M5 7h10l-1 10H6L5 7zM7 7V5a3 3 0 016 0v2" /></>,
  pill: <><circle cx="10" cy="10" r="6" /><path d="M6 10h8" /></>,
  book: <path d="M4 4h5a3 3 0 013 3v9M16 4h-5a3 3 0 00-3 3v9M4 4v12h12V4" />,
  chat: <path d="M3 5h14v9H8l-3 3v-3H3z" />,
  chart: <path d="M3 16l4-5 3 2 4-6 3 4" />,
  camera: <><path d="M4 6h2l1-2h6l1 2h2v9H4z" /><circle cx="10" cy="10" r="3" /></>,
  upload: <path d="M10 14V4M5 9l5-5 5 5M3 16h14" />,
  sparkle: <><path d="M10 3v4M10 13v4M3 10h4M13 10h4" /><path d="M6 6l1.5 1.5M14 14l-1.5-1.5M14 6l-1.5 1.5M6 14l1.5-1.5" /></>,
  heart: <path d="M10 16s-6-3.5-6-8a3.5 3.5 0 016-2.5A3.5 3.5 0 0116 8c0 4.5-6 8-6 8z" />,
  bell: <path d="M5 14V9a5 5 0 0110 0v5l1 1H4l1-1zM8 17h4" />,
  target: <><circle cx="10" cy="10" r="6" /><circle cx="10" cy="10" r="3" /><circle cx="10" cy="10" r="1" fill="currentColor" /></>,
  weight: <><path d="M3 7h14M5 7l1 9h8l1-9" /><circle cx="10" cy="10" r="1.5" fill="currentColor" /></>,
  cal: <><rect x="3" y="5" width="14" height="12" rx="1" /><path d="M3 9h14M7 3v4M13 3v4" /></>,
  home: <path d="M3 9l7-6 7 6v8h-5v-5H8v5H3V9z" />,
  user: <><circle cx="10" cy="7" r="3" /><path d="M4 17c1-3 3-5 6-5s5 2 6 5" /></>,
  cart: <><circle cx="7" cy="16" r="1.5" /><circle cx="14" cy="16" r="1.5" /><path d="M3 4h2l2 9h9l2-7H6" /></>,
  leaf: <path d="M4 16c0-7 5-12 12-12 0 7-5 12-12 12zM4 16c4-2 7-5 9-9" />,
  run: <><circle cx="13" cy="4" r="1.5" /><path d="M5 18l3-4-2-3 4-3 3 4 3 1M5 11l3-1" /></>,
  moon: <path d="M14 12a5 5 0 11-6-6 4 4 0 006 6z" />,
  sun: <><circle cx="10" cy="10" r="3" /><path d="M10 3v2M10 15v2M3 10h2M15 10h2M5 5l1.5 1.5M13.5 13.5L15 15M5 15l1.5-1.5M13.5 6.5L15 5" /></>,
  eye: <><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" /><circle cx="10" cy="10" r="2.5" /></>,
  eyeOff: <><path d="M3 3l14 14M8 6c.6-.1 1.3-.2 2-.2 5 0 8 4.2 8 4.2-.5.7-1.1 1.6-1.9 2.4M5 6c-1.5 1.4-3 4-3 4s3 6 8 6c1.4 0 2.6-.4 3.7-1" /></>,
  settings: <><circle cx="10" cy="10" r="2.5" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.5 4.5l1.5 1.5M14 14l1.5 1.5M4.5 15.5l1.5-1.5M14 6l1.5-1.5" /></>,
};

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 18, color = 'currentColor', strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
