/* =========================================================
   REPORT-GENERATOR.JS
   Builds the GymBMI health report content and renders it as
   one or more downloadable PDFs (using pdf-lib), based on the
   sections the user selected (BMI / Diet / Diet Chart) and the
   last calculated BMI result (window.GymBMI.lastResult).

   Each selected report type is built and downloaded as its
   own, separate PDF — e.g. selecting all three downloads
   three files, one after another; selecting only two
   downloads only those two.

   This file only knows how to BUILD and DOWNLOAD the report.
   It has no knowledge of the popup, form, or validation —
   see report-popup.js for that.

   Depends on:
     - pdf-lib (load via CDN before this file, exposes
       window.PDFLib)
     - bmi-calculator.js (for window.GymBMI.lastResult)
     - patient-info-section.js (load before this file; draws
       the "PATIENT INFORMATION" block — kept in its own file
       so it can be reused/maintained independently as more
       sections get added to the report)

   Exposes:
     - window.GymBMIReport.generateAndDownload(selected)
       selected: array of 'bmi' | 'diet' | 'chart'
       returns a Promise that resolves with the list of
       filenames downloaded (in order) once every selected
       report has been downloaded, or rejects with an Error
       whose `.code` is 'NO_RESULT', 'NO_PDFLIB', or
       'NO_SELECTION'.
   ========================================================= */

window.GymBMIReport = (function () {

  // A4 in points
  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 50;

  const COLOR_TEXT = [0.07, 0.09, 0.15];
  const COLOR_HEADING = [0.15, 0.35, 0.85];
  const COLOR_MUTED = [0.45, 0.45, 0.5];
  const COLOR_RULE = [0.82, 0.85, 0.9];

  // Delay between successive downloads so browsers don't
  // swallow rapid-fire, script-triggered downloads.
  const DOWNLOAD_STAGGER_MS = 400;

  // ---- Report type definitions -----------------------------------
  // Order here also controls the download order when multiple
  // types are selected.

  const REPORT_DEFS = [
    {
      id: 'bmi',
      filename: 'gymbmi-bmi-report.pdf',
      heading: 'BMI Report',
      // Patient Information block is scoped to the BMI report
      // for now; flip to true on other defs once that section
      // is ready to appear there too.
      includePatientInfo: true,
      rows: (r) => [
        ['Age', `${r.age}`],
        ['BMI', `${r.bmi} (${r.category})`],
        ['Healthy Weight Range', `${r.weightRange}`]
      ]
    },
    {
      id: 'diet',
      filename: 'gymbmi-diet-report.pdf',
      heading: 'Diet Report',
      rows: (r) => [
        ['Recommended Daily Calories', `${r.calories} kcal`],
        ['Goal', `${r.goal}`]
      ]
    },
    {
      id: 'chart',
      filename: 'gymbmi-diet-chart.pdf',
      heading: 'Diet Chart',
      rows: (r) => [
        ['Estimated Body Fat', `${r.bodyFat}%`],
        ['Daily Water Goal', `${r.water} L`]
      ]
    }
  ];

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---- PDF rendering --------------------------------------------
  // Builds a single-report PDF for one report definition.

  async function buildPdfBytes(lastResult, reportDef) {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;

    function ensureSpace(lineHeight) {
      if (y - lineHeight < MARGIN) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
    }

    function drawText(text, opts = {}) {
      const {
        size = 11,
        bold = false,
        color = COLOR_TEXT,
        gap = 18
      } = opts;

      ensureSpace(gap);
      page.drawText(text, {
        x: MARGIN,
        y,
        size,
        font: bold ? fontBold : font,
        color: rgb(color[0], color[1], color[2])
      });
      y -= gap;
    }

    // Title
    drawText('GymBMI - Personal Health Report', { size: 18, bold: true, gap: 26 });

    ensureSpace(12);
    page.drawLine({
      start: { x: MARGIN, y: y + 8 },
      end: { x: PAGE_WIDTH - MARGIN, y: y + 8 },
      thickness: 1,
      color: rgb(COLOR_RULE[0], COLOR_RULE[1], COLOR_RULE[2])
    });
    y -= 12;

    // Patient Information block (delegated to patient-info-section.js)
    if (reportDef.includePatientInfo && window.GymBMIPatientInfoSection) {
      const patientInfo = window.GymBMIPatientInfoSection.getPatientInfo();
      const result = window.GymBMIPatientInfoSection.draw(page, y, {
        pdfDoc,
        font,
        fontBold,
        addPage: () => pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      }, patientInfo);
      page = result.page;
      y = result.y - 18; // breathing room before the next section
    }

    // Single section: this report type only
    drawText(reportDef.heading, { size: 14, bold: true, gap: 22, color: COLOR_HEADING });
    reportDef.rows(lastResult).forEach(([label, value]) => {
      drawText(`${label}: ${value}`, { size: 11, gap: 18 });
    });
    y -= 8;

    y -= 4;
    drawText(
      'This report is a screening estimate, not a medical diagnosis.',
      { size: 9, gap: 13, color: COLOR_MUTED }
    );
    drawText(
      'Consult a doctor for personalized advice.',
      { size: 9, gap: 13, color: COLOR_MUTED }
    );

    return pdfDoc.save();
  }

  // ---- Download ---------------------------------------------------

  function triggerDownload(pdfBytes, filename) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function generateAndDownload(selected) {
    if (!window.GymBMI || !window.GymBMI.lastResult) {
      const err = new Error('No BMI result available yet.');
      err.code = 'NO_RESULT';
      throw err;
    }

    if (!window.PDFLib) {
      const err = new Error('pdf-lib is not loaded.');
      err.code = 'NO_PDFLIB';
      throw err;
    }

    // Keep only known report types, in the fixed REPORT_DEFS order,
    // regardless of the order `selected` was passed in.
    const reportsToBuild = REPORT_DEFS.filter((def) => selected.includes(def.id));

    if (reportsToBuild.length === 0) {
      const err = new Error('No report types selected.');
      err.code = 'NO_SELECTION';
      throw err;
    }

    const lastResult = window.GymBMI.lastResult;
    const downloaded = [];

    for (let i = 0; i < reportsToBuild.length; i++) {
      const reportDef = reportsToBuild[i];
      const pdfBytes = await buildPdfBytes(lastResult, reportDef);
      triggerDownload(pdfBytes, reportDef.filename);
      downloaded.push(reportDef.filename);

      // Stagger downloads after the current one (skip after the last).
      if (i < reportsToBuild.length - 1) {
        await sleep(DOWNLOAD_STAGGER_MS);
      }
    }

    return downloaded;
  }

  return {
    generateAndDownload
  };

})();
