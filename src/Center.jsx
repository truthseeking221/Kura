// === Center column: Fast Check-in (with QR scan step), Patient Stub, Order Draft ===
import React, { useState } from "react";
import { I } from "./icons";
import {
  QRScanCard,
  TelegramScanCard,
  MultiSelectSearch,
  CountryCodeSelect,
  VISIT_REASONS,
} from "./shared";

export function FastCheckIn({ patient, onUpdate, onSendLink, sending, sentFlash }) {
  const [errors, setErrors] = useState({});
  const [step2Open, setStep2Open] = useState(false);

  const update = (key, val) => {
    onUpdate({ ...patient, [key]: val });
  };

  const reasons = Array.isArray(patient.visitReason)
    ? patient.visitReason
    : (patient.visitReason ? [patient.visitReason] : []);

  const countryCode = patient.countryCode || "+855";
  const phoneNumber = patient.phoneNumber !== undefined
    ? patient.phoneNumber
    : (patient.mobile ? patient.mobile.replace(/^\+\d+\s?/, "") : "");

  const phoneEmpty = !phoneNumber || phoneNumber.trim().length < 6;

  const handleSend = () => {
    const e = {};
    if (!patient.name) e.name = "Required";
    if (phoneEmpty) e.phone = "Enter a valid mobile";
    if (!patient.dob) e.dob = "Required";
    if (reasons.length === 0) e.visitReason = "Select at least one";
    if (!patient.sexAtBirth) e.sex = "Required";
    setErrors(e);
    if (Object.keys(e).length === 0) onSendLink();
  };

  const setPhone = (val) => {
    onUpdate({ ...patient, phoneNumber: val, countryCode, mobile: countryCode + " " + val });
  };
  const setCountry = (cc) => {
    onUpdate({ ...patient, countryCode: cc, phoneNumber, mobile: cc + " " + phoneNumber });
  };

  const telegramScanned = !!patient.telegramHandle;
  const idScanned = !!patient.idScanned;
  const step2Visible = step2Open || idScanned || telegramScanned;

  const onIdScan = () => {
    onUpdate({
      ...patient,
      idScanned: true,
      idNumber: "012345678",
      name: patient.name || "Sokha Pich",
      dob: patient.dob || "1991-08-12",
      sexAtBirth: patient.sexAtBirth || "Female",
      identity: { ...patient.identity, verified: true },
    });
  };

  return (
    <div className="card">
      <div className="card-head" style={{ flexDirection: "column", alignItems: "flex-start", gap: 0, paddingBottom: 4 }}>
        <h2>Fast Check-in</h2>
        <p className="sub">Scan to auto-fill, or capture the minimum manually. Patient completes the rest on phone.</p>
      </div>

      {/* Step 1 — Scan (National ID primary, Telegram secondary) */}
      <div className="card-pad" style={{ paddingTop: 12, paddingBottom: 4 }}>
        <div style={{
          fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
          fontWeight: 650, color: "var(--ink-500)", marginBottom: 8,
        }}>Step 1 · Scan</div>
        <div className="scan-row" style={{ display: "flex", gap: 10 }}>
          <QRScanCard
            label="National ID"
            sub="Auto-fills name, DOB, sex"
            scanned={idScanned}
            scanData={idScanned ? `${patient.name || "—"} · ID ${patient.idNumber || ""}` : ""}
            onScan={onIdScan}
            onClear={() => onUpdate({ ...patient, idScanned: false, idNumber: "" })}
            accent={{ bg: "#f0eafd", fg: "#7a45ec" }}
            icon={I.Lock}
          />
          <TelegramScanCard
            patient={patient}
            onUpdate={onUpdate}
          />
        </div>
        {!idScanned && !telegramScanned && !step2Open && (
          <button
            type="button"
            onClick={() => setStep2Open(true)}
            style={{
              marginTop: 10,
              background: "transparent", border: "none", padding: 0,
              color: "var(--brand-600)", fontSize: 12.5, fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            Can't scan? Enter details manually <I.ChevronRight size={13} />
          </button>
        )}
      </div>

      <div className="card-pad" style={{ paddingTop: 14, display: step2Visible ? "block" : "none" }}>
        <div className="between" style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
            fontWeight: 650, color: "var(--ink-500)",
          }}>Step 2 · Confirm details</div>
          {!idScanned && !telegramScanned && (
            <button
              type="button"
              onClick={() => setStep2Open(false)}
              style={{
                background: "transparent", border: "none", padding: 0,
                color: "var(--ink-500)", fontSize: 11.5, fontWeight: 550,
                cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 3,
              }}
              title="Hide manual entry"
            >
              <I.ChevronUp size={13} /> Collapse
            </button>
          )}
        </div>

        <div className="field-row" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 14 }}>
          <div className="field">
            <label className="label">Full name <span className="req">*</span></label>
            <input
              className={"input" + (errors.name ? " invalid" : "")}
              value={patient.name || ""}
              onChange={e => update("name", e.target.value)}
              placeholder="Patient full name"
            />
            {errors.name && <div className="help error">{errors.name}</div>}
          </div>
          <div className="field">
            <label className="label">DOB <span className="req">*</span></label>
            <div className="input-wrap">
              <input
                className={"input" + (errors.dob ? " invalid" : "")}
                value={patient.dob || ""}
                onChange={e => update("dob", e.target.value)}
                placeholder="YYYY-MM-DD"
                style={{ paddingRight: 32 }}
              />
              <I.Calendar size={16} className="rico" />
            </div>
            {errors.dob && <div className="help error">{errors.dob}</div>}
          </div>
          <div className="field">
            <label className="label">Sex at birth <span className="req">*</span></label>
            <div className="input-wrap">
              <select
                className={"select" + (errors.sex ? " invalid" : "")}
                value={patient.sexAtBirth || ""}
                onChange={e => update("sexAtBirth", e.target.value)}
                style={{ paddingRight: 32, appearance: "none" }}
              >
                <option value="">Select…</option>
                <option>Female</option>
                <option>Male</option>
                <option>Intersex</option>
                <option>Prefer not to say</option>
              </select>
              <I.ChevronDown size={14} className="rico" />
            </div>
            {errors.sex && <div className="help error">{errors.sex}</div>}
          </div>
        </div>

        <div className="field-row" style={{ gridTemplateColumns: "1.2fr 1fr", marginBottom: 14 }}>
          <div className="field">
            <label className="label">Mobile <span className="req">*</span></label>
            <div style={{ display: "flex" }}>
              <CountryCodeSelect value={countryCode} onChange={setCountry} />
              <input
                className={"input" + (errors.phone ? " invalid" : "")}
                value={phoneNumber}
                onChange={e => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
                placeholder="12 345 678"
                style={{
                  borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
                  flex: 1,
                }}
              />
            </div>
            {errors.phone && <div className="help error">{errors.phone}</div>}
          </div>
          <div className="field">
            <label className="label">Language</label>
            <div className="input-wrap">
              <select
                className="select"
                value={patient.language || "English"}
                onChange={e => update("language", e.target.value)}
                style={{ paddingRight: 32, appearance: "none" }}
              >
                <option>English</option>
                <option>Khmer</option>
                <option>Vietnamese</option>
                <option>Thai</option>
                <option>French</option>
                <option>Korean</option>
              </select>
              <I.ChevronDown size={14} className="rico" />
            </div>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 16 }}>
          <label className="label">Visit reason <span className="req">*</span></label>
          <MultiSelectSearch
            value={reasons}
            onChange={v => update("visitReason", v)}
            options={VISIT_REASONS}
            placeholder="Search and select reasons…"
            invalid={!!errors.visitReason}
          />
          {errors.visitReason && <div className="help error">{errors.visitReason}</div>}
        </div>

        <div className="row" style={{ gap: 10 }}>
          <button
            className={"btn btn-primary" + (sentFlash ? " sent-pulse" : "")}
            onClick={handleSend}
            disabled={sending || phoneEmpty}
            title={phoneEmpty ? "Enter a phone number to send the intake link" : ""}
            style={{ flex: "0 0 auto", minWidth: 200 }}
          >
            {sending ? (<><span className="spinner" /> Sending link…</>)
              : sentFlash ? (<><I.Check size={16} /> Link sent</>)
              : (<><I.Send size={15} /> Send Intake Link</>)}
          </button>
          {phoneEmpty && (
            <span className="help" style={{ color: "var(--ink-500)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <I.AlertCircle size={13} /> Phone required to send link
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function PatientStub({ patient, onEdit }) {
  const idVerified = patient.identity.verified;
  return (
    <div className="card">
      <div className="card-head">
        <h2>Patient Stub</h2>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>
          <I.Edit size={13} /> Edit
        </button>
      </div>
      <div className="stub-grid">
        <div className="stub-cell">
          <div className="lab">Identity</div>
          <div className="val">
            {idVerified ? (
              <><I.CheckCircle size={16} style={{ color: "var(--success-500)" }} /> <span>Verified</span></>
            ) : (
              <><I.AlertCircle size={16} style={{ color: "var(--warn-500)" }} /> <span style={{ color: "var(--warn-600)" }}>Not verified</span></>
            )}
          </div>
        </div>
        <div className="stub-cell">
          <div className="lab">PWA Intake</div>
          <div className="val" style={{ flexDirection: "column", alignItems: "stretch", gap: 0 }}>
            <span style={{ fontSize: 12, color: "var(--ink-500)", fontWeight: 500 }}>{patient.pwaProgress}% complete</span>
            <div className="progress" style={{ marginTop: 8 }}>
              <div style={{ width: patient.pwaProgress + "%" }} />
            </div>
          </div>
        </div>
        <div className="stub-cell">
          <div className="lab">Queue Number</div>
          <div className="queue-num"><span className="q">Q -</span> {patient.queueNumber.replace("Q-", "")}</div>
        </div>
      </div>
      <div className="stub-grid" style={{ borderTop: "1px solid var(--border)", gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
        <div className="stub-cell">
          <div className="lab">Mobile</div>
          <div className="val" style={{ fontSize: 12.5, fontWeight: 550, color: "var(--ink-800)" }}>{patient.mobile}</div>
        </div>
        <div className="stub-cell">
          <div className="lab">DOB</div>
          <div className="val" style={{ fontSize: 12.5, fontWeight: 550, color: "var(--ink-800)" }}>{patient.dob}</div>
        </div>
        <div className="stub-cell">
          <div className="lab">Sex at birth</div>
          <div className="val" style={{ fontSize: 12.5, fontWeight: 550, color: "var(--ink-800)" }}>{patient.sexAtBirth || patient.gender}</div>
        </div>
        <div className="stub-cell">
          <div className="lab">Created</div>
          <div className="val" style={{ fontSize: 12.5, fontWeight: 550, color: "var(--ink-800)" }}>{patient.arrivedRaw}</div>
        </div>
      </div>
    </div>
  );
}

export function OrderDraft({ patient, onRemove, onAddService }) {
  const total = patient.services.reduce((s, x) => s + x.amount, 0);
  return (
    <div className="card">
      <div className="card-head">
        <h2>Order Draft</h2>
        <button className="btn btn-ghost btn-sm" onClick={onAddService} style={{ color: "var(--brand-600)", borderColor: "transparent" }}>
          <I.Plus size={13} /> Add service
        </button>
      </div>
      <div className="card-pad" style={{ paddingTop: 4, paddingBottom: 0 }}>
        <div className="chips">
          {patient.services.map((s, i) => (
            <span key={i} className="chip">
              {s.name}
              <button className="chip-x" onClick={() => onRemove(i)}><I.X size={11} /></button>
            </span>
          ))}
          {patient.services.length === 0 && (
            <span style={{ fontSize: 12.5, color: "var(--ink-500)" }}>No services yet — click Add service.</span>
          )}
        </div>
      </div>
      {patient.services.length > 0 && (
        <>
          <table className="order-table" style={{ marginLeft: "var(--card-pad)", marginRight: "var(--card-pad)", width: "calc(100% - 2*var(--card-pad))" }}>
            <thead>
              <tr>
                <th>Service</th>
                <th>Payer</th>
                <th>Status</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {patient.services.map((s, i) => (
                <tr key={i}>
                  <td style={{ color: "var(--ink-900)", fontWeight: 550 }}>{s.name}</td>
                  <td style={{ color: "var(--ink-700)" }}>{s.payer}</td>
                  <td>
                    <span className="status-cell" style={{
                      color: s.status === "draft" ? "var(--brand-600)"
                          : s.status === "ready" ? "var(--success-600)"
                          : s.status === "blocked" ? "var(--danger-500)"
                          : "var(--ink-600)"
                    }}>
                      <span className="dot" /> {s.status[0].toUpperCase() + s.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 550 }}>${s.amount.toFixed(2)}</td>
                  <td><button className="row-act" onClick={() => onRemove(i)}><I.MoreHorizontal size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="estimated">
            <span className="muted">Estimated total</span>
            <span className="total">${total.toFixed(2)}</span>
          </div>
        </>
      )}
    </div>
  );
}
