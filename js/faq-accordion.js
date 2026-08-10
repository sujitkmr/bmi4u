/* =========================================================
   FAQ-ACCORDION.JS
   Expand/collapse behavior for the Frequently Asked
   Questions card in the Tips + FAQ section.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

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
});
