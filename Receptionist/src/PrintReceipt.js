// === PrintReceipt — generate printable A4 PDF for receipts & service indications ===
//
// Approach: build an HTML document with inline CSS, open it in a new window,
// trigger window.print(). Browser's native "Save as PDF" gives the nurse a PDF
// without needing jsPDF (which can't handle complex Vietnamese text + layout
// without lots of pain). Pixel-perfect via mm/pt units pinned to A4.
//
// Two layouts are produced as separate pages in the same PDF:
//   - Bill page  (Figma "Bill pdf" 1:3381)        — for lab orders + payment
//   - Service page (Figma "non lab test PDF")     — for imaging/vitals/etc.
// Whichever set of items the patient has determines which pages appear.
//
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import kuraLogoUrl from "./assets/kura-logo.svg";
import { getCoverage } from "./coverage";

function groupItemsByBundle(items, bundles = []) {
  const meta = new Map((bundles || []).map(b => [b.id, b]));
  const grouped = new Map();
  const standalone = [];
  items.forEach(it => {
    if (it.bundleId) {
      const arr = grouped.get(it.bundleId) || [];
      arr.push(it);
      grouped.set(it.bundleId, arr);
    } else {
      standalone.push(it);
    }
  });
  const bundleGroups = [];
  for (const [bid, arr] of grouped.entries()) {
    const m = meta.get(bid) || { id: bid, name: arr[0]?.bundleName || "Bundle", purpose: arr[0]?.bundlePurpose };
    bundleGroups.push({
      id: bid,
      name: m.name,
      purpose: m.purpose,
      items: arr,
      subtotal: arr.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0),
    });
  }
  return { bundleGroups, standalone };
}

function itemSplit(item, insurance) {
  const gross = (item.price || 0) * (item.qty || 1);
  if ((item.payer || "direct") === "corporate") {
    return { patient: 0, insurance: 0, corporate: gross, gross, coverage: null };
  }
  const coverage = getCoverage(item.id, insurance);
  if (coverage?.kind === "covered") {
    const insPays = gross * ((coverage.percent || 0) / 100);
    return { patient: Math.max(0, gross - insPays), insurance: insPays, corporate: 0, gross, coverage };
  }
  if ((item.payer || "direct") === "insurance") {
    const insPays = gross * 0.8;
    return { patient: Math.max(0, gross - insPays), insurance: insPays, corporate: 0, gross, coverage };
  }
  return { patient: gross, insurance: 0, corporate: 0, gross, coverage };
}

const KHR_RATE = 4100;

// ---------- helpers ----------
const fmtCcy = (usd, ccy = "USD") =>
  ccy === "KHR" ? "៛" + Math.round(usd * KHR_RATE).toLocaleString() : "$" + usd.toFixed(2);

const fmtDate = (d) => {
  const dt = d ? new Date(d) : new Date();
  if (Number.isNaN(dt.getTime())) return "—";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const fmtDateTime = (d) => {
  const dt = d ? new Date(d) : new Date();
  if (Number.isNaN(dt.getTime())) return "—";
  const time = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
  return `${fmtDate(dt)} ${time}`;
};

const ageFromDob = (dob) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
};

const sentence = (...parts) => parts.filter(Boolean).join(" ");

// number → English words (shortened for receipt totals)
function numToWords(n) {
  const ones = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
  const tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
  const chunk = (x) => {
    if (x < 20) return ones[x];
    if (x < 100) return tens[Math.floor(x/10)] + (x%10 ? "-" + ones[x%10] : "");
    return ones[Math.floor(x/100)] + " hundred" + (x%100 ? " " + chunk(x%100) : "");
  };
  if (n === 0) return "zero";
  const parts = [];
  const units = [["billion",1e9],["million",1e6],["thousand",1e3],["",1]];
  let rem = Math.floor(n);
  for (const [label, val] of units) {
    const q = Math.floor(rem / val);
    rem = rem % val;
    if (q > 0) parts.push(chunk(q) + (label ? " " + label : ""));
  }
  return parts.join(" ");
}

// Generate Code 128 barcode as SVG markup
function barcodeSvg(value, opts = {}) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, value || "0000000000", {
      format: "CODE128",
      displayValue: false,
      width: 1.6,
      height: 38,
      margin: 0,
      background: "#ffffff",
      lineColor: "#000000",
      ...opts,
    });
  } catch (e) {
    return "";
  }
  return new XMLSerializer().serializeToString(svg);
}

