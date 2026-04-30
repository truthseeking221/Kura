// === AddTestsPanel — unified test picker ===
//
//   Replaces the previous 3 disjoint cards (AI suggestions / Catalogue / Previous tests).
//   Same job, same row pattern, different *lenses* over the same catalogue.
//
//   Lenses (view tabs, left → right):
//     1. Smart       — AI + previous merged, ranked by relevance (default)
//     2. Previous    — patient's historical orders only
//     3. Visit, Lab, Imaging, ECG, Vitals, Telecon — pure catalogue browse
//
//   Every row is the same: [✓] name · [badges…] · price · [Add]
//   Badges compose by source — AI confidence, last-tested date, sensitive, popular.
//   "Why?" is a per-row icon; clicking expands a one-line rationale inline.
//   Multi-select works in every view; bulk action bar slides up when picks > 0.
//
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { I } from "./icons";
import { useLang } from "./i18n";
import { ORDER_CATALOG } from "./OrderCart";
import { useAIRecommendations, TEST_INFO, WhyCard } from "./AIPanel";
import { Kbd, MOD_LABEL } from "./shared";

const KHR_RATE = 4100;
const fmtPrice = (usd, ccy) => ccy === "KHR"
  ? "៛" + Math.round((usd || 0) * KHR_RATE).toLocaleString()
  : "$" + (usd || 0).toFixed(2);

// === flyToCart — parabolic toss animation when adding tests ===
//
//   A small pill (kind-dot + name) lifts off the row, arcs along a
//   parabolic path, shrinks, and lands on the cart icon. Cart icon +
//   count then react with a soft spring bump.
//
//   Pure DOM + Web Animations API — no library, no React rerender.
//   Honors prefers-reduced-motion: skips the toss, still bumps the cart.
//
const FLY_KIND_DOT = {
  visit:   "#3a78a6",
  lab:     "#168873",
  imaging: "#bc7243",
  ecg:     "#af5b64",
  vitals:  "#756aa3",
  telecon: "#2f836c",
};
let _bumpTimer = 0;

function bumpCart() {
  const el = document.querySelector(".order-cart");
  if (!el) return;
  el.classList.remove("is-receiving");
  // force reflow so the animation replays even on rapid successive bumps
  void el.offsetWidth;
  el.classList.add("is-receiving");
  window.clearTimeout(_bumpTimer);
  _bumpTimer = window.setTimeout(() => el.classList.remove("is-receiving"), 600);
}

function flyToCart(sourceEl, { name, kind }) {
  const target = document.querySelector(".cart-hd2-ico");
  if (!sourceEl || !target) { bumpCart(); return; }

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) { bumpCart(); return; }

  const src = sourceEl.getBoundingClientRect();
  const dst = target.getBoundingClientRect();
  const sx = src.left + src.width / 2;
  const sy = src.top + src.height / 2;
  const tx = (dst.left + dst.width / 2) - sx;
  const ty = (dst.top + dst.height / 2) - sy;

  const ghost = document.createElement("div");
  ghost.className = "fly-ghost";
  ghost.style.left = sx + "px";
  ghost.style.top  = sy + "px";
  const dot = document.createElement("span");
  dot.className = "fly-ghost-dot";
  dot.style.background = FLY_KIND_DOT[kind] || FLY_KIND_DOT.lab;
  const txt = document.createElement("span");
  txt.className = "fly-ghost-text";
  txt.textContent = name;
  ghost.appendChild(dot);
  ghost.appendChild(txt);
  document.body.appendChild(ghost);

  // Parabolic arc — peak elevated above the chord, scaled by distance
  const dist = Math.hypot(tx, ty);
  const lift = Math.min(120, Math.max(48, dist * 0.22));
  const mx = tx * 0.5;
  const my = ty * 0.5 - lift;

  const DUR = 640;
  const anim = ghost.animate([
    { transform: "translate(-50%,-50%) translate(0,0) scale(0.92)",                                           opacity: 0, offset: 0 },
    { transform: "translate(-50%,-50%) translate(0,0) scale(1)",                                              opacity: 1, offset: 0.10 },
    { transform: `translate(-50%,-50%) translate(${mx}px, ${my}px) scale(0.78) rotate(-3deg)`,                opacity: 1, offset: 0.55 },
    { transform: `translate(-50%,-50%) translate(${tx}px, ${ty}px) scale(0.16) rotate(-7deg)`,                opacity: 0, offset: 1 },
  ], { duration: DUR, easing: "cubic-bezier(.42, 0, .25, 1)", fill: "forwards" });

  let done = false;
  const finish = () => { if (done) return; done = true; ghost.remove(); bumpCart(); };
  anim.onfinish = finish;
  anim.oncancel = () => { if (done) return; done = true; ghost.remove(); };
  // Safety net: cleanup even if onfinish is throttled (background tab, etc.)
  window.setTimeout(finish, DUR + 200);
}

