/* BMI4U - Contact Us form.
   No backend: validates, then opens the visitor's email app addressed to
   info@bmi4u.com with the message pre-filled. */
(function () {
  "use strict";
  var TO = "info@bmi4u.com";
  var form = document.getElementById("contactForm");
  if (!form) return;

  function $(id) { return document.getElementById(id); }
  function setErr(inputId, errId, msg) {
    var err = $(errId), box = $(inputId).closest(".ct-input");
    err.textContent = msg || "";
    if (box) box.classList.toggle("invalid", !!msg);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("ctName").value.trim();
    var email = $("ctEmail").value.trim();
    var subject = $("ctSubject").value;
    var message = $("ctMessage").value.trim();
    var ok = true;

    setErr("ctName", "ctNameErr", name ? "" : "Please enter your name.");
    if (!name) ok = false;

    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    setErr("ctEmail", "ctEmailErr", emailOk ? "" : "Please enter a valid email address.");
    if (!emailOk) ok = false;

    setErr("ctMessage", "ctMessageErr", message ? "" : "Please tell us how we can help.");
    if (!message) ok = false;

    $("ctAgreeErr").textContent = $("ctAgree").checked ? "" : "Please accept the Terms & Privacy Policy to continue.";
    if (!$("ctAgree").checked) ok = false;

    if (!ok) return;

    var subj = "BMI4U Contact: " + (subject || "General Question");
    var body = message + "\n\n— " + name + " (" + email + ")";
    window.location.href = "mailto:" + TO + "?subject=" + encodeURIComponent(subj) +
      "&body=" + encodeURIComponent(body);

    $("ctNote").textContent = "Opening your email app… if nothing opens, write to us at " + TO + ".";
    form.reset();
  });
})();
