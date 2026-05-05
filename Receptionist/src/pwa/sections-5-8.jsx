import React from "react";
import {
  Question, Pills, Stack, CheckList, Banner, Reveal,
} from "./components";
import { isQVisible, has } from "./logic";

const update = (set, key, sub, value) =>
  set((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), [sub]: value } }));

/* ============================================================
 * Section 5: Recent Health Events
 * ============================================================ */
export function Section5({ profile, ordered, answers, setAnswers }) {
  const a = answers.s5 || {};
  const set = (k, v) => update(setAnswers, "s5", k, v);
  return (
    <>
      <Question
        num="5.1"
        title="Any illness or fever in the last 2 weeks?"
        required
        why="Active infection inflates WBC, CRP, ferritin and ESR. This makes chronic disease results unreliable."
        banner={a.illness === "fever" && (
          <Banner kind="warn">
            Recent fever may invalidate inflammatory markers. The nurse will offer to reschedule those tests.
          </Banner>
        )}
      >
        <Pills
          value={a.illness}
          onChange={(v) => set("illness", v)}
          options={[
            { value: "no", label: "No" },
            { value: "mild", label: "Yes, mild" },
            { value: "fever", label: "Yes, with fever", variant: "warn" },
          ]}
        />
      </Question>

      <Question
        num="5.2"
        title="Vaccine in the last 4 weeks?"
        required
        why="Vaccines briefly raise WBC and some markers. COVID vaccines can also elevate D-dimer."
      >
        <Pills
          value={a.vaccine}
          onChange={(v) => set("vaccine", v)}
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ]}
        />
        <Reveal when={a.vaccine === "yes"}>
          <div>
            <div className="pwa-sub-label">Which vaccine?</div>
            <Pills
              value={a.vaccineType}
              onChange={(v) => set("vaccineType", v)}
              options={[
                { value: "covid", label: "COVID-19" },
                { value: "flu", label: "Influenza" },
                { value: "hepb", label: "Hepatitis B" },
                { value: "other", label: "Other" },
              ]}
            />
          </div>
        </Reveal>
      </Question>

      <Question
        num="5.3"
        title="Blood transfusion in the last 3 months?"
        required
        why="Transfusion replaces your own cells with donor cells. This invalidates CBC, blood typing and several serology tests."
        banner={a.transfusion === "yes" && (
          <Banner kind="danger" title="Critical">Recent transfusion invalidates CBC, blood type and some serology. Doctor & lab will be alerted.</Banner>
        )}
      >
        <Pills
          value={a.transfusion}
          onChange={(v) => set("transfusion", v)}
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes", variant: "danger" },
          ]}
        />
      </Question>

      <Question
        num="5.4"
        title="Surgery or procedure in the last 3 months?"
        required
        why="Surgery raises inflammatory markers and clotting factors for weeks afterward."
      >
        <Pills
          value={a.surgery}
          onChange={(v) => set("surgery", v)}
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ]}
        />
        <Reveal when={a.surgery === "yes"}>
          <div>
            <div className="pwa-sub-label">How long ago?</div>
            <Pills
              value={a.surgeryAgo}
              onChange={(v) => set("surgeryAgo", v)}
              options={[
                { value: "lt2w", label: "< 2 weeks" },
                { value: "2_4w", label: "2–4 weeks" },
                { value: "1_3m", label: "1–3 months" },
              ]}
            />
          </div>
        </Reveal>
      </Question>

      <Question
        num="5.5"
        title="Significant injury or trauma recently?"
        required
        why="Injury raises CK, troponin, liver enzymes and clotting factors. This can mask or mimic disease."
      >
        <Pills
          value={a.injury}
          onChange={(v) => set("injury", v)}
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ]}
        />
      </Question>

      {isQVisible("s5.travel", profile, ordered, answers) && (
        <Question
          num="5.6"
          title="International travel in the last 3 months?"
          why="Region matters. Malaria, dengue and other tropical pathogens have different risk profiles by area."
        >
          <Pills
            value={a.travel}
            onChange={(v) => set("travel", v)}
            options={[
              { value: "no", label: "No" },
              { value: "yes", label: "Yes" },
            ]}
          />
          <Reveal when={a.travel === "yes"}>
            <div>
              <div className="pwa-sub-label">Region visited</div>
              <CheckList
                value={a.travelRegions || []}
                onChange={(v) => set("travelRegions", v)}
                options={[
                  { value: "se_asia", label: "Southeast Asia" },
                  { value: "s_asia", label: "South Asia" },
                  { value: "africa", label: "Sub-Saharan Africa" },
                  { value: "middle_east", label: "Middle East" },
                  { value: "latam", label: "Latin America" },
                  { value: "other", label: "Other" },
                ]}
              />
            </div>
          </Reveal>
        </Question>
      )}

      <Question
        num="5.7"
        title="How many hours of sleep do you usually get a night?"
        required
        why="Sleep loss elevates cortisol, glucose and WBC. It also dampens recovery markers."
      >
        <Stack
          value={a.sleep}
          onChange={(v) => set("sleep", v)}
          options={[
            { value: "lt5", label: "Less than 5 hours" },
            { value: "5_6", label: "5–6 hours" },
            { value: "7_8", label: "7–8 hours" },
            { value: "gt8", label: "More than 8 hours" },
          ]}
        />
      </Question>
    </>
  );
}

