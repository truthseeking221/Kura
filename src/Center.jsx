// === Center column: Fast Check-in (with QR scan step), Patient Stub, Order Draft ===
import React, { useState } from "react";
import { I } from "./icons";
import {
  QRGlyph,
  MultiSelectSearch,
  CountryCodeSelect,
  VISIT_REASONS,
} from "./shared";
import { useLang, VISIT_REASON_KEYS } from "./i18n";

// === Mobile field with OTP verification ===
function MobileWithOTP({ countryCode, phoneNumber, setCountry, setPhone, error, otpState, setOtpState }) {
  const t = useLang();
  const [code, setCode] = React.useState("");
  const [countdown, setCountdown] = React.useState(0);
  const status = otpState.status;
  const phoneValid = phoneNumber.replace(/\D/g, "").length >= 8;

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
              <button type="button" onClick={resetToIdle} title="Edit number" style={{
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
    </div>
  );
}

// === Preferred Communication Method segmented selector ===
function CommMethodSelector({ value, onChange, error }) {
  const t = useLang();
  const opts = [
    { id: "sms",      labelKey: "comm.sms",      icon: I.MessageSquare },
    { id: "telegram", labelKey: "comm.telegram", icon: I.Send },
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
          const Ico = o.icon;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              style={{
                background: active ? "var(--brand-50)" : "transparent",
                color: active ? "var(--brand-700)" : "var(--ink-600)",
                border: active ? "1px solid var(--brand-200)" : "1px solid transparent",
                borderRadius: 5,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                padding: 0,
              }}
            >
              <Ico size={12} /> {t(o.labelKey)}
            </button>
          );
        })}
      </div>
      {error && <div className="help error">{error}</div>}
    </div>
  );
}

// === Inline Telegram QR scanner widget (when Telegram comm method chosen) ===
function TelegramQRInline({ patient, onUpdate }) {
  const t = useLang();
  const [scanning, setScanning] = React.useState(false);
  const username = patient.telegramHandle || "";
  const captured = !!username;

  const startScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      onUpdate({
        ...patient,
        telegramHandle: "@" + (patient.name || "patient").toLowerCase().replace(/\s+/g, ""),
      });
    }, 1300);
  };

  const rescan = () => onUpdate({ ...patient, telegramHandle: "" });

  if (captured) {
    return (
      <div style={{
        marginTop: 10,
        background: "var(--success-50)", border: "1px solid var(--success-200, #a7f3d0)",
        borderRadius: 8, padding: "10px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: "var(--success-500)", color: "white",
            display: "grid", placeItems: "center",
          }}>
            <I.Check size={14} strokeWidth={3} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink-900)" }}>{t("telegram.captured")}</span>
            <span style={{ fontSize: 11.5, color: "var(--ink-700)", fontFamily: "'SF Mono', ui-monospace, monospace" }}>{username}</span>
          </div>
        </div>
        <button type="button" onClick={rescan} style={{
          background: "transparent", border: "none", padding: 0, cursor: "pointer",
          color: "var(--brand-600)", fontSize: 11.5, fontWeight: 600,
          display: "inline-flex", alignItems: "center", gap: 3,
        }}>
          <I.Edit size={11} /> {t("telegram.rescan")}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: 10,
      background: "var(--surface-2)", border: "1px dashed var(--border-strong)",
      borderRadius: 8, padding: 14,
      display: "flex", gap: 14, alignItems: "center",
    }}>
      {/* Viewfinder */}
      <div style={{
        width: 120, height: 120, borderRadius: 10,
        background: "linear-gradient(135deg, #1a1d24 0%, #0f1115 100%)",
        position: "relative", overflow: "hidden", flexShrink: 0,
        display: "grid", placeItems: "center",
      }}>
        {[
          { top: 8, left: 8, br: ["solid", "solid", "none", "none"] },
          { top: 8, right: 8, br: ["solid", "none", "none", "solid"] },
          { bottom: 8, left: 8, br: ["none", "solid", "solid", "none"] },
          { bottom: 8, right: 8, br: ["none", "none", "solid", "solid"] },
        ].map((c, idx) => (
          <div key={idx} style={{
            position: "absolute",
            top: c.top, left: c.left, bottom: c.bottom, right: c.right,
            width: 18, height: 18,
            borderTop:    c.br[0] === "solid" ? "2.5px solid #5fb1f5" : "none",
            borderRight:  c.br[1] === "solid" ? "2.5px solid #5fb1f5" : "none",
            borderBottom: c.br[2] === "solid" ? "2.5px solid #5fb1f5" : "none",
            borderLeft:   c.br[3] === "solid" ? "2.5px solid #5fb1f5" : "none",
            borderTopLeftRadius:     c.br[0] === "solid" && c.br[3] === "solid" ? 4 : 0,
            borderTopRightRadius:    c.br[0] === "solid" && c.br[1] === "solid" ? 4 : 0,
            borderBottomLeftRadius:  c.br[2] === "solid" && c.br[3] === "solid" ? 4 : 0,
            borderBottomRightRadius: c.br[2] === "solid" && c.br[1] === "solid" ? 4 : 0,
          }} />
        ))}
        {scanning && (
          <div style={{
            position: "absolute", left: 14, right: 14,
            height: 2, background: "linear-gradient(90deg, transparent, #5fb1f5, transparent)",
            animation: "scanLine 1.4s linear infinite",
            boxShadow: "0 0 8px #5fb1f5",
          }} />
        )}
        <div style={{ color: scanning ? "#5fb1f5" : "rgba(255,255,255,0.35)", transition: "color 0.2s" }}>
          <QRGlyph size={42} />
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 650, color: "var(--ink-900)", marginBottom: 3 }}>
          {t("telegram.title")}
        </div>
        <div style={{
          fontSize: 11.5, color: "var(--ink-600)", lineHeight: 1.45,
          fontStyle: "italic", marginBottom: 10,
        }}>
          {t("telegram.hint")}
        </div>
        <button
          type="button"
          onClick={startScan}
          disabled={scanning}
          className="btn btn-ghost btn-sm"
          style={{ height: 30 }}
        >
          {scanning
            ? (<><span className="spinner" /> {t("telegram.scanning")}</>)
            : (<><I.Camera size={13} /> {t("telegram.start")}</>)}
        </button>
      </div>
    </div>
  );
}

