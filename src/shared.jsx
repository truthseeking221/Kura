// === Shared widgets and constants used across Center and Modals ===
import React, { useState, useEffect, useRef } from "react";
import { I } from "./icons";
import { useLang } from "./i18n";

// === Fuzzy name match (Dice's coefficient on bigrams) ===
// Returns a similarity score 0..1.
export function fuzzyNameScore(a, b) {
  if (!a || !b) return 0;
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zក-៿\s]/g, "").trim().replace(/\s+/g, " ");
  const A = norm(a), B = norm(b);
  if (A === B) return 1;
  if (!A || !B) return 0;
  // exact token overlap (e.g. last name match)
  const tokensA = new Set(A.split(" "));
  const tokensB = new Set(B.split(" "));
  let tokenHits = 0;
  tokensA.forEach(t => { if (tokensB.has(t) && t.length > 1) tokenHits++; });
  const tokenScore = tokenHits / Math.max(tokensA.size, tokensB.size);
  // bigram dice
  const bigrams = (s) => {
    const out = new Map();
    const compact = s.replace(/\s+/g, "");
    for (let i = 0; i < compact.length - 1; i++) {
      const bg = compact.slice(i, i + 2);
      out.set(bg, (out.get(bg) || 0) + 1);
    }
    return out;
  };
  const ba = bigrams(A), bb = bigrams(B);
  let inter = 0, ta = 0, tb = 0;
  ba.forEach(v => ta += v);
  bb.forEach(v => tb += v);
  ba.forEach((v, k) => { if (bb.has(k)) inter += Math.min(v, bb.get(k)); });
  const dice = (ta + tb) === 0 ? 0 : (2 * inter) / (ta + tb);
  return Math.max(dice, tokenScore);
}

// === Mock insurer API ===
// Returns coverage decisions per cart-item id. Stable & deterministic.
const POLICY_RULES = {
  // out-of-policy tests (cosmetic / non-essential)
  outOfPolicy: new Set(["vit-d", "vit-b12", "us-thyroid", "tele-mh"]),
  // partial coverage labs (50%)
  partial: new Set(["mri-knee", "ct-head"]),
  // standard outpatient (80%)
  // everything else default 80% if covered
};
const POLICY_REASONS = {
  "vit-d":      "Vitamin D testing is wellness-tier — not covered under outpatient plan.",
  "vit-b12":    "Supplement testing falls outside diagnostic coverage.",
  "us-thyroid": "Imaging without referring symptoms is excluded.",
  "tele-mh":    "Mental health teleconsultation requires separate rider.",
  "mri-knee":   "MRI capped at 50% — pre-auth required for full coverage.",
  "ct-head":    "Advanced imaging — 50% co-insurance per policy schedule.",
};
export function mockInsurerDecide(items) {
  return items.map(i => {
    if (POLICY_RULES.outOfPolicy.has(i.id)) {
      return { id: i.id, status: "outOfPolicy", coveredPct: 0, reason: POLICY_REASONS[i.id] };
    }
    if (POLICY_RULES.partial.has(i.id)) {
      return { id: i.id, status: "partial", coveredPct: 50, reason: POLICY_REASONS[i.id] };
    }
    return { id: i.id, status: "covered", coveredPct: 80, reason: null };
  });
}

// === Cash drawer ding (Web Audio) ===
let _audioCtx = null;
export function playDrawerDing() {
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    if (!_audioCtx) _audioCtx = new Ctor();
    const ctx = _audioCtx;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    // Two-tone bell: 1318 Hz (E6) → 1568 Hz (G6)
    const tones = [{ f: 1318, t: 0 }, { f: 1568, t: 0.08 }];
    tones.forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, now + t);
      gain.gain.linearRampToValueAtTime(0.18, now + t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.42);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.45);
    });
    return true;
  } catch (e) {
    return false;
  }
}

