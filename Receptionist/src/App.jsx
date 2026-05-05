// === Kura Reception — App (v2.1 wizard architecture) ===
//
//   4-step wizard: Identity → Review → Insurance → AI Orders.
//   Payment + check-in CTA live in the always-visible cart rail (no Step 5 panel).
//
//   Layout (desktop):
//     Sidebar | Main column ( Topbar | PatientHeader | Progress | StepContent ) | Cart sticky right
//
//   Each patient owns its own wizardStep + completedSteps so multi-patient context works.
//
import React, { useState, useRef, useMemo, useEffect } from "react";
import { I } from "./icons";
import { initialPatients, initialNotifications, blankPatient } from "./data";
import { Sidebar, Topbar } from "./Layout";
import { OrderCart, deriveCart, cartTotals, ORDER_CATALOG, paymentAfterPaidEdit, paymentDueAmount } from "./OrderCart";
import { AddTestsPanel } from "./AddTestsPanel";
import { useKeydown, isTypingTarget } from "./shared";
import {
  HotkeyCheatsheetModal,
  ToastStack,
} from "./Modals";
import { LangProvider } from "./i18n";
import { WizardProgress, PatientHeader, useWizardGate, canNavigateToStep } from "./Wizard";
import { Step1Identity, Step2Review, Step3Insurance, Step4Orders, Step5Teleconsult, Step6Payment } from "./Steps";
import { VisitContextBlock } from "./VisitContextBlock";

export default function App() {
  return (
    <LangProvider lang="English">
      <AppShell />
    </LangProvider>
  );
}

