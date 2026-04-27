type AvatarProps = {
  initials: string;
  color?: string;
  size?: number;
  ring?: boolean;
  dark?: boolean;
};

export function Avatar({
  initials,
  color = '#daff3f',
  size = 32,
  ring = false,
  dark = false,
}: AvatarProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        color: '#0a0a0a',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--f-display)',
        fontWeight: 700,
        fontSize: size * 0.4,
        letterSpacing: '-0.02em',
        border: ring ? `2px solid ${dark ? '#0a0a0a' : '#fff'}` : 'none',
        boxShadow: ring ? '0 0 0 2px rgba(218,255,63,0.5)' : 'none',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

type AvatarStackProps = {
  members: Array<{ initials: string; color: string }>;
  size?: number;
  dark?: boolean;
};

export function AvatarStack({ members, size = 28, dark = false }: AvatarStackProps) {
  return (
    <div style={{ display: 'flex' }}>
      {members.map((m, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <Avatar initials={m.initials} color={m.color} size={size} ring dark={dark} />
        </div>
      ))}
    </div>
  );
}
