// === OrderCart — sticky right rail (v4+v5 Round 9) ===
// Single component: cart line items, promo (multi non-colliding), bill split,
// payment (KHQR + Cash), pregnancy consent gate, primary CTA "Check in & confirm order"
import React, { useState, useEffect, useMemo, useRef } from "react";
import { I } from "./icons";
import { QRGlyph, mockInsurerDecide, playDrawerDing, Kbd, useKeydown, isTypingTarget, DisabledTooltip } from "./shared";
import { useLang } from "./i18n";

const KHR_RATE = 4100;
const fmtCcy = (usd, ccy) => ccy === "KHR" ? "៛" + Math.round(usd * KHR_RATE).toLocaleString() : "$" + usd.toFixed(2);

// === Master order catalogue ===
export const ORDER_CATALOG = [
  { id: "visit-gp",     kind: "visit",   name: "GP consultation (visit fee)",  price: 15, popular: true },
  { id: "visit-spec",   kind: "visit",   name: "Specialist consultation",      price: 35 },
  { id: "cbc",          kind: "lab",     name: "Complete Blood Count (CBC)",   price: 8,  popular: true },
  { id: "glucose",      kind: "lab",     name: "Blood Glucose (Fasting)",      price: 5,  popular: true, fasting: true },
  { id: "lipid",        kind: "lab",     name: "Lipid Panel",                  price: 12, popular: true, fasting: true, alcohol: true },
  { id: "tsh",          kind: "lab",     name: "TSH (Thyroid)",                price: 14, popular: true },
  { id: "hba1c",        kind: "lab",     name: "HbA1c (Diabetes)",             price: 11, drugs: true },
  { id: "urinalysis",   kind: "lab",     name: "Urinalysis",                   price: 6,  popular: true },
  { id: "preg",         kind: "lab",     name: "Pregnancy (β-hCG)",            price: 7,  popular: true },
  { id: "lft",          kind: "lab",     name: "Liver Function (LFT)",         price: 13, alcohol: true, drugs: true },
  { id: "kft",          kind: "lab",     name: "Kidney Function (KFT)",        price: 13, drugs: true },
  { id: "electro",      kind: "lab",     name: "Electrolytes Panel",           price: 9 },
  { id: "esr",          kind: "lab",     name: "ESR (Sed Rate)",               price: 5 },
  { id: "ferritin",     kind: "lab",     name: "Ferritin",                     price: 9 },
  { id: "ptinr",        kind: "lab",     name: "PT / INR",                     price: 8 },
  { id: "covid",        kind: "lab",     name: "COVID-19 PCR",                 price: 18, vaccine: true },
  { id: "stool",        kind: "lab",     name: "Stool Culture",                price: 11 },
  { id: "vit-d",        kind: "lab",     name: "Vitamin D",                    price: 25, fasting: true },
  { id: "vit-b12",      kind: "lab",     name: "Vitamin B12",                  price: 18 },
  { id: "xray-chest",   kind: "imaging", name: "X-ray — Chest",                price: 15, popular: true },
  { id: "xray-lumbar",  kind: "imaging", name: "X-ray — Lumbar spine",         price: 18 },
  { id: "xray-knee",    kind: "imaging", name: "X-ray — Knee",                 price: 16 },
  { id: "us-abd",       kind: "imaging", name: "Ultrasound — Abdomen",         price: 35 },
  { id: "us-thyroid",   kind: "imaging", name: "Ultrasound — Thyroid",         price: 30 },
  { id: "us-preg",      kind: "imaging", name: "Ultrasound — OB / Pregnancy",  price: 40 },
  { id: "ct-head",      kind: "imaging", name: "CT scan — Head",               price: 90 },
  { id: "mri-knee",     kind: "imaging", name: "MRI — Knee",                   price: 180 },
  { id: "ecg-12",       kind: "ecg",     name: "ECG — 12 lead",                price: 22, popular: true },
  { id: "ecg-stress",   kind: "ecg",     name: "Stress test (Treadmill ECG)",  price: 65 },
  { id: "ecg-holter",   kind: "ecg",     name: "Holter monitor (24h)",         price: 75 },
  { id: "echo",         kind: "ecg",     name: "Echocardiogram",               price: 60 },
  { id: "vit-bp",       kind: "vitals",  name: "Blood pressure",               price: 0,  popular: true },
  { id: "vit-bmi",      kind: "vitals",  name: "Height / weight / BMI",        price: 0 },
  { id: "vit-spo2",     kind: "vitals",  name: "SpO₂ (oxygen saturation)",     price: 0 },
  { id: "vit-temp",     kind: "vitals",  name: "Temperature",                  price: 0 },
  { id: "vit-vision",   kind: "vitals",  name: "Vision test (Snellen)",        price: 3 },
  { id: "vit-audio",    kind: "vitals",  name: "Hearing screen",               price: 5 },
  { id: "tele-gp",      kind: "telecon", name: "Telecon — GP follow-up (15m)", price: 12 },
  { id: "tele-spec",    kind: "telecon", name: "Telecon — Specialist (30m)",   price: 30 },
  { id: "tele-mh",      kind: "telecon", name: "Telecon — Mental health (45m)",price: 35 },
];

const KIND_META = {
  visit:   { labelKey: "cart.kind.visit",   icon: "Stethoscope",  color: "#9b6cff" },
  lab:     { labelKey: "cart.kind.lab",     icon: "FlaskConical", color: "#06a07a" },
  imaging: { labelKey: "cart.kind.imaging", icon: "Scan",         color: "#d97757" },
  ecg:     { labelKey: "cart.kind.ecg",     icon: "Activity",     color: "#d83a3a" },
  vitals:  { labelKey: "cart.kind.vitals",  icon: "Heart",        color: "#2087d6" },
  telecon: { labelKey: "cart.kind.telecon", icon: "Video",        color: "#7a45ec" },
};
const KIND_ORDER = ["visit", "lab", "imaging", "ecg", "vitals", "telecon"];

const PROMO_CODES = {
  WELCOME10:  { type: "fixed",   value: 10, label: "$10 off first visit",   category: "first-visit" },
  STAFF20:    { type: "percent", value: 20, label: "20% off · staff",       category: "staff" },
  FAMILY5:    { type: "percent", value: 5,  label: "5% off · family",       category: "family" },
  FREEVISIT:  { type: "item",    value: 0,  label: "Free GP visit fee",     category: "item:visit-gp", targetItem: "visit-gp" },
  RAMADAN:    { type: "percent", value: 15, label: "15% off · seasonal",    category: "seasonal" },
};

function promoCollision(existing, code) {
  const newP = PROMO_CODES[code];
  if (!newP) return null;
  for (const [c, p] of Object.entries(existing)) {
    if (c === code) return { code: c, reason: `${code} is already applied` };
    if (p.category === newP.category) return { code: c, reason: `${code} conflicts with ${c} — same discount type` };
    if (p.type === "percent" && newP.type === "percent") return { code: c, reason: `${code} conflicts with ${c} — only one percentage discount allowed` };
  }
  return null;
}

const PAYER_LABELS = {
  direct:    { labelKey: "cart.payer.direct",    shortKey: "cart.payer.direct.short",    color: "#7a45ec" },
  insurance: { labelKey: "cart.payer.insurance", shortKey: "cart.payer.insurance.short", color: "#2087d6" },
  corporate: { labelKey: "cart.payer.corporate", shortKey: "cart.payer.corporate.short", color: "#06a07a" },
  family:    { labelKey: "cart.payer.family",    shortKey: "cart.payer.family.short",    color: "#d97757" },
  other:     { labelKey: "cart.payer.other",     shortKey: "cart.payer.other.short",     color: "#64748b" },
};