// === Author attribution badge ===
export function AuthorBadge({ who, time, t }) {
  if (!who) return null;
  const isPatient = who === "patient";
  const isSystem = who === "system";
  const Ico = isPatient ? I.Smartphone : isSystem ? I.Sparkles : I.User;
  const fg = isPatient ? "#7a45ec" : isSystem ? "var(--ink-500)" : "var(--brand-600)";
  const bg = isPatient ? "#f0eafd" : isSystem ? "var(--ink-50)" : "var(--brand-50)";
  const label = isPatient
    ? (t ? t("author.patient") : "Patient")
    : isSystem
      ? (t ? t("author.system") : "System")
      : (t ? t("author.nurse") : "Nurse");
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 10, fontWeight: 600, color: fg, background: bg,
      padding: "1px 5px 1px 4px", borderRadius: 3, whiteSpace: "nowrap",
      border: "1px solid " + bg,
    }} title={time ? (t ? t("author.signed", { who: label, time }) : `${label} · ${time}`) : (t ? t("author.enteredBy", { who: label }) : `Entered by ${label}`)}>
      <Ico size={9} /> {label}
    </span>
  );
}

// === Visit-reason pills (replaces dropdown for fast tap-selection) ===
// options: { value, label, popular? }[]
export function VisitReasonPills({ value, onChange, options, placeholder, invalid }) {
  const sel = Array.isArray(value) ? value : (value ? [value] : []);
  const [showAll, setShowAll] = useState(false);
  const popular = options.filter(o => o.popular);
  const visible = showAll || popular.length === 0 ? options : popular;
  const hidden = options.length - visible.length;
  const toggle = (v) => {
    onChange(sel.includes(v) ? sel.filter(x => x !== v) : [...sel, v]);
  };
  return (
    <div className={"reason-pills" + (invalid ? " invalid" : "")}>
      <div className="reason-pills-grid">
        {visible.map(o => {
          const active = sel.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              className={"reason-pill" + (active ? " active" : "")}
              onClick={() => toggle(o.value)}
            >
              {active && <I.Check size={11} strokeWidth={3} style={{ flexShrink: 0 }} />}
              <span>{o.label}</span>
            </button>
          );
        })}
        {hidden > 0 && !showAll && (
          <button
            type="button"
            className="reason-pill reason-pill-more"
            onClick={() => setShowAll(true)}
          >
            <I.Plus size={11} /> +{hidden}
          </button>
        )}
        {showAll && popular.length > 0 && (
          <button
            type="button"
            className="reason-pill reason-pill-more"
            onClick={() => setShowAll(false)}
          >
            <I.ChevronUp size={11} /> Less
          </button>
        )}
      </div>
      {sel.length === 0 && placeholder && (
        <div className="reason-pills-hint">{placeholder}</div>
      )}
    </div>
  );
}

export const COUNTRIES = [
  { code: "+855", name: "Cambodia",   flag: "🇰🇭" },
  { code: "+84",  name: "Vietnam",    flag: "🇻🇳" },
  { code: "+66",  name: "Thailand",   flag: "🇹🇭" },
  { code: "+856", name: "Laos",       flag: "🇱🇦" },
  { code: "+95",  name: "Myanmar",    flag: "🇲🇲" },
  { code: "+65",  name: "Singapore",  flag: "🇸🇬" },
  { code: "+60",  name: "Malaysia",   flag: "🇲🇾" },
  { code: "+1",   name: "USA",        flag: "🇺🇸" },
  { code: "+33",  name: "France",     flag: "🇫🇷" },
  { code: "+82",  name: "Korea",      flag: "🇰🇷" },
];

export const VISIT_REASONS = [
  "General check-up", "Annual physical", "Follow-up", "X-ray follow-up",
  "Vaccination", "Lab work only", "Phlebotomy", "Pre-employment screening",
  "Diabetes monitoring", "Blood pressure check", "Allergy consult",
  "Skin check", "Pregnancy test", "Travel certificate",
];

export const QRGlyph = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="6" height="6" rx="1"/>
    <rect x="15" y="3" width="6" height="6" rx="1"/>
    <rect x="3" y="15" width="6" height="6" rx="1"/>
    <path d="M15 15h2v2"/><path d="M21 15v6h-6"/><path d="M19 19h.01"/>
  </svg>
);

