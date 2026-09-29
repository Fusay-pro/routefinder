import { NavLink } from 'react-router-dom';
import { ActivityIcon, ExploreIcon, LeaderboardIcon, ProfileIcon } from './icons';

// Leaderboard sits second, not first: you have to go somewhere before a board
// means anything, so Go stays the landing tab.
const TABS = [
  { to: '/', label: 'Go', Icon: ExploreIcon, end: true },
  { to: '/leaderboard', label: 'Board', Icon: LeaderboardIcon, end: false },
  { to: '/activity', label: 'Activity', Icon: ActivityIcon, end: false },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon, end: false },
];

export function BottomNav() {
  return (
    <nav className="flex justify-around border-t border-surface-c bg-surface-lowest px-2 pb-2.5 pt-1.5">
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex h-[50px] w-[72px] flex-col items-center justify-center gap-[3px] rounded-xl ${
              isActive ? 'bg-success-container text-on-primary-container' : 'text-on-surface-variant'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={22} />
              <span className={`font-label text-[10px] ${isActive ? 'font-bold' : 'font-semibold'}`}>
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