// === Pre-analytical question banks (cart-side, only for sensitive labs) ===
const PRE_ANALYTIC_QS = {
  fasting: { icon: "FlaskConical", color: "#d97757", labelKey: "cart.preq.fasting" },
  alcohol: { icon: "AlertCircle", color: "#d97757", labelKey: "cart.preq.alcohol" },
  drugs:   { icon: "AlertCircle", color: "#7a45ec", labelKey: "cart.preq.drugs" },
  vaccine: { icon: "Shield",      color: "#2087d6", labelKey: "cart.preq.vaccine" },
};
function preAnalyticReqs(item) {
  const reqs = [];
  if (item.fasting) reqs.push("fasting");
  if (item.alcohol) reqs.push("alcohol");
  if (item.drugs)   reqs.push("drugs");
  if (item.vaccine) reqs.push("vaccine");
  return reqs;
}

// === Cart shape ===
function deriveCart(patient) {
  if (patient.cart && Array.isArray(patient.cart.items)) {
    const c = patient.cart;
    if (!c.promos) {
      const promos = {};
      if (c.promoCode && c.promoDiscount) promos[c.promoCode] = c.promoDiscount;
      return { ...c, promos, pregnancyConsent: c.pregnancyConsent || null };
    }
    return { pregnancyConsent: null, ...c };
  }
  const items = [{
    id: "visit-gp", kind: "visit", name: "GP consultation (visit fee)",
    price: 15, qty: 1, payer: patient.payer || "direct", status: "pending", auto: true,
  }];
  (patient.labTests || []).forEach(lt => {
    const cat = ORDER_CATALOG.find(c => c.id === lt.id);
    items.push({
      id: lt.id, kind: "lab", name: lt.name, price: lt.price, qty: 1,
      payer: patient.payer || "direct", status: lt.status || "pending",
      fasting: cat?.fasting, alcohol: cat?.alcohol, drugs: cat?.drugs, vaccine: cat?.vaccine,
    });
  });
  return {
    items,
    promos: {},
    splits: null,
    ccy: "USD",
    payment: { method: null, status: "idle", tendered: "" },
    pregnancyConsent: null,
  };
}

function persistCart(patient, onUpdate, next) {
  const labTests = next.items.filter(i => i.kind === "lab").map(i => ({
    id: i.id, name: i.name, price: i.price, status: i.status || "pending",
  }));
  onUpdate({ ...patient, cart: next, labTests });
}

function cartTotals(cart) {
  const subtotal = cart.items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
  const promos = cart.promos || {};
  const breakdown = [];
  let remaining = subtotal;
  for (const [code, p] of Object.entries(promos)) {
    if (p.type !== "item") continue;
    const tgt = cart.items.find(i => i.id === p.targetItem);
    const amt = tgt ? (tgt.price || 0) : 0;
    if (amt > 0) { breakdown.push({ code, label: p.label, amount: amt }); remaining -= amt; }
  }
  for (const [code, p] of Object.entries(promos)) {
    if (p.type !== "fixed") continue;
    const amt = Math.min(p.value, Math.max(0, remaining));
    if (amt > 0) { breakdown.push({ code, label: p.label, amount: amt }); remaining -= amt; }
  }
  for (const [code, p] of Object.entries(promos)) {
    if (p.type !== "percent") continue;
    const amt = Math.max(0, remaining) * (p.value / 100);
    if (amt > 0) { breakdown.push({ code, label: p.label, amount: amt }); remaining -= amt; }
  }
  const discount = breakdown.reduce((s, b) => s + b.amount, 0);
  const sumOf = (arr) => arr.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
  const insItems   = cart.items.filter(i => i.payer === "insurance");
  const corpItems  = cart.items.filter(i => i.payer === "corporate");
  const directItems = cart.items.filter(i => (i.payer || "direct") === "direct");
  const insTotalRaw = sumOf(insItems);
  const insCoverage = insTotalRaw * 0.8;
  const insPatient  = insTotalRaw - insCoverage;
  const corpTotal   = sumOf(corpItems);
  const directTotal = sumOf(directItems);
  const patientDue  = directTotal + insPatient - discount;
  const total       = subtotal - discount;
  return {
    subtotal, discount, total, breakdown,
    insCoverage, insPatient, corpTotal, directTotal,
    patientDue: Math.max(0, patientDue),
    insTotalRaw,
  };
}

// === KHQR placeholder graphic ===
function KHQRGraphic({ size = 148 }) {
  const cells = useMemo(() => {
    const out = [];
    let r = 0xA73B;
    for (let y = 0; y < 21; y++) {
      for (let x = 0; x < 21; x++) {
        r = (r * 9301 + 49297) % 233280;
        const v = r / 233280;
        const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
        if (finder) continue;
        if (v > 0.52) out.push({ x, y });
      }
    }
    return out;
  }, []);
  const cs = size / 23;
  return (
    <div style={{
      width: size + 14, height: size + 14, padding: 7,
      background: "white", borderRadius: 8,
      border: "3px solid #ed1c24",
      position: "relative",
    }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: "block" }}>
        {[[0,0],[14,0],[0,14]].map(([fx, fy], i) => (
          <g key={i}>
            <rect x={fx*cs} y={fy*cs} width={cs*7} height={cs*7} fill="#000" />
            <rect x={(fx+1)*cs} y={(fy+1)*cs} width={cs*5} height={cs*5} fill="#fff" />
            <rect x={(fx+2)*cs} y={(fy+2)*cs} width={cs*3} height={cs*3} fill="#000" />
          </g>
        ))}
        {cells.map((c, i) => (
          <rect key={i} x={c.x*cs+1} y={c.y*cs+1} width={cs*1.6} height={cs*1.6} fill="#000" />
        ))}
      </svg>
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        background: "white", padding: "3px 5px", borderRadius: 3,
      }}>
        <svg viewBox="0 0 24 24" width="24" height="24" fill="#ed1c24">
          <path d="M12 2 L18 6 L18 18 L12 22 L6 18 L6 6 Z" />
          <path d="M12 6 L15 8 L15 16 L12 18 L9 16 L9 8 Z" fill="white" />
        </svg>
      </div>
    </div>
  );
}

