(function () {
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
    modal.hidden = false;
    document.documentElement.classList.add('sponsor-modal-open');
    setTier(modalForm, tier);
    var firstField = modal.querySelector('[data-sponsor-field="company"]');
    if (firstField) firstField.focus();
  }

  function closeSponsorModal() {
    var modal = document.getElementById('sponsor-modal');
    if (!modal) return;
    modal.hidden = true;
    document.documentElement.classList.remove('sponsor-modal-open');
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
      if (event.key === 'Escape') closeSponsorModal();
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
