// === Sidebar + Topbar + GoalBar ===
import { useState, useRef, useEffect, useCallback } from "react";
import { I } from "./icons";
import { useLang } from "./i18n";
import { NotificationsPanel, PillMenu, UserMenu } from "./Notifications";
import { stations, shifts } from "./data";

const LANGUAGES = ["Khmer", "English", "Vietnamese", "Thai", "French", "Korean"];

export function Sidebar({ collapsed, onToggle, active, onNavigate, lang, onLangChange, roaming, onToggleRoaming }) {
  const t = useLang();
  const items = [
    { id: "reception", key: "nav.reception", icon: "Home" },
    { id: "queue",     key: "nav.queue",     icon: "Users" },
    { id: "patients",  key: "nav.patients",  icon: "User" },
    { id: "orders",    key: "nav.orders",    icon: "ClipboardList" },
    { id: "billing",   key: "nav.billing",   icon: "Receipt" },
    { id: "documents", key: "nav.documents", icon: "FolderOpen" },
    { id: "reports",   key: "nav.reports",   icon: "BarChart" },
    { id: "settings",  key: "nav.settings",  icon: "Settings" },
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
              title={collapsed ? t(it.key) : ""}
            >
              <Ico size={18} />
              {!collapsed && <span>{t(it.key)}</span>}
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
        {!collapsed && <span>{t("sidebar.collapse")}</span>}
      </button>
    </aside>
  );
}