function AppShell() {
  const [patients, setPatients] = useState(initialPatients);
  const [activeId, setActiveId] = useState("p1");
  const [collapsed, setCollapsed] = useState(true);
  const [activeNav, setActiveNav] = useState("reception");
  const [uiLang, setUiLang] = useState("English");

  // Mobile-only navigation + cart sheet state. Desktop keeps its sticky rail
  // and never opens these — they are gated by CSS @media (max-width: 767px).
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  // Sheet mode lets the dock surface 3 entry points without leaving the sheet:
  //   add  → AddTestsPanel embedded; nurse can capture an order from anywhere
  //   cart → OrderCart items + payment + CTA (default)
  //   pay  → OrderCart but auto-scrolls payment area into view on entry
  const [sheetMode, setSheetMode] = useState("cart");

  // Per-patient wizard step (default to inferred step on first load)
  const [wizardStepMap, setWizardStepMap] = useState({});

  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  // Paid-edit safety: any attempt to mutate the cart after payment.status
  // === "confirmed" is intercepted and queued here. The resolution prompt
  // gives the nurse three explicit choices: supplemental, void & recompute,
  // or cancel. Falsy = no prompt active.
  const [paidEditPending, setPaidEditPending] = useState(null);

  const [station, setStation] = useState("PSC-01");
  const [shift, setShift] = useState("morning");
  const [notifs, setNotifs] = useState(initialNotifications);

  const [toasts, setToasts] = useState([]);
  // Cart focus mode — desktop only. When on, the right rail collapses sibling
  // cards (visit context) and the cart's items area expands to fill the
  // viewport, so a nurse can verify long order lists without inner scroll.
  // Session-scoped: a nurse who prefers focus mode keeps it across patients.
  const [cartFocused, setCartFocused] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return window.sessionStorage.getItem("kura.cartFocused") === "1"; }
    catch { return false; }
  });
  useEffect(() => {
    try { window.sessionStorage.setItem("kura.cartFocused", cartFocused ? "1" : "0"); }
    catch {}
  }, [cartFocused]);
  const toggleCartFocus = () => setCartFocused(v => !v);
  const toastIdRef = useRef(1);
  const dockSummaryRef = useRef(null);
  const cartSheetRef = useRef(null);
  const cartSheetCloseRef = useRef(null);
  const lastDockFocusRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);

  const active = patients.find(p => p.id === activeId) || patients[0];
  const gate = useWizardGate(active);
  const isBlankState = isPristineBlankPatient(active);

  // Cart summary for the mobile bottom-bar (hidden on desktop via CSS).
  const activeCart = useMemo(() => deriveCart(active), [active]);
  const activeTotals = cartTotals(activeCart);
  const activePaymentDue = paymentDueAmount(activeCart, activeTotals);
  const activeItemCount = activeCart.items.length;
  const cartPaid = activeCart.payment?.status === "confirmed";
  const cartPayLater = activeCart.payment?.status === "deferred";
  const cartNoCharge = activeItemCount > 0 && activePaymentDue <= 0;
  const activeLinePayers = activeCart.items.map(i => i.payer || active.payer || "direct");
  const hasInsurancePaidLines = activeLinePayers.includes("insurance");
  const payerReadyForPayment =
    gate.step3Done ||
    (activeItemCount > 0 &&
      activeLinePayers.every(Boolean) &&
      (!hasInsurancePaidLines || (active.insurance || []).length > 0));
  const isValidationResolved = (item) => {
    const state = item.validationState || "idle";
    return state === "signed" || state === "verbal";
  };
  const checkInBlockersFor = (target) => {
    if (!target) return ["Select a patient first"];
    const targetCart = deriveCart(target);
    const targetTotals = cartTotals(targetCart);
    const targetPaymentDue = paymentDueAmount(targetCart, targetTotals);
    const targetItems = targetCart.items || [];
    const linePayers = targetItems.map(i => i.payer || target.payer || "direct");
    const hasInsuranceLines = linePayers.includes("insurance");
    const payerReady =
      target.insuranceAcked ||
      (target.insurance || []).length > 0 ||
      (targetItems.length > 0 &&
        linePayers.every(Boolean) &&
        (!hasInsuranceLines || (target.insurance || []).length > 0));
    const pendingValidation = targetItems.some(i => i.kind === "imaging" && !isValidationResolved(i));
    const paymentResolved =
      targetCart.payment?.status === "confirmed" ||
      targetCart.payment?.status === "deferred" ||
      targetPaymentDue <= 0;
    const teleInCart = targetItems.some(i => i.kind === "telecon" || i.id === "telecon");
    const tele = target.teleconsult || {};
    const teleResolved = tele.booked || tele.skipped || !teleInCart;

    const blockers = [];
    if (targetItems.length === 0) blockers.push("Add at least one order");
    if (!target.name) blockers.push("Patient name is missing");
    if (!target.dob) blockers.push("Date of birth is missing");
    if (!target.sexAtBirth) blockers.push("Sex at birth is missing");
    if (!(target.otpVerified || target.telegramVerified)) blockers.push("Verify one contact channel");
    if (!payerReady) blockers.push("Choose payer or mark direct pay");
    if (pendingValidation) blockers.push("Resolve imaging consent");
    if (!teleResolved) blockers.push("Book or skip teleconsult");
    if (!paymentResolved) {
      blockers.push(targetCart.payment?.status === "waiting"
        ? "Payment is still waiting for confirmation"
        : "Take payment in Step 6 or mark pay-later");
    }
    return blockers;
  };
  const patientReadyForCheckIn = (target) => checkInBlockersFor(target).length === 0;

  // Infer initial step from gate (resume where they left off).
  // Spec v12: 6-step wizard. Step 6 (Payment) is the final step before
  // the cart's "Check in & confirm order" CTA.
  const inferStep = (g) => {
    if (!g.step1Done) return 1;
    if (!g.step2Done) return 2;
    if (!g.step3Done) return 3;
    if (!g.step4Done) return 4;
    if (!g.step5Done) return 5;
    return 6;
  };
  const currentStep = wizardStepMap[activeId] ?? inferStep(gate);
  const setCurrentStep = (n) => setWizardStepMap(m => ({ ...m, [activeId]: n }));
  const createBlankReceptionSlot = () => {
    const id = "p-blank-" + Date.now();
    const queueNumber = "Q-" + String(43 + patients.length).padStart(3, "0");
    const colors = ["av-blue", "av-teal", "av-purple", "av-amber", "av-pink", "av-green"];
    const next = blankPatient(id, queueNumber, colors[patients.length % colors.length]);
    setPatients(ps => [next, ...ps]);
    setActiveId(id);
    setWizardStepMap(m => ({ ...m, [id]: 1 }));
    setCartSheetOpen(false);
    setSheetMode("cart");
    return next;
  };

  // Close mobile cart sheet when navigating between patients or wizard steps.
  // The mobile bottom-bar still shows the latest summary, but the open sheet
  // would otherwise feel "stuck" after a context switch.
  useEffect(() => {
    setCartSheetOpen(false);
    setMobileNavOpen(false);
    setSheetMode("cart");
  }, [activeId, currentStep]);

  // Centralised guard so any cart mutation (add/remove) routes through one
  // safety check after payment is confirmed. `apply(mode)` is the caller's
  // mutation closure where mode is one of:
  //   "normal"       — payment was not confirmed; just apply
  //   "supplemental" — keep previous receipt as reference, collect delta
  //   "void"         — void the receipt and force recollection
  const requestPaidEdit = (description, apply) => {
    setPaidEditPending({ description, apply });
  };
  const guardCartEdit = (active, description, apply) => {
    if (active.cart?.payment?.status === "confirmed") {
      requestPaidEdit(description, apply);
    } else {
      apply("normal");
    }
  };
  const resolvePaidEdit = (mode) => {
    if (paidEditPending?.apply) paidEditPending.apply(mode);
    if (mode === "void") pushToast("Receipt voided — recollect payment", "error");
    else if (mode === "supplemental") pushToast("Payment adjustment created", "success");
    setPaidEditPending(null);
  };
  const cancelPaidEdit = () => setPaidEditPending(null);

  // === addBulk: shared "add tests to cart" handler ===
  // Step 4 has its own copy of this; the dock's Add tab needs a parallel one
  // so the nurse can stage orders from anywhere. Logic mirrors Step4Orders,
  // but routes through guardCartEdit so adding to a paid visit is safe.
  const addBulk = (items, meta = {}) => {
    const cart = active.cart || { items: [], promos: {}, splits: null, ccy: "USD", payment: { method: null, status: "idle", tendered: "" } };
    const inCartIds = new Set((cart.items || []).map(i => i.id));
    const fresh = items.filter(i => !inCartIds.has(i.testId || i.id));
    const bundle = meta.bundle || null;
    const bundleItemIds = new Set(bundle?.itemIds || []);
    const bundleAttrs = bundle ? {
      bundleId: bundle.id,
      bundleName: bundle.name,
      bundlePurpose: bundle.purpose,
    } : null;
    if (fresh.length === 0) {
      pushToast("Already in cart", "error");
      return;
    }
    const apply = (mode) => {
      const existingItems = (cart.items || []).map(item =>
        bundleAttrs && bundleItemIds.has(item.id) ? { ...item, ...bundleAttrs } : item
      );
      const additions = fresh.map(item => {
        const id = item.testId || item.id;
        const c = ORDER_CATALOG.find(c => c.id === id) || {};
        return {
          id, kind: item.kind || c.kind || "lab", name: item.name || c.name,
          price: item.price ?? c.price, qty: 1, payer: active.payer || "direct", status: "pending",
          components: item.components || c.components,
          ...(bundleAttrs || {}),
          supplemental: mode === "supplemental" ? true : undefined,
        };
      });
      const nextPayment = paymentAfterPaidEdit(cart.payment, mode);
      const consumedBookingCodes = meta.bookingCode
        ? Array.from(new Set([...(active.consumedBookingCodes || []), meta.bookingCode]))
        : active.consumedBookingCodes;
      const bundles = bundle
        ? [
            ...(cart.bundles || []).filter(b => b.id !== bundle.id),
            bundle,
          ]
        : cart.bundles;
      updatePatient({
        ...active,
        ...(meta.bookingCode ? { consumedBookingCodes } : {}),
        cart: { ...cart, items: [...existingItems, ...additions], bundles, payment: nextPayment },
      });
      return additions.map(item => item.id);
    };
    if (active.cart?.payment?.status === "confirmed") {
      requestPaidEdit(`Add ${fresh.length} order${fresh.length === 1 ? "" : "s"} to a paid visit?`, apply);
      return { deferred: true };
    }
    const addedIds = apply("normal");
    return {
      ids: addedIds,
      undo: () => {
        setPatients(ps => ps.map(p => {
          if (p.id !== active.id) return p;
          const latestCart = p.cart || cart;
          return {
            ...p,
            cart: {
              ...latestCart,
              items: (latestCart.items || []).filter(item => !addedIds.includes(item.id)),
            },
            ...(meta.bookingCode
              ? { consumedBookingCodes: (p.consumedBookingCodes || []).filter(code => code !== meta.bookingCode) }
              : {}),
          };
        }));
      },
    };
  };

  // Open the sheet on a specific tab. Used by the dock CTA / row tap.
  const openSheet = (mode = "cart") => {
    lastDockFocusRef.current = document.activeElement;
    setSheetMode(mode);
    setCartSheetOpen(true);
  };
  const closeSheet = () => {
    setCartSheetOpen(false);
    window.setTimeout(() => {
      const target = lastDockFocusRef.current?.isConnected ? lastDockFocusRef.current : dockSummaryRef.current;
      target?.focus?.();
    }, 0);
  };
  const closeMobileNav = () => {
    setMobileNavOpen(false);
    window.setTimeout(() => mobileMenuButtonRef.current?.focus?.(), 0);
  };

  // Escape closes mobile drawers without affecting any other key handlers.
  useEffect(() => {
    if (!mobileNavOpen && !cartSheetOpen) return;
    const handler = (e) => {
      if (e.key !== "Escape") return;
      if (mobileNavOpen) closeMobileNav();
      if (cartSheetOpen) closeSheet();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileNavOpen, cartSheetOpen]);

  useEffect(() => {
    document.body.classList.toggle("is-mobile-overlay-open", mobileNavOpen || cartSheetOpen);
    return () => document.body.classList.remove("is-mobile-overlay-open");
  }, [mobileNavOpen, cartSheetOpen]);

  useEffect(() => {
    if (!cartSheetOpen) return;
    const focusTimer = window.setTimeout(() => {
      cartSheetCloseRef.current?.focus?.();
    }, 0);
    const trap = (e) => {
      if (e.key !== "Tab") return;
      const root = cartSheetRef.current;
      if (!root) return;
      const focusable = Array.from(root.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(el => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", trap);
    };
  }, [cartSheetOpen]);

  // When the sheet opens in Pay mode, auto-scroll the payment region into
  // view so the nurse doesn't have to hunt for it past the items list.
  useEffect(() => {
    if (!cartSheetOpen || (sheetMode !== "pay" && sheetMode !== "receipt")) return;
    const t = setTimeout(() => {
      if (sheetMode === "pay" && document.querySelector(".mobile-cart-sheet .cart-primary-cta:disabled")) return;
      const payArea = document.querySelector(".mobile-cart-sheet .pay-confirmed, .mobile-cart-sheet .cart-pay-cash, .mobile-cart-sheet .cart-payment-methods, .mobile-cart-sheet [data-cart-payment]");
      payArea?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }, 250);
    return () => clearTimeout(t);
  }, [cartSheetOpen, sheetMode]);

  const updatePatient = (next) => {
    setPatients(ps => ps.map(p => p.id === next.id ? next : p));
  };

  // Hotkey for cheatsheet
  useKeydown((e) => {
    if (e.key !== "?") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingTarget()) return;
    const overlays = document.querySelectorAll(".modal-overlay");
    if (overlays.length > 0) return;
    e.preventDefault();
    setCheatsheetOpen(true);
  }, []);

  useKeydown((e) => {
    const match = /^F([1-6])$/.exec(e.key || "");
    if (!match) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (isTypingTarget()) return;
    if (window.matchMedia?.("(max-width: 767px)").matches) return;
    const hasVisibleOverlay = Array.from(document.querySelectorAll(".modal-overlay, .mobile-step-sheet, .mobile-cart-sheet"))
      .some(el => el.offsetParent !== null || el.getClientRects().length > 0);
    if (hasVisibleOverlay) return;
    const targetStep = Number(match[1]);
    e.preventDefault();
    if (targetStep !== currentStep && canNavigateToStep(targetStep, currentStep, gate)) {
      setCurrentStep(targetStep);
    }
  }, [currentStep, gate, activeId]);

  const pushToast = (text, tone = "success", options = {}) => {
    const id = toastIdRef.current++;
    setToasts(ts => [...ts, { id, text, tone, ...options }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 3500);
  };
  const closeToast = (id) => setToasts(ts => ts.filter(t => t.id !== id));

  const startNewWalkIn = () => {
    if (isPristineBlankPatient(active)) {
      const reset = blankPatient(active.id, active.queueNumber, active.avatarColor);
      updatePatient(reset);
      setWizardStepMap(m => ({ ...m, [active.id]: 1 }));
      setActiveId(active.id);
      setCartSheetOpen(false);
      setMobileNavOpen(false);
      setSheetMode("cart");
      pushToast(`Ready for new patient · ${reset.queueNumber}`);
      return;
    }
    const next = createBlankReceptionSlot();
    pushToast(`Ready for new patient · ${next.queueNumber}`);
  };

  useKeydown((e) => {
    const key = (e.key || "").toLowerCase();
    if (key !== "n" || e.altKey || e.shiftKey || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    if (document.querySelector(".modal-overlay")) return;
    startNewWalkIn();
  }, [active, patients]);

  // [ — toggle cart focus mode (desktop). Skip when typing or modal open.
  useKeydown((e) => {
    if (e.key !== "[" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTypingTarget()) return;
    if (document.querySelector(".modal-overlay")) return;
    e.preventDefault();
    toggleCartFocus();
  }, [cartFocused]);

  const sendIntakeLink = (patientArg = active) => {
    const target = patientArg || active;
    const mobileTarget = target.mobile || `${target.countryCode || "+855"} ${target.phoneNumber || ""}`.trim();
    pushToast("Intake link sent to " + (mobileTarget || "patient"), "success");
    const next = {
      ...target,
      pwaSent: true,
      pwaSentAt: "just now",
      status: { tone: "info", label: "PWA sent" },
      pwaLog: [
        { type: "sent", text: "Link sent by SMS", time: "just now", state: "ok" },
        ...(target.pwaLog || []).filter(l => !l.text.startsWith("Link sent")),
      ],
    };
    updatePatient(next);
  };

  const handleStationChange = (id) => { setStation(id); pushToast(`Station switched to ${id}`); };
  const handleShiftChange = (id) => {
    setShift(id);
    const labels = { morning: "Morning", afternoon: "Afternoon", night: "Night" };
    pushToast(`Shift set to ${labels[id]}`);
  };
  const handleMarkAllRead = () => {
    setNotifs(ns => ns.map(n => ({ ...n, read: true })));
    pushToast("All notifications marked as read");
  };
  const handleNotifAction = (n) => {
    setNotifs(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x));
    if (n.patientId) {
      setActiveId(n.patientId);
      pushToast(`Opened patient ${patients.find(p => p.id === n.patientId)?.name || n.patientId}`);
    }
  };
  const handleNotifClick = (n) => {
    setNotifs(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x));
    if (n.patientId) setActiveId(n.patientId);
  };
  const handleUserAction = (id) => {
    if (id === "signout") pushToast("Signed out (mock)", "error");
    else if (id === "profile") pushToast("Open profile drawer");
    else if (id === "preferences") pushToast("Open preferences");
    else if (id === "help") pushToast("Open help & shortcuts");
  };
  const openPatientAtIdentity = (id) => {
    setActiveId(id);
    // Search is an identity-first entry point: confirm the person before
    // continuing orders, payer, or payment work for this visit.
    setWizardStepMap(m => ({ ...m, [id]: 1 }));
  };
  const handleSearch = (id) => {
    openPatientAtIdentity(id);
    const p = patients.find(x => x.id === id);
    if (p) pushToast(`Opened ${p.name} · ${p.queueNumber}`);
  };
  const handleNavigate = (id) => {
    setActiveNav(id);
    if (id !== "reception") pushToast(`${id.charAt(0).toUpperCase() + id.slice(1)} screen — coming soon`);
  };

  const handleStepClick = (n) => {
    const targetStep = Number(n);
    if (!Number.isInteger(targetStep) || targetStep < 1 || targetStep > 6) return;
    const targetStatus = gate.stepStatus?.[targetStep];
    const targetUnlocked = !!targetStatus && targetStatus !== "locked";
    if (canNavigateToStep(targetStep, currentStep, gate) || targetUnlocked) setCurrentStep(targetStep);
  };

  const handleNext = () => {
    if (currentStep < 6) setCurrentStep(currentStep + 1);
  };
  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // CTA: complete check-in — fired from the cart rail / Step 6 after payment is resolved or deferred.
  const handleCheckIn = (patientOverride = active) => {
    const target = patientOverride || active;
    const checkInBlockers = checkInBlockersFor(target);
    if (checkInBlockers.length > 0) {
      openSheet("cart");
      const extra = checkInBlockers.length > 1 ? ` +${checkInBlockers.length - 1} more` : "";
      pushToast(`${checkInBlockers[0]}${extra}`, "error");
      return;
    }
    pushToast(`${target.name} checked in · ${target.queueNumber}`, "success");
    updatePatient({
      ...target,
      checkedInAt: new Date().toISOString(),
      status: { tone: "success", label: "Checked in" },
    });
    createBlankReceptionSlot();
  };
  const handleNextPatient = () => {
    const next = createBlankReceptionSlot();
    pushToast(`Ready for new patient · ${next.queueNumber}`, "success");
  };

  // Mobile bottom dock — semantic states the nurse can see at a glance.
  // Test ordering is deliberately a persistent quick action, independent
  // from the state-aware CTA. A nurse should never have to navigate to Step 4
  // just to open the test menu on a phone.
  // The CTA action is decoupled from the row tap: tapping the row always
  // opens the sheet; the CTA does the next correct action for the state.
  //
  //   empty       → row tap / CTA opens the Add tab directly.
  //   review-gate → has items but verification missing.
  //                 row tap = open cart so nurse sees the blocker;
  //                 CTA "Review" = jump to the missing review/payer step.
  //   pay         → has items, ready to pay.
  //                 row tap = open cart; CTA "Pay" = payment tab.
  //   waiting     → KHQR or cash mid-flow.
  //                 row tap = open cart; CTA "Waiting…" disabled.
  //   paid        → payment confirmed, ready to check in.
  //                 row tap = receipt; CTA "Check in" calls handleCheckIn.
  //   done        → checked in; CTA moves to the next patient.
  //
  const isContactVerified = !!(active.otpVerified || active.telegramVerified);
  const pendingValidationCount = activeCart.items.filter(i => i.kind === "imaging" && !isValidationResolved(i)).length;
  const cartReadyForPayment = activeItemCount > 0 && gate.step2Done && gate.step5Done && payerReadyForPayment;
  const cartPaymentResolved = cartPaid || cartPayLater || (cartNoCharge && cartReadyForPayment);
  const cartReadyForCheckIn = patientReadyForCheckIn(active);
  const isCheckedIn = !!active.checkedInAt || active.status?.label === "Checked in";
  const paymentWaiting = activeCart.payment?.status === "waiting";
  const reviewTargetStep = !gate.step2Done ? 2 : (!payerReadyForPayment ? 3 : (pendingValidationCount > 0 ? 4 : (!gate.step5Done ? 5 : 4)));
  const blockerCopy = !gate.step2Done
    ? "Review patient before payment"
    : !payerReadyForPayment
      ? "Select payer before payment"
      : pendingValidationCount > 0
        ? "Resolve consent before check-in"
        : !gate.step5Done
          ? "Book or skip teleconsult before payment"
          : "Review order before payment";
  let dockState;
  if (isCheckedIn) dockState = "done";
  else if (activeItemCount === 0) dockState = "empty";
  else if (cartPaymentResolved) dockState = "paid";
  else if (paymentWaiting) dockState = "waiting";
  else if (!cartReadyForPayment) dockState = "review-gate";
  else dockState = "pay";

  // === Single "what next?" answer for the patient header ===
  // The pill must be clickable and land the user on a step they can act on.
  // It jumps directly to any unlocked target, while the stepper can stay
  // stricter and sequential. The label names the most pressing blocker for
  // that step. Deep blockers only surface once their gating step is done.
  const nextAction = (() => {
    if (isCheckedIn) return { label: "Checked in", target: currentStep, tone: "success", icon: "CheckCircle" };
    // Step-specific blocker copy, evaluated in step order.
    if (!gate.step1Done) return { label: "Capture identity", target: 1, tone: "warn", icon: "User" };
    if (!gate.step2Done) return { label: "Verify patient", target: 2, tone: "warn", icon: "AlertCircle" };
    if (!gate.step3Done) return { label: "Choose insurance", target: 3, tone: "warn", icon: "Shield", selector: '[data-next-action="insurance"]' };
    if (activeItemCount === 0) return { label: "Add orders", target: 4, tone: "warn", icon: "Plus" };
    if (!payerReadyForPayment) return { label: "Choose payer", target: 4, tone: "warn", icon: "Shield" };
    if (pendingValidationCount > 0) return { label: "Resolve consent", target: 4, tone: "warn", icon: "AlertCircle", selector: '[data-next-action="imaging-consent"]' };
    if (!gate.step5Done) return { label: "Book teleconsult", target: 5, tone: "warn", icon: "Video", selector: '[data-next-action="teleconsult"]' };
    if (paymentWaiting) return { label: "Waiting on payment", target: 6, tone: "info", icon: "Clock" };
    if (!cartPaymentResolved) return { label: "Take payment", target: 6, tone: "warn", icon: "CreditCard" };
    return { label: "Ready to check in", target: 6, tone: "success", icon: "CheckCircle" };
  })();

  let cartBarTitle, cartBarSub, cartBarCta, dockCtaDisabled = false;
  if (dockState === "done") {
    cartBarTitle = `Checked in · ${active.queueNumber}`;
    cartBarSub = activeCart.payment?.receiptId ? `Receipt ${activeCart.payment.receiptId}` : "Receipt sent";
    cartBarCta = "Next";
  } else if (dockState === "empty") {
    cartBarTitle = "Order tests";
    cartBarSub = "Search menu, packages, previous";
    cartBarCta = "Add";
  } else if (dockState === "review-gate") {
    cartBarTitle = `${activeItemCount} order${activeItemCount === 1 ? "" : "s"} · $${activeTotals.total.toFixed(2)}`;
    cartBarSub = blockerCopy;
    cartBarCta = "Review";
  } else if (dockState === "waiting") {
    cartBarTitle = `${activeItemCount} order${activeItemCount === 1 ? "" : "s"} · $${activeTotals.total.toFixed(2)}`;
    cartBarSub = "Waiting for payment…";
    cartBarCta = "Waiting…";
    dockCtaDisabled = true;
  } else if (dockState === "paid") {
    cartBarTitle = cartReadyForCheckIn
      ? (cartNoCharge && !cartPaid && !cartPayLater ? "No charge · ready" : (cartPayLater ? "Pay later · ready" : "Paid · receipt ready"))
      : (cartNoCharge && !cartPaid && !cartPayLater ? "No charge · needs review" : (cartPayLater ? "Pay later · needs review" : "Paid · needs review"));
    cartBarSub = `${activeItemCount} order${activeItemCount === 1 ? "" : "s"} · $${activeTotals.total.toFixed(2)}`;
    cartBarCta = "Check in";
  } else {
    // dockState === "pay"
    cartBarTitle = `${activeItemCount} order${activeItemCount === 1 ? "" : "s"} · $${activeTotals.total.toFixed(2)}`;
    cartBarSub = activeTotals.discount > 0 ? `Saved $${activeTotals.discount.toFixed(2)}` : "Ready to pay";
    cartBarCta = "Pay";
  }

  // What happens when the nurse taps the CTA — depends on the state.
  // Row taps (the summary area) always open the sheet so the nurse can see
  // the cart, even if the CTA does something else.
  const handleDockRowTap = () => {
    if (dockState === "empty") {
      // Empty cart: open sheet directly in Add tab so the nurse can search/
      // pick a test without leaving their current step. Step 4 still works
      // as the wizard's order workspace, but is no longer the only path.
      openSheet("add");
    } else if (dockState === "paid" || dockState === "done") {
      openSheet("receipt"); // shows receipt + lets nurse review blockers/check-in
    } else {
      openSheet("cart");
    }
  };
  const handleDockCta = (e) => {
    e.stopPropagation();
    if (dockState === "empty") {
      openSheet("add");
    } else if (dockState === "done") {
      handleNextPatient();
    } else if (dockState === "review-gate") {
      // Missing identity/contact or payer needs the wizard. Consent/order
      // blockers stay in the cart so the nurse sees the exact row.
      if (pendingValidationCount > 0) openSheet("cart");
      else if (currentStep !== reviewTargetStep) setCurrentStep(reviewTargetStep);
      else openSheet("cart");
    } else if (dockState === "paid") {
      // Direct check-in when ready. Fall back to opening the receipt view
      // if something else is missing so the nurse sees the exact blocker.
      if (cartReadyForCheckIn) handleCheckIn();
      else openSheet("receipt");
    } else if (dockState === "pay") {
      openSheet("pay"); // lands on payment area
    } else {
      openSheet("cart");
    }
  };

  return (
    <div
      className={
        "app app-v2"
        + (mobileNavOpen ? " mobile-nav-open" : "")
        + (cartSheetOpen ? " mobile-cart-open" : "")
      }
      data-screen-label="Reception"
      data-cart-count={activeItemCount}
      data-cart-paid={cartPaymentResolved ? "true" : "false"}
    >
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        active={activeNav}
        onNavigate={handleNavigate}
        lang={uiLang}
        onLangChange={setUiLang}
        mobileOpen={mobileNavOpen}
        onMobileClose={closeMobileNav}
        onTestBlankState={startNewWalkIn}
      />
      {mobileNavOpen && (
        <button
          type="button"
          className="mobile-nav-scrim"
          aria-label="Close navigation"
          onClick={closeMobileNav}
        />
      )}
      <div className={"main main-step-" + currentStep} inert={mobileNavOpen ? "" : undefined}>
        <Topbar
          onMenuClick={() => setMobileNavOpen(true)}
          menuButtonRef={mobileMenuButtonRef}
          onNewWalkIn={startNewWalkIn}
          notifications={notifs.filter(n => !n.read).length}
          station={station}
          onStationChange={handleStationChange}
          shift={shift}
          onShiftChange={handleShiftChange}
          notifs={notifs}
          onMarkAllRead={handleMarkAllRead}
          onNotifAction={handleNotifAction}
          onNotifClick={handleNotifClick}
          onUserAction={handleUserAction}
          patients={patients}
          onSearch={handleSearch}
        />

        <PatientHeader
          patient={active}
          gate={gate}
          currentStep={currentStep}
          onStepClick={handleStepClick}
          nextAction={isBlankState ? null : nextAction}
        />

        <WizardProgress
          currentStep={currentStep}
          gate={gate}
          onStepClick={handleStepClick}
        />

        <div className={"wizard-workspace wizard-workspace-step-" + currentStep}>
          <div className="wizard-content">
            {currentStep === 1 && (
              <Step1Identity
                patient={active}
                onUpdate={updatePatient}
                onNext={handleNext}
                onPushToast={pushToast}
                allPatients={patients.filter(p => p.id !== active.id && p.name)}
                onSelectPatient={openPatientAtIdentity}
                gate={gate}
                blankState={isBlankState}
              />
            )}
            {currentStep === 2 && (
              <Step2Review
                patient={active}
                onUpdate={updatePatient}
                onNext={handleNext}
                onPrev={handlePrev}
                onPushToast={pushToast}
                gate={gate}
                allPatients={patients.filter(p => p.id !== active.id && p.name)}
                onSelectPatient={openPatientAtIdentity}
              />
            )}
            {currentStep === 3 && (
              <Step3Insurance
                patient={active}
                onUpdate={updatePatient}
                onNext={handleNext}
                onPrev={handlePrev}
                onPushToast={pushToast}
                gate={gate}
              />
            )}
            {currentStep === 4 && (
              <Step4Orders
                patient={active}
                onUpdate={updatePatient}
                onNext={handleNext}
                onPrev={handlePrev}
                onPushToast={pushToast}
                gate={gate}
                requestPaidEdit={requestPaidEdit}
              />
            )}
            {currentStep === 5 && (
              <Step5Teleconsult
                patient={active}
                onUpdate={updatePatient}
                onNext={handleNext}
                onPrev={handlePrev}
                onPushToast={pushToast}
                gate={gate}
              />
            )}
            {currentStep === 6 && (
              <Step6Payment
                patient={active}
                onUpdate={updatePatient}
                onNext={handleCheckIn}
                onPrev={handlePrev}
                onPushToast={pushToast}
                onCheckIn={handleCheckIn}
                onSendIntake={sendIntakeLink}
                gate={gate}
                payerReady={payerReadyForPayment}
              />
            )}
          </div>

          <div className={"wizard-cart-rail" + (cartSheetOpen ? " is-open" : "")}>
            {/* Mobile bottom dock — desktop hides via CSS.
               Two tap targets: row (summary) opens the sheet, CTA does the
               state-correct next action. The dock is non-interactive on
               desktop so this stays clean for keyboard users on the rail. */}
            <div
              className={"mobile-cart-bar mobile-cart-bar-state-" + dockState}
              data-dock-state={dockState}
            >
              <button
                type="button"
                className="mobile-cart-bar-add"
                onClick={(e) => { e.stopPropagation(); openSheet("add"); }}
                aria-expanded={cartSheetOpen && sheetMode === "add"}
                aria-controls="mobile-cart-sheet"
                aria-label="Add orders"
                title="Add orders"
              >
                <I.Plus size={20} strokeWidth={2.7} />
              </button>
              <button
                type="button"
                ref={dockSummaryRef}
                className="mobile-cart-bar-summary"
                onClick={handleDockRowTap}
                aria-expanded={cartSheetOpen}
                aria-controls="mobile-cart-sheet"
                aria-label={`${cartBarTitle}. ${cartBarSub}. Open order cart.`}
              >
                <span className="mobile-cart-bar-icon" aria-hidden="true">
                  <I.ShoppingCart size={16} />
                  {activeItemCount > 0 && (
                    <span className="mobile-cart-bar-count">{activeItemCount}</span>
                  )}
                </span>
                <span className="mobile-cart-bar-text">
                  <span className="mobile-cart-bar-title">{cartBarTitle}</span>
                  <span className="mobile-cart-bar-sub">{cartBarSub}</span>
                </span>
              </button>
              <button
                type="button"
                className="mobile-cart-bar-cta"
                onClick={handleDockCta}
                disabled={dockCtaDisabled}
                aria-label={cartBarCta}
              >
                {cartBarCta}
              </button>
            </div>

            {/* Scrim is rendered always so the fade transition stays clean;
               CSS hides it unless the sheet is open. */}
            <button
              type="button"
              className="mobile-cart-scrim"
              aria-label="Close cart"
              tabIndex={cartSheetOpen ? 0 : -1}
              onClick={closeSheet}
            />

            <div
              id="mobile-cart-sheet"
              ref={cartSheetRef}
              className={"mobile-cart-sheet mobile-cart-sheet-mode-" + sheetMode}
              role={cartSheetOpen ? "dialog" : undefined}
              aria-modal={cartSheetOpen ? "true" : undefined}
              aria-label="Order cart"
              aria-hidden={cartSheetOpen ? undefined : "true"}
              inert={cartSheetOpen ? undefined : ""}
            >
              <div className="mobile-cart-sheet-head">
                <div className="mobile-cart-grabber" aria-hidden="true" />
                {/* Tab strip — Add, Cart, Pay, Receipt match the mobile dock modes. */}
                <div className="mobile-cart-tabs" role="tablist" aria-label="Cart sections">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sheetMode === "add"}
                    className={"mobile-cart-tab" + (sheetMode === "add" ? " is-active" : "")}
                    onClick={() => setSheetMode("add")}
                  >
                    <I.Plus size={13} /> Add
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sheetMode === "cart"}
                    data-mobile-cart-tab="cart"
                    className={"mobile-cart-tab" + (sheetMode === "cart" ? " is-active" : "")}
                    onClick={() => setSheetMode("cart")}
                  >
                    <I.ShoppingCart size={13} /> Cart
                    {activeItemCount > 0 && (
                      <span className="mobile-cart-tab-count">{activeItemCount}</span>
                    )}
                  </button>
	                  <button
	                    type="button"
	                    role="tab"
	                    aria-selected={sheetMode === "pay"}
	                    className={"mobile-cart-tab" + (sheetMode === "pay" ? " is-active" : "")}
	                    onClick={() => setSheetMode("pay")}
	                    disabled={activeItemCount === 0 || cartPaymentResolved || !cartReadyForPayment}
	                  >
	                    <I.CreditCard size={13} /> Pay
	                  </button>
	                  <button
	                    type="button"
	                    role="tab"
	                    aria-selected={sheetMode === "receipt"}
	                    className={"mobile-cart-tab" + (sheetMode === "receipt" ? " is-active" : "")}
	                    onClick={() => setSheetMode("receipt")}
	                    disabled={!cartPaid && !isCheckedIn}
	                  >
	                    <I.Receipt size={13} /> Receipt
	                  </button>
	                  <button
	                    type="button"
	                    ref={cartSheetCloseRef}
	                    className="mobile-cart-sheet-close"
	                    aria-label="Close cart"
	                    onClick={closeSheet}
	                  >
                    <I.X size={16} />
                  </button>
                </div>
              </div>

              {/* Add tab — embeds the same AddTestsPanel Step 4 uses, so a
                 nurse can stage orders from any step without navigating. */}
              {sheetMode === "add" && (
                <div className="mobile-cart-sheet-body mobile-cart-sheet-body-add">
                  <AddTestsPanel
                    patient={active}
                    onAdd={addBulk}
	                    onPushToast={pushToast}
	                    ccy={activeCart.ccy || "USD"}
	                    onCcyToggle={(next) => guardCartEdit(active, `Change receipt currency to ${next} on a paid visit?`, (mode) => {
	                      updatePatient({
	                        ...active,
	                        cart: {
	                          ...activeCart,
	                          ccy: next,
	                          payment: paymentAfterPaidEdit(activeCart.payment, mode),
	                        },
	                      });
	                    })}
	                  />
	                </div>
	              )}

              {/* Cart + Pay both render the OrderCart — Pay just auto-scrolls
                 to the payment region on mode entry (handled by the cart's
                 internal layout: items first, payment area below). */}
              {(sheetMode === "cart" || sheetMode === "pay" || sheetMode === "receipt") && (
                <div className="mobile-cart-sheet-body">
                  <OrderCart
                    patient={active}
                    onUpdate={updatePatient}
                    onPushToast={pushToast}
                    onCheckIn={handleCheckIn}
                    identityComplete={gate.step2Done}
	                    currentStep={currentStep}
                    requestPaidEdit={requestPaidEdit}
	                    onOpenAdd={() => setSheetMode("add")}
                    onOpenPay={() => setSheetMode("pay")}
	                    payerReady={payerReadyForPayment}
	                    blankState={isBlankState}
                  />
                </div>
              )}
            </div>

            <div
              className="desktop-cart-rail-body"
              data-cart-focused={cartFocused ? "1" : undefined}
            >
              <OrderCart
                patient={active}
                onUpdate={updatePatient}
                onPushToast={pushToast}
                onCheckIn={handleCheckIn}
                identityComplete={gate.step2Done}
                currentStep={currentStep}
                requestPaidEdit={requestPaidEdit}
                onOpenAdd={() => {
                  if (canNavigateToStep(4, currentStep, gate)) {
                    setCurrentStep(4);
                  } else {
                    setCurrentStep(!gate.step2Done ? 2 : 3);
                    pushToast("Complete review before adding orders", "error");
                  }
                }}
                onOpenPay={() => setSheetMode("pay")}
                payerReady={payerReadyForPayment}
                blankState={isBlankState}
                cartFocused={cartFocused}
                onToggleFocus={toggleCartFocus}
              />
              {currentStep === 4 && (
                <VisitContextBlock patient={active} className="visit-context-rail" />
              )}
            </div>
          </div>
        </div>
      </div>

      <HotkeyCheatsheetModal open={cheatsheetOpen} onClose={() => setCheatsheetOpen(false)} />
      <PaidEditModal pending={paidEditPending} onResolve={resolvePaidEdit} onCancel={cancelPaidEdit} />
      <ToastStack toasts={toasts} onClose={closeToast} />

    </div>
  );
}

