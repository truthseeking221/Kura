import React, { useState, useMemo, useEffect, useRef } from "react";
import { Logo, ChevronLeft, Check, ArrowRight, AlertTriangle, X } from "./icons";
import { Section1, Section2, Section3, Section4 } from "./sections-1-4";
import { Section5, Section6, Section7, Section8 } from "./sections-5-8";
import { sectionApplies, isSectionComplete, requiredRemaining, remainingRequiredKeys, SECTION_SKIP_REASON, SECTION_REQ_LABEL } from "./logic";

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
  "lipid_panel", "glucose_fasting", "thyroid_meds",
  "ggt", "liver_function",
  "fsh", "lh", "estradiol",
  "uacr", "dipstick",
  "ultrasound",
  "hiv",
];

const SECTION_DEFS = [
  { num: 1, name: "Today's visit",  sub: "Why you came in",                  Comp: Section1 },
  { num: 2, name: "Right now",      sub: "Pre-test prep",                    Comp: Section2 },
  { num: 3, name: "Medications",    sub: "Rx, OTC, supplements & herbals",   Comp: Section3 },
  { num: 4, name: "Women's health", sub: "Private, physician only",          Comp: Section4 },
  { num: 5, name: "Recent health",  sub: "Last 3 months",                    Comp: Section5 },
  { num: 6, name: "Lifestyle",      sub: "Smoking, alcohol, diet, sleep",    Comp: Section6 },
  { num: 7, name: "Sample comfort", sub: "Phlebotomy preferences & safety",  Comp: Section7 },
  { num: 8, name: "Consent",        sub: "Sensitive tests",                  Comp: Section8 },
];

export default function App() {
  const [stage, setStage] = useState("cover");
  const [currentSec, setCurrentSec] = useState(1);
  const [answers, setAnswers] = useState({});
  const [skipPrompt, setSkipPrompt] = useState(false);
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
  const remainingKeys = remainingRequiredKeys(currentSec, PROFILE, ORDERED_TESTS, answers);
  const firstMissing = remainingKeys[0] ? SECTION_REQ_LABEL[remainingKeys[0]] : null;

  const scrollToFirstMissing = () => {
    if (!firstMissing || !mainRef.current) return;
    const num = firstMissing.num;
    const target = mainRef.current.querySelector(`[data-q-num="${num}"]`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: "smooth" });
    setSkipPrompt(false);
  }, [stage, currentSec]);

  const goNext = () => {
    setSkipPrompt(false);
    if (isLast) { setStage("done"); return; }
    setCurrentSec(visibleNums[currentIdx + 1]);
  };

  const goPrev = () => {
    if (currentIdx === 0) { setStage("cover"); return; }
    setCurrentSec(visibleNums[currentIdx - 1]);
  };

  const startForm = () => {
    setStage("section");
    setCurrentSec(visibleNums[0]);
  };

  const showHeaderBack = stage === "section";
  const mainClass = [
    "pwa-main",
    stage === "cover" ? "pwa-main-cover" : "",
    stage === "done" ? "pwa-main-done" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="pwa">
      <div className="pwa-canvas">
        <header className="pwa-header">
          {showHeaderBack && (
            <button type="button" className="pwa-header-back" onClick={goPrev} aria-label="Back">
              <ChevronLeft className="ico" />
            </button>
          )}
          <div className="pwa-logo">
            <span className="pwa-logo-mark"><Logo /></span>
          </div>
        </header>

        {stage === "section" && currentDef && (
          <ProgressRail
            def={currentDef}
            visibleNums={visibleNums}
            completedNums={completedNums}
            currentSec={currentSec}
            currentIdx={currentIdx}
          />
        )}

        <main className={mainClass} ref={mainRef}>
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

        {stage === "section" && (
          <footer className="pwa-footer">
            <div className="pwa-footer-bar">
              <div
                className="fill"
                style={{ width: `${(completedNums.length / visibleNums.length) * 100}%` }}
              />
            </div>
            {sectionDone ? (
              <div className="pwa-footer-status ok">
                <Check className="ico" /> Section complete
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
                  Answer <strong>{firstMissing.num} {firstMissing.label}</strong>
                  {remaining > 1 && <span className="more"> · {remaining - 1} more</span>}
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
        <span className="pwa-cover-kicker">{profile.clinic}</span>
        <h1 className="pwa-cover-greet">
          Hello,<br />
          <span className="name">{firstName}.</span>
        </h1>
        <p className="pwa-cover-line">A few quiet questions before your visit. Take your time.</p>
        <ul className="pwa-cover-meta" aria-label="Visit summary">
          <li><span className="num">{visibleSecs.length}</span><span className="lbl">sections</span></li>
          <li><span className="num">~3</span><span className="lbl">minutes</span></li>
          <li><span className="num">100%</span><span className="lbl">private</span></li>
        </ul>
      </div>
    </div>
  );
}

function ProgressRail({ def, visibleNums, completedNums, currentSec, currentIdx }) {
  const completedSet = new Set(completedNums);
  return (
    <div className="pwa-progress-rail">
      <div className="pwa-progress-row">
        <div className="pwa-progress-title">
          <span className="name">{def.name}</span>
          <span className="sub">{def.sub}</span>
        </div>
        <div className="pwa-progress-meta">
          <strong>{currentIdx + 1}</strong> of {visibleNums.length}
        </div>
      </div>
      <div className="pwa-progress-segments" aria-label="Form progress">
        {visibleNums.map((n) => {
          const isDone = completedSet.has(n);
          const isCurr = n === currentSec;
          return (
            <div
              key={n}
              className={`pwa-progress-segment ${isDone ? "done" : ""} ${isCurr ? "current" : ""}`}
              aria-label={`Section ${n} ${isDone ? "complete" : isCurr ? "current" : "pending"}`}
            />
          );
        })}
      </div>
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