// Generate QR code as data URL (PNG) — async
async function qrDataUrl(value, opts = {}) {
  try {
    return await QRCode.toDataURL(value || "https://kura.med", {
      margin: 0,
      width: 220,
      color: { dark: "#0c1a3f", light: "#ffffff" },
      errorCorrectionLevel: "M",
      ...opts,
    });
  } catch (e) {
    return "";
  }
}

// Stable test-code + URN-style id derived from the order id, so each printout
// looks like a real lab system code instead of "vit-pkg" etc.
function testCode(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  const num = Math.abs(h) % 100000;
  return String(num).padStart(5, "0") + " " + (Math.abs(h >> 5) % 10);
}
function shortCode(id, prefix) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  const seed = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let out = prefix || "";
  let v = Math.abs(h);
  for (let i = 0; i < 7; i++) { out += seed[v % seed.length]; v = Math.floor(v / seed.length); }
  return out;
}

// Pick service-group letters for non-lab tests (X-ray = XR, Ultrasound = US, ECG = ECG, etc.)
function serviceGroup(item) {
  const n = (item.name || "").toLowerCase();
  if (n.includes("x-ray") || n.includes("xray")) return "Radiology";
  if (n.includes("ultrasound") || n.includes("us ")) return "Ultrasound";
  if (n.includes("ecg") || n.includes("ekg")) return "Cardiology";
  if (n.includes("ct ") || n.includes("mri")) return "Imaging";
  if (item.kind === "vitals") return "Vital Signs";
  if (item.kind === "telecon") return "Teleconsult";
  return "Service";
}
function testGroupTag(item) {
  const n = (item.name || "").toLowerCase();
  if (n.includes("blood") || n.includes("cbc")) return "CBC";
  if (n.includes("vitamin")) return "BIOCH";
  if (n.includes("hormone") || n.includes("testosterone")) return "ENDO";
  if (n.includes("urine") || n.includes("urin")) return "URIN";
  return "INV";
}

// ---------- patient data normalization ----------
function patientFields(patient) {
  const phone = sentence(patient.countryCode, patient.phoneNumber).trim() || patient.mobile || "";
  const a = ageFromDob(patient.dob);
  return {
    name: (patient.name || "—").toUpperCase(),
    patientNo: patient.idNumber ? "P" + patient.idNumber.replace(/[^0-9A-Z]/gi, "").slice(0, 8).padEnd(7, "0") : "P" + (patient.id || "00000000").replace(/[^0-9A-Z]/gi, "").slice(-7).padEnd(7, "0"),
    dob: patient.dob ? fmtDate(patient.dob) : "—",
    age: a != null ? `${a} Year(s)` : "",
    gender: patient.sexAtBirth || patient.gender || "—",
    contact: phone || "—",
    email: patient.email || "—",
    address: patient.address || "—",
    city: patient.city || "—",
    queueNumber: patient.queueNumber || "—",
    client: patient.client || patient.referrer || "WALKIN",
    urn: patient.urn || "—",
    location: patient.location || "D001",
  };
}

function patientPhotoSrc(patient) {
  const src = patient?.photoDataUrl || patient?.photo?.dataUrl || "";
  if (typeof src !== "string") return "";
  return /^data:image\/(png|jpe?g|webp|gif|bmp|svg\+xml);/i.test(src) ? src : "";
}

