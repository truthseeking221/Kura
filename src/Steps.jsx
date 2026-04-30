// === Steps.jsx — 4-step wizard content components ===
//   v2.1:
//
//   Step 1 (Identity): search returning patients + 3 capture methods (QR / NFC / Manual)
//   Step 2 (Review):   confirm captured details with field-locking + masked DOB
//   Step 3 (Insurance):manage insurance policies (default = no insurance)
//   Step 4 (Orders):   catalogue + AI side panel + previous tests + telehealth
//
//   Payment + check-in CTA live in the always-visible cart rail (no Step 5 panel).
//   Each step receives { patient, onUpdate, onNext, onPrev, onPushToast } and renders
//   inside the wizard shell. They share the sticky right cart (rendered by App).
//
import React, { useState, useEffect, useMemo, useRef } from "react";
import { I } from "./icons";
import { useLang, VISIT_REASON_KEYS, VISIT_REASON_POPULAR } from "./i18n";
import { ORDER_CATALOG } from "./OrderCart";
import { DisabledTooltip, VisitReasonPills, VISIT_REASONS, AuthorBadge, SLOT_OPTIONS, computeTatPlan, fmtTatHours } from "./shared";
import { LAB_CATALOG, LAB_CATEGORIES, INSURANCE_PROVIDERS } from "./data";
import { AddTestsPanel } from "./AddTestsPanel";
import { DateInput, GhostPlaceholder, formatByPattern, digitsOnly } from "./DateInput";
import scanQrIcon from "./assets/icons/identity-scan-qr.svg";
import idCardIcon from "./assets/icons/identity-id-card.svg";
import manualEntryIcon from "./assets/icons/identity-manual-entry.svg";
import intakePhoneFormIcon from "./assets/icons/intake-phone-form.svg";
import insuranceEmptyStateIcon from "./assets/icons/insurance-empty-state.svg";
import insurancePolicyIcon from "./assets/icons/insurance-policy.svg";
import directPayCheckIcon from "./assets/icons/direct-pay-check.svg";
import teleconsultationIcon from "./assets/icons/teleconsultation.svg";

const KHR_RATE = 4100;
const fmtCcy = (usd, ccy = "USD") => ccy === "KHR" ? "៛" + Math.round(usd * KHR_RATE).toLocaleString() : "$" + usd.toFixed(2);

// === Shared bits ===
function StepShell({ title, subtitle, right, children }) {
  return (
    <div className="step-shell">
      <header className="step-head">
        <div>
          <h1 className="step-title">{title}</h1>
          {subtitle && <p className="step-sub">{subtitle}</p>}
        </div>
        {right && <div className="step-head-right">{right}</div>}
      </header>
      <div className="step-body">{children}</div>
    </div>
  );
}

