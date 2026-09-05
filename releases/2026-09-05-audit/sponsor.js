(function () {
  'use strict';
  function init() {
    if (document.documentElement.dataset.asmeSponsorReady) return;
    document.documentElement.dataset.asmeSponsorReady = 'true';
    var modal = document.getElementById('sponsor-modal');
    var trigger = null;
    function build(form) {
      function value(name) { var el = form.querySelector('[data-sponsor-field="' + name + '"]'); return el ? el.value.trim() : ''; }
      var tier = value('tier'), company = value('company');
      var subject = 'ASME OSU Sponsorship Inquiry' + (tier ? ' - ' + tier : '') + (company ? ' | ' + company : '');
      var body = 'Hi ASME OSU,\n\nI am interested in a chapter partnership.\n\nCompany: ' + company + '\nContact: ' + value('contact') + '\nReply-to: ' + value('email') + '\nTier: ' + (tier || 'Please help me choose') + '\n\n' + value('message');
      return { subject: subject, body: body, href: 'mailto:asme@osu.edu?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body) };
    }
    document.querySelectorAll('[data-sponsor-form]').forEach(function (form) {
      var link = form.querySelector('.sponsor-form-submit');
      if (!link) return;
      link.textContent = 'Open email draft →';
      var status = document.createElement('p'); status.className = 'sponsor-email-note'; status.setAttribute('role', 'status');
      status.textContent = 'Review and send the draft in your email app. No message is sent by this page.';
      form.appendChild(status);
      function validate() {
        return Array.from(form.querySelectorAll('input[required]')).every(function (field) { return field.reportValidity(); });
      }
      function update() { link.href = build(form).href; }
      form.addEventListener('input', update); form.addEventListener('change', update);
      link.addEventListener('click', function (event) {
        if (!validate()) { event.preventDefault(); return; }
        update(); status.textContent = 'Your draft is ready to open. Send it from your email app to complete your inquiry.';
      });
      var copy = document.createElement('button'); copy.type = 'button'; copy.className = 'asme-copy-inquiry'; copy.textContent = 'Copy inquiry instead';
      copy.addEventListener('click', function () {
        if (!validate()) return;
        var draft = build(form); var text = 'To: asme@osu.edu\nSubject: ' + draft.subject + '\n\n' + draft.body;
        if (!navigator.clipboard) { status.textContent = 'Email asme@osu.edu directly using the details above.'; return; }
        navigator.clipboard.writeText(text).then(function () { status.textContent = 'Copied. Paste into an email to asme@osu.edu and send it.'; }, function () { status.textContent = 'Could not copy. Open the email draft or email asme@osu.edu directly.'; });
      });
      link.after(copy); update();
    });
    function close() { if (!modal) return; modal.hidden = true; document.documentElement.classList.remove('sponsor-modal-open'); if (trigger) trigger.focus(); }
    document.addEventListener('click', function (event) {
      var target = event.target.closest && event.target.closest('[data-sponsor-tier], [data-sponsor-modal-close]');
      if (!target || !modal) return;
      event.preventDefault();
      if (target.hasAttribute('data-sponsor-modal-close')) { close(); return; }
      trigger = target; modal.hidden = false; document.documentElement.classList.add('sponsor-modal-open');
      var tier = modal.querySelector('[data-sponsor-field="tier"]'); tier.value = target.dataset.sponsorTier; tier.dispatchEvent(new Event('change', { bubbles: true }));
      modal.querySelector('[data-sponsor-field="company"]').focus();
    });
    document.addEventListener('keydown', function (event) {
      if (!modal || modal.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      var elements = Array.from(modal.querySelectorAll('a[href], button, input, select, textarea')).filter(function (el) { return !el.disabled && el.getClientRects().length; });
      var first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
