// === Kura Reception — App ===
import React, { useState, useRef } from "react";
import { I } from "./icons";
import { initialPatients, payerOptions, initialNotifications, blankPatient } from "./data";
import { Sidebar, Topbar, GoalBar } from "./Layout";
import { FastCheckIn } from "./Center";
import { VisitDetails, Insurance, PriorResults } from "./Cards";
import { OrderCart } from "./OrderCart";
import { TatTimeline, TeleconsultCard } from "./shared";
import {
  NewWalkInModal,
  AddServiceModal,
  ConfirmConsentModal,
  ToastStack,
} from "./Modals";
import { LangProvider, useLang } from "./i18n";

function ExceptionBanner({ patient, onResolve, onSkip }) {
  const t = useLang();
  return (
    <div className="card" style={{ borderColor: "var(--danger-100)", background: "linear-gradient(0deg, rgba(216,58,58,0.04), rgba(216,58,58,0.04)), white" }}>
      <div className="card-pad" style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--danger-50)", color: "var(--danger-600)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <I.AlertTriangle size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 650, color: "var(--ink-900)" }}>{t("exception.title")}</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-600)", marginTop: 2 }}>
            {patient.name} {t("exception.body")}
          </div>
        </div>
        <button className="btn btn-ghost" style={{ borderColor: "var(--danger-100)", color: "var(--danger-600)" }} onClick={onSkip}>
          {t("exception.skip")}
        </button>
        <button className="btn btn-primary" style={{ background: "var(--danger-500)" }} onClick={onResolve}>
          <I.Check size={15} /> {t("exception.resolve")}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [patients, setPatients] = useState(initialPatients);
  const [activeId, setActiveId] = useState("p1");
  const [collapsed, setCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState("reception");
  const [uiLang, setUiLang] = useState("Khmer");

  const [sending, setSending] = useState(false);
  const [sentFlash, setSentFlash] = useState(false);

  const [walkInOpen, setWalkInOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  const [station, setStation] = useState("PSC-01");
  const [shift, setShift] = useState("morning");
  const [notifs, setNotifs] = useState(initialNotifications);

  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(1);

  const active = patients.find(p => p.id === activeId) || patients[0];

  const updatePatient = (next) => {
    setPatients(ps => ps.map(p => p.id === next.id ? next : p));
  };

  const pushToast = (text, tone = "success") => {
    const id = toastIdRef.current++;
    setToasts(ts => [...ts, { id, text, tone }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 3500);
  };
  const closeToast = (id) => setToasts(ts => ts.filter(t => t.id !== id));

  const sendIntakeLink = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSentFlash(true);
      pushToast("Intake link sent to " + active.mobile, "success");
      const next = {
        ...active,
        status: { tone: "info", label: "PWA sent" },
        pwaLog: [{ type: "sent", text: "Link sent by SMS", time: "just now", state: "ok" }, ...active.pwaLog.filter(l => !l.text.startsWith("Link sent"))],
      };
      updatePatient(next);
      setTimeout(() => setSentFlash(false), 1200);
    }, 1100);
  };

  const handleAddServices = (picks) => {
    const next = {
      ...active,
      services: [
        ...active.services,
        ...picks.map(p => ({ name: p.name, payer: payerOptions.find(po => po.id === active.payer)?.name || "Direct Pay", status: "draft", amount: p.price }))
      ]
    };
    updatePatient(next);
    setServiceOpen(false);
    pushToast(`${picks.length} service${picks.length > 1 ? "s" : ""} added`);
  };

  const removeService = (i) => {
    const next = { ...active, services: active.services.filter((_, idx) => idx !== i) };
    updatePatient(next);
  };

  const setPayer = (id) => {
    updatePatient({ ...active, payer: id, services: active.services.map(s => ({ ...s, payer: payerOptions.find(po => po.id === id).name })) });
    pushToast(`Payer set to ${payerOptions.find(po => po.id === id).name}`);
  };

  const handleCreateWalkIn = (form) => {
    const id = "p" + (patients.length + 1);
    const initials = form.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
    const colors = ["av-blue","av-teal","av-purple","av-amber","av-pink","av-green"];
    const newP = {
      id, name: form.name, gender: "—", age: 0, initials,
      avatarColor: colors[patients.length % colors.length],
      arrivedAt: "just now",
      arrivedRaw: "Today, just now",
      queueNumber: "Q-" + String(43 + patients.length).padStart(3, "0"),
      status: { tone: "info", label: "PWA sent" },
      visitReason: Array.isArray(form.visitReason) ? form.visitReason : [form.visitReason].filter(Boolean),
      language: form.language,
      mobile: (form.countryCode || "+855") + " " + (form.phoneNumber || ""),
      countryCode: form.countryCode || "+855",
      phoneNumber: form.phoneNumber || "",
      dob: form.dob,
      sexAtBirth: form.sexAtBirth || "—",
      payer: "direct",
      documents: { id: "pending", consent: "pending", insurance: "pending", receipt: "pending" },
      pwaProgress: 0,
      pwaLog: [{ type: "sent", text: "Link sent by SMS", time: "just now", state: "ok" }],
      services: [], handoff: 0,
      handoffStates: ["in-progress","pending","pending","pending"],
      identity: { verified: false },
    };
    setPatients(ps => [newP, ...ps]);
    setActiveId(id);
    setWalkInOpen(false);
    pushToast(`${form.name} added · ${newP.queueNumber} · link sent`);
  };

  const unblockConsent = () => {
    const next = {
      ...active,
      status: { tone: "success", label: "Ready for nurse" },
      documents: { ...active.documents, consent: "ok" },
      handoffStates: ["done","done","in-progress","pending"],
      handoff: 2,
      pwaLog: [
        { type: "ok", text: "Consent counter-signed by Linh Nguyen", time: "just now", state: "ok" },
        ...active.pwaLog,
      ],
    };
    updatePatient(next);
    setConsentOpen(false);
    pushToast("Consent unblocked — handoff advanced to Nurse");
  };

  const editStub = () => pushToast("Edit Stub — open form to fix identity & details");

  const handleStationChange = (id) => {
    setStation(id);
    pushToast(`Station switched to ${id}`);
  };
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
    } else {
      pushToast(`Opening: ${n.titleKey.replace("notif.", "").replace(".", " ")}`);
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
    else if (id === "help") pushToast("Open help & shortcuts (⌘ /)");
  };
  const handleSearch = (id) => {
    setActiveId(id);
    const p = patients.find(x => x.id === id);
    if (p) pushToast(`Opened ${p.name} · ${p.queueNumber}`);
  };
  const handleSkipException = () => pushToast("Exception skipped — handoff stays blocked", "error");
  const handleViewDocs = () => pushToast("Opening documents drawer");
  const handleViewTimeline = () => pushToast("Opening full handoff timeline");
  const handleLearnMore = () => pushToast("Open product tour");
  const handleNavigate = (id) => {
    setActiveNav(id);
    if (id !== "reception") pushToast(`${id.charAt(0).toUpperCase() + id.slice(1)} screen — coming soon`);
  };

  return (
    <LangProvider lang={uiLang}>
    <div className="app" data-screen-label="Reception">
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
        <div className="workspace no-queue">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)", minWidth: 0 }}>
            <FastCheckIn
              patient={active}
              onUpdate={updatePatient}
              onSendLink={sendIntakeLink}
              sending={sending}
              sentFlash={sentFlash}
            />
            {active.exception === "consent" && active.documents.consent !== "ok" && (
              <ExceptionBanner
                patient={active}
                onResolve={() => setConsentOpen(true)}
                onSkip={handleSkipException}
              />
            )}
            <TatTimeline patient={active} />
            <VisitDetails
              patient={active}
              onUpdate={updatePatient}
              onSendToPhone={sendIntakeLink}
              sentFlash={sentFlash}
            />
            <TeleconsultCard
              patient={active}
              onUpdate={updatePatient}
              onPushToast={pushToast}
            />
            <Insurance patient={active} onUpdate={updatePatient} />
            <PriorResults
              patient={active}
              onUpdate={updatePatient}
              onPushToast={pushToast}
              onAddToOrder={(r) => {
                const cart = active.cart || { items: [], promos: {}, splits: null, ccy: "USD", payment: { method: null, status: "idle", tendered: "" }, pregnancyConsent: null };
                if (cart.items.find(i => i.id === r.testId)) {
                  pushToast("Already in cart", "error");
                  return;
                }
                const newItem = {
                  id: r.testId, kind: "lab", name: r.testName, price: r.price, qty: 1,
                  payer: active.payer || "direct", status: "pending",
                };
                updatePatient({ ...active, cart: { ...cart, items: [...cart.items, newItem] } });
                pushToast(`Reordered: ${r.testName}`, "success");
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)", minWidth: 0 }}>
            <OrderCart
              patient={active}
              onUpdate={updatePatient}
              onPushToast={pushToast}
              onCheckIn={() => pushToast(`${active.name} checked in · ${active.queueNumber}`, "success")}
              identityComplete={!!(active.name && active.dob && (active.phoneNumber || active.mobile))}
            />
          </div>
        </div>
        <GoalBar onLearnMore={handleLearnMore} />
      </div>
      <NewWalkInModal open={walkInOpen} onClose={() => setWalkInOpen(false)} onCreate={handleCreateWalkIn} />
      <AddServiceModal open={serviceOpen} onClose={() => setServiceOpen(false)} onAdd={handleAddServices} />
      <ConfirmConsentModal open={consentOpen} onClose={() => setConsentOpen(false)} onConfirm={unblockConsent} patient={active} />
      <ToastStack toasts={toasts} onClose={closeToast} />

      {/* === Dev-only blank-state tester === */}
      {import.meta.env.DEV && (
        <DebugBlankStateButton
          onReset={() => {
            const reset = blankPatient(active.id, active.queueNumber, active.avatarColor);
            updatePatient(reset);
            pushToast("Blank state · cleared all patient data");
          }}
        />
      )}
    </div>
    </LangProvider>
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
