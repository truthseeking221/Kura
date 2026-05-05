// Conditional rules: given patient profile + ordered tests + answers, determine
// which sections/questions are visible and which warnings fire.

export const TEST_GROUPS = {
  fasting: ["glucose_fasting", "lipid_panel", "homa_ir", "insulin", "iron_studies"],
  exercise: ["lipid_panel", "ck", "troponin", "aldolase"],
  alcohol: ["ggt", "liver_function", "lipid_panel"],
  medTiming: ["thyroid_meds", "metformin", "cortisol"],
  urine: ["uacr", "urine_culture", "dipstick"],
  cycle: ["fsh", "lh", "estradiol", "progesterone"],
  imaging: ["xray", "ct", "mri", "ultrasound"],
  pregnancyMarker: ["beta_hcg"],
  tropical: ["malaria", "dengue", "infectious_panel"],
  sensitive: ["hiv", "sti_panel", "genetic_panel"],
  hiv: ["hiv", "sti_panel"],
  genetic: ["genetic_panel"],
};

export const has = (orderedTests, group) =>
  (orderedTests || []).some((t) => TEST_GROUPS[group]?.includes(t));

export const sectionApplies = (sec, profile, ordered, answers) => {
  if (sec === 4) {
    if (profile.sex !== "female") return false;
    if (profile.age < 12 || profile.age > 60) return false;
    return true;
  }
  if (sec === 7) {
    if (profile.lastVisitWithinMonths != null && profile.lastVisitWithinMonths <= 12) return false;
    return true;
  }
  if (sec === 8) return has(ordered, "sensitive");
  return true;
};

export const sectionPrefilledFromLastVisit = (sec, profile, answers) => {
  // For returning patient who said "no change", §3,5,6 prefilled
  if (!profile.isReturning) return false;
  if (answers?.s1?.changedSinceLast === "no_change") return [3, 5, 6].includes(sec);
  return false;
};

export const isQVisible = (key, profile, ordered, answers) => {
  switch (key) {
    case "s1.referralDoctor":
    case "s1.referralReason":
      return answers.s1?.referred === "yes";
    case "s1.changedSinceLast":
      return profile.isReturning;
    case "s2.fasting":
      return has(ordered, "fasting");
    case "s2.exercise":
      return has(ordered, "exercise");
    case "s2.alcohol":
      return has(ordered, "alcohol");
    case "s2.medTiming":
      return has(ordered, "medTiming");
    case "s2.lastVoid":
      return has(ordered, "urine");
    case "s4.cycleDate":
      return ["this_week", "1_2", "2_4"].includes(answers.s4?.lmp);
    case "s4.cycleDay":
      return has(ordered, "cycle") && answers.s4?.lmp !== "no_periods";
    case "s4.menopause":
      return profile.age > 45 || answers.s4?.lmp === "no_periods";
    case "s4.hrt":
      return ["peri", "post"].includes(answers.s4?.menopause);
    case "s4.pcosDx":
      return !profile.knownConditions?.includes("pcos");
    case "s5.travel":
      return has(ordered, "tropical");
    case "s8.hivConsent":
      return has(ordered, "hiv");
    case "s8.geneticConsent":
      return has(ordered, "genetic");
    default:
      return true;
  }
};

// Warnings raised after answers, for the receptionist/nurse cockpit
export const computeWarnings = (profile, ordered, answers) => {
  const warns = [];
  if (answers.s2?.fasting === "ate") {
    warns.push({ kind: "danger", text: "Patient ate. Fasting tests may be invalid (Lipid Panel, Glucose). Consider reschedule." });
  }
  if (["moderate", "intense"].includes(answers.s2?.exercise)) {
    warns.push({ kind: "warn", text: "Recent exercise may distort CK / troponin / lipids." });
  }
  if (["yes", "unsure"].includes(answers.s3?.biotin)) {
    warns.push({ kind: "danger", text: "Biotin distorts TSH, troponin, tumor markers. Hold 3–7 days before draw." });
  }
  if (answers.s3?.supplements?.includes("iron")) {
    warns.push({ kind: "warn", text: "Iron supplement. Affects iron studies interpretation." });
  }
  if (answers.s5?.illness === "fever") {
    warns.push({ kind: "warn", text: "Recent fever. WBC, CRP, ferritin, ESR may be invalid." });
  }
  if (answers.s5?.transfusion === "yes") {
    warns.push({ kind: "danger", text: "Recent transfusion. Invalidates CBC, blood type, some serology." });
  }
  if (["yes_fainted", "yes_felt"].includes(answers.s7?.fainted)) {
    warns.push({ kind: "warn", text: "Phlebotomist alert: use lying / reclining position." });
  }
  if (answers.s7?.latex === "yes") {
    warns.push({ kind: "warn", text: "Latex allergy. Latex-free gloves + tourniquet required." });
  }
  if (answers.s7?.port === "port" || answers.s7?.port === "fistula") {
    warns.push({ kind: "danger", text: `Critical: never draw from ${answers.s7.port} arm.` });
  }
  return warns;
};

// Compute per-section completion based on visible required questions
export const SECTION_REQ = {
  1: ["visitReason"],
  2: ["hydrated"],
  3: ["biotin"],
  4: ["lmp", "pregnancy"],
  5: ["illness", "vaccine", "transfusion", "surgery", "injury", "sleep"],
  6: ["smoking", "alcoholHabit", "exercise", "diet"],
  7: ["bloodDrawHistory", "preferredArm", "latex", "port"],
  8: ["resultsDelivery"],
};

export const isSectionComplete = (sec, profile, ordered, answers) => {
  const a = answers[`s${sec}`] || {};
  const req = SECTION_REQ[sec] || [];
  for (const k of req) {
    const v = a[k];
    if (Array.isArray(v) ? v.length === 0 : v == null || v === "") return false;
  }
  return true;
};

export const requiredRemaining = (sec, profile, ordered, answers) => {
  const a = answers[`s${sec}`] || {};
  const req = SECTION_REQ[sec] || [];
  let n = 0;
  for (const k of req) {
    const v = a[k];
    if (Array.isArray(v) ? v.length === 0 : v == null || v === "") n += 1;
  }
  return n;
};

export const SECTION_SKIP_REASON = {
  1: "Without your visit reason, the doctor may need to ask the same questions again at the desk and your visit will run longer.",
  2: "Pre-test prep details (fasting, hydration, recent meds) directly affect lab accuracy. Skipping risks invalid results and a repeat draw.",
  3: "Medications change blood test interpretation. Skipping may lead to misread results or unsafe drug interactions.",
  4: "Hormone-sensitive tests depend on cycle timing. Skipping may force a redraw on a different day.",
  5: "Recent illness, transfusion, or surgery can invalidate today's labs. Skipping hides this from the lab team.",
  6: "Lifestyle context (smoking, alcohol, sleep) helps the doctor read borderline values correctly.",
  7: "Phlebotomy preferences keep your draw safe and comfortable. Skipping may cause avoidable bruising or fainting.",
  8: "Without consent, sensitive tests cannot be processed and you'll need to return to sign in person.",
};
