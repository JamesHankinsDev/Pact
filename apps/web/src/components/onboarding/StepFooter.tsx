import Link from 'next/link';
import { Icon, type IconName } from '@/components/primitives';

type StepFooterProps = {
  step: 1 | 2 | 3 | 4;
  totalSteps?: number;
  href: string;
  label: string;
  icon?: IconName;
  disabled?: boolean;
};

export function StepFooter({
  step,
  totalSteps = 4,
  href,
  label,
  icon = 'arrow',
  disabled = false,
}: StepFooterProps) {
  return (
    <div style={{ padding: '0 22px 60px' }}>
      <div className="dot-row" style={{ justifyContent: 'center', marginBottom: 14 }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span key={i} className={i < step ? 'dot on' : 'dot'} />
        ))}
      </div>
      <Link
        href={disabled ? '#' : href}
        aria-disabled={disabled}
        className="btn btn-lime"
        style={{
          width: '100%',
          padding: '16px 20px',
          fontSize: 15,
          opacity: disabled ? 0.5 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
        }}
      >
        {label}
        <Icon name={icon} size={16} color="#0a0a0a" strokeWidth={2.5} />
      </Link>
    </div>
  );
}
