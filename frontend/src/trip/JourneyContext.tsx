import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Mode, RouteResult, Trip } from '../api/types';

export interface Endpoint {
  name: string;
  lat: number;
  lng: number;
  placeId?: string | null;
}

interface JourneyValue {
  origin: Endpoint | null;
  destination: Endpoint | null;
  setOrigin: (e: Endpoint | null) => void;
  setDestination: (e: Endpoint | null) => void;
  /** The mode + route the user picked on Route options. */
  selection: { mode: Mode; route: RouteResult } | null;
  setSelection: (s: { mode: Mode; route: RouteResult } | null) => void;
  /** The trip currently being recorded, and the one just finished. */
  activeTrip: Trip | null;
  setActiveTrip: (t: Trip | null) => void;
  finishedTrip: Trip | null;
  setFinishedTrip: (t: Trip | null) => void;
}

const JourneyContext = createContext<JourneyValue | null>(null);

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [origin, setOrigin] = useState<Endpoint | null>(null);
  const [destination, setDestination] = useState<Endpoint | null>(null);
  const [selection, setSelection] = useState<{ mode: Mode; route: RouteResult } | null>(null);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [finishedTrip, setFinishedTrip] = useState<Trip | null>(null);

  const value = useMemo(
    () => ({
      origin,
      destination,
      setOrigin,
      setDestination,
      selection,
      setSelection,
      activeTrip,
      setActiveTrip,
      finishedTrip,
      setFinishedTrip,
    }),
    [origin, destination, selection, activeTrip, finishedTrip]
  );

  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}

export function useJourney(): JourneyValue {
  const value = useContext(JourneyContext);
  if (!value) throw new Error('useJourney must be used inside JourneyProvider');
  return value;
}
