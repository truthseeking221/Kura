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

// Compute per-section completion based on visible required questions. Keep
// question numbers here aligned with the rendered <Question num="..."> values
// so the footer hint always points to the actual unanswered question.
export const SECTION_REQ_FIELDS = {
  1: [{ key: "visitReason", num: "1.1", label: "Visit reason" }],
  2: [{ key: "hydrated", num: "2.5", label: "Hydration" }],
  3: [{ key: "biotin", num: "3.2", label: "Biotin / B-complex use" }],
  4: [
    { key: "lmp", num: "4.1", label: "Last menstrual period" },
    { key: "pregnancy", num: "4.2", label: "Could you be pregnant" },
  ],
  5: [
    { key: "illness", num: "5.1", label: "Recent illness" },
    { key: "vaccine", num: "5.2", label: "Recent vaccination" },
    { key: "transfusion", num: "5.3", label: "Recent transfusion" },
    { key: "surgery", num: "5.4", label: "Recent surgery" },
    { key: "injury", num: "5.5", label: "Recent injury" },
    { key: "sleep", num: "5.7", label: "Sleep last 48 hours" },
  ],
  6: [
    { key: "smoking", num: "6.1", label: "Smoking" },
    { key: "alcoholHabit", num: "6.2", label: "Alcohol" },
    { key: "exercise", num: "6.3", label: "Exercise habit" },
    { key: "diet", num: "6.4", label: "Diet" },
  ],
  7: [
    { key: "bloodDrawHistory", num: "7.1", label: "Past blood draws" },
    { key: "fainted", num: "7.2", label: "Fainting during blood draw" },
    { key: "preferredArm", num: "7.3", label: "Preferred arm" },
    { key: "latex", num: "7.5", label: "Latex allergy" },
    { key: "port", num: "7.6", label: "Port / fistula" },
  ],
  8: [
    { key: "hivConsent", num: "8.1", label: "HIV / STI test consent", visibleKey: "s8.hivConsent" },
    { key: "geneticConsent", num: "8.2", label: "Genetic test consent", visibleKey: "s8.geneticConsent" },
    { key: "resultsDelivery", num: "8.3", label: "Results delivery" },
  ],
};

export const SECTION_REQ = Object.fromEntries(
  Object.entries(SECTION_REQ_FIELDS).map(([sec, fields]) => [sec, fields.map((f) => f.key)])
);

export const SECTION_REQ_LABEL = Object.fromEntries(
  Object.values(SECTION_REQ_FIELDS).flat().map((field) => [field.key, { num: field.num, label: field.label }])
);

const isAnswered = (value) => (
  Array.isArray(value) ? value.length > 0 : value != null && value !== ""
);

const requiredFieldsFor = (sec, profile, ordered, answers) => (
  (SECTION_REQ_FIELDS[sec] || []).filter((field) => (
    field.visibleKey ? isQVisible(field.visibleKey, profile, ordered, answers) : true
  ))
);

export const isSectionComplete = (sec, profile, ordered, answers) => {
  const a = answers[`s${sec}`] || {};
  const req = requiredFieldsFor(sec, profile, ordered, answers);
  for (const field of req) {
    if (!isAnswered(a[field.key])) return false;
  }
  return true;
};

export const remainingRequiredFields = (sec, profile, ordered, answers) => {
  const a = answers[`s${sec}`] || {};
  const req = requiredFieldsFor(sec, profile, ordered, answers);
  return req.filter((field) => !isAnswered(a[field.key]));
};

export const requiredRemaining = (sec, profile, ordered, answers) => {
  return remainingRequiredFields(sec, profile, ordered, answers).length;
};

export const remainingRequiredKeys = (sec, profile, ordered, answers) => {
  return remainingRequiredFields(sec, profile, ordered, answers).map((field) => field.key);
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
