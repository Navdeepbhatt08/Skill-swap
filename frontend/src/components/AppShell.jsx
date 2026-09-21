import {
  Bell,
  BookOpen,
  ChevronRight,
  Compass,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

const workspaceItems = [
  ["Overview", LayoutDashboard],
  ["Discover skills", Compass],
  ["My connections", Users],
  ["Requests", BookOpen],
  ["My profile", UserRound],
];

export default function AppShell({
  activePage,
  requestCount,
  currentUser,
  onNavigate,
  onNotify,
  onLogout,
  onLogin,
  publicMode = false,
  children,
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Sparkles size={16} />
          </span>
          <span>
            skill<span className="brand-accent">swap</span>
          </span>
        </div>
        <div className="profile-mini">
          <div className="avatar avatar-large">{currentUser.avatar}</div>
          <div>
            <strong>{currentUser.name}</strong>
            <span>{currentUser.department}</span>
          </div>
          <ChevronRight size={15} />
        </div>
        <p className="nav-label">Workspace</p>
        <nav>
          {workspaceItems.map(([label, Icon]) => (
            <button
              key={label}
              className={activePage === label ? "nav-item active" : "nav-item"}
              onClick={() => onNavigate(label)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Requests" && requestCount > 0 && (
                <b className="nav-count">{requestCount}</b>
              )}
            </button>
          ))}
        </nav>
        <p className="nav-label nav-label-bottom">Manage</p>
        <nav>
          <button
            className={
              activePage === "Admin panel" ? "nav-item active" : "nav-item"
            }
            onClick={() => onNavigate("Admin panel")}
          >
            <ShieldCheck size={18} />
            <span>Admin panel</span>
          </button>
          <button
            className="nav-item"
            onClick={() => onNotify("Settings are coming soon.")}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="progress-head">
            <span>Profile strength</span>
            <strong>72%</strong>
          </div>
          <div className="progress">
            <i />
          </div>
          <small>Add your availability to reach 100%</small>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => onNotify("Use the sidebar to navigate.")}
          >
            <Menu size={20} />
          </button>
          <div className="crumb">
            Workspace <ChevronRight size={14} /> <strong>{activePage}</strong>
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              onClick={() => onNotify("You are all caught up.")}
            >
              <Bell size={18} />
              <i className="notification-dot" />
            </button>
            {publicMode ? (
              <button className="login-button" onClick={onLogin}>Login</button>
            ) : (
              <button className="logout-button" onClick={onLogout} title="Log out">
                <LogOut size={16} />
              </button>
            )}
            <div className="avatar avatar-small">{currentUser.avatar}</div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
