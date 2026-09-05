(function () {
  'use strict';

  function initNewsletterForm() {
    var form = document.getElementById('asmeNewsletterForm');
    var frame = document.getElementById('asmeNewsletterSubmission');
    var status = document.getElementById('asmeNewsletterStatus');
    var button = form && form.querySelector('.join-submit-button');
    var buttonLabel = button && button.querySelector('span');
    var formCard = document.getElementById('newsletter-signup');
    var newsletterStep = document.getElementById('joinNewsletterStep');
    var groupMeProgress = document.getElementById('joinGroupMeProgress');
    var groupMeStep = document.getElementById('joinGroupMeStep');
    var groupMeButton = document.getElementById('joinGroupMeButton');
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
      buttonLabel.textContent = 'Step 1 complete';
      form.reset();
      showStatus('Thanks! Your newsletter signup was received. Continue to Step 2 below for quick chapter updates.', 'success');
      if (formCard) formCard.classList.add('is-newsletter-complete');
      if (newsletterStep) {
        newsletterStep.classList.remove('is-current');
        newsletterStep.classList.add('is-complete');
      }
      if (groupMeProgress) groupMeProgress.classList.add('is-current');
      if (groupMeStep) {
        groupMeStep.classList.add('is-ready');
        window.setTimeout(function () {
          groupMeStep.scrollIntoView({
            behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            block: 'nearest'
          });
        }, 250);
      }
    });

    if (groupMeButton) {
      groupMeButton.addEventListener('click', function () {
        if (groupMeStep) groupMeStep.classList.add('is-visited');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNewsletterForm, { once: true });
  } else {
    initNewsletterForm();
  }
})();
