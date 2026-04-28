// === Right rail: Payer Model, Required Documents, Patient PWA log, Handoff ===
import React from "react";
import { I } from "./icons";
import { payerOptions } from "./data";

export function PayerModel({ patient, onSelect }) {
  return (
    <div className="card card-pad">
      <h2 style={{ margin: 0, fontSize: "var(--font-lg)", fontWeight: 650, color: "var(--ink-900)", letterSpacing: "-0.01em", marginBottom: 12 }}>Payer Model</h2>
      <div className="payer-grid">
        {payerOptions.map(p => {
          const Ico = I[p.icon];
          const active = patient.payer === p.id;
          return (
            <button
              key={p.id}
              className={"payer-card" + (active ? " active" : "")}
              onClick={() => onSelect(p.id)}
              type="button"
            >
              <Ico size={22} className="payer-icon" />
              <span className="payer-name">{p.name}</span>
            </button>
          );
        })}
      </div>
      <div className="payer-foot">
        {payerOptions.find(o => o.id === patient.payer)?.caption}
      </div>
    </div>
  );
}

export function RequiredDocuments({ patient, onView }) {
  const docs = [
    { key: "id",        name: "ID verified",    state: patient.documents.id },
    { key: "consent",   name: "Consent",        state: patient.documents.consent },
    { key: "insurance", name: "Insurance photo",state: patient.documents.insurance },
    { key: "receipt",   name: "Receipt",        state: patient.documents.receipt },
  ];
  return (
    <div className="card card-pad">
      <h2 style={{ margin: 0, fontSize: "var(--font-lg)", fontWeight: 650, color: "var(--ink-900)", letterSpacing: "-0.01em", marginBottom: 4 }}>Required Documents</h2>
      <div className="doc-list">
        {docs.map(d => {
          const ok = d.state === "ok";
          return (
            <div key={d.key} className="doc-row">
              <div className={"doc-check " + (ok ? "ok" : "pending")}>
                {ok ? <I.Check size={11} strokeWidth={2.5} /> : <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--ink-300)" }} />}
              </div>
              <div className="doc-name">{d.name}</div>
              <div className={"doc-status " + (ok ? "ok" : "pending")}>
                {ok ? "" : "Pending"}
              </div>
            </div>
          );
        })}
      </div>
      <button className="row" onClick={onView} style={{ marginTop: 12, color: "var(--brand-600)", fontSize: 12.5, fontWeight: 550, background: "transparent", border: "none", padding: 0, justifyContent: "space-between", width: "100%" }}>
        <span>View all documents</span>
        <I.ChevronRight size={14} />
      </button>
    </div>
  );
}

export function PatientPWA({ patient }) {
  const iconFor = (state) =>
    state === "ok" ? <I.CheckCircle size={16} style={{ color: "var(--success-500)" }} /> :
    state === "warn" ? <I.AlertCircle size={16} style={{ color: "var(--warn-500)" }} /> :
    state === "danger" ? <I.XCircle size={16} style={{ color: "var(--danger-500)" }} /> :
    <I.Clock size={16} style={{ color: "var(--ink-400)" }} />;
  return (
    <div className="card card-pad">
      <div className="between" style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: "var(--font-lg)", fontWeight: 650, color: "var(--ink-900)", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>Patient PWA</h2>
        <span style={{ fontSize: 11, color: "var(--ink-500)", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <I.Smartphone size={13} /> Live
        </span>
      </div>
      <div className="pwa-log">
        {patient.pwaLog.map((l, i) => (
          <div key={i} className="log-row">
            {iconFor(l.state)}
            <div className="log-text">{l.text}</div>
            <div className="log-time">{l.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Handoff({ patient }) {
  const steps = [
    { label: "Reception",   icon: "User",       sub: ["New", "Done", "Done", "Done"] },
    { label: "Patient PWA", icon: "Headset",    sub: ["Pending", "In progress", "Done", "Done"] },
    { label: "Nurse",       icon: "Stethoscope",sub: ["Pending", "Pending", "In progress", "Done"] },
    { label: "Lab",         icon: "Flask",      sub: ["Pending", "Pending", "Pending", "In progress"] },
  ];
  return (
    <div className="card card-pad">
      <h2 style={{ margin: 0, fontSize: "var(--font-lg)", fontWeight: 650, color: "var(--ink-900)", letterSpacing: "-0.01em", marginBottom: 4 }}>Handoff</h2>
      <div className="handoff">
        {steps.map((s, i) => {
          const Ico = I[s.icon];
          const state = patient.handoffStates[i] || "pending";
          const cls = state === "done" ? "done" : state === "in-progress" ? "active" : state === "blocked" ? "blocked" : "";
          return (
            <React.Fragment key={i}>
              <div className={"handoff-step " + cls}>
                <div className="h-icon">
                  <Ico size={18} />
                  {patient.handoff === i && <span className="h-num">{i + 1}</span>}
                </div>
                <div className="h-label">{s.label}</div>
                <div className="h-state">
                  {state === "done" ? "Done"
                    : state === "in-progress" ? "In progress"
                    : state === "blocked" ? "Blocked"
                    : i === 0 ? "New" : "Pending"}
                </div>
              </div>
              {i < steps.length - 1 && (
                <I.ArrowRight size={14} className="handoff-arrow" />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <button className="row" style={{ marginTop: 16, color: "var(--brand-600)", fontSize: 12.5, fontWeight: 550, background: "transparent", border: "none", padding: 0, justifyContent: "space-between", width: "100%" }}>
        <span>View full timeline</span>
        <I.ChevronRight size={14} />
      </button>
    </div>
  );
}
