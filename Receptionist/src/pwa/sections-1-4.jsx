import React from "react";
import {
  Question, Pills, Stack, CheckList, MedGroup, DayGrid, DateField, SearchablePills, Banner, Reveal,
} from "./components";
import { isQVisible, has } from "./logic";

const update = (set, key, sub, value) =>
  set((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), [sub]: value } }));

/* ============================================================
 * Section 1: Today's Visit
 * ============================================================ */
export function Section1({ profile, ordered, answers, setAnswers }) {
  const a = answers.s1 || {};
  const set = (k, v) => update(setAnswers, "s1", k, v);

  const visitReasons = [
    { value: "checkup", label: "General check-up" },
    { value: "followup", label: "Follow-up" },
    { value: "labs", label: "Lab work only" },
    { value: "annual", label: "Annual physical" },
    { value: "vaccine", label: "Vaccination" },
    { value: "bp", label: "Blood pressure" },
    { value: "referral", label: "Referral" },
    { value: "rx", label: "Prescription refill" },
    { value: "fatigue", label: "Fatigue / energy" },
    { value: "chest", label: "Chest / breathing" },
    { value: "digestive", label: "Digestive issue" },
    { value: "skin", label: "Skin / rash" },
    { value: "mental", label: "Mental health" },
    { value: "reproductive", label: "Reproductive" },
    { value: "headache", label: "Headache" },
    { value: "joint", label: "Joint / muscle" },
    { value: "ear", label: "Ear / nose / throat" },
    { value: "eye", label: "Eye / vision" },
    { value: "weight", label: "Weight management" },
    { value: "sleep", label: "Sleep concerns" },
    { value: "other", label: "Other" },
  ];

  return (
    <>
      {profile.isReturning && isQVisible("s1.changedSinceLast", profile, ordered, answers) && (
        <Question
          num="1.0"
          title={`Has anything changed since your last visit on ${profile.lastVisitDate}?`}
          why="If nothing changed, we pre-fill medications, recent events and lifestyle from last time. Saves you minutes."
        >
          <Stack
            value={a.changedSinceLast}
            onChange={(v) => set("changedSinceLast", v)}
            options={[
              { value: "no_change", label: "No, nothing's changed", desc: "We'll pre-fill the rest for you" },
              { value: "changed", label: "Yes, some things changed" },
            ]}
          />
        </Question>
      )}

      <Question
        num="1.1"
        title="What brings you in today?"
        required
        why="Your reason guides the doctor's focus and helps the AI suggest the right tests."
      >
        <SearchablePills
          options={visitReasons}
          value={a.visitReason || []}
          onChange={(v) => set("visitReason", v)}
          placeholder="Search reasons…"
          visibleCount={9}
        />
      </Question>

      <Question
        num="1.2"
        title="Were you referred by a doctor?"
        why="Referrals trigger letters back to the referring physician and may unlock insurance coverage."
      >
        <Pills
          value={a.referred}
          onChange={(v) => set("referred", v)}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
        />
        <Reveal when={a.referred === "yes"}>
          <div>
            <div className="pwa-sub-label">Doctor</div>
            <Stack
              value={a.referralDoctor}
              onChange={(v) => set("referralDoctor", v)}
              options={[
                { value: "sopheap_chan", label: "Dr. Sopheap Chan" },
                { value: "vannak_lim", label: "Dr. Vannak Lim" },
                { value: "ratha_seng", label: "Dr. Ratha Seng" },
                { value: "other", label: "Other / not in list" },
              ]}
            />
          </div>
          <div>
            <div className="pwa-sub-label">Reason for referral <span style={{ color: "var(--ink-400)", fontWeight: 500 }}>(optional)</span></div>
            <Pills
              value={a.referralReason}
              onChange={(v) => set("referralReason", v)}
              options={[
                { value: "specialist", label: "Specialist follow-up" },
                { value: "abnormal", label: "Abnormal results" },
                { value: "second", label: "Second opinion" },
              ]}
            />
          </div>
        </Reveal>
      </Question>
    </>
  );
}

/* ============================================================
 * Section 2: Right Now (pre-test prep)
 * ============================================================ */
