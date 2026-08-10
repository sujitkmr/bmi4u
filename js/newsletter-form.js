/* =========================================================
   NEWSLETTER-FORM.JS
   Client-side stub for the newsletter subscribe form
   (no backend wired up yet — just a success confirmation).
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  const newsletterForm = document.getElementById('newsletterForm');
  if (!newsletterForm) return;

  newsletterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = newsletterForm.querySelector('button');
    const original = btn.textContent;
    btn.textContent = 'Subscribed ✓';
    newsletterForm.reset();
    setTimeout(() => { btn.textContent = original; }, 2500);
  });
});
