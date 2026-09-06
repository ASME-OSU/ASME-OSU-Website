(function () {
  'use strict';

  function initNewsletterForm() {
    var form = document.getElementById('asmeNewsletterForm');
    var status = document.getElementById('asmeNewsletterStatus');
    var button = form && form.querySelector('.join-submit-button');
    var buttonLabel = button && button.querySelector('span');
    var formCard = document.getElementById('newsletter-signup');
    var newsletterStep = document.getElementById('joinNewsletterStep');
    var groupMeProgress = document.getElementById('joinGroupMeProgress');
    var groupMeStep = document.getElementById('joinGroupMeStep');
    var groupMeButton = document.getElementById('joinGroupMeButton');
    var submitting = false;
    var complete = false;

    if (!form || !status || !button || !buttonLabel || form.dataset.newsletterReady) return;
    form.dataset.newsletterReady = 'true';
    // All submissions stay on this page, including when the provider returns JSON.
    form.removeAttribute('target');

    function showStatus(message, state) {
      status.hidden = false;
      status.className = 'join-form-status join-form-status--' + state;
      status.textContent = message;
    }

    form.addEventListener('input', function (event) {
      if (event.target.setCustomValidity) event.target.setCustomValidity('');
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (submitting || complete || !form.reportValidity()) return;
      submitting = true;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      buttonLabel.textContent = 'Signing you up…';
      showStatus('Submitting your newsletter signup…', 'pending');

      var controller = new AbortController();
      var timeoutId = window.setTimeout(function () { controller.abort(); }, 15000);
      try {
        // Brevo's own HTML embed uses this endpoint and checks response.success.
        var url = new URL(form.action);
        url.searchParams.set('isAjax', '1');
        var data = new FormData(form);
        data.delete('html_type');
        var response = await fetch(url.href, {
          method: 'POST', body: data, mode: 'cors', credentials: 'omit',
          signal: controller.signal
        });
        var result = await response.json();
        if (response.ok && result && result.success === true) {
          complete = true;
          finishSignup();
        } else if (result && result.success === false) {
          var errors = result.errors && typeof result.errors === 'object' ? result.errors : {};
          var firstInvalid;
          Object.keys(errors).forEach(function (name) {
            var field = form.elements.namedItem(name);
            if (field && field.setCustomValidity && typeof errors[name] === 'string') {
              field.setCustomValidity(errors[name]);
              if (!firstInvalid) firstInvalid = field;
            }
          });
          showStatus(firstInvalid
            ? 'Please correct the highlighted field and try again. Your information has been kept.'
            : 'Your signup could not be confirmed. Please check your details and try again, or email asme@osu.edu.', 'error');
          if (firstInvalid) firstInvalid.reportValidity();
        } else {
          throw new Error('Unrecognized newsletter response');
        }
      } catch (error) {
        // A network error or timeout cannot establish whether Brevo accepted it.
        showStatus('We could not confirm your signup. Your details are still here. Please try again, or email asme@osu.edu.', 'error');
      } finally {
        window.clearTimeout(timeoutId);
        submitting = false;
        button.removeAttribute('aria-busy');
        if (!complete) {
          button.disabled = false;
          buttonLabel.textContent = 'Try newsletter signup again';
        }
      }
    });

    function finishSignup() {
      button.disabled = true;
      button.removeAttribute('aria-busy');
      buttonLabel.textContent = 'Step 1 complete';
      form.reset();
      showStatus('You have been successfully added to the newsletter list.', 'success');
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
    }

    button.disabled = false;

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
