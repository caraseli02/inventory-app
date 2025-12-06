import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const baseProps = {
  stroke: 'currentColor',
  fill: 'none',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
} satisfies Omit<IconProps, 'children'>;

export const ArrowLeftIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...baseProps} {...props}>
    <path d="M10.5 19.5 3 12l7.5-7.5" />
    <path d="M3 12h18" />
  </svg>
);

export const ShoppingCartIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...baseProps} {...props}>
    <path d="M4 5.5h2l1.2 10h10.4l1.4-7H6.3" />
    <circle cx="10.4" cy="18.5" r="1.1" />
    <circle cx="16.6" cy="18.5" r="1.1" />
  </svg>
);

export const WarningIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...baseProps} {...props}>
    <path d="M12 3.5 3.5 19h17z" />
    <path d="M12 9.5v4.5" />
    <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const CheckCircleIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...baseProps} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.7 2.7 4.3-5.4" />
  </svg>
);

export const CloseIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...baseProps} {...props}>
    <path d="m6.5 6.5 11 11" />
    <path d="m17.5 6.5-11 11" />
  </svg>
);

export const BoxIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...baseProps} {...props}>
    <path d="M4.5 7 12 3.5 19.5 7v9.5L12 20.5 4.5 16.5z" />
    <path d="M4.5 7 12 10.5 19.5 7" />
    <path d="M12 10.5V20.5" />
  </svg>
);

export const MinusIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...baseProps} {...props}>
    <path d="M5 12h14" />
  </svg>
);

export const PlusIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...baseProps} {...props}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

export const SearchIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...baseProps} {...props}>
    <circle cx="11" cy="11" r="5.5" />
    <path d="m15.5 15.5 3.25 3.25" />
  </svg>
);

export const PencilIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" {...baseProps} {...props}>
    <path d="m4.75 15.75 10-10a1.9 1.9 0 0 1 2.7 0l.8.8a1.9 1.9 0 0 1 0 2.7l-10 10-4.5 1.2z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
);