// === View definitions ===
const VIEWS = [
  { id: "smart",    label: "Smart",    icon: "Sparkles" },
  { id: "bundles",  label: "Bundles",  icon: "Package" },
  { id: "previous", label: "Previous", icon: "RefreshCw" },
  { id: "visit",    label: "Visit",    icon: "Stethoscope" },
  { id: "lab",      label: "Lab",      icon: "FlaskConical" },
  { id: "imaging",  label: "Imaging",  icon: "Scan" },
  { id: "ecg",      label: "ECG",      icon: "Activity" },
  { id: "vitals",   label: "Vitals",   icon: "Heart" },
  { id: "telecon",  label: "Telecon",  icon: "Video" },
];

// === Bundles — curated multi-test packages defined by the medical director ===
//   The value prop is curation + speed: clinical-guideline-aligned sets that take
//   one click instead of five. The pricing is the honest sum of included tests
//   (no fake "save N%" — the lift comes from completeness, not discount theatre).
//   Edit this list when MD updates the standard packages.
//
const BUNDLES = [
  {
    id: "annual-physical",
    name: "Annual physical",
    purpose: "Routine yearly check-up",
    testIds: ["visit-gp", "cbc", "glucose", "lipid", "urinalysis", "vit-bp", "vit-bmi"],
    why: "Standard adult yearly screen — covers GP visit, baseline blood work, urine, and vitals.",
  },
  {
    id: "diabetes-followup",
    name: "Diabetes follow-up",
    purpose: "Known T2D, 3-month review",
    testIds: ["hba1c", "glucose", "lipid", "urinalysis", "kft"],
    why: "Tracks HbA1c trend plus end-organ markers (kidney + lipids) per ADA follow-up guidance.",
  },
  {
    id: "cardiac-risk",
    name: "Cardiac risk screen",
    purpose: "Chest pain or family history",
    testIds: ["visit-gp", "ecg-12", "lipid", "vit-bp", "cbc"],
    why: "First-line cardiac workup — ECG plus modifiable-risk markers for the GP review.",
  },
  {
    id: "preemployment",
    name: "Pre-employment / school",
    purpose: "Fitness certificate",
    testIds: ["visit-gp", "cbc", "urinalysis", "xray-chest", "vit-bp", "vit-bmi"],
    why: "Standard fitness-to-work / fitness-to-attend documentation set.",
  },
];

function buildBundleRows({ inCart }) {
  return BUNDLES.map(b => {
    const items = b.testIds.map(id => ORDER_CATALOG.find(c => c.id === id)).filter(Boolean);
    const price = items.reduce((s, it) => s + (it.price || 0), 0);
    const remaining = items.filter(it => !inCart.has(it.id));
    return {
      id: b.id,
      name: b.name,
      purpose: b.purpose,
      why: b.why,
      items,
      price,
      remainingCount: remaining.length,
      addedCount: items.length - remaining.length,
      allInCart: remaining.length === 0,
    };
  });
}

