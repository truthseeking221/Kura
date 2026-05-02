// === Kura Reception — Wizard shell, progress bar, patient header ===
//   v2.1: 4-step wizard (Identity → Review → Insurance → AI Orders).
//   Payment + check-in CTA live inside the always-visible cart rail, so the
//   former Step 5 panel was a duplicate of the cart and has been removed.
//   - WizardProgress: numbered stepper with active/done/locked states
//   - PatientHeader: sticky patient identity bar (always visible)
//   - useWizardGate: returns step-by-step completion gates with reasons
//   - STEP_DEFS: canonical step list
//
import React, { useMemo, useState } from "react";
import { I } from "./icons";
import { useLang } from "./i18n";

// === Canonical step definitions ===
export const STEP_DEFS = [
  { id: 1, key: "Identity",   icon: "User",         labelKey: "step.identity"  },
  { id: 2, key: "Review",     icon: "FileText",     labelKey: "step.review"    },
  { id: 3, key: "Insurance",  icon: "Shield",       labelKey: "step.insurance" },
  { id: 4, key: "AI Orders",  icon: "Sparkles",     labelKey: "step.orders"    },
];

export function canNavigateToStep(stepId, currentStep, gate) {
  const status = gate.stepStatus?.[stepId];
  if (stepId === currentStep || status === "locked") return false;
  if (status === "done" || stepId < currentStep) return true;
  if (stepId === currentStep + 1) return !!gate["step" + currentStep + "Done"];
  return false;
}

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

