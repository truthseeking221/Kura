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
import React, { useState, useRef, useMemo } from "react";
import { I } from "./icons";
import { initialPatients, initialNotifications, blankPatient } from "./data";
import { Sidebar, Topbar, GoalBar } from "./Layout";
import { OrderCart } from "./OrderCart";
import { useKeydown, isTypingTarget } from "./shared";
import {
  NewWalkInModal,
  HotkeyCheatsheetModal,
  ToastStack,
} from "./Modals";
import { LangProvider, useLang } from "./i18n";
import { WizardProgress, PatientHeader, useWizardGate } from "./Wizard";
import { Step1Identity, Step2Review, Step3Insurance, Step4Orders } from "./Steps";

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
  const [collapsed, setCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState("reception");
  const [uiLang, setUiLang] = useState("English");

  // Per-patient wizard step (default to inferred step on first load)
  const [wizardStepMap, setWizardStepMap] = useState({});

  const [walkInOpen, setWalkInOpen] = useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);

  const [station, setStation] = useState("PSC-01");
  const [shift, setShift] = useState("morning");
  const [notifs, setNotifs] = useState(initialNotifications);

  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(1);

  const active = patients.find(p => p.id === activeId) || patients[0];
  const gate = useWizardGate(active);

  // Infer initial step from gate (resume where they left off).
  // Step 4 is the final step; payment is taken in the cart rail.
  const inferStep = (g) => {
    if (!g.step1Done) return 1;
    if (!g.step2Done) return 2;
    if (!g.step3Done) return 3;
    return 4;
  };
  const currentStep = wizardStepMap[activeId] ?? inferStep(gate);
  const setCurrentStep = (n) => setWizardStepMap(m => ({ ...m, [activeId]: n }));

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

  const pushToast = (text, tone = "success") => {
    const id = toastIdRef.current++;
    setToasts(ts => [...ts, { id, text, tone }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 3500);
  };
  const closeToast = (id) => setToasts(ts => ts.filter(t => t.id !== id));

  const sendIntakeLink = () => {
    pushToast("Intake link sent to " + active.mobile, "success");
    const next = {
      ...active,
      pwaSentAt: "just now",
      status: { tone: "info", label: "PWA sent" },
      pwaLog: [
        { type: "sent", text: "Link sent by SMS", time: "just now", state: "ok" },
        ...(active.pwaLog || []).filter(l => !l.text.startsWith("Link sent")),
      ],
    };
    updatePatient(next);
  };

  const handleCreateWalkIn = (form) => {
    const id = "p" + (patients.length + 1);
    const initials = (form.name || "?").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
    const colors = ["av-blue","av-teal","av-purple","av-amber","av-pink","av-green"];
    const newP = {
      id, name: form.name, gender: "—", age: 0, initials,
      avatarColor: colors[patients.length % colors.length],
      arrivedAt: "just now",
      arrivedRaw: "Today, just now",
      queueNumber: "Q-" + String(43 + patients.length).padStart(3, "0"),
      status: { tone: "info", label: "Awaiting check-in" },
      visitReason: Array.isArray(form.visitReason) ? form.visitReason : [form.visitReason].filter(Boolean),
      language: form.language || "Khmer",
      mobile: (form.countryCode || "+855") + " " + (form.phoneNumber || ""),
      countryCode: form.countryCode || "+855",
      phoneNumber: form.phoneNumber || "",
      dob: form.dob,
      sexAtBirth: form.sexAtBirth || "",
      payer: "direct",
      documents: { id: "pending", consent: "pending", insurance: "pending", receipt: "pending" },
      pwaProgress: 0,
      pwaLog: [],
      services: [], handoff: 0,
      handoffStates: ["in-progress","pending","pending","pending"],
      identity: { verified: false, source: null, lockedFields: [] },
      cart: { items: [], promos: {}, splits: null, ccy: "USD", payment: { method: null, status: "idle", tendered: "" }, pregnancyConsent: null },
      insurance: [],
      priorResults: [],
    };
    setPatients(ps => [newP, ...ps]);
    setActiveId(id);
    setWizardStepMap(m => ({ ...m, [id]: 1 }));
    setWalkInOpen(false);
    pushToast(`${form.name} added · ${newP.queueNumber}`);
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
  const handleSearch = (id) => {
    setActiveId(id);
    const p = patients.find(x => x.id === id);
    if (p) pushToast(`Opened ${p.name} · ${p.queueNumber}`);
  };
  const handleNavigate = (id) => {
    setActiveNav(id);
    if (id !== "reception") pushToast(`${id.charAt(0).toUpperCase() + id.slice(1)} screen — coming soon`);
  };

  const handleStepClick = (n) => {
    // Allow navigation only to completed steps or current/next-available
    if (n < currentStep) return setCurrentStep(n);
    if (n === currentStep) return;
    if (n === currentStep + 1) {
      const stepDoneKey = "step" + currentStep + "Done";
      if (gate[stepDoneKey]) setCurrentStep(n);
    }
  };

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };
  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // CTA: complete check-in — fired from the cart rail once payment is confirmed.
  const handleCheckIn = () => {
    pushToast(`${active.name} checked in · ${active.queueNumber}`, "success");
    updatePatient({ ...active, status: { tone: "success", label: "Checked in" } });
  };

  return (
    <div className="app app-v2" data-screen-label="Reception">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        active={activeNav}
        onNavigate={handleNavigate}
        lang={uiLang}
        onLangChange={setUiLang}
      />
      <div className="main">
        <Topbar
          onNewWalkIn={() => setWalkInOpen(true)}
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

        <PatientHeader patient={active} gate={gate} />

        <WizardProgress
          currentStep={currentStep}
          gate={gate}
          onStepClick={handleStepClick}
        />

        <div className="wizard-workspace">
          <div className="wizard-content">
            {currentStep === 1 && (
              <Step1Identity
                patient={active}
                onUpdate={updatePatient}
                onNext={handleNext}
                onPushToast={pushToast}
                allPatients={patients.filter(p => p.id !== active.id && p.name)}
                onSelectPatient={setActiveId}
                gate={gate}
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
                onSendIntake={sendIntakeLink}
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
                onPrev={handlePrev}
                onPushToast={pushToast}
                gate={gate}
              />
            )}
          </div>

          <div className="wizard-cart-rail">
            <OrderCart
              patient={active}
              onUpdate={updatePatient}
              onPushToast={pushToast}
              onCheckIn={handleCheckIn}
              identityComplete={gate.step2Done}
              currentStep={currentStep}
            />
          </div>
        </div>

        <GoalBar onLearnMore={() => pushToast("Open product tour")} />
      </div>

      <NewWalkInModal open={walkInOpen} onClose={() => setWalkInOpen(false)} onCreate={handleCreateWalkIn} />
      <HotkeyCheatsheetModal open={cheatsheetOpen} onClose={() => setCheatsheetOpen(false)} />
      <ToastStack toasts={toasts} onClose={closeToast} />

      {/* Dev tester */}
      <DebugBlankStateButton
        onReset={() => {
          const reset = blankPatient(active.id, active.queueNumber, active.avatarColor);
          updatePatient(reset);
          setWizardStepMap(m => ({ ...m, [active.id]: 1 }));
          pushToast("Blank state — start at Step 1");
        }}
      />
    </div>
  );
}

function DebugBlankStateButton({ onReset }) {
  return (
    <button
      type="button"
      onClick={onReset}
      className="debug-blank-btn"
      title="Reset to first-arrival blank state (dev only)"
    >
      <I.Sparkles size={12} />
      <span>Test blank state</span>
    </button>
  );
}
