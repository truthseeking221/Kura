// === Center column: Fast Check-in (with QR scan step), Patient Stub, Order Draft ===
import React, { useState, useRef } from "react";
import { I } from "./icons";
import {
  QRGlyph,
  CountryCodeSelect,
} from "./shared";
import { useLang } from "./i18n";

// === Cambodia address taxonomy (mock subset for demo) ===
// Province → District (Khan) → Commune (Sangkat). Not exhaustive — covers
// Phnom Penh's khans + a handful of major provinces so the cascading dropdown
// behaves believably. Production would wire this to a service/lookup table.
const KH_ADDRESS = {
  "Phnom Penh": {
    "Chamkar Mon": ["Boeung Keng Kang 1", "Boeung Keng Kang 2", "Boeung Keng Kang 3", "Tonle Bassac", "Tumnup Tuek", "Olympic"],
    "Daun Penh": ["Chey Chumneah", "Chakto Mukh", "Phsar Chas", "Phsar Thmei 1", "Phsar Thmei 2", "Phsar Thmei 3", "Srah Chak", "Voat Phnum"],
    "7 Makara": ["Boeung Prolit", "Mittapheap", "Ou Ruessei 1", "Ou Ruessei 2", "Ou Ruessei 3", "Ou Ruessei 4", "Veal Vong"],
    "Tuol Kouk": ["Boeng Kak 1", "Boeng Kak 2", "Boeng Salang", "Phsar Daeum Kor", "Phsar Daeum Thkov", "Tuek L'ak 1", "Tuek L'ak 2", "Tuek L'ak 3"],
    "Mean Chey": ["Chak Angre Krom", "Chak Angre Leu", "Stueng Mean Chey", "Boeung Tumpun"],
    "Russey Keo": ["Chrang Chamres 1", "Chrang Chamres 2", "Kilometre 6", "Russey Keo", "Tuol Sangke"],
    "Sen Sok": ["Phnom Penh Thmei", "Tuek Thla", "Khmuonh", "Kakab", "Oubek K'am"],
    "Por Sen Chey": ["Chaom Chau", "Kakab", "Kantaok", "Krang Pongro", "Krang Thnong", "Phleung Chheh Roteh", "Samraong Kraom", "Trapeang Krasang"],
    "Chbar Ampov": ["Chbar Ampov 1", "Chbar Ampov 2", "Nirouth", "Preaek Aeng", "Preaek Pra", "Preaek Thmei", "Veal Sbov"],
    "Dangkao": ["Cheung Aek", "Dangkao", "Kong Noy", "Krang Pongro", "Pong Tuek", "Pong Tuek 2", "Prek Kampoes", "Prey Veaeng", "Roluos", "Sak Sampov", "Spean Thma", "Tien"],
    "Chroy Changvar": ["Chroy Changvar", "Bak Kaeng", "Praek Lieb", "Praek Tasaek"],
  },
  "Siem Reap": {
    "Siem Reap": ["Slor Kram", "Svay Dangkum", "Sala Kamraeuk", "Nokor Thum", "Sambour", "Chreav"],
    "Banteay Srei": ["Khnar Sanday", "Preak Dak", "Run Ta Aek"],
    "Sotr Nikum": ["Dam Daek", "Popel", "Samraong"],
  },
  "Battambang": {
    "Battambang": ["Svay Por", "Chamkar Samraong", "Tuol Ta Ek", "Voat Kor"],
    "Banan": ["Bay Damram", "Chheu Teal", "Phnom Sampov"],
  },
  "Preah Sihanouk": {
    "Sihanoukville": ["Buon", "Bei", "Pir", "Muoy"],
    "Prey Nob": ["Andoung Thma", "Bit Traang", "Ou Bak Roteh"],
  },
  "Kampot": {
    "Kampot": ["Andoung Khmer", "Kampong Bay", "Kampong Kandal", "Krang Ampil"],
    "Chhuk": ["Chhuk", "Chumpu Voan", "Lbaeuk"],
  },
  "Kandal": {
    "Ta Khmau": ["Ta Khmau", "Doeum Mien", "Kampong Samnanh", "Preaek Aeng"],
    "Kien Svay": ["Kbal Koh", "Banteay Daek", "Kokir"],
  },
};
const KH_PROVINCES = Object.keys(KH_ADDRESS);