export function Section2({ profile, ordered, answers, setAnswers }) {
  const a = answers.s2 || {};
  const set = (k, v) => update(setAnswers, "s2", k, v);
  return (
    <>
      {isQVisible("s2.fasting", profile, ordered, answers) && (
        <Question
          num="2.1"
          title="Have you had food or drink (other than water) in the last 8 hours?"
          why="Fasting glucose, lipid panel and HOMA-IR need a 12-hour fast to be accurate."
          banner={a.fasting === "ate" && (
            <Banner kind="danger" title="Fasting tests at risk">
              You ordered Lipid Panel & Fasting Glucose. The nurse will offer to reschedule those tests.
            </Banner>
          )}
        >
          <Stack
            value={a.fasting}
            onChange={(v) => set("fasting", v)}
            options={[
              { value: "fasting", label: "No, I'm fasting" },
              { value: "water", label: "Just water" },
              { value: "ate", label: "Yes, had food or drink" },
            ]}
          />
        </Question>
      )}

      {isQVisible("s2.exercise", profile, ordered, answers) && (
        <Question
          num="2.2"
          title="Did you exercise in the last 24 hours?"
          why="Heavy exercise spikes CK, troponin and cholesterol. This makes results look abnormal."
        >
          <Pills
            value={a.exercise}
            onChange={(v) => set("exercise", v)}
            options={[
              { value: "none", label: "No" },
              { value: "light", label: "Light walk" },
              { value: "moderate", label: "Moderate" },
              { value: "intense", label: "Intense / gym", variant: "warn" },
            ]}
          />
        </Question>
      )}

      {isQVisible("s2.alcohol", profile, ordered, answers) && (
        <Question
          num="2.3"
          title="Alcohol in the last 48 hours?"
          why="Alcohol elevates GGT and other liver enzymes for up to 72 hours."
        >
          <Pills
            value={a.alcohol}
            onChange={(v) => set("alcohol", v)}
            options={[
              { value: "none", label: "No" },
              { value: "12", label: "1–2 drinks" },
              { value: "3plus", label: "3 or more", variant: "warn" },
            ]}
          />
        </Question>
      )}

      {isQVisible("s2.medTiming", profile, ordered, answers) && (
        <Question
          num="2.4"
          title="When did you take your medications today?"
          why="Thyroid, metformin and cortisol meds need to be timed against the blood draw."
        >
          <Pills
            value={a.medTiming}
            onChange={(v) => set("medTiming", v)}
            options={[
              { value: "not_yet", label: "Not yet" },
              { value: "lt2", label: "< 2 hrs ago" },
              { value: "2_4", label: "2–4 hrs" },
              { value: "gt4", label: "> 4 hrs" },
              { value: "none", label: "Don't take these" },
            ]}
          />
        </Question>
      )}

      <Question
        num="2.5"
        title="Are you well hydrated?"
        required
        why="Dehydration makes veins harder to find and concentrates urine. This affects both sample quality and results."
        banner={a.hydrated === "no" && (
          <Banner kind="info">A note will be sent to the phlebotomist to offer water before the draw.</Banner>
        )}
      >
        <Pills
          value={a.hydrated}
          onChange={(v) => set("hydrated", v)}
          options={[
            { value: "yes", label: "Yes, drinking normally" },
            { value: "no", label: "No, feeling dehydrated" },
          ]}
        />
      </Question>

      {isQVisible("s2.lastVoid", profile, ordered, answers) && (
        <Question
          num="2.6"
          title="When did you last urinate?"
          why="Urine tests need a fresh sample. Too soon and you may not be able to provide one."
          banner={a.lastVoid === "lt1" && (
            <Banner kind="info">When you arrive, mid-stream collection instructions will appear on your screen.</Banner>
          )}
        >
          <Pills
            value={a.lastVoid}
            onChange={(v) => set("lastVoid", v)}
            options={[
              { value: "lt1", label: "< 1 hour ago" },
              { value: "1_3", label: "1–3 hours" },
              { value: "gt3", label: "> 3 hours" },
            ]}
          />
        </Question>
      )}
    </>
  );
}

/* ============================================================
 * Section 3: Medications & Supplements
 * ============================================================ */
