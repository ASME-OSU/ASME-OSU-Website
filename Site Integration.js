
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ─────────────────────────────────────────
       1. GALLERY ORIENTATION CLASSES
    ───────────────────────────────────────── */
    document.querySelectorAll('.asme-gallery-page .gallery-item img, .gallery .gallery-item img').forEach(function (img) {
      function classifyImage() {
        var item = img.closest('.gallery-item');
        if (!item || !img.naturalWidth || !img.naturalHeight) return;
        var ratio = img.naturalWidth / img.naturalHeight;
        item.classList.remove('is-portrait', 'is-landscape', 'is-panorama', 'is-square');
        if (ratio >= 1.75) item.classList.add('is-panorama');
        else if (ratio >= 1.15) item.classList.add('is-landscape');
        else if (ratio <= 0.85) item.classList.add('is-portrait');
        else item.classList.add('is-square');
      }
      if (img.complete) classifyImage();
      else img.addEventListener('load', classifyImage);
    });

    /* ─────────────────────────────────────────
       2. HERO TEXT STAGGER (homepage load)
    ───────────────────────────────────────── */
    var heroStaggerSelectors = [
      '.ah-eyebrow',
      '.ah-title',
      '.ah-sub',
      '.ah-btns',
      '.ah-stats',
      '.ah-badge'
    ];

    if (!reduceMotion) {
      heroStaggerSelectors.forEach(function (selector, i) {
        var el = document.querySelector(selector);
        if (!el) return;
        el.style.opacity = '0';
        el.style.transform = 'translateY(18px)';
        el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
        el.style.transitionDelay = (i * 110) + 'ms';
        setTimeout(function () {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }, 80 + i * 110);
      });
    }

    /* ─────────────────────────────────────────
       3. SCROLL REVEAL — expanded targets
    ───────────────────────────────────────── */
    var revealTargets = document.querySelectorAll([
      '.ah-about',
      '.ah-section-title',
      '.ah-card',
      '.ah-featured-event',
      '.ah-about-impact',
      '.ah-calendar-section',
      '.about-hero',
      '.about-mission',
      '.about-pillar',
      '.about-stats-strip',
      '.about-award',
      '.about-history',
      '.about-cta-section',
      '.asme-join-page .join-hero-copy',
      '.asme-join-page .join-form-card',
      '.join-faq-section',
      '.join-faq-item',
      '.sponsors-hero',
      '.sponsor-card',
      '.sponsors-cta',
      '.sponsor-hero',
      '.sponsor-section',
      '.sponsor-contact',
      '.gallery-hero',
      '.asme-gallery-page .gallery-item',
      '.leadership-year',
      '.leader-card',
      '.acp-header',
      '.acp-cal-card',
      '.acp-info-item',
      '.blog article',
      '.archive article',
      '.search article',
      '#secondary .widget',
      '.asme-footer-col'
    ].join(','));

    /* Smarter stagger — resets per parent so sibling cards cascade nicely */
    var parentCounters = new Map();
    revealTargets.forEach(function (el) {
      var parent = el.parentElement;
      var count = parentCounters.get(parent) || 0;
      parentCounters.set(parent, count + 1);
      el.classList.add('asme-animate', 'asme-reveal');
      el.style.setProperty('--asme-delay', Math.min(count * 70, 350) + 'ms');
    });

    if (reduceMotion) {
      revealTargets.forEach(function (el) { el.classList.add('is-visible'); });
    } else if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -48px 0px' });
      revealTargets.forEach(function (el) { observer.observe(el); });
    }

    /* ─────────────────────────────────────────
       4. COUNT-UP ANIMATION
    ───────────────────────────────────────── */
    function countUp(el, target, suffix, duration) {
      var start = null;
      function step(ts) {
        if (!start) start = ts;
        var progress = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target) + suffix;
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    /* Homepage impact mini stat cards */
    var impactGrid = document.querySelector('.ah-about-impact');
    if (impactGrid && !reduceMotion && 'IntersectionObserver' in window) {
      var homeCountTriggered = false;
      var homeCountObserver = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && !homeCountTriggered) {
          homeCountTriggered = true;
          homeCountObserver.disconnect();
          document.querySelectorAll('.ah-impact-mini span').forEach(function (el) {
            var raw = el.textContent.trim();
            var suffix = raw.replace(/[0-9]/g, '');
            var target = parseInt(raw.replace(/\D/g, ''), 10);
            if (!isNaN(target) && target > 0) {
              el.textContent = '0' + suffix;
              countUp(el, target, suffix, 1200);
            }
          });
        }
      }, { threshold: 0.5 });
      homeCountObserver.observe(impactGrid);
    }

    /* Sponsor page stat panel */
    var panel = document.querySelector('.sponsor-hero-panel');
    if (panel && !reduceMotion && 'IntersectionObserver' in window) {
      var sponsorCountTriggered = false;
      var sponsorCountObserver = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && !sponsorCountTriggered) {
          sponsorCountTriggered = true;
          sponsorCountObserver.disconnect();
          document.querySelectorAll('.sponsor-stat-inner strong').forEach(function (el) {
            var raw = el.textContent.trim();
            var suffix = raw.replace(/[0-9]/g, '');
            var target = parseInt(raw.replace(/\D/g, ''), 10);
            if (!isNaN(target)) {
              el.textContent = '0' + suffix;
              countUp(el, target, suffix, 1500);
            }
          });
        }
      }, { threshold: 0.45 });
      sponsorCountObserver.observe(panel);
    }

    /* Card hover motion is owned by the shared CSS motion system. */

    /* ─────────────────────────────────────────
       6. SMOOTH SCROLL for anchor links
    ───────────────────────────────────────── */
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var hash = link.getAttribute('href');
        if (!hash || hash.length < 2) return;
        var target = document.getElementById(hash.slice(1));
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });

    /* ─────────────────────────────────────────
       7. HOME HERO SLIDESHOW
    ───────────────────────────────────────── */
    var ahSlides = [
      { url: 'https://org.osu.edu/asme/files/2024/02/FallCareerFair_2.HEIC_-0de7b12be03c2f6b.png', focus: 'center 37%' },
      { url: 'https://org.osu.edu/asme/files/2024/02/SpringCareerFair2024_2-583e2a7ffea08f33.png', focus: 'center 50%' },
      { url: 'https://org.osu.edu/asme/files/2024/03/MicrosoftTeams-image-84f8ac384c4c262e.jpg',   focus: 'center center' },
      { url: 'https://org.osu.edu/asme/files/2026/04/ASME_Barsocial_2025-e1777080033405.jpg',      focus: 'center 30%' }
    ];

    var container     = document.getElementById('ahSlides');
    var dotsContainer = document.getElementById('ahDots');

    if (container && dotsContainer && ahSlides.length) {
      var current = 0;
      var slides  = [];
      var dots    = [];
      var timer   = null;

      ahSlides.forEach(function (s, i) {
        var el = document.createElement('div');
        el.className = 'ah-hero-slide';
        el.style.backgroundImage   = 'url(' + s.url + ')';
        el.style.backgroundPosition = s.focus || 'center center';
        if (i === 0) el.classList.add('active');
        container.appendChild(el);
        slides.push(el);

        var dot = document.createElement('button');
        dot.className = 'ah-hero-dot' + (i === 0 ? ' active' : '');
        dot.type = 'button';
        dot.setAttribute('aria-label', 'Show slide ' + (i + 1));
        dot.addEventListener('click', function () { goTo(i); restartTimer(); });
        dotsContainer.appendChild(dot);
        dots.push(dot);
      });

      function goTo(n) {
        slides[current].classList.remove('active');
        dots[current].classList.remove('active');
        current = (n + slides.length) % slides.length;
        slides[current].classList.add('active');
        dots[current].classList.add('active');
      }

      function restartTimer() {
        if (timer) clearInterval(timer);
        if (!reduceMotion) {
          timer = setInterval(function () {
            if (!document.hidden) goTo(current + 1);
          }, 5000);
        }
      }

      restartTimer();
    }

    /* Keep one continuous featured-event runner at every card aspect ratio.
       A single rounded path avoids mobile SVG implementations restarting
       the dash on separate rectangle sides. */
    var featuredOrbit = document.querySelector('.ah-featured-orbit');
    if (featuredOrbit) {
      var featuredOrbitShapes = [];
      featuredOrbit.querySelectorAll('rect').forEach(function (rect) {
        if (!rect.classList.contains('ah-featured-orbit-line')) {
          rect.parentNode.removeChild(rect);
          return;
        }
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', rect.getAttribute('class') || '');
        rect.parentNode.replaceChild(path, rect);
        featuredOrbitShapes.push(path);
      });

      function syncFeaturedOrbit() {
        var width = featuredOrbit.clientWidth;
        var height = featuredOrbit.clientHeight;
        if (!isFinite(width) || !isFinite(height) || width <= 2 || height <= 2) return;

        featuredOrbit.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        featuredOrbit.setAttribute('preserveAspectRatio', 'none');

        var inset = 1;
        var right = width - inset;
        var bottom = height - inset;
        var radius = Math.min(17, (width - 2) / 2, (height - 2) / 2);
        var pathData = [
          'M', inset + radius, inset,
          'H', right - radius,
          'A', radius, radius, 0, 0, 1, right, inset + radius,
          'V', bottom - radius,
          'A', radius, radius, 0, 0, 1, right - radius, bottom,
          'H', inset + radius,
          'A', radius, radius, 0, 0, 1, inset, bottom - radius,
          'V', inset + radius,
          'A', radius, radius, 0, 0, 1, inset + radius, inset,
          'Z'
        ].join(' ');

        featuredOrbitShapes.forEach(function (path) {
          path.setAttribute('d', pathData);
          var perimeter = path.getTotalLength();
          if (!isFinite(perimeter) || perimeter <= 0) return;
          var runnerFraction = width <= 768 ? 0.055 : 0.09;
          path.style.setProperty(
            'stroke-dasharray',
            (perimeter * runnerFraction) + 'px ' +
              (perimeter * (1 - runnerFraction)) + 'px',
            'important'
          );
          path.style.setProperty('--asme-orbit-lap', (-perimeter) + 'px');
        });
      }

      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(syncFeaturedOrbit);
      });

      if ('ResizeObserver' in window) {
        var featuredOrbitObserver = new ResizeObserver(syncFeaturedOrbit);
        featuredOrbitObserver.observe(featuredOrbit);
      } else {
        window.addEventListener('resize', syncFeaturedOrbit);
      }
    }

    /* ─────────────────────────────────────────
       8. GALLERY LIGHTBOX
    ───────────────────────────────────────── */
    (function () {
      var galleryItems = Array.prototype.slice.call(document.querySelectorAll([
        '.asme-gallery-page .gallery-item a',
        '.asme-gallery-page .gallery-icon a',
        '.gallery .gallery-item a',
        '.gallery .gallery-icon a',
        '.wp-block-gallery a[href]',
        '.wp-block-image a[href]'
      ].join(','))).filter(function (link) {
        var href = link.getAttribute('href') || '';
        var hasImage = !!link.querySelector('img');
        var isImageFile = /\.(jpe?g|png|gif|webp|avif|heic)(\?.*)?$/i.test(href);
        return hasImage && isImageFile;
      });

      if (!galleryItems.length) return;

      var lightbox = document.createElement('div');
      lightbox.className = 'asme-lightbox';
      lightbox.setAttribute('role', 'dialog');
      lightbox.setAttribute('aria-modal', 'true');
      lightbox.setAttribute('aria-label', 'Gallery image viewer');
      lightbox.innerHTML =
        '<button class="asme-lightbox-close" aria-label="Close">&times;</button>' +
        '<button class="asme-lightbox-prev" aria-label="Previous">&lsaquo;</button>' +
        '<button class="asme-lightbox-next" aria-label="Next">&rsaquo;</button>' +
        '<div class="asme-lightbox-content">' +
          '<img src="" alt="Gallery Image" decoding="async">' +
          '<div class="asme-lightbox-bar">' +
            '<div class="asme-lightbox-caption"></div>' +
            '<div class="asme-lightbox-actions">' +
              '<a class="asme-lightbox-download" href="#" download>Download</a>' +
              '<a class="asme-lightbox-open" href="#" target="_blank" rel="noopener">Open</a>' +
            '</div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(lightbox);

      var img          = lightbox.querySelector('img');
      var caption      = lightbox.querySelector('.asme-lightbox-caption');
      var downloadLink = lightbox.querySelector('.asme-lightbox-download');
      var openLink     = lightbox.querySelector('.asme-lightbox-open');
      var prevBtn      = lightbox.querySelector('.asme-lightbox-prev');
      var nextBtn      = lightbox.querySelector('.asme-lightbox-next');
      var closeBtn     = lightbox.querySelector('.asme-lightbox-close');
      var contentPanel = lightbox.querySelector('.asme-lightbox-content');
      var currentIndex = 0;
      var imageRequestId = 0;

      function updateImage(index, direction) {
        if (index < 0 || index >= galleryItems.length) return;
        currentIndex = index;
        var requestId  = ++imageRequestId;
        var link       = galleryItems[currentIndex];
        var imgUrl     = link.getAttribute('href');
        var originalImg = link.querySelector('img');
        var altText    = originalImg ? originalImg.getAttribute('alt') : 'ASME Gallery Image';
        var filename   = (imgUrl.split('/').pop() || 'asme-gallery-image').split('?')[0];
        var preloader  = new Image();
        var shouldTransition = !reduceMotion && Boolean(direction) && lightbox.classList.contains('active');

        if (shouldTransition) {
          contentPanel.style.setProperty('--asme-lightbox-shift', direction > 0 ? '16px' : '-16px');
          contentPanel.style.setProperty('--asme-lightbox-exit-shift', direction > 0 ? '-10px' : '10px');
          contentPanel.classList.remove('is-entering');
          contentPanel.classList.add('is-switching');
        }

        lightbox.setAttribute('aria-busy', 'true');

        function commitImage() {
          if (requestId !== imageRequestId) return;
          function swapImage() {
            if (requestId !== imageRequestId) return;
            if (shouldTransition) {
              contentPanel.classList.remove('is-switching');
              contentPanel.classList.add('is-entering');
            }
            img.src             = imgUrl;
            img.alt             = altText || 'ASME Gallery Image';
            caption.textContent = altText || '';
            downloadLink.href   = imgUrl;
            downloadLink.setAttribute('download', filename);
            openLink.href       = imgUrl;
            lightbox.setAttribute('aria-busy', 'false');
            if (shouldTransition) {
              window.requestAnimationFrame(function () {
                window.requestAnimationFrame(function () { contentPanel.classList.remove('is-entering'); });
              });
            }
          }
          if (shouldTransition) window.setTimeout(swapImage, 120);
          else swapImage();
        }

        preloader.onload = function () {
          if (typeof preloader.decode === 'function') {
            preloader.decode().catch(function () {}).then(commitImage);
          } else {
            commitImage();
          }
        };

        preloader.onerror = function () {
          if (requestId === imageRequestId) {
            lightbox.setAttribute('aria-busy', 'false');
          }
        };

        preloader.src = imgUrl;
      }

      galleryItems.forEach(function (link, index) {
        link.addEventListener('click', function (e) {
          e.preventDefault();
          updateImage(index, 0);
          lightbox.classList.add('active');
          document.body.classList.add('asme-lightbox-open-body');
          closeBtn.focus();
        });
      });

      function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.classList.remove('asme-lightbox-open-body');
      }

      closeBtn.addEventListener('click', closeLightbox);
      lightbox.addEventListener('click', function (e) {
        if (e.target === lightbox) closeLightbox();
      });
      lightbox.querySelector('.asme-lightbox-content').addEventListener('click', function (e) {
        e.stopPropagation();
      });

      prevBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        updateImage(currentIndex - 1 < 0 ? galleryItems.length - 1 : currentIndex - 1, -1);
      });
      nextBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        updateImage(currentIndex + 1 >= galleryItems.length ? 0 : currentIndex + 1, 1);
      });

      document.addEventListener('keydown', function (e) {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape')      closeLightbox();
        else if (e.key === 'ArrowLeft')  prevBtn.click();
        else if (e.key === 'ArrowRight') nextBtn.click();
      });
    })();

  });
})();


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

/* Shared identity and navigation: keep theme-generated controls accessible. */
(function () {
  'use strict';
  function init() {
    var title = document.querySelector('.site-title a');
    if (title) { title.textContent = 'ASME at Ohio State'; title.setAttribute('aria-label', 'ASME at Ohio State — home'); }
    var nav = document.getElementById('site-navigation');
    if (!nav) return;
    var toggle = nav.querySelector('.menu-toggle');
    if (toggle) toggle.setAttribute('aria-label', 'Main menu');
    nav.querySelectorAll('.main-nav > ul > li > a').forEach(function (link) {
      var label = link.textContent.trim();
      if (/^Events/.test(label)) {
        link.href = 'https://org.osu.edu/asme/calendar/'; link.textContent = 'Events';
        var item = link.parentElement; item.classList.remove('menu-item-has-children'); var submenu = item.querySelector('ul'); if (submenu) submenu.remove();
      }
      if (/^Corporate/.test(label)) Array.from(link.childNodes).forEach(function (node) { if (node.nodeType === 3) node.textContent = node.textContent.replace('Corporate', 'Sponsors'); });
      if (new URL(link.href, location.href).pathname === '/asme/join/') link.classList.add('asme-nav-join');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