export function FastCheckIn({ patient, onUpdate, onSendLink, sending, sentFlash }) {
  const t = useLang();
  const [errors, setErrors] = useState({});
  const [step2Open, setStep2Open] = useState(false);

  const update = (key, val) => {
    onUpdate({ ...patient, [key]: val });
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
  const commMethod = patient.commMethod === "telegram" ? "telegram" : "sms";

  const [otpState, setOtpState] = useState({ status: "idle" });

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

        <div style={{
          border: "1.5px solid " + (idScanned ? "var(--success-500)" : "var(--border-strong)"),
          borderRadius: 10,
          padding: 16,
          background: idScanned ? "var(--success-50)" : "var(--surface-2)",
          transition: "all 0.2s",
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div className="row" style={{ gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: idScanned ? "var(--success-500)" : "#f0eafd",
              color: idScanned ? "white" : "#7a45ec",
              display: "grid", placeItems: "center", flexShrink: 0,
            }}>
              {idScanned ? <I.Check size={18} strokeWidth={2.5} /> : <I.Lock size={18} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 650, color: "var(--ink-900)" }}>{t("checkin.nationalId")}</div>
              <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>
                {idScanned ? t("checkin.nationalId.scanned") : t("checkin.nationalId.sub")}
              </div>
            </div>
            {idScanned && (
              <button
                onClick={() => onUpdate({ ...patient, idScanned: false, idNumber: "" })}
                className="btn btn-ghost btn-sm"
                style={{ height: 28 }}
              >
                <I.RefreshCw size={12} /> {t("checkin.rescan")}
              </button>
            )}
          </div>

          {idScanned ? (
            <div style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 7, padding: "10px 12px",
              fontSize: 12, color: "var(--ink-700)",
              fontFamily: "'SF Mono', ui-monospace, monospace",
            }}>
              {patient.name || "—"} · ID {patient.idNumber || ""} · {patient.dob}
            </div>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                onClick={onIdScan}
                style={{ width: "100%", justifyContent: "center", height: 40, fontSize: 13 }}
              >
                <QRGlyph size={16} /> Scan QR
              </button>
              {!step2Open && (
                <button
                  type="button"
                  onClick={() => setStep2Open(true)}
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
            </>
          )}
        </div>
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

            {/* Row 2: Mobile (with OTP) | Preferred Comm | Language */}
            <div className="field-row" style={{ gridTemplateColumns: "1.4fr 1.1fr 0.9fr", marginBottom: 14 }}>
              <MobileWithOTP
                countryCode={countryCode}
                phoneNumber={phoneNumber}
                setCountry={setCountry}
                setPhone={setPhone}
                error={errors.phone}
                otpState={otpState}
                setOtpState={setOtpState}
              />
              <CommMethodSelector
                value={commMethod}
                onChange={v => update("commMethod", v)}
                error={errors.commMethod}
              />
              <div className="field">
                <label className="label">{t("checkin.language")}</label>
                <div className="input-wrap">
                  <select
                    className="select"
                    value={patient.language || "English"}
                    onChange={e => update("language", e.target.value)}
                    style={{ paddingRight: 32, appearance: "none" }}
                  >
                    <option>English</option>
                    <option>Khmer</option>
                    <option>Vietnamese</option>
                    <option>Thai</option>
                    <option>French</option>
                    <option>Korean</option>
                  </select>
                  <I.ChevronDown size={14} className="rico" />
                </div>
              </div>
            </div>

            {/* Conditional: Telegram QR inline scanner */}
            {commMethod === "telegram" && (
              <TelegramQRInline patient={patient} onUpdate={onUpdate} />
            )}
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