export function Section3({ profile, ordered, answers, setAnswers }) {
  const a = answers.s3 || {};
  const set = (k, v) => update(setAnswers, "s3", k, v);

  const cardio = [
    { value: "aspirin", label: "Aspirin" }, { value: "atorvastatin", label: "Atorvastatin" }, { value: "lisinopril", label: "Lisinopril" },
    { value: "metoprolol", label: "Metoprolol" }, { value: "warfarin", label: "Warfarin" }, { value: "clopidogrel", label: "Clopidogrel" },
  ];
  const diabetes = [
    { value: "metformin", label: "Metformin" }, { value: "insulin", label: "Insulin" }, { value: "glibenclamide", label: "Glibenclamide" },
    { value: "sitagliptin", label: "Sitagliptin" }, { value: "empagliflozin", label: "Empagliflozin" },
  ];
  const thyroid = [
    { value: "levothyroxine", label: "Levothyroxine" }, { value: "ptu", label: "Propylthiouracil" },
  ];
  const more = [
    { value: "amlodipine", label: "Amlodipine" }, { value: "losartan", label: "Losartan" }, { value: "omeprazole", label: "Omeprazole" },
    { value: "sertraline", label: "Sertraline" }, { value: "salbutamol", label: "Salbutamol" }, { value: "prednisolone", label: "Prednisolone" },
  ];

  const isReturning = profile.isReturning && answers.s1?.changedSinceLast === "no_change";

  return (
    <>
      <Question
        num="3.1"
        title="Prescription medications you take regularly"
        prefilled={isReturning}
        why="Many medications change blood-test results. For example, statins lower cholesterol numbers and warfarin extends clotting times."
      >
        {a.noRx ? (
          <Pills
            value={a.noRx ? "none" : null}
            onChange={() => set("noRx", false)}
            options={[{ value: "none", label: "None, I don't take prescriptions", variant: "muted" }]}
          />
        ) : (
          <>
            <MedGroup title="Cardiovascular" options={cardio} value={a.rx} onChange={(v) => set("rx", v)} />
            <MedGroup title="Diabetes" options={diabetes} value={a.rx} onChange={(v) => set("rx", v)} />
            <MedGroup title="Thyroid" options={thyroid} value={a.rx} onChange={(v) => set("rx", v)} />
            {a.showMore && (
              <MedGroup title="Other common" options={more} value={a.rx} onChange={(v) => set("rx", v)} />
            )}
            <div className="pwa-pills" style={{ marginTop: 6 }}>
              {!a.showMore && <button type="button" className="pwa-pill expand" onClick={() => set("showMore", true)}>+ Show more categories</button>}
              <button type="button" className="pwa-pill muted" onClick={() => { set("rx", []); set("noRx", true); }}>None, I don't take Rx</button>
            </div>
          </>
        )}
        {(a.rx || []).includes("metformin") && (
          <div className="pwa-med-detail">
            <div className="pwa-med-detail-row">
              <span className="lbl">Metformin · Dose</span>
              <Pills
                value={a.metforminDose}
                onChange={(v) => set("metforminDose", v)}
                options={[
                  { value: "500", label: "500mg", compact: true },
                  { value: "850", label: "850mg", compact: true },
                  { value: "1000", label: "1000mg", compact: true },
                ]}
              />
            </div>
            <div className="pwa-med-detail-row">
              <span className="lbl">Frequency</span>
              <Pills
                value={a.metforminFreq}
                onChange={(v) => set("metforminFreq", v)}
                options={[
                  { value: "1", label: "Once daily", compact: true },
                  { value: "2", label: "Twice daily", compact: true },
                  { value: "3", label: "Three times", compact: true },
                ]}
              />
            </div>
          </div>
        )}
      </Question>

      <Question
        num="3.2"
        title="Do you take biotin (Vitamin B7) or any hair / nail / skin vitamins?"
        required
        why="Biotin distorts TSH, troponin and tumor marker results. It's hidden in most beauty supplements. The FDA issued a warning."
        microcopy="Biotin = the hair & nail supplement. Found in many multivitamins and beauty gummies."
        banner={["yes", "unsure"].includes(a.biotin) && (
          <Banner kind="danger" title="Critical: biotin distorts results">
            Ideally hold biotin for 3–7 days before the blood draw. The nurse will discuss this with you on arrival.
          </Banner>
        )}
      >
        <Stack
          value={a.biotin}
          onChange={(v) => set("biotin", v)}
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes, taking biotin" },
            { value: "unsure", label: "Not sure, let me check" },
          ]}
        />
      </Question>

      <Question
        num="3.3"
        title="Over-the-counter medications taken in the last 7 days"
      >
        <CheckList
          value={a.otc || []}
          onChange={(v) => set("otc", v)}
          options={[
            { value: "aspirin_paracetamol", label: "Aspirin / Paracetamol" },
            { value: "ibuprofen", label: "Ibuprofen" },
            { value: "antacids", label: "Antacids" },
            { value: "antihist", label: "Antihistamines" },
            { value: "cold", label: "Cold / flu meds" },
            { value: "laxatives", label: "Laxatives" },
            { value: "none", label: "None of these", exclusive: true },
          ]}
        />
      </Question>

      <Question
        num="3.4"
        title="Vitamins & supplements"
        why="High-dose Vitamin C affects glucose & urine dipstick. Iron supplements affect iron studies."
      >
        <CheckList
          value={a.supplements || []}
          onChange={(v) => set("supplements", v)}
          options={[
            { value: "vitc", label: "Vitamin C (high dose)" },
            { value: "iron", label: "Iron" },
            { value: "zinc", label: "Zinc" },
            { value: "fishoil", label: "Fish oil / Omega-3" },
            { value: "magnesium", label: "Magnesium" },
            { value: "vitd", label: "Vitamin D" },
            { value: "multivit", label: "Multivitamin" },
            { value: "none", label: "None", exclusive: true },
          ]}
        />
      </Question>

      <Question
        num="3.5"
        title="Herbal or traditional medicine?"
        microcopy="Traditional medicines may contain heavy metals or compounds that affect liver enzymes."
      >
        <Pills
          value={a.herbal}
          onChange={(v) => set("herbal", v)}
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ]}
        />
        <Reveal when={a.herbal === "yes"}>
          <div>
            <div className="pwa-sub-label">Which kinds?</div>
            <CheckList
              value={a.herbalTypes || []}
              onChange={(v) => set("herbalTypes", v)}
              options={[
                { value: "stjohns", label: "St John's Wort" },
                { value: "ginkgo", label: "Ginkgo" },
                { value: "garlic", label: "Garlic pills" },
                { value: "ayurveda", label: "Ayurveda" },
                { value: "tcm", label: "TCM herbs" },
                { value: "homeo", label: "Homeopathic" },
                { value: "other", label: "Other herbal" },
              ]}
            />
          </div>
        </Reveal>
      </Question>
    </>
  );
}