function StepFooter({ onPrev, onNext, nextLabel, nextDisabled, blockers, secondary }) {
  const t = useLang();
  return (
    <div className="step-footer">
      <div className="step-footer-left">
        {onPrev && (
          <button type="button" className="btn btn-ghost" onClick={onPrev}>
            <I.ChevronLeft size={13} /> {t("step.back")}
          </button>
        )}
        {secondary}
      </div>
      <div className="step-footer-right">
        {onNext && nextDisabled && blockers && blockers.length > 0 && (
          <span className="step-footer-blocker">
            <I.AlertCircle size={11} /> {blockers[0]}
          </span>
        )}
        {onNext && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onNext}
            disabled={nextDisabled}
          >
            {nextLabel || t("step.next")} <I.ChevronRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// STEP 1 — Identity
// =====================================================================
//   Search returning patient OR pick a capture method (QR / NFC / Manual).
//   QR/NFC auto-populate name+dob+sex+id and lock those fields.
//   Manual moves directly to Step 2 with empty form.
//
export function Step1Identity({ patient, onUpdate, onNext, onPushToast, allPatients = [], onSelectPatient, gate }) {
  const t = useLang();
  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [scanState, setScanState] = useState("idle"); // idle | scanning | done
  const [nfcAvailable] = useState(true); // mock — could be hardware probe
  const [recapturing, setRecapturing] = useState(false);
  const [recaptureConfirmOpen, setRecaptureConfirmOpen] = useState(false);

  // Revisit detection — if minimum identity is captured, the step's job becomes
  // "confirm + continue", not "capture from scratch". Step 2 already follows this
  // pattern (locked-field chips); Step 1 must mirror it on revisit.
  const captured = !!(patient.name && patient.dob && patient.sexAtBirth);
  const showCapturedHero = captured && !recapturing;

  const matches = useMemo(() => {
    if (!searchQ.trim()) return [];
    const q = searchQ.toLowerCase();
    return allPatients.filter(p =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.queueNumber || "").toLowerCase().includes(q) ||
      (p.phoneNumber || "").includes(q) ||
      (p.idNumber || "").includes(q)
    ).slice(0, 5);
  }, [searchQ, allPatients]);

  const handleQRScan = () => {
    setScanState("scanning");
    setTimeout(() => {
      setScanState("done");
      const data = {
        name: patient.name || "Maya Tran",
        dob: patient.dob || "1996-02-14",
        sexAtBirth: patient.sexAtBirth || "Female",
        idNumber: patient.idNumber || "012345678",
        idScanned: true,
        identity: {
          ...(patient.identity || {}),
          verified: true,
          source: "qr",
          lockedFields: ["name", "dob", "sexAtBirth", "idNumber"],
          scannedAt: new Date().toISOString(),
        },
      };
      onUpdate({ ...patient, ...data });
      onPushToast?.("National ID scanned — name, DOB, sex auto-filled & locked", "success");
      setTimeout(() => onNext(), 600);
    }, 1100);
  };

  const handleNFCRead = () => {
    if (!nfcAvailable) return;
    onPushToast?.("NFC reader simulating chip read…", "success");
    setTimeout(() => {
      onUpdate({
        ...patient,
        idScanned: true,
        identity: {
          ...(patient.identity || {}),
          verified: true,
          source: "chip",
          lockedFields: ["name", "dob", "sexAtBirth", "idNumber"],
          scannedAt: new Date().toISOString(),
        },
      });
      onPushToast?.("Chip read complete — fields locked", "success");
      setTimeout(() => onNext(), 600);
    }, 1100);
  };

  const handleManual = () => {
    onUpdate({
      ...patient,
      manualEntry: true,
      idScanned: false,
      identity: { ...(patient.identity || {}), verified: false, source: "manual", lockedFields: [] },
    });
    onPushToast?.("Manual entry — fill details in Step 2", "success");
    setTimeout(() => onNext(), 100);
  };

  const handleSelectExisting = (p) => {
    onSelectPatient?.(p.id);
    onPushToast?.(`Loaded ${p.name} · ${p.queueNumber}`, "success");
    setSearchQ("");
  };

  const sourceLabel = (() => {
    const s = patient.identity?.source;
    if (s === "qr") return "QR scan";
    if (s === "chip") return "NFC chip";
    if (s === "manual") return "Manual entry";
    return "Existing record";
  })();

  const sourceIcon = (() => {
    const s = patient.identity?.source;
    if (s === "qr") return I.Camera;
    if (s === "chip") return I.CreditCard;
    if (s === "manual") return I.Edit;
    return I.User;
  })();

  const fmtCapturedAt = (iso) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch { return null; }
  };

  const fmtDob = (iso) => {
    if (!iso) return "—";
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
  };

  const lockedCount = (patient.identity?.lockedFields || []).length;
  const capturedAt = fmtCapturedAt(patient.identity?.scannedAt);

  if (showCapturedHero) {
    const SourceIco = sourceIcon;
    return (
      <StepShell title={t("step1.title")} subtitle={t("step1.sub")}>
        <section className="id-captured-card">
          <div className="id-captured-head">
            <div className="id-captured-icon"><I.CheckCircle size={20} /></div>
            <div className="id-captured-titles">
              <div className="id-captured-eyebrow">Identity captured</div>
              <div className="id-captured-name">{patient.name}</div>
            </div>
            <button
              type="button"
              className="link-btn id-captured-recap"
              onClick={() => setRecaptureConfirmOpen(true)}
            >
              <I.RefreshCw size={11} /> Re-capture
            </button>
          </div>

          <dl className="id-captured-grid">
            <div className="id-captured-cell">
              <dt>Date of birth</dt>
              <dd>{fmtDob(patient.dob)}</dd>
            </div>
            <div className="id-captured-cell">
              <dt>Sex at birth</dt>
              <dd>{patient.sexAtBirth || "—"}</dd>
            </div>
            <div className="id-captured-cell">
              <dt>National ID</dt>
              <dd>{patient.idNumber || <span className="id-captured-muted">Not provided</span>}</dd>
            </div>
            <div className="id-captured-cell">
              <dt>Phone</dt>
              <dd>{patient.phoneNumber ? `${patient.countryCode || "+855"} ${patient.phoneNumber}` : <span className="id-captured-muted">Not provided</span>}</dd>
            </div>
          </dl>

          <div className="id-captured-meta">
            <span className="id-captured-chip">
              <SourceIco size={10} /> Captured via {sourceLabel}
              {capturedAt && <span className="id-captured-chip-sep"> · {capturedAt}</span>}
            </span>
            {lockedCount > 0 && (
              <span className="id-captured-chip id-captured-chip-locked">
                <I.Lock size={10} /> {lockedCount} field{lockedCount === 1 ? "" : "s"} locked
              </span>
            )}
            <span className="id-captured-hint">
              Edit details on Step 2 — locked fields require an unlock first.
            </span>
          </div>
        </section>

        {recaptureConfirmOpen && (
          <div className="unlock-confirm">
            <I.AlertTriangle size={12} className="unlock-confirm-ico" />
            <div className="unlock-confirm-body">
              <div className="unlock-confirm-title">Re-capture identity?</div>
              <div className="unlock-confirm-sub">
                You'll start over with QR / NFC / manual. Captured data stays until a new method overwrites it.
              </div>
            </div>
            <div className="unlock-confirm-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRecaptureConfirmOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => { setRecaptureConfirmOpen(false); setRecapturing(true); }}
              >
                Yes, re-capture
              </button>
            </div>
          </div>
        )}

        <StepFooter
          onNext={onNext}
          nextDisabled={!gate.step1Done}
          blockers={gate.blockers[1]}
        />
      </StepShell>
    );
  }

  return (
    <StepShell
      title={t("step1.title")}
      subtitle={t("step1.sub")}
      right={recapturing && captured ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRecapturing(false)}>
          <I.ChevronLeft size={11} /> Back to captured identity
        </button>
      ) : null}
    >
      {/* Search returning patients */}
      <section className="card-soft">
        <div className="search-wrap">
          <I.Search size={14} className="search-ico" />
          <input
            type="text"
            className="input search-input"
            placeholder={t("step1.search.placeholder")}
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            autoFocus
          />
          {searchQ && (
            <button type="button" className="search-clear" onClick={() => setSearchQ("")}>
              <I.X size={11} />
            </button>
          )}
        </div>
        {matches.length > 0 && (
          <div className="search-results">
            {matches.map(p => (
              <button key={p.id} type="button" className="search-result" onClick={() => handleSelectExisting(p)}>
                <span className="search-result-avatar">{p.initials}</span>
                <span className="search-result-info">
                  <span className="search-result-name">{p.name}</span>
                  <span className="search-result-meta">{p.queueNumber} · {p.dob} · {p.phoneNumber}</span>
                </span>
                <I.ArrowRight size={12} />
              </button>
            ))}
          </div>
        )}
        {searchQ.trim() && matches.length === 0 && (
          <div className="search-empty">
            <I.Inbox size={14} /> {t("step1.search.noMatch")}
          </div>
        )}
      </section>

      {/* OR divider */}
      <div className="step1-or">
        <span className="step1-or-line" />
        <span className="step1-or-text">{t("step1.or")}</span>
        <span className="step1-or-line" />
      </div>

      {/* Capture methods */}
      <div className="step1-methods">
        {/* QR */}
        <button
          type="button"
          className={"method-card" + (scanState === "scanning" ? " is-busy" : "")}
          onClick={handleQRScan}
          disabled={scanState === "scanning"}
        >
          <div className="method-card-ico method-card-ico-qr">
            <img className="method-card-icon-img" src={scanQrIcon} alt="" aria-hidden="true" />
            {scanState === "scanning" && <span className="method-spinner" />}
          </div>
          <div className="method-card-body">
            <div className="method-card-title">{t("step1.method.qr.title")}</div>
            <div className="method-card-sub">{t("step1.method.qr.sub")}</div>
          </div>
          <div className="method-card-cta">
            {scanState === "scanning" ? t("step1.method.scanning") : t("step1.method.start")}
          </div>
        </button>

        {/* NFC */}
        <button
          type="button"
          className={"method-card" + (!nfcAvailable ? " is-disabled" : "")}
          onClick={handleNFCRead}
          disabled={!nfcAvailable}
          title={!nfcAvailable ? t("step1.method.nfc.unavailable") : ""}
        >
          <div className="method-card-ico method-card-ico-nfc">
            <img className="method-card-icon-img" src={idCardIcon} alt="" aria-hidden="true" />
          </div>
          <div className="method-card-body">
            <div className="method-card-title">{t("step1.method.nfc.title")}</div>
            <div className="method-card-sub">
              {nfcAvailable ? t("step1.method.nfc.sub") : t("step1.method.nfc.unavailable")}
            </div>
          </div>
          <div className="method-card-cta">{t("step1.method.start")}</div>
        </button>

        {/* Manual */}
        <button type="button" className="method-card" onClick={handleManual}>
          <div className="method-card-ico method-card-ico-manual">
            <img className="method-card-icon-img" src={manualEntryIcon} alt="" aria-hidden="true" />
          </div>
          <div className="method-card-body">
            <div className="method-card-title">{t("step1.method.manual.title")}</div>
            <div className="method-card-sub">{t("step1.method.manual.sub")}</div>
          </div>
          <div className="method-card-cta">{t("step1.method.start")}</div>
        </button>
      </div>

      <StepFooter
        onNext={onNext}
        nextDisabled={!gate.step1Done}
        blockers={gate.blockers[1]}
      />
    </StepShell>
  );
}