/* ============================================================
 * Section 6: Lifestyle Snapshot
 * ============================================================ */
export function Section6({ profile, ordered, answers, setAnswers }) {
  const a = answers.s6 || {};
  const set = (k, v) => update(setAnswers, "s6", k, v);
  const isReturning = profile.isReturning && answers.s1?.changedSinceLast === "no_change";
  return (
    <>
      <Question
        num="6.1"
        title="Smoking"
        required
        prefilled={isReturning}
        why="Smoking elevates WBC, CEA and lung tumor markers. This affects baseline interpretation."
      >
        <Stack
          value={a.smoking}
          onChange={(v) => set("smoking", v)}
          options={[
            { value: "never", label: "Never smoked" },
            { value: "former", label: "Former smoker" },
            { value: "current", label: "Currently smoking" },
          ]}
        />
        <Reveal when={a.smoking === "current"}>
          <div>
            <div className="pwa-sub-label">Cigarettes per day</div>
            <Pills
              value={a.cigsPerDay}
              onChange={(v) => set("cigsPerDay", v)}
              options={[
                { value: "1_5", label: "1–5" },
                { value: "6_10", label: "6–10" },
                { value: "11_20", label: "11–20" },
                { value: "gt20", label: "> 20" },
              ]}
            />
          </div>
        </Reveal>
      </Question>

      <Question
        num="6.2"
        title="Alcohol, typical week"
        required
        prefilled={isReturning}
        why="Long-term alcohol use raises GGT, MCV and other liver markers chronically."
      >
        <Stack
          value={a.alcoholHabit}
          onChange={(v) => set("alcoholHabit", v)}
          options={[
            { value: "never", label: "Never" },
            { value: "rare", label: "Rarely (special occasions)" },
            { value: "1_7", label: "1–7 drinks / week" },
            { value: "8_14", label: "8–14 drinks / week" },
            { value: "gt14", label: "> 14 drinks / week" },
          ]}
        />
      </Question>

      <Question
        num="6.3"
        title="Exercise level"
        required
        prefilled={isReturning}
        why="Exercise affects CK, lipids and testosterone reference ranges."
      >
        <Stack
          value={a.exercise}
          onChange={(v) => set("exercise", v)}
          options={[
            { value: "sedentary", label: "Sedentary", desc: "Little to no exercise" },
            { value: "light", label: "Light", desc: "Walking, easy activities" },
            { value: "moderate", label: "Moderate", desc: "3–4×/week, some intensity" },
            { value: "intense", label: "Intense", desc: "Daily training, sport" },
          ]}
        />
      </Question>

      <Question
        num="6.4"
        title="Diet type"
        required
        prefilled={isReturning}
        why="Diet shapes B12, iron and protein marker baselines."
      >
        <Pills
          value={a.diet}
          onChange={(v) => set("diet", v)}
          options={[
            { value: "omnivore", label: "Standard" },
            { value: "vegetarian", label: "Vegetarian" },
            { value: "vegan", label: "Vegan" },
            { value: "keto", label: "Keto / low-carb" },
            { value: "if", label: "Fasting / IF" },
            { value: "medical", label: "Medical diet" },
          ]}
        />
      </Question>

    </>
  );
}

/* ============================================================
 * Section 7: Sample Comfort
 * ============================================================ */
