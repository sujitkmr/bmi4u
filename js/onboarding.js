/* =========================================================
   ONBOARDING.JS
   Validation + submit handling for the partnership form.
   ========================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     CONFIG
     Set PARTNER_ENDPOINT to a URL that accepts a JSON POST
     (your own API, Formspree, Google Apps Script, etc.).
     While it is empty NOTHING is sent anywhere: the page just
     moves on to the success page, and the details are logged
     to the browser console for testing.
     --------------------------------------------------------- */
  var PARTNER_ENDPOINT = "";
  var SUCCESS_URL = "onboarding-success.html";

  var form = document.getElementById("partnerForm");
  if (!form) return;

  var submitBtn = document.getElementById("submitBtn");
  var statusBox = document.getElementById("formStatus");
  var submitLabel = submitBtn.querySelector(".ob-submit-label");
  var submitting = false;

  /* ---------- Patterns ---------- */
  var NAME_RE = /^\p{L}[\p{L} .'\-]*$/u;            // letters, spaces, . ' -
  var CITY_RE = /^\p{L}[\p{L} .'\-]*$/u;
  var EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}$/;
  var MOBILE_RE = /^[6-9]\d{9}$/;                    // Indian mobile numbers
  var PIN_RE = /^[1-9]\d{5}$/;                       // 6 digits, never starts with 0

  /* ---------- Rules: each returns an error message, or "" when valid ---------- */
  var rules = {
    businessType: function (v) {
      return v ? "" : "Please select your business type.";
    },

    address: function (v) {
      if (!v) return "Please enter your business address.";
      if (v.length < 10) return "Please enter a full address (at least 10 characters).";
      if (!/\p{L}/u.test(v)) return "Address must contain letters, not just numbers.";
      return "";
    },

    city: function (v) {
      if (!v) return "Please enter your city or location.";
      if (v.length < 2) return "City name looks too short.";
      if (!CITY_RE.test(v)) return "City can only contain letters, spaces, . ' and -.";
      return "";
    },

    pincode: function (v) {
      if (!v) return "Please enter your PIN code.";
      if (!/^\d+$/.test(v)) return "PIN code can only contain digits.";
      if (v.length !== 6) return "PIN code must be exactly 6 digits.";
      if (!PIN_RE.test(v)) return "PIN code cannot start with 0.";
      return "";
    },

    contactName: function (v) {
      if (!v) return "Please enter your name.";
      if (v.length < 2) return "Name looks too short.";
      if (!NAME_RE.test(v)) return "Name can only contain letters, spaces, . ' and -.";
      return "";
    },

    email: function (v) {
      if (!v) return "Please enter your email address.";
      if (!EMAIL_RE.test(v) || v.indexOf("..") !== -1 || v.charAt(0) === "." || v.indexOf(".@") !== -1) {
        return "Please enter a valid email address.";
      }
      return "";
    },

    mobile: function (v) {
      if (!v) return "Please enter your mobile number.";
      if (!/^\d+$/.test(v)) return "Mobile number can only contain digits.";
      if (v.length !== 10) return "Mobile number must be exactly 10 digits.";
      if (!MOBILE_RE.test(v)) return "Mobile number must start with 6, 7, 8 or 9.";
      if (/^(\d)\1{9}$/.test(v)) return "Please enter a real mobile number.";
      return "";
    },

    partnershipType: function (v) {
      return v ? "" : "Please select a partnership type.";
    },

    terms: function (_v, el) {
      return el.checked ? "" : "Please accept the Terms & Conditions and Privacy Policy.";
    }
  };

  /* Validation/tab order follows the on-screen order of the form. */
  var order = [
    "businessType",
    "contactName", "email", "mobile", "city", "pincode", "address",
    "partnershipType", "terms"
  ];

  /* ---------- Helpers ---------- */
  function $(id) { return document.getElementById(id); }

  function cleanText(value) {
    return value.replace(/\s+/g, " ").trim();
  }

  /* Tidy a text field's value (trim + collapse spaces; lowercase email). */
  function normalise(el) {
    if (el.type === "checkbox" || el.tagName === "SELECT") return;
    var v = cleanText(el.value);
    if (el.id === "email") v = v.toLowerCase();
    el.value = v;
  }

  function getValue(el) {
    return el.type === "checkbox" ? el.checked : cleanText(el.value);
  }

  /* Validate one field, show/clear its message. Returns true when valid. */
  function validateField(id) {
    var el = $(id);
    var errorEl = $(id + "Error");
    var message = rules[id](getValue(el), el);
    var wrapper = el.closest(".ob-field");

    if (errorEl) errorEl.textContent = message;
    if (wrapper) wrapper.classList.toggle("has-error", !!message);
    el.setAttribute("aria-invalid", message ? "true" : "false");
    return !message;
  }

  /* ---------- Wire up fields ---------- */
  order.forEach(function (id) {
    var el = $(id);
    var errorEl = $(id + "Error");
    if (errorEl) el.setAttribute("aria-describedby", id + "Error");

    var isChoice = el.tagName === "SELECT" || el.type === "checkbox";
    el.addEventListener(isChoice ? "change" : "blur", function () {
      normalise(el);
      validateField(id);
    });

    /* Once a field shows an error, re-check as the user types so it clears at once. */
    el.addEventListener("input", function () {
      var wrapper = el.closest(".ob-field");
      if (wrapper && wrapper.classList.contains("has-error")) validateField(id);
    });
  });

  /* Digits only + hard length limits */
  function digitsOnly(id, max) {
    var el = $(id);
    function clean() { el.value = el.value.replace(/\D/g, "").slice(0, max); }
    el.addEventListener("input", clean);
    el.addEventListener("paste", function () { setTimeout(clean, 0); });
  }
  digitsOnly("mobile", 10);
  digitsOnly("pincode", 6);

  /* Indian numbers pasted with +91 / 0 prefix: keep the last 10 digits */
  $("mobile").addEventListener("paste", function (e) {
    var text = (e.clipboardData || window.clipboardData).getData("text");
    var digits = text.replace(/\D/g, "");
    if (digits.length > 10) {
      e.preventDefault();
      $("mobile").value = digits.slice(-10);
    }
  });

  /* Character counter for the optional description */
  var details = $("details");
  var counter = $("detailsCounter");
  function updateCounter() {
    var max = details.maxLength;
    counter.textContent = details.value.length + " / " + max;
    counter.classList.toggle("is-near", details.value.length >= max * 0.9);
  }
  details.addEventListener("input", updateCounter);
  updateCounter();

  /* ---------- Submit ---------- */
  function showStatus(message) {
    statusBox.textContent = message;
    statusBox.hidden = false;
  }

  function setBusy(busy) {
    submitting = busy;
    submitBtn.disabled = busy;
    submitLabel.textContent = busy ? "Submitting…" : "Submit & Continue";
  }

  function goToSuccess(name) {
    try {
      sessionStorage.setItem("bmi4uPartnerName", name);
    } catch (e) { /* storage can be blocked; the success page works without it */ }
    window.location.href = SUCCESS_URL;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (submitting) return;
    statusBox.hidden = true;

    order.forEach(function (id) { normalise($(id)); });
    normalise(details);

    var firstInvalid = null;
    order.forEach(function (id) {
      if (!validateField(id) && !firstInvalid) firstInvalid = $(id);
    });
    if (firstInvalid) {
      firstInvalid.focus();
      firstInvalid.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    var contactName = $("contactName").value;

    /* Spam trap: bots fill the hidden field. Pretend success, send nothing. */
    if ($("website").value) {
      goToSuccess(contactName);
      return;
    }

    var payload = {
      businessType: $("businessType").value,
      address: $("address").value,
      city: $("city").value,
      pincode: $("pincode").value,
      contactName: contactName,
      email: $("email").value,
      mobile: $("mobile").value,
      partnershipType: $("partnershipType").value,
      details: details.value,
      termsAccepted: true,
      submittedAt: new Date().toISOString(),
      source: "bmi4u.com/onboarding"
    };

    if (!PARTNER_ENDPOINT) {
      console.warn("[BMI4U] PARTNER_ENDPOINT is not set, so this submission was NOT sent anywhere.", payload);
      goToSuccess(contactName);
      return;
    }

    setBusy(true);
    fetch(PARTNER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Request failed with status " + response.status);
        goToSuccess(contactName);
      })
      .catch(function () {
        setBusy(false);
        showStatus("Sorry, we couldn't submit your details right now. Please try again, or email partnerships@bmi4u.com.");
      });
  });
})();