// =====================================================================
// STEP 2 — Review & Confirm
// =====================================================================
function MaskedDob({ value, onChange, locked, error, placeholder = "DD MM YYYY" }) {
  const t = useLang();
  // Stored format: YYYY-MM-DD. Display format: DD MM YYYY
  const [draft, setDraft] = useState(() => stringFromIso(value));

  useEffect(() => {
    setDraft(stringFromIso(value));
  }, [value]);

  function stringFromIso(iso) {
    if (!iso) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso.replace(/-/g, " "); // fallback
    return `${m[3]} ${m[2]} ${m[1]}`;
  }

  function isoFromDigits(digits) {
    if (digits.length !== 8) return null;
    const dd = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    const yyyy = digits.slice(4, 8);
    return `${yyyy}-${mm}-${dd}`;
  }

  const handleChange = (e) => {
    if (locked) return;
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + " " + digits.slice(2);
    if (digits.length > 4) formatted = digits.slice(0, 2) + " " + digits.slice(2, 4) + " " + digits.slice(4);
    setDraft(formatted);

    if (digits.length === 8) {
      const iso = isoFromDigits(digits);
      if (iso) onChange(iso);
    } else if (digits.length === 0) {
      onChange("");
    }
  };

  const handleClear = () => {
    if (locked) return;
    setDraft("");
    onChange("");
  };

  return (
    <div className={"input-wrap masked-dob" + (locked ? " is-locked" : "") + (error ? " is-error" : "")}>
      <GhostPlaceholder value={locked ? "" : draft} pattern={locked ? "" : placeholder} padRight={30}>
        <input
          type="text"
          inputMode="numeric"
          className={"input ghost-input" + (error ? " invalid" : "") + (locked ? " is-locked" : "")}
          value={draft}
          onChange={handleChange}
          placeholder={locked ? placeholder : ""}
          readOnly={locked}
          maxLength={10}
          style={{ fontVariantNumeric: "tabular-nums", paddingRight: 30 }}
        />
      </GhostPlaceholder>
      {locked
        ? <I.Lock size={13} className="rico" style={{ color: "var(--ink-400)" }} />
        : (draft && <button type="button" className="dob-clear" onClick={handleClear}><I.X size={11} /></button>)
      }
    </div>
  );
}

