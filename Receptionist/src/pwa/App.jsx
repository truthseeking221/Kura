import React, { useState, useMemo, useEffect, useRef } from "react";
import { Logo, ChevronLeft, Check, ArrowRight } from "./icons";
import { Section1, Section2, Section3, Section4 } from "./sections-1-4";
import { Section5, Section6, Section7, Section8 } from "./sections-5-8";
import { sectionApplies, isSectionComplete } from "./logic";

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

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage, currentSec]);

  const goNext = () => {
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
            <div className="pwa-footer-progress">
              <div className="pwa-footer-bar">
                <div
                  className="fill"
                  style={{ width: `${(completedNums.length / visibleNums.length) * 100}%` }}
                />
              </div>
              <div className="meta">
                <span><strong>{completedNums.length}</strong> of {visibleNums.length} sections</span>
                <span>{sectionDone ? "Section complete" : "Answer remaining"}</span>
              </div>
            </div>
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
          </footer>
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
        <h1 className="pwa-cover-greet">Hello, {firstName}.</h1>
        <p className="pwa-cover-line">A few quiet questions before your visit. Take your time.</p>
        <div className="pwa-cover-meta" aria-label="Visit summary">
          <span><strong>3</strong> min</span>
          <span className="dot" aria-hidden="true" />
          <span><strong>{visibleSecs.length}</strong> sections</span>
          <span className="dot" aria-hidden="true" />
          <span>Private</span>
        </div>
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
      <div className="pwa-done-top">
        <div className="pwa-done-mark">
          <span className="pwa-done-pulse" aria-hidden="true" />
          <Check />
        </div>
        <span className="pwa-done-kicker">Sent to clinic</span>
        <h1>All set, {firstName}.</h1>
        <p>Your intake has reached Kura's front desk. The team can review it before they call you in.</p>
      </div>

      <section className="pwa-done-pass" aria-label="Clinic handoff status">
        <div>
          <span>Reception handoff</span>
          <strong>Ready for review</strong>
        </div>
        <span className="pwa-done-stamp">Kura</span>
      </section>

      <div className="pwa-done-summary" aria-label="Submitted intake summary">
        {summary.map((row) => (
          <div className="pwa-done-row" key={row.lbl}>
            <Check className="ico" />
            <span className="lbl">{row.lbl}</span>
            <span className="val">{row.val}</span>
          </div>
        ))}
      </div>

      <div className="pwa-done-note">
        <Stethoscope className="ico" />
        <span>Keep this phone nearby. Your nurse may use it to confirm details at reception.</span>
      </div>
    </div>
  );
}
