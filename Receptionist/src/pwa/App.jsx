import React, { useState, useMemo, useEffect, useRef } from "react";
import { Logo, Check, ArrowRight, AlertTriangle, X, Stethoscope, Heart, Pill, Coffee, Sun, Droplet, Shield } from "./icons";
import { Section1, Section2, Section3, Section4 } from "./sections-1-4";
import { Section5, Section6, Section7, Section8 } from "./sections-5-8";
import { sectionApplies, isSectionComplete, requiredRemaining, remainingRequiredFields, SECTION_SKIP_REASON } from "./logic";

const PROFILE = {
  name: "Sokha Pich",
  initials: "SP",
  age: 34,
  sex: "female",
  isReturning: true,
  lastVisitDate: "14 Jan 2026",
  lastVisitWithinMonths: 4,
  knownConditions: [],
  clinic: "Kura Polyclinic · Phnom Penh",
};

const ORDERED_TESTS = [
  "lipid_panel", "glucose_fasting", "thyroid_meds", "tsh",
  "ggt", "liver_function",
  "fsh", "lh", "estradiol",
  "uacr", "dipstick",
  "ultrasound",
  "hiv",
];

const SECTION_DEFS = [
  { num: 1, name: "Today's visit",  sub: "Why you came in",                  Comp: Section1,
    splashIcon: Stethoscope, splashTone: "brand",
    splashTitle: "Tell us what brings you in",
    splashBody: "A few quick questions about today's visit. This helps your doctor focus." },
  { num: 5, name: "Recent health",  sub: "Last 3 months",                    Comp: Section5,
    splashIcon: Heart, splashTone: "rose",
    splashTitle: "Now, your recent health",
    splashBody: "Recent illness, surgery or travel can affect today's labs. Tell us what stands out." },
  { num: 6, name: "Lifestyle",      sub: "Smoking, alcohol, diet, sleep",    Comp: Section6,
    splashIcon: Coffee, splashTone: "amber",
    splashTitle: "A bit about your lifestyle",
    splashBody: "Smoking, alcohol, sleep and diet help the doctor read borderline values correctly." },
  { num: 2, name: "Right now",      sub: "Pre-test prep",                    Comp: Section2,
    splashIcon: Sun, splashTone: "amber",
    splashTitle: "How you arrived today",
    splashBody: "These questions may impact the quality of your lab test results — fasting, exercise, hydration." },
  { num: 3, name: "Medications",    sub: "Rx, OTC, supplements & herbals",   Comp: Section3,
    splashIcon: Pill, splashTone: "violet",
    splashTitle: "Medications & supplements",
    splashBody: "Many medications change blood-test interpretation. We'll only ask if you actually take them." },
  { num: 4, name: "Women's health", sub: "Private, physician only",          Comp: Section4,
    splashIcon: Heart, splashTone: "rose",
    splashTitle: "A few private questions",
    splashBody: "Only your physician sees these. They help us interpret hormone tests correctly." },
  { num: 7, name: "Sample comfort", sub: "Phlebotomy preferences & safety",  Comp: Section7,
    splashIcon: Droplet, splashTone: "brand",
    splashTitle: "About your blood draw",
    splashBody: "Quick preferences so the phlebotomist can prepare — preferred arm, allergies, comfort." },
  { num: 8, name: "Consent",        sub: "Sensitive tests",                  Comp: Section8,
    splashIcon: Shield, splashTone: "teal",
    splashTitle: "One last thing: consent",
    splashBody: "A couple of consent questions before any sensitive tests are run today." },
];