// === Add Order Modal ===
function AddOrderModal({ open, existingIds, onAdd, onClose, ccy }) {
  const t = useLang();
  const [kind, setKind] = useState("lab");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(new Set());
  const [highlight, setHighlight] = useState(0);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { if (open) { setPicked(new Set()); setQ(""); setKind("lab"); setHighlight(0); } }, [open]);
  // Reset highlight whenever the visible list changes
  useEffect(() => { setHighlight(0); }, [kind, q]);

  // Compute filtered list (must be before hotkey effect that closes over it)
  const filtered = ORDER_CATALOG.filter(c =>
    c.kind === kind && (!q || c.name.toLowerCase().includes(q.toLowerCase()))
  );
  // Selectable = visible AND not already in cart
  const selectable = filtered.filter(c => !existingIds.has(c.id));

  const toggle = (id) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAdd = () => onAdd(ORDER_CATALOG.filter(c => picked.has(c.id)));

  // Scroll the highlighted row into view whenever it changes
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-row-idx="${highlight}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlight, open, kind, q]);

  // Modal-scoped keyboard handler
  useKeydown((e) => {
    if (!open) return;
    const k = e.key;
    const mod = e.metaKey || e.ctrlKey;
    const inSearch = document.activeElement === searchRef.current;

    // Close
    if (k === "Escape") { e.preventDefault(); onClose(); return; }

    // Navigation — first ↓ from the search input HANDS focus to the list
    // (so subsequent Space toggles the row instead of inserting a literal space).
    // ↑ from the first row hands focus BACK to the search input (so the nurse
    // can keep typing without reaching for the mouse or pressing "/").
    if (k === "ArrowDown") {
      e.preventDefault();
      if (inSearch) {
        searchRef.current?.blur();
        // Highlight is already at 0 (reset on every q/kind change). Don't move it
        // — the visual ring on row 0 *is* the feedback that focus left the input.
      } else {
        setHighlight(h => Math.min(h + 1, Math.max(0, filtered.length - 1)));
      }
      return;
    }
    if (k === "ArrowUp") {
      e.preventDefault();
      if (inSearch) {
        // ↑ from search just blurs into the list (no movement).
        searchRef.current?.blur();
      } else if (highlight === 0) {
        // ↑ from the top of the list returns to search.
        searchRef.current?.focus();
      } else {
        setHighlight(h => Math.max(h - 1, 0));
      }
      return;
    }

    // Space → toggle highlighted row. Skipped while in the search input (so the
    // nurse can type space-containing test names like "Blood Glucose").
    if (k === " " && !inSearch) {
      const c = filtered[highlight];
      if (c && !existingIds.has(c.id)) { e.preventDefault(); toggle(c.id); }
      return;
    }

    // Enter → commit picks (or highlighted row if no picks); Shift+Enter → mark & continue
    if (k === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        // Mark highlighted, clear search, refocus, keep modal open
        const c = filtered[highlight];
        if (c && !existingIds.has(c.id)) {
          toggle(c.id);
          setQ("");
          setTimeout(() => searchRef.current?.focus(), 0);
        }
        return;
      }
      // Plain Enter
      if (picked.size > 0) {
        handleAdd();
      } else {
        const c = filtered[highlight];
        if (c && !existingIds.has(c.id)) onAdd([c]);
      }
      return;
    }

    // ⌘/Ctrl+A → select all visible (selectable) rows
    if (mod && (k === "a" || k === "A")) {
      e.preventDefault();
      setPicked(prev => {
        const next = new Set(prev);
        const allSelected = selectable.length > 0 && selectable.every(c => next.has(c.id));
        if (allSelected) selectable.forEach(c => next.delete(c.id));
        else selectable.forEach(c => next.add(c.id));
        return next;
      });
      return;
    }

    // Number keys 1..6 → jump category tab. Only fires when the search input is
    // NOT focused (so "1" inside a query like "vit-b12" doesn't switch tabs).
    if (!mod && !e.shiftKey && /^[1-6]$/.test(k) && !inSearch) {
      const idx = parseInt(k, 10) - 1;
      if (KIND_ORDER[idx]) { e.preventDefault(); setKind(KIND_ORDER[idx]); }
      return;
    }

    // "/" → focus search (when not already focused)
    if (k === "/" && !inSearch && !mod) {
      e.preventDefault();
      searchRef.current?.focus();
      return;
    }
  }, [open, filtered, highlight, picked, q, kind, existingIds]);

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 720, maxHeight: "82vh", display: "flex", flexDirection: "column", padding: 0 }} role="dialog" aria-modal="true" aria-label={t("cart.addModal.title")}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{t("cart.addModal.title")}</h3>
            <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>{t("cart.addModal.sub", { ccy: ccy || "USD" })}</div>
          </div>
          <button onClick={onClose} className="icon-btn"><I.X size={16} /></button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "10px 20px", borderBottom: "1px solid var(--border)" }}>
          {KIND_ORDER.map((k, i) => {
            const m = KIND_META[k];
            const Ico = I[m.icon];
            const active = kind === k;
            return (
              <button key={k} type="button" onClick={() => setKind(k)}
                title={t("hotkey.tip.tabKey", { n: i + 1 })}
                style={{
                  background: active ? "var(--brand-50)" : "transparent",
                  color: active ? "var(--brand-700)" : "var(--ink-600)",
                  border: "1px solid " + (active ? "var(--brand-200)" : "transparent"),
                  borderRadius: 6, padding: "6px 12px",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  whiteSpace: "nowrap",
                }}>
                <Ico size={13} /> {t(m.labelKey)}
                <span className="kbd-tab-num" aria-hidden="true">{i + 1}</span>
              </button>
            );
          })}
        </div>
        <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)" }}>
          <div className="search" style={{ height: 36 }}>
            <I.Search size={14} />
            <input
              ref={searchRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={t("cart.addModal.search", { kind: t(KIND_META[kind].labelKey).toLowerCase() })}
              autoFocus
              aria-keyshortcuts="ArrowDown ArrowUp Enter Shift+Enter Escape"
            />
          </div>
        </div>
        <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "8px 12px", minHeight: 240 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--ink-500)", fontSize: 13 }}>
              {t("cart.addModal.noMatch", { kind: t(KIND_META[kind].labelKey) })}
            </div>
          ) : filtered.map((c, idx) => {
            const inCart = existingIds.has(c.id);
            const isPicked = picked.has(c.id);
            const isHighlight = idx === highlight;
            const tags = preAnalyticReqs(c);
            return (
              <button
                key={c.id}
                type="button"
                data-row-idx={idx}
                onClick={() => { setHighlight(idx); if (!inCart) toggle(c.id); }}
                onMouseEnter={() => setHighlight(idx)}
                disabled={inCart}
                className={"add-modal-row" + (isHighlight ? " is-highlight" : "")}
                style={{
                  width: "100%",
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px",
                  background: isPicked ? "var(--brand-50)" : (isHighlight ? "var(--surface-2)" : "transparent"),
                  border: "1px solid " + (isPicked ? "var(--brand-200)" : (isHighlight ? "var(--brand-200)" : "transparent")),
                  borderRadius: 7, cursor: inCart ? "default" : "pointer",
                  opacity: inCart ? 0.55 : 1, textAlign: "left", marginBottom: 2,
                  outline: "none",
                }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: "1.5px solid " + (isPicked ? "var(--brand-500)" : "var(--ink-300)"),
                  background: isPicked || inCart ? "var(--brand-500)" : "white",
                  display: "grid", placeItems: "center", flexShrink: 0,
                }}>
                  {(isPicked || inCart) && <I.Check size={11} strokeWidth={3} style={{ color: "white" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)" }}>
                    {c.name}
                    {inCart && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--ink-500)", fontWeight: 500 }}>· {t("cart.addModal.inCart")}</span>}
                  </div>
                  {tags.length > 0 && (
                    <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                      {tags.map(tag => (
                        <span key={tag} style={{
                          fontSize: 10, fontWeight: 600, color: PRE_ANALYTIC_QS[tag].color,
                          background: PRE_ANALYTIC_QS[tag].color + "15",
                          padding: "1px 6px", borderRadius: 3,
                        }}>{t(PRE_ANALYTIC_QS[tag].labelKey)}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink-700)", fontVariantNumeric: "tabular-nums" }}>
                  {c.price === 0 ? "—" : fmtCcy(c.price, ccy || "USD")}
                </div>
              </button>
            );
          })}
        </div>
        <div className="add-modal-foot" style={{ padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
          <div className="kbd-strip" aria-hidden="true">
            <span><Kbd>↑</Kbd><Kbd>↓</Kbd> {t("hint.navigate")}</span>
            <span className="kbd-strip-sep">·</span>
            <span><Kbd>Space</Kbd> {t("hint.select")}</span>
            <span className="kbd-strip-sep">·</span>
            <span><Kbd>↵</Kbd> {t("hint.add")}</span>
            <span className="kbd-strip-sep">·</span>
            <span><Kbd>⇧</Kbd><Kbd>↵</Kbd> {t("hint.addNext")}</span>
            <span className="kbd-strip-sep">·</span>
            <span><Kbd>/</Kbd> {t("hint.search")}</span>
            <span className="kbd-strip-sep">·</span>
            <span><Kbd>Esc</Kbd> {t("hint.close")}</span>
          </div>
          <div className="add-modal-foot-row">
            <div style={{ fontSize: 12.5, color: "var(--ink-600)" }}>
              {picked.size === 0 ? t("cart.addModal.noneSelected") : t("cart.addModal.selectedCount", { n: picked.size })}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost" onClick={onClose}>{t("modal.cancel")} <Kbd>Esc</Kbd></button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={picked.size === 0}>
                <I.Plus size={14} /> {t("cart.addModal.addToCart")} <Kbd>↵</Kbd>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Bill Split Modal ===
function BillSplitModal({ open, cart, onClose, onSave }) {
  const t = useLang();
  const [draft, setDraft] = useState(cart);
  useEffect(() => { if (open) setDraft(cart); }, [open, cart]);
  if (!open) return null;
  const totals = cartTotals(draft);
  const setItemPayer = (id, payer) => {
    setDraft(d => ({ ...d, items: d.items.map(i => i.id === id ? { ...i, payer } : i) }));
  };
  const groups = {};
  draft.items.forEach(i => {
    const p = i.payer || "direct";
    (groups[p] = groups[p] || []).push(i);
  });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 820, maxHeight: "84vh", display: "flex", flexDirection: "column", padding: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{t("cart.split.title")}</h3>
            <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>{t("cart.split.sub")}</div>
          </div>
          <button onClick={onClose} className="icon-btn"><I.X size={16} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 320px" }}>
          <div style={{ padding: "12px 20px", borderRight: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 650, color: "var(--ink-500)", marginBottom: 6 }}>
              {t("cart.split.lineItems")}
            </div>
            {draft.items.map(item => {
              const meta = KIND_META[item.kind] || KIND_META.lab;
              const Ico = I[meta.icon];
              return (
                <div key={item.id} style={{
                  display: "grid", gridTemplateColumns: "auto 1fr auto",
                  alignItems: "center", gap: 10,
                  padding: "8px 0", borderBottom: "1px solid var(--border)",
                }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: meta.color + "18", color: meta.color, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Ico size={13} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-900)" }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 1 }}>{t(meta.labelKey)} · ${(item.price || 0).toFixed(2)}</div>
                  </div>
                  <select className="select" value={item.payer || "direct"} onChange={e => setItemPayer(item.id, e.target.value)}
                    style={{ height: 30, width: 130, fontSize: 11.5, padding: "0 8px" }}>
                    {Object.entries(PAYER_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{t(v.labelKey)}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "12px 16px", background: "var(--surface-2)" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 650, color: "var(--ink-500)", marginBottom: 8 }}>
              {t("cart.split.childInvoices")}
            </div>
            {Object.entries(groups).map(([payer, items]) => {
              const meta = PAYER_LABELS[payer] || PAYER_LABELS.other;
              const sub = items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
              return (
                <div key={payer} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: meta.color }} />
                      <span style={{ fontSize: 12, fontWeight: 650, color: "var(--ink-900)" }}>{t(meta.labelKey)}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>${sub.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {items.map(i => (
                      <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-600)" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{i.name}</span>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>${(i.price || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  {payer === "insurance" && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--border-strong)", fontSize: 10.5, color: "var(--ink-500)" }}>
                      {t("cart.split.insBreakdown", { copay: (sub * 0.2).toFixed(2) })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "var(--ink-600)" }}>
            {t("cart.split.summary", { n: Object.keys(groups).length, total: totals.subtotal.toFixed(2) })}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>{t("modal.cancel")}</button>
            <button className="btn btn-primary" onClick={() => onSave(draft)}>
              <I.Check size={14} /> {t("cart.split.apply")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Pregnancy Consent Modal ===
function PregnancyConsentModal({ open, patient, pendingItems, onConfirm, onCancel }) {
  const t = useLang();
  const [answer, setAnswer] = useState(null);
  const [override, setOverride] = useState(false);
  const [signedBy, setSignedBy] = useState("");
  useEffect(() => { if (open) { setAnswer(null); setOverride(false); setSignedBy(""); } }, [open]);
  if (!open) return null;
  const needsOverride = answer === "yes" || answer === "unsure";
  const canConfirm = answer === "no" || (needsOverride && override && signedBy.trim().length > 1);
  const submit = () => {
    if (!canConfirm) return;
    onConfirm({ answer, overrideOk: needsOverride ? override : undefined, by: needsOverride ? signedBy.trim() : undefined, at: new Date().toISOString() });
  };
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 520, padding: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "#fff1f2", color: "#be123c", display: "grid", placeItems: "center" }}>
            <I.AlertTriangle size={17} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{t("cart.preg.title")}</h3>
            <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>
              {patient.name} · {patient.sexAtBirth || "—"} · {t("cart.preg.sub")}
            </div>
          </div>
          <button onClick={onCancel} className="icon-btn"><I.X size={16} /></button>
        </div>
        <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
          <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 650, color: "var(--ink-500)", marginBottom: 4 }}>
            {t("cart.preg.awaiting")}
          </div>
          {(pendingItems || []).map(i => (
            <div key={i.id} style={{ fontSize: 12.5, color: "var(--ink-800)", display: "flex", justifyContent: "space-between" }}>
              <span>{i.name}</span><span style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-500)" }}>${(i.price || 0).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 650, color: "var(--ink-900)", marginBottom: 10 }}>
            {t("cart.preg.q")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[
              { v: "no",     labelKey: "cart.preg.no",     subKey: "cart.preg.no.sub",     color: "#06a07a" },
              { v: "yes",    labelKey: "cart.preg.yes",    subKey: "cart.preg.yes.sub",    color: "#be123c" },
              { v: "unsure", labelKey: "cart.preg.unsure", subKey: "cart.preg.unsure.sub", color: "#d97757" },
            ].map(o => {
              const active = answer === o.v;
              return (
                <button key={o.v} type="button" onClick={() => setAnswer(o.v)}
                  style={{
                    padding: "10px 8px",
                    background: active ? o.color + "12" : "var(--surface)",
                    border: "1.5px solid " + (active ? o.color : "var(--border-strong)"),
                    borderRadius: 8, cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: active ? o.color : "var(--ink-900)" }}>{t(o.labelKey)}</span>
                  <span style={{ fontSize: 10.5, color: "var(--ink-500)" }}>{t(o.subKey)}</span>
                </button>
              );
            })}
          </div>
          {answer === "no" && (
            <div style={{
              padding: "10px 12px", borderRadius: 7,
              background: "var(--success-50)", border: "1px solid var(--success-200, #a7f3d0)",
              fontSize: 12, color: "var(--success-700, #047857)",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <I.Check size={13} /> {t("cart.preg.notPregnantNote")}
            </div>
          )}
          {needsOverride && (
            <div style={{ padding: 12, borderRadius: 7, background: "#fef2f2", border: "1px solid #fecaca" }}>
              <div style={{ fontSize: 12, fontWeight: 650, color: "#991b1b", marginBottom: 6, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <I.AlertTriangle size={12} /> {t("cart.preg.advisory")}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink-700)", lineHeight: 1.5, marginBottom: 10 }}>
                {t("cart.preg.advisoryBody")}
              </div>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--ink-800)", cursor: "pointer", marginBottom: 8 }}>
                <input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} style={{ marginTop: 2 }} />
                <span>{t("cart.preg.overrideCheck")}</span>
              </label>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="label">{t("cart.preg.signoff")} <span className="req">*</span></label>
                <input className="input" value={signedBy} onChange={e => setSignedBy(e.target.value)}
                  placeholder={t("cart.preg.signoffPlaceholder")} style={{ height: 32, fontSize: 12.5 }} />
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-2)" }}>
          <div style={{ fontSize: 11, color: "var(--ink-500)" }}>
            {t("cart.preg.recordedAgainst")}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onCancel}>{t("cart.preg.cancelOrder")}</button>
            <button className="btn btn-primary" onClick={submit} disabled={!canConfirm}>
              <I.Check size={13} /> {t("cart.preg.recordAdd")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Cart Line ===
// Round 12 #1 — Always compact (~36px) cart row.
//   Layout: [icon] name [status icons] · price · [×]
//   Payer tag is tucked into a hover tooltip (title attr on the row).
//   Validation / policy info collapses to small badge icons that expand inline on click.
function CartLine({ item, onRemove, onSendValidation, isLast, ccy, t, policyDecision, hideValidationLabel }) {
  const meta = KIND_META[item.kind] || KIND_META.lab;
  const Ico = I[meta.icon];
  const payerMeta = PAYER_LABELS[item.payer] || PAYER_LABELS.direct;
  const requiresValidation = item.kind === "imaging";
  const validationState = item.validationState || "idle"; // idle | sending | sent | signed
  const showPolicyNote = item.payer === "insurance" && policyDecision && policyDecision.status !== "covered";
  const [openExpand, setOpenExpand] = useState(null); // null | "validation" | "policy"

  const rowTitle = `${t(payerMeta.labelKey)}`; // hover tooltip = payer name
  const validationBadgeTone =
    validationState === "signed" ? "success" :
    validationState === "sent"   ? "info" :
                                   "warn";

  return (
    <div className="cart-line cart-line-compact" data-payer={item.payer}>
      <div
        className="cart-line-row"
        title={rowTitle}
        style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}
      >
        <div className="cart-line-ico" style={{ background: meta.color + "18", color: meta.color }}>
          <Ico size={11} />
        </div>
        <div className="cart-line-name">
          <span className="cart-line-name-text">{item.name}</span>
          {requiresValidation && (
            <button
              type="button"
              className={"cart-line-badge cart-line-badge-" + validationBadgeTone}
              onClick={(e) => { e.stopPropagation(); setOpenExpand(o => o === "validation" ? null : "validation"); }}
              title={
                validationState === "signed" ? t("validate.signed") :
                validationState === "sent"   ? t("validate.sent")   :
                                               t("validate.requiresPatient")
              }
              aria-label={t("validate.requiresPatient")}
            >
              {validationState === "signed"
                ? <I.ShieldCheck size={10} strokeWidth={2.5} />
                : <I.AlertTriangle size={10} />}
            </button>
          )}
          {showPolicyNote && (
            <button
              type="button"
              className={"cart-line-badge cart-line-badge-" + (policyDecision.status === "outOfPolicy" ? "danger" : "warn")}
              onClick={(e) => { e.stopPropagation(); setOpenExpand(o => o === "policy" ? null : "policy"); }}
              title={policyDecision.reason}
              aria-label={t("cart.policy.note")}
            >
              <I.AlertCircle size={10} />
            </button>
          )}
        </div>
        <div className="cart-line-price">
          {item.price === 0 ? "—" : fmtCcy((item.price || 0) * (item.qty || 1), ccy)}
        </div>
        <button
          onClick={onRemove}
          disabled={item.auto}
          className={"cart-line-remove" + (item.auto ? " disabled" : "")}
          title={item.auto ? t("cart.autoVisitFee") : t("cart.remove")}
        >
          <I.X size={10} strokeWidth={2.5} />
        </button>
      </div>
      {openExpand === "validation" && (
        <div className="cart-line-expand">
          {validationState === "idle" ? (
            <button
              type="button"
              onClick={onSendValidation}
              className="cart-line-action"
            >
              <I.Smartphone size={10} /> {t("validate.sendPhone")}
            </button>
          ) : validationState === "sent" ? (
            <span className="cart-line-action-info">
              <span className="spinner" style={{ width: 8, height: 8, borderWidth: 1 }} /> {t("validate.sent")}
            </span>
          ) : (
            <span className="cart-line-action-info success">
              <I.ShieldCheck size={10} /> {t("validate.signed")}
            </span>
          )}
        </div>
      )}
      {openExpand === "policy" && showPolicyNote && (
        <div className="cart-line-expand">
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <I.Shield size={10} />
            <span style={{ fontWeight: 700 }}>
              {policyDecision.status === "outOfPolicy"
                ? t("cart.policy.outOfPolicy")
                : `${policyDecision.coveredPct}% ${t("cart.policy.partial")}`}
            </span>
          </div>
          <div style={{ color: "var(--ink-700)" }}>{policyDecision.reason}</div>
          {policyDecision.status === "outOfPolicy" && (
            <div style={{ marginTop: 2, color: "var(--danger-600)", fontWeight: 600 }}>
              → {t("cart.policy.cashOnly")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// === Payment Area ===
function PaymentArea({ cart, totals, tendered, setTendered, onMethod, onCcyToggle, onConfirmCash, onConfirmKhqr, change, cashOk, tenderedNum, itemCount, t }) {
  const ccy = cart.ccy || "USD";
  const status = cart.payment.status;
  const method = cart.payment.method;
  const due = totals.patientDue;
  const dueLabel = fmtCcy(due, ccy);

  if (status === "confirmed") {
    const methodLabel = method === "cash" ? t("cart.pay.cash") : "KHQR";
    return (
      <div className="pay-confirmed">
        <div className="pay-confirmed-head">
          <div className="pay-confirmed-mark">
            <I.Check size={14} strokeWidth={3} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pay-confirmed-title">{t("cart.pay.confirmed")}</div>
            <div className="pay-confirmed-time">
              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
        <dl className="pay-confirmed-grid">
          <div>
            <dt>{t("pay.amount")}</dt>
            <dd className="pay-confirmed-amount">{fmtCcy(due, ccy)}</dd>
          </div>
          <div>
            <dt>{t("pay.title")}</dt>
            <dd>{methodLabel}</dd>
          </div>
          <div>
            <dt>{t("pay.receiptNo")}</dt>
            <dd className="mono">#{cart.payment.receiptId}</dd>
          </div>
        </dl>
        <div className="pay-confirmed-actions">
          <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }}>
            <I.Printer size={12} /> {t("cart.pay.print")}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }}>
            <I.Send size={12} /> {t("cart.pay.sendPhone")}
          </button>
        </div>
      </div>
    );
  }

  if (!method) {
    return (
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
        <div className="between" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 650, color: "var(--ink-500)" }}>
            {t("cart.pay.title")}
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: 5, padding: 2 }}>
            {["USD", "KHR"].map(c => {
              const active = ccy === c;
              return (
                <button key={c} type="button" onClick={() => onCcyToggle(c)}
                  style={{
                    padding: "2px 8px", border: "none",
                    background: active ? "var(--surface)" : "transparent",
                    color: active ? "var(--ink-900)" : "var(--ink-500)",
                    fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                    borderRadius: 4, boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  }}>{c}</button>
              );
            })}
          </div>
        </div>
        {/* Round 12 #2 — payment methods get the same disabled-tooltip treatment. */}
        {(() => {
          const payDisabled = itemCount === 0 || due === 0;
          const payReasons = [];
          if (itemCount === 0) payReasons.push(t("disabled.payment.empty"));
          else if (due === 0) payReasons.push(t("disabled.payment.zero"));
          const payProps = {
            disabled: payDisabled,
            title: t("disabled.payment.title"),
            reasons: payReasons,
          };
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <DisabledTooltip block {...payProps}>
                <button onClick={() => onMethod("khqr")} disabled={payDisabled}
                  style={{
                    width: "100%",
                    padding: "10px 8px", border: "1.5px solid var(--border-strong)", borderRadius: 7, background: "var(--surface)",
                    cursor: payDisabled ? "not-allowed" : "pointer",
                    opacity: payDisabled ? 0.5 : 1,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  }}>
                  <QRGlyph size={18} />
                  <span style={{ fontSize: 11.5, fontWeight: 650, color: "var(--ink-900)" }}>KHQR</span>
                </button>
              </DisabledTooltip>
              <DisabledTooltip block {...payProps}>
                <button onClick={() => onMethod("cash")} disabled={payDisabled}
                  style={{
                    width: "100%",
                    padding: "10px 8px", border: "1.5px solid var(--border-strong)", borderRadius: 7, background: "var(--surface)",
                    cursor: payDisabled ? "not-allowed" : "pointer",
                    opacity: payDisabled ? 0.5 : 1,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  }}>
                  <I.Wallet size={18} style={{ color: "var(--ink-700)" }} />
                  <span style={{ fontSize: 11.5, fontWeight: 650, color: "var(--ink-900)" }}>{t("cart.pay.cash")}</span>
                </button>
              </DisabledTooltip>
            </div>
          );
        })()}
        {due === 0 && itemCount > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-500)", textAlign: "center" }}>
            {t("cart.pay.fullyCovered")}
          </div>
        )}
      </div>
    );
  }

  if (method === "khqr") {
    return (
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
        <div className="between" style={{ marginBottom: 10 }}>
          <button onClick={() => onMethod(null)} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--ink-600)", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
            <I.ChevronLeft size={12} /> {t("cart.pay.back")}
          </button>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-900)" }}>KHQR · {dueLabel}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <KHQRGraphic size={148} />
          {/* Seamless integration mock: webhook listening live */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 8px", borderRadius: 4,
            background: "var(--success-50)", color: "var(--success-600)",
            border: "1px solid var(--success-500)",
            fontSize: 10.5, fontWeight: 600,
          }}>
            <I.Wifi size={10} />
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", background: "var(--success-500)",
                animation: "pulseDot 1.4s ease-in-out infinite",
              }} />
              {t("cart.pay.khqrLive")}
            </span>
          </div>
          {status === "waiting" && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-600)" }}>
              <span className="spinner" style={{ width: 9, height: 9, borderWidth: 1.5 }} />
              {t("cart.pay.khqrAuto")}
            </div>
          )}
          <div style={{ fontSize: 10, color: "var(--ink-400)", textAlign: "center", maxWidth: 200 }}>
            {t("cart.pay.bakongHint")}
          </div>
          <button className="btn btn-primary" onClick={onConfirmKhqr} style={{ height: 34, marginTop: 2 }}>
            <I.Check size={14} /> {t("cart.pay.markReceived")}
          </button>
        </div>
      </div>
    );
  }

  if (method === "cash") {
    const tenderedInUSD = ccy === "KHR" ? (tenderedNum / KHR_RATE) : tenderedNum;
    const changeUSD = tenderedInUSD - due;
    const symbol = ccy === "KHR" ? "៛" : "$";
    return (
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
        <div className="between" style={{ marginBottom: 8 }}>
          <button onClick={() => onMethod(null)} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--ink-600)", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
            <I.ChevronLeft size={12} /> {t("cart.pay.back")}
          </button>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-900)" }}>{t("cart.pay.cash")} · {dueLabel}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-600)" }}>{t("cart.pay.tendered")} ({ccy})</label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-500)", fontSize: 13, fontWeight: 600 }}>{symbol}</span>
            <input className="input" value={tendered} onChange={e => setTendered(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder={ccy === "KHR" ? "0" : "0.00"} inputMode="decimal"
              style={{ height: 32, fontSize: 13, fontVariantNumeric: "tabular-nums", fontWeight: 600, paddingLeft: 24 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, padding: "4px 0" }}>
            <span style={{ color: "var(--ink-600)" }}>{t("cart.pay.change")}</span>
            <span style={{
              fontWeight: 700, fontVariantNumeric: "tabular-nums",
              color: tenderedNum === 0 ? "var(--ink-400)"
                : changeUSD < 0 ? "var(--danger-500)"
                : changeUSD === 0 ? "var(--ink-700)"
                : "var(--success-700, #047857)",
            }}>
              {changeUSD < 0 ? "−" : ""}{fmtCcy(Math.abs(changeUSD), ccy)}
            </span>
          </div>
          <button className="btn btn-primary" onClick={onConfirmCash} disabled={!(tenderedInUSD >= due && due > 0)} style={{ height: 34, marginTop: 2 }}>
            <I.Check size={14} /> {t("cart.pay.confirmCash")}
          </button>
        </div>
      </div>
    );
  }
  return null;
}

