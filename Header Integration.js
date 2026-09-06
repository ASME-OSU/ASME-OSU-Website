(function () {
  'use strict';
  var paths = {
    Home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
    About: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
    Join: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m3-13v6m-3-3h6"/>',
    Events: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
    Gallery: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    Leadership: '<path d="M8 3h8v7a4 4 0 0 1-8 0Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v5m-5 2h10"/>',
    Members: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>'
  };
  function icon(name) {
    var wrap = document.createElement('span');
    wrap.innerHTML = '<svg class="asme-hd-icon' + (name === 'chevron' ? ' asme-hd-chevron' : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + paths[name] + '</svg>';
    return wrap.firstElementChild;
  }
  function label(anchor) {
    var copy = anchor.cloneNode(true);
    copy.querySelectorAll('.dropdown-menu-toggle, svg').forEach(function (node) { node.remove(); });
    return copy.textContent.trim();
  }
  function init() {
    if (document.getElementById('asme-site-header')) return;
    var original = document.getElementById('masthead');
    var menu = original && original.querySelector('#site-navigation .main-nav > ul');
    var template = document.getElementById('asme-header-template');
    var logo = original && original.querySelector('.site-logo img');
    var home = original && original.querySelector('.site-logo a');
    if (!menu || !template || !logo || !home) return;
    var entries = new Map();
    Array.from(menu.children).forEach(function (li) {
      var a = li.querySelector(':scope > a');
      if (a) entries.set(label(a), { li:li, link:a });
    });
    var order = ['Home', 'About', 'Join', 'Events', 'Gallery', 'Leadership', 'Members'];
    if (!order.every(function (name) { return entries.has(name); })) return;
    var header = template.content.firstElementChild.cloneNode(true);
    var brand = header.querySelector('.asme-hd-brand');
    brand.href = home.href;
    var image = logo.cloneNode(true);
    image.removeAttribute('class');
    image.alt = 'ASME Ohio State';
    header.querySelector('.asme-hd-logo').appendChild(image);
    header.querySelector('.asme-hd-join').href = entries.get('Join').link.href;
    var list = header.querySelector('.asme-hd-links');
    var disclosure;
    var submenu;
    var path = window.location.pathname.replace(/\/$/, '') || '/';
    function isCurrent(link) { return link.getAttribute('aria-current') === 'page' || ((new URL(link.href).pathname.replace(/\/$/, '') || '/') === path && !link.getAttribute('href').startsWith('#')); }
    order.forEach(function (name) {
      var entry = entries.get(name);
      var destination = entry.link;
      if (name === 'Events') destination = Array.from(entry.li.querySelectorAll('ul a')).find(function (a) { return label(a) === 'Calendar'; }) || destination;
      var childList = entry.li.querySelector(':scope > ul');
      var children = name === 'Members' && childList ? Array.from(childList.querySelectorAll('a')) : [];
      var item = document.createElement('li'); item.className = 'asme-hd-item';
      var control = document.createElement(children.length ? 'button' : 'a');
      control.className = 'asme-hd-link';
      control.appendChild(icon(name));
      var text = document.createElement('span'); text.className = 'asme-hd-link-label'; text.textContent = name; control.appendChild(text);
      if (children.length) {
        control.type = 'button'; control.setAttribute('aria-expanded', 'false'); control.setAttribute('aria-controls', 'asme-header-members'); text.appendChild(icon('chevron'));
        submenu = document.createElement('ul'); submenu.id = 'asme-header-members'; submenu.className = 'asme-hd-submenu'; submenu.hidden = true;
        children.forEach(function (link) {
          var li = document.createElement('li'), a = document.createElement('a');
          a.href = link.href; a.textContent = label(link);
          if (isCurrent(link)) { a.setAttribute('aria-current', 'page'); control.classList.add('is-active'); }
          li.appendChild(a); submenu.appendChild(li);
        });
        disclosure = control;
        control.addEventListener('click', function () { setMembers(submenu.hidden); });
        control.addEventListener('keydown', function (event) { if(event.key === 'ArrowDown') { event.preventDefault(); setMembers(true); submenu.querySelector('a').focus(); } });
      } else {
        control.href = destination.href;
        if (isCurrent(destination)) { control.classList.add('is-active'); control.setAttribute('aria-current', 'page'); }
      }
      item.appendChild(control); if (children.length) item.appendChild(submenu); list.appendChild(item);
    });
    var searchButton = header.querySelector('.asme-hd-search-toggle');
    var search = header.querySelector('.asme-hd-search');
    var menuButton = header.querySelector('.asme-hd-menu-toggle');
    var nav = header.querySelector('.asme-hd-nav');
    var narrow = window.matchMedia('(max-width:979px)');
    search.action = home.href;
    searchButton.appendChild(icon('search')); menuButton.appendChild(icon('menu'));
    function setMembers(open) { if (!submenu) return; submenu.hidden = !open; disclosure.setAttribute('aria-expanded', String(open)); }
    function setMenu(open) {
      if (open) header.classList.remove('asme-header-hidden');
      header.classList.toggle('is-menu-open', open);
      menuButton.setAttribute('aria-expanded', String(open)); menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); menuButton.replaceChildren(icon(open ? 'close' : 'menu'));
      if (!open) setMembers(false);
    }
    function setSearch(open) {
      if (open) header.classList.remove('asme-header-hidden');
      search.hidden = !open; searchButton.setAttribute('aria-expanded', String(open));
      if (open) { setMenu(false); setMembers(false); search.querySelector('input').focus(); }
    }
    menuButton.addEventListener('click', function () {
      setSearch(false);
      var open = menuButton.getAttribute('aria-expanded') !== 'true';
      setMenu(open);
      if (open) nav.querySelector('a, button').focus();
    });
    searchButton.addEventListener('click', function () { setSearch(search.hidden); });
    header.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (!search.hidden) { setSearch(false); searchButton.focus(); }
      else if (submenu && !submenu.hidden) { setMembers(false); disclosure.focus(); }
      else if (header.classList.contains('is-menu-open')) { setMenu(false); menuButton.focus(); }
      else return;
      event.preventDefault();
    });
    header.addEventListener('focusout', function (event) {
      if (event.relatedTarget && !header.contains(event.relatedTarget)) { setSearch(false); setMenu(false); setMembers(false); }
    });
    document.addEventListener('click', function (event) { if(!header.contains(event.target)) { setSearch(false); setMenu(false); setMembers(false); } });
    narrow.addEventListener('change', function () {
      if (narrow.matches && nav.contains(document.activeElement)) menuButton.focus();
      setMenu(false); setSearch(false);
    });
    original.before(header);
    // If the stylesheet fails to load, leave the original WordPress menu usable.
    if (getComputedStyle(header).getPropertyValue('--asme-header-ready').trim() !== '1') { header.remove(); return; }
    original.setAttribute('data-asme-header-replaced', 'true'); original.hidden = true;
    // GeneratePress's overflow containers prevent position:sticky from following
    // the viewport. Reserve the header's space and fix only this component.
    var spacer = document.createElement('div');
    spacer.id = 'asme-header-spacer'; spacer.setAttribute('aria-hidden', 'true'); header.before(spacer);
    function reserveSpace() {
      spacer.style.height = (header.getBoundingClientRect().height + parseFloat(getComputedStyle(header).getPropertyValue('--asme-header-space'))) + 'px';
    }
    reserveSpace(); window.addEventListener('resize', reserveSpace);
    if (window.ResizeObserver) {
      var observer = new ResizeObserver(reserveSpace);
      observer.observe(header);
    }
    header.addEventListener('focusin', function () { header.classList.remove('asme-header-hidden'); });
    var lastScroll = window.scrollY || 0;
    var travel = 0;
    var direction = 0;
    var scrollTicking = false;
    function updateScrollState() {
      // Clamp elastic overscroll and accumulate slow trackpad/touch movement.
      var current = Math.max(0, Math.min(window.scrollY || 0, Math.max(0, document.documentElement.scrollHeight - window.innerHeight)));
      var delta = current - lastScroll;
      var nextDirection = Math.sign(delta);
      if (nextDirection && nextDirection !== direction) travel = 0;
      if (nextDirection) direction = nextDirection;
      travel += Math.abs(delta);
      var interacting = header.classList.contains('is-menu-open') || !search.hidden || (submenu && !submenu.hidden) || header.contains(document.activeElement);
      if (current <= 80 || interacting) header.classList.remove('asme-header-hidden');
      else if (travel >= (direction > 0 ? 12 : 6)) header.classList.toggle('asme-header-hidden', direction > 0);
      lastScroll = current;
      scrollTicking = false;
    }
    window.addEventListener('scroll', function () {
      if (!scrollTicking) { scrollTicking = true; requestAnimationFrame(updateScrollState); }
    }, { passive:true });
    var admin = document.getElementById('wpadminbar');
    if (admin) {
      var ticking = false;
      function offset() { header.style.setProperty('--asme-admin-offset', Math.max(0, admin.getBoundingClientRect().bottom) + 'px'); ticking = false; }
      offset(); window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(offset); } }, { passive:true });
      window.addEventListener('resize', offset);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
})();
