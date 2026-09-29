import type { SVGProps } from 'react';

// One stroke style across the app: 24px grid, 1.9 weight, round caps.
function Icon({ children, size = 22, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ExploreIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2.2 5.1-5.1 2.2 2.2-5.1z" />
  </Icon>
);

export const RoutesIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <path d="M5 19V9a4 4 0 0 1 4-4h6" />
    <path d="m12 2 3 3-3 3" />
    <circle cx="5" cy="19" r="2" />
  </Icon>
);

export const RewardsIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <rect x="3" y="8" width="18" height="13" rx="2" />
    <path d="M3 12h18M12 8v13" />
    <path d="M12 8S10 3 7.5 4.2 9 8 12 8Zm0 0s2-5 4.5-3.8S15 8 12 8Z" />
  </Icon>
);

export const ActivityIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
    <path d="M3 4v5h5" />
    <path d="M12 8v4.5l3 1.8" />
  </Icon>
);

export const WalkIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <circle cx="13" cy="4.2" r="1.8" />
    <path d="M11 21l1.6-5.4-2.8-2.6.9-4.4 3.4 2 2.6.9" />
    <path d="M7.6 12.4 9.7 8.6 13.1 10" />
    <path d="m12.6 15.6 2.6 2.2.9 3.2" />
  </Icon>
);

export const BikeIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <circle cx="5.5" cy="17" r="3.5" />
    <circle cx="18.5" cy="17" r="3.5" />
    <path d="M14 5.5h3M9 17l3.5-7h3" />
    <path d="M5.5 17 10 10.5h5" />
  </Icon>
);

export const CarIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <path d="M4 16v-3.2L6 8h12l2 4.8V16" />
    <path d="M4 16h16v2.5h-3V16M7 18.5H4V16" />
  </Icon>
);

export const MotorcycleIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <circle cx="5" cy="17" r="3.4" />
    <circle cx="19" cy="17" r="3.4" />
    <path d="M8.4 17h4l4-6h-3" />
    <path d="M13 11 10.5 8H7" />
  </Icon>
);

export const CoinIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8.5v7M10 10.2h3.2a1.8 1.8 0 0 1 0 3.6H10" />
  </Icon>
);

export const PinIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Icon>
);

export const DotIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p} strokeWidth={2}>
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
  </Icon>
);

export const SunIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
  </Icon>
);

export const RainIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <path d="M7 16a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6 1.2A3.4 3.4 0 0 1 17 16z" />
    <path d="M9 19l-.8 2M13 19l-.8 2M17 19l-.8 2" />
  </Icon>
);

export const CheckIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p} strokeWidth={2.4}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);

export const AlertIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p} strokeWidth={2.4}>
    <path d="M12 7v6M12 16.5v.5" />
  </Icon>
);

export const CrossIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p} strokeWidth={2.4}>
    <path d="M7 7l10 10M17 7 7 17" />
  </Icon>
);

export const ArrowRightIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p} strokeWidth={2.2}>
    <path d="M5 12h13M13 6l6 6-6 6" />
  </Icon>
);

export const BackIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);

export const StopIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p} strokeWidth={2.2}>
    <rect x="6" y="6" width="12" height="12" rx="2.5" />
  </Icon>
);

export const LocateIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3.4" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
  </Icon>
);

export const SearchIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Icon>
);


export const RunIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <circle cx="15.5" cy="4.2" r="1.8" />
    <path d="M9.5 21l2.4-5.9-2.9-2.9 1.4-4.6 3.6 2.3 3 .7" />
    <path d="M5.6 11.4 9.3 8.2" />
    <path d="m11.9 15.1 3.2 2 1.1 3.9" />
    <path d="M3 13.5h3M4 17h2.5" />
  </Icon>
);

export const LeaderboardIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M7 5.5H4.5V7A3.5 3.5 0 0 0 7 10.3M17 5.5h2.5V7A3.5 3.5 0 0 1 17 10.3" />
    <path d="M12 14v3M8.5 21h7l-.7-3.2a1 1 0 0 0-1-.8h-3.6a1 1 0 0 0-1 .8z" />
  </Icon>
);

export const ProfileIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </Icon>
);

export const LeafIcon = (p: SVGProps<SVGSVGElement> & { size?: number }) => (
  <Icon {...p}>
    <path d="M4 20c0-7.5 5-13 16-13 0 8.5-5.5 13-12 13" />
    <path d="M4 20c2.5-4.5 6-7.5 10.5-9" />
  </Icon>
);

export const MODE_ICON = {
  walk: WalkIcon,
  run: RunIcon,
  bike: BikeIcon,
  motorcycle: MotorcycleIcon,
  car: CarIcon,
} as const;
