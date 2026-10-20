import {
  BookOpen,
  Compass,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

const workspaceItems = [
  ["Overview", "Overview", LayoutDashboard],
  ["Skill management", "Skills", Sparkles],
  ["Discover skills", "Discover", Compass],
  ["My connections", "Matching", Users],
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
  isAdmin = false,
  publicMode = false,
  children,
}) {
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
              </button>
            ))}
          </nav>
          
          {isAdmin && (
            <button
              className={activePage === "Admin panel" ? "nav-item active admin-nav-item" : "nav-item admin-nav-item"}
              onClick={() => onNavigate("Admin panel")}
            >
              <ShieldCheck size={16} />
              <span>Admin</span>
            </button>
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