// ---------- Bill page (lab + paid items) ----------
function billPageHtml({ patient, totals, payment, ccy, paymentLine, barcodeMarkup, billNo, billDateStr, logoSrc, splitInfo }) {
  const fields = patientFields(patient);
  const photoSrc = patientPhotoSrc(patient);
  const due = totals.total;

  return `
  <section class="page bill-page">
    <header class="bp-header${photoSrc ? " has-photo" : ""}">
      ${photoSrc ? `<div class="bp-patient-photo"><img src="${photoSrc}" alt="Patient photo"/></div>` : ""}
      <img src="${logoSrc}" class="bp-logo" alt="Kura"/>
      <div class="bp-brand-text">
        <div class="bp-brand-name">KURA HEALTH</div>
        <div class="bp-brand-sub">#42 Street 240, Sangkat Chaktomuk, Khan Daun Penh, Phnom Penh</div>
        <div class="bp-brand-sub">Hotline 1800 23 90 90 · info@kura.med · www.kura.med</div>
      </div>
      <div class="bp-header-right">
        <div class="bp-title">ORDER DETAILS</div>
        <div class="bp-barcode">${barcodeMarkup}</div>
        <div class="bp-barcode-num">${billNo}</div>
      </div>
    </header>

    <section class="bp-info">
      <div class="bp-info-row"><span class="bp-info-key">Name</span><span class="bp-info-val">: ${escape(fields.name)}</span><span class="bp-info-key">Patient No.</span><span class="bp-info-val">: ${fields.patientNo}</span><span class="bp-info-key">Bill Date</span><span class="bp-info-val">: ${escape(billDateStr)}</span></div>
      <div class="bp-info-row"><span class="bp-info-key">DOB</span><span class="bp-info-val">: ${fields.dob} ${fields.age ? `<span class="bp-age">${fields.age}</span>` : ""}</span><span class="bp-info-key">Gender</span><span class="bp-info-val">: ${escape(fields.gender)}</span><span class="bp-info-key">Email</span><span class="bp-info-val">: ${escape(fields.email)}</span></div>
      <div class="bp-info-row"><span class="bp-info-key">Contact No</span><span class="bp-info-val">: ${escape(fields.contact)}</span><span class="bp-info-key">Address</span><span class="bp-info-val">: ${escape(fields.address)}</span><span class="bp-info-key">City</span><span class="bp-info-val">: ${escape(fields.city)}</span></div>
    </section>

    <section class="bp-split">
      <div class="bp-split-head">
        <span class="bp-split-title">Bill Breakdown</span>
        ${splitInfo.insurer ? `<span class="bp-split-insurer">Insurer: ${escape(splitInfo.insurer)}</span>` : ""}
      </div>
      <table class="bp-split-table">
        <thead>
          <tr>
            <th class="col-desc">Description</th>
            <th class="col-cov">Coverage</th>
            <th class="col-ins">Insurance Pays</th>
            <th class="col-pat">Patient Pays</th>
            <th class="col-amt">Total</th>
          </tr>
        </thead>
        <tbody>
          ${splitInfo.bundleGroups.map(g => `
            <tr class="bp-row-bundle">
              <td class="col-desc">
                <span class="bp-bundle-name">${escape(g.name)}</span>
                ${g.purpose ? `<span class="bp-bundle-purpose">${escape(g.purpose)}</span>` : ""}
              </td>
              <td class="col-cov"></td>
              <td class="col-ins">${fmtCcy(g.insurance, ccy)}</td>
              <td class="col-pat">${fmtCcy(g.patient, ccy)}</td>
              <td class="col-amt">${fmtCcy(g.gross, ccy)}</td>
            </tr>
            ${g.items.map(r => `
              <tr class="bp-row-child">
                <td class="col-desc"><span class="bp-child-marker">└</span> ${escape(r.name)}</td>
                <td class="col-cov">${escape(r.label)}</td>
                <td class="col-ins">${fmtCcy(r.insurance, ccy)}</td>
                <td class="col-pat">${fmtCcy(r.patient, ccy)}</td>
                <td class="col-amt">${fmtCcy(r.gross, ccy)}</td>
              </tr>`).join("")}
          `).join("")}
          ${splitInfo.standaloneRows.map(r => `
            <tr>
              <td class="col-desc">${escape(r.name)}</td>
              <td class="col-cov">${escape(r.label)}</td>
              <td class="col-ins">${fmtCcy(r.insurance, ccy)}</td>
              <td class="col-pat">${fmtCcy(r.patient, ccy)}</td>
              <td class="col-amt">${fmtCcy(r.gross, ccy)}</td>
            </tr>`).join("")}
        </tbody>
        <tfoot>
          <tr>
            <td class="col-desc" colspan="2">Subtotals</td>
            <td class="col-ins">${fmtCcy(splitInfo.totalInsurance, ccy)}</td>
            <td class="col-pat">${fmtCcy(splitInfo.totalPatient, ccy)}</td>
            <td class="col-amt">${fmtCcy(splitInfo.totalGross, ccy)}</td>
          </tr>
        </tfoot>
      </table>
    </section>

    <section class="bp-pay">
      <div class="bp-pay-modes">
        <div class="bp-pay-modes-title">Payment Modes</div>
        <div class="bp-pay-modes-line">${paymentLine}</div>
        <div class="bp-pay-modes-words"><span>Amount Received in words:</span> ${escape(numToWords(Math.round(due)).replace(/^./, c => c.toUpperCase()))} ${ccy === "KHR" ? "Riel" : "US Dollar"}${due === 1 ? "" : "s"}.</div>
      </div>
      <dl class="bp-pay-totals">
        <div><dt>Received Amount:</dt><dd>${fmtCcy(payment?.status === "confirmed" ? due : 0, ccy)}</dd></div>
        <div><dt>Gross Amount</dt><dd>: ${fmtCcy(totals.subtotal, ccy)}</dd></div>
        <div><dt>Discount</dt><dd>: ${fmtCcy(totals.discount, ccy)}</dd></div>
        ${splitInfo && splitInfo.hasInsurance ? `
        <div><dt>Insurance Pays</dt><dd>: ${fmtCcy(splitInfo.totalInsurance, ccy)}</dd></div>
        <div><dt>Patient Pays</dt><dd>: ${fmtCcy(splitInfo.totalPatient, ccy)}</dd></div>` : ""}
        <div><dt>Net Amount</dt><dd>: ${fmtCcy(totals.total, ccy)}</dd></div>
        <div class="bp-pay-grand"><dt>Grand Total</dt><dd>: ${fmtCcy(totals.total, ccy)}</dd></div>
      </dl>
    </section>

    <footer class="bp-footer">
      <p class="bp-consent-head">By voluntarily providing personal information and data to use products/services and/or signing below, you confirm that you have read, understood and agreed to the following:</p>
      <ol class="bp-consent">
        <li>All data you provide to Kura is true and accurate;</li>
        <li>You have been informed and clearly understood the contents of personal data processing and protection (including the type of processed personal data; the purpose and method of processing; your rights and obligations and other related contents) published on Kura's website and at Kura's counters.</li>
      </ol>
    </footer>
  </section>`;
}

