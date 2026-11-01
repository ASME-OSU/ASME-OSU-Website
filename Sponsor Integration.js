(function () {
  var sponsorReturnFocus = null;
  var sponsorBackground = [];
  function initSponsorInquiryForm(form) {
    if (!form || form.getAttribute('data-mailto-ready') === 'true') return;
    var submitLink = form.querySelector('.sponsor-form-submit');
    if (!submitLink) return;

    form.setAttribute('data-mailto-ready', 'true');

    function findField(name) {
      return form.querySelector('[data-sponsor-field="' + name + '"]');
    }

    function getValue(name) {
      var field = findField(name);
      return field ? field.value.trim() : '';
    }

    function buildMailto() {
      var company = getValue('company');
      var contact = getValue('contact');
      var email = getValue('email');
      var tierField = findField('tier');
      var tier = tierField ? tierField.value : '';
      var message = getValue('message');

      var subject = encodeURIComponent('ASME OSU Sponsorship Inquiry' + (tier ? ' - ' + tier : '') + (company ? ' | ' + company : ''));
      var body = encodeURIComponent(
        'Hi ASME OSU,\n\n' +
        'I am interested in sponsoring ASME OSU' + (tier ? ' at the ' + tier + ' level' : '') + '.\n\n' +
        (company ? 'Company: ' + company + '\n' : '') +
        (contact ? 'Contact: ' + contact + '\n' : '') +
        (email ? 'Reply-to: ' + email + '\n' : '') +
        (message ? '\nAdditional notes:\n' + message : '') +
        '\n\nLooking forward to hearing from you.' +
        (contact ? '\n\n' + contact : '')
      );

      return 'mailto:asme@osu.edu?subject=' + subject + '&body=' + body;
    }

    function updateSubmitLink() {
      submitLink.setAttribute('href', buildMailto());
    }

    form.addEventListener('input', updateSubmitLink);
    form.addEventListener('change', updateSubmitLink);
    submitLink.addEventListener('mousedown', updateSubmitLink);
    submitLink.addEventListener('touchstart', updateSubmitLink);
    submitLink.addEventListener('click', updateSubmitLink);

    updateSubmitLink();
  }

  function initSponsorForms() {
    var forms = document.querySelectorAll('.asme-sponsor-page [data-sponsor-form]');
    forms.forEach(initSponsorInquiryForm);
  }

  function setTier(form, tier) {
    if (!form || !tier) return;
    var tierField = form.querySelector('[data-sponsor-field="tier"]');
    if (!tierField) return;
    tierField.value = tier;
    tierField.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function openSponsorModal(tier) {
    var modal = document.getElementById('sponsor-modal');
    if (!modal) return;
    var modalForm = modal.querySelector('[data-sponsor-form]');
    if (modal.hidden) {
      sponsorReturnFocus = document.activeElement;
      var branch = modal;
      while (branch.parentElement && branch !== document.body) {
        Array.prototype.forEach.call(branch.parentElement.children, function (sibling) {
          if (sibling !== branch) { sponsorBackground.push([sibling, sibling.inert]); sibling.inert = true; }
        });
        branch = branch.parentElement;
      }
    }
    modal.hidden = false;
    document.documentElement.classList.add('sponsor-modal-open');
    setTier(modalForm, tier);
    var firstField = modal.querySelector('[data-sponsor-field="company"]');
    if (firstField) firstField.focus();
  }

  function closeSponsorModal() {
    var modal = document.getElementById('sponsor-modal');
    if (!modal) return;
    if (modal.hidden) return;
    modal.hidden = true;
    document.documentElement.classList.remove('sponsor-modal-open');
    sponsorBackground.forEach(function (entry) { entry[0].inert = entry[1]; });
    sponsorBackground = [];
    if (sponsorReturnFocus && sponsorReturnFocus.isConnected) sponsorReturnFocus.focus();
    sponsorReturnFocus = null;
  }

  function bindSponsorModal() {
    if (document.documentElement.getAttribute('data-sponsor-modal-ready') === 'true') return;
    document.documentElement.setAttribute('data-sponsor-modal-ready', 'true');

    document.addEventListener('click', function (event) {
      var target = event.target && event.target.closest ? event.target : null;
      if (!target) return;

      var tierButton = target.closest('[data-sponsor-tier]');
      if (tierButton) {
        event.preventDefault();
        openSponsorModal(tierButton.getAttribute('data-sponsor-tier'));
        return;
      }

      if (target.closest('[data-sponsor-modal-close]')) {
        event.preventDefault();
        closeSponsorModal();
      }
    });

    document.addEventListener('keydown', function (event) {
      var modal = document.getElementById('sponsor-modal');
      if (!modal || modal.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); closeSponsorModal(); return; }
      if (event.key !== 'Tab') return;
      var controls = Array.prototype.filter.call(modal.querySelectorAll('a[href], button, input, select, textarea, [tabindex]'), function (control) {
        return !control.disabled && control.tabIndex >= 0 && !control.closest('[hidden]');
      });
      var first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    });
  }

  function initSponsorExperience() {
    initSponsorForms();
    bindSponsorModal();
  }

  window.openSponsorModal = openSponsorModal;
  window.closeSponsorModal = closeSponsorModal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSponsorExperience);
  } else {
    initSponsorExperience();
  }

  window.addEventListener('load', initSponsorExperience);
})();