// === Row builder — produces uniform shape regardless of source ===
//   { id, name, price, kind, badges: { ai, previous, sensitive, popular, reason } }
//
function useRows({ view, search, patient, buckets, priors, inCart }) {
  return useMemo(() => {
    const aiMap = new Map();
    buckets.forEach(b => b.items.forEach(it => {
      // keep the highest-confidence reason if the same testId appears in multiple buckets
      const existing = aiMap.get(it.testId);
      const rank = (c) => ({ high: 3, medium: 2, low: 1 })[c] || 0;
      if (!existing || rank(it.confidence) > rank(existing.confidence)) {
        aiMap.set(it.testId, it);
      }
    }));
    const priorMap = new Map(priors.map(p => [p.testId, p]));

    const decorate = (catItem, extra = {}) => {
      const ai = aiMap.get(catItem.id);
      const prior = priorMap.get(catItem.id);
      const info = TEST_INFO[catItem.id] || null;
      let reason = ai?.reason || null;
      if (!reason && prior) {
        reason = `Previously ordered on ${prior.visitDate}. Re-testing now lets the doctor compare against that baseline.${prior.sensitive ? " Sensitive — patient must approve viewing." : ""}`;
      }
      return {
        id: catItem.id,
        name: catItem.name,
        price: catItem.price,
        kind: catItem.kind,
        inCart: inCart.has(catItem.id),
        badges: {
          ai: ai?.confidence,
          previous: prior?.visitDate,
          sensitive: prior?.sensitive || extra.sensitive,
          popular: catItem.popular,
          reason,
          details: info,
        },
      };
    };

    let rows = [];

    if (view === "smart") {
      // Priors first (most personal signal), then AI items not already shown
      const seen = new Set();
      for (const p of priors) {
        const cat = ORDER_CATALOG.find(c => c.id === p.testId);
        if (!cat) continue;
        rows.push(decorate(cat));
        seen.add(p.testId);
      }
      for (const item of aiMap.values()) {
        if (seen.has(item.testId)) continue;
        const cat = ORDER_CATALOG.find(c => c.id === item.testId);
        if (!cat) continue;
        rows.push(decorate(cat));
        seen.add(item.testId);
      }
    } else if (view === "previous") {
      for (const p of priors) {
        const cat = ORDER_CATALOG.find(c => c.id === p.testId);
        if (!cat) continue;
        rows.push(decorate(cat));
      }
    } else {
      // catalogue by kind
      const items = ORDER_CATALOG.filter(c => c.kind === view);
      rows = items.map(c => decorate(c));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q));
    }

    return rows;
  }, [view, search, buckets, priors, inCart]);
}

// === Per-row badges ===
function BadgeAI({ conf }) {
  return <span className={"atp-badge atp-badge-ai atp-badge-ai-" + conf} title={`AI suggested · ${conf} confidence`}>{conf}</span>;
}
function BadgePrev({ date }) {
  return <span className="atp-badge atp-badge-prev" title={`Last tested ${date}`}>last {date}</span>;
}
function BadgeSensitive() {
  return <span className="atp-badge atp-badge-sensitive" title="Sensitive — OTP required to view"><I.Lock size={9} /> sensitive</span>;
}
function BadgePopular() {
  return <span className="atp-badge atp-badge-popular">popular</span>;
}

// === BundleRow — multi-test package, distinct visual treatment from TestRow ===
function BundleRow({ bundle, ccy, inCart, onAddBundle }) {
  const { name, purpose, why, items, price, allInCart, addedCount, remainingCount } = bundle;
  return (
    <div className={"atp-bundle" + (allInCart ? " is-incart" : "")}>
      <div className="atp-bundle-head">
        <div className="atp-bundle-name-block">
          <div className="atp-bundle-name">
            <I.Package size={12} className="atp-bundle-icon" />
            <span>{name}</span>
            <span className="atp-bundle-count">{items.length} tests</span>
          </div>
          <div className="atp-bundle-purpose">{purpose}</div>
        </div>
        <span className="atp-bundle-price">{fmtPrice(price, ccy)}</span>
        {allInCart ? (
          <span className="atp-bundle-added"><I.Check size={11} strokeWidth={3} /> All added</span>
        ) : (
          <button type="button" className="atp-bundle-add" onClick={() => onAddBundle(bundle)}>
            <I.Plus size={11} /> {addedCount > 0 ? `Add ${remainingCount} more` : "Add bundle"}
          </button>
        )}
      </div>
      <div className="atp-bundle-tests">
        {items.map(it => (
          <span
            key={it.id}
            className={"atp-bundle-pill" + (inCart.has(it.id) ? " is-in-cart" : "")}
            title={inCart.has(it.id) ? `${it.name} — already in cart` : it.name}
          >
            {inCart.has(it.id) && <I.Check size={8} strokeWidth={3} />}
            {it.name}
          </span>
        ))}
      </div>
      <div className="atp-bundle-why">
        <I.Sparkles size={10} />
        <span>{why}</span>
      </div>
    </div>
  );
}

