import React, { useState, useEffect, useRef } from "react";
import { Check, Search, Lock, AlertTriangle, Info, X, Sparkle } from "./icons";

const haptic = (ms = 10) => { try { navigator.vibrate?.(ms); } catch {} };

/* ---------- Question wrapper ---------- */
export function Question({ num, title, required, why, microcopy, locked, prefilled, children, banner }) {
  const [showWhy, setShowWhy] = useState(false);
  return (
    <div className="pwa-q" data-q-num={num}>
      <div className="pwa-q-head">
        {num && <div className="pwa-q-num">{num}</div>}
        <div className="pwa-q-title">
          {required ? (
            <>
              {title}
              <span className="req-no-wrap"><span className="req" aria-label="required">&nbsp;*</span></span>
            </>
          ) : title}
          {locked && (
            <span className="lock" title="Private, physician only">
              <Lock /> Private
            </span>
          )}
        </div>
        {why && (
          <button
            type="button"
            className={`pwa-q-why ${showWhy ? "active" : ""}`}
            aria-expanded={showWhy}
            aria-label="Why we ask"
            onClick={() => setShowWhy((v) => !v)}
          >?</button>
        )}
      </div>
      {showWhy && why && (
        <div className="pwa-q-why-body">
          <strong style={{ display: "block", fontWeight: 650, marginBottom: 4 }}>Why we ask</strong>
          {why}
        </div>
      )}
      {children}
      {microcopy && <div className="pwa-q-microcopy">{microcopy}</div>}
      {banner}
    </div>
  );
}

