/* =========================================================
   PATIENT-INFO-SECTION.JS
   Draws the "PATIENT INFORMATION" block (title bar + 3 data
   columns + a meta footer row) onto a pdf-lib page, styled
   after the GymBMI report layout.

   Kept separate from report-generator.js on purpose so this
   one block can be reused across report types (BMI / Diet /
   Diet Chart) and maintained independently as the report
   grows more sections in future.

   Depends on:
     - pdf-lib (window.PDFLib) — same as report-generator.js

   Exposes:
     - window.GymBMIPatientInfoSection.getPatientInfo()
         Reads window.GymBMI.patientInfo (if present) and
         merges it with window.GymBMI.lastResult + sensible
         auto-generated defaults (report id, dates, etc.) so
         every value ends up dynamic instead of hardcoded.

     - window.GymBMIPatientInfoSection.draw(page, y, ctx, info)
         page   : current pdf-lib PDFPage
         y      : top y-coordinate to start drawing at
         ctx    : { pdfDoc, font, fontBold, addPage } where
                  addPage() returns a fresh page (for page
                  breaks) — same contract report-generator.js
                  already uses internally
         info   : object from getPatientInfo() (or a custom
                  one with the same shape)
         returns: { page, y } — the (possibly new) page and
                  the y-coordinate immediately below the
                  section, so the caller can keep drawing.
   ========================================================= */