// === WizardProgress — desktop stepper + mobile compact summary ===
//   Both render unconditionally; CSS hides one based on the viewport.
//   Desktop  → numbered stepper with full labels (existing layout)
//   Mobile   → "Step n of 4" + step name + 4 dots, fits 360px width
//
export function WizardProgress({ currentStep, gate, onStepClick }) {
  const t = useLang();
  const currentDef = STEP_DEFS.find(s => s.id === currentStep) || STEP_DEFS[0];
  return (
    <>
      <div className="wiz-progress wiz-progress-desktop" role="navigation" aria-label="Check-in progress">
        {STEP_DEFS.map((s, idx) => {
          const status = gate.stepStatus[s.id]; // "done" | "active" | "locked"
          const isCurrent = currentStep === s.id;
          const isNavigable = canNavigateToStep(s.id, currentStep, gate);
          const isClickable = isNavigable || isCurrent;
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
                onClick={() => isNavigable && onStepClick?.(s.id)}
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

      <div className="wiz-progress-mobile" role="navigation" aria-label="Check-in progress">
        <div className="wiz-mobile-copy">
          <span>Step {currentStep} of {STEP_DEFS.length}</span>
          <strong>{t(currentDef.labelKey)}</strong>
        </div>
        <div className="wiz-mobile-dots" aria-hidden="true">
          {STEP_DEFS.map(s => {
            const status = gate.stepStatus[s.id];
            const isCurrent = currentStep === s.id;
            const isNavigable = canNavigateToStep(s.id, currentStep, gate);
            const isClickable = isNavigable || isCurrent;
            const cls = "wiz-mobile-dot"
              + (isCurrent ? " is-current" : "")
              + (status === "done" && !isCurrent ? " is-done" : "")
              + (status === "locked" ? " is-locked" : "");
            return (
              <button
                key={s.id}
                type="button"
                className={cls}
                onClick={() => isNavigable && onStepClick?.(s.id)}
                disabled={!isClickable}
                aria-label={`${s.id}. ${t(s.labelKey)}`}
              >
                {status === "done" && !isCurrent
                  ? <I.Check size={11} strokeWidth={3} />
                  : s.id}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// === PatientHeader — sticky identity bar ===
//   Shows: avatar | name + queue + DOB + phone | status chips
//
const AVATAR_COLORS = {
  "av-blue": "#268cff", "av-teal": "#06a07a", "av-purple": "#7a45ec",
  "av-amber": "#d97706", "av-pink": "#e91e8c", "av-green": "#2e7d32",
};

export function PatientHeader({ patient, gate, currentStep = 1, onStepClick }) {
  const t = useLang();
  const [stepSwitcherOpen, setStepSwitcherOpen] = useState(false);
  const currentDef = STEP_DEFS.find(s => s.id === currentStep) || STEP_DEFS[0];
  const initials = (patient.initials || (patient.name || "?").split(" ").map(n => n[0]).join("").slice(0, 2) || "?").toUpperCase();
  const avatarBg = AVATAR_COLORS[patient.avatarColor] || "#268cff";
  const phoneDisplay = patient.phoneNumber
    ? (patient.countryCode || "+855") + " " + patient.phoneNumber
    : (patient.mobile || "—");
  // DOB: "1996-02-14" → "14 Feb 1996 · 30y"
  // For a busy nurse, "1996 02 14" is harder to parse than the human form.
  const dobDisplay = (() => {
    if (!patient.dob) return null;
    const d = new Date(patient.dob);
    if (Number.isNaN(d.getTime())) return patient.dob;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = d.getDate();
    const mo = months[d.getMonth()];
    const yr = d.getFullYear();
    const today = new Date();
    let age = today.getFullYear() - yr;
    if (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < day)) age--;
    return `${day} ${mo} ${yr} · ${age}y`;
  })();

  // Cart-aware payment chip — "Orders needed" beats "Payment pending"
  // when the cart is empty: a stressed nurse should see the next required
  // action, not a vague status.
  const cartItemCount = (patient.cart?.items || []).length;
  const cartPaid = patient.cart?.payment?.status === "confirmed";
  let payChipLabel, payChipDone;
  if (cartPaid)             { payChipLabel = t("chip.payment");        payChipDone = true; }
  else if (cartItemCount === 0) { payChipLabel = t("chip.ordersNeeded"); payChipDone = false; }
  else                      { payChipLabel = t("chip.paymentPending"); payChipDone = false; }

  const chips = [
    { id: "id",   label: t("chip.identity"),  done: gate.step1Done },
    { id: "rev",  label: t("chip.review"),    done: gate.step2Done },
    { id: "ins",  label: t("chip.insurance"), done: gate.step3Done },
    { id: "pay",  label: payChipLabel,        done: payChipDone, pendingLabel: payChipLabel },
  ];

  // === Mobile primary status — single pill + concise secondary line ===
  // The 4-chip horizontal scroll on mobile makes nurses guess what's hidden.
  // Replace it with one big "what should I do next?" status and one small
  // line summarising step state. Desktop keeps the 4 chips (CSS gates this).
  const isCheckedIn = patient.status?.label === "Checked in";
  const primaryStatus = (() => {
    if (isCheckedIn) return { tone: "success", label: "Checked in", icon: "CheckCircle" };
    if (cartPaid && gate.step4Done) return { tone: "success", label: "Ready to check in", icon: "CheckCircle" };
    if (cartPaid) return { tone: "info", label: "Paid", icon: "Check" };
    if (cartItemCount > 0 && gate.step2Done) return { tone: "info", label: "Ready to pay", icon: "CreditCard" };
    if (cartItemCount > 0 && !gate.step2Done) return { tone: "warn", label: "Verify patient", icon: "AlertCircle" };
    if (gate.step1Done && cartItemCount === 0) return { tone: "warn", label: "Orders needed", icon: "Plus" };
    return { tone: "muted", label: "Capture identity", icon: "User" };
  })();
  const StatusIcon = I[primaryStatus.icon] || I.Clock;
  const stepSwitcherTitle = `Step ${currentStep}/${STEP_DEFS.length} · ${t(currentDef.labelKey)}`;

  const getStepDetail = (step, isCurrent, isNavigable) => {
    const status = gate.stepStatus[step.id];
    if (isCurrent) return "Current";
    if (status === "done") return "Completed";
    if (isNavigable) return "Available";
    return gate.blockers?.[step.id]?.[0] || "Complete prior step first";
  };

  const handleStepSelect = (stepId, isNavigable) => {
    if (!isNavigable) return;
    setStepSwitcherOpen(false);
    onStepClick?.(stepId);
  };

  return (
    <div className={"patient-header" + (stepSwitcherOpen ? " is-step-sheet-open" : "")}>
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
            {dobDisplay && (
              <span className="patient-header-pill"><I.Calendar size={9} /> {dobDisplay}</span>
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
      {/* Mobile-only primary status pill — single answer to "what next?". */}
      <div className={"patient-header-mobile-status patient-header-mobile-status-" + primaryStatus.tone}>
        <span className="ph-mstatus-pill">
          <StatusIcon size={12} strokeWidth={2.25} />
          <span>{primaryStatus.label}</span>
        </span>
        <button
          type="button"
          className="ph-step-switcher"
          onClick={() => setStepSwitcherOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={stepSwitcherOpen}
          aria-label={`Open check-in steps. ${stepSwitcherTitle}`}
        >
          <span>Step {currentStep}/{STEP_DEFS.length}</span>
          <strong>{t(currentDef.labelKey)}</strong>
          <I.ChevronDown size={10} strokeWidth={2.4} />
        </button>
        {stepSwitcherOpen && (
          <>
            <button
              type="button"
              className="mobile-step-scrim"
              aria-label="Close check-in steps"
              onClick={() => setStepSwitcherOpen(false)}
            />
            <div className="mobile-step-sheet" role="dialog" aria-modal="true" aria-label="Check-in steps">
              <div className="mobile-step-sheet-head">
                <div>
                  <span>Check-in steps</span>
                  <strong>{stepSwitcherTitle}</strong>
                </div>
                <button type="button" aria-label="Close check-in steps" onClick={() => setStepSwitcherOpen(false)}>
                  <I.X size={15} />
                </button>
              </div>
              <div className="mobile-step-list">
                {STEP_DEFS.map(step => {
                  const status = gate.stepStatus[step.id];
                  const isCurrent = currentStep === step.id;
                  const isNavigable = canNavigateToStep(step.id, currentStep, gate);
                  const StepIcon = I[step.icon] || I.FileText;
                  const rowClass = "mobile-step-row"
                    + (isCurrent ? " is-current" : "")
                    + (status === "done" && !isCurrent ? " is-done" : "")
                    + (!isCurrent && !isNavigable ? " is-locked" : "");
                  return (
                    <button
                      key={step.id}
                      type="button"
                      className={rowClass}
                      onClick={() => handleStepSelect(step.id, isNavigable)}
                      disabled={isCurrent || !isNavigable}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      <span className="mobile-step-mark">
                        {status === "done" && !isCurrent
                          ? <I.Check size={12} strokeWidth={3} />
                          : <StepIcon size={13} strokeWidth={2.2} />}
                      </span>
                      <span className="mobile-step-copy">
                        <strong>{step.id}. {t(step.labelKey)}</strong>
                        <span>{getStepDetail(step, isCurrent, isNavigable)}</span>
                      </span>
                      <span className="mobile-step-action">
                        {isCurrent
                          ? "Now"
                          : status === "done"
                            ? "Edit"
                            : isNavigable
                              ? "Go"
                              : <I.Lock size={12} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
