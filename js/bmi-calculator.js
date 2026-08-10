/* =========================================================
   BMI-CALCULATOR.JS
   Powers the hero section's calculator card:
   - unit conversion (cm/ft, kg/lb)
   - BMI + category calculation
   - animated gauge needle
   - BMI preview card
   - BMI Categories card highlighting
   - Your Health Summary card values (weight range, calories,
     body fat, water, goal)
   Stores the result on window.GymBMI.lastResult so the
   report-download module can use it.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  const form = document.getElementById('bmiForm');
  if (!form) return;

  const heightInput = document.getElementById('height');
  const heightUnit = document.getElementById('heightUnit');
  const weightInput = document.getElementById('weight');
  const weightUnit = document.getElementById('weightUnit');
  const dobInput = document.getElementById('dob');
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

  // Upper input limits (and their unit-converted equivalents)
  const MAX_HEIGHT_FT = 10;                                    // 10 ft
  const MAX_HEIGHT_CM = Math.round(MAX_HEIGHT_FT * 30.48 * 10) / 10; // 304.8 cm
  const MAX_WEIGHT_KG = 500;                                   // 500 kg
  const MAX_WEIGHT_LB = Math.round((MAX_WEIGHT_KG / 0.453592) * 10) / 10; // 1102.3 lb
  const MAX_AGE = 100;                                         // 100 years

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

  function parseDob(value) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    const date = new Date(year, month - 1, day);
    const isRealDate =
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;

    return isRealDate ? date : null;
  }

  function calculateAge(dob) {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
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

  function updateHeightMax() {
    heightInput.max = heightUnit.value === 'cm' ? MAX_HEIGHT_CM : MAX_HEIGHT_FT;
  }

  function updateWeightMax() {
    weightInput.max = weightUnit.value === 'kg' ? MAX_WEIGHT_KG : MAX_WEIGHT_LB;
  }

  /* ---------- main calculation ---------- */

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const rawHeight = parseFloat(heightInput.value);
    const rawWeight = parseFloat(weightInput.value);
    const dobValue = dobInput.value.trim();
    const gender = genderInput.value;

    if (!rawHeight || !rawWeight || !dobValue || !gender) return;

    const heightMax = heightUnit.value === 'cm' ? MAX_HEIGHT_CM : MAX_HEIGHT_FT;
    const weightMax = weightUnit.value === 'kg' ? MAX_WEIGHT_KG : MAX_WEIGHT_LB;

    if (rawHeight > heightMax) {
      alert(`Height can't be more than ${MAX_HEIGHT_FT} ft (${MAX_HEIGHT_CM} cm). Please re-check your entry.`);
      heightInput.focus();
      return;
    }
    if (rawWeight > weightMax) {
      alert(`Weight can't be more than ${MAX_WEIGHT_KG} kg (${MAX_WEIGHT_LB} lb). Please re-check your entry.`);
      weightInput.focus();
      return;
    }

    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dobValue)) {
      alert('Please enter your date of birth in DD/MM/YYYY format.');
      dobInput.focus();
      return;
    }
    const dob = parseDob(dobValue);
    if (!dob) {
      alert('Please enter a valid date of birth.');
      dobInput.focus();
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dob > today) {
      alert('Date of birth cannot be in the future.');
      dobInput.focus();
      return;
    }

    const age = calculateAge(dob);

    if (age > MAX_AGE) {
      alert(`Age can't be more than ${MAX_AGE} years. Please re-check your date of birth.`);
      dobInput.focus();
      return;
    }
    if (age < 1) {
      alert('Please enter a valid date of birth.');
      dobInput.focus();
      return;
    }

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

    window.GymBMI.lastResult = {
      bmi: bmiRounded,
      category: category.label,
      weightRange: sumWeightRange.textContent,
      calories,
      bodyFat: bodyFat.toFixed(0),
      water: water.toFixed(1),
      goal: sumGoal.textContent,
      age,
      dob: dobValue
    };

    document.getElementById('bmiPreview').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  /* ---------- DOB auto-formatting ---------- */
  dobInput.addEventListener('input', () => {
    let digits = dobInput.value.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;

    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }

    dobInput.value = formatted;
  });

  /* ---------- unit label swap ---------- */
  heightUnit.addEventListener('change', () => {
    heightInput.placeholder = heightUnit.value === 'cm' ? 'Enter height' : 'Enter height (ft)';
    updateHeightMax();
  });
  weightUnit.addEventListener('change', () => {
    weightInput.placeholder = weightUnit.value === 'kg' ? 'Enter weight' : 'Enter weight (lb)';
    updateWeightMax();
  });

  /* ---------- initial state ---------- */
  updateHeightMax();
  updateWeightMax();
  updateGauge(23.5);
});
