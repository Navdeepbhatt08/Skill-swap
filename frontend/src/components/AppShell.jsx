import {
  BookOpen,
  Compass,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserRound,
  Calendar,
  Search,
  Users,
  Menu,
} from "lucide-react";
import { useState } from "react";

const workspaceItems = [
  ["Overview", "Overview", LayoutDashboard],
  ["Discover skills", "Discover", Search],
  ["Chat", "Chat", MessageCircle],
  ["Schedule", "Schedule", Calendar],
  ["Requests", "Requests", BookOpen],
  ["My profile", "Profile", UserRound],
];

export default function AppShell({
  activePage,
  requestCount,
  currentUser,
  onNavigate,
  onLogout,
  onLogin,
  notificationCount = 0,
  isAdmin = false,
  publicMode = false,
  children,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuItems = [
    ["Admin panel", "Admin", ShieldCheck],
    ...workspaceItems,
  ];

  return (
    <div className="app-shell min-h-screen">
      <main className="main-content mx-auto w-full">
        <header className="topbar flex items-center">
          <div className="brand">
            <span className="brand-mark">
              <Sparkles size={20} />
            </span>
            <span>
              Skill<span className="brand-accent">Swap</span>
            </span>
            <small className="brand-tagline">Campus</small>
          </div>
          {isAdmin ? (
            <div className="admin-menu">
              <button
                type="button"
                className="admin-menu-toggle"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Menu size={22} />
              </button>
              {menuOpen && (
                <nav className="admin-menu-panel" aria-label="Workspace navigation">
                  {menuItems.map(([page, label, Icon]) => (
                    <button
                      key={page}
                      className={activePage === page ? "nav-item active" : "nav-item"}
                      onClick={() => {
                        onNavigate(page);
                        setMenuOpen(false);
                      }}
                    >
                      <Icon size={16} />
                      <span>{label}</span>
                    </button>
                  ))}
                </nav>
              )}
            </div>
          ) : (
            <nav className="primary-nav flex items-center" aria-label="Workspace navigation">
              {workspaceItems.map(([page, label, Icon]) => (
                <button
                  key={page}
                  className={activePage === page ? "nav-item active" : "nav-item"}
                  onClick={() => onNavigate(page)}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  {page === "Requests" && requestCount > 0 && (
                    <b className="nav-count">{requestCount}</b>
                  )}
                  {page === "Requests" && notificationCount > 0 && (
                    <i className="nav-notification-dot" title="New messages or scheduled sessions" />
                  )}
                </button>
              ))}
            </nav>
          )}

          <div className="top-profile">
            <div className="avatar avatar-large">{currentUser.avatar}</div>
            <span>{currentUser.name}</span>
          </div>
          <div className="top-actions">
            {publicMode ? (
              <button className="login-button" onClick={onLogin}>Login</button>
            ) : (
              <button className="logout-button" onClick={onLogout} title="Log out">
                <LogOut size={16} />
              </button>
            )}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