// === TestRow — the universal row ===
function TestRow({ row, picked, highlighted, onTogglePick, onAdd, whyOpen, onToggleWhy, t, ccy }) {
  const { id, name, price, inCart, badges } = row;
  const hasReason = !!badges.reason || !!badges.details;
  return (
    <div
      data-row-id={id}
      className={"atp-row" + (picked ? " is-picked" : "") + (inCart ? " is-incart" : "") + (highlighted ? " is-highlighted" : "")}
    >
      <button
        type="button"
        className="atp-check"
        onClick={() => !inCart && onTogglePick(id)}
        disabled={inCart}
        aria-checked={picked}
        role="checkbox"
        aria-label={picked ? "Deselect" : "Select"}
      >
      </button>

      <div className="atp-row-name">
        <span className="atp-name">{name}</span>
        <div className="atp-badges">
          {badges.ai && <BadgeAI conf={badges.ai} />}
          {badges.previous && <BadgePrev date={badges.previous} />}
          {badges.sensitive && <BadgeSensitive />}
          {badges.popular && !badges.ai && !badges.previous && <BadgePopular />}
        </div>
      </div>

      <span className="atp-price">{fmtPrice(price, ccy)}</span>

      {inCart ? (
        <span className="atp-incart"><I.Check size={10} strokeWidth={3} /> {t("atp.added")}</span>
      ) : (
        <button type="button" className="atp-add-btn" onClick={() => onAdd(row)}>
          <I.Plus size={10} /> {t("atp.add")}
        </button>
      )}

      {hasReason && (
        <button
          type="button"
          className={"atp-why-btn" + (whyOpen ? " is-on" : "")}
          onClick={() => onToggleWhy(id)}
          title={whyOpen ? "Hide reason" : "Show AI reason"}
          aria-expanded={whyOpen}
        >
          <I.Info size={11} />
        </button>
      )}

      {whyOpen && hasReason && (
        <div className="atp-why">
          <WhyCard reason={badges.reason} details={badges.details} />
        </div>
      )}
    </div>
  );
}