/* ---------- Pills (radio or multi) ---------- */
export function Pills({ options, value, onChange, multi, variant, columns }) {
  const isSelected = (v) => (multi ? Array.isArray(value) && value.includes(v) : value === v);
  const toggle = (v, opt) => {
    if (multi) {
      const cur = Array.isArray(value) ? value : [];
      if (opt?.exclusive) {
        onChange(cur.includes(v) ? [] : [v]);
        return;
      }
      const next = cur.includes(v)
        ? cur.filter((x) => x !== v)
        : [...cur.filter((x) => !options.find((o) => o.value === x)?.exclusive), v];
      onChange(next);
    } else {
      onChange(v);
    }
  };
  const style = columns ? { display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 8 } : undefined;
  return (
    <div className="pwa-pills" style={style} role={multi ? "group" : "radiogroup"}>
      {options.map((o) => {
        const sel = isSelected(o.value);
        const cls = ["pwa-pill", o.variant || variant || "", sel ? "selected" : "", o.compact ? "compact" : ""].filter(Boolean).join(" ");
        return (
          <button
            key={o.value}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={sel}
            className={cls}
            onClick={() => { haptic(); toggle(o.value, o); }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Stack of large radios ---------- */
export function Stack({ options, value, onChange }) {
  return (
    <div className="pwa-stack" role="radiogroup">
      {options.map((o) => {
        const sel = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={sel}
            className={`pwa-radio ${sel ? "selected" : ""}`}
            onClick={() => { haptic(); onChange(o.value); }}
          >
            <span className="dot" aria-hidden />
            <span className="lbl">
              {o.label}
              {o.desc && <span className="desc">{o.desc}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Multi-checkbox stack rows ---------- */
export function CheckList({ options, value, onChange, columns }) {
  const set = new Set(Array.isArray(value) ? value : []);
  const toggle = (v, opt) => {
    if (opt?.exclusive) {
      if (set.has(v)) onChange([]);
      else onChange([v]);
      return;
    }
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    options.forEach((o) => { if (o.exclusive) next.delete(o.value); });
    onChange(Array.from(next));
  };
  const style = columns ? { display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 8 } : undefined;
  return (
    <div className="pwa-stack" style={style} role="group">
      {options.map((o) => {
        const sel = set.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role="checkbox"
            aria-checked={sel}
            className={`pwa-check ${sel ? "selected" : ""}`}
            onClick={() => { haptic(); toggle(o.value, o); }}
          >
            <span className="box" aria-hidden><Check /></span>
            <span className="lbl">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Med category section ---------- */
export function MedGroup({ title, options, value, onChange }) {
  return (
    <div className="pwa-med-group">
      <div className="pwa-med-group-title"><span>{title}</span><span className="bar" /></div>
      <div className="pwa-med-grid">
        {options.map((o) => {
          const sel = (value || []).includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              role="checkbox"
              aria-checked={sel}
              className={`pwa-check ${sel ? "selected" : ""}`}
              onClick={() => {
                haptic();
                const cur = value || [];
                onChange(cur.includes(o.value) ? cur.filter((x) => x !== o.value) : [...cur, o.value]);
              }}
            >
              <span className="box" aria-hidden><Check /></span>
              <span className="lbl">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Day-of-cycle grid 1..28 ---------- */
export function DayGrid({ value, onChange, max = 28 }) {
  return (
    <div className="pwa-day-grid">
      {Array.from({ length: max }, (_, i) => i + 1).map((d) => (
        <button
          key={d}
          type="button"
          className={`pwa-day-cell ${value === d ? "selected" : ""}`}
          onClick={() => { haptic(); onChange(d); }}
        >{d}</button>
      ))}
    </div>
  );
}

/* ---------- Date picker (mobile-friendly: 3 selects) ---------- */
export function DateField({ value, onChange, max }) {
  const parts = (value || "").split("-");
  const [yy, mm, dd] = [parts[0] || "", parts[1] || "", parts[2] || ""];
  const maxDate = max ? new Date(max) : new Date();
  const maxY = maxDate.getFullYear();
  const today = new Date();
  const yearList = Array.from({ length: 8 }, (_, i) => maxY - i);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const daysInMonth = (y, m) => {
    if (!y || !m) return 31;
    return new Date(Number(y), Number(m), 0).getDate();
  };
  const dayList = Array.from({ length: daysInMonth(yy, mm) }, (_, i) => i + 1);
  const emit = (nd, nm, ny) => {
    if (!nd || !nm || !ny) { onChange(""); return; }
    const iso = `${ny}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
    if (max && iso > max) return;
    onChange(iso);
  };
  return (
    <div className="pwa-date">
      <label className="pwa-date-cell">
        <span className="lbl">Day</span>
        <select value={dd} onChange={(e) => emit(e.target.value, mm, yy)}>
          <option value="">--</option>
          {dayList.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </label>
      <label className="pwa-date-cell">
        <span className="lbl">Month</span>
        <select value={mm} onChange={(e) => emit(dd, e.target.value, yy)}>
          <option value="">--</option>
          {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      </label>
      <label className="pwa-date-cell">
        <span className="lbl">Year</span>
        <select value={yy} onChange={(e) => emit(dd, mm, e.target.value)}>
          <option value="">--</option>
          {yearList.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
    </div>
  );
}

/* ---------- Searchable pills (visit reasons) ---------- */
export function SearchablePills({ options, value, onChange, placeholder = "Search…", visibleCount = 8 }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
  const shown = expanded || query ? filtered : filtered.slice(0, visibleCount);
  const hidden = filtered.length - shown.length;
  const set = new Set(value || []);
  const toggle = (v) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(Array.from(next));
  };
  return (
    <div>
      {options.length > 6 && (
        <div className="pwa-search">
          <Search className="ico" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear"><X style={{ width: 16, height: 16, color: "var(--ink-400)" }} /></button>}
        </div>
      )}
      <div className="pwa-pills">
        {shown.map((o) => {
          const sel = set.has(o.value);
          return (
            <button
              key={o.value}
              type="button"
              className={`pwa-pill ${sel ? "selected" : ""}`}
              onClick={() => { haptic(); toggle(o.value); }}
            >
              {o.label}
            </button>
          );
        })}
        {!query && hidden > 0 && (
          <button type="button" className="pwa-pill expand" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Show less" : `+ ${hidden} more`}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Banner (warn/danger/info/success) ---------- */
export function Banner({ kind = "warn", title, children }) {
  const Ico = kind === "info" ? Info : kind === "success" ? Check : AlertTriangle;
  return (
    <div className={`pwa-banner ${kind}`} role={kind === "danger" || kind === "warn" ? "alert" : "status"}>
      <Ico className="ico" />
      <div>
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

/* ---------- Reveal panel (smooth) ---------- */
export function Reveal({ children, when }) {
  if (!when) return null;
  return <div className="pwa-reveal">{children}</div>;
}

/* ---------- Auto-scroll-to-next-question hook ---------- */
export function useScrollIntoView(deps, ref) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, deps);
}
