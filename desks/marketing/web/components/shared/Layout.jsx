'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useState } from 'react';
import { BRAND, MODULE_COLOR } from '@/theme';
import CampusFilter from '@/components/shared/CampusFilter';
import FeedbackWidget from '@/components/shared/FeedbackWidget';
import { useFeedbackUi } from '@/lib/feedbackUi';
import {
  LayoutDashboard, Users, Megaphone, BarChart2, Calendar, Settings,
  Activity, Shield, Brain, FileText, Pill, Package, AlertTriangle,
  ClipboardList, LogOut, Menu, X, MessageSquarePlus,
} from 'lucide-react';

const C = {
  navy: BRAND.electricBlue, blue: BRAND.electricBlue, gold: BRAND.gold,
  sidebar: BRAND.electricBlue, sidebarHover: 'rgba(128,191,236,0.18)',
  text: BRAND.white, muted: BRAND.silver, border: 'rgba(255,255,255,0.15)',
  bg: '#F4F4F5', card: BRAND.white,
};

const NAV = {
  marketing: [
    { to: '/marketing',           icon: LayoutDashboard, label: 'Dashboard'    },
    { to: '/marketing/leads',     icon: Users,           label: 'Leads Funnel' },
    { to: '/marketing/agent',     icon: Brain,           label: 'Agent queue'  },
    { to: '/marketing/campaigns', icon: Megaphone,       label: 'Campaigns'    },
    { to: '/marketing/analytics', icon: BarChart2,       label: 'Analytics'    },
    { to: '/marketing/calendar',  icon: Calendar,        label: 'Events'       },
    { to: '/marketing/families',  icon: ClipboardList,   label: 'Families'     },
    { to: '/marketing/team',      icon: Users,           label: 'Team',        roles: ['ceo', 'global_marketing_head'] },
    { to: '/marketing/reports',   icon: FileText,        label: 'Reports'      },
    { to: '/marketing/feedback',  icon: MessageSquarePlus, label: 'Feedback',  roles: ['ceo', 'global_marketing_head', 'campus_marketing_head'] },
  ],
  se: [
    { to: '/se',              icon: LayoutDashboard, label: 'Dashboard'        },
    { to: '/se/incidents',    icon: AlertTriangle,   label: 'Incidents'        },
    { to: '/se/walkthroughs', icon: Shield,          label: 'Safety Checks'    },
    { to: '/se/behaviour',    icon: Brain,           label: 'Behaviour'        },
    { to: '/se/events',       icon: Activity,        label: 'Event Reports'    },
    { to: '/se/dispensary',   icon: Pill,            label: 'Dispensary View'  },
    { to: '/se/calendar',     icon: Calendar,        label: 'Calendar'         },
    { to: '/se/team',         icon: Users,           label: 'Team'             },
    { to: '/se/reports',      icon: FileText,        label: 'Reports'          },
  ],
  dispensary: [
    { to: '/dispensary',             icon: LayoutDashboard, label: 'Dashboard'  },
    { to: '/dispensary/visits',      icon: Activity,        label: 'Visits'     },
    { to: '/dispensary/inventory',   icon: Package,         label: 'Inventory'  },
    { to: '/dispensary/referrals',   icon: ClipboardList,   label: 'Referrals'  },
    { to: '/dispensary/quotations',  icon: FileText,        label: 'Quotations' },
    { to: '/dispensary/reports',     icon: BarChart2,       label: 'Reports'    },
  ],
};

function NavItem({ to, end, icon: Icon, label, open, moduleColor }) {
  const pathname = usePathname();
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
  return (
    <Link
      href={to}
      style={{
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
      }}
    >
      <Icon size={18} style={{ flexShrink: 0 }} />
      {open && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
    </Link>
  );
}

export default function Layout({ module, children }) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const setFeedbackOpen = useFeedbackUi((s) => s.setOpen);
  const shell = module === 'ceo' ? 'marketing' : module;

  const navItems = (NAV[shell] || []).filter((item) => !item.roles || item.roles.includes(user?.role));
  const moduleLabel = { marketing: 'Marketing', ceo: 'CEO', se: 'Student Experience', dispensary: 'Dispensary' }[shell];
  const moduleColor = MODULE_COLOR[shell];
  const profileHref = `/${shell}/profile`;
  const profileActive = pathname === profileHref;

  async function handleLogout() {
    await logout();
    router.push(user?.role === 'ceo' ? '/admin' : '/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
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
        <div style={{ padding: open ? '20px 16px 16px' : '20px 12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            aria-hidden
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              flexShrink: 0,
              background: BRAND.gold,
              color: BRAND.electricBlue,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '-0.04em',
            }}
          >
            SA
          </div>
          {open && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>Silverleaf</div>
              <div style={{ fontSize: 11, color: moduleColor, fontWeight: 600 }}>{moduleLabel}</div>
            </div>
          )}
          <button onClick={() => setOpen(!open)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 4, display: 'flex' }}>
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        <nav style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }}>
          {navItems.map(item => (
            <NavItem
              key={item.to}
              to={item.to}
              end={item.exact || item.to === `/${shell}`}
              icon={item.icon}
              label={item.label}
              open={open}
              moduleColor={moduleColor}
            />
          ))}
        </nav>

        <div style={{ padding: '12px 8px', borderTop: `1px solid ${C.border}` }}>
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 8, width: '100%',
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.muted, fontSize: 14, textAlign: 'left', marginBottom: 4,
            }}
          >
            <MessageSquarePlus size={18} style={{ flexShrink: 0 }} />
            {open && <span>Feedback</span>}
          </button>
          <Link href={profileHref} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            borderRadius: 8, textDecoration: 'none',
            color: profileActive ? 'white' : C.muted,
            background: profileActive ? C.sidebarHover : 'transparent',
            marginBottom: 4, fontSize: 14,
          }}>
            <Settings size={18} style={{ flexShrink: 0 }} />
            {open && <span>Profile Settings</span>}
          </Link>
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 8, width: '100%',
            background: 'none', border: 'none', cursor: 'pointer',
            color: BRAND.gold, fontSize: 14, textAlign: 'left',
          }}>
            <LogOut size={18} style={{ flexShrink: 0 }} />
            {open && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, marginLeft: open ? 240 : 64, transition: 'margin-left 0.2s ease', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: BRAND.white, borderBottom: `1px solid ${BRAND.silver}33`, padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <CampusFilter />
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

        <div style={{ flex: 1, padding: 24 }}>
          {children}
        </div>
      </main>
      <FeedbackWidget module={shell} />
    </div>
  );
}
