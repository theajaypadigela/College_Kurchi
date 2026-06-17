import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: 'Home', path: '/app/recommendations', icon: 'home' },
  { label: 'AI Counselor', path: '/app/ai-counselor', icon: 'smart_toy' },
  { label: 'College Finder', path: '/app/colleges', icon: 'travel_explore' },
  { label: 'Cutoff Explorer', path: '/app/cutoffs', icon: 'trending_up' },
  { label: 'Admission Predictor', path: '/app/predictor', icon: 'analytics' },
  { label: 'My Shortlist', path: '/app/shortlist', icon: 'bookmark' },
  { label: 'Comparison', path: '/app/compare', icon: 'compare_arrows' },
];

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/app/recommendations') {
      return location.pathname === '/app/recommendations' || location.pathname === '/app';
    }
    return location.pathname.startsWith(path);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-outline-variant/30">
        <span className="material-symbols-outlined text-primary text-3xl">school</span>
        <div>
          <div className="font-bold text-on-surface text-lg leading-tight">College Kurchi</div>
          <div className="text-xs text-outline">TS EAMCET Guide</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors text-sm font-medium ${
              isActive(item.path)
                ? 'bg-secondary-container text-on-secondary-container font-semibold'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-xl">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User info + CTA */}
      <div className="p-4 border-t border-outline-variant/30 space-y-3">
        {/* User card */}
        {user && (
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-primary text-base">person</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-on-surface truncate">{user.name}</div>
              <div className="text-xs text-outline truncate">Rank {user.rank.toLocaleString()} · {user.category}</div>
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="text-outline hover:text-error transition-colors flex-shrink-0"
              title="Sign out"
            >
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          </div>
        )}
        <button
          onClick={() => { navigate('/app/predictor'); setMobileOpen(false); }}
          className="w-full bg-primary text-on-primary rounded-lg py-3 px-4 font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-xl">analytics</span>
          Start Predicting
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 bg-surface-container-lowest border-r border-outline-variant/30 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 bg-surface-container-lowest h-full shadow-xl z-50">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-on-surface"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-20 bg-surface-container-lowest border-b border-outline-variant/30 flex items-center gap-4 px-4 py-3">
        <button onClick={() => setMobileOpen(true)} className="text-on-surface">
          <span className="material-symbols-outlined">menu</span>
        </button>
        <span className="material-symbols-outlined text-primary">school</span>
        <span className="font-bold text-on-surface">College Kurchi</span>
      </div>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 min-h-screen">
        <div className="lg:hidden h-14" /> {/* spacer for mobile top bar */}
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