function SearchBar({ patients = [], onSearch }) {
  const t = useLang();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);

  const results = query.trim().length < 1 ? [] : (() => {
    const q = query.toLowerCase();
    return patients.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.queueNumber.toLowerCase().includes(q) ||
      (p.mobile || "").toLowerCase().includes(q) ||
      (p.idNumber || "").includes(q) ||
      (p.visitReason || []).some(r => r.toLowerCase().includes(q))
    );
  })();

  const commit = useCallback((p) => {
    onSearch && onSearch(p.id);
    setQuery("");
    setOpen(false);
    setCursor(-1);
    inputRef.current?.blur();
  }, [onSearch]);

  // ⌘K / Ctrl+K global focus
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setCursor(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleKey = (e) => {
    if (!open || results.length === 0) {
      if (e.key === "Escape") { setQuery(""); setOpen(false); }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      if (cursor >= 0 && results[cursor]) commit(results[cursor]);
      else if (results.length === 1) commit(results[0]);
    } else if (e.key === "Escape") {
      setQuery(""); setOpen(false); setCursor(-1);
    }
  };

  const TONE_COLORS = {
    success: "var(--success-500)",
    warn: "var(--warn-500)",
    danger: "var(--danger-500)",
    info: "var(--info-500)",
  };

  return (
    <div className="search-wrap" ref={wrapRef} style={{ flex: 1, maxWidth: 460, marginLeft: "auto", position: "relative" }}>
      <div className={"search" + (open && results.length > 0 ? " search-active" : "")}>
        <I.Search size={15} style={{ color: "var(--ink-400)", flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          placeholder={t("topbar.search")}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
        />
        {query ? (
          <button
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--ink-400)", display: "flex" }}
            onMouseDown={e => { e.preventDefault(); setQuery(""); setOpen(false); }}
          >
            <I.X size={13} />
          </button>
        ) : (
          <span className="kbd">⌘ K</span>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="search-dropdown">
          <div className="search-dropdown-label">Patients</div>
          {results.map((p, i) => (
            <div
              key={p.id}
              className={"search-result" + (i === cursor ? " hovered" : "")}
              onMouseDown={e => { e.preventDefault(); commit(p); }}
              onMouseEnter={() => setCursor(i)}
            >
              <div className={"avatar av-sm " + p.avatarColor}>{p.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-500)" }}>{p.queueNumber} · {p.mobile}</div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 5,
                background: `color-mix(in srgb, ${TONE_COLORS[p.status.tone]} 12%, transparent)`,
                color: TONE_COLORS[p.status.tone],
                whiteSpace: "nowrap",
              }}>
                {p.status.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {open && query.trim().length >= 1 && results.length === 0 && (
        <div className="search-dropdown">
          <div style={{ padding: "16px 14px", color: "var(--ink-400)", fontSize: 13, textAlign: "center" }}>
            No patients found for "<strong style={{ color: "var(--ink-600)" }}>{query}</strong>"
          </div>
        </div>
      )}
    </div>
  );
}

export function Topbar({
  onNewWalkIn,
  notifications,
  station,
  onStationChange,
  shift,
  onShiftChange,
  notifs,
  onMarkAllRead,
  onNotifAction,
  onNotifClick,
  onUserAction,
  onSearch,
  patients,
  roaming,
  onToggleRoaming,
}) {
  const t = useLang();
  const [stationOpen, setStationOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const closeAll = (except) => {
    if (except !== "station")  setStationOpen(false);
    if (except !== "shift")    setShiftOpen(false);
    if (except !== "notif")    setNotifOpen(false);
    if (except !== "user")     setUserOpen(false);
  };

  const stationItem = stations.find(s => s.id === station) || stations[0];
  const shiftItem = shifts.find(s => s.id === shift) || shifts[0];

  return (
    <header className="topbar">
      <div className="row" style={{ gap: 12 }}>
        <h1>{t("topbar.title")}</h1>

        <div className="dropdown-anchor">
          <button
            className="pill-select"
            onClick={(e) => { e.stopPropagation(); closeAll("station"); setStationOpen(o => !o); }}
          >
            {stationItem.id} <I.ChevronDown size={14} />
          </button>
          <PillMenu
            open={stationOpen}
            onClose={() => setStationOpen(false)}
            items={stations}
            value={station}
            onSelect={onStationChange}
            titleKey="station.title"
          />
        </div>

        <div className="dropdown-anchor">
          <button
            className="pill-select"
            onClick={(e) => { e.stopPropagation(); closeAll("shift"); setShiftOpen(o => !o); }}
          >
            {t("topbar.shift")}: {t(shiftItem.labelKey)} <I.ChevronDown size={14} />
          </button>
          <PillMenu
            open={shiftOpen}
            onClose={() => setShiftOpen(false)}
            items={shifts}
            value={shift}
            onSelect={onShiftChange}
            titleKey="shift.title"
          />
        </div>
      </div>

      <SearchBar patients={patients} onSearch={onSearch} />

      <div className="dropdown-anchor">
        <button
          className="icon-btn"
          onClick={(e) => { e.stopPropagation(); closeAll("notif"); setNotifOpen(o => !o); }}
        >
          <I.Bell size={16} />
          {notifications > 0 && <span className="badge">{notifications}</span>}
        </button>
        <NotificationsPanel
          open={notifOpen}
          onClose={() => setNotifOpen(false)}
          items={notifs}
          onMarkAllRead={onMarkAllRead}
          onItemAction={(n) => { onNotifAction(n); setNotifOpen(false); }}
          onItemClick={(n) => { onNotifClick(n); setNotifOpen(false); }}
        />
      </div>

      <div className="dropdown-anchor">
        <button
          className="user-chip"
          onClick={(e) => { e.stopPropagation(); closeAll("user"); setUserOpen(o => !o); }}
        >
          <div className="avatar av-purple">LN</div>
          <div className="meta">
            <strong>Linh Nguyen</strong>
            <div>Receptionist</div>
          </div>
        </button>
        <UserMenu
          open={userOpen}
          onClose={() => setUserOpen(false)}
          onAction={onUserAction}
          name="Linh Nguyen"
          role="Receptionist"
        />
      </div>

      <button
        className={"icon-btn roaming-btn" + (roaming ? " active" : "")}
        onClick={onToggleRoaming}
        title={roaming ? t("mobile.exit") : t("mobile.enter")}
      >
        <I.Tablet size={16} />
        {roaming && <span className="roaming-dot" />}
      </button>

      <button className="btn btn-primary" onClick={onNewWalkIn}>
        <I.Plus size={16} /> {t("topbar.newWalkin")}
      </button>
    </header>
  );
}

export function GoalBar({ onLearnMore }) {
  const t = useLang();
  return (
    <div className="goal-bar">
      <div className="goal-icon"><I.Target size={18} /></div>
      <div>
        <strong>{t("goal.label")}</strong> {t("goal.text")}
      </div>
      <button
        className="learn"
        onClick={onLearnMore}
        style={{ background: "transparent", border: "none", cursor: "pointer", font: "inherit", padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        {t("goal.learnMore")} <I.ChevronRight size={14} />
      </button>
    </div>
  );
}
