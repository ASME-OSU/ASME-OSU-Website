(function () {
  'use strict';

  function initNewsletterForm() {
    var form = document.getElementById('asmeNewsletterForm');
    var frame = document.getElementById('asmeNewsletterSubmission');
    var status = document.getElementById('asmeNewsletterStatus');
    var button = form && form.querySelector('.join-submit-button');
    var buttonLabel = button && button.querySelector('span');
    var submitted = false;
    var responseReceived = false;
    var timeoutId = 0;

    if (!form || !frame || !status || !button || !buttonLabel) return;

    function showStatus(message, state) {
      status.hidden = false;
      status.className = 'join-form-status join-form-status--' + state;
      status.textContent = message;
    }

    form.addEventListener('submit', function () {
      submitted = true;
      responseReceived = false;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      buttonLabel.textContent = 'Signing you up…';
      showStatus('Submitting your newsletter signup…', 'pending');

      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(function () {
        if (responseReceived) return;
        button.disabled = false;
        button.removeAttribute('aria-busy');
        buttonLabel.textContent = 'Try the newsletter signup again';
        showStatus('The signup is taking longer than expected. Please try again or email asme@osu.edu.', 'error');
      }, 15000);
    });

    frame.addEventListener('load', function () {
      if (!submitted) return;
      responseReceived = true;
      window.clearTimeout(timeoutId);
      button.disabled = true;
      button.removeAttribute('aria-busy');
      buttonLabel.textContent = 'You’re on the newsletter list';
      form.reset();
      showStatus('Thanks! Your newsletter signup was received. Join the GroupMe below for quick chapter updates, too.', 'success');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNewsletterForm, { once: true });
  } else {
    initNewsletterForm();
  }
})();