// === QR Scan widget ===
export function QRScanCard({ label, sub, scanned, scanData, onScan, onClear, accent, icon }) {
  const [scanning, setScanning] = useState(false);
  const Ico = icon;
  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      onScan();
    }, 1100);
  };
  return (
    <div style={{
      flex: 1,
      border: "1.5px solid " + (scanned ? "var(--success-500)" : "var(--border-strong)"),
      borderRadius: 10,
      padding: 14,
      background: scanned ? "var(--success-50)" : "var(--surface-2)",
      transition: "all 0.2s",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div className="row" style={{ gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: scanned ? "var(--success-500)" : accent.bg,
          color: scanned ? "white" : accent.fg,
          display: "grid", placeItems: "center", flexShrink: 0,
        }}>
          {scanned ? <I.Check size={16} strokeWidth={2.5} /> : <Ico size={16} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink-900)" }}>{label}</div>
          <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 1 }}>{sub}</div>
        </div>
      </div>
      {scanned ? (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 7, padding: "8px 10px",
          fontSize: 11.5, color: "var(--ink-700)",
          fontFamily: "'SF Mono', ui-monospace, monospace",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{scanData}</span>
          <button onClick={onClear} style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--ink-500)", padding: 2, display: "grid", placeItems: "center",
          }} title="Re-scan">
            <I.RefreshCw size={12} />
          </button>
        </div>
      ) : (
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleScan}
          disabled={scanning}
          style={{ width: "100%", justifyContent: "center", height: 34 }}
        >
          {scanning ? (<><span className="spinner" /> Scanning…</>)
            : (<><QRGlyph size={14} /> Scan QR</>)}
        </button>
      )}
    </div>
  );
}

