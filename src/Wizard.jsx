// === Kura Reception — Wizard shell, progress bar, patient header ===
//   v2.1: 4-step wizard (Identity → Review → Insurance → AI Orders).
//   Payment + check-in CTA live inside the always-visible cart rail, so the
//   former Step 5 panel was a duplicate of the cart and has been removed.
//   - WizardProgress: numbered stepper with active/done/locked states
//   - PatientHeader: sticky patient identity bar (always visible)
//   - useWizardGate: returns step-by-step completion gates with reasons
//   - STEP_DEFS: canonical step list
//
import React, { useMemo } from "react";
import { I } from "./icons";
import { useLang } from "./i18n";

// === Canonical step definitions ===
export const STEP_DEFS = [
  { id: 1, key: "Identity",   icon: "User",         labelKey: "step.identity"  },
  { id: 2, key: "Review",     icon: "FileText",     labelKey: "step.review"    },
  { id: 3, key: "Insurance",  icon: "Shield",       labelKey: "step.insurance" },
  { id: 4, key: "AI Orders",  icon: "Sparkles",     labelKey: "step.orders"    },
];

// === useWizardGate: derives completion state for each step ===
//   Returns { stepStatus[1..4], blockers, isReadyToCheckIn }
//
//   Step 1 (Identity) → has name AND identity captured (any source)
//   Step 2 (Review)   → name + DOB + sexAtBirth + at least one verified contact
//   Step 3 (Insurance)→ either has insurance OR explicitly marked "no insurance"
//                       (auto-completes — never blocking)
//   Step 4 (AI Orders)→ at least one item in cart
//   Payment confirmation lives in the cart rail; isReadyToCheckIn folds it in.
//
export function useWizardGate(patient) {
  return useMemo(() => {
    const blockers = { 1: [], 2: [], 3: [], 4: [] };

    // Step 1 — identity
    const hasName = !!patient.name;
    const hasIdentitySource = !!(patient.idScanned || patient.manualEntry || patient.identity?.source);
    if (!hasName) blockers[1].push("Name required");
    if (!hasIdentitySource && !hasName) blockers[1].push("Capture identity (scan, NFC, or manual)");
    const step1Done = hasName && hasIdentitySource;

    // Step 2 — review
    const hasDob = !!patient.dob;
    const hasSex = !!patient.sexAtBirth;
    const hasContact = !!(patient.otpVerified || patient.telegramVerified);
    if (!hasName) blockers[2].push("Full name required");
    if (!hasDob) blockers[2].push("Date of birth required");
    if (!hasSex) blockers[2].push("Sex at birth required");
    if (!hasContact) blockers[2].push("At least one verified contact required");
    const step2Done = step1Done && hasName && hasDob && hasSex && hasContact;

    // Step 3 — insurance (always completable; default = no insurance)
    const insuranceAcked = step2Done && (patient.insuranceAcked || (patient.insurance || []).length > 0);
    const step3Done = step2Done && insuranceAcked;

    // Step 4 — orders
    const cart = patient.cart || { items: [] };
    const itemCount = (cart.items || []).length;
    if (itemCount === 0) blockers[4].push("Add at least one service");
    const step4Done = step3Done && itemCount > 0;

    // Payment — confirmed in the cart rail; needed for check-in
    const paid = cart.payment?.status === "confirmed";

    const stepStatus = {
      1: step1Done ? "done" : "active",
      2: !step1Done ? "locked" : (step2Done ? "done" : "active"),
      3: !step2Done ? "locked" : (step3Done ? "done" : "active"),
      4: !step3Done ? "locked" : (step4Done ? "done" : "active"),
    };

    return {
      stepStatus,
      blockers,
      step1Done, step2Done, step3Done, step4Done,
      paid,
      isReadyToCheckIn: step4Done && paid,
    };
  }, [patient]);
}

