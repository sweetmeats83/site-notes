import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import Icon from '../common/Icon.jsx';
import QuickCapture from '../common/QuickCapture.jsx';

const NAV = [
  { to: '/',         icon: 'home',     label: 'Projects' },
  { to: '/pipeline', icon: 'work',     label: 'Pipeline' },
  { to: '/search',   icon: 'search',   label: 'Search'   },
  { to: '/settings', icon: 'settings', label: 'Settings' },
];

export default function Layout() {
  const { setQCOpen, notification, settings } = useApp();
  const { resolved, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const appName = settings?.app_name || 'SiteNote';

  // Hide bottom nav inside the note editor to give more screen space
  const hideNav = /\/notes\//.test(location.pathname);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 safe-top">
        <div className="flex items-center h-14 px-4 max-w-6xl mx-auto gap-3">
          {/* Back button when inside a note */}
          {location.pathname !== '/' && (
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Back"
            >
              <Icon name="arrow_back" />
            </button>
          )}

          <span className="text-lg font-bold text-blue-600 dark:text-blue-400 tracking-tight">
            {appName}
          </span>

          <div className="flex-1" />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isActive
                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                <Icon name={icon} size="sm" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle theme"
            title={resolved === 'neon' ? 'Neon theme (change in Settings)' : 'Toggle theme'}
          >
            <Icon name={resolved === 'neon' ? 'bolt' : resolved === 'dark' ? 'light_mode' : 'dark_mode'} size="sm" />
          </button>

          {/* Quick capture FAB (header version for desktop) */}
          <button
            onClick={() => setQCOpen(true)}
            className="hidden md:flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <Icon name="add" size="sm" />
            Capture
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      {!hideNav && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 safe-bottom">
          <div className="grid grid-cols-5 h-16">
            {NAV.map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors
                  ${isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon name={icon} size="sm" filled={isActive} />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
            {/* Quick capture as 4th tab */}
            <button
              onClick={() => setQCOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-blue-600 dark:text-blue-400"
            >
              <div className="w-10 h-10 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center shadow-md -mt-4">
                <Icon name="add" size="sm" className="text-white" />
              </div>
              <span className="mt-0.5">Capture</span>
            </button>
          </div>
        </nav>
      )}

      {/* Floating quick capture button (visible in note editor on mobile) */}
      {hideNav && (
        <button
          onClick={() => setQCOpen(true)}
          className="md:hidden fixed bottom-6 right-4 z-40 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xl flex items-center justify-center transition-colors"
          aria-label="Quick capture"
        >
          <Icon name="add" size="lg" />
        </button>
      )}

      {/* Toast notifications */}
      {notification && (
        <div className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 transition-all
          ${notification.type === 'error'   ? 'bg-red-600 text-white' :
            notification.type === 'success' ? 'bg-green-600 text-white' :
            'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
          }`}
        >
          <Icon
            name={notification.type === 'error' ? 'error' : notification.type === 'success' ? 'check_circle' : 'info'}
            size="sm"
            filled
          />
          {notification.message}
        </div>
      )}

      <QuickCapture />
    </div>
  );
}
