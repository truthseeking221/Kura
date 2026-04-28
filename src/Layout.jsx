// === Sidebar + Topbar + GoalBar ===
import { I } from "./icons";

const LANGUAGES = ["English", "Khmer", "Vietnamese", "Thai", "French", "Korean"];

export function Sidebar({ collapsed, onToggle, active, onNavigate, lang, onLangChange }) {
  const items = [
    { id: "reception", label: "Reception", icon: "Home" },
    { id: "queue",     label: "Queue",     icon: "Users" },
    { id: "patients",  label: "Patients",  icon: "User" },
    { id: "orders",    label: "Orders",    icon: "ClipboardList" },
    { id: "billing",   label: "Billing",   icon: "Receipt" },
    { id: "documents", label: "Documents", icon: "FolderOpen" },
    { id: "reports",   label: "Reports",   icon: "BarChart" },
    { id: "settings",  label: "Settings",  icon: "Settings" },
  ];
  return (
    <aside className={"sidebar" + (collapsed ? " collapsed" : "")}>
      <div className="brand">
        <div className="brand-mark">K</div>
        {!collapsed && (
          <div className="brand-text">Kura <span className="sub">Reception</span></div>
        )}
      </div>
      <nav className="nav">
        {items.map(it => {
          const Ico = I[it.icon];
          return (
            <div
              key={it.id}
              className={"nav-item" + (active === it.id ? " active" : "")}
              onClick={() => onNavigate(it.id)}
              title={collapsed ? it.label : ""}
            >
              <Ico size={18} />
              {!collapsed && <span>{it.label}</span>}
            </div>
          );
        })}
      </nav>

      {/* Language switcher */}
      <div className="sidebar-lang" title={collapsed ? "Language" : ""}>
        <I.Globe size={15} style={{ flexShrink: 0, color: "var(--ink-500)" }} />
        {!collapsed && (
          <select
            value={lang}
            onChange={e => onLangChange(e.target.value)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 12.5,
              fontWeight: 500,
              color: "var(--ink-700)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {LANGUAGES.map(l => <option key={l}>{l}</option>)}
          </select>
        )}
      </div>

      <button className="collapse-btn" onClick={onToggle}>
        <I.ChevronsLeft size={14} style={{ transform: collapsed ? "rotate(180deg)" : "" }} />
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
}

export function Topbar({ onNewWalkIn, notifications }) {
  return (
    <header className="topbar">
      <div className="row" style={{ gap: 12 }}>
        <h1>Kura Reception</h1>
        <button className="pill-select">
          PSC-01 <I.ChevronDown size={14} />
        </button>
        <button className="pill-select">
          Shift: Morning <I.ChevronDown size={14} />
        </button>
      </div>
      <div className="search">
        <I.Search size={15} />
        <input placeholder="Search patient, phone, VID, booking" />
        <span className="kbd">⌘ K</span>
      </div>
      <button className="icon-btn">
        <I.Bell size={16} />
        {notifications > 0 && <span className="badge">{notifications}</span>}
      </button>
      <button className="user-chip">
        <div className="avatar av-purple">LN</div>
        <div className="meta">
          <strong>Linh Nguyen</strong>
          <div>Receptionist</div>
        </div>
      </button>
      <button className="btn btn-primary" onClick={onNewWalkIn}>
        <I.Plus size={16} /> New Walk-in
      </button>
    </header>
  );
}

export function GoalBar() {
  return (
    <div className="goal-bar">
      <div className="goal-icon"><I.Target size={18} /></div>
      <div>
        <strong>Goal:</strong>
        reduce counter data entry, keep staff focused on verification, payment, exceptions, and handoff.
      </div>
      <a className="learn">Learn more <I.ChevronRight size={14} /></a>
    </div>
  );
}
