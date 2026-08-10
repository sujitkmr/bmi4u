/* =========================================================
   CORE.JS
   Shared namespace used by the other JS modules to pass
   state between them (e.g. the calculator's last result is
   read by the report-download module). Load this file first.
   ========================================================= */

window.GymBMI = window.GymBMI || {
  lastResult: null
};
