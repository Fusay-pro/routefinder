import type { CurrentWeather } from '../api/types';
import { RainIcon, SunIcon } from './icons';

/**
 * Weather is decorative: if the lookup fails (no API key configured, upstream
 * down) the pill disappears rather than breaking the screen around it.
 */
export function WeatherPill({ weather }: { weather: CurrentWeather | null }) {
  if (!weather) return null;

  const wet = /rain|storm|shower/i.test(weather.condition + weather.description);
  const Icon = wet ? RainIcon : SunIcon;

  const tone = weather.isBikeFriendly
    ? 'bg-surface-lowest text-on-surface-variant'
    : wet
      ? 'bg-surface-highest text-on-secondary-fixed'
      : 'bg-tertiary-fixed text-on-tertiary-container';

  return (
    <div className={`flex h-9 items-center gap-2 rounded-full px-3 shadow-chip ${tone}`}>
      <Icon size={16} />
      <span className="font-label text-xs font-bold">{Math.round(weather.temperatureC)}°C</span>
      <span className="font-label text-[11px] font-medium">{weather.advice}</span>
    </div>
  );
}
