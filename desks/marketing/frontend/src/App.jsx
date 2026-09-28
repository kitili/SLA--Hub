import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

// Auth — kept eager so the very first paint (login) isn't waiting on a lazy chunk
import Login          from './pages/Login';
import ChangePassword from './pages/shared/ChangePassword';

// Everything else loads on demand — nobody downloads the SE/Dispensary bundles
// just to use Marketing, and vice versa.
const MarketingDashboard = lazy(() => import('./pages/marketing/Dashboard'));
const Leads              = lazy(() => import('./pages/marketing/Leads'));
const Campaigns          = lazy(() => import('./pages/marketing/Campaigns'));
const Analytics          = lazy(() => import('./pages/marketing/Analytics'));
const MarketingCalendar  = lazy(() => import('./pages/marketing/CalendarPage'));
const Team               = lazy(() => import('./pages/marketing/Team'));
const Reports            = lazy(() => import('./pages/marketing/Reports'));
const MarketingProfile   = lazy(() => import('./pages/marketing/Profile'));

const SEDashboard   = lazy(() => import('./pages/se/Dashboard'));
const Incidents     = lazy(() => import('./pages/se/Incidents'));
const Walkthroughs  = lazy(() => import('./pages/se/Walkthroughs'));
const Behaviour     = lazy(() => import('./pages/se/Behaviour'));
const EventReports  = lazy(() => import('./pages/se/EventReports'));
const SEDispensary  = lazy(() => import('./pages/se/DispensaryView'));
const SECalendar    = lazy(() => import('./pages/se/CalendarPage'));
const SETeam        = lazy(() => import('./pages/se/Team'));
const SEReports     = lazy(() => import('./pages/se/Reports'));
const SEProfile     = lazy(() => import('./pages/se/Profile'));

const DispensaryDashboard = lazy(() => import('./pages/dispensary/Dashboard'));
const Visits              = lazy(() => import('./pages/dispensary/Visits'));
const Inventory           = lazy(() => import('./pages/dispensary/Inventory'));
const Referrals           = lazy(() => import('./pages/dispensary/Referrals'));
const Quotations          = lazy(() => import('./pages/dispensary/Quotations'));
const DispensaryReports   = lazy(() => import('./pages/dispensary/Reports'));
const DispensaryProfile   = lazy(() => import('./pages/dispensary/Profile'));

function Guard({ roles, children }) {
  const { user, mustChangePassword, hasAnyRole } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (mustChangePassword || user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  if (roles && !hasAnyRole(...roles)) return <Navigate to="/login" replace />;
  return children;
}

const MKT  = ['global_marketing_head', 'campus_marketing_head'];
const SE   = ['global_student_exp_head', 'campus_student_exp_head'];
const DISP = ['nurse', 'global_student_exp_head', 'campus_student_exp_head'];

export default function App() {
  const { user, mustChangePassword, hasAnyRole } = useAuthStore();

  function defaultRedirect() {
    if (!user) return '/login';
    if (mustChangePassword || user.mustChangePassword) return '/change-password';
    if (hasAnyRole(...MKT))  return '/marketing';
    if (hasAnyRole(...SE))   return '/se';
    if (hasAnyRole('nurse')) return '/dispensary';
    return '/login';
  }

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/"      element={<Navigate to={defaultRedirect()} replace />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/change-password"
            element={user ? <ChangePassword /> : <Navigate to="/login" replace />}
          />

          {/* ── MARKETING ── */}
          <Route path="/marketing"          element={<Guard roles={MKT}><MarketingDashboard /></Guard>} />
          <Route path="/marketing/leads"    element={<Guard roles={MKT}><Leads /></Guard>} />
          <Route path="/marketing/campaigns"element={<Guard roles={MKT}><Campaigns /></Guard>} />
          <Route path="/marketing/analytics"element={<Guard roles={MKT}><Analytics /></Guard>} />
          <Route path="/marketing/calendar" element={<Guard roles={MKT}><MarketingCalendar /></Guard>} />
          <Route path="/marketing/team"     element={<Guard roles={MKT}><Team /></Guard>} />
          <Route path="/marketing/reports"  element={<Guard roles={MKT}><Reports /></Guard>} />
          <Route path="/marketing/profile"  element={<Guard roles={MKT}><MarketingProfile /></Guard>} />

          {/* ── STUDENT EXPERIENCE ── */}
          <Route path="/se"                element={<Guard roles={SE}><SEDashboard /></Guard>} />
          <Route path="/se/incidents"      element={<Guard roles={SE}><Incidents /></Guard>} />
          <Route path="/se/walkthroughs"   element={<Guard roles={SE}><Walkthroughs /></Guard>} />
          <Route path="/se/behaviour"      element={<Guard roles={SE}><Behaviour /></Guard>} />
          <Route path="/se/events"         element={<Guard roles={SE}><EventReports /></Guard>} />
          <Route path="/se/dispensary"     element={<Guard roles={SE}><SEDispensary /></Guard>} />
          <Route path="/se/calendar"       element={<Guard roles={SE}><SECalendar /></Guard>} />
          <Route path="/se/team"           element={<Guard roles={SE}><SETeam /></Guard>} />
          <Route path="/se/reports"        element={<Guard roles={SE}><SEReports /></Guard>} />
          <Route path="/se/profile"        element={<Guard roles={SE}><SEProfile /></Guard>} />

          {/* ── DISPENSARY ── */}
          <Route path="/dispensary"             element={<Guard roles={DISP}><DispensaryDashboard /></Guard>} />
          <Route path="/dispensary/visits"      element={<Guard roles={DISP}><Visits /></Guard>} />
          <Route path="/dispensary/inventory"   element={<Guard roles={DISP}><Inventory /></Guard>} />
          <Route path="/dispensary/referrals"   element={<Guard roles={DISP}><Referrals /></Guard>} />
          <Route path="/dispensary/quotations"  element={<Guard roles={DISP}><Quotations /></Guard>} />
          <Route path="/dispensary/reports"     element={<Guard roles={DISP}><DispensaryReports /></Guard>} />
          <Route path="/dispensary/profile"     element={<Guard roles={DISP}><DispensaryProfile /></Guard>} />

          <Route path="*" element={<Navigate to={defaultRedirect()} replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