function isPristineBlankPatient(patient = {}) {
  const defaultOrderIds = new Set(["vit-pkg", "telecon"]);
  const items = patient.cart?.items || [];
  const hasOnlyDefaultOrders = items.every(item => item.auto || defaultOrderIds.has(item.id));
  return (
    !patient.name &&
    !patient.dob &&
    !patient.sexAtBirth &&
    !patient.idNumber &&
    !patient.phoneNumber &&
    !patient.mobile &&
    !patient.telegramHandle &&
    !(patient.visitReason || []).length &&
    !patient.otpVerified &&
    !patient.telegramVerified &&
    !patient.idScanned &&
    !patient.manualEntry &&
    !patient.identity?.source &&
    hasOnlyDefaultOrders
  );
}

// === PaidEditModal — safety net for editing a paid cart ===
//   Shown when the nurse tries to add or remove an item after payment was
//   already confirmed. Three explicit choices keep receipts honest:
//     - Supplemental: keep the existing receipt, append the change.
//     - Void & recompute: drop payment.confirmed back to idle.
//     - Cancel: do nothing, the visit stays as it was.
function PaidEditModal({ pending, onResolve, onCancel }) {
  if (!pending) return null;
  return (
    <div className="modal-overlay" onClick={onCancel} role="presentation">
      <div className="modal paid-edit-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="paid-edit-title">
        <div className="modal-head">
          <h2 id="paid-edit-title" className="modal-title">
            <I.AlertTriangle size={16} style={{ color: "var(--warn-600)", marginRight: 6, verticalAlign: "-3px" }} />
            Visit already paid
          </h2>
        </div>
        <div className="modal-body" style={{ padding: "10px 16px 14px" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-700)", lineHeight: 1.5 }}>
            {pending.description || "You're editing a paid cart."} What should happen to the receipt?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "flex-start", height: 48 }}
              onClick={() => onResolve("supplemental")}
            >
              <I.Plus size={14} />
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
                <strong>Create payment adjustment</strong>
                <small style={{ fontSize: 11, opacity: 0.85, fontWeight: 500 }}>Keep prior receipt, collect or resolve the difference</small>
              </span>
            </button>
            <button
              type="button"
              className="btn btn-danger-ghost"
              style={{ width: "100%", justifyContent: "flex-start", height: 48 }}
              onClick={() => onResolve("void")}
            >
              <I.RotateCcw size={14} />
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
                <strong>Void receipt &amp; recompute</strong>
                <small style={{ fontSize: 11, opacity: 0.85, fontWeight: 500 }}>Recollect payment for the new total</small>
              </span>
            </button>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
