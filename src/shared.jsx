// === Shared widgets and constants used across Center and Modals ===
import React, { useState, useEffect, useRef } from "react";
import { I } from "./icons";

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
