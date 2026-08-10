/* =========================================================
   REPORT-POPUP.JS
   Opens the "Get Your Health Report FREE" popup when any
   .download-report-btn is clicked (hero report banner +
   Tools section button). Handles the popup UI only: field
   validation, the report-choice checkboxes, and wiring the
   submit button to the PDF generator.

   The actual report content + PDF creation lives in
   report-generator.js — this file just calls
   window.GymBMIReport.generateAndDownload(selected).

   Depends on: core.js, bmi-calculator.js (for lastResult),
   report-generator.js (for building/downloading the PDF).
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  const modal = document.getElementById('reportPopupModal');
  const closeBtn = document.getElementById('reportPopupClose');
  const form = document.getElementById('reportPopupForm');
  const downloadBtns = document.querySelectorAll('.download-report-btn');
  const choiceInputs = document.querySelectorAll('input[name="reportChoice"]');
  const choiceHint = document.getElementById('reportChoiceHint');

  const nameInput = document.getElementById('reportName');
  const mobileInput = document.getElementById('reportMobile');
  const emailInput = document.getElementById('reportEmail');

  const nameError = document.getElementById('reportNameError');
  const mobileError = document.getElementById('reportMobileError');
  const emailError = document.getElementById('reportEmailError');

  const submitBtn = form ? form.querySelector('.report-popup-submit') : null;
  const submitBtnDefaultHtml = submitBtn ? submitBtn.innerHTML : '';

  if (!modal || !form) return;

  // ---- Validation helpers ----------------------------------

  function setFieldError(input, errorEl, message) {
    if (input) input.closest('.report-popup-input').classList.add('is-invalid');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('is-visible');
    }
  }

  function clearFieldError(input, errorEl) {
    if (input) input.closest('.report-popup-input').classList.remove('is-invalid');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('is-visible');
    }
  }

  function validateName() {
    const value = nameInput.value.trim();
    // Letters, spaces, apostrophes and hyphens only; at least two letters.
    const nameRegex = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;

    if (!value) {
      setFieldError(nameInput, nameError, 'Please enter your name.');
      return false;
    }
    if (value.length < 2) {
      setFieldError(nameInput, nameError, 'Name is too short.');
      return false;
    }
    if (!nameRegex.test(value)) {
      setFieldError(nameInput, nameError, 'Name should contain letters only.');
      return false;
    }
    clearFieldError(nameInput, nameError);
    return true;
  }

  function validateMobile() {
    const value = mobileInput.value.trim();
    const mobileRegex = /^[6-9]\d{9}$/;

    if (!value) {
      setFieldError(mobileInput, mobileError, 'Please enter your mobile number.');
      return false;
    }
    if (!mobileRegex.test(value)) {
      setFieldError(mobileInput, mobileError, 'Enter a valid 10-digit mobile number.');
      return false;
    }
    clearFieldError(mobileInput, mobileError);
    return true;
  }

  function validateEmail() {
    const value = emailInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    if (!value) {
      setFieldError(emailInput, emailError, 'Please enter your email address.');
      return false;
    }
    if (!emailRegex.test(value)) {
      setFieldError(emailInput, emailError, 'Enter a valid email address.');
      return false;
    }
    clearFieldError(emailInput, emailError);
    return true;
  }

  function validateAllFields() {
    // Use & (not &&) so every validator runs and shows its own error.
    const nameOk = validateName();
    const mobileOk = validateMobile();
    const emailOk = validateEmail();
    return nameOk && mobileOk && emailOk;
  }

  // ---- Live formatting / input restriction ------------------

  // Name: block anything that isn't a letter, space, apostrophe or hyphen.
  nameInput.addEventListener('input', () => {
    nameInput.value = nameInput.value.replace(/[^A-Za-z '-]/g, '');
  });

  // Mobile: digits only, capped at 10 digits.
  mobileInput.addEventListener('input', () => {
    mobileInput.value = mobileInput.value.replace(/\D/g, '').slice(0, 10);
  });

  // Validate as soon as a field loses focus so errors show up early.
  nameInput.addEventListener('blur', validateName);
  mobileInput.addEventListener('blur', validateMobile);
  emailInput.addEventListener('blur', validateEmail);

  function openModal() {
    if (!window.GymBMI || !window.GymBMI.lastResult) {
      alert('Please calculate your BMI first to generate a report.');
      return;
    }
    modal.classList.add('is-open');
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
  }

  function getSelectedReports() {
    return Array.from(choiceInputs)
      .filter(input => input.checked)
      .map(input => input.value);
  }

  function setSubmitLoading(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    submitBtn.innerHTML = isLoading ? 'Preparing your PDF&hellip;' : submitBtnDefaultHtml;
  }

  downloadBtns.forEach(downloadBtn => {
    downloadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  });

  closeBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) {
      closeModal();
    }
  });

  // Hide the "select at least one" hint as soon as any box is checked again.
  choiceInputs.forEach(input => {
    input.addEventListener('change', () => {
      if (getSelectedReports().length > 0 && choiceHint) {
        choiceHint.classList.remove('is-visible');
      }
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateAllFields()) {
      return;
    }

    const selected = getSelectedReports();
    if (selected.length === 0) {
      if (choiceHint) choiceHint.classList.add('is-visible');
      return;
    }

    if (!window.GymBMI || !window.GymBMI.lastResult) {
      alert('Please calculate your BMI first to generate a report.');
      closeModal();
      return;
    }

    if (!window.GymBMIReport) {
      alert('Report generator failed to load. Please refresh the page and try again.');
      return;
    }

    setSubmitLoading(true);
    try {
      await window.GymBMIReport.generateAndDownload(selected);

      closeModal();
      form.reset();
      choiceInputs.forEach(input => { input.checked = true; });
      if (choiceHint) choiceHint.classList.remove('is-visible');
      clearFieldError(nameInput, nameError);
      clearFieldError(mobileInput, mobileError);
      clearFieldError(emailInput, emailError);
    } catch (err) {
      console.error('GymBMI report generation failed:', err);
      alert('Sorry, something went wrong generating your PDF. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  });
});
