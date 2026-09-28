import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useState } from 'react';
import LOGO from '../../assets/logo.jpg';
import { BRAND, MODULE_COLOR } from '../../theme';
import {
  LayoutDashboard, Users, Megaphone, BarChart2, Calendar, Settings,
  Activity, Shield, Brain, FileText, Pill, Package, AlertTriangle,
  ClipboardList, LogOut, Menu, X, ChevronRight, Bell
} from 'lucide-react';

const C = {
  navy: BRAND.electricBlue, blue: BRAND.electricBlue, gold: BRAND.gold,
  sidebar: BRAND.electricBlue, sidebarHover: 'rgba(128,191,236,0.18)',
  text: BRAND.white, muted: BRAND.silver, border: 'rgba(255,255,255,0.15)',
  bg: '#F4F4F5', card: BRAND.white,
};

const NAV = {
  marketing: [
    { to: '/marketing',          icon: LayoutDashboard, label: 'Dashboard'   },
    { to: '/marketing/leads',    icon: Users,           label: 'Leads Funnel'},
    { to: '/marketing/campaigns',icon: Megaphone,       label: 'Campaigns'   },
    { to: '/marketing/analytics',icon: BarChart2,       label: 'Analytics'   },
    { to: '/marketing/calendar', icon: Calendar,        label: 'Events'      },
    { to: '/marketing/team',     icon: Users,           label: 'Team'        },
    { to: '/marketing/reports',  icon: FileText,        label: 'Reports'     },
  ],
  se: [
    { to: '/se',                 icon: LayoutDashboard, label: 'Dashboard'       },
    { to: '/se/incidents',       icon: AlertTriangle,   label: 'Incidents'       },
    { to: '/se/walkthroughs',    icon: Shield,          label: 'Safety Checks'   },
    { to: '/se/behaviour',       icon: Brain,           label: 'Behaviour'       },
    { to: '/se/events',          icon: Activity,        label: 'Event Reports'   },
    { to: '/se/dispensary',      icon: Pill,            label: 'Dispensary View' },
    { to: '/se/calendar',        icon: Calendar,        label: 'Calendar'        },
    { to: '/se/team',            icon: Users,           label: 'Team'            },
    { to: '/se/reports',         icon: FileText,        label: 'Reports'         },
  ],
  dispensary: [
    { to: '/dispensary',              icon: LayoutDashboard, label: 'Dashboard'   },
    { to: '/dispensary/visits',       icon: Activity,        label: 'Visits'      },
    { to: '/dispensary/inventory',    icon: Package,         label: 'Inventory'   },
    { to: '/dispensary/referrals',    icon: ClipboardList,   label: 'Referrals'   },
    { to: '/dispensary/quotations',   icon: FileText,        label: 'Quotations'  },
    { to: '/dispensary/reports',      icon: BarChart2,       label: 'Reports'     },
  ],
};

export default function Layout({ module, children }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  const navItems = NAV[module] || [];

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const moduleLabel = { marketing: 'Marketing', se: 'Student Experience', dispensary: 'Dispensary' }[module];
  const moduleColor = MODULE_COLOR[module];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      {/* Sidebar */}
      <aside style={{
        width: open ? 240 : 64,
        background: C.sidebar,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0,
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 100,
        boxShadow: '2px 0 12px rgba(0,0,0,0.15)',
      }}>
        {/* Logo area */}
        <div style={{ padding: open ? '20px 16px 16px' : '20px 12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={LOGO}
            alt="Silverleaf Academy"
            style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }}
          />
          {open && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>Silverleaf</div>
              <div style={{ fontSize: 11, color: moduleColor, fontWeight: 600 }}>{moduleLabel}</div>
            </div>
          )}
          <button onClick={() => setOpen(!open)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 4, display: 'flex' }}>
            {open ? <X size={16}/> : <Menu size={16}/>}
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === `/${module}`}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                textDecoration: 'none',
                color: isActive ? 'white' : C.muted,
                background: isActive ? C.sidebarHover : 'transparent',
                marginBottom: 2,
                fontWeight: isActive ? 600 : 400,
                fontSize: 14,
                transition: 'all 0.15s',
                borderLeft: isActive ? `3px solid ${moduleColor}` : '3px solid transparent',
              })}
            >
              <item.icon size={18} style={{ flexShrink: 0 }}/>
              {open && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + settings */}
        <div style={{ padding: '12px 8px', borderTop: `1px solid ${C.border}` }}>
          <NavLink to={`/${module}/profile`} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            borderRadius: 8, textDecoration: 'none',
            color: isActive ? 'white' : C.muted,
            background: isActive ? C.sidebarHover : 'transparent',
            marginBottom: 4, fontSize: 14,
          })}>
            <Settings size={18} style={{ flexShrink: 0 }}/>
            {open && <span>Profile Settings</span>}
          </NavLink>
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 8, width: '100%',
            background: 'none', border: 'none', cursor: 'pointer',
            color: BRAND.gold, fontSize: 14, textAlign: 'left',
          }}>
            <LogOut size={18} style={{ flexShrink: 0 }}/>
            {open && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: open ? 240 : 64, transition: 'margin-left 0.2s ease', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <header style={{ background: BRAND.white, borderBottom: `1px solid ${BRAND.silver}33`, padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, color: BRAND.silver }}>
              {user?.campusName ? user.campusName : 'All Campuses'} · {user?.name}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: moduleColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: 14,
            }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div style={{ flex: 1, padding: 24 }}>
          {children}
        </div>
      </main>
    </div>
  );
}