window.GymBMIPatientInfoSection = (function () {

  const MARGIN = 50;
  const PAGE_WIDTH = 595.28;

  const COLOR_NAVY = [0.06, 0.09, 0.20];
  const COLOR_WHITE = [1, 1, 1];
  const COLOR_TEXT = [0.07, 0.09, 0.15];
  const COLOR_LABEL = [0.35, 0.38, 0.45];
  const COLOR_MUTED = [0.45, 0.45, 0.5];
  const COLOR_RULE = [0.82, 0.85, 0.9];
  const COLOR_BOX_BG = [0.98, 0.98, 0.99];

  const TITLE_BAR_HEIGHT = 20;
  const ROW_HEIGHT = 15;
  const LABEL_VALUE_GAP = 82; // x-distance from a column's label start to its value start
  const TOP_PADDING = 12;
  const BOTTOM_PADDING = 8;
  const FOOTER_ROW_HEIGHT = 20;

  // ---- dynamic value helpers --------------------------------------

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function formatDate(d) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatDateTime(d) {
    let hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${formatDate(d)}, ${pad(hours)}:${pad(d.getMinutes())} ${ampm}`;
  }

  function addDays(d, days) {
    const copy = new Date(d.getTime());
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function generateReportId(patientId, d) {
    const id = (patientId || 'XXXXXX').toString().slice(-6);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `GMB/BMI/${d.getFullYear()}/${id}${rand}`.slice(0, 24);
  }

  // Patient ID: current UTC time, formatted YYYYMMDDHHmmss (UTC),
  // so every generated report gets a fresh, sortable, unique id
  // with no dependence on any other stored value.
  function generatePatientId(d) {
    return (
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
      `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
    );
  }

  // Reads a live DOM field's current value (trimmed). Safe to call
  // even if the element isn't present on the page.
  function domValue(id) {
    if (typeof document === 'undefined') return '';
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  // Same as domValue(), but parses to a number and returns undefined
  // (never NaN, never '') when the field is empty/unparseable, so it
  // plays nicely with `??` fallback chains.
  function domNumber(id) {
    const raw = domValue(id);
    if (raw === '') return undefined;
    const n = parseFloat(raw);
    return isNaN(n) ? undefined : n;
  }

  // Parses a "DD/MM/YYYY" Date of Birth string (as used by #dob)
  // into a UTC Date, or null if it doesn't match/parse.
  function parseDob(str) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str || '');
    if (!m) return null;
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const year = parseInt(m[3], 10);
    const d = new Date(Date.UTC(year, month, day));
    return isNaN(d.getTime()) ? null : d;
  }

  // Whole-years age as of `now`, derived from a DOB Date.
  function computeAge(dobDate, now) {
    if (!dobDate) return null;
    let age = now.getUTCFullYear() - dobDate.getUTCFullYear();
    const monthDiff = now.getUTCMonth() - dobDate.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dobDate.getUTCDate())) {
      age--;
    }
    return age;
  }

  // Derives BMI from height (cm) + weight (kg) when nothing upstream
  // has already computed one. Returns undefined (not NaN) if either
  // input is missing, so it composes cleanly with `??` chains.
  function computeBmi(heightCm, weightKg) {
    if (!heightCm || !weightKg) return undefined;
    const heightM = heightCm / 100;
    return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
  }

  // Standard WHO BMI category for a numeric BMI. Returns undefined
  // for a missing/invalid input.
  function categoryFor(bmi) {
    if (typeof bmi !== 'number' || isNaN(bmi)) return undefined;
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  }

  // Pulls everything needed for the block from live app state
  // (window.GymBMI.patientInfo + window.GymBMI.lastResult), falling
  // back to the live DOM fields (BMI form + report popup form) for
  // anything not already captured there, so nothing is hardcoded.
  function getPatientInfo() {
    const stored = (window.GymBMI && window.GymBMI.patientInfo) || {};
    const result = (window.GymBMI && window.GymBMI.lastResult) || {};
    const now = new Date();

    const dobDate = parseDob(stored.dob || domValue('dob'));
    const derivedAge = computeAge(dobDate, now);

    const patientId = stored.patientId || generatePatientId(now);

    const examDate = stored.examinationDate ? new Date(stored.examinationDate) : now;
    const followUpDate = stored.followUpDate
      ? new Date(stored.followUpDate)
      : addDays(examDate, stored.followUpDays || 90);

    return {
      name: stored.name || domValue('reportName') || '—',
      patientId,
      age: stored.age ?? result.age ?? derivedAge ?? '—',
      gender: stored.gender || domValue('gender') || '—',
      mobile: stored.mobile || domValue('reportMobile') || '—',
      email: stored.email || domValue('reportEmail') || '—',

      height: stored.height ?? result.height ?? domNumber('height') ?? '—',
      weight: stored.weight ?? result.weight ?? domNumber('weight') ?? '—',
      bmi: result.bmi ?? stored.bmi ?? computeBmi(
        stored.height ?? result.height ?? domNumber('height'),
        stored.weight ?? result.weight ?? domNumber('weight')
      ) ?? '—',
      bmiCategory: result.category ?? stored.bmiCategory ?? categoryFor(
        result.bmi ?? stored.bmi
      ) ?? '—',

      reportId: stored.reportId || generateReportId(patientId, now),
      examinationDate: formatDateTime(examDate),
      followUpDate: formatDate(followUpDate),
      reportGenerated: formatDateTime(now),
      reportType: stored.reportType || 'BMI Analysis Report',

      referredBy: stored.referredBy || '—',
      collectedBy: stored.collectedBy || 'GymBMI Center',
      machineModel: stored.machineModel || '—',
      softwareVersion: stored.softwareVersion || '—',
      reportVersion: stored.reportVersion || '1.0'
    };
  }

  // ---- drawing -------------------------------------------------------

  function draw(page, y, ctx, info) {
    const { pdfDoc, font, fontBold, addPage } = ctx;
    const { rgb } = window.PDFLib;
    const boxWidth = PAGE_WIDTH - 2 * MARGIN;
    const col1X = MARGIN + 14;
    const col2X = MARGIN + boxWidth * 0.42;
    const col3X = MARGIN + boxWidth * 0.68;

    const leftRows = [
      ['Name', info.name],
      ['Patient ID', info.patientId],
      ['Age / Gender', `${info.age} Y / ${info.gender}`],
      ['Mobile No.', info.mobile],
      ['Email', info.email]
    ];
    const midRows = [
      ['Height', typeof info.height === 'number' ? `${info.height} cm` : info.height],
      ['Weight', typeof info.weight === 'number' ? `${info.weight} kg` : info.weight],
      ['BMI', typeof info.bmi === 'number' ? `${info.bmi} kg/m²` : info.bmi],
      ['BMI Classification', info.bmiCategory]
    ];
    const rightRows = [
      ['Report ID', info.reportId],
      ['Examination Date', info.examinationDate],
      ['Follow-up Date', info.followUpDate],
      ['Report Generated', info.reportGenerated],
      ['Report Type', info.reportType]
    ];

    const bodyRowCount = Math.max(leftRows.length, midRows.length, rightRows.length);
    const bodyHeight = TOP_PADDING + bodyRowCount * ROW_HEIGHT + BOTTOM_PADDING;
    const totalHeight = TITLE_BAR_HEIGHT + bodyHeight + FOOTER_ROW_HEIGHT;

    // Page break if the whole block doesn't fit
    if (y - totalHeight < MARGIN) {
      page = addPage();
      y = page.getSize().height - MARGIN;
    }

    let cursorY = y;

    // Title bar
    page.drawRectangle({
      x: MARGIN,
      y: cursorY - TITLE_BAR_HEIGHT,
      width: boxWidth,
      height: TITLE_BAR_HEIGHT,
      color: rgb(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2])
    });
    page.drawText('PATIENT INFORMATION', {
      x: col1X,
      y: cursorY - TITLE_BAR_HEIGHT + 6,
      size: 11,
      font: fontBold,
      color: rgb(COLOR_WHITE[0], COLOR_WHITE[1], COLOR_WHITE[2])
    });
    cursorY -= TITLE_BAR_HEIGHT;

    // Body background + border
    page.drawRectangle({
      x: MARGIN,
      y: cursorY - bodyHeight,
      width: boxWidth,
      height: bodyHeight,
      color: rgb(COLOR_BOX_BG[0], COLOR_BOX_BG[1], COLOR_BOX_BG[2]),
      borderColor: rgb(COLOR_RULE[0], COLOR_RULE[1], COLOR_RULE[2]),
      borderWidth: 1
    });

    function drawColumn(x, rows) {
      let rowY = cursorY - TOP_PADDING;
      rows.forEach(([label, value]) => {
        page.drawText(label, {
          x,
          y: rowY,
          size: 9,
          font: fontBold,
          color: rgb(COLOR_LABEL[0], COLOR_LABEL[1], COLOR_LABEL[2])
        });
        page.drawText(`: ${value}`, {
          x: x + LABEL_VALUE_GAP,
          y: rowY,
          size: 9,
          font,
          color: rgb(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2])
        });
        rowY -= ROW_HEIGHT;
      });
    }

    drawColumn(col1X, leftRows);
    drawColumn(col2X, midRows);
    drawColumn(col3X, rightRows);

    cursorY -= bodyHeight;

    // Footer meta row
    page.drawRectangle({
      x: MARGIN,
      y: cursorY - FOOTER_ROW_HEIGHT,
      width: boxWidth,
      height: FOOTER_ROW_HEIGHT,
      borderColor: rgb(COLOR_RULE[0], COLOR_RULE[1], COLOR_RULE[2]),
      borderWidth: 1
    });

    const footerItems = [
      ['Referred By', info.referredBy],
      ['Collected By', info.collectedBy],
      ['Machine Model', info.machineModel],
      ['Software Version', info.softwareVersion],
      ['Report Version', info.reportVersion]
    ];
    const footerColWidth = boxWidth / footerItems.length;
    footerItems.forEach(([label, value], i) => {
      const x = MARGIN + i * footerColWidth + 8;
      const textY = cursorY - FOOTER_ROW_HEIGHT + 8;
      page.drawText(`${label}:`, {
        x,
        y: textY,
        size: 7.5,
        font: fontBold,
        color: rgb(COLOR_LABEL[0], COLOR_LABEL[1], COLOR_LABEL[2])
      });
      page.drawText(`${value}`, {
        x,
        y: textY - 9,
        size: 7.5,
        font,
        color: rgb(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
      });
    });

    cursorY -= FOOTER_ROW_HEIGHT;

    return { page, y: cursorY };
  }

  return {
    getPatientInfo,
    draw,
    computeBmi,
    categoryFor
  };

})();
