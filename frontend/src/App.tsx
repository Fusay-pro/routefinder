import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { JourneyProvider } from './trip/JourneyContext';
import { BottomNav } from './components/BottomNav';
import { Login } from './screens/Login';
import { Explore } from './screens/Explore';
import { RouteOptions } from './screens/RouteOptions';
import { ActiveTrip } from './screens/ActiveTrip';
import { TripComplete } from './screens/TripComplete';
import { Rewards } from './screens/Rewards';
import { Activity } from './screens/Activity';
import { Leaderboard } from './screens/Leaderboard';
import { Profile } from './screens/Profile';

/** Screens that own the full height — the nav bar would crowd them. */
const FULL_BLEED = ['/trip', '/complete'];

function Shell() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Frame>
        <div className="flex h-full items-center justify-center">
          <span className="font-label text-sm text-outline">Loading…</span>
        </div>
      </Frame>
    );
  }

  if (!user) {
    return (
      <Frame>
        <Login />
      </Frame>
    );
  }

  const showNav = !FULL_BLEED.includes(location.pathname);

  return (
    <Frame>
      <div className="flex h-full flex-col">
        <div className="relative min-h-0 flex-grow">
          <Routes>
            <Route path="/" element={<Explore />} />
            <Route path="/routes" element={<RouteOptions />} />
            <Route path="/trip" element={<ActiveTrip />} />
            <Route path="/complete" element={<TripComplete />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/rewards" element={<Rewards />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        {showNav && <BottomNav />}
      </div>
    </Frame>
  );
}

/**
 * The app is phone-shaped. On a desktop browser it sits in a 390px frame rather
 * than stretching, so layouts match the design canvas.
 */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center bg-surface-highest">
      <div className="relative h-screen w-full max-w-[390px] overflow-hidden bg-surface shadow-float">
        {children}
      </div>
    </div>
  );
}

// One provider for the whole app rather than one per map: it loads the Maps
// JS SDK, and loading it repeatedly is what causes the duplicate-script warning.
const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';

export default function App() {
  return (
    <BrowserRouter>
      <APIProvider apiKey={MAPS_API_KEY}>
        <AuthProvider>
          <JourneyProvider>
            <Shell />
          </JourneyProvider>
        </AuthProvider>
      </APIProvider>
    </BrowserRouter>
  );
}