// === Address section (Round 10 #5) — collapsed by default, structured + free text ===
function AddressFields({ patient, onUpdate, t }) {
  const addr = patient.address || {};
  const [open, setOpen] = useState(!!(addr.province || addr.district || addr.street));
  const set = (k, v) => onUpdate({ ...patient, address: { ...addr, [k]: v } });

  const districts = addr.province ? Object.keys(KH_ADDRESS[addr.province] || {}) : [];
  const communes = addr.province && addr.district ? (KH_ADDRESS[addr.province]?.[addr.district] || []) : [];

  const setProvince = (v) => {
    onUpdate({ ...patient, address: { ...addr, province: v, district: "", commune: "" } });
  };
  const setDistrict = (v) => {
    onUpdate({ ...patient, address: { ...addr, district: v, commune: "" } });
  };

  // Soft completeness — used for the "address complete" pill on the header
  const minOk = !!(addr.province && addr.district);
  const preciseOk = minOk && !!(addr.street || "").trim();

  return (
    <div className={"address-section" + (open ? " open" : "")}>
      <button
        type="button"
        className="address-head"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="address-head-left">
          <I.Home size={13} className="address-head-ico" />
          <span className="address-head-title">{t("addr.title")}</span>
          <span className="address-head-optional">· {t("addr.optional")}</span>
          {minOk && (
            <span className={"address-head-pill " + (preciseOk ? "complete" : "partial")}>
              {preciseOk ? t("addr.summaryPrecise") : t("addr.summaryZone")}
            </span>
          )}
        </span>
        {open ? <I.ChevronUp size={14} /> : <I.ChevronDown size={14} />}
      </button>

      {open && (
        <div className="address-grid">
          <div className="field">
            <label className="label">{t("addr.province")} <span className="req">*</span></label>
            <div className="input-wrap">
              <select
                className="select"
                value={addr.province || ""}
                onChange={e => setProvince(e.target.value)}
                style={{ paddingRight: 32, appearance: "none" }}
              >
                <option value="">{t("addr.selectProvince")}</option>
                {KH_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <I.ChevronDown size={14} className="rico" />
            </div>
          </div>

          <div className="field">
            <label className="label">{t("addr.district")} <span className="req">*</span></label>
            <div className="input-wrap">
              <select
                className="select"
                value={addr.district || ""}
                onChange={e => setDistrict(e.target.value)}
                disabled={!addr.province}
                style={{ paddingRight: 32, appearance: "none" }}
              >
                <option value="">{addr.province ? t("addr.selectDistrict") : t("addr.pickProvinceFirst")}</option>
                {districts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <I.ChevronDown size={14} className="rico" />
            </div>
          </div>

          <div className="field">
            <label className="label">{t("addr.commune")}</label>
            <div className="input-wrap">
              <select
                className="select"
                value={addr.commune || ""}
                onChange={e => set("commune", e.target.value)}
                disabled={!addr.district}
                style={{ paddingRight: 32, appearance: "none" }}
              >
                <option value="">{addr.district ? t("addr.selectCommune") : t("addr.pickDistrictFirst")}</option>
                {communes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <I.ChevronDown size={14} className="rico" />
            </div>
          </div>

          <div className="field">
            <label className="label">{t("addr.village")}</label>
            <input
              className="input"
              value={addr.village || ""}
              onChange={e => set("village", e.target.value)}
              placeholder={t("addr.villagePlaceholder")}
            />
          </div>

          <div className="field address-grid-span2">
            <label className="label">{t("addr.street")}</label>
            <input
              className="input"
              value={addr.street || ""}
              onChange={e => set("street", e.target.value)}
              placeholder={t("addr.streetPlaceholder")}
            />
          </div>

          <div className="field address-grid-span2">
            <label className="label">{t("addr.notes")}</label>
            <input
              className="input"
              value={addr.notes || ""}
              onChange={e => set("notes", e.target.value)}
              placeholder={t("addr.notesPlaceholder")}
            />
          </div>

          <div className="address-help">
            <I.Info size={11} />
            <span>{t(preciseOk ? "addr.helpPrecise" : minOk ? "addr.helpZone" : "addr.helpEmpty")}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// === Scanned ID card — structured "premium" presentation of auto-filled fields ===
function ScannedIdCard({ patient, onRescan, t }) {
  const fields = [
    { key: "name",        labelKey: "checkin.fullName",     value: patient.name },
    { key: "idNumber",    labelKey: "checkin.nationalId",   value: patient.idNumber, mono: true },
    { key: "dob",         labelKey: "checkin.dob",          value: patient.dob,      mono: true },
    { key: "sexAtBirth",  labelKey: "checkin.sexAtBirth",   value: patient.sexAtBirth },
  ];
  return (
    <div className="id-scanned">
      <div className="id-scanned-head">
        <div className="id-scanned-badge">
          <I.Check size={15} strokeWidth={3} />
        </div>
        <div className="id-scanned-titles">
          <div className="id-scanned-title">
            {t("checkin.nationalId")}
            <span className="id-scanned-pill">
              <I.Sparkles size={9} /> {t("checkin.idAutoFilled")}
            </span>
          </div>
          <div className="id-scanned-sub">{t("checkin.nationalId.scanned")}</div>
        </div>
        <button
          onClick={onRescan}
          className="btn btn-ghost btn-sm id-scanned-rescan"
          title={t("checkin.rescan")}
        >
          <I.RefreshCw size={11} /> {t("checkin.rescan")}
        </button>
      </div>
      <dl className="id-scanned-grid">
        {fields.map(f => (
          <div key={f.key} className="id-scanned-cell">
            <dt>{t(f.labelKey)}</dt>
            <dd className={f.mono ? "mono" : ""}>{f.value || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// === Mobile field with OTP verification ===
// Round 12 #3 — accepts `patient`/`onUpdate` so it can render the
// "via Telegram" badge when verification came from the bot, the [✎] Edit
// button (which clears Telegram source), and the inline conflict prompt
// when the bot returned a different number than the nurse typed.
function MobileWithOTP({ countryCode, phoneNumber, setCountry, setPhone, error, otpState, setOtpState, patient, onUpdate }) {
  const t = useLang();
  const [code, setCode] = React.useState("");
  const [countdown, setCountdown] = React.useState(0);
  const status = otpState.status;
  const phoneValid = phoneNumber.replace(/\D/g, "").length >= 8;
  const verifiedViaTelegram = patient?.mobileVerifiedVia === "telegram_bot";
  const conflict = patient?.mobileConflict;

  React.useEffect(() => {
    if (status !== "sent") return;
    if (countdown <= 0) {
      setOtpState({ ...otpState, status: "expired" });
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, status]);

  const handleSend = () => {
    setOtpState({ ...otpState, status: "sending" });
    setTimeout(() => {
      setOtpState({ ...otpState, status: "sent" });
      setCountdown(59);
      setCode("");
    }, 700);
  };

  const handleVerify = (val) => {
    setCode(val);
    if (val.length === 6) {
      if (val === "123456" || val === "000000") {
        setOtpState({ ...otpState, status: "verified" });
      } else {
        setOtpState({ ...otpState, status: "wrong" });
      }
    } else if (status === "wrong") {
      setOtpState({ ...otpState, status: "sent" });
    }
  };

  const resetToIdle = () => {
    setOtpState({ status: "idle" });
    setCode("");
    setCountdown(0);
    // Round 12 #3 — clicking [✎] returns the field to "Send OTP" unverified.
    // Drop any Telegram-source verification so the badge doesn't linger.
    if (patient && onUpdate && (verifiedViaTelegram || patient.otpVerified)) {
      onUpdate({ ...patient, otpVerified: false, mobileVerifiedVia: null });
    }
  };

  // Conflict resolutions
  const useTelegramNumber = () => {
    const c = patient?.mobileConflict;
    if (!c) return;
    onUpdate({
      ...patient,
      countryCode: c.telegramCC,
      phoneNumber: c.telegramPhone,
      mobile: c.telegramCC + " " + c.telegramPhone,
      otpVerified: true,
      mobileVerifiedVia: "telegram_bot",
      mobileConflict: null,
    });
    setOtpState({ status: "verified" });
  };
  const keepEnteredNumber = () => {
    if (!patient) return;
    // Drop the conflict; OTP still required for the manually-entered number.
    onUpdate({ ...patient, mobileConflict: null });
  };

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const timerLabel = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <div className="field">
      <label className="label">{t("checkin.mobile")} <span className="req">*</span></label>
      <div style={{ display: "flex", position: "relative" }}>
        <CountryCodeSelect value={countryCode} onChange={setCountry} disabled={status === "verified"} />
        <input
          className={"input" + (error ? " invalid" : "")}
          value={phoneNumber}
          onChange={e => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
          placeholder="12 345 678"
          disabled={status === "verified"}
          style={{
            borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
            flex: 1,
            paddingRight: status === "verified" ? 76 : 96,
          }}
        />
        <div style={{
          position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          {status === "verified" ? (
            <>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "var(--success-50)", color: "var(--success-700, #047857)",
                border: "1px solid var(--success-200, #a7f3d0)",
                borderRadius: 4, padding: "2px 8px",
                fontSize: 11, fontWeight: 600,
              }}>
                <I.Check size={11} strokeWidth={3} /> {t("otp.verified")}
              </span>
              <button type="button" onClick={resetToIdle} title={t("mobile.editToReverify")} style={{
                background: "transparent", border: "none", padding: 4, cursor: "pointer",
                color: "var(--ink-500)", display: "grid", placeItems: "center",
              }}>
                <I.Edit size={12} />
              </button>
            </>
          ) : status === "idle" || status === "sending" ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={!phoneValid || status === "sending"}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                color: phoneValid ? "var(--brand-600)" : "var(--ink-400)",
                fontSize: 11.5, fontWeight: 600,
                padding: "5px 10px", borderRadius: 5,
                cursor: phoneValid ? "pointer" : "not-allowed",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}
            >
              {status === "sending"
                ? (<><span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> {t("otp.sending")}</>)
                : t("otp.send")}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={countdown > 0}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                color: countdown > 0 ? "var(--ink-400)" : "var(--brand-600)",
                fontSize: 11.5, fontWeight: 600,
                padding: "5px 10px", borderRadius: 5,
                cursor: countdown > 0 ? "not-allowed" : "pointer",
              }}
            >
              {t("otp.resend")}
            </button>
          )}
        </div>
      </div>
      {error && <div className="help error">{error}</div>}
      {status !== "verified" && phoneValid && status === "idle" && (
        <div className="help" style={{ color: "var(--warn-600, #b45309)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}>
          <I.AlertCircle size={11} /> {t("otp.unverified")}
        </div>
      )}

      {/* OTP code input — appears when sent/wrong/expired */}
      {(status === "sent" || status === "wrong" || status === "expired") && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <input
              className={"input" + (status === "wrong" ? " invalid" : "")}
              value={code}
              onChange={e => handleVerify(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={t("otp.enter")}
              autoFocus
              style={{ letterSpacing: "0.15em", fontFamily: "'SF Mono', ui-monospace, monospace" }}
            />
            {status === "wrong" && (
              <div className="help error">{t("otp.incorrect")}</div>
            )}
          </div>
          <div style={{
            fontSize: 11.5, color: status === "expired" ? "var(--danger-600)" : "var(--ink-500)",
            paddingTop: 10, fontWeight: 550, whiteSpace: "nowrap",
          }}>
            {status === "expired" ? t("otp.expired") : `${t("otp.resendIn")} ${timerLabel}`}
          </div>
        </div>
      )}

      {/* Round 12 #3 — "via Telegram" label below the field when verified by bot */}
      {status === "verified" && verifiedViaTelegram && !conflict && (
        <div className="mobile-via">
          <I.Send size={10} /> {t("mobile.verifiedViaTelegram")}
        </div>
      )}

      {/* Round 12 #3 — Inline conflict prompt: bot returned a different number */}
      {conflict && (
        <div className="mobile-conflict" role="alert">
          <div className="mobile-conflict-title">
            <I.AlertTriangle size={11} /> {t("mobile.conflict.title")}
          </div>
          <div className="mobile-conflict-row">
            <span className="mobile-conflict-label">{t("mobile.conflict.entered")}</span>
            <span className="mobile-conflict-val">{conflict.entered}</span>
          </div>
          <div className="mobile-conflict-row">
            <span className="mobile-conflict-label">{t("mobile.conflict.viaTg")}</span>
            <span className="mobile-conflict-val">{conflict.viaTelegram}</span>
          </div>
          <div className="mobile-conflict-q">{t("mobile.conflict.use")}</div>
          <div className="mobile-conflict-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={useTelegramNumber}>
              <I.Check size={11} /> {t("mobile.conflict.useTg")}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={keepEnteredNumber}>
              {t("mobile.conflict.keep")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// === Preferred Communication Method segmented selector ===
// Telegram option is locked until a Telegram handle has been captured.
function CommMethodSelector({ value, onChange, error, telegramReady, smsReady }) {
  const t = useLang();
  // Telegram on the LEFT (per reviewer feedback) — left-to-right.
  const opts = [
    { id: "telegram", labelKey: "comm.telegram", icon: I.Send,           ready: telegramReady, lockedKey: "comm.telegram.locked" },
    { id: "sms",      labelKey: "comm.sms",      icon: I.MessageSquare,  ready: smsReady,      lockedKey: "comm.telegram.locked" },
  ];
  return (
    <div className="field">
      <label className="label">{t("checkin.preferredComm")} <span className="req">*</span></label>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0,
        background: "var(--surface-2)", border: "1px solid var(--border)",
        borderRadius: 7, padding: 3, height: "var(--field-h)",
      }}>
        {opts.map(o => {
          const active = value === o.id;
          const locked = !o.ready;
          const Ico = o.icon;
          const tip = locked ? t(o.lockedKey) : "";
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => !locked && onChange(o.id)}
              disabled={locked}
              title={tip}
              style={{
                background: locked ? "transparent" : (active ? "var(--brand-50)" : "transparent"),
                color: locked ? "var(--ink-400)" : (active ? "var(--brand-700)" : "var(--ink-600)"),
                border: active && !locked ? "1px solid var(--brand-200)" : "1px solid transparent",
                borderRadius: 5,
                fontSize: 12, fontWeight: 600,
                cursor: locked ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                padding: 0,
              }}
            >
              {locked ? <I.Lock size={11} /> : <Ico size={12} />}
              {t(o.labelKey)}
            </button>
          );
        })}
      </div>
      {error && <div className="help error">{error}</div>}
      {!telegramReady && (
        <div className="help" style={{ color: "var(--ink-500)", fontSize: 10.5, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 3 }}>
          <I.Info size={10} /> {t("comm.telegram.locked")}
        </div>
      )}
    </div>
  );
}

// === Telegram capture card with OTP verification ===
// Mirrors the SMS OTP flow: scan QR → handle captured → send 6-digit code → verify.
function TelegramCaptureCard({ patient, onUpdate }) {
  const t = useLang();
  const [scanning, setScanning] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [wrong, setWrong] = React.useState(false);
  const handle = patient.telegramHandle || "";
  const captured = !!handle;
  const verified = !!patient.telegramVerified;

  const startScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      onUpdate({
        ...patient,
        telegramHandle: "@" + (patient.name || "patient").toLowerCase().replace(/\s+/g, ""),
      });
    }, 1100);
  };

  const rescan = () => {
    setSent(false); setCode(""); setWrong(false);
    onUpdate({ ...patient, telegramHandle: "", telegramVerified: false });
  };

  const sendCode = () => {
    setSending(true);
    setTimeout(() => { setSending(false); setSent(true); }, 600);
  };

  // Round 12 #3 — when the patient taps "Share my number" inside the Telegram
  // bot flow, Telegram returns the registered phone alongside the username.
  // We mock that here with a fixed bot-returned number. Use it to:
  //   1. Override the Mobile field (no OTP needed — Telegram is the verifier)
  //   2. Mark patient.otpVerified = true via mobileVerifiedVia = "telegram_bot"
  // If the nurse already typed a different number, surface an inline conflict
  // prompt instead of silently overwriting.
  const TG_BOT_CC = "+855";
  const TG_BOT_PHONE = "92 415 678";
  const verify = (val) => {
    setCode(val);
    if (val.length === 6) {
      if (val === "123456" || val === "000000") {
        setWrong(false);
        const currentRaw = (patient.phoneNumber || "").replace(/\D/g, "");
        const botRaw = TG_BOT_PHONE.replace(/\D/g, "");
        const noConflict = !currentRaw || currentRaw === botRaw;
        if (noConflict) {
          onUpdate({
            ...patient,
            telegramVerified: true,
            telegramPhone: TG_BOT_PHONE,
            countryCode: TG_BOT_CC,
            phoneNumber: TG_BOT_PHONE,
            mobile: TG_BOT_CC + " " + TG_BOT_PHONE,
            otpVerified: true,
            mobileVerifiedVia: "telegram_bot",
            mobileConflict: null,
          });
        } else {
          onUpdate({
            ...patient,
            telegramVerified: true,
            telegramPhone: TG_BOT_PHONE,
            mobileConflict: {
              entered: (patient.countryCode || "+855") + " " + (patient.phoneNumber || ""),
              viaTelegram: TG_BOT_CC + " " + TG_BOT_PHONE,
              telegramCC: TG_BOT_CC,
              telegramPhone: TG_BOT_PHONE,
            },
          });
        }
      } else {
        setWrong(true);
      }
    } else if (wrong) setWrong(false);
  };

  // === Captured + verified ===
  if (captured && verified) {
    return (
      <div style={{
        background: "var(--success-50)", border: "1.5px solid var(--success-500)",
        borderRadius: 10, padding: 12,
        display: "flex", flexDirection: "column", gap: 0,
        height: "100%",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "var(--success-500)", color: "white",
            display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            <I.Check size={16} strokeWidth={3} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink-900)", display: "flex", alignItems: "center", gap: 6 }}>
              {t("telegram.verified")}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                background: "var(--success-50)", color: "var(--success-600)",
                border: "1px solid var(--success-500)",
                borderRadius: 4, padding: "1px 6px",
                fontSize: 10, fontWeight: 700,
              }}>
                <I.ShieldCheck size={9} strokeWidth={2.5} /> OTP
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-600)", marginTop: 1, fontFamily: "'SF Mono', ui-monospace, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {handle}
            </div>
          </div>
          <button type="button" onClick={rescan} title={t("telegram.rescan")} style={{
            background: "transparent", border: "none", padding: 4, cursor: "pointer",
            color: "var(--ink-500)", display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            <I.Edit size={12} />
          </button>
        </div>
      </div>
    );
  }

  // === Captured, awaiting OTP ===
  if (captured) {
    return (
      <div style={{
        background: "var(--surface-2)", border: "1.5px solid var(--border-strong)",
        borderRadius: 10, padding: 12,
        display: "flex", flexDirection: "column", gap: 8,
        height: "100%",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "#e7f0fa", color: "#2087d6",
            display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            <I.Send size={15} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 650, color: "var(--ink-900)" }}>{t("telegram.verify")}</div>
            <div style={{ fontSize: 10.5, color: "var(--ink-500)", marginTop: 1, fontFamily: "'SF Mono', ui-monospace, monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{handle}</div>
          </div>
          <button type="button" onClick={rescan} title={t("telegram.rescan")} style={{
            background: "transparent", border: "none", padding: 4, cursor: "pointer",
            color: "var(--ink-500)", display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            <I.RefreshCw size={11} />
          </button>
        </div>
        {!sent ? (
          <button
            type="button"
            onClick={sendCode}
            disabled={sending}
            className="btn btn-secondary btn-sm"
            style={{ height: 30, justifyContent: "center", fontSize: 11.5 }}
          >
            {sending
              ? (<><span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> {t("telegram.sending")}</>)
              : (<><I.KeyRound size={12} /> {t("telegram.sendCode")}</>)}
          </button>
        ) : (
          <>
            <input
              className={"input" + (wrong ? " invalid" : "")}
              value={code}
              onChange={e => verify(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={t("telegram.enterCode")}
              autoFocus
              style={{ height: 30, fontSize: 12, letterSpacing: "0.15em", fontFamily: "'SF Mono', ui-monospace, monospace", textAlign: "center" }}
            />
            <div style={{ fontSize: 10.5, color: wrong ? "var(--danger-500)" : "var(--ink-500)", display: "inline-flex", alignItems: "center", gap: 3 }}>
              {wrong ? (<><I.AlertCircle size={10} /> {t("otp.incorrect")}</>) : (<><I.Send size={10} /> {t("telegram.codeSent")}</>)}
            </div>
          </>
        )}
      </div>
    );
  }

  // === Not captured: scan QR ===
  return (
    <div style={{
      background: "var(--surface-2)", border: "1.5px dashed var(--border-strong)",
      borderRadius: 10, padding: 12,
      display: "flex", gap: 10, alignItems: "stretch",
      height: "100%",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 8,
        background: "linear-gradient(135deg, #1a1d24 0%, #0f1115 100%)",
        position: "relative", overflow: "hidden", flexShrink: 0,
        display: "grid", placeItems: "center",
      }}>
        {[
          { top: 5, left: 5, br: ["solid", "solid", "none", "none"] },
          { top: 5, right: 5, br: ["solid", "none", "none", "solid"] },
          { bottom: 5, left: 5, br: ["none", "solid", "solid", "none"] },
          { bottom: 5, right: 5, br: ["none", "none", "solid", "solid"] },
        ].map((c, idx) => (
          <div key={idx} style={{
            position: "absolute",
            top: c.top, left: c.left, bottom: c.bottom, right: c.right,
            width: 12, height: 12,
            borderTop:    c.br[0] === "solid" ? "2px solid var(--brand-400)" : "none",
            borderRight:  c.br[1] === "solid" ? "2px solid var(--brand-400)" : "none",
            borderBottom: c.br[2] === "solid" ? "2px solid var(--brand-400)" : "none",
            borderLeft:   c.br[3] === "solid" ? "2px solid var(--brand-400)" : "none",
          }} />
        ))}
        {scanning && (
          <div style={{
            position: "absolute", left: 8, right: 8,
            height: 2, background: "linear-gradient(90deg, transparent, var(--brand-400), transparent)",
            animation: "scanLine 1.4s linear infinite",
            boxShadow: "0 0 8px var(--brand-400)",
          }} />
        )}
        <div style={{ color: scanning ? "var(--brand-400)" : "rgba(255,255,255,0.35)", transition: "color 0.2s" }}>
          <QRGlyph size={26} />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 650, color: "var(--ink-900)", marginBottom: 2 }}>
            {t("telegram.title")}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-500)", lineHeight: 1.4 }}>
            {t("telegram.hint")}
          </div>
        </div>
        <button
          type="button"
          onClick={startScan}
          disabled={scanning}
          className="btn btn-ghost btn-sm"
          style={{ height: 28, fontSize: 11, justifyContent: "center" }}
        >
          {scanning
            ? (<><span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> {t("telegram.scanning")}</>)
            : (<><I.Camera size={12} /> {t("telegram.start")}</>)}
        </button>
      </div>
    </div>
  );
}

export function FastCheckIn({ patient, onUpdate, onSendLink, sending, sentFlash }) {
  const t = useLang();
  const [errors, setErrors] = useState({});
  const [step2Open, setStep2Open] = useState(false);
  const fullNameRef = useRef(null);

  const update = (key, val) => {
    onUpdate({ ...patient, [key]: val });
  };

  // === Manual-entry path: clear all Step 2 fields and focus Full name ===
  const onManualEntry = () => {
    onUpdate({
      ...patient,
      // Wipe scan-derived & patient details so Step 2 starts blank
      idScanned: false,
      idNumber: "",
      name: "",
      dob: "",
      sexAtBirth: "",
      countryCode: "+855",
      phoneNumber: "",
      mobile: "",
      otpVerified: false,
      telegramHandle: "",
      telegramVerified: false,
      commMethod: "sms",
      // Default new/manual language: Khmer (do not override saved patient preferences elsewhere)
      language: "Khmer",
      identity: { ...(patient.identity || {}), verified: false },
      // Hint flag so other panels can read "manual capture in progress"
      manualEntry: true,
    });
    setStep2Open(true);
    // focus Full name on the next paint
    requestAnimationFrame(() => {
      fullNameRef.current?.focus();
    });
  };

  const reasons = Array.isArray(patient.visitReason)
    ? patient.visitReason
    : (patient.visitReason ? [patient.visitReason] : []);

  const countryCode = patient.countryCode || "+855";
  const phoneNumber = patient.phoneNumber !== undefined
    ? patient.phoneNumber
    : (patient.mobile ? patient.mobile.replace(/^\+\d+\s?/, "") : "");

  const phoneEmpty = !phoneNumber || phoneNumber.trim().length < 6;

  const handleSend = () => {
    const e = {};
    if (!patient.name) e.name = "Required";
    if (phoneEmpty) e.phone = "Enter a valid mobile";
    if (!patient.dob) e.dob = "Required";
    if (reasons.length === 0) e.visitReason = "Select at least one";
    if (!patient.sexAtBirth) e.sex = "Required";
    setErrors(e);
    if (Object.keys(e).length === 0) onSendLink();
  };

  const setPhone = (val) => {
    onUpdate({ ...patient, phoneNumber: val, countryCode, mobile: countryCode + " " + val });
  };
  const setCountry = (cc) => {
    onUpdate({ ...patient, countryCode: cc, phoneNumber, mobile: cc + " " + phoneNumber });
  };

  const idScanned = !!patient.idScanned;
  const telegramVerified = !!patient.telegramVerified;
  const phoneVerified = !!patient.otpVerified;
  // Telegram option locked until captured AND OTP-verified.
  // Auto-default to whichever channel is verified first.
  const commMethod = patient.commMethod === "telegram" && telegramVerified
    ? "telegram"
    : phoneVerified
      ? "sms"
      : (telegramVerified ? "telegram" : (patient.commMethod || "sms"));

  const [otpState, setOtpState] = useState({ status: phoneVerified ? "verified" : "idle" });
  React.useEffect(() => {
    // sync local OTP state if the patient becomes pre-verified (seed/data switch)
    if (phoneVerified && otpState.status !== "verified") setOtpState({ status: "verified" });
  }, [phoneVerified]);
  React.useEffect(() => {
    // mirror local "verified" status into patient.otpVerified
    if (otpState.status === "verified" && !patient.otpVerified) {
      onUpdate({ ...patient, otpVerified: true });
    }
    if (otpState.status !== "verified" && patient.otpVerified && otpState.status !== "idle") {
      // clear when explicitly reset
      if (otpState.status === "idle" || otpState.status === "sent") {
        // no-op for sent flow — only clear on explicit reset
      }
    }
  }, [otpState.status]);

  const onIdScan = () => {
    onUpdate({
      ...patient,
      idScanned: true,
      idNumber: "012345678",
      name: patient.name || "Sokha Pich",
      dob: patient.dob || "1991-08-12",
      sexAtBirth: patient.sexAtBirth || "Female",
      identity: { ...patient.identity, verified: true },
    });
  };

  const step2Visible = step2Open || idScanned;

  return (
    <div className="card">
      <div className="card-head" style={{ flexDirection: "column", alignItems: "flex-start", gap: 0, paddingBottom: 4 }}>
        <h2>{t("checkin.title")}</h2>
        <p className="sub">{t("checkin.sub")}</p>
      </div>

      {/* === STEP 1 · SCAN === */}
      <div className="card-pad" style={{ paddingTop: 12, paddingBottom: 4 }}>
        <div style={{
          fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
          fontWeight: 650, color: "var(--ink-500)", marginBottom: 8,
        }}>{t("checkin.step1")}</div>

        {idScanned ? (
          <ScannedIdCard
            patient={patient}
            onRescan={() => onUpdate({ ...patient, idScanned: false, idNumber: "", manualEntry: false })}
            t={t}
          />
        ) : (
          <div style={{
            border: "1.5px solid var(--border-strong)",
            borderRadius: 10,
            padding: 16,
            background: "var(--surface-2)",
            transition: "all 0.2s",
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div className="row" style={{ gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: "#f0eafd", color: "#7a45ec",
                display: "grid", placeItems: "center", flexShrink: 0,
              }}>
                <I.Lock size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 650, color: "var(--ink-900)" }}>{t("checkin.nationalId")}</div>
                <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>
                  {t("checkin.nationalId.sub")}
                </div>
              </div>
            </div>
            <button
              className="btn btn-secondary"
              onClick={onIdScan}
              style={{ width: "100%", justifyContent: "center", height: 40, fontSize: 13 }}
            >
              <QRGlyph size={16} /> {t("checkin.scanQr")}
            </button>
            {!step2Open && (
              <button
                type="button"
                onClick={onManualEntry}
                style={{
                  background: "transparent", border: "none", padding: 0,
                  color: "var(--brand-600)", fontSize: 12, fontWeight: 500,
                  cursor: "pointer", alignSelf: "center",
                  display: "inline-flex", alignItems: "center", gap: 3,
                }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
              >
                {t("checkin.manualEntry")} <I.ChevronRight size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* === STEP 2 · CONFIRM DETAILS (collapsible) === */}
      <div className="card-pad" style={{ paddingTop: 14, paddingBottom: step2Visible ? undefined : 14 }}>
        <button
          type="button"
          onClick={() => setStep2Open(o => !o)}
          disabled={idScanned}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "transparent", border: "none", padding: 0,
            cursor: idScanned ? "default" : "pointer",
            marginBottom: step2Visible ? 12 : 0,
          }}
        >
          <div style={{
            fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
            fontWeight: 650, color: "var(--ink-500)",
          }}>{t("checkin.step2")}</div>
          <span style={{
            fontSize: 11.5, color: "var(--ink-500)", fontWeight: 550,
            display: "inline-flex", alignItems: "center", gap: 3,
          }}>
            {step2Visible
              ? (<><I.ChevronUp size={13} /> {t("checkin.collapse")}</>)
              : (<><I.ChevronDown size={13} /> {t("checkin.expand")}</>)}
          </span>
        </button>

        {step2Visible && (
          <>
            {/* Row 1: Full name | DOB | Sex at birth */}
            <div className="field-row" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 14 }}>
              <div className="field">
                <label className="label">{t("checkin.fullName")} <span className="req">*</span></label>
                <input
                  ref={fullNameRef}
                  className={"input" + (errors.name ? " invalid" : "")}
                  value={patient.name || ""}
                  onChange={e => update("name", e.target.value)}
                  placeholder={t("checkin.fullName.placeholder")}
                />
                {errors.name && <div className="help error">{errors.name}</div>}
              </div>
              <div className="field">
                <label className="label">{t("checkin.dob")} <span className="req">*</span></label>
                <div className="input-wrap">
                  <input
                    className={"input" + (errors.dob ? " invalid" : "")}
                    value={patient.dob || ""}
                    onChange={e => update("dob", e.target.value)}
                    placeholder={t("checkin.dob.placeholder")}
                    style={{ paddingRight: 32 }}
                  />
                  <I.Calendar size={16} className="rico" />
                </div>
                {errors.dob && <div className="help error">{errors.dob}</div>}
              </div>
              <div className="field">
                <label className="label">{t("checkin.sexAtBirth")} <span className="req">*</span></label>
                <div className="input-wrap">
                  <select
                    className={"select" + (errors.sex ? " invalid" : "")}
                    value={patient.sexAtBirth || ""}
                    onChange={e => update("sexAtBirth", e.target.value)}
                    style={{ paddingRight: 32, appearance: "none" }}
                  >
                    <option value="">{t("checkin.sex.select")}</option>
                    <option value="Female">{t("checkin.sex.female")}</option>
                    <option value="Male">{t("checkin.sex.male")}</option>
                    <option value="Other">{t("checkin.sex.other")}</option>
                  </select>
                  <I.ChevronDown size={14} className="rico" />
                </div>
                {errors.sex && <div className="help error">{errors.sex}</div>}
              </div>
            </div>

            {/* Section heading — Contact channels (left = Telegram, right = SMS) */}
            <div style={{
              fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
              fontWeight: 650, color: "var(--ink-500)", marginBottom: 8,
              display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap",
            }}>
              {t("comm.contactCapture")}
              <span style={{ fontSize: 10.5, color: "var(--ink-400)", textTransform: "none", letterSpacing: 0, fontWeight: 500, fontStyle: "italic" }}>
                · {t("comm.contactCapture.sub")}
              </span>
            </div>

            {/* Row 2 — Telegram (LEFT) | Mobile + OTP (RIGHT) */}
            <div className="field-row checkin-channels" style={{ gridTemplateColumns: "1fr 1.15fr", marginBottom: 14, alignItems: "stretch" }}>
              <TelegramCaptureCard patient={patient} onUpdate={onUpdate} />
              <MobileWithOTP
                countryCode={countryCode}
                phoneNumber={phoneNumber}
                setCountry={setCountry}
                setPhone={setPhone}
                error={errors.phone}
                otpState={otpState}
                setOtpState={setOtpState}
                patient={patient}
                onUpdate={onUpdate}
              />
            </div>

            {/* Row 3 — Preferred Comm (Telegram-locked unless verified) | Language (Khmer default) */}
            <div className="field-row" style={{ gridTemplateColumns: "1.3fr 1fr", marginBottom: 14 }}>
              <CommMethodSelector
                value={commMethod}
                onChange={v => update("commMethod", v)}
                error={errors.commMethod}
                telegramReady={telegramVerified}
                smsReady={phoneVerified}
              />
              <div className="field">
                <label className="label">{t("checkin.language")}</label>
                <div className="input-wrap">
                  <select
                    className="select"
                    value={patient.language || "Khmer"}
                    onChange={e => update("language", e.target.value)}
                    style={{ paddingRight: 32, appearance: "none" }}
                  >
                    <option>Khmer</option>
                    <option>English</option>
                    <option>Vietnamese</option>
                    <option>Thai</option>
                    <option>French</option>
                    <option>Korean</option>
                  </select>
                  <I.ChevronDown size={14} className="rico" />
                </div>
              </div>
            </div>

            {/* Round 10 #5 — Optional Address (cascading dropdowns + free text) */}
            <AddressFields patient={patient} onUpdate={onUpdate} t={t} />
          </>
        )}
      </div>

    </div>
  );
}

export function PatientStub({ patient, onEdit }) {
  const t = useLang();
  const idVerified = patient.identity.verified;
  const reasons = Array.isArray(patient.visitReason)
    ? patient.visitReason.join(", ")
    : (patient.visitReason || "—");
  return (
    <div className="card">
      <div className="card-head">
        <h2>{t("stub.title")}</h2>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>
          <I.Edit size={13} /> {t("stub.edit")}
        </button>
      </div>
      <div className="stub-grid">
        <div className="stub-cell">
          <div className="lab">{t("stub.identity")}</div>
          <div className="val">
            {idVerified ? (
              <><I.CheckCircle size={16} style={{ color: "var(--success-500)" }} /> <span>{t("stub.verified")}</span></>
            ) : (
              <><I.AlertCircle size={16} style={{ color: "var(--warn-500)" }} /> <span style={{ color: "var(--warn-600)" }}>{t("stub.notVerified")}</span></>
            )}
          </div>
        </div>
        <div className="stub-cell">
          <div className="lab">{t("stub.pwaIntake")}</div>
          <div className="val" style={{ flexDirection: "column", alignItems: "stretch", gap: 0 }}>
            <span style={{ fontSize: 12, color: "var(--ink-500)", fontWeight: 500 }}>{patient.pwaProgress}{t("stub.complete")}</span>
            <div className="progress" style={{ marginTop: 8 }}>
              <div style={{ width: patient.pwaProgress + "%" }} />
            </div>
          </div>
        </div>
        <div className="stub-cell">
          <div className="lab">{t("stub.queueNumber")}</div>
          <div className="queue-num"><span className="q">Q -</span> {patient.queueNumber.replace("Q-", "")}</div>
        </div>
      </div>
      <div className="stub-grid" style={{ borderTop: "1px solid var(--border)", gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
        <div className="stub-cell">
          <div className="lab">{t("stub.mobile")}</div>
          <div className="val" style={{ fontSize: 12.5, fontWeight: 550, color: "var(--ink-800)" }}>{patient.mobile}</div>
        </div>
        <div className="stub-cell">
          <div className="lab">{t("stub.dob")}</div>
          <div className="val" style={{ fontSize: 12.5, fontWeight: 550, color: "var(--ink-800)" }}>{patient.dob}</div>
        </div>
        <div className="stub-cell">
          <div className="lab">{t("stub.sexAtBirth")}</div>
          <div className="val" style={{ fontSize: 12.5, fontWeight: 550, color: "var(--ink-800)" }}>{patient.sexAtBirth || patient.gender}</div>
        </div>
        <div className="stub-cell">
          <div className="lab">{t("stub.created")}</div>
          <div className="val" style={{ fontSize: 12.5, fontWeight: 550, color: "var(--ink-800)" }}>{patient.arrivedRaw}</div>
        </div>
      </div>
    </div>
  );
}

export function OrderDraft({ patient, onRemove, onAddService }) {
  const t = useLang();
  const total = patient.services.reduce((s, x) => s + x.amount, 0);
  return (
    <div className="card">
      <div className="card-head">
        <h2>{t("order.title")}</h2>
        <button className="btn btn-ghost btn-sm" onClick={onAddService} style={{ color: "var(--brand-600)", borderColor: "transparent" }}>
          <I.Plus size={13} /> {t("order.addService")}
        </button>
      </div>
      <div className="card-pad" style={{ paddingTop: 4, paddingBottom: 0 }}>
        <div className="chips">
          {patient.services.map((s, i) => (
            <span key={i} className="chip">
              {s.name}
              <button className="chip-x" onClick={() => onRemove(i)}><I.X size={11} /></button>
            </span>
          ))}
          {patient.services.length === 0 && (
            <span style={{ fontSize: 12.5, color: "var(--ink-500)" }}>{t("order.noServices")}</span>
          )}
        </div>
      </div>
      {patient.services.length > 0 && (
        <>
          <table className="order-table" style={{ marginLeft: "var(--card-pad)", marginRight: "var(--card-pad)", width: "calc(100% - 2*var(--card-pad))" }}>
            <thead>
              <tr>
                <th>{t("order.service")}</th>
                <th>{t("order.payer")}</th>
                <th>{t("order.status")}</th>
                <th>{t("order.amount")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {patient.services.map((s, i) => (
                <tr key={i}>
                  <td style={{ color: "var(--ink-900)", fontWeight: 550 }}>{s.name}</td>
                  <td style={{ color: "var(--ink-700)" }}>{s.payer}</td>
                  <td>
                    <span className="status-cell" style={{
                      color: s.status === "draft"    ? "var(--brand-600)"
                           : s.status === "ready"    ? "var(--success-600)"
                           : s.status === "blocked"  ? "var(--danger-500)"
                           : "var(--ink-600)"
                    }}>
                      <span className="dot" /> {t("status." + s.status) || s.status}
                    </span>
                  </td>
                  <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 550 }}>${s.amount.toFixed(2)}</td>
                  <td><button className="row-act" onClick={() => onRemove(i)}><I.MoreHorizontal size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="estimated">
            <span className="muted">{t("order.estimatedTotal")}</span>
            <span className="total">${total.toFixed(2)}</span>
          </div>
        </>
      )}
    </div>
  );
}
