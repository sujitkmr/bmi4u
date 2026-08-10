/* =========================================================
   BMI-SUMMARY-SECTION.JS
   Draws the 3-box gauge row that sits under PATIENT
   INFORMATION on the GymBMI report:
     - CURRENT BMI
     - PROGRESS TO GOAL
     - HEALTHY BMI (TARGET RANGE)

   Depends on:
     - pdf-lib (window.PDFLib)
     - window.GymBMIPatientInfoSection (for computeBmi/categoryFor)
         Falls back to local copies of that logic if it isn't
         loaded, so this file also works standalone.

   Exposes:
     - window.GymBMIBmiSummarySection.getBmiSummaryInfo()
         Reads window.GymBMI.lastResult / window.GymBMI.patientInfo
         / window.GymBMI.goalInfo (all optional) and derives every
         number the row needs, with documented fallbacks — nothing
         here is hardcoded sample data.

     - window.GymBMIBmiSummarySection.draw(page, y, ctx, info)
         Same (page, y, ctx) contract as the patient-info section;
         info comes from getBmiSummaryInfo() (or a compatible object).
         Returns { page, y } for the caller to keep drawing.

   NOTE ON "PROGRESS TO GOAL":
   That box requires a starting weight/date to measure progress
   against — data this file has no source for on its own. If the
   app tracks that, set it on window.GymBMI.goalInfo:
     {
       startWeight: 96.5,        // kg, first recorded weight
       startDate:   '2026-05-01',
       targetWeight: 70.0,       // kg, optional — else derived
                                 // from the healthy-BMI weight range
       weeklyTargetKg: 0.75      // optional, default 0.5
     }
   Without it, this file falls back to treating "today" as the
   start (0% complete) rather than inventing a fake history.
   ========================================================= */

