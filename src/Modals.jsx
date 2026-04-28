// === Modals + Toasts ===
import React, { useState, useEffect } from "react";
import { I } from "./icons";
import { CountryCodeSelect, MultiSelectSearch, VISIT_REASONS } from "./shared";

export function NewWalkInModal({ open, onClose, onCreate }) {
  const blank = { name: "", countryCode: "+855", phoneNumber: "", dob: "", visitReason: [], language: "Khmer", sexAtBirth: "" };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  useEffect(() => { if (open) { setForm(blank); setErrors({}); } }, [open]);
  if (!open) return null;
  const phoneEmpty = !form.phoneNumber || form.phoneNumber.trim().length < 6;
  const submit = () => {
    const e = {};
    if (!form.name) e.name = "Required";
    if (phoneEmpty) e.phone = "Invalid";
    if (!form.dob) e.dob = "Required";
    if (!form.sexAtBirth) e.sex = "Required";
    if (!form.visitReason || form.visitReason.length === 0) e.visitReason = "Select at least one";
    setErrors(e);
    if (Object.keys(e).length === 0) onCreate(form);
  };
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="between">
            <div>
              <h2>New Walk-in</h2>
              <p>Capture the minimum to issue a queue number, then send the intake link.</p>
            </div>
            <button className="icon-btn" onClick={onClose} style={{ width: 30, height: 30 }}><I.X size={14} /></button>
          </div>
        </div>
        <div className="modal-body">
          <div className="field-row" style={{ gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div className="field">
              <label className="label">Full name <span className="req">*</span></label>
              <input className={"input" + (errors.name ? " invalid" : "")} value={form.name} onChange={e => set("name", e.target.value)} placeholder="Patient full name" />
              {errors.name && <div className="help error">{errors.name}</div>}
            </div>
            <div className="field">
              <label className="label">Mobile <span className="req">*</span></label>
              <div style={{ display: "flex" }}>
                <CountryCodeSelect value={form.countryCode} onChange={v => set("countryCode", v)} />
                <input
                  className={"input" + (errors.phone ? " invalid" : "")}
                  value={form.phoneNumber}
                  onChange={e => set("phoneNumber", e.target.value.replace(/[^\d\s]/g, ""))}
                  placeholder="12 345 678"
                  style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, flex: 1 }}
                />
              </div>
              {errors.phone && <div className="help error">{errors.phone}</div>}
            </div>
          </div>
          <div className="field-row" style={{ gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div className="field">
              <label className="label">DOB <span className="req">*</span></label>
              <div className="input-wrap">
                <input className={"input" + (errors.dob ? " invalid" : "")} value={form.dob} onChange={e => set("dob", e.target.value)} placeholder="YYYY-MM-DD" style={{ paddingRight: 32 }} />
                <I.Calendar size={16} className="rico" />
              </div>
              {errors.dob && <div className="help error">{errors.dob}</div>}
            </div>
            <div className="field">
              <label className="label">Sex at birth <span className="req">*</span></label>
              <div className="input-wrap">
                <select className={"select" + (errors.sex ? " invalid" : "")} value={form.sexAtBirth} onChange={e => set("sexAtBirth", e.target.value)} style={{ paddingRight: 32, appearance: "none" }}>
                  <option value="">Select…</option>
                  <option>Female</option><option>Male</option><option>Intersex</option><option>Prefer not to say</option>
                </select>
                <I.ChevronDown size={14} className="rico" />
              </div>
              {errors.sex && <div className="help error">{errors.sex}</div>}
            </div>
          </div>
          <div className="field-row" style={{ gridTemplateColumns: "1fr", marginBottom: 14 }}>
            <div className="field">
              <label className="label">Visit reason <span className="req">*</span></label>
              <MultiSelectSearch
                value={form.visitReason}
                onChange={v => set("visitReason", v)}
                options={VISIT_REASONS}
                placeholder="Search and select reasons…"
                invalid={!!errors.visitReason}
              />
              {errors.visitReason && <div className="help error">{errors.visitReason}</div>}
            </div>
          </div>
          <div className="field" style={{ marginBottom: 8 }}>
            <label className="label">Language</label>
            <div className="input-wrap">
              <select className="select" value={form.language} onChange={e => set("language", e.target.value)} style={{ paddingRight: 32, appearance: "none" }}>
                <option>Khmer</option><option>English</option><option>Vietnamese</option><option>Thai</option><option>French</option><option>Korean</option>
              </select>
              <I.ChevronDown size={14} className="rico" />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={phoneEmpty} title={phoneEmpty ? "Phone required" : ""}>
            <I.Send size={15} /> Create & Send Link
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddServiceModal({ open, onClose, onAdd }) {
  const catalog = [
    { cat: "Blood",   items: [{ name: "CBC", price: 6 }, { name: "Glucose Fasting", price: 3 }, { name: "HbA1c", price: 8 }, { name: "Lipid Panel", price: 12 }, { name: "TSH", price: 9 }] },
    { cat: "Imaging", items: [{ name: "X-ray Chest", price: 15 }, { name: "X-ray Lumbar", price: 18 }, { name: "Ultrasound Abdomen", price: 32 }] },
    { cat: "Vitals",  items: [{ name: "ECG", price: 22 }, { name: "Vitamin D", price: 25 }, { name: "Blood Pressure", price: 0 }, { name: "Vision Test", price: 0 }] },
  ];
  const [q, setQ] = useState("");
  const [picks, setPicks] = useState([]);
  useEffect(() => { if (open) { setQ(""); setPicks([]); } }, [open]);
  if (!open) return null;
  const flat = catalog.flatMap(c => c.items.map(it => ({ ...it, cat: c.cat })))
    .filter(it => it.name.toLowerCase().includes(q.toLowerCase()));
  const toggle = (it) => {
    setPicks(p => p.find(x => x.name === it.name) ? p.filter(x => x.name !== it.name) : [...p, { ...it }]);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 600 }}>
        <div className="modal-head">
          <div className="between">
            <div>
              <h2>Add services</h2>
              <p>Search the catalog and select services to add to the order draft.</p>
            </div>
            <button className="icon-btn" onClick={onClose} style={{ width: 30, height: 30 }}><I.X size={14} /></button>
          </div>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)" }}>
            <div className="search" style={{ height: 38 }}>
              <I.Search size={15} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search service" />
            </div>
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto", padding: "4px 12px 12px" }}>
            {flat.length === 0 ? (
              <div className="empty"><div className="empty-ico"><I.Search size={20} /></div><h3>No matches</h3><p>Try a different keyword.</p></div>
            ) : flat.map((it, i) => {
              const picked = picks.find(p => p.name === it.name);
              return (
                <div key={i} onClick={() => toggle(it)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 7, cursor: "pointer", background: picked ? "var(--brand-50)" : "transparent" }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: "1.5px solid " + (picked ? "var(--brand-500)" : "var(--ink-300)"), background: picked ? "var(--brand-500)" : "white", display: "grid", placeItems: "center", color: "white" }}>
                    {picked && <I.Check size={11} strokeWidth={3} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)" }}>{it.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-500)" }}>{it.cat}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--ink-800)" }}>${it.price.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="modal-foot">
          <span style={{ fontSize: 12.5, color: "var(--ink-500)", marginRight: "auto" }}>{picks.length} selected</span>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={picks.length === 0} onClick={() => onAdd(picks)}>
            <I.Plus size={15} /> Add to order
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmConsentModal({ open, onClose, onConfirm, patient }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 480 }}>
        <div className="modal-head">
          <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: "var(--warn-50)", color: "var(--warn-600)", display: "grid", placeItems: "center" }}>
              <I.AlertTriangle size={18} />
            </span>
            Counter-sign consent
          </h2>
          <p>{patient?.name} declined the digital consent. Confirm in-person signature on paper to unblock.</p>
        </div>
        <div className="modal-body">
          <div style={{ padding: 14, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12.5, color: "var(--ink-700)", lineHeight: 1.5 }}>
            By confirming, you attest that the patient signed the printed consent form. The exception clears and the order proceeds to nurse handoff.
          </div>
          <label className="row" style={{ marginTop: 14, fontSize: 12.5, color: "var(--ink-700)" }}>
            <input type="checkbox" /> Patient signed in my presence
          </label>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm}>
            <I.Check size={15} /> Confirm & Unblock
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToastStack({ toasts, onClose }) {
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={"toast " + (t.tone || "success")}>
          {t.tone === "error" ? <I.AlertCircle size={18} className="t-ico" /> : <I.CheckCircle size={18} className="t-ico" />}
          <span>{t.text}</span>
          <button className="t-close" onClick={() => onClose(t.id)}><I.X size={14} /></button>
        </div>
      ))}
    </div>
  );
}