// ---------- Service page (non-lab tests, e.g. imaging/vitals/ECG) ----------
function servicePageHtml({ patient, items, barcodeMarkup, billNo, logoSrc }) {
  const fields = patientFields(patient);
  const today = fmtDate(new Date());
  const rows = items.map(i => `
    <div class="sp-svc-row">
      <div class="sp-svc-name">${escape(i.name || "")}</div>
      <div class="sp-svc-code">${shortCode(i.id, "")}</div>
    </div>`).join("");

  return `
  <section class="page service-page">
    <header class="sp-header">
      <img src="${logoSrc}" class="sp-logo" alt="Kura"/>
      <div class="sp-brand">
        <div class="sp-brand-name">KURA HEALTH</div>
        <div class="sp-brand-sub">Service Indication</div>
      </div>
      <div class="sp-barcode">${barcodeMarkup}<div class="sp-barcode-num">${billNo}</div></div>
    </header>

    <section class="sp-patient">
      <div class="sp-patient-left">
        <div class="sp-patient-name">${escape(fields.name)}</div>
        <div class="sp-patient-id mono">${escape(fields.patientNo.split("").join(" "))}</div>
      </div>
      <dl class="sp-patient-grid">
        <div><dt>Date of birth</dt><dd>${fields.dob}</dd></div>
        <div><dt>Gender</dt><dd>${escape(fields.gender)}</dd></div>
        <div><dt>Phone</dt><dd>${escape(fields.contact)}</dd></div>
        <div><dt>Client</dt><dd>${escape(fields.client)}</dd></div>
      </dl>
    </section>

    <section class="sp-services">
      <div class="sp-services-head">
        <span>Service</span>
        <span>Code</span>
      </div>
      ${rows || `<div class="sp-empty">No services</div>`}
    </section>

    <section class="sp-warn">
      <div class="sp-warn-icon">!</div>
      <div class="sp-warn-text">
        <strong>Attention to female patients:</strong> If pregnant or possibly pregnant, do NOT undergo X-ray imaging.
      </div>
    </section>

    <footer class="sp-footer">
      <div class="sp-footer-text">
        <strong>Please return to the reception counter after your examination.</strong>
      </div>
    </footer>
  </section>`;
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

// ---------- styles ----------
const styles = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #e7eaee; font-family: 'Noto Sans', -apple-system, system-ui, sans-serif; color: #0c1a3f; }
.sheet { padding: 24px 0; display: flex; flex-direction: column; align-items: center; gap: 18px; }
.page {
  width: 210mm; min-height: 297mm; background: #fff; padding: 10mm 10mm;
  position: relative; box-shadow: 0 8px 28px rgba(0,0,0,.08);
  font-size: 9.5pt; line-height: 1.38; color: #0c1a3f;
  page-break-after: avoid; break-after: avoid;
  display: flex; flex-direction: column;
}
.mono { font-family: 'Noto Sans', -apple-system, system-ui, sans-serif; }

/* ---------- Bill page ---------- */
.bp-header {
  display: grid; grid-template-columns: auto 1fr auto; column-gap: 14px; align-items: center;
  padding-bottom: 10px; border-bottom: 1.5px solid #0c1a3f; margin-bottom: 12px;
}
.bp-header.has-photo { grid-template-columns: auto auto 1fr auto; column-gap: 12px; }
.bp-patient-photo {
  width: 48px; height: 60px; border: 1px solid #cfd4df; border-radius: 3px;
  overflow: hidden; background: #f3f4f7;
}
.bp-patient-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.bp-logo { width: 56px; height: 56px; object-fit: contain; display: block; }
.bp-brand-text { min-width: 0; }
.bp-brand-name { font-size: 13pt; font-weight: 700; letter-spacing: 0.06em; color: #10069f; line-height: 1.1; }
.bp-brand-sub { font-size: 7.5pt; color: #4a5169; line-height: 1.45; margin-top: 2px; }
.bp-header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; min-width: 140px; }
.bp-title {
  font-size: 8pt; font-weight: 700; letter-spacing: 0.16em; color: #4a5169;
  text-transform: uppercase; padding: 2px 8px; border: 1px solid #cfd4df; border-radius: 3px;
}
.bp-barcode { line-height: 0; }
.bp-barcode svg { width: 130px; height: 34px; display: block; }
.bp-barcode-num { font-family: 'Noto Sans', -apple-system, system-ui, sans-serif; font-size: 9pt; font-weight: 700; letter-spacing: 0.06em; color: #0c1a3f; }

.bp-info { padding: 4px 0 8px; }
.bp-info-row { display: grid; grid-template-columns: 70px 1fr 80px 1fr 70px 1fr; gap: 0 6px; padding: 3px 0; font-size: 9.5pt; }
.bp-info-key { color: #4a5169; }
.bp-info-val { color: #0c1a3f; font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bp-age { color: #6b7280; margin-left: 6px; font-weight: 400; }

.bp-orders { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9.5pt; font-family: 'Courier New', 'Roboto Mono', monospace; }
.bp-orders thead th { background: #f3f4f7; border-top: 1px solid #1c2748; border-bottom: 1px solid #1c2748; padding: 6px 8px; text-align: left; font-weight: 700; font-family: 'Courier New', 'Roboto Mono', monospace; }
.bp-orders thead th.col-amt { text-align: right; }
.bp-orders tbody td { padding: 5px 8px; border-bottom: 1px solid #ebecf0; font-family: 'Courier New', 'Roboto Mono', monospace; }
.bp-orders .col-desc { width: auto; }
.bp-orders .col-amt { width: 110px; text-align: right; font-weight: 700; }
.bp-orders .bp-empty { text-align: center; padding: 16px; color: #6b7280; font-style: italic; }
.bp-orders .bp-row-bundle td { background: #f3f4f7; border-bottom: 1px solid #d6d8df; padding-top: 7px; padding-bottom: 7px; font-weight: 700; }
.bp-orders .bp-row-bundle .bp-bundle-name { display: inline-block; font-weight: 700; color: #0c1a3f; letter-spacing: 0.02em; }
.bp-orders .bp-row-bundle .bp-bundle-purpose { display: inline-block; margin-left: 8px; font-weight: 400; color: #4a5169; font-size: 8.5pt; font-style: italic; }
.bp-orders .bp-row-bundle .bp-bundle-count { display: inline-block; margin-left: 8px; font-weight: 500; color: #6b7280; font-size: 8.5pt; }
.bp-orders .bp-row-child td { padding-top: 4px; padding-bottom: 4px; color: #1c2748; }
.bp-orders .bp-row-child .col-desc { padding-left: 18px; color: #1c2748; font-weight: 500; }
.bp-orders .bp-child-marker { color: #6b7280; margin-right: 4px; }

.bp-split { margin-top: 14px; border: 1px solid #d6d8df; border-radius: 4px; padding: 10px 12px; background: #fafbfc; }
.bp-split-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid #ebecf0; }
.bp-split-title { font-weight: 700; font-size: 9.5pt; color: #0c1a3f; letter-spacing: 0.04em; }
.bp-split-insurer { font-size: 8.5pt; color: #4a5169; }
.bp-split-table { width: 100%; border-collapse: collapse; font-size: 9pt; font-family: 'Courier New', 'Roboto Mono', monospace; }
.bp-split-table th { text-align: left; padding: 4px 4px; font-weight: 700; color: #4a5169; border-bottom: 1px solid #d6d8df; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; }
.bp-split-table td { padding: 5px 4px; border-bottom: 1px solid #ebecf0; }
.bp-split-table .col-desc { width: auto; }
.bp-split-table .col-cov { width: 90px; color: #4a5169; }
.bp-split-table .col-ins { width: 90px; text-align: right; color: #0866f5; font-weight: 600; }
.bp-split-table .col-pat { width: 90px; text-align: right; font-weight: 600; }
.bp-split-table .col-amt { width: 80px; text-align: right; font-weight: 700; }
.bp-split-table thead th.col-ins, .bp-split-table thead th.col-pat, .bp-split-table thead th.col-amt { text-align: right; }
.bp-split-table tfoot td { padding-top: 7px; font-weight: 700; border-top: 1.5px solid #1c2748; border-bottom: 0; color: #0c1a3f; }
.bp-split-table tfoot .col-desc { color: #4a5169; }
.bp-split-table .bp-row-bundle td { background: #eef0f4; border-bottom: 1px solid #d6d8df; font-weight: 700; padding-top: 6px; padding-bottom: 6px; }
.bp-split-table .bp-row-bundle .bp-bundle-name { font-weight: 700; color: #0c1a3f; letter-spacing: 0.02em; }
.bp-split-table .bp-row-bundle .bp-bundle-purpose { display: inline-block; margin-left: 8px; font-weight: 400; color: #4a5169; font-size: 8.5pt; font-style: italic; }
.bp-split-table .bp-row-child td { padding-top: 4px; padding-bottom: 4px; color: #1c2748; }
.bp-split-table .bp-row-child .col-desc { padding-left: 18px; font-weight: 500; }
.bp-split-table .bp-child-marker { color: #6b7280; margin-right: 4px; }

.bp-pay { display: grid; grid-template-columns: 1fr 200px; gap: 28px; margin-top: 16px; padding-top: 6px; border-top: 1.5px solid #0c1a3f; align-items: start; }
.bp-pay-modes-title { font-weight: 700; font-size: 9pt; margin-bottom: 4px; }
.bp-pay-modes-line { font-size: 9pt; color: #1c2748; padding: 2px 0; }
.bp-pay-modes-words { font-size: 8.5pt; color: #4a5169; margin-top: 8px; line-height: 1.5; }
.bp-pay-totals { font-size: 9pt; }
.bp-pay-totals > div { display: grid; grid-template-columns: 1fr auto; padding: 2px 0; }
.bp-pay-totals dt { color: #4a5169; }
.bp-pay-totals dd { font-weight: 500; min-width: 70px; text-align: right; }
.bp-pay-totals .bp-pay-grand { border-top: 1px solid #d6d8df; margin-top: 4px; padding-top: 6px; font-weight: 700; font-size: 10pt; }
.bp-pay-totals .bp-pay-grand dt, .bp-pay-totals .bp-pay-grand dd { color: #0c1a3f; }

.bp-footer { margin-top: auto; padding-top: 16px; font-size: 7.5pt; color: #4a5169; }
.bp-consent-head { line-height: 1.5; }
.bp-consent { padding-left: 16px; margin-top: 4px; line-height: 1.55; }
.bp-consent li { padding: 2px 0; }
.bp-footer-grid { display: grid; grid-template-columns: 70px 1fr auto; gap: 14px; align-items: center; margin-top: 14px; padding-top: 10px; border-top: 1px solid #d6d8df; }
.bp-qr img { width: 64px; height: 64px; display: block; }
.bp-footer-note { font-size: 7.5pt; line-height: 1.55; }
.bp-sign { font-size: 9pt; color: #0c1a3f; text-align: right; padding-bottom: 14px; align-self: end; min-width: 140px; }

/* ---------- Service page ---------- */
.sp-header { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: center; padding-bottom: 10px; border-bottom: 1.5px solid #0c1a3f; }
.sp-logo { width: 56px; height: 56px; object-fit: contain; }
.sp-brand-name { font-size: 13pt; font-weight: 700; letter-spacing: 0.06em; color: #10069f; }
.sp-brand-sub { font-size: 9.5pt; color: #4a5169; margin-top: 2px; }
.sp-barcode svg { width: 110px; height: 36px; }
.sp-barcode-num { font-family: 'Noto Sans', -apple-system, system-ui, sans-serif; font-size: 8.5pt; font-weight: 600; text-align: right; margin-top: 2px; letter-spacing: 0.04em; }

.sp-patient { display: grid; grid-template-columns: 1fr 1.4fr; gap: 24px; padding: 14px 0 12px; border-bottom: 1px solid #ebecf0; align-items: start; }
.sp-patient-name { font-size: 14pt; font-weight: 700; color: #0c1a3f; letter-spacing: 0.02em; }
.sp-patient-id { font-size: 11pt; letter-spacing: 0.18em; margin-top: 6px; color: #0c1a3f; font-weight: 500; }
.sp-patient-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 9.5pt; }
.sp-patient-grid dt { color: #6b7280; font-size: 8.5pt; margin-bottom: 1px; }
.sp-patient-grid dd { color: #0c1a3f; font-weight: 600; }

.sp-services { margin-top: 14px; border: 1px solid #d6d8df; border-radius: 4px; overflow: hidden; }
.sp-services-head { display: grid; grid-template-columns: 1fr 110px; padding: 8px 12px; font-size: 8.5pt; font-weight: 700; color: #4a5169; background: #f3f4f7; border-bottom: 1px solid #d6d8df; text-transform: uppercase; letter-spacing: 0.06em; }
.sp-svc-row { display: grid; grid-template-columns: 1fr 110px; padding: 9px 12px; align-items: center; border-bottom: 1px solid #ebecf0; }
.sp-svc-row:last-child { border-bottom: 0; }
.sp-svc-name { font-size: 10pt; color: #0c1a3f; font-weight: 600; }
.sp-svc-code { font-family: 'Courier New', monospace; font-size: 9.5pt; color: #4a5169; letter-spacing: 0.04em; }
.sp-empty { padding: 18px; text-align: center; color: #6b7280; font-style: italic; font-size: 9pt; }

.sp-warn { display: grid; grid-template-columns: 22px 1fr; gap: 10px; align-items: center; margin-top: 18px; padding: 10px 12px; background: #eef5ff; border: 1px solid #c8dcff; border-radius: 4px; }
.sp-warn-icon { width: 22px; height: 22px; border-radius: 50%; background: #0866f5; color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 14px; }
.sp-warn-text { font-size: 8.5pt; line-height: 1.5; color: #0c1a3f; }
.sp-warn-text em { font-style: italic; color: #4a5169; }

.sp-footer { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 16px; margin-top: auto; padding-top: 18px; }
.sp-footer-text { font-size: 9pt; line-height: 1.55; color: #0c1a3f; }
.sp-qr img { width: 78px; height: 78px; display: block; }

/* ---------- Toolbar (visible only on screen) ---------- */
.toolbar { position: sticky; top: 0; z-index: 10; background: #0c1a3f; color: #fff; padding: 10px 18px; display: flex; gap: 8px; align-items: center; justify-content: center; }
.toolbar-title { flex: 1; font-size: 13px; font-weight: 600; letter-spacing: 0.04em; }
.toolbar-btn { background: #fff; color: #0c1a3f; border: none; border-radius: 6px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
.toolbar-btn.ghost { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,.4); }
.toolbar-btn:hover { opacity: .9; }

@page { size: A4; margin: 0; }
@media print {
  html, body { background: #fff; }
  .toolbar { display: none !important; }
  .sheet { padding: 0; gap: 0; }
  .page { box-shadow: none; margin: 0; page-break-after: avoid; break-after: avoid; page-break-inside: avoid; break-inside: avoid; }
}
`;

// ---------- main entry ----------
export async function printPatientReceipt(patient) {
  if (!patient) return;
  // Open window FIRST (synchronously in click handler) before any await,
  // otherwise the browser strips the user-gesture and blocks the popup
  // (or shows it blank). We write content into it after async work finishes.
  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) {
    alert("Please allow pop-ups to print the receipt.");
    return;
  }
  // Show a loading splash so the tab isn't blank while QR/logo resolve.
  win.document.open();
  win.document.write('<!doctype html><meta charset="utf-8"><title>Preparing receipt…</title><style>body{margin:0;display:grid;place-items:center;height:100vh;font-family:system-ui,sans-serif;color:#0c1a3f;background:#e7eaee}</style><body><div>Preparing receipt…</div></body>');
  win.document.close();

  const cart = patient.cart || { items: [], payment: {}, ccy: "USD" };
  const items = cart.items || [];
  const ccy = cart.ccy || "USD";
  const payment = cart.payment || {};
  const subtotal = items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
  const totals = { subtotal, discount: 0, total: subtotal };
  const billNo = (payment.receiptId || "K-" + Math.floor(10_000_000 + Math.random() * 90_000_000)).replace(/^R-/, "K");
  const billDateStr = fmtDateTime(payment.confirmedAt || new Date());

  // Single-page output: all items rendered on bill page.
  const billItems = items;

  // Payment modes line ("Card · USD · 28.00 (R-71563)")
  const methodLabel = ({ cash: "Cash", khqr: "KHQR (Bakong)", split: "Cash + KHQR", card: "Credit/Debit Card" }[payment.method]) || "—";
  const paidAmt = Number(payment.amount ?? totals.total);
  const paymentLine = payment.status === "confirmed"
    ? `${methodLabel} — ${ccy === "KHR" ? "Khmer Riel" : "US Dollar"} — ${fmtCcy(paidAmt, ccy)} (${payment.receiptId || billNo})`
    : payment.status === "deferred"
      ? `Pay later — to be collected at exit (${billNo})`
      : `Pending — ${fmtCcy(totals.total, ccy)}`;

  const barcodeMarkup = barcodeSvg(billNo);

  // Logo as data URL so the popup window has no module-loading dependency
  const logoSrc = await fetch(kuraLogoUrl)
    .then(r => r.text())
    .then(t => "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(t))))
    .catch(() => kuraLogoUrl);

  const insurance = patient.insurance || [];
  const cartBundles = cart.bundles || [];
  const labelFor = (i, s) => {
    if (s.coverage?.kind === "covered") return `${s.coverage.percent}%`;
    if ((i.payer || "direct") === "insurance") return "80%";
    if ((i.payer || "direct") === "corporate") return "Corporate";
    if (s.coverage?.kind === "preauth") return "Pre-auth";
    if (s.coverage?.kind === "not-covered") return "Not covered";
    if (s.coverage?.kind === "unconfirmed") return "Unconfirmed";
    return "—";
  };
  const buildSplitInfo = (rowItems) => {
    const { bundleGroups, standalone } = groupItemsByBundle(rowItems, cartBundles);
    const buildItem = (i) => {
      const s = itemSplit(i, insurance);
      return { name: i.name || "", insurance: s.insurance, patient: s.patient, gross: s.gross, label: labelFor(i, s) };
    };
    const groups = bundleGroups.map(g => {
      const childRows = g.items.map(buildItem);
      return {
        kind: "bundle",
        id: g.id,
        name: g.name,
        purpose: g.purpose,
        items: childRows,
        insurance: childRows.reduce((sum, r) => sum + r.insurance, 0),
        patient: childRows.reduce((sum, r) => sum + r.patient, 0),
        gross: childRows.reduce((sum, r) => sum + r.gross, 0),
      };
    });
    const standaloneRows = standalone.map(buildItem);
    const totalInsurance = groups.reduce((s, g) => s + g.insurance, 0) + standaloneRows.reduce((s, r) => s + r.insurance, 0);
    const totalPatient = groups.reduce((s, g) => s + g.patient, 0) + standaloneRows.reduce((s, r) => s + r.patient, 0);
    const totalGross = groups.reduce((s, g) => s + g.gross, 0) + standaloneRows.reduce((s, r) => s + r.gross, 0);
    const insurer = insurance.find(p => p.eligibility?.state === "eligible")?.provider || insurance[0]?.provider || null;
    return {
      hasInsurance: insurance.length > 0 || totalInsurance > 0,
      insurer, bundleGroups: groups, standaloneRows, totalInsurance, totalPatient, totalGross,
    };
  };

  const splitInfo = buildSplitInfo(billItems);
  const pages = [billPageHtml({ patient, totals, payment, ccy, paymentLine, barcodeMarkup, billNo, billDateStr, logoSrc, splitInfo })];

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Kura Receipt · ${escape(patient.name || "Patient")} · ${billNo}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Roboto+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${styles}</style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-title">Kura Receipt — ${escape(patient.name || "Patient")} · ${billNo}</div>
    <button class="toolbar-btn" onclick="window.print()">Print / Save as PDF</button>
    <button class="toolbar-btn ghost" onclick="window.close()">Close</button>
  </div>
  <main class="sheet">${pages.join("")}</main>
  <script>
    window.addEventListener('load', () => { setTimeout(() => window.print(), 350); });
  </script>
</body>
</html>`;

  // Window already opened above (synchronously) and may have been closed by
  // the user — guard before writing.
  if (win.closed) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