// === WizardProgress — the 5-step bar ===
export function WizardProgress({ currentStep, gate, onStepClick }) {
  const t = useLang();
  return (
    <div className="wiz-progress" role="navigation" aria-label="Check-in progress">
      {STEP_DEFS.map((s, idx) => {
        const status = gate.stepStatus[s.id]; // "done" | "active" | "locked"
        const isCurrent = currentStep === s.id;
        const isClickable = status === "done" || isCurrent || (status === "active" && s.id <= currentStep);
        const cls = "wiz-step"
          + (isCurrent ? " is-current" : "")
          + (status === "done" ? " is-done" : "")
          + (status === "locked" ? " is-locked" : "")
          + (isClickable ? " is-clickable" : "");
        return (
          <React.Fragment key={s.id}>
            <button
              type="button"
              className={cls}
              onClick={() => isClickable && onStepClick?.(s.id)}
              disabled={!isClickable}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`${s.id}. ${t(s.labelKey)} — ${status}`}
            >
              <span className="wiz-step-mark">
                {status === "done" && !isCurrent
                  ? <I.Check size={11} strokeWidth={3} />
                  : <span className="wiz-step-num">{s.id}</span>}
              </span>
              <span className="wiz-step-label">{t(s.labelKey)}</span>
            </button>
            {idx < STEP_DEFS.length - 1 && (
              <span className={"wiz-connector" + (gate.stepStatus[s.id] === "done" ? " is-done" : "")} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// === PatientHeader — sticky identity bar ===
//   Shows: avatar | name + queue + DOB + phone | status chips
//
const AVATAR_COLORS = {
  "av-blue": "#268cff", "av-teal": "#06a07a", "av-purple": "#7a45ec",
  "av-amber": "#d97706", "av-pink": "#e91e8c", "av-green": "#2e7d32",
};

export function PatientHeader({ patient, gate }) {
  const t = useLang();
  const initials = (patient.initials || (patient.name || "?").split(" ").map(n => n[0]).join("").slice(0, 2) || "?").toUpperCase();
  const avatarBg = AVATAR_COLORS[patient.avatarColor] || "#268cff";
  const phoneDisplay = patient.phoneNumber
    ? (patient.countryCode || "+855") + " " + patient.phoneNumber
    : (patient.mobile || "—");

  const chips = [
    { id: "id",   label: t("chip.identity"),  done: gate.step1Done },
    { id: "rev",  label: t("chip.review"),    done: gate.step2Done },
    { id: "ins",  label: t("chip.insurance"), done: gate.step3Done },
    { id: "pay",  label: t("chip.payment"),   done: gate.paid, pendingLabel: t("chip.paymentPending") },
  ];

  return (
    <div className="patient-header">
      <div className="patient-header-id">
        {patient.name ? (
          <div className="patient-header-avatar" style={{ background: avatarBg }}>{initials}</div>
        ) : (
          <div className="patient-header-avatar patient-header-avatar-empty"><I.User size={14} /></div>
        )}
        <div className="patient-header-meta">
          <div className="patient-header-name">{patient.name || t("patient.unidentified")}</div>
          <div className="patient-header-sub">
            <span className="patient-header-pill"><I.Tag size={9} /> {patient.queueNumber || "—"}</span>
            {patient.dob && (
              <span className="patient-header-pill"><I.Calendar size={9} /> {patient.dob}</span>
            )}
            {phoneDisplay !== "—" && (
              <span className="patient-header-pill"><I.Phone size={9} /> {phoneDisplay}</span>
            )}
          </div>
        </div>
      </div>
      <div className="patient-header-chips">
        {chips.map(c => (
          <span key={c.id} className={"ph-chip " + (c.done ? "ph-chip-ok" : "ph-chip-wait")}>
            {c.done
              ? <I.CheckCircle size={10} strokeWidth={2.25} />
              : <I.Clock size={10} />}
            <span>{c.done ? c.label : (c.pendingLabel || c.label)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
