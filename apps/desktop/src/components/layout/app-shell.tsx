import { Outlet, NavLink } from "react-router-dom";
import { FileText, Settings, Shield } from "lucide-react";

function Sidebar() {
  return (
    <aside className="w-64 h-screen flex flex-col bg-bg-deep border-r border-border-default">
      <div className="p-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
          <span className="text-bg-deep font-bold text-sm">M</span>
        </div>
        <span className="font-ui font-semibold text-lg text-text-primary">Meeting AI</span>
      </div>

      <nav className="flex-1 px-3 space-y-1 mt-4">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent-muted text-accent border-l-2 border-accent"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }`
          }
        >
          <FileText size={18} />
          Meetings
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent-muted text-accent border-l-2 border-accent"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }`
          }
        >
          <Settings size={18} />
          Settings
        </NavLink>
      </nav>

      <div className="p-5 border-t border-border-default">
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <Shield size={14} />
          <span>All data stored locally</span>
        </div>
      </div>
    </aside>
  );
}

export function AppShell() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-bg-base">
        <Outlet />
      </main>
    </div>
  );
}