export function Section7({ profile, ordered, answers, setAnswers }) {
  const a = answers.s7 || {};
  const set = (k, v) => update(setAnswers, "s7", k, v);
  return (
    <>
      <Question
        num="7.1"
        title="Have you had a blood draw before?"
        required
      >
        <Pills
          value={a.bloodDrawHistory}
          onChange={(v) => set("bloodDrawHistory", v)}
          options={[
            { value: "experienced", label: "Yes, I've had blood drawn before" },
            { value: "first", label: "No, first time" },
          ]}
        />
        {a.bloodDrawHistory === "first" && (
          <Banner kind="info">The phlebotomist will take extra time to walk you through the process.</Banner>
        )}
      </Question>

      <Question
        num="7.2"
        title="Have you ever fainted or felt unwell during a blood draw?"
        required
      >
        <Stack
          value={a.fainted}
          onChange={(v) => set("fainted", v)}
          options={[
            { value: "no", label: "No" },
            { value: "yes_felt", label: "Yes, felt faint but didn't faint" },
            { value: "yes_fainted", label: "Yes, fainted" },
          ]}
        />
        {["yes_felt", "yes_fainted"].includes(a.fainted) && (
          <Banner kind="info">A reclining position will be used. The phlebotomist is alerted.</Banner>
        )}
      </Question>

      <Question
        num="7.3"
        title="Preferred arm for blood draw"
        required
      >
        <Pills
          value={a.preferredArm}
          onChange={(v) => set("preferredArm", v)}
          options={[
            { value: "left", label: "Left" },
            { value: "right", label: "Right" },
            { value: "any", label: "No preference" },
          ]}
        />
      </Question>

      <Question
        num="7.4"
        title="Known difficult veins?"
      >
        <Pills
          value={a.difficultVeins}
          onChange={(v) => set("difficultVeins", v)}
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes, told before" },
          ]}
        />
        {a.difficultVeins === "yes" && (
          <Banner kind="info">Butterfly needle and warm compress will be prepared in advance.</Banner>
        )}
      </Question>

      <Question
        num="7.5"
        title="Latex allergy?"
        required
        why="Standard tourniquets and gloves contain latex. We'll switch to latex-free if you say yes."
      >
        <Pills
          value={a.latex}
          onChange={(v) => set("latex", v)}
          options={[
            { value: "no", label: "No latex allergy" },
            { value: "yes", label: "Yes, latex allergy", variant: "warn" },
            { value: "unsure", label: "Not sure" },
          ]}
        />
      </Question>

      <Question
        num="7.6"
        title="Do you have a port, PICC line, or fistula?"
        required
        why="Ports, PICCs and dialysis fistulas must never be used for routine draws. Strict safety rule."
        banner={["port", "fistula"].includes(a.port) && (
          <Banner kind="danger" title={`Critical: never draw from ${a.port} arm`}>
            We'll lock the affected arm and use the other side.
          </Banner>
        )}
      >
        <Stack
          value={a.port}
          onChange={(v) => set("port", v)}
          options={[
            { value: "no", label: "No" },
            { value: "port", label: "Yes, I have a port / PICC" },
            { value: "fistula", label: "Yes, I have a fistula (dialysis)" },
          ]}
        />
        <Reveal when={["port", "fistula"].includes(a.port)}>
          <div>
            <div className="pwa-sub-label">Which arm?</div>
            <Pills
              value={a.portArm}
              onChange={(v) => set("portArm", v)}
              options={[
                { value: "left", label: "Left" },
                { value: "right", label: "Right" },
                { value: "both", label: "Both" },
              ]}
            />
          </div>
        </Reveal>
      </Question>
    </>
  );
}

/* ============================================================
 * Section 8: Consent & Sensitive Tests
 * ============================================================ */
export function Section8({ profile, ordered, answers, setAnswers }) {
  const a = answers.s8 || {};
  const set = (k, v) => update(setAnswers, "s8", k, v);
  return (
    <>
      {isQVisible("s8.hivConsent", profile, ordered, answers) && (
        <Question num="8.1" title="HIV / STI test consent" required>
          <div style={{ background: "var(--surface-2)", padding: "12px 14px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: 12.5, color: "var(--ink-700)", marginBottom: 12, lineHeight: 1.55 }}>
            You are consenting to:
            <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
              <li>HIV antibody test</li>
              <li>Results are confidential and belong to you</li>
              <li>Positive results are reported to the Ministry of Health as required by Cambodian law</li>
              <li>Counselling is available before and after</li>
            </ul>
          </div>
          <Stack
            value={a.hivConsent}
            onChange={(v) => set("hivConsent", v)}
            options={[
              { value: "consent", label: "I understand and consent" },
              { value: "remove", label: "I do not consent. Remove this test" },
            ]}
          />
        </Question>
      )}

      {isQVisible("s8.geneticConsent", profile, ordered, answers) && (
        <Question num="8.2" title="Genetic test consent" required>
          <div style={{ background: "var(--surface-2)", padding: "12px 14px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: 12.5, color: "var(--ink-700)", marginBottom: 12, lineHeight: 1.55 }}>
            Genetic testing requires separate informed consent including:
            <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
              <li>Results may reveal heritable conditions</li>
              <li>Results may affect family members</li>
              <li>Counselling pathway is available</li>
            </ul>
          </div>
          <Stack
            value={a.geneticConsent}
            onChange={(v) => set("geneticConsent", v)}
            options={[
              { value: "consent", label: "I consent after reading the above" },
              { value: "info", label: "I need more information first" },
              { value: "decline", label: "I do not consent" },
            ]}
          />
        </Question>
      )}

    </>
  );
}