// === Main OrderCart ===
export function OrderCart({ patient, onUpdate, onPushToast, onCheckIn, identityComplete }) {
  const t = useLang();
  const cart = useMemo(() => deriveCart(patient), [patient]);
  const totals = cartTotals(cart);
  const [addOpen, setAddOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState("");
  const [tendered, setTendered] = useState(cart.payment.tendered || "");
  const [pregOpen, setPregOpen] = useState(false);
  const [pendingPregItems, setPendingPregItems] = useState(null);
  // Round 12 #1 — collapse state per kind. Resets on reload (no persistence by design).
  const [collapsedKinds, setCollapsedKinds] = useState(() => new Set());
  const toggleKindCollapsed = (kind) => {
    setCollapsedKinds(prev => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind); else next.add(kind);
      return next;
    });
  };

  const setCart = (next) => persistCart(patient, onUpdate, next);

  // Open the Add Test modal from anywhere via keyboard.
  // We deliberately AVOID Cmd/Ctrl+T (the browser owns that for "new tab" — preventDefault
  // can't reclaim it on most platforms). Two options that ARE free:
  //   • Plain "t"   when no text field is focused (Linear / GitHub-style single-key)
  //   • Alt+T       always — works even while typing, never conflicts with the browser
  useKeydown((e) => {
    if (addOpen) return;
    const overlays = document.querySelectorAll(".modal-overlay");
    if (overlays.length > 0) return;

    const altT = e.altKey && (e.key === "t" || e.key === "T" || e.code === "KeyT");
    const plainT = !e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey
                   && (e.key === "t" || e.key === "T")
                   && !isTypingTarget();
    if (altT || plainT) {
      e.preventDefault();
      setAddOpen(true);
    }
  }, [addOpen]);

  const itemCount = cart.items.length;
  const grouped = {};
  cart.items.forEach(i => { (grouped[i.kind] = grouped[i.kind] || []).push(i); });

  const PREG_GATE_KINDS = new Set(["imaging"]);
  const itemNeedsPregGate = (c) => patient.sexAtBirth === "Female" && PREG_GATE_KINDS.has(c.kind);

  const commitAdditions = (additions) => {
    if (additions.length === 0) {
      onPushToast?.(t("cart.alreadyInCart"));
      setAddOpen(false);
      return;
    }
    setCart({ ...cart, items: [...cart.items, ...additions] });
    onPushToast?.(t("cart.addedN", { n: additions.length }));
    setAddOpen(false);
  };

  const handleAdd = (newItems) => {
    const existing = new Set(cart.items.map(i => i.id));
    const additions = newItems.filter(c => !existing.has(c.id)).map(c => ({
      id: c.id, kind: c.kind, name: c.name, price: c.price, qty: 1,
      payer: patient.payer || "direct", status: "pending",
      fasting: c.fasting, alcohol: c.alcohol, drugs: c.drugs, vaccine: c.vaccine,
    }));
    const needsGate = additions.some(itemNeedsPregGate);
    if (needsGate && !cart.pregnancyConsent) {
      setPendingPregItems(additions);
      setPregOpen(true);
      setAddOpen(false);
      return;
    }
    commitAdditions(additions);
  };

  const handlePregConsent = (consent) => {
    setCart({ ...cart, pregnancyConsent: consent, items: [...cart.items, ...(pendingPregItems || [])] });
    onPushToast?.(t("cart.preg.recorded"));
    setPendingPregItems(null);
    setPregOpen(false);
  };
  const handlePregCancel = () => {
    setPendingPregItems(null);
    setPregOpen(false);
    onPushToast?.(t("cart.preg.cancelled"), "error");
  };

  const removeItem = (id) => setCart({ ...cart, items: cart.items.filter(i => i.id !== id) });

  // === Patient-side validation for imaging (chain of custody) ===
  const sendValidation = (id) => {
    setCart({
      ...cart,
      items: cart.items.map(i => i.id === id ? { ...i, validationState: "sent" } : i),
    });
    onPushToast?.(t("validate.sent"));
    // mock the patient tap-to-sign 1.8s later
    setTimeout(() => {
      const after = deriveCart(patient);
      // only flip if still "sent" (use latest patient state)
      onUpdate({
        ...patient,
        cart: {
          ...(patient.cart || after),
          items: (patient.cart?.items || after.items).map(i =>
            i.id === id ? { ...i, validationState: "signed", patientValidatedAt: new Date().toISOString() } : i
          ),
        },
      });
      onPushToast?.(t("validate.signed"), "success");
    }, 1800);
  };

  // === Mock insurer API decisions for insurance-paid items ===
  const insItems = cart.items.filter(i => i.payer === "insurance");
  const policyDecisions = useMemo(() => {
    const map = {};
    mockInsurerDecide(insItems).forEach(d => { map[d.id] = d; });
    return map;
  }, [insItems.map(i => i.id).join("|")]);

  // Pending validations gate
  const pendingValidations = cart.items.filter(i => i.kind === "imaging" && (i.validationState || "idle") !== "signed");

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) { setPromoError(""); return; }
    const promo = PROMO_CODES[code];
    if (!promo) { setPromoError(t("cart.promo.notFound", { code })); return; }
    const promos = cart.promos || {};
    const collision = promoCollision(promos, code);
    if (collision) { setPromoError(collision.reason); return; }
    setPromoError("");
    setPromoInput("");
    setCart({ ...cart, promos: { ...promos, [code]: promo } });
    onPushToast?.(t("cart.promo.applied", { label: promo.label }));
  };
  const removePromo = (code) => {
    const promos = { ...(cart.promos || {}) };
    delete promos[code];
    setCart({ ...cart, promos });
  };

  const setCcy = (ccy) => setCart({ ...cart, ccy });
  const setMethod = (m) => setCart({ ...cart, payment: { ...cart.payment, method: m, status: m === "khqr" ? "waiting" : "idle" } });

  const tenderedNum = parseFloat(tendered) || 0;
  const change = tenderedNum - totals.patientDue;
  const cashOk = tenderedNum >= totals.patientDue && totals.patientDue > 0;

  const confirmKhqr = () => {
    setCart({ ...cart, payment: { ...cart.payment, status: "confirmed", method: "khqr", receiptId: "R-" + Math.floor(10000 + Math.random() * 90000) } });
    onPushToast?.(t("cart.pay.khqrReceived"));
  };

  // === Seamless KHQR (QHA) auto-confirm via mock Bakong webhook ===
  useEffect(() => {
    if (cart.payment.method !== "khqr") return;
    if (cart.payment.status !== "waiting") return;
    const id = setTimeout(() => {
      // re-read latest cart from patient to avoid stale state
      const latest = patient.cart;
      if (!latest) return;
      if (latest.payment?.method === "khqr" && latest.payment?.status === "waiting") {
        confirmKhqr();
      }
    }, 5000);
    return () => clearTimeout(id);
  }, [cart.payment.method, cart.payment.status]);

  const confirmCash = () => {
    const tenderedInUSD = (cart.ccy || "USD") === "KHR" ? tenderedNum / KHR_RATE : tenderedNum;
    // Cash-drawer ding (Web Audio mock)
    const dinged = playDrawerDing();
    setCart({ ...cart, payment: { ...cart.payment, status: "confirmed", method: "cash", tendered, change: tenderedInUSD - totals.patientDue, receiptId: "R-" + Math.floor(10000 + Math.random() * 90000) } });
    onPushToast?.(dinged ? t("cart.pay.drawerDing") : t("cart.pay.cashRecorded"));
  };

  const splits = (() => {
    const g = {};
    cart.items.forEach(i => { const p = i.payer || "direct"; (g[p] = g[p] || []).push(i); });
    return Object.entries(g).map(([payer, items]) => ({
      payer, items, sub: items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0),
    }));
  })();
  const isSplit = splits.length > 1;
  const payerChips = splits.map(s => ({
    label: t(PAYER_LABELS[s.payer]?.shortKey || "cart.payer.other.short"),
    color: PAYER_LABELS[s.payer]?.color || "#64748b",
    amount: s.sub,
  }));

  // === Primary CTA (Round 9 #1) — Round 12 #2: strictly gated on verified contact ===
  // Verification (mobile OTP or Telegram) is REQUIRED — no override path.
  const hasName = !!patient.name;
  const hasDob  = !!patient.dob;
  const isVerified = !!(patient.otpVerified || patient.telegramVerified);
  const ctaDisabled = !(hasName && hasDob && isVerified);
  const ctaLabel = itemCount === 0
    ? t("cart.cta.checkInOnly")
    : t("cart.cta.checkInConfirm");
  // Build the precise list of what's missing — feeds the disabled tooltip.
  const ctaReasons = [];
  if (!isVerified) ctaReasons.push(t("disabled.checkin.contact"));
  if (!hasDob)     ctaReasons.push(t("disabled.checkin.dob"));
  if (!hasName)    ctaReasons.push(t("disabled.checkin.name"));

  return (
    <>
      <div style={{
        position: "sticky", top: "var(--gap)",
        display: "flex", flexDirection: "column", gap: "var(--gap)",
      }}>
        <div className="card order-cart" style={{ display: "flex", flexDirection: "column", overflow: "hidden", maxHeight: "calc(100vh - 100px)" }}>
          {/* Header */}
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)" }}>
            <div className="between" style={{ marginBottom: 4, gap: 8 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <I.ShoppingCart size={15} style={{ color: "var(--brand-600)", flexShrink: 0 }} />
                <h2 style={{ margin: 0, fontSize: "var(--font-lg)", fontWeight: 700, color: "var(--ink-900)", whiteSpace: "nowrap" }}>{t("cart.title")}</h2>
              </div>
              <span style={{ fontSize: 11, color: "var(--ink-500)", fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>
                {t("cart.itemCount", { n: itemCount })}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-600)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {patient.name} · {patient.queueNumber || "—"}
            </div>
          </div>

          {/* Items */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px", minHeight: 100 }}>
            {itemCount === 0 ? (
              <div style={{ padding: "24px 0", textAlign: "center", color: "var(--ink-500)", fontSize: 12 }}>
                {t("cart.empty")}
              </div>
            ) : KIND_ORDER.map(kind => {
              const items = grouped[kind];
              if (!items || items.length === 0) return null;
              const meta = KIND_META[kind];
              const groupSub = items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
              const isCollapsed = collapsedKinds.has(kind);
              return (
                <div key={kind} className={"cart-group" + (isCollapsed ? " is-collapsed" : "")}>
                  <button
                    type="button"
                    className="cart-group-head"
                    onClick={() => toggleKindCollapsed(kind)}
                    aria-expanded={!isCollapsed}
                    aria-controls={`cart-group-body-${kind}`}
                    title={isCollapsed ? t("cart.group.expand") : t("cart.group.collapse")}
                  >
                    <I.ChevronDown
                      size={12}
                      strokeWidth={2.5}
                      className={"cart-group-chev" + (isCollapsed ? " is-collapsed" : "")}
                      style={{ color: meta.color }}
                    />
                    <span className="cart-group-label" style={{ color: meta.color }}>
                      <span className="cart-group-dot" style={{ background: meta.color }} />
                      {t(meta.labelKey)}
                      <span className="cart-group-count">{items.length}</span>
                    </span>
                    <span className="cart-group-sub">{fmtCcy(groupSub, cart.ccy || "USD")}</span>
                  </button>
                  {!isCollapsed && (
                    <div id={`cart-group-body-${kind}`}>
                      {items.map((item, idx) => (
                        <CartLine
                          key={item.id}
                          item={item}
                          isLast={idx === items.length - 1}
                          ccy={cart.ccy || "USD"}
                          onRemove={() => removeItem(item.id)}
                          onSendValidation={() => sendValidation(item.id)}
                          policyDecision={policyDecisions[item.id]}
                          t={t}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <button className="btn btn-ghost" onClick={() => setAddOpen(true)}
              title={t("hotkey.tip.openAdd")}
              style={{ width: "100%", marginTop: 10, marginBottom: 10, borderStyle: "dashed", height: 34, fontSize: 12, fontWeight: 600, color: "var(--brand-600)" }}>
              <I.Plus size={13} /> {t("cart.addTests")}
              <Kbd>T</Kbd>
            </button>
          </div>

          {/* Promo + totals + split */}
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
            {Object.keys(cart.promos || {}).length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                {Object.entries(cart.promos).map(([code, p]) => (
                  <div key={code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", borderRadius: 5, background: "var(--success-50)", border: "1px solid var(--success-200, #a7f3d0)" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, minWidth: 0 }}>
                      <I.Tag size={11} style={{ color: "var(--success-600, #059669)", flexShrink: 0 }} />
                      <strong style={{ color: "var(--success-700, #047857)", fontFamily: "'SF Mono', ui-monospace, monospace" }}>{code}</strong>
                      <span style={{ color: "var(--ink-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {p.label}</span>
                    </div>
                    <button onClick={() => removePromo(code)} style={{ background: "transparent", border: "none", padding: 2, cursor: "pointer", color: "var(--ink-400)", display: "grid", placeItems: "center", flexShrink: 0 }} title={t("cart.promo.remove")}>
                      <I.X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 4 }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <I.Tag size={11} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--ink-400)" }} />
                  <input className="input" value={promoInput}
                    onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(""); }}
                    placeholder={Object.keys(cart.promos || {}).length > 0 ? t("cart.promo.addAnother") : t("cart.promo.placeholder")}
                    style={{ height: 28, fontSize: 11.5, padding: "0 8px 0 26px", textTransform: "uppercase", borderColor: promoError ? "var(--danger-500)" : undefined }}
                    onKeyDown={e => { if (e.key === "Enter") applyPromo(); }} />
                </div>
                <button type="button" onClick={applyPromo} disabled={!promoInput.trim()}
                  style={{
                    height: 28, padding: "0 10px",
                    border: "1px solid var(--border-strong)",
                    background: promoInput.trim() ? "var(--brand-50)" : "var(--surface-2)",
                    color: promoInput.trim() ? "var(--brand-700)" : "var(--ink-400)",
                    borderRadius: 5, fontSize: 11.5, fontWeight: 650,
                    cursor: promoInput.trim() ? "pointer" : "not-allowed",
                  }}>{t("cart.promo.apply")}</button>
              </div>
              {promoError ? (
                <div style={{ fontSize: 10.5, color: "var(--danger-500)", marginTop: 3, display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <I.AlertCircle size={10} /> {promoError}
                </div>
              ) : Object.keys(cart.promos || {}).length === 0 && (
                <div style={{ fontSize: 10, color: "var(--ink-400)", marginTop: 3 }}>{t("cart.promo.hint")}</div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ink-600)" }}>
                <span>{t("cart.subtotal")}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtCcy(totals.subtotal, cart.ccy)}</span>
              </div>
              {totals.breakdown.map(b => (
                <div key={b.code} style={{ display: "flex", justifyContent: "space-between", color: "var(--success-700, #047857)", fontSize: 11 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{b.code}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>−{fmtCcy(b.amount, cart.ccy)}</span>
                </div>
              ))}
              {totals.insTotalRaw > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ink-500)", fontSize: 11 }}>
                  <span>{t("cart.insCovers")}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>−{fmtCcy(totals.insCoverage, cart.ccy)}</span>
                </div>
              )}
              {totals.corpTotal > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ink-500)", fontSize: 11 }}>
                  <span>{t("cart.corpCovers")}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>−{fmtCcy(totals.corpTotal, cart.ccy)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6, borderTop: "1px solid var(--border-strong)", marginTop: 4, fontWeight: 700, fontSize: 13.5, color: "var(--ink-900)", gap: 8 }}>
                <span style={{ whiteSpace: "nowrap" }}>{t("cart.patientPays")}</span>
                <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtCcy(totals.patientDue, cart.ccy)}</span>
              </div>
            </div>

            {payerChips.length > 1 && (
              <div style={{ marginTop: 8, padding: "6px 8px", borderRadius: 5, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                <span style={{ fontSize: 10.5, color: "var(--ink-500)", fontWeight: 600, marginRight: 4 }}>{t("cart.split.label")}</span>
                {payerChips.map((c, i) => (
                  <span key={i} style={{
                    fontSize: 10.5, fontWeight: 600, color: c.color,
                    background: c.color + "15",
                    padding: "1px 5px", borderRadius: 3,
                    fontVariantNumeric: "tabular-nums",
                  }}>{c.label} {fmtCcy(c.amount, cart.ccy)}</span>
                ))}
              </div>
            )}

            <button className="btn btn-ghost" onClick={() => setSplitOpen(true)}
              style={{ width: "100%", marginTop: 8, height: 28, fontSize: 11.5, fontWeight: 600, color: "var(--ink-700)" }}
              disabled={itemCount === 0}>
              <I.Split size={12} /> {isSplit ? t("cart.split.edit") : t("cart.split.bill")}
            </button>
          </div>

          {/* === Chain-of-custody banner (imaging not yet validated by patient) === */}
          {pendingValidations.length > 0 && cart.payment.status !== "confirmed" && (
            <div style={{
              padding: "10px 16px", borderTop: "1px solid var(--border)",
              background: "var(--warn-50)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 5,
                  background: "var(--warn-500)", color: "white",
                  display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1,
                }}>
                  <I.AlertTriangle size={12} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 650, color: "var(--ink-900)" }}>{t("validate.bannerTitle")}</div>
                  <div style={{ fontSize: 10.5, color: "var(--ink-700)", marginTop: 1, lineHeight: 1.4 }}>
                    {t("validate.bannerBody")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* === Auto-split hint (when insurance is in the mix) === */}
          {insItems.length > 0 && cart.payment.status !== "confirmed" && (
            <div style={{
              padding: "8px 16px", borderTop: "1px solid var(--border)",
              background: "var(--brand-50)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <I.Sparkles size={13} style={{ color: "var(--brand-600)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 650, color: "var(--brand-700)" }}>{t("ins.autoSplit")}</div>
                <div style={{ fontSize: 10, color: "var(--ink-600)", marginTop: 1 }}>
                  {t("ins.autoSplit.sub", { covered: 80, patient: 20 })}
                </div>
              </div>
            </div>
          )}

          <PaymentArea
            cart={cart}
            totals={totals}
            tendered={tendered}
            setTendered={setTendered}
            onMethod={setMethod}
            onCcyToggle={setCcy}
            onConfirmCash={confirmCash}
            onConfirmKhqr={confirmKhqr}
            change={change}
            cashOk={cashOk}
            tenderedNum={tenderedNum}
            itemCount={itemCount}
            t={t}
          />

          {/* === Round 9 #1: Primary CTA — Cart is the primary CTA === */}
          {/* Round 12 #2: wrap in DisabledTooltip — list precise missing requirements. */}
          {cart.payment.status !== "confirmed" && (
            <div style={{ padding: "10px 16px 14px", borderTop: "1px solid var(--border)" }}>
              <DisabledTooltip
                block
                disabled={ctaDisabled}
                title={t("disabled.checkin.title")}
                reasons={ctaReasons}
                hint={t("disabled.checkin.hint")}
              >
                <button
                  className="btn btn-primary"
                  onClick={onCheckIn}
                  disabled={ctaDisabled}
                  style={{ width: "100%", justifyContent: "center", height: 40, fontSize: 13, fontWeight: 650 }}
                >
                  <I.Check size={15} /> {ctaLabel}
                </button>
              </DisabledTooltip>
            </div>
          )}
        </div>
      </div>

      <AddOrderModal open={addOpen} existingIds={new Set(cart.items.map(i => i.id))} ccy={cart.ccy || "USD"} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
      <BillSplitModal open={splitOpen} cart={cart} onClose={() => setSplitOpen(false)} onSave={(next) => { setCart(next); setSplitOpen(false); onPushToast?.(t("cart.split.applied")); }} />
      <PregnancyConsentModal open={pregOpen} patient={patient} pendingItems={pendingPregItems || []} onConfirm={handlePregConsent} onCancel={handlePregCancel} />
    </>
  );
}