// === Telegram contact: supports username (QR) OR phone fallback ===
export function TelegramScanCard({ patient, onUpdate }) {
  const [mode, setMode] = useState("username"); // "username" | "phone"
  const [scanning, setScanning] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const tgAccent = { bg: "#e7f0fa", fg: "#2087d6" };

  const hasUsername = !!patient.telegramHandle && patient.telegramHandle.startsWith("t.me/");
  const hasPhone = !!patient.telegramHandle && patient.telegramHandle.startsWith("+");
  const captured = hasUsername || hasPhone;

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      onUpdate({
        ...patient,
        telegramHandle: "t.me/" + (patient.name || "patient").toLowerCase().replace(/\s+/g, ""),
      });
    }, 1100);
  };

  const handleSavePhone = () => {
    if (!phoneInput.trim()) return;
    onUpdate({ ...patient, telegramHandle: "+" + phoneInput.replace(/[^\d]/g, "") });
  };

  const onClear = () => {
    onUpdate({ ...patient, telegramHandle: "" });
    setPhoneInput("");
  };

  return (
    <div style={{
      flex: 1,
      border: "1.5px solid " + (captured ? "var(--success-500)" : "var(--border-strong)"),
      borderRadius: 10,
      padding: 14,
      background: captured ? "var(--success-50)" : "var(--surface-2)",
      transition: "all 0.2s",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div className="row" style={{ gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: captured ? "var(--success-500)" : tgAccent.bg,
          color: captured ? "white" : tgAccent.fg,
          display: "grid", placeItems: "center", flexShrink: 0,
        }}>
          {captured ? <I.Check size={16} strokeWidth={2.5} /> : <I.MessageSquare size={16} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink-900)" }}>Telegram contact</div>
          <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 1 }}>
            {captured
              ? (hasUsername ? "Username captured" : "Phone captured")
              : (mode === "username" ? "Patient shows their Telegram QR" : "Use phone if no username")}
          </div>
        </div>
      </div>

      {captured ? (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 7, padding: "8px 10px",
          fontSize: 11.5, color: "var(--ink-700)",
          fontFamily: "'SF Mono', ui-monospace, monospace",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {patient.telegramHandle}
          </span>
          <button onClick={onClear} style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--ink-500)", padding: 2, display: "grid", placeItems: "center",
          }} title="Clear">
            <I.RefreshCw size={12} />
          </button>
        </div>
      ) : (
        <>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0,
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 6, padding: 2,
          }}>
            <button
              type="button"
              onClick={() => setMode("username")}
              style={{
                background: mode === "username" ? tgAccent.bg : "transparent",
                color: mode === "username" ? tgAccent.fg : "var(--ink-600)",
                border: "none", borderRadius: 4, padding: "5px 6px",
                fontSize: 11, fontWeight: 600, cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
              }}
            >
              <I.MessageSquare size={11} /> Username
            </button>
            <button
              type="button"
              onClick={() => setMode("phone")}
              style={{
                background: mode === "phone" ? tgAccent.bg : "transparent",
                color: mode === "phone" ? tgAccent.fg : "var(--ink-600)",
                border: "none", borderRadius: 4, padding: "5px 6px",
                fontSize: 11, fontWeight: 600, cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
              }}
            >
              <I.Phone size={11} /> Phone
            </button>
          </div>

          {mode === "username" ? (
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleScan}
              disabled={scanning}
              style={{ width: "100%", justifyContent: "center", height: 34 }}
            >
              {scanning ? (<><span className="spinner" /> Scanning…</>)
                : (<><QRGlyph size={14} /> Scan QR</>)}
            </button>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <input
                className="input"
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value.replace(/[^\d\s+]/g, ""))}
                placeholder="+855 12 345 678"
                style={{ flex: 1, height: 34, fontSize: 12 }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSavePhone(); }}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSavePhone}
                disabled={!phoneInput.trim()}
                style={{ height: 34, padding: "0 10px" }}
              >
                Save
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// === Multi-select with search (visit reasons) ===
// options: string[] OR { value: string, label: string }[]
export function MultiSelectSearch({ value, onChange, options, placeholder, invalid }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  const sel = Array.isArray(value) ? value : (value ? [value] : []);

  // Normalise options to { value, label } internally
  const normalised = options.map(o => typeof o === "string" ? { value: o, label: o } : o);
  // Build label lookup for chips
  const labelOf = (v) => normalised.find(o => o.value === v)?.label ?? v;

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const toggle = (val) => {
    onChange(sel.includes(val) ? sel.filter(x => x !== val) : [...sel, val]);
  };
  const remove = (val, e) => { e.stopPropagation(); onChange(sel.filter(x => x !== val)); };
  const filtered = normalised.filter(o => o.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        className={"input" + (invalid ? " invalid" : "")}
        onClick={() => setOpen(o => !o)}
        style={{
          minHeight: "var(--field-h)", height: "auto",
          paddingTop: 4, paddingBottom: 4, paddingRight: 32,
          display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center",
          cursor: "pointer", position: "relative",
        }}
      >
        {sel.length === 0 && <span style={{ color: "var(--ink-400)", fontSize: 13 }}>{placeholder}</span>}
        {sel.map(s => (
          <span key={s} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            height: 22, padding: "0 4px 0 8px", borderRadius: 4,
            background: "var(--brand-50)", color: "var(--brand-700)",
            border: "1px solid var(--brand-100)",
            fontSize: 11.5, fontWeight: 550,
          }}>
            {labelOf(s)}
            <button onClick={(e) => remove(s, e)} style={{
              background: "transparent", border: "none", padding: 0, cursor: "pointer",
              width: 14, height: 14, display: "grid", placeItems: "center",
              color: "var(--brand-500)", borderRadius: 2,
            }}>
              <I.X size={10} />
            </button>
          </span>
        ))}
        <I.ChevronDown size={14} style={{
          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
          color: "var(--ink-400)", pointerEvents: "none",
          rotate: open ? "180deg" : "0deg", transition: "rotate 0.15s",
        }} />
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 8, boxShadow: "var(--shadow-md)",
          zIndex: 20, padding: 4,
          maxHeight: 280, display: "flex", flexDirection: "column",
        }}>
          <div className="search" style={{ height: 32, margin: 4 }}>
            <I.Search size={13} />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search…"
            />
          </div>
          <div style={{ overflowY: "auto", maxHeight: 220 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 14, textAlign: "center", fontSize: 12, color: "var(--ink-500)" }}>
                No matches
              </div>
            ) : filtered.map(opt => {
              const checked = sel.includes(opt.value);
              return (
                <div key={opt.value} onClick={() => toggle(opt.value)} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 10px", borderRadius: 6, cursor: "pointer",
                  background: checked ? "var(--brand-50)" : "transparent",
                  fontSize: 12.5, color: "var(--ink-800)", fontWeight: 500,
                }}
                onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "var(--ink-50)"; }}
                onMouseLeave={e => { if (!checked) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: 4,
                    border: "1.5px solid " + (checked ? "var(--brand-500)" : "var(--ink-300)"),
                    background: checked ? "var(--brand-500)" : "white",
                    display: "grid", placeItems: "center", color: "white", flexShrink: 0,
                  }}>
                    {checked && <I.Check size={10} strokeWidth={3} />}
                  </div>
                  {opt.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAT TIMELINE — Check-in → Sample → First → Final
// Logic:
//   - Internal-only orders → estimate from longest internal TAT
//   - Outsourced present  → final waits for longest outsourced TAT
//                           first results may arrive earlier from internals
//   - Outsourced lines flagged subtly with "Outsourced" / "External lab"
// ============================================================
export const TAT_DEFAULTS = {
  // Internal lab/imaging hours
  cbc: 1, glucose: 1, lipid: 2, urinalysis: 1, preg: 1, esr: 1,
  electro: 2, "xray-chest": 1, "xray-lumbar": 1, "xray-knee": 1,
  "us-abd": 2, "ecg-12": 1, "vit-bp": 0,
  // Outsourced (sent to external lab)
  hba1c: 24, lft: 24, kft: 24, ferritin: 36, ptinr: 8,
  covid: 8, stool: 36, "vit-d": 48, "vit-b12": 48, ana: 72,
  "ct-head": 6, "mri-knee": 24, "us-thyroid": 4, "us-preg": 2,
  tsh: 24,
};
export const TAT_OUTSOURCED = new Set([
  "hba1c", "lft", "kft", "ferritin", "ptinr", "covid", "stool",
  "vit-d", "vit-b12", "ana", "mri-knee", "ct-head", "tsh",
]);

function fmtTatHours(h) {
  if (h == null) return "—";
  if (h < 1) return "< 1h";
  if (h < 24) return Math.round(h) + "h";
  const d = h / 24;
  return (Math.round(d * 10) / 10).toString().replace(/\.0$/, "") + "d";
}

export function computeTatPlan(items) {
  // items: cart items (kind: lab/imaging/etc)
  const labLike = items.filter(i => i.kind === "lab" || i.kind === "imaging");
  if (labLike.length === 0) return null;
  const enriched = labLike.map(i => ({
    id: i.id, name: i.name, kind: i.kind,
    hours: TAT_DEFAULTS[i.id] ?? 2,
    outsourced: TAT_OUTSOURCED.has(i.id),
  }));
  const internal = enriched.filter(e => !e.outsourced);
  const outsourced = enriched.filter(e => e.outsourced);
  const internalMax = internal.reduce((m, e) => Math.max(m, e.hours), 0);
  const outsourcedMax = outsourced.reduce((m, e) => Math.max(m, e.hours), 0);
  const firstResultHours = internal.length > 0 ? internalMax : outsourcedMax;
  const finalResultHours = Math.max(internalMax, outsourcedMax);
  const splitFirstAndFinal = internal.length > 0 && outsourced.length > 0;
  return {
    items: enriched,
    internal, outsourced,
    firstResultHours,
    finalResultHours,
    splitFirstAndFinal,
  };
}

// status: not_started | current | completed | delayed | estimated
function TatStep({ icon, label, status, hint, badge }) {
  const tone = {
    completed: { dot: "var(--success-500)", ring: "var(--success-500)", text: "var(--ink-900)" },
    current:   { dot: "var(--brand-500)",   ring: "var(--brand-500)",   text: "var(--ink-900)" },
    delayed:   { dot: "var(--danger-500)",  ring: "var(--danger-500)",  text: "var(--danger-600)" },
    estimated: { dot: "var(--ink-300)",     ring: "var(--ink-300)",     text: "var(--ink-600)" },
    not_started: { dot: "var(--ink-200)",   ring: "var(--ink-200)",     text: "var(--ink-400)" },
  }[status] || { dot: "var(--ink-200)", ring: "var(--ink-200)", text: "var(--ink-400)" };
  const Ico = icon;
  return (
    <div className="tat-step">
      <div className="tat-step-dot" style={{
        borderColor: tone.ring,
        background: status === "completed" ? tone.dot : "var(--surface)",
        color: status === "completed" ? "white" : tone.dot,
      }}>
        {status === "completed" ? <I.Check size={10} strokeWidth={3} /> : <Ico size={10} />}
        {status === "current" && <span className="tat-step-pulse" style={{ borderColor: tone.dot }} />}
      </div>
      <div className="tat-step-meta" style={{ color: tone.text }}>
        <div className="tat-step-label">{label}</div>
        {hint && <div className="tat-step-hint">{hint}</div>}
      </div>
      {badge && <span className="tat-step-badge">{badge}</span>}
    </div>
  );
}

export function TatTimeline({ patient }) {
  const t = useLang();
  const cart = patient.cart;
  const items = cart?.items || [];
  const plan = computeTatPlan(items);

  // Where are we right now?
  const checkedIn = !!(patient.idScanned || patient.identity?.verified);
  const sampleCollected = patient.sampleCollectedAt || patient.handoffStates?.[2] === "in-progress" || patient.handoffStates?.[2] === "done" || patient.handoffStates?.[3] === "in-progress" || patient.handoffStates?.[3] === "done";
  const firstResultsIn = (patient.labTests || []).some(lt => lt.status === "complete" || lt.status === "in-progress");
  const finalResultsIn = (patient.labTests || []).length > 0 && (patient.labTests || []).every(lt => lt.status === "complete");

  // statuses
  const stepCheckin = checkedIn ? "completed" : "current";
  const stepSample = !checkedIn ? "not_started" : sampleCollected ? "completed" : "current";
  const stepFirst = !sampleCollected ? "not_started" : firstResultsIn ? "completed" : "current";
  const stepFinal = !firstResultsIn ? "not_started" : finalResultsIn ? "completed" : (plan?.splitFirstAndFinal ? "estimated" : "current");

  const showOutsourcedNote = plan?.outsourced.length > 0;

  return (
    <div className="card tat-card">
      <div className="card-head" style={{ paddingBottom: 4 }}>
        <div>
          <h2>{t("tat.title")}</h2>
          <p className="sub">{t("tat.sub")}</p>
        </div>
        {plan && (
          <div className="tat-summary">
            {plan.splitFirstAndFinal ? (
              <>
                <span className="tat-summary-pill tat-pill-first">
                  <I.Clock size={10} /> {t("tat.firstIn", { time: fmtTatHours(plan.firstResultHours) })}
                </span>
                <span className="tat-summary-pill tat-pill-final">
                  <I.Clock size={10} /> {t("tat.finalIn", { time: fmtTatHours(plan.finalResultHours) })}
                </span>
              </>
            ) : (
              <span className="tat-summary-pill tat-pill-final">
                <I.Clock size={10} /> {t("tat.allIn", { time: fmtTatHours(plan.finalResultHours) })}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="card-pad" style={{ paddingTop: 4, paddingBottom: 12 }}>
        <div className="tat-timeline">
          <TatStep icon={I.User}          label={t("tat.checkin")}      status={stepCheckin} />
          <div className="tat-rail" />
          <TatStep icon={I.FlaskConical}  label={t("tat.sample")}       status={stepSample} />
          <div className="tat-rail" />
          <TatStep
            icon={I.Activity}
            label={t("tat.firstResult")}
            status={stepFirst}
            hint={plan && plan.internal.length > 0 ? t("tat.fromInternal") : (plan ? t("tat.fromOutsourced") : null)}
            badge={plan && plan.internal.length > 0 && stepFirst !== "completed" ? `~ ${fmtTatHours(plan.firstResultHours)}` : null}
          />
          <div className="tat-rail" />
          <TatStep
            icon={I.Check}
            label={t("tat.finalResult")}
            status={stepFinal}
            hint={plan && plan.splitFirstAndFinal ? t("tat.afterOutsourced") : null}
            badge={plan && stepFinal !== "completed" ? `~ ${fmtTatHours(plan.finalResultHours)}` : null}
          />
        </div>

        {plan && plan.splitFirstAndFinal && (
          <div className="tat-note">
            <I.Info size={11} />
            <span>{t("tat.mixedNote")}</span>
          </div>
        )}

        {showOutsourcedNote && (
          <div className="tat-outsourced-list">
            <div className="tat-outsourced-head">{t("tat.outsourcedHead")}</div>
            <div className="tat-outsourced-chips">
              {plan.outsourced.map(o => (
                <span key={o.id} className="tat-outsourced-chip">
                  <I.Globe size={9} /> {o.name}
                  <span className="tat-outsourced-time">{fmtTatHours(o.hours)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {!plan && (
          <div className="tat-empty">{t("tat.empty")}</div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TELECONSULTATION BOOKING
// Patient state shape: patient.teleconsult = { status, slot, by }
//   status: "notBooked" | "pending" | "booked" | "completed" | "cancelled"
// ============================================================
const SLOT_OPTIONS = [
  { id: "today_pm",  labelKey: "telecon.slot.todayPm",  hint: "Today · 14:00–14:30" },
  { id: "today_eve", labelKey: "telecon.slot.todayEve", hint: "Today · 17:30–18:00" },
  { id: "tom_am",    labelKey: "telecon.slot.tomAm",    hint: "Tomorrow · 09:00–09:30" },
  { id: "tom_pm",    labelKey: "telecon.slot.tomPm",    hint: "Tomorrow · 15:00–15:30" },
];

function TeleconStatusPill({ status }) {
  const t = useLang();
  const map = {
    notBooked:  { color: "var(--ink-500)", bg: "var(--surface-2)",   border: "var(--border)",        labelKey: "telecon.status.notBooked",  Ico: I.Calendar },
    pending:    { color: "var(--warn-600)", bg: "var(--warn-50)",    border: "var(--warn-500)",      labelKey: "telecon.status.pending",    Ico: I.Clock },
    booked:     { color: "var(--success-600)", bg: "var(--success-50)", border: "var(--success-500)", labelKey: "telecon.status.booked",     Ico: I.CheckCircle },
    completed:  { color: "var(--ink-700)", bg: "var(--ink-50)",      border: "var(--border)",        labelKey: "telecon.status.completed",  Ico: I.Check },
    cancelled:  { color: "var(--danger-600)", bg: "var(--danger-50)", border: "var(--danger-500)",   labelKey: "telecon.status.cancelled",  Ico: I.XCircle },
  };
  const m = map[status] || map.notBooked;
  const Ico = m.Ico;
  return (
    <span className="telecon-status-pill" style={{ color: m.color, background: m.bg, borderColor: m.border }}>
      <Ico size={10} /> {t(m.labelKey)}
    </span>
  );
}

export function TeleconsultCard({ patient, onUpdate, onPushToast }) {
  const t = useLang();
  const tc = patient.teleconsult || { status: "notBooked", slot: null, by: null };
  const [expanded, setExpanded] = React.useState(tc.status === "notBooked");
  const [pickedSlot, setPickedSlot] = React.useState(null);
  const [booking, setBooking] = React.useState(false);

  const reset = () => onUpdate({ ...patient, teleconsult: { status: "notBooked", slot: null, by: null } });
  const confirmBook = (slotId, by = "nurse") => {
    setBooking(true);
    setTimeout(() => {
      setBooking(false);
      onUpdate({
        ...patient,
        teleconsult: {
          status: "booked",
          slot: SLOT_OPTIONS.find(s => s.id === slotId) || { id: slotId, hint: slotId },
          by,
          bookedAt: new Date().toISOString(),
        },
      });
      onPushToast?.(t("telecon.toastBooked"));
      setPickedSlot(null);
      setExpanded(false);
    }, 600);
  };
  const sendToPhone = () => {
    onUpdate({
      ...patient,
      teleconsult: { status: "pending", slot: null, by: "patient", sentAt: new Date().toISOString() },
    });
    onPushToast?.(t("telecon.toastSent"));
  };
  const cancel = () => {
    onUpdate({ ...patient, teleconsult: { ...tc, status: "cancelled" } });
    onPushToast?.(t("telecon.toastCancelled"), "error");
  };

  return (
    <div className="card telecon-card">
      <div className="card-head" style={{ paddingBottom: 4 }}>
        <div>
          <h2 style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <I.Video size={15} style={{ color: "var(--brand-600)" }} />
            {t("telecon.title")}
          </h2>
          <p className="sub" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <TeleconStatusPill status={tc.status} />
            {tc.slot?.hint && <span className="telecon-slot-hint">{tc.slot.hint}</span>}
            {tc.by && tc.status === "booked" && <span style={{ color: "var(--ink-400)", fontSize: 11 }}>· {t("telecon.by." + tc.by)}</span>}
          </p>
        </div>
        {tc.status === "booked" && (
          <button className="btn btn-ghost btn-sm" onClick={cancel} style={{ color: "var(--danger-600)" }}>
            <I.X size={11} /> {t("telecon.cancel")}
          </button>
        )}
        {tc.status === "cancelled" && (
          <button className="btn btn-ghost btn-sm" onClick={reset}>
            <I.RefreshCw size={11} /> {t("telecon.reopen")}
          </button>
        )}
      </div>

      <div className="card-pad" style={{ paddingTop: 4, paddingBottom: 12 }}>
        {tc.status === "notBooked" && (
          <>
            {!expanded ? (
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setExpanded(true)}>
                  <I.Calendar size={12} /> {t("telecon.bookHere")}
                </button>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={sendToPhone}>
                  <I.Smartphone size={12} /> {t("telecon.sendToPhone")}
                </button>
              </div>
            ) : (
              <>
                <div className="telecon-slots">
                  {SLOT_OPTIONS.map(s => {
                    const active = pickedSlot === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setPickedSlot(s.id)}
                        className={"telecon-slot" + (active ? " active" : "")}
                      >
                        <div className="telecon-slot-label">{t(s.labelKey)}</div>
                        <div className="telecon-slot-time">{s.hint}</div>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setExpanded(false); setPickedSlot(null); }}>
                    {t("modal.cancel")}
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => pickedSlot && confirmBook(pickedSlot, "nurse")}
                    disabled={!pickedSlot || booking}
                  >
                    {booking ? <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> : <I.Video size={12} />}
                    {t("telecon.confirmBook")}
                  </button>
                </div>
              </>
            )}
          </>
        )}
        {tc.status === "pending" && (
          <div className="telecon-pending">
            <I.Smartphone size={14} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 650, color: "var(--ink-900)" }}>{t("telecon.pendingTitle")}</div>
              <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 1 }}>{t("telecon.pendingBody")}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => confirmBook(SLOT_OPTIONS[0].id, "patient")} title={t("telecon.simulateConfirm")}>
              <I.Sparkles size={11} /> {t("telecon.simulate")}
            </button>
          </div>
        )}
        {tc.status === "booked" && (
          <div className="telecon-booked">
            <div className="telecon-booked-ico"><I.Video size={16} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="telecon-booked-title">{t("telecon.bookedTitle")}</div>
              <div className="telecon-booked-time">{tc.slot?.hint || "—"}</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => onPushToast?.(t("telecon.joinedToast"))}>
              <I.Video size={11} /> {t("telecon.join")}
            </button>
          </div>
        )}
        {tc.status === "cancelled" && (
          <div className="telecon-cancelled">
            <I.XCircle size={13} /> {t("telecon.cancelledBody")}
          </div>
        )}
      </div>
    </div>
  );
}

// === Country code picker ===
export function CountryCodeSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const sel = COUNTRIES.find(c => c.code === value) || COUNTRIES[0];
  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(q.toLowerCase()) || c.code.includes(q)
  );
  return (
    <div ref={ref} style={{ position: "relative", flex: "0 0 auto" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          height: "var(--field-h)",
          padding: "0 10px",
          border: "1px solid var(--border-strong)",
          borderRight: "none",
          borderTopRightRadius: 0, borderBottomRightRadius: 0,
          borderTopLeftRadius: "var(--radius)", borderBottomLeftRadius: "var(--radius)",
          background: "var(--surface)",
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 550, color: "var(--ink-800)",
          cursor: "pointer",
          minWidth: 92,
        }}
      >
        <span style={{ fontSize: 16 }}>{sel.flag}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{sel.code}</span>
        <I.ChevronDown size={12} style={{ color: "var(--ink-400)", marginLeft: 2 }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0,
          width: 240,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 8, boxShadow: "var(--shadow-md)",
          zIndex: 20, padding: 4, maxHeight: 280,
          display: "flex", flexDirection: "column",
        }}>
          <div className="search" style={{ height: 32, margin: 4 }}>
            <I.Search size={13} />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search country…"
            />
          </div>
          <div style={{ overflowY: "auto", maxHeight: 220 }}>
            {filtered.map(c => (
              <div key={c.code}
                onClick={() => { onChange(c.code); setOpen(false); setQ(""); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 10px", borderRadius: 6, cursor: "pointer",
                  background: c.code === value ? "var(--brand-50)" : "transparent",
                  fontSize: 12.5,
                }}
                onMouseEnter={e => { if (c.code !== value) e.currentTarget.style.background = "var(--ink-50)"; }}
                onMouseLeave={e => { if (c.code !== value) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 16 }}>{c.flag}</span>
                <span style={{ flex: 1, color: "var(--ink-800)", fontWeight: 500 }}>{c.name}</span>
                <span style={{ color: "var(--ink-500)", fontVariantNumeric: "tabular-nums" }}>{c.code}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
