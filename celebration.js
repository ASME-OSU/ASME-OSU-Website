/* Stable WordPress entrypoint: fetch the experience only near the GroupMe step. */
(() => {
  'use strict';
  const trigger = document.getElementById('joinGroupMeButton');
  if (!trigger || trigger.dataset.celebrationLoaderReady) return;
  trigger.dataset.celebrationLoaderReady = 'true';
  const entry = document.currentScript;
  const source = new URL('assets/celebration/experience.js', entry?.src || 'https://asme-osu.github.io/ASME-OSU-Website/celebration.js');
  source.search = entry?.src ? new URL(entry.src).search : '';
  const pendingKey = 'asme-groupme-pending-v1';
  let loading, pending = 0;
  function load() {
    if (loading) return;
    loading = document.createElement('script');
    loading.src = source.href;
    loading.dataset.asmeExperience = '';
    if (pending) loading.dataset.groupmePending = String(pending);
    loading.onerror = () => {
      loading.remove(); loading = null;
      const status = document.getElementById('asme-groupme-return-message');
      if (status) status.textContent = 'Your GroupMe link still works. Return here and try again to load your welcome card.';
    };
    document.head.append(loading);
  }
  trigger.addEventListener('pointerenter', load, false);
  trigger.addEventListener('focusin', load, false);
  trigger.addEventListener('click', event => {
    if (!event.isTrusted || event.defaultPrevented) return;
    pending = Date.now();
    try { sessionStorage.setItem(pendingKey, String(pending)); } catch (_) {}
    load();
    if (loading) loading.dataset.groupmePending = String(pending);
  });
  document.querySelector('.asme-return-confirm')?.addEventListener('pointerenter', load);
  window.addEventListener('focus', () => { if (pending) load(); });
  try {
    const saved = Number(sessionStorage.getItem(pendingKey));
    if (saved && Date.now() - saved < 30 * 60 * 1000) { pending = saved; load(); }
  } catch (_) {}
})();