export default function App() {
  const [stage, setStage] = useState("cover");
  const [currentSec, setCurrentSec] = useState(1);
  const [answers, setAnswers] = useState({});
  const [skipPrompt, setSkipPrompt] = useState(false);
  const [seenSplashes, setSeenSplashes] = useState(() => new Set());
  const mainRef = useRef(null);

  const visibleSecs = useMemo(
    () => SECTION_DEFS.filter((s) => sectionApplies(s.num, PROFILE, ORDERED_TESTS, answers)),
    [answers]
  );
  const visibleNums = visibleSecs.map((s) => s.num);

  const completedNums = useMemo(
    () => visibleNums.filter((n) => isSectionComplete(n, PROFILE, ORDERED_TESTS, answers)),
    [visibleNums, answers]
  );

  const currentDef = SECTION_DEFS.find((s) => s.num === currentSec);
  const currentIdx = visibleNums.indexOf(currentSec);
  const isLast = currentIdx === visibleNums.length - 1;
  const sectionDone = isSectionComplete(currentSec, PROFILE, ORDERED_TESTS, answers);
  const remaining = requiredRemaining(currentSec, PROFILE, ORDERED_TESTS, answers);
  const remainingFields = remainingRequiredFields(currentSec, PROFILE, ORDERED_TESTS, answers);
  const firstMissing = remainingFields[0] || null;

  const scrollToFirstMissing = () => {
    if (!firstMissing || !mainRef.current) return;
    navigator.vibrate?.(10);
    const num = firstMissing.num;
    const target = mainRef.current.querySelector(`[data-q-num="${num}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      target.classList.remove("pwa-q-flash");
      void target.offsetWidth;
      target.classList.add("pwa-q-flash");
      setTimeout(() => target.classList.remove("pwa-q-flash"), 1800);
    }, 480);
  };

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: "smooth" });
    setSkipPrompt(false);
  }, [stage, currentSec]);

  const goNext = () => {
    navigator.vibrate?.(12);
    setSkipPrompt(false);
    if (isLast) { setStage("done"); return; }
    setCurrentSec(visibleNums[currentIdx + 1]);
  };

  const startForm = () => {
    navigator.vibrate?.(12);
    setStage("section");
    setCurrentSec(visibleNums[0]);
  };

  const showSplash = stage === "section" && currentDef && !seenSplashes.has(currentSec);
  const ackSplash = () => {
    navigator.vibrate?.(10);
    setSeenSplashes((s) => { const n = new Set(s); n.add(currentSec); return n; });
  };

  const mainClass = [
    "pwa-main",
    stage === "cover" ? "pwa-main-cover" : "",
    stage === "done" ? "pwa-main-done" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="pwa">
      <div className="pwa-canvas">
        <header className={`pwa-header ${stage === "section" && !showSplash ? "with-context" : ""}`}>
          <div className="pwa-header-row">
            <button
              type="button"
              className="pwa-logo"
              onClick={() => { navigator.vibrate?.(8); setStage("cover"); }}
              aria-label="Back to start"
            >
              <span className="pwa-logo-mark"><Logo /></span>
            </button>
            {stage === "section" && currentDef && !showSplash && (
              <>
                <div className="pwa-header-title">
                  <span className="name">{currentDef.name}</span>
                  <span className="sub">{currentDef.sub}</span>
                </div>
                <div className="pwa-header-meta">
                  <strong>{currentIdx + 1}</strong> of {visibleNums.length}
                </div>
              </>
            )}
          </div>
          {stage === "section" && currentDef && !showSplash && (
            <Stepper
              visibleSecs={visibleSecs}
              visibleNums={visibleNums}
              completedNums={completedNums}
              currentSec={currentSec}
              onJump={(n) => setCurrentSec(n)}
            />
          )}
        </header>


        <main className={mainClass} ref={mainRef} aria-hidden={showSplash}>
          {stage === "cover" && (
            <CoverScreen profile={PROFILE} visibleSecs={visibleSecs} />
          )}

          {stage === "section" && currentDef && (
            <currentDef.Comp
              profile={PROFILE}
              ordered={ORDERED_TESTS}
              answers={answers}
              setAnswers={setAnswers}
            />
          )}

          {stage === "done" && <DoneScreen profile={PROFILE} answers={answers} />}
        </main>

        {showSplash && (
          <SectionSplash
            def={currentDef}
            position={currentIdx + 1}
            total={visibleNums.length}
            completed={completedNums.length}
            onContinue={ackSplash}
          />
        )}

        {stage === "section" && !showSplash && (
          <footer className="pwa-footer">
            <div className="pwa-footer-bar">
              <div
                className="fill"
                style={{ width: `${(completedNums.length / visibleNums.length) * 100}%` }}
              />
            </div>
            {sectionDone ? (
              <div className="pwa-footer-status ok">
                <Check className="ico" />
                <span className="copy">Add more details so Kura can prepare better.</span>
              </div>
            ) : firstMissing ? (
              <button
                type="button"
                className="pwa-footer-status missing"
                onClick={scrollToFirstMissing}
                aria-label={`Jump to question ${firstMissing.num}`}
              >
                <span className="badge">{remaining}</span>
                <span className="copy">
                  Next up <strong>{firstMissing.num} {firstMissing.label}</strong>
                  {remaining > 1 && <span className="more">{remaining - 1} more after this</span>}
                </span>
                <ArrowRight className="arrow" />
              </button>
            ) : null}
            <div className="pwa-footer-row">
              <button
                type="button"
                className="pwa-footer-skip"
                onClick={() => setSkipPrompt(true)}
                disabled={sectionDone}
                hidden={sectionDone}
              >
                Skip
              </button>
              <button
                type="button"
                className="pwa-cta"
                onClick={goNext}
                aria-disabled={!sectionDone}
                disabled={!sectionDone}
              >
                {isLast ? "Finish" : "Next"}
                <ArrowRight className="ico" />
              </button>
            </div>
          </footer>
        )}

        {stage === "section" && skipPrompt && !sectionDone && (
          <SkipSheet
            sectionName={currentDef?.name}
            reason={SECTION_SKIP_REASON[currentSec]}
            onStay={() => setSkipPrompt(false)}
            onSkip={goNext}
          />
        )}

        {stage === "cover" && (
          <footer className="pwa-footer solid">
            <button type="button" className="pwa-cta-block" onClick={startForm}>
              Begin
              <ArrowRight className="ico" />
            </button>
          </footer>
        )}

        {stage === "done" && (
          <footer className="pwa-footer solid pwa-footer-done">
            <button type="button" className="pwa-cta-block pwa-cta-block-complete" disabled aria-disabled>
              Sent to clinic
              <Check className="ico" />
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

function CoverScreen({ profile, visibleSecs }) {
  const firstName = profile.name.split(" ")[0];
  return (
    <div className="pwa-cover">
      <div className="pwa-cover-inner">
        <div className="pwa-cover-topline">
          <span className="pwa-cover-kicker">{profile.clinic}</span>
        </div>

        <div className="pwa-cover-composition">
          <div className="pwa-cover-copy">
            <h1 className="pwa-cover-greet">
              Hello,<br />
              <span className="name">{firstName}.</span>
            </h1>
            <p className="pwa-cover-line">Take a breath. We'll keep this short and only ask what helps your visit.</p>
          </div>
        </div>

        <ul className="pwa-cover-meta" aria-label="Visit summary">
          <li><span className="lbl">Short sections</span><span className="num">{visibleSecs.length}</span></li>
          <li><span className="lbl">Expected time</span><span className="num">approx 3 min</span></li>
          <li><span className="lbl">Shared with Kura</span><span className="num">Private</span></li>
        </ul>
      </div>
    </div>
  );
}

function SectionSplash({ def, position, total, completed, onContinue }) {
  if (!def) return null;
  const isFirst = position === 1;
  const remaining = Math.max(0, total - position);
  const Icon = def.splashIcon;
  const tone = def.splashTone || "brand";
  return (
    <div className={`pwa-splash tone-${tone}`} role="dialog" aria-modal="true" aria-label={`Starting ${def.name}`}>
      <div className="pwa-splash-bloom" aria-hidden="true">
        <span className="bloom bloom-1" />
        <span className="bloom bloom-2" />
      </div>
      <div className="pwa-splash-inner">
        <div className="pwa-splash-scroll">
          <div className="pwa-splash-meta">
            <span className="step">Step {position} of {total}</span>
            {!isFirst && completed > 0 && (
              <span className="streak"><Check className="ico" /> {completed} done · keep going</span>
            )}
          </div>

          {Icon && (
            <div className="pwa-splash-icon" aria-hidden="true">
              <span className="ring ring-outer" />
              <span className="ring ring-inner" />
              <Icon className="ico" />
            </div>
          )}

          <h2 className="pwa-splash-title">{def.splashTitle || def.name}</h2>
          <p className="pwa-splash-body">{def.splashBody || def.sub}</p>

          <div className="pwa-splash-progress" aria-hidden="true">
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className={`dot ${i < position - 1 ? "done" : i === position - 1 ? "current" : ""}`} />
            ))}
          </div>
        </div>

        <button type="button" className="pwa-cta-block pwa-splash-cta" onClick={onContinue}>
          {isFirst ? "Let's begin" : remaining === 0 ? "Last one — finish strong" : "Continue"}
          <ArrowRight className="ico" />
        </button>
      </div>
    </div>
  );
}

function Stepper({ visibleSecs, visibleNums, completedNums, currentSec, onJump }) {
  const completedSet = new Set(completedNums);
  const currentPos = visibleNums.indexOf(currentSec);
  const [peek, setPeek] = useState(null);
  useEffect(() => {
    if (peek == null) return;
    const t = setTimeout(() => setPeek(null), 1600);
    return () => clearTimeout(t);
  }, [peek]);
  return (
    <div className="pwa-stepper" role="tablist" aria-label="Form progress — tap a step to revisit">
      <div className="pwa-stepper-track" aria-hidden="true">
        <div
          className="pwa-stepper-fill"
          style={{ width: `${visibleNums.length > 1 ? (currentPos / (visibleNums.length - 1)) * 100 : 0}%` }}
        />
      </div>
      {visibleSecs.map((s, i) => {
        const n = s.num;
        const Icon = s.splashIcon;
        const isDone = completedSet.has(n);
        const isCurr = n === currentSec;
        const canJump = i <= currentPos;
        const showPeek = peek === n;
        return (
          <button
            key={n}
            type="button"
            role="tab"
            aria-selected={isCurr}
            disabled={!canJump || isCurr}
            className={`pwa-stepper-step ${isDone ? "done" : ""} ${isCurr ? "current" : ""} ${showPeek ? "peeking" : ""}`}
            aria-label={`${s.name}${isDone ? " — complete, tap to revisit" : isCurr ? " — current" : ""}`}
            onClick={() => {
              if (!canJump || isCurr) {
                setPeek(n);
                return;
              }
              navigator.vibrate?.(8);
              onJump?.(n);
            }}
            onPointerDown={() => setPeek(n)}
          >
            <span className="dot" aria-hidden>
              {isDone ? <Check className="ico" /> : Icon ? <Icon className="ico" /> : (i + 1)}
            </span>
            <span className="peek" aria-hidden>{s.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function SkipSheet({ sectionName, reason, onStay, onSkip }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onStay(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onStay]);
  return (
    <div className="pwa-sheet-overlay" role="dialog" aria-modal="true" aria-label="Confirm skip section" onClick={onStay}>
      <div className="pwa-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="pwa-sheet-grip" aria-hidden="true" />
        <div className="pwa-sheet-head">
          <div className="pwa-sheet-icon"><AlertTriangle /></div>
          <div className="pwa-sheet-title">
            <strong>Skip {sectionName ? `"${sectionName}"` : "this section"}?</strong>
            <span>Why we ask first</span>
          </div>
          <button type="button" className="pwa-sheet-close" onClick={onStay} aria-label="Close">
            <X className="ico" />
          </button>
        </div>
        <p className="pwa-sheet-body">{reason}</p>
        <div className="pwa-sheet-actions">
          <button type="button" className="pwa-btn pwa-btn-primary" onClick={onStay}>
            Stay and finish
          </button>
          <button type="button" className="pwa-btn pwa-btn-ghost" onClick={onSkip}>
            Skip anyway
          </button>
        </div>
      </div>
    </div>
  );
}

function DoneScreen({ profile, answers }) {
  const firstName = profile.name.split(" ")[0];
  const visitReasons = answers.s1?.visitReason || [];
  const medCount = answers.s3?.rx?.length || 0;
  const summary = [
    { lbl: "Visit notes", val: visitReasons.length ? `${visitReasons.length} selected` : "Ready" },
    { lbl: "Pre-test prep", val: answers.s2?.fasting === "fasting" ? "Fasting confirmed" : "Reviewed" },
    { lbl: "Medication list", val: medCount ? `${medCount} item${medCount === 1 ? "" : "s"}` : "No current meds added" },
    { lbl: "Private details", val: "Sent securely" },
  ];
  return (
    <div className="pwa-done">
      <div className="pwa-done-mark">
        <Check />
      </div>
      <h1 className="pwa-done-title">All set, {firstName}.</h1>
      <p className="pwa-done-line">Your intake reached Kura's front desk. The team can review it before they call you in.</p>

      <section className="pwa-done-card" aria-label="Submitted intake summary">
        <div className="pwa-done-card-head">
          <strong>Intake summary</strong>
          <span className="pwa-done-card-tag">Sent</span>
        </div>
        <ul className="pwa-done-list">
          {summary.map((row) => (
            <li key={row.lbl}>
              <span className="lbl">{row.lbl}</span>
              <span className="val">{row.val}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="pwa-done-foot">Keep this phone nearby. Your nurse may use it to confirm details at reception.</p>
    </div>
  );
}