/* ============================================================
 * Section 4: Women's Health (PWA private)
 * ============================================================ */
export function Section4({ profile, ordered, answers, setAnswers }) {
  const a = answers.s4 || {};
  const set = (k, v) => update(setAnswers, "s4", k, v);
  return (
    <>
      <Question
        num="4.1"
        title="When did your last period start?"
        required
        why="The phase of your cycle affects hormone reference ranges. The doctor will need this to interpret results."
      >
        <Pills
          value={a.lmp}
          onChange={(v) => set("lmp", v)}
          options={[
            { value: "this_week", label: "This week" },
            { value: "1_2", label: "1–2 weeks ago" },
            { value: "2_4", label: "2–4 weeks ago" },
            { value: "gt1m", label: "> 1 month ago" },
            { value: "not_sure", label: "Not sure" },
            { value: "no_periods", label: "I don't have periods" },
          ]}
        />
        {isQVisible("s4.cycleDate", profile, ordered, answers) && has(ordered, "cycle") && (
          <Reveal when>
            <div>
              <div className="pwa-sub-label">Pick the exact start date (FSH/LH need this)</div>
              <DateField value={a.lmpDate} onChange={(v) => set("lmpDate", v)} max={new Date().toISOString().slice(0, 10)} />
            </div>
          </Reveal>
        )}
      </Question>

      <Question
        num="4.2"
        title="Is there any chance you could be pregnant?"
        required
        locked
        why="Pregnancy changes how imaging and many tests are interpreted. This answer goes only to your physician, never to nurses or admin."
        banner={["possibly", "yes"].includes(a.pregnancy) && (
          <Banner kind="warn" title="Imaging tests will be flagged">
            Your physician will review imaging orders and confirm β-hCG before any radiation exposure.
          </Banner>
        )}
      >
        <Stack
          value={a.pregnancy}
          onChange={(v) => set("pregnancy", v)}
          options={[
            { value: "no", label: "No, I'm not pregnant" },
            { value: "possibly", label: "Possibly, I'm not sure" },
            { value: "yes", label: "Yes, I'm pregnant" },
          ]}
        />
      </Question>

      <Question
        num="4.3"
        title="Currently breastfeeding?"
        why="Breastfeeding raises prolactin levels. Needed to interpret pituitary test results."
      >
        <Pills
          value={a.breastfeeding}
          onChange={(v) => set("breastfeeding", v)}
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ]}
        />
      </Question>

      <Question
        num="4.4"
        title="Hormonal contraception?"
        why="Hormonal contraceptives affect SHBG, free testosterone, clotting factors and cholesterol."
      >
        <Stack
          value={a.contraception}
          onChange={(v) => set("contraception", v)}
          options={[
            { value: "no", label: "No" },
            { value: "combined", label: "Yes, combined pill (estrogen + progestin)" },
            { value: "progestin", label: "Yes, progestin-only pill" },
            { value: "iud", label: "Yes, hormonal IUD" },
            { value: "inj", label: "Yes, injection or implant" },
            { value: "other", label: "Yes, other" },
          ]}
        />
      </Question>

      {isQVisible("s4.cycleDay", profile, ordered, answers) && has(ordered, "cycle") && (
        <Question
          num="4.5"
          title="Day of cycle (if known)"
          why="FSH, LH, estradiol and progesterone reference ranges depend on which cycle day you're on."
        >
          <DayGrid value={a.cycleDay} onChange={(v) => set("cycleDay", v)} />
          <div style={{ marginTop: 10 }}>
            <Pills
              value={a.cycleDayUnknown ? "untracked" : null}
              onChange={() => set("cycleDayUnknown", !a.cycleDayUnknown)}
              options={[{ value: "untracked", label: "I don't track my cycle", variant: "muted" }]}
            />
          </div>
        </Question>
      )}

      {isQVisible("s4.pcosDx", profile, ordered, answers) && (
        <Question
          num="4.6"
          title="PCOS diagnosis?"
          why="Polycystic ovary syndrome changes androgen and insulin recommendations."
        >
          <Pills
            value={a.pcos}
            onChange={(v) => set("pcos", v)}
            options={[
              { value: "no", label: "No" },
              { value: "yes", label: "Yes, diagnosed" },
              { value: "suspected", label: "Suspected" },
            ]}
          />
        </Question>
      )}

      {isQVisible("s4.menopause", profile, ordered, answers) && (
        <Question
          num="4.7"
          title="Where are you in the menopause transition?"
          why="Post-menopausal FSH, LH and estradiol reference ranges differ. This affects how the doctor reads your results."
        >
          <Pills
            value={a.menopause}
            onChange={(v) => set("menopause", v)}
            options={[
              { value: "not_yet", label: "Not yet" },
              { value: "peri", label: "Perimenopausal" },
              { value: "post", label: "Post-menopausal" },
            ]}
          />
        </Question>
      )}

      {isQVisible("s4.hrt", profile, ordered, answers) && (
        <Question num="4.8" title="Hormone replacement therapy (HRT)?">
          <Pills
            value={a.hrt}
            onChange={(v) => set("hrt", v)}
            options={[
              { value: "no", label: "No" },
              { value: "yes", label: "Yes" },
            ]}
          />
          <Reveal when={a.hrt === "yes"}>
            <div>
              <div className="pwa-sub-label">Type</div>
              <Pills
                value={a.hrtType}
                onChange={(v) => set("hrtType", v)}
                options={[
                  { value: "estrogen", label: "Estrogen only" },
                  { value: "combined", label: "Combined E + P" },
                  { value: "other", label: "Other" },
                ]}
              />
            </div>
            <div>
              <div className="pwa-sub-label">Duration</div>
              <Pills
                value={a.hrtDuration}
                onChange={(v) => set("hrtDuration", v)}
                options={[
                  { value: "lt1", label: "< 1 year" },
                  { value: "1_5", label: "1–5 years" },
                  { value: "gt5", label: "> 5 years" },
                ]}
              />
            </div>
          </Reveal>
        </Question>
      )}
    </>
  );
}
