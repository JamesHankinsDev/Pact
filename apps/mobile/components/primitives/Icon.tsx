import { Svg, Path, Circle, Rect, G } from 'react-native-svg';
import type { ReactElement } from 'react';

export type IconName =
  | 'check' | 'plus' | 'minus' | 'x' | 'chevron' | 'chevronDown' | 'arrow'
  | 'flame' | 'dumbbell' | 'bowl' | 'bag' | 'pill' | 'book' | 'chat'
  | 'chart' | 'camera' | 'upload' | 'sparkle' | 'heart' | 'bell' | 'target'
  | 'weight' | 'cal' | 'home' | 'user' | 'cart' | 'leaf' | 'run' | 'moon'
  | 'sun' | 'eye' | 'eyeOff' | 'settings';

const stroke = (d: string) => <Path d={d} />;

function pathsFor(name: IconName): ReactElement {
  switch (name) {
    case 'check': return stroke('M4 10l4 4 8-8');
    case 'plus': return stroke('M10 4v12M4 10h12');
    case 'minus': return stroke('M4 10h12');
    case 'x': return stroke('M5 5l10 10M15 5L5 15');
    case 'chevron': return stroke('M7 4l6 6-6 6');
    case 'chevronDown': return stroke('M4 7l6 6 6-6');
    case 'arrow': return stroke('M4 10h12M11 5l5 5-5 5');
    case 'flame': return stroke('M10 17c3 0 5-2 5-5 0-2-1-3-2-4 0 1-1 2-2 2 0-2-1-4-3-6-1 3-3 5-3 8 0 3 2 5 5 5z');
    case 'dumbbell': return <G><Path d="M3 8v4M5 6v8M15 6v8M17 8v4M5 10h10" /></G>;
    case 'bowl': return <G><Path d="M3 9h14M4 9c0 5 3 7 6 7s6-2 6-7M9 5c0-1 1-2 2-2" /></G>;
    case 'bag': return <G><Path d="M5 7h10l-1 10H6L5 7zM7 7V5a3 3 0 016 0v2" /></G>;
    case 'pill': return <G><Circle cx="10" cy="10" r="6" /><Path d="M6 10h8" /></G>;
    case 'book': return stroke('M4 4h5a3 3 0 013 3v9M16 4h-5a3 3 0 00-3 3v9M4 4v12h12V4');
    case 'chat': return stroke('M3 5h14v9H8l-3 3v-3H3z');
    case 'chart': return stroke('M3 16l4-5 3 2 4-6 3 4');
    case 'camera': return <G><Path d="M4 6h2l1-2h6l1 2h2v9H4z" /><Circle cx="10" cy="10" r="3" /></G>;
    case 'upload': return stroke('M10 14V4M5 9l5-5 5 5M3 16h14');
    case 'sparkle': return <G><Path d="M10 3v4M10 13v4M3 10h4M13 10h4" /><Path d="M6 6l1.5 1.5M14 14l-1.5-1.5M14 6l-1.5 1.5M6 14l1.5-1.5" /></G>;
    case 'heart': return stroke('M10 16s-6-3.5-6-8a3.5 3.5 0 016-2.5A3.5 3.5 0 0116 8c0 4.5-6 8-6 8z');
    case 'bell': return stroke('M5 14V9a5 5 0 0110 0v5l1 1H4l1-1zM8 17h4');
    case 'target': return <G><Circle cx="10" cy="10" r="6" /><Circle cx="10" cy="10" r="3" /><Circle cx="10" cy="10" r="1" fill="currentColor" /></G>;
    case 'weight': return <G><Path d="M3 7h14M5 7l1 9h8l1-9" /><Circle cx="10" cy="10" r="1.5" fill="currentColor" /></G>;
    case 'cal': return <G><Rect x="3" y="5" width="14" height="12" rx="1" /><Path d="M3 9h14M7 3v4M13 3v4" /></G>;
    case 'home': return stroke('M3 9l7-6 7 6v8h-5v-5H8v5H3V9z');
    case 'user': return <G><Circle cx="10" cy="7" r="3" /><Path d="M4 17c1-3 3-5 6-5s5 2 6 5" /></G>;
    case 'cart': return <G><Circle cx="7" cy="16" r="1.5" /><Circle cx="14" cy="16" r="1.5" /><Path d="M3 4h2l2 9h9l2-7H6" /></G>;
    case 'leaf': return stroke('M4 16c0-7 5-12 12-12 0 7-5 12-12 12zM4 16c4-2 7-5 9-9');
    case 'run': return <G><Circle cx="13" cy="4" r="1.5" /><Path d="M5 18l3-4-2-3 4-3 3 4 3 1M5 11l3-1" /></G>;
    case 'moon': return stroke('M14 12a5 5 0 11-6-6 4 4 0 006 6z');
    case 'sun': return <G><Circle cx="10" cy="10" r="3" /><Path d="M10 3v2M10 15v2M3 10h2M15 10h2M5 5l1.5 1.5M13.5 13.5L15 15M5 15l1.5-1.5M13.5 6.5L15 5" /></G>;
    case 'eye': return <G><Path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" /><Circle cx="10" cy="10" r="2.5" /></G>;
    case 'eyeOff': return <G><Path d="M3 3l14 14M8 6c.6-.1 1.3-.2 2-.2 5 0 8 4.2 8 4.2-.5.7-1.1 1.6-1.9 2.4M5 6c-1.5 1.4-3 4-3 4s3 6 8 6c1.4 0 2.6-.4 3.7-1" /></G>;
    case 'settings': return <G><Circle cx="10" cy="10" r="2.5" /><Path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.5 4.5l1.5 1.5M14 14l1.5 1.5M4.5 15.5l1.5-1.5M14 6l1.5-1.5" /></G>;
  }
}

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 18, color = '#f5f3ee', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {pathsFor(name)}
    </Svg>
  );
}