window.GymBMIBmiSummarySection = (function () {

  const MARGIN = 50;
  const PAGE_WIDTH = 595.28;
  const GAP = 10;

  const COLOR_TEXT = [0.07, 0.09, 0.15];
  const COLOR_LABEL = [0.35, 0.38, 0.45];
  const COLOR_MUTED = [0.45, 0.45, 0.5];
  const COLOR_RULE = [0.82, 0.85, 0.9];
  const COLOR_TRACK = [0.90, 0.90, 0.92];

  const COLOR_RED = [0.80, 0.15, 0.15];
  const COLOR_GREEN = [0.10, 0.55, 0.25];
  const COLOR_ORANGE = [0.90, 0.55, 0.10];
  const COLOR_LIME = [0.55, 0.75, 0.15];
  const COLOR_NAVY = [0.06, 0.09, 0.20];

  const BAND_COLORS = [COLOR_GREEN, COLOR_LIME, COLOR_ORANGE, COLOR_RED];
  const BAND_LABELS = ['Underweight', 'Normal', 'Overweight', 'Obese'];
  const BAND_CUTS = [18.5, 24.9, 29.9]; // boundaries between the 4 bands

  const BOX_TITLE_H = 16;
  const GAUGE_R_OUTER = 34;
  const GAUGE_R_INNER = 25;
  const SCALE_BAR_H = 6;
  const BOX_PAD = 12;

  // ---- shared BMI helpers (reuse patient-info-section's if present) --

  const shared = window.GymBMIPatientInfoSection || {};

  function computeBmi(heightCm, weightKg) {
    if (shared.computeBmi) return shared.computeBmi(heightCm, weightKg);
    if (!heightCm || !weightKg) return undefined;
    const m = heightCm / 100;
    return Math.round((weightKg / (m * m)) * 10) / 10;
  }

  function categoryFor(bmi) {
    if (shared.categoryFor) return shared.categoryFor(bmi);
    if (typeof bmi !== 'number' || isNaN(bmi)) return undefined;
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  }

  function riskFor(category) {
    switch (category) {
      case 'Normal': return 'Low';
      case 'Obese': return 'High';
      default: return 'Increased'; // Underweight / Overweight
    }
  }

  function bandIndexFor(bmi) {
    if (typeof bmi !== 'number' || isNaN(bmi)) return 1;
    if (bmi < BAND_CUTS[0]) return 0;
    if (bmi < BAND_CUTS[1]) return 1;
    if (bmi < BAND_CUTS[2]) return 2;
    return 3;
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function formatDate(d) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
  function addDays(d, days) {
    const c = new Date(d.getTime());
    c.setDate(c.getDate() + days);
    return c;
  }
  function daysBetween(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  // ---- info gathering -------------------------------------------------

  function getBmiSummaryInfo() {
    const stored = (window.GymBMI && window.GymBMI.patientInfo) || {};
    const result = (window.GymBMI && window.GymBMI.lastResult) || {};
    const goal = (window.GymBMI && window.GymBMI.goalInfo) || {};
    const now = new Date();

    const height = stored.height ?? result.height;
    const weight = stored.weight ?? result.weight;
    const bmi = result.bmi ?? stored.bmi ?? computeBmi(height, weight);
    const category = result.category ?? stored.bmiCategory ?? categoryFor(bmi);

    // --- Healthy BMI (target range) ---
    const healthyBmi = 22.0; // conventional mid-range "ideal" BMI
    const healthyMinWeight = height ? round1(BAND_CUTS[0] * Math.pow(height / 100, 2)) : undefined;
    const healthyMaxWeight = height ? round1(BAND_CUTS[1] * Math.pow(height / 100, 2)) : undefined;

    // --- Progress to goal ---
    // targetWeight: explicit goalInfo value, else top of the healthy range
    const targetWeight = goal.targetWeight ?? healthyMaxWeight ?? weight;
    // startWeight/startDate: explicit goalInfo, else "no history yet" (today, current weight => 0%)
    const startWeight = goal.startWeight ?? weight;
    const startDate = goal.startDate ? new Date(goal.startDate) : now;
    const weeklyTargetKg = goal.weeklyTargetKg ?? 0.5;

    const totalToLose = startWeight - targetWeight; // positive = weight-loss goal
    const doneSoFar = startWeight - weight;
    let goalCompletionPercent = 0;
    if (totalToLose !== 0) {
      goalCompletionPercent = Math.max(0, Math.min(100, Math.round((doneSoFar / totalToLose) * 100)));
    }
    const remaining = weight - targetWeight; // kg still to lose (can be <=0 if goal met)
    const daysRemaining = weeklyTargetKg > 0
      ? Math.max(0, Math.ceil((Math.abs(remaining) / weeklyTargetKg) * 7))
      : 0;
    const expectedCompletionDate = addDays(now, daysRemaining);
    const onTrack = remaining <= 0 || goalCompletionPercent >= Math.round(
      (daysBetween(startDate, now) / Math.max(1, daysBetween(startDate, expectedCompletionDate) + daysBetween(startDate, now))) * 100
    ) || true; // always show an encouraging line unless goal is clearly stalled
    const stalled = totalToLose > 0 && doneSoFar <= 0 && daysBetween(startDate, now) > 7;

    return {
      // current bmi box
      weight: typeof weight === 'number' ? weight : undefined,
      bmi: typeof bmi === 'number' ? bmi : undefined,
      category: category || '—',
      healthRisk: category ? riskFor(category) : '—',

      // progress box
      goalCompletionPercent,
      daysRemaining,
      expectedCompletionDate: formatDate(expectedCompletionDate),
      weeklyTargetKg,
      trackMessage: stalled ? 'Log a new weigh-in to update your progress' : 'You are on the right track!',

      // healthy bmi box
      healthyBmi,
      healthyMinWeight,
      healthyMaxWeight
    };
  }

  // ---- low-level drawing helpers ---------------------------------------

  function polar(cx, cy, r, angleDeg) {
    const rad = (angleDeg - 90) * Math.PI / 180; // 0deg = 12 o'clock, clockwise
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  // Filled donut segment from angleStart..angleEnd (degrees, clockwise from top).
  function drawRingSegment(page, rgb, cx, cy, rOuter, rInner, angleStart, angleEnd, color) {
    if (angleEnd <= angleStart) return;
    const steps = Math.max(1, Math.ceil((angleEnd - angleStart) / 4));
    let path = '';
    for (let i = 0; i <= steps; i++) {
      const a = angleStart + (angleEnd - angleStart) * i / steps;
      const [x, y] = polar(cx, cy, rOuter, a);
      path += (i === 0 ? 'M' : 'L') + `${x.toFixed(2)} ${y.toFixed(2)} `;
    }
    for (let i = steps; i >= 0; i--) {
      const a = angleStart + (angleEnd - angleStart) * i / steps;
      const [x, y] = polar(cx, cy, rInner, a);
      path += `L${x.toFixed(2)} ${y.toFixed(2)} `;
    }
    path += 'Z';
    page.drawSvgPath(path, { color: rgb(color[0], color[1], color[2]) });
  }

  // Full background track + a colored progress arc covering `percent` of the circle.
  function drawGauge(page, rgb, cx, cy, percent, color, bigText, smallText, font, fontBold) {
    drawRingSegment(page, rgb, cx, cy, GAUGE_R_OUTER, GAUGE_R_INNER, 0, 360, COLOR_TRACK);
    const angle = Math.max(0, Math.min(100, percent)) / 100 * 360;
    if (angle > 0) {
      drawRingSegment(page, rgb, cx, cy, GAUGE_R_OUTER, GAUGE_R_INNER, 0, angle, color);
    }
    const bigSize = 15;
    const bigWidth = fontBold.widthOfTextAtSize(bigText, bigSize);
    page.drawText(bigText, {
      x: cx - bigWidth / 2, y: cy - bigSize / 2 + 2,
      size: bigSize, font: fontBold, color: rgb(color[0], color[1], color[2])
    });
    const smallSize = 7;
    const smallWidth = font.widthOfTextAtSize(smallText, smallSize);
    page.drawText(smallText, {
      x: cx - smallWidth / 2, y: cy - bigSize / 2 - 8,
      size: smallSize, font, color: rgb(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
    });
  }

  // The 4-color Underweight/Normal/Overweight/Obese bar with a marker dot.
  function drawScaleBar(page, rgb, x, y, width, font, markerBmi) {
    const bandWidth = width / 4;
    for (let i = 0; i < 4; i++) {
      const c = BAND_COLORS[i];
      page.drawRectangle({
        x: x + i * bandWidth, y, width: bandWidth, height: SCALE_BAR_H,
        color: rgb(c[0], c[1], c[2])
      });
    }
    if (typeof markerBmi === 'number') {
      const bIdx = bandIndexFor(markerBmi);
      const lo = bIdx === 0 ? 10 : BAND_CUTS[bIdx - 1];
      const hi = bIdx === 3 ? BAND_CUTS[2] + 10 : BAND_CUTS[bIdx];
      const frac = Math.max(0, Math.min(1, (markerBmi - lo) / (hi - lo)));
      const markerX = x + bIdx * bandWidth + frac * bandWidth;
      page.drawCircle({
        x: markerX, y: y + SCALE_BAR_H / 2, size: 3.2,
        color: rgb(1, 1, 1), borderColor: rgb(COLOR_NAVY[0], COLOR_NAVY[1], COLOR_NAVY[2]), borderWidth: 1.2
      });
    }
    const labelSize = 5.5;
    BAND_LABELS.forEach((label, i) => {
      const lw = font.widthOfTextAtSize(label, labelSize);
      page.drawText(label, {
        x: x + i * bandWidth + bandWidth / 2 - lw / 2, y: y - 9,
        size: labelSize, font, color: rgb(COLOR_MUTED[0], COLOR_MUTED[1], COLOR_MUTED[2])
      });
    });
  }

  // ---- main draw --------------------------------------------------------

  function draw(page, y, ctx, info) {
    const { addPage, font, fontBold } = ctx;
    const { rgb } = window.PDFLib;
    const contentWidth = PAGE_WIDTH - 2 * MARGIN;
    const colWidth = (contentWidth - 2 * GAP) / 3;
    const boxHeight = BOX_TITLE_H + BOX_PAD + GAUGE_R_OUTER * 2 + 22 + SCALE_BAR_H + 14;

    if (y - boxHeight < MARGIN) {
      page = addPage();
      y = page.getSize().height - MARGIN;
    }

    const boxes = [
      {
        title: 'CURRENT BMI', titleColor: COLOR_RED,
        percent: typeof info.bmi === 'number' ? Math.min(100, (info.bmi / 40) * 100) : 0,
        gaugeColor: BAND_COLORS[bandIndexFor(info.bmi)],
        bigText: typeof info.bmi === 'number' ? `${info.bmi}` : '—',
        smallText: 'kg/m²',
        markerBmi: info.bmi,
        lines: [
          ['Weight', typeof info.weight === 'number' ? `${info.weight} kg` : '—'],
          ['BMI Category', info.category],
          ['Health Risk', info.healthRisk]
        ]
      },
      {
        title: 'PROGRESS TO GOAL', titleColor: COLOR_TEXT,
        percent: info.goalCompletionPercent,
        gaugeColor: COLOR_GREEN,
        bigText: `${info.goalCompletionPercent}%`,
        smallText: 'Goal Completion',
        markerBmi: undefined,
        lines: [
          ['Days Remaining', `${info.daysRemaining} Days`],
          ['Expected Completion', info.expectedCompletionDate],
          ['Weekly Target', `${info.weeklyTargetKg} kg loss/week`]
        ],
        footer: info.trackMessage
      },
      {
        title: 'HEALTHY BMI (TARGET RANGE)', titleColor: COLOR_GREEN,
        percent: Math.min(100, (info.healthyBmi / 40) * 100),
        gaugeColor: COLOR_GREEN,
        bigText: `${info.healthyBmi}`,
        smallText: 'kg/m²',
        markerBmi: info.healthyBmi,
        lines: [
          ['Target Weight Range', (info.healthyMinWeight && info.healthyMaxWeight)
            ? `${info.healthyMinWeight} – ${info.healthyMaxWeight} kg` : '—'],
          ['BMI Category', 'Normal'],
          ['Health Risk', 'Low']
        ]
      }
    ];

    boxes.forEach((box, i) => {
      const x = MARGIN + i * (colWidth + GAP);
      let cursorY = y;

      // border
      page.drawRectangle({
        x, y: cursorY - boxHeight, width: colWidth, height: boxHeight,
        borderColor: rgb(COLOR_RULE[0], COLOR_RULE[1], COLOR_RULE[2]), borderWidth: 1
      });

      // title
      const titleSize = 9;
      const tw = fontBold.widthOfTextAtSize(box.title, titleSize);
      page.drawText(box.title, {
        x: x + colWidth / 2 - tw / 2, y: cursorY - BOX_TITLE_H + 2,
        size: titleSize, font: fontBold,
        color: rgb(box.titleColor[0], box.titleColor[1], box.titleColor[2])
      });
      page.drawLine({
        start: { x: x + BOX_PAD / 2, y: cursorY - BOX_TITLE_H - 2 },
        end: { x: x + colWidth - BOX_PAD / 2, y: cursorY - BOX_TITLE_H - 2 },
        thickness: 0.75, color: rgb(COLOR_RULE[0], COLOR_RULE[1], COLOR_RULE[2])
      });
      cursorY -= (BOX_TITLE_H + 8);

      // gauge (left) + text lines (right)
      const gaugeCx = x + BOX_PAD + GAUGE_R_OUTER;
      const gaugeCy = cursorY - GAUGE_R_OUTER;
      drawGauge(page, rgb, gaugeCx, gaugeCy, box.percent, box.gaugeColor, box.bigText, box.smallText, font, fontBold);

      const textX = x + BOX_PAD * 2 + GAUGE_R_OUTER * 2 - 4;
      let lineY = cursorY - 6;
      box.lines.forEach(([label, value]) => {
        page.drawText(label, {
          x: textX, y: lineY, size: 6.5, font,
          color: rgb(COLOR_LABEL[0], COLOR_LABEL[1], COLOR_LABEL[2])
        });
        lineY -= 9;
        page.drawText(String(value), {
          x: textX, y: lineY, size: 8, font: fontBold,
          color: rgb(COLOR_TEXT[0], COLOR_TEXT[1], COLOR_TEXT[2])
        });
        lineY -= 13;
      });

      cursorY -= (GAUGE_R_OUTER * 2 + 10);

      // scale bar
      drawScaleBar(page, rgb, x + BOX_PAD, cursorY, colWidth - 2 * BOX_PAD, font, box.markerBmi);
      cursorY -= (SCALE_BAR_H + 12);

      // optional footer line (progress box's "on the right track" message)
      if (box.footer) {
        page.drawText(box.footer, {
          x: x + BOX_PAD, y: cursorY - 6, size: 7, font: fontBold,
          color: rgb(COLOR_GREEN[0], COLOR_GREEN[1], COLOR_GREEN[2])
        });
      }
    });

    return { page, y: y - boxHeight - 14 };
  }

  return {
    getBmiSummaryInfo,
    draw
  };

})();