// =====================================================================
// Visit details — clinical intake the patient owns from their phone,
// with a "fill on behalf" escape hatch for staff. Lives inside Step 2 so
// the receptionist sees the same form their patient sees on their device.
// =====================================================================
function Step2VisitDetails({ patient, onUpdate, onSendIntake, onPushToast, channelReady }) {
  const t = useLang();
  const [filling, setFilling] = useState(false);

  const fields = patient.visitDetails || {
    chiefComplaint: "", medicalHistory: "", medications: "", allergies: "", notes: "",
  };
  const authors = patient.visitDetailsAuthors || {};

  const reasonsLegacy = Array.isArray(patient.visitReason)
    ? patient.visitReason
    : (patient.visitReason ? [patient.visitReason] : []);
  const visitReason = Array.isArray(fields.visitReason) && fields.visitReason.length
    ? fields.visitReason
    : reasonsLegacy;

  const setField = (k, v) => onUpdate({
    ...patient,
    visitDetails: { ...fields, visitReason, [k]: v },
    visitDetailsAuthors: { ...authors, [k]: "nurse" },
  });

  // Five-section status feed — receptionist scans which intake bits the
  // patient has answered without opening the form. Order mirrors the form
  // below so the cursor jumps top-to-bottom on edit.
  const sections = [
    { key: "visitReason",    labelKey: "vd.visitReason",    filled: visitReason.length > 0,                      preview: visitReason.join(" · ") },
    { key: "chiefComplaint", labelKey: "vd.chiefComplaint", filled: !!(fields.chiefComplaint || "").trim(),     preview: fields.chiefComplaint },
    { key: "medicalHistory", labelKey: "vd.medicalHistory", filled: !!(fields.medicalHistory || "").trim(),     preview: fields.medicalHistory },
    { key: "medications",    labelKey: "vd.medications",    filled: !!(fields.medications || "").trim(),         preview: fields.medications },
    { key: "allergies",      labelKey: "vd.allergies",      filled: !!(fields.allergies || "").trim(),           preview: fields.allergies },
  ];
  const filledCount = sections.filter(s => s.filled).length;
  const total = sections.length;
  const allComplete = filledCount === total;
  const pwaSent = !!patient.pwaSent;

  const status = allComplete
    ? { tone: "success", labelKey: "vd.status.complete", Ico: I.CheckCircle }
    : filling
      ? { tone: "info", labelKey: "vd.status.filling", Ico: I.Edit }
      : pwaSent
        ? { tone: "warn", labelKey: filledCount > 0 ? "vd.status.inProgress" : "vd.status.waiting", Ico: I.Clock }
        : { tone: "muted", labelKey: "vd.status.notStarted", Ico: I.Clock };
  const StatusIco = status.Ico;

  const handleSend = () => {
    onUpdate({ ...patient, pwaSent: true, pwaSentAt: "just now" });
    onSendIntake?.();
  };
  const handleResend = () => {
    onUpdate({ ...patient, pwaSentAt: "just now" });
    onSendIntake?.();
    onPushToast?.(t("vd.resend"), "success");
  };

  const renderField = (key, labelKey, placeholderKey, multiline) => {
    const val = fields[key] || "";
    const hasVal = !!val.trim();
    return (
      <div className="field" style={{ gridColumn: multiline ? "1 / -1" : undefined }}>
        <label className="label" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {t(labelKey)}
          {authors[key] && hasVal && <AuthorBadge who={authors[key]} t={t} />}
        </label>
        {multiline ? (
          <textarea
            className="input"
            value={val}
            onChange={e => setField(key, e.target.value)}
            placeholder={t(placeholderKey)}
            rows={2}
            style={{ resize: "vertical", fontFamily: "inherit", padding: "8px 12px" }}
          />
        ) : (
          <input
            type="text"
            className="input"
            value={val}
            onChange={e => setField(key, e.target.value)}
            placeholder={t(placeholderKey)}
          />
        )}
      </div>
    );
  };

  return (
    <section className="card-soft">
      <div className="group-head">
        <h3 className="group-title">{t("vd.title")}</h3>
        <span className={"vd2-pill vd2-pill-" + status.tone}>
          <StatusIco size={10} />
          <span className="vd2-pill-count">{filledCount}/{total}</span>
          <span className="vd2-pill-sep">·</span>
          {t(status.labelKey)}
        </span>
      </div>

      {/* Context strip — three discrete states:
           1. Complete  → minimal inline meta + Edit (status pill already conveys "done")
           2. Awaiting  → patient is filling on their phone
           3. Idle      → not yet sent, offer Send link / Fill here */}
      {!filling && allComplete && (
        <div className="vd2-complete-meta">
          <span className="vd2-complete-meta-text">
            {patient.pwaSentAt
              ? <>{t("vd.sent")} {patient.pwaSentAt}</>
              : t("vd.subComplete")}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilling(true)}>
            <I.Edit size={11} /> {t("vd.editFields")}
          </button>
        </div>
      )}

      {!filling && !allComplete && pwaSent && (
        <div className="vd2-prompt vd2-prompt-sent">
          <div className="vd2-prompt-icon"><I.Smartphone size={14} /></div>
          <div className="vd2-prompt-body">
            <div className="vd2-prompt-title">{t("vd.subPatientCompletes")}</div>
            <div className="vd2-prompt-sub">
              {filledCount} / {total}
              {patient.pwaSentAt && <> · {t("vd.sent")} {patient.pwaSentAt}</>}
            </div>
          </div>
          <div className="vd2-prompt-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleResend}>
              <I.RefreshCw size={11} /> {t("vd.resend")}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilling(true)}>
              <I.Edit size={11} /> {t("vd.fillOnBehalf")}
            </button>
          </div>
        </div>
      )}

      {!filling && !allComplete && !pwaSent && (
        <div className="vd2-prompt">
          <div className="vd2-prompt-icon"><I.Smartphone size={14} /></div>
          <div className="vd2-prompt-body">
            <div className="vd2-prompt-title">{t("vd.heroTitle")}</div>
            <div className="vd2-prompt-sub">{t("vd.heroBody")}</div>
          </div>
          <div className="vd2-prompt-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setFilling(true)}
            >
              <I.Edit size={11} /> {t("vd.fillOnBehalf")}
            </button>
            <DisabledTooltip
              disabled={!channelReady}
              title={t("disabled.intake.title")}
              reasons={[t("disabled.intake.channel")]}
            >
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!channelReady}
                onClick={handleSend}
              >
                <I.Send size={11} /> {t("vd.sendIntakeLink")}
              </button>
            </DisabledTooltip>
          </div>
        </div>
      )}

      {/* Compact checklist — renders in all read-only states (idle, waiting,
         complete) so the receptionist always sees per-section status with
         previews. Replaces the prose inside the prompt above with a
         structured, status-aware view. */}
      {!filling && (
        <ul className="vd2-checklist" aria-label={t("vd.progress.title")}>
          {sections.map(s => (
            <li key={s.key} className={"vd2-check" + (s.filled ? " filled" : "")}>
              <span className="vd2-check-mark" aria-hidden="true">
                {s.filled && <I.Check size={9} strokeWidth={3} />}
              </span>
              <span className="vd2-check-label">{t(s.labelKey)}</span>
              {s.filled && s.preview ? (
                <span className="vd2-check-preview" title={s.preview}>{s.preview}</span>
              ) : (
                <span className="vd2-check-pending">{t("vd.progress.pending")}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {filling && (
        <>
          <div className="vd2-fill-bar">
            <span className="vd2-fill-bar-text">
              <I.Edit size={11} /> {t("vd.subFilling")}
            </span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setFilling(false)}
            >
              <I.Check size={11} /> {t("vd.done")}
            </button>
          </div>

          <div className="form-grid form-grid-2">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="label" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {t("vd.visitReason")} <span className="req">*</span>
                {authors.visitReason && visitReason.length > 0 && <AuthorBadge who={authors.visitReason} t={t} />}
              </label>
              <VisitReasonPills
                value={visitReason}
                onChange={v => setField("visitReason", v)}
                options={VISIT_REASON_KEYS.map((key, i) => ({
                  value: VISIT_REASONS[i],
                  label: t(key),
                  popular: VISIT_REASON_POPULAR.has(key),
                }))}
                placeholder={t("vd.visitReason")}
              />
            </div>
            {renderField("chiefComplaint", "vd.chiefComplaint", "vd.chiefComplaint.placeholder", true)}
            {renderField("medicalHistory", "vd.medicalHistory", "vd.medicalHistory.placeholder", true)}
            {renderField("medications", "vd.medications", "vd.medications.placeholder", false)}
            {renderField("allergies", "vd.allergies", "vd.allergies.placeholder", false)}
          </div>
        </>
      )}
    </section>
  );
}

export function Step2Review({ patient, onUpdate, onNext, onPrev, onPushToast, gate, onSendIntake }) {
  const t = useLang();
  const lockedFields = patient.identity?.lockedFields || [];
  const isLocked = (field) => lockedFields.includes(field);

  const [unlockConfirmOpen, setUnlockConfirmOpen] = useState(false);
  const [addrOpen, setAddrOpen] = useState(false);
  const [otpStep, setOtpStep] = useState(patient.otpVerified ? "verified" : "idle"); // idle | sending | sent | verified
  const [otpCode, setOtpCode] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [tgPanel, setTgPanel] = useState(patient.telegramVerified ? "verified" : "idle"); // idle | qr | verified
  const [errors, setErrors] = useState({});

  const update = (key, val) => onUpdate({ ...patient, [key]: val });
  const updateAddr = (key, val) => onUpdate({ ...patient, address: { ...(patient.address || {}), [key]: val } });

  // OTP timer
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const t = setTimeout(() => setOtpCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCountdown]);

  const handleSendOtp = () => {
    setOtpStep("sending");
    setTimeout(() => {
      setOtpStep("sent");
      setOtpCountdown(30);
      onPushToast?.("OTP sent to " + (patient.countryCode || "+855") + " " + patient.phoneNumber);
    }, 800);
  };

  const handleVerifyOtp = () => {
    if (otpCode.length !== 6) return;
    setOtpStep("verified");
    onUpdate({ ...patient, otpVerified: true, mobileVerifiedVia: "sms" });
    onPushToast?.("Mobile verified", "success");
  };

  const handleResetMobile = () => {
    setOtpStep("idle");
    setOtpCode("");
    onUpdate({ ...patient, otpVerified: false, mobileVerifiedVia: null });
  };

  const handleTgQr = () => {
    setTgPanel("qr");
    // mock: auto-verify after 2.5s
    setTimeout(() => {
      setTgPanel("verified");
      onUpdate({
        ...patient,
        telegramVerified: true,
        telegramHandle: patient.telegramHandle || "t.me/" + (patient.name || "patient").toLowerCase().replace(/\s+/g, ""),
        commMethod: patient.commMethod || "telegram",
      });
      onPushToast?.("Telegram verified", "success");
    }, 2500);
  };

  const handleTgReset = () => {
    setTgPanel("idle");
    onUpdate({ ...patient, telegramVerified: false, telegramHandle: "" });
  };

  const handleUnlock = () => {
    setUnlockConfirmOpen(false);
    onUpdate({
      ...patient,
      identity: { ...(patient.identity || {}), lockedFields: [] },
    });
    onPushToast?.("Fields unlocked — edits will be logged", "error");
  };

  const handleNext = () => {
    const e = {};
    if (!patient.name) e.name = "Required";
    if (!patient.dob) e.dob = "Required";
    if (!patient.sexAtBirth) e.sex = "Required";
    setErrors(e);
    if (Object.keys(e).length > 0) {
      onPushToast?.("Please complete required fields", "error");
      return;
    }
    onNext();
  };

  const phoneDigits = (patient.phoneNumber || "").replace(/\D/g, "").length;
  const phoneValid = phoneDigits >= 6;
  const tgVerified = !!patient.telegramVerified;
  const otpVerified = !!patient.otpVerified;

  return (
    <StepShell
      title={t("step2.title")}
      subtitle={t("step2.sub")}
      right={
        lockedFields.length > 0 && (
          <button type="button" className="btn btn-ghost btn-unlock" onClick={() => setUnlockConfirmOpen(true)}>
            <I.Unlock size={11} /> {t("step2.unlockFields")}
          </button>
        )
      }
    >
      {/* Identity group */}
      <section className="card-soft">
        <div className="group-head">
          <h3 className="group-title">{t("step2.identity")}</h3>
          {patient.identity?.source && (
            <span className="group-source">
              <I.ShieldCheck size={10} /> {t("step2.from." + patient.identity.source)}
            </span>
          )}
        </div>
        <div className="form-grid form-grid-3">
          <div className="field">
            <label className="label">{t("step2.fullNameLatin")} <span className="req">*</span></label>
            <input
              type="text"
              className={"input" + (errors.name ? " invalid" : "") + (isLocked("name") ? " is-locked" : "")}
              value={patient.name || ""}
              onChange={e => update("name", e.target.value)}
              placeholder={t("step2.fullNameLatin.ph")}
              readOnly={isLocked("name")}
            />
            {errors.name && <div className="help error">{errors.name}</div>}
          </div>
          <div className="field">
            <label className="label">{t("step2.fullNameKhmer")}</label>
            <input
              type="text"
              className={"input" + (isLocked("nameKhmer") ? " is-locked" : "")}
              value={patient.nameKhmer || ""}
              onChange={e => update("nameKhmer", e.target.value)}
              placeholder="សុខ ស្រីម៉ៅ"
              readOnly={isLocked("nameKhmer")}
            />
          </div>
          <div className="field">
            <label className="label">{t("step2.dob")} <span className="req">*</span></label>
            <MaskedDob
              value={patient.dob}
              onChange={(iso) => update("dob", iso)}
              locked={isLocked("dob")}
              error={!!errors.dob}
            />
            {errors.dob && <div className="help error">{errors.dob}</div>}
          </div>
          <div className="field">
            <label className="label">{t("step2.sexAtBirth")} <span className="req">*</span></label>
            <select
              className={"select" + (errors.sex ? " invalid" : "") + (isLocked("sexAtBirth") ? " is-locked" : "")}
              value={patient.sexAtBirth || ""}
              onChange={e => update("sexAtBirth", e.target.value)}
              disabled={isLocked("sexAtBirth")}
            >
              <option value="">{t("step2.sex.select")}</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
            {errors.sex && <div className="help error">{errors.sex}</div>}
          </div>
          <div className="field">
            <label className="label">{t("step2.idNumber")}</label>
            <input
              type="text"
              className={"input" + (isLocked("idNumber") ? " is-locked" : "")}
              value={patient.idNumber || ""}
              onChange={e => update("idNumber", e.target.value)}
              readOnly={isLocked("idNumber")}
            />
          </div>
          <div className="field">
            <label className="label">{t("step2.language")}</label>
            <select
              className="select"
              value={patient.language || "Khmer"}
              onChange={e => update("language", e.target.value)}
            >
              <option>Khmer</option>
              <option>English</option>
              <option>Vietnamese</option>
              <option>Thai</option>
              <option>French</option>
            </select>
          </div>
        </div>
      </section>

      {/* Contact channels */}
      <section className="card-soft">
        <div className="group-head">
          <h3 className="group-title">{t("step2.contactChannels")}</h3>
          <span className="group-hint">{t("step2.contactHint")}</span>
        </div>

        {/* Compact verified rows */}
        {(tgVerified || otpVerified) && (
          <div className="contact-verified-stack">
            {tgVerified && (
              <div className="contact-verified-row">
                <span className="contact-card-ico" style={{ color: "#229ed9" }}><I.Send size={13} /></span>
                <span className="contact-verified-name">Telegram</span>
                <span className="contact-verified-sep">·</span>
                <span className="contact-card-handle">{patient.telegramHandle || "—"}</span>
                <span className="contact-card-badge"><I.Check size={9} strokeWidth={3} /> {t("step2.verified")}</span>
                <button type="button" className="link-btn contact-verified-action" onClick={handleTgReset}>
                  {t("step2.changeHandle")}
                </button>
              </div>
            )}
            {otpVerified && (
              <div className="contact-verified-row">
                <span className="contact-card-ico" style={{ color: "#268cff" }}><I.MessageSquare size={13} /></span>
                <span className="contact-verified-name">SMS / Mobile</span>
                <span className="contact-verified-sep">·</span>
                <span className="contact-card-handle">
                  {(patient.countryCode || "+855")} {patient.phoneNumber || "—"}
                </span>
                <span className="contact-card-badge"><I.Check size={9} strokeWidth={3} /> {t("step2.verified")}</span>
                <button type="button" className="link-btn contact-verified-action" onClick={handleResetMobile}>
                  <I.Edit size={10} /> {t("step2.editToReverify")}
                </button>
              </div>
            )}
          </div>
        )}

        {(!tgVerified || !otpVerified) && (
        <div className={"contact-grid" + ((tgVerified || otpVerified) ? " is-single" : "")}>
          {/* Telegram (only when not verified) */}
          {!tgVerified && (
          <div className="contact-card">
            <div className="contact-card-head">
              <span className="contact-card-ico" style={{ color: "#229ed9" }}><I.Send size={13} /></span>
              <span className="contact-card-title">Telegram</span>
            </div>
            {tgPanel === "qr" ? (
              <div className="contact-card-body contact-card-qr">
                <div className="qr-mock"><I.Smartphone size={26} /></div>
                <div className="contact-card-help">{t("step2.tg.scanning")}</div>
              </div>
            ) : (
              <div className="contact-card-body">
                <div className="contact-card-help">{t("step2.tg.help")}</div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleTgQr}>
                  <I.Sparkles size={11} /> {t("step2.tg.startQR")}
                </button>
              </div>
            )}
          </div>
          )}

          {/* Mobile OTP (only when not verified) */}
          {!otpVerified && (
          <div className="contact-card">
            <div className="contact-card-head">
              <span className="contact-card-ico" style={{ color: "#268cff" }}><I.MessageSquare size={13} /></span>
              <span className="contact-card-title">SMS / Mobile</span>
            </div>
            <div className="contact-card-body">
              <div className="phone-row">
                <select
                  className="select"
                  value={patient.countryCode || "+855"}
                  onChange={e => update("countryCode", e.target.value)}
                  style={{ width: 72 }}
                >
                  <option>+855</option>
                  <option>+84</option>
                  <option>+66</option>
                  <option>+1</option>
                </select>
                <input
                  type="tel"
                  className="input"
                  value={patient.phoneNumber || ""}
                  onChange={e => update("phoneNumber", e.target.value.replace(/[^\d\s]/g, ""))}
                  placeholder="12 345 678"
                />
              </div>
              {otpStep === "sent" ? (
                <div className="otp-row">
                  <div className="otp-boxes">
                    {[0,1,2,3,4,5].map(i => (
                      <input
                        key={i}
                        className={"otp-box" + (otpCode[i] ? " has-val" : "")}
                        maxLength={1}
                        value={otpCode[i] || ""}
                        onChange={e => {
                          const v = e.target.value.replace(/\D/g, "").slice(-1);
                          const next = otpCode.split("");
                          next[i] = v;
                          const joined = next.join("").slice(0, 6);
                          setOtpCode(joined);
                          if (v && i < 5) {
                            const inputs = e.target.parentElement.querySelectorAll(".otp-box");
                            inputs[i + 1]?.focus();
                          }
                        }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleVerifyOtp}
                    disabled={otpCode.length !== 6}
                  >
                    {t("step2.verify")}
                  </button>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={handleSendOtp}
                    disabled={otpCountdown > 0}
                  >
                    {otpCountdown > 0 ? `${t("step2.resendIn")} ${otpCountdown}s` : t("step2.resend")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleSendOtp}
                  disabled={!phoneValid || otpStep === "sending"}
                >
                  {otpStep === "sending" ? t("step2.sending") : t("step2.sendOtp")}
                </button>
              )}
            </div>
          </div>
          )}
        </div>
        )}

        {/* Preferred channel */}
        {(tgVerified || otpVerified) && (
          <div className="comm-preferred">
            <span className="comm-preferred-label">{t("step2.preferredComm")}</span>
            <div className="seg">
              <button
                type="button"
                className={"seg-btn" + (patient.commMethod === "telegram" ? " is-on" : "")}
                onClick={() => update("commMethod", "telegram")}
                disabled={!tgVerified}
              >
                <I.Send size={10} /> Telegram
              </button>
              <button
                type="button"
                className={"seg-btn" + (patient.commMethod === "sms" ? " is-on" : "")}
                onClick={() => update("commMethod", "sms")}
                disabled={!otpVerified}
              >
                <I.MessageSquare size={10} /> SMS
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Visit details — clinical intake the patient owns
         (or that staff can fill on behalf when the patient can't). */}
      <Step2VisitDetails
        patient={patient}
        onUpdate={onUpdate}
        onSendIntake={onSendIntake}
        onPushToast={onPushToast}
        channelReady={tgVerified || otpVerified}
      />

      {/* Address (collapsed by default) */}
      <section className="card-soft">
        <button type="button" className="addr-toggle" onClick={() => setAddrOpen(o => !o)}>
          <I.Home size={12} />
          <span className="addr-toggle-title">{t("step2.address")}</span>
          <span className="addr-toggle-hint">{t("step2.address.optional")}</span>
          <I.ChevronDown size={11} className={"addr-toggle-chev" + (addrOpen ? " open" : "")} />
        </button>
        {addrOpen && (
          <div className="addr-body">
            <div className="addr-help">{t("step2.address.help")}</div>
            <div className="form-grid form-grid-2">
              <div className="field">
                <label className="label">{t("step2.address.province")}</label>
                <input className="input" value={patient.address?.province || ""} onChange={e => updateAddr("province", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">{t("step2.address.district")}</label>
                <input className="input" value={patient.address?.district || ""} onChange={e => updateAddr("district", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">{t("step2.address.commune")}</label>
                <input className="input" value={patient.address?.commune || ""} onChange={e => updateAddr("commune", e.target.value)} />
              </div>
              <div className="field">
                <label className="label">{t("step2.address.village")}</label>
                <input className="input" value={patient.address?.village || ""} onChange={e => updateAddr("village", e.target.value)} />
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label className="label">{t("step2.address.street")}</label>
                <input className="input" value={patient.address?.street || ""} onChange={e => updateAddr("street", e.target.value)} placeholder="House #, street name" />
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label className="label">{t("step2.address.notes")}</label>
                <textarea
                  className="input"
                  value={patient.address?.notes || ""}
                  onChange={e => updateAddr("notes", e.target.value)}
                  placeholder={t("step2.address.notes.ph")}
                  rows={2}
                  style={{ resize: "vertical", fontFamily: "inherit", padding: "8px 12px" }}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Unlock confirm */}
      {unlockConfirmOpen && (
        <div className="unlock-confirm">
          <I.AlertTriangle size={12} className="unlock-confirm-ico" />
          <div className="unlock-confirm-body">
            <div className="unlock-confirm-title">{t("step2.unlock.title")}</div>
            <div className="unlock-confirm-sub">{t("step2.unlock.sub")}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUnlockConfirmOpen(false)}>
            {t("step2.unlock.cancel")}
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={handleUnlock}>
            {t("step2.unlock.confirm")}
          </button>
        </div>
      )}

      <StepFooter
        onPrev={onPrev}
        onNext={handleNext}
        nextDisabled={!gate.step2Done}
        blockers={gate.blockers[2]}
      />
    </StepShell>
  );
}

// =====================================================================
// STEP 3 — Insurance
// =====================================================================
export function Step3Insurance({ patient, onUpdate, onNext, onPrev, onPushToast, gate }) {
  const t = useLang();
  const policies = patient.insurance || [];
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ provider: "", policyNumber: "", memberName: patient.name || "", memberId: "", expiry: "", coverage: "Outpatient", cardAttached: false });

  const handleAddPolicy = () => {
    if (!draft.provider || !draft.policyNumber) {
      onPushToast?.("Provider and policy number required", "error");
      return;
    }
    const newP = { id: "ins-" + Date.now(), ...draft };
    onUpdate({ ...patient, insurance: [...policies, newP], insuranceAcked: true });
    setAdding(false);
    setDraft({ provider: "", policyNumber: "", memberName: patient.name || "", memberId: "", expiry: "", coverage: "Outpatient", cardAttached: false });
    onPushToast?.(`${draft.provider} policy added`, "success");
  };

  const handleRemovePolicy = (id) => {
    onUpdate({ ...patient, insurance: policies.filter(p => p.id !== id) });
    onPushToast?.("Policy removed", "error");
  };

  const handleNoInsurance = () => {
    onUpdate({ ...patient, insuranceAcked: true });
    onPushToast?.("Marked as direct pay");
  };

  const handleScanCard = () => {
    onPushToast?.("Card scan simulated — autofilled");
    setAdding(true);
    setDraft({
      provider: INSURANCE_PROVIDERS[0],
      policyNumber: "FT-" + Math.floor(Math.random() * 100000000).toString().padStart(8, "0"),
      memberName: patient.name || "",
      memberId: "M-" + Math.floor(Math.random() * 10000000).toString(),
      expiry: "12/2027",
      coverage: "Outpatient",
      cardAttached: true,
    });
  };

  const handleUndoDirect = () => {
    onUpdate({ ...patient, insuranceAcked: false });
  };

  return (
    <StepShell title={t("step3.title")} subtitle={t("step3.sub")}>
      {policies.length === 0 && !adding && patient.insuranceAcked ? (
        <section className="card-soft step3-direct">
          <div className="step3-direct-ico">
            <img className="step3-direct-icon-img" src={directPayCheckIcon} alt="" aria-hidden="true" />
          </div>
          <div className="step3-direct-text">
            <div className="step3-direct-title">{t("step3.direct.title")}</div>
            <div className="step3-direct-sub">{t("step3.directPay")}</div>
          </div>
          <button type="button" className="step3-direct-undo" onClick={handleUndoDirect}>
            {t("step3.direct.undo")}
          </button>
        </section>
      ) : policies.length === 0 && !adding ? (
        <section className="card-soft step3-empty">
          <div className="step3-empty-ico">
            <img className="step3-empty-icon-img" src={insuranceEmptyStateIcon} alt="" aria-hidden="true" />
          </div>
          <div className="step3-empty-title">{t("step3.empty.title")}</div>
          <div className="step3-empty-sub">{t("step3.empty.sub")}</div>
          <div className="step3-empty-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setAdding(true)}>
              <I.Plus size={12} /> {t("step3.add")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleScanCard}>
              <I.Camera size={12} /> {t("step3.scanCard")}
            </button>
            <button type="button" className="btn btn-primary" onClick={handleNoInsurance}>
              {t("step3.noInsurance")} <I.ChevronRight size={12} />
            </button>
          </div>
        </section>
      ) : (
        <>
          {policies.map(p => (
            <section key={p.id} className="card-soft policy-card">
              <div className="policy-card-head">
                <div className="policy-card-ico">
                  <img className="policy-card-icon-img" src={insurancePolicyIcon} alt="" aria-hidden="true" />
                </div>
                <div className="policy-card-info">
                  <div className="policy-card-provider">{p.provider}</div>
                  <div className="policy-card-policy mono">{p.policyNumber}</div>
                </div>
                <button type="button" className="icon-btn" onClick={() => handleRemovePolicy(p.id)}>
                  <I.Trash size={12} />
                </button>
              </div>
              <div className="policy-card-grid">
                <div><span className="lab">{t("step3.member")}</span><span className="val">{p.memberName || "—"}</span></div>
                <div><span className="lab">{t("step3.memberId")}</span><span className="val mono">{p.memberId || "—"}</span></div>
                <div><span className="lab">{t("step3.expiry")}</span><span className="val mono">{p.expiry || "—"}</span></div>
                <div><span className="lab">{t("step3.coverage")}</span><span className="val">{p.coverage}</span></div>
                <div className="policy-card-attached">
                  {p.cardAttached
                    ? <><I.CheckCircle size={11} /> {t("step3.cardAttached")}</>
                    : <><I.AlertCircle size={11} /> {t("step3.cardMissing")}</>}
                </div>
              </div>
            </section>
          ))}

          {adding && (
            <section className="card-soft">
              <div className="group-head">
                <h3 className="group-title">{t("step3.newPolicy")}</h3>
              </div>
              <div className="form-grid form-grid-2">
                <div className="field">
                  <label className="label">{t("step3.provider")} <span className="req">*</span></label>
                  <select className="select" value={draft.provider} onChange={e => setDraft({ ...draft, provider: e.target.value })}>
                    <option value="">{t("step3.provider.select")}</option>
                    {INSURANCE_PROVIDERS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label">{t("step3.policyNumber")} <span className="req">*</span></label>
                  <input className="input" value={draft.policyNumber} onChange={e => setDraft({ ...draft, policyNumber: e.target.value })} />
                </div>
                <div className="field">
                  <label className="label">{t("step3.member")}</label>
                  <input className="input" value={draft.memberName} onChange={e => setDraft({ ...draft, memberName: e.target.value })} />
                </div>
                <div className="field">
                  <label className="label">{t("step3.memberId")}</label>
                  <input className="input" value={draft.memberId} onChange={e => setDraft({ ...draft, memberId: e.target.value })} />
                </div>
                <div className="field">
                  <label className="label">{t("step3.expiry")}</label>
                  <DateInput value={draft.expiry} onChange={(v) => setDraft({ ...draft, expiry: v })} format="MM/YYYY" />
                </div>
                <div className="field">
                  <label className="label">{t("step3.coverage")}</label>
                  <select className="select" value={draft.coverage} onChange={e => setDraft({ ...draft, coverage: e.target.value })}>
                    <option>Outpatient</option>
                    <option>Inpatient</option>
                    <option>Both</option>
                  </select>
                </div>
              </div>
              <div className="step3-add-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>{t("step3.cancel")}</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleAddPolicy}>
                  <I.Plus size={11} /> {t("step3.savePolicy")}
                </button>
              </div>
            </section>
          )}

          {!adding && policies.length > 0 && (
            <button type="button" className="btn btn-ghost step3-add-more" onClick={() => setAdding(true)}>
              <I.Plus size={12} /> {t("step3.addAnother")}
            </button>
          )}
        </>
      )}

      <StepFooter
        onPrev={onPrev}
        onNext={onNext}
        nextDisabled={!gate.step3Done}
        blockers={gate.blockers[3]}
      />
    </StepShell>
  );
}

// =====================================================================
// STEP 4 — AI Orders
// =====================================================================
export function Step4Orders({ patient, onUpdate, onPrev, onPushToast, gate }) {
  const t = useLang();
  const cart = patient.cart || { items: [] };
  const inCartIds = useMemo(() => new Set(cart.items.map(i => i.id)), [cart.items]);

  // The unified AddTestsPanel calls onAdd with [{ testId, name, price, kind }, …].
  // We normalize to cart-item shape and merge with current cart, deduping in-cart ids.
  const addBulk = (items) => {
    const fresh = items.filter(i => !inCartIds.has(i.testId || i.id));
    if (fresh.length === 0) {
      onPushToast?.("Already in cart", "error");
      return;
    }
    const additions = fresh.map(item => {
      const id = item.testId || item.id;
      const c = ORDER_CATALOG.find(c => c.id === id) || {};
      return {
        id, kind: item.kind || c.kind || "lab", name: item.name || c.name,
        price: item.price ?? c.price, qty: 1, payer: patient.payer || "direct", status: "pending",
      };
    });
    onUpdate({ ...patient, cart: { ...cart, items: [...cart.items, ...additions] } });
  };

  // Telehealth state — slot picker is inline; opens on Include / Reschedule / Add it back.
  const tele = patient.teleconsult || { status: "notBooked", slot: null };
  const hasLabOrImaging = cart.items.some(i => i.kind === "lab" || i.kind === "imaging");
  const tatPlan = useMemo(() => hasLabOrImaging ? computeTatPlan(cart.items) : null, [cart.items, hasLabOrImaging]);
  const tatHours = tatPlan?.finalResultHours ?? 0;
  const earliestViableSlot = useMemo(
    () => SLOT_OPTIONS.find(s => s.etaHours >= tatHours)?.id || SLOT_OPTIONS[SLOT_OPTIONS.length - 1].id,
    [tatHours]
  );
  const [telePicker, setTelePicker] = useState({ open: false, mode: "book", picked: null });
  const closePicker = () => setTelePicker({ open: false, mode: "book", picked: null });
  const openPickerForBook = () => setTelePicker({ open: true, mode: "book", picked: earliestViableSlot });
  const openPickerForReschedule = () => setTelePicker({ open: true, mode: "reschedule", picked: tele.slot?.id || earliestViableSlot });
  const confirmSlot = () => {
    const slot = SLOT_OPTIONS.find(s => s.id === telePicker.picked);
    if (!slot) return;
    onUpdate({
      ...patient,
      teleconsult: {
        status: "booked",
        slot: { id: slot.id, hint: slot.hint },
        by: "nurse",
        bookedAt: new Date().toISOString(),
      },
    });
    const key = telePicker.mode === "reschedule" ? "step4.tele.toastRescheduled" : "step4.tele.toastBooked";
    onPushToast?.(t(key, { hint: slot.hint }), "success");
    closePicker();
  };
  const handleWaiveTele = () => {
    onUpdate({ ...patient, teleconsult: { status: "waived", slot: null } });
    onPushToast?.(t("step4.tele.toastWaived"));
    closePicker();
  };

  return (
    <StepShell title={t("step4.title")} subtitle={t("step4.sub")}>

      {/* Unified test picker — replaces AI suggestions + catalogue + previous-tests.
         Currency toggle is shared with the cart rail via patient.cart.ccy. */}
      <AddTestsPanel
        patient={patient}
        onAdd={addBulk}
        onPushToast={onPushToast}
        ccy={cart.ccy || "USD"}
        onCcyToggle={(next) => onUpdate({ ...patient, cart: { ...cart, ccy: next } })}
      />

      {/* Telehealth — single-row decisive card with inline slot picker.
         Info on the left (icon + title + meta line that adapts to state),
         action cluster on the right. Clicking Include / Reschedule expands
         the card downward with a 2x2 day-grouped slot grid; slots earlier
         than the cart's TAT are disabled with a "results not ready" reason. */}
      {(() => {
        const locked = tele.status === "notBooked" && !hasLabOrImaging;
        const stateClass = locked ? "is-locked" : "is-" + tele.status;
        const picking = telePicker.open;
        const reset = () => { onUpdate({ ...patient, teleconsult: { status: "notBooked", slot: null } }); closePicker(); };
        const meta =
          tele.status === "booked"  ? t("step4.tele.metaBooked", { hint: tele.slot?.hint || "" }) || tele.slot?.hint
          : tele.status === "waived" ? t("step4.tele.metaWaived")
          : locked                  ? t("step4.tele.metaLocked")
          : t("step4.tele.metaSlot");
        const MetaIcon =
          tele.status === "booked"  ? I.Calendar
          : tele.status === "waived" ? I.X
          : locked                  ? I.AlertTriangle
          : I.Clock;
        // Group slots by day for the picker
        const todaySlots    = SLOT_OPTIONS.filter(s => s.id.startsWith("today_"));
        const tomorrowSlots = SLOT_OPTIONS.filter(s => s.id.startsWith("tom_"));
        const tatLabel = fmtTatHours(tatHours || 0);
        return (
          <section className={"card-soft tele-card " + stateClass + (picking ? " is-picking" : "")}>
            <div className="tele-card-row">
              <div className="tele-card-icon" aria-hidden>
                {tele.status === "booked"
                  ? <img className="tele-card-icon-img" src={teleconsultationIcon} alt="" aria-hidden="true" />
                  : <I.Video size={16} />}
              </div>
              <div className="tele-card-info">
                <div className="tele-card-title-row">
                  <span className="tele-card-title">{t("step4.tele.title")}</span>
                  <span className="tele-card-duration">{t("step4.tele.duration")}</span>
                </div>
                <div className="tele-card-meta">
                  <MetaIcon size={11} />
                  <span>{tele.status === "booked" ? (tele.slot?.hint || meta) : meta}</span>
                </div>
              </div>
              <span className={"tele-card-tag tele-card-tag-" + (locked ? "locked" : tele.status)}>
                {tele.status === "booked"   && t("step4.tele.booked")}
                {tele.status === "waived"   && t("step4.tele.waived")}
                {tele.status === "notBooked" && t("step4.tele.notBooked")}
              </span>
              <div className="tele-card-actions">
                {tele.status === "notBooked" && !picking && (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm tele-btn-skip"
                      onClick={handleWaiveTele}
                      disabled={locked}
                    >
                      {t("step4.tele.waive")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm tele-btn-book"
                      onClick={openPickerForBook}
                      disabled={locked}
                      title={locked ? t("step4.tele.disabled") : ""}
                    >
                      <I.Video size={11} /> {t("step4.tele.book")}
                    </button>
                  </>
                )}
                {tele.status === "booked" && !picking && (
                  <>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
                      {t("step4.tele.cancel")}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={openPickerForReschedule}>
                      <I.Edit size={11} /> {t("step4.tele.reschedule")}
                    </button>
                  </>
                )}
                {tele.status === "waived" && !picking && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={openPickerForBook}
                    disabled={!hasLabOrImaging}
                  >
                    <I.Video size={11} /> {t("step4.tele.bookInstead")}
                  </button>
                )}
              </div>
            </div>

            {picking && (
              <div className="tele-picker">
                <div className="tele-picker-head">
                  <I.Calendar size={11} />
                  <strong>{t("step4.tele.pickHead")}</strong>
                  {tatHours > 0 && (
                    <span className="tele-picker-hint">
                      · {t("step4.tele.pickHint", { eta: tatLabel })}
                    </span>
                  )}
                </div>

                {[
                  { label: t("step4.tele.dayToday")  || "Today",    slots: todaySlots },
                  { label: t("step4.tele.dayTomorrow") || "Tomorrow", slots: tomorrowSlots },
                ].map(({ label, slots }) => (
                  <div key={label} className="tele-picker-day">
                    <div className="tele-picker-day-label">{label}</div>
                    <div className="tele-picker-slots">
                      {slots.map(s => {
                        const tooEarly = tatHours > 0 && s.etaHours < tatHours;
                        const active = telePicker.picked === s.id;
                        const time = s.hint.split("·")[1]?.trim() || s.hint;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            className={"tele-picker-slot" + (active ? " is-active" : "") + (tooEarly ? " is-disabled" : "")}
                            onClick={() => !tooEarly && setTelePicker({ ...telePicker, picked: s.id })}
                            disabled={tooEarly}
                            title={tooEarly ? t("step4.tele.tooEarly") : ""}
                          >
                            <I.Clock size={11} />
                            <span className="tele-picker-slot-time">{time}</span>
                            {tooEarly && (
                              <span className="tele-picker-slot-warn">
                                <I.AlertTriangle size={9} /> {t("step4.tele.tooEarly")}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="tele-picker-foot">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={closePicker}>
                    {t("step4.tele.pickCancel")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={confirmSlot}
                    disabled={
                      !telePicker.picked ||
                      (telePicker.mode === "reschedule" && telePicker.picked === tele.slot?.id)
                    }
                  >
                    <I.Check size={11} />{" "}
                    {telePicker.mode === "reschedule"
                      ? t("step4.tele.pickConfirmReschedule")
                      : t("step4.tele.pickConfirm")}
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })()}

      {/* Final step — payment + check-in CTA live in the cart rail. */}
      <StepFooter onPrev={onPrev} />
    </StepShell>
  );
}
