import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StaffProvider, useStaff } from './context/StaffContext';
import { AdminProvider, useAdmin } from './context/AdminContext';
import { HubContentProvider } from './context/HubContentContext';
import Layout from './components/Layout';
import StaffRegistration from './components/StaffRegistration';
import AdminPinModal from './components/AdminPinModal';
import Dashboard from './pages/Dashboard';
import SectionPage from './pages/SectionPage';
import DocumentViewer from './pages/DocumentViewer';
import AdminDashboard from './pages/AdminDashboard';
import './index.css';

function AppGate({ children }) {
  const { staff, loading } = useStaff();
  if (loading) return <div className="app-loading">Loading…</div>;
  if (!staff) return <StaffRegistration />;
  return children;
}

function AppShell({ children }) {
  const { showPinPrompt } = useAdmin();
  return (
    <>
      {showPinPrompt && <AdminPinModal />}
      {children}
    </>
  );
}

export default function App() {
  return (
    <StaffProvider>
      <AdminProvider>
        <HubContentProvider>
          <BrowserRouter>
            <AppShell>
              <Routes>
                <Route path="/view" element={<AppGate><DocumentViewer /></AppGate>} />
                <Route path="/admin" element={<AppGate><AdminDashboard /></AppGate>} />
                <Route element={<AppGate><Layout /></AppGate>}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/section/:sectionId" element={<SectionPage />} />
                </Route>
              </Routes>
            </AppShell>
          </BrowserRouter>
        </HubContentProvider>
      </AdminProvider>
    </StaffProvider>
  );
}