// === Main panel ===
export function AddTestsPanel({ patient, onAdd, onPushToast, ccy = "USD", onCcyToggle }) {
  const t = useLang();
  const buckets = useAIRecommendations(patient);
  const priors = patient.priorResults || [];
  const inCart = useMemo(() => new Set((patient.cart?.items || []).map(i => i.id)), [patient.cart]);

  // Visibility signals — decide which tabs are shown.
  const aiTotal = buckets.reduce((n, b) => n + b.items.length, 0);
  const hasSmartSignal = priors.length > 0 || aiTotal > 0;
  const isNewPatient = priors.length === 0;

  const visibleViews = useMemo(() => VIEWS.filter(v => {
    if (v.id === "smart" && !hasSmartSignal) return false;
    if (v.id === "previous" && priors.length === 0) return false;
    // Visit tab is hidden for new patients — keep it pure catalogue browse
    // for returning patients who actually have prior visit context.
    if (v.id === "visit" && isNewPatient) return false;
    return true;
  }), [hasSmartSignal, priors.length, isNewPatient]);

  const defaultView = hasSmartSignal ? "smart" : "lab";
  const [view, setView] = useState(defaultView);
  const [search, setSearch] = useState("");
  const [picks, setPicks] = useState(new Set());
  const [whyOpenId, setWhyOpenId] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const searchRef = useRef(null);
  const rowsRef = useRef(null);

  // If active view becomes hidden (e.g. after data update) reset to Lab.
  useEffect(() => {
    if (!visibleViews.find(v => v.id === view)) setView("lab");
  }, [visibleViews, view]);

  const rows = useRows({ view, search, patient, buckets, priors, inCart });
  const bundleRows = useMemo(() => {
    const all = buildBundleRows({ inCart });
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(b =>
      b.name.toLowerCase().includes(q) ||
      b.purpose.toLowerCase().includes(q) ||
      b.items.some(it => it.name.toLowerCase().includes(q))
    );
  }, [inCart, search]);

  // counts per view tab — small numerical hint that helps the user choose
  const counts = useMemo(() => {
    const out = {};
    out.smart = (() => {
      const s = new Set();
      priors.forEach(p => s.add(p.testId));
      buckets.forEach(b => b.items.forEach(i => s.add(i.testId)));
      return s.size;
    })();
    out.bundles = BUNDLES.length;
    out.previous = priors.length;
    ["visit","lab","imaging","ecg","vitals","telecon"].forEach(k => {
      out[k] = ORDER_CATALOG.filter(c => c.kind === k).length;
    });
    return out;
  }, [buckets, priors]);

  const togglePick = useCallback((id) => {
    setPicks(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);
  const toggleWhy = useCallback((id) => {
    setWhyOpenId(prev => prev === id ? null : id);
  }, []);

  const addOne = (row) => {
    const sourceEl = rowsRef.current?.querySelector(`[data-row-id="${row.id}"]`);
    flyToCart(sourceEl, { name: row.name, kind: row.kind });
    onAdd?.([{ testId: row.id, name: row.name, price: row.price, kind: row.kind }]);
    onPushToast?.(`${row.name} added`, "success");
  };
  const addPicks = () => {
    if (picks.size === 0) return;
    const items = rows.filter(r => picks.has(r.id) && !r.inCart)
      .map(r => ({ testId: r.id, name: r.name, price: r.price, kind: r.kind }));
    items.forEach((it, i) => {
      const el = rowsRef.current?.querySelector(`[data-row-id="${it.testId}"]`);
      if (i === 0) flyToCart(el, { name: it.name, kind: it.kind });
      else window.setTimeout(() => flyToCart(el, { name: it.name, kind: it.kind }), i * 75);
    });
    onAdd?.(items);
    onPushToast?.(`${items.length} test${items.length > 1 ? "s" : ""} added`, "success");
    setPicks(new Set());
  };
  const orderSameAsLast = (e) => {
    if (priors.length === 0) return;
    const items = priors
      .filter(p => !inCart.has(p.testId))
      .map(p => ({ testId: p.testId, name: p.testName, price: p.price, kind: "lab" }));
    if (items.length === 0) {
      onPushToast?.("All previous tests already in cart", "error");
      return;
    }
    const fallback = e?.currentTarget;
    items.forEach((it, i) => {
      const el = rowsRef.current?.querySelector(`[data-row-id="${it.testId}"]`) || fallback;
      window.setTimeout(() => flyToCart(el, { name: it.name, kind: it.kind }), i * 70);
    });
    onAdd?.(items);
    onPushToast?.(`${items.length} test${items.length > 1 ? "s" : ""} re-ordered`, "success");
  };

  const addBundle = (bundle) => {
    const items = bundle.items
      .filter(it => !inCart.has(it.id))
      .map(it => ({ testId: it.id, name: it.name, price: it.price, kind: it.kind }));
    if (items.length === 0) {
      onPushToast?.("All bundle tests already in cart", "error");
      return;
    }
    // Toss them out of the bundle card itself so the user sees a clean visual.
    const sourceEl = rowsRef.current?.querySelector(`[data-bundle-id="${bundle.id}"]`);
    items.forEach((it, i) => {
      window.setTimeout(() => flyToCart(sourceEl, { name: it.name, kind: it.kind }), i * 80);
    });
    onAdd?.(items);
    onPushToast?.(`${bundle.name} added · ${items.length} test${items.length > 1 ? "s" : ""}`, "success");
  };

  const activeView = VIEWS.find(v => v.id === view) || VIEWS[0];
  const ActiveIcon = I[activeView.icon];

  // Keep highlight valid when rows change.
  useEffect(() => {
    if (rows.length === 0) { setHighlightId(null); return; }
    if (!rows.find(r => r.id === highlightId)) setHighlightId(rows[0].id);
  }, [rows, highlightId]);

  // Scroll the highlighted row into view.
  useEffect(() => {
    if (!highlightId || !rowsRef.current) return;
    const el = rowsRef.current.querySelector(`[data-row-id="${highlightId}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlightId]);

  // Global keyboard handler — only active while AddTestsPanel is mounted (Step 4).
  useEffect(() => {
    const handler = (e) => {
      const target = e.target;
      const tag = (target?.tagName || "").toLowerCase();
      const inSearch = target === searchRef.current;
      const isTyping = (tag === "input" || tag === "textarea" || target?.isContentEditable) && !inSearch;
      // Ignore key combos that include Cmd/Ctrl (besides our own shortcuts) when typing in non-search inputs
      if (isTyping) return;

      // / focuses search
      if (e.key === "/" && !inSearch) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      // Esc — staged clear
      if (e.key === "Escape") {
        if (whyOpenId) { e.preventDefault(); setWhyOpenId(null); return; }
        if (search) { e.preventDefault(); setSearch(""); return; }
        if (picks.size > 0) { e.preventDefault(); setPicks(new Set()); return; }
        if (inSearch) { e.preventDefault(); searchRef.current?.blur(); return; }
        return;
      }

      // Cmd/Ctrl+A — select all visible (not in cart)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setPicks(new Set(rows.filter(r => !r.inCart).map(r => r.id)));
        return;
      }

      // Number keys 1-9 — switch visible tabs (not when typing in search)
      if (!inSearch && /^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const idx = parseInt(e.key, 10) - 1;
        const tgt = visibleViews[idx];
        if (tgt) {
          e.preventDefault();
          setView(tgt.id);
          setSearch("");
          setWhyOpenId(null);
        }
        return;
      }

      // Arrows — navigate row highlight (works inside search too).
      // Blur the search on arrow nav so subsequent Space/Enter act on the
      // highlighted row instead of being typed into the input.
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (rows.length === 0) return;
        e.preventDefault();
        if (inSearch) searchRef.current?.blur();
        const idx = rows.findIndex(r => r.id === highlightId);
        const dir = e.key === "ArrowDown" ? 1 : -1;
        const next = idx === -1
          ? (dir === 1 ? 0 : rows.length - 1)
          : (idx + dir + rows.length) % rows.length;
        setHighlightId(rows[next].id);
        return;
      }

      // Space — toggle pick on highlighted row (not while typing in search)
      if (e.key === " " && !inSearch && highlightId) {
        e.preventDefault();
        const r = rows.find(x => x.id === highlightId);
        if (r && !r.inCart) togglePick(highlightId);
        return;
      }

      // Enter / Shift+Enter
      if (e.key === "Enter") {
        if (e.shiftKey) {
          // Shift+Enter — select-and-continue: toggle pick + move down
          if (highlightId) {
            e.preventDefault();
            const r = rows.find(x => x.id === highlightId);
            if (r && !r.inCart) togglePick(highlightId);
            const idx = rows.findIndex(x => x.id === highlightId);
            const next = idx === -1 ? 0 : (idx + 1) % rows.length;
            setHighlightId(rows[next]?.id || null);
          }
          return;
        }
        // Plain Enter
        if (picks.size > 0) {
          e.preventDefault();
          addPicks();
          return;
        }
        if (highlightId) {
          e.preventDefault();
          const r = rows.find(x => x.id === highlightId);
          if (r && !r.inCart) addOne(r);
          return;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <section className="card-soft atp">
      {/* Header — view tabs replace the old separate sections */}
      <header className="atp-head">
        <div className="atp-head-tabs" role="tablist">
          {visibleViews.map((v, i) => {
            const Ico = I[v.icon];
            const count = counts[v.id] || 0;
            const keyHint = i < 9 ? String(i + 1) : null;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                className={"atp-tab" + (view === v.id ? " is-active" : "") + (v.id === "smart" ? " is-smart" : "")}
                onClick={() => { setView(v.id); setSearch(""); setWhyOpenId(null); }}
                title={keyHint ? `${v.label} · ${count} · press ${keyHint}` : `${v.label} · ${count}`}
              >
                <Ico size={11} />
                <span className="atp-tab-label">{v.label}</span>
                {keyHint && <kbd className="atp-tab-key" aria-hidden="true">{keyHint}</kbd>}
              </button>
            );
          })}
        </div>
      </header>

      {/* Toolbar — search + contextual action */}
      <div className="atp-toolbar">
        <div className="atp-search">
          <I.Search size={11} className="atp-search-ico" />
          <input
            ref={searchRef}
            type="text"
            placeholder={`Search ${activeView.label.toLowerCase()}…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {!search && (
            <span className="atp-search-hint" aria-hidden="true"><Kbd>/</Kbd></span>
          )}
          {search && (
            <button type="button" className="atp-search-clear" onClick={() => setSearch("")}>
              <I.X size={10} />
            </button>
          )}
        </div>
        {view === "previous" && priors.length > 0 && (
          <button type="button" className="atp-toolbar-action" onClick={orderSameAsLast}>
            <I.RefreshCw size={11} /> Order same as last visit
          </button>
        )}
        {onCcyToggle && (
          <div className="atp-ccy" role="group" aria-label="Display currency">
            {["USD", "KHR"].map(c => (
              <button
                key={c}
                type="button"
                className={"atp-ccy-tab" + (ccy === c ? " is-active" : "")}
                onClick={() => onCcyToggle(c)}
                aria-pressed={ccy === c}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Keyboard hint strip — compact, single line */}
      <div className="atp-hints" aria-hidden="true">
        <span><Kbd>/</Kbd> search</span>
        <span><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
        <span><Kbd>Space</Kbd> select</span>
        <span><Kbd>Enter</Kbd> add</span>
        <span><Kbd>⇧</Kbd>+<Kbd>Enter</Kbd> add &amp; next</span>
        <span><Kbd>{MOD_LABEL}</Kbd>+<Kbd>A</Kbd> all</span>
        <span><Kbd>1</Kbd>–<Kbd>{visibleViews.length}</Kbd> tab</span>
        <span><Kbd>Esc</Kbd> clear</span>
      </div>

      {/* Rows — bundles render as cards; everything else uses the universal TestRow */}
      <div className={"atp-rows" + (view === "bundles" ? " is-bundles" : "")} ref={rowsRef}>
        {view === "bundles" ? (
          bundleRows.length === 0 ? (
            <div className="atp-empty">
              <I.Inbox size={16} />
              <span>{search ? "No bundles match your search" : "No bundles configured"}</span>
            </div>
          ) : (
            bundleRows.map(bundle => (
              <div key={bundle.id} data-bundle-id={bundle.id}>
                <BundleRow
                  bundle={bundle}
                  ccy={ccy}
                  inCart={inCart}
                  onAddBundle={addBundle}
                />
              </div>
            ))
          )
        ) : rows.length === 0 ? (
          <div className="atp-empty">
            <I.Inbox size={16} />
            <span>{search ? "No tests match your search" : "Nothing to show in this view"}</span>
          </div>
        ) : (
          rows.map(row => (
            <TestRow
              key={row.id}
              row={row}
              picked={picks.has(row.id)}
              highlighted={highlightId === row.id}
              onTogglePick={togglePick}
              onAdd={addOne}
              whyOpen={whyOpenId === row.id}
              onToggleWhy={toggleWhy}
              t={t}
              ccy={ccy}
            />
          ))
        )}
      </div>

      {/* Sticky pick-footer — only when picks > 0 */}
      {picks.size > 0 && (
        <footer className="atp-foot">
          <span className="atp-foot-count"><strong>{picks.size}</strong> selected</span>
          <button type="button" className="atp-foot-clear" onClick={() => setPicks(new Set())}>
            Clear
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={addPicks}>
            <I.Plus size={11} /> Add {picks.size} to cart
          </button>
        </footer>
      )}
    </section>
  );
}
