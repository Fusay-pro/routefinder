export function km(meters: number): string {
  return `${(meters / 1000).toFixed(meters < 10000 ? 2 : 1)} km`;
}

export function minutes(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

export function clock(seconds: number): string {
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function paceKmh(meters: number, seconds: number): string {
  if (seconds <= 0) return '0.0';
  return (meters / 1000 / (seconds / 3600)).toFixed(1);
}

export function relativeTime(iso: string | null): string {
  if (!iso) return 'never reported';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

// Grams up to a kilo, then kilos. A 400m walk saving "0.07 kg" reads as
// nothing; "68 g" reads as something.
export function co2(grams: number): string {
  if (grams < 1000) return `${Math.round(grams)} g`;
  return `${(grams / 1000).toFixed(grams < 10000 ? 2 : 1)} kg`;
}

export function ordinal(rank: number): string {
  const rem100 = rank % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${rank}th`;
  return `${rank}${['th', 'st', 'nd', 'rd'][rank % 10] ?? 'th'}`;
}
