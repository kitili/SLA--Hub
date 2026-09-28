import { Link, Outlet } from 'react-router-dom';
import { Menu, X, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useHubContent } from '../context/HubContentContext';
import { brand } from '../data/brand';
import { useStaff } from '../context/StaffContext';
import { useAdmin } from '../context/AdminContext';
import './Layout.css';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { sections } = useHubContent();
  const { staff, logout, isAdmin } = useStaff();
  const { pinVerified, openPinPrompt } = useAdmin();

  return (
    <div className="layout">
      <header className="header">
        <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <Link to="/" className="header-brand">
          <img
            src={brand.logos.brandmarkWhite}
            alt={brand.name}
            className="header-logo"
          />
          <div className="header-text">
            <span className="header-title">Onboarding Hub</span>
            <span className="header-subtitle">{brand.tagline}</span>
          </div>
        </Link>
        {staff && (
          <div className="header-user">
            <span className="header-user-name">{staff.full_name}</span>
            <button type="button" className="header-logout" onClick={logout} title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </header>

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand-strip">
          <img src={brand.logos.logomarkElectricBlue} alt="" className="sidebar-logomark" aria-hidden="true" />
          <span className="sidebar-brand-label">Staff Resources</span>
        </div>
        <nav className="sidebar-nav">
          <Link to="/" className="nav-item home" onClick={() => setSidebarOpen(false)}>
            <span className="nav-icon">🏠</span>
            Dashboard
          </Link>
          {isAdmin && pinVerified && (
            <Link to="/admin" className="nav-item admin-nav" onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon">📊</span>
              Admin Dashboard
            </Link>
          )}
          {isAdmin && !pinVerified && (
            <button type="button" className="nav-item admin-nav" onClick={() => { openPinPrompt(); setSidebarOpen(false); }}>
              <span className="nav-icon">🔐</span>
              Admin PIN
            </button>
          )}
          <div className="nav-divider" />
          {sections.map((section) => (
            <Link
              key={section.id}
              to={`/section/${section.id}`}
              className="nav-item"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon">{section.icon}</span>
              <span className="nav-label">
                <span className="nav-number">Section {section.number}</span>
                {section.title}
              </span>
            </Link>
          ))}
        </nav>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="main-content"><Outlet /></main>

      <footer className="site-footer">
        <img src={brand.logos.logomarkElectricBlue} alt="" className="footer-logomark" aria-hidden="true" />
        <span>{brand.name} · {brand.tagline}</span>
      </footer>
    </div>
  );
}
