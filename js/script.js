/* =========================================================
   GymBMI - Client-side logic
   - BMI calculation (with unit conversion)
   - Animated gauge needle
   - Category badge + BMI category card highlighting
   - Health summary (weight range, calories, body fat, water, goal)
   - FAQ accordion
   - Newsletter + report download stubs
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  const form = document.getElementById('bmiForm');

  const heightInput = document.getElementById('height');
  const heightUnit = document.getElementById('heightUnit');
  const weightInput = document.getElementById('weight');
  const weightUnit = document.getElementById('weightUnit');
  const ageInput = document.getElementById('age');
  const genderInput = document.getElementById('gender');

  const bmiValueEl = document.getElementById('bmiValue');
  const categoryPill = document.getElementById('categoryPill');
  const healthyRangeText = document.getElementById('healthyRangeText');
  const gaugeNeedle = document.getElementById('gaugeNeedle');
  const stepNumber = document.getElementById('stepNumber');
  const stepDots = document.querySelectorAll('.step-dots .dot');

  const sumBmi = document.getElementById('sumBmi');
  const sumBmiCat = document.getElementById('sumBmiCat');
  const sumWeightRange = document.getElementById('sumWeightRange');
  const sumCalories = document.getElementById('sumCalories');
  const sumBodyFat = document.getElementById('sumBodyFat');
  const sumWater = document.getElementById('sumWater');
  const sumGoal = document.getElementById('sumGoal');

  const categoryCards = document.querySelectorAll('.category-card');

  const MIN_BMI = 15;
  const MAX_BMI = 40;

  let lastResult = null;

  /* ---------- helpers ---------- */

  function toMeters(value, unit) {
    // 'cm' -> value in cm; 'ft' -> value entered as decimal feet
    if (unit === 'cm') return value / 100;
    if (unit === 'ft') return value * 0.3048;
    return value;
  }

  function toKg(value, unit) {
    if (unit === 'kg') return value;
    if (unit === 'lb') return value * 0.453592;
    return value;
  }

  function getCategory(bmi) {
    if (bmi < 18.5) return { key: 'underweight', label: 'Underweight' };
    if (bmi < 25) return { key: 'normal', label: 'Healthy Weight' };
    if (bmi < 30) return { key: 'overweight', label: 'Overweight' };
    return { key: 'obese', label: 'Obese' };
  }

  function updateGauge(bmi) {
    const clamped = Math.min(Math.max(bmi, MIN_BMI), MAX_BMI);
    const angle = -90 + ((clamped - MIN_BMI) / (MAX_BMI - MIN_BMI)) * 180;
    gaugeNeedle.setAttribute('transform', `rotate(${angle.toFixed(1)} 100 100)`);
  }

  function highlightCategoryCard(catKey) {
    categoryCards.forEach(card => {
      card.classList.toggle('active-cat', card.dataset.cat === catKey);
    });
  }

  function estimateBodyFat(bmi, age, gender) {
    const genderFactor = gender === 'male' ? 1 : 0;
    let bf = (1.20 * bmi) + (0.23 * age) - (10.8 * genderFactor) - 5.4;
    return Math.max(3, Math.min(60, bf));
  }

  function estimateCalories(weightKg, heightCm, age, gender) {
    // Mifflin-St Jeor, light activity multiplier
    let bmr;
    if (gender === 'male') {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    } else {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
    }
    return Math.round((bmr * 1.375) / 10) * 10;
  }

  function goalForCategory(catKey) {
    if (catKey === 'underweight') return 'Gain Weight';
    if (catKey === 'normal') return 'Maintain';
    return 'Lose Weight';
  }

  /* ---------- main calculation ---------- */

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const rawHeight = parseFloat(heightInput.value);
    const rawWeight = parseFloat(weightInput.value);
    const age = parseInt(ageInput.value, 10);
    const gender = genderInput.value;

    if (!rawHeight || !rawWeight || !age || !gender) return;

    const heightM = toMeters(rawHeight, heightUnit.value);
    const weightKg = toKg(rawWeight, weightUnit.value);

    if (heightM <= 0 || weightKg <= 0) return;

    const bmi = weightKg / (heightM * heightM);
    const bmiRounded = Math.round(bmi * 10) / 10;
    const category = getCategory(bmi);

    // --- update preview card ---
    bmiValueEl.textContent = bmiRounded.toFixed(1);
    categoryPill.textContent = category.label;
    categoryPill.className = 'category-pill cat-' + category.key;
    healthyRangeText.textContent = '18.5 – 24.9';
    updateGauge(bmi);
    highlightCategoryCard(category.key);

    // step indicator -> step 2
    stepNumber.textContent = '2';
    stepDots.forEach(dot => dot.classList.toggle('active', dot.dataset.step === '2'));

    // --- update health summary ---
    const minHealthyKg = 18.5 * heightM * heightM;
    const maxHealthyKg = 24.9 * heightM * heightM;
    const heightCm = heightM * 100;

    const calories = estimateCalories(weightKg, heightCm, age, gender);
    const bodyFat = estimateBodyFat(bmi, age, gender);
    const water = weightKg * 0.033;

    sumBmi.textContent = bmiRounded.toFixed(1);
    sumBmiCat.textContent = category.label;
    sumWeightRange.textContent = `${Math.round(minHealthyKg)} – ${Math.round(maxHealthyKg)} kg`;
    sumCalories.textContent = `${calories.toLocaleString()} kcal`;
    sumBodyFat.textContent = `${bodyFat.toFixed(0)} %`;
    sumWater.textContent = `${water.toFixed(1)} L`;
    sumGoal.textContent = goalForCategory(category.key);

    lastResult = {
      bmi: bmiRounded,
      category: category.label,
      weightRange: sumWeightRange.textContent,
      calories,
      bodyFat: bodyFat.toFixed(0),
      water: water.toFixed(1),
      goal: sumGoal.textContent
    };

    document.getElementById('bmiPreview').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  /* ---------- unit label swap ---------- */
  heightUnit.addEventListener('change', () => {
    heightInput.placeholder = heightUnit.value === 'cm' ? 'Enter height' : 'Enter height (ft)';
  });
  weightUnit.addEventListener('change', () => {
    weightInput.placeholder = weightUnit.value === 'kg' ? 'Enter weight' : 'Enter weight (lb)';
  });

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-item').forEach(item => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(openItem => {
        if (openItem !== item) {
          openItem.classList.remove('open');
          openItem.querySelector('.faq-toggle').textContent = '+';
        }
      });
      item.classList.toggle('open', !isOpen);
      question.querySelector('.faq-toggle').textContent = isOpen ? '+' : '×';
    });
  });

  /* ---------- newsletter form ---------- */
  const newsletterForm = document.getElementById('newsletterForm');
  newsletterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = newsletterForm.querySelector('button');
    const original = btn.textContent;
    btn.textContent = 'Subscribed ✓';
    newsletterForm.reset();
    setTimeout(() => { btn.textContent = original; }, 2500);
  });

  /* ---------- download report (client-side text summary) ---------- */
  const downloadBtns = document.querySelectorAll('.download-report-btn');
  downloadBtns.forEach(downloadBtn => {
    downloadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!lastResult) {
        alert('Please calculate your BMI first to generate a report.');
        return;
      }
      const lines = [
        'GymBMI - Personal Health Report',
        '================================',
        `BMI: ${lastResult.bmi} (${lastResult.category})`,
        `Healthy Weight Range: ${lastResult.weightRange}`,
        `Recommended Daily Calories: ${lastResult.calories} kcal`,
        `Estimated Body Fat: ${lastResult.bodyFat}%`,
        `Daily Water Goal: ${lastResult.water} L`,
        `Goal: ${lastResult.goal}`,
        '',
        'This report is a screening estimate, not a medical diagnosis.',
        'Consult a doctor for personalized advice.'
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gymbmi-health-report.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  });

  /* ---------- initial gauge state ---------- */
  updateGauge(23.5);
});
