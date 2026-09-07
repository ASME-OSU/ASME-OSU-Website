(function () {
  if (window.asmeMobileNavDismissReady) return;
  window.asmeMobileNavDismissReady = true;

  function getNavigation() {
    return document.getElementById('site-navigation');
  }

  function clearSubmenus(navigation) {
    navigation.querySelectorAll('.sfHover, .dropdown-hover').forEach(function (item) {
      item.classList.remove('sfHover', 'dropdown-hover');
    });

    navigation.querySelectorAll('.dropdown-menu-toggle[aria-expanded="true"]').forEach(function (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open Sub-Menu');
    });
  }

  function closeSubmenu(item) {
    item.classList.remove('sfHover', 'dropdown-hover');

    var link = item.firstElementChild;
    var toggle = link && link.querySelector('.dropdown-menu-toggle');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open Sub-Menu');
    }
  }

  function closeSiblingSubmenus(navigation, activeItem) {
    navigation.querySelectorAll(
      '.main-nav > ul > .menu-item-has-children.sfHover, ' +
      '.main-nav > ul > .menu-item-has-children.dropdown-hover'
    ).forEach(function (item) {
      if (item !== activeItem) closeSubmenu(item);
    });
  }

  function closeMobileNavigation(navigation, returnFocus) {
    var menuToggle = navigation.querySelector('.menu-toggle');
    if (!menuToggle || !navigation.classList.contains('toggled')) return;

    menuToggle.click();
    clearSubmenus(navigation);

    if (returnFocus) menuToggle.focus();
  }

  document.addEventListener('click', function (event) {
    if (!window.matchMedia('(max-width: 768px)').matches) return;

    var navigation = getNavigation();
    if (!navigation || !navigation.classList.contains('toggled')) return;
    if (navigation.contains(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    closeMobileNavigation(navigation, false);
  }, true);

  document.addEventListener('click', function (event) {
    if (!window.matchMedia('(max-width: 768px)').matches) return;

    var target = event.target && event.target.closest ? event.target : null;
    var dropdownToggle = target && target.closest('#site-navigation .dropdown-menu-toggle');
    if (!dropdownToggle) return;

    var navigation = getNavigation();
    var activeItem = dropdownToggle.closest('.menu-item-has-children');
    if (!navigation || !activeItem || !navigation.classList.contains('toggled')) return;

    window.setTimeout(function () {
      closeSiblingSubmenus(navigation, activeItem);
    }, 0);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;

    var navigation = getNavigation();
    if (!navigation || !navigation.classList.contains('toggled')) return;

    event.preventDefault();
    closeMobileNavigation(navigation, true);
  });
})();
