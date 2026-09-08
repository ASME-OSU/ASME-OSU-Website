(function () {
  'use strict';

  var FEED_URL = 'https://asme-osu.github.io/ASME-OSU-Website/data/instagram-feed.json';
  var GOOGLE_PHOTOS_FEED_URL = 'https://asme-osu.github.io/ASME-OSU-Website/data/google-photos-feed.json';
  var ACCOUNT_URL = 'https://www.instagram.com/asmeohiostate/';

  var archiveItems = [
    { label: 'ASME OSU Bar Social', category: 'socials' },
    { label: 'Honda company visit', category: 'industry' },
    { label: 'GE Vernova company visit', category: 'industry' },
    { label: 'Fall Career Fair', category: 'career' },
    { label: 'Bridge Building activity', category: 'outreach' },
    { label: 'Spring Career Fair', category: 'career' },
    { label: 'ASME OSU chapter event', category: 'outreach' },
    { label: 'ASME OSU student event', category: 'outreach' },
    { label: 'Fall Career Fair', category: 'career' },
    { label: 'Horseshoe Social', category: 'socials' },
    { label: 'Horseshoe Social', category: 'socials' },
    { label: 'Spring Career Fair', category: 'career' },
    { label: 'Halloween outreach and tabling', category: 'outreach' }
  ];

  function text(value, fallback) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  function shortDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function longDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function postType(value) {
    if (value === 'CAROUSEL_ALBUM') return 'Carousel';
    if (value === 'VIDEO' || value === 'REELS') return 'Video';
    return '';
  }

  function renderRecentPost(item) {
    var card = document.createElement('a');
    var imageWrap = document.createElement('span');
    var image = document.createElement('img');
    var copy = document.createElement('span');
    var date = document.createElement('span');
    var title = document.createElement('strong');
    var type = postType(item.mediaType);

    card.className = 'gallery-instagram-post-card';
    card.href = text(item.permalink, ACCOUNT_URL);
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.setAttribute('aria-label', text(item.title, 'View this ASME OSU Instagram post'));

    imageWrap.className = 'gallery-instagram-post-image';
    image.src = text(item.imageUrl, '');
    image.alt = text(item.alt, text(item.title, 'ASME OSU Instagram post'));
    if (Number(item.imageWidth) > 0) image.width = Number(item.imageWidth);
    if (Number(item.imageHeight) > 0) image.height = Number(item.imageHeight);
    image.loading = 'lazy';
    image.decoding = 'async';
    imageWrap.appendChild(image);

    if (type) {
      var badge = document.createElement('span');
      badge.className = 'gallery-instagram-post-type';
      badge.textContent = type;
      imageWrap.appendChild(badge);
    }

    copy.className = 'gallery-instagram-post-copy';
    date.className = 'gallery-instagram-post-date';
    date.textContent = longDate(item.timestamp);
    title.textContent = text(item.title, 'Latest from ASME OSU');
    copy.appendChild(date);
    copy.appendChild(title);
    card.appendChild(imageWrap);
    card.appendChild(copy);
    return card;
  }

  function setupFeaturedCarousel(item, featuredLink, featuredImage) {
    var slides = Array.isArray(item.carouselImages) ? item.carouselImages.filter(function (slide) {
      return slide && typeof slide.imageUrl === 'string' && slide.imageUrl.trim();
    }) : [];
    if (slides.length < 2 || !featuredLink.parentNode) return;

    var shell = document.createElement('div');
    var controls = document.createElement('div');
    var previous = document.createElement('button');
    var next = document.createElement('button');
    var status = document.createElement('span');
    var currentIndex = 0;
    var intervalId = 0;
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    shell.className = 'gallery-instagram-media-shell';
    featuredLink.parentNode.insertBefore(shell, featuredLink);
    shell.appendChild(featuredLink);

    controls.className = 'gallery-instagram-carousel-controls';
    previous.className = 'gallery-instagram-carousel-button gallery-instagram-carousel-button--previous';
    previous.type = 'button';
    previous.setAttribute('aria-label', 'Show previous Instagram image');
    previous.textContent = '‹';
    next.className = 'gallery-instagram-carousel-button gallery-instagram-carousel-button--next';
    next.type = 'button';
    next.setAttribute('aria-label', 'Show next Instagram image');
    next.textContent = '›';
    status.className = 'gallery-instagram-carousel-status';
    status.setAttribute('aria-live', 'polite');
    controls.appendChild(previous);
    controls.appendChild(status);
    controls.appendChild(next);
    shell.appendChild(controls);

    function showSlide(index) {
      var slide;
      currentIndex = (index + slides.length) % slides.length;
      slide = slides[currentIndex];
      featuredImage.classList.add('is-changing');
      featuredImage.src = slide.imageUrl;
      featuredImage.alt = text(slide.alt, text(item.title, 'ASME OSU Instagram carousel'));
      if (Number(slide.imageWidth) > 0) featuredImage.width = Number(slide.imageWidth);
      if (Number(slide.imageHeight) > 0) featuredImage.height = Number(slide.imageHeight);
      status.textContent = (currentIndex + 1) + ' / ' + slides.length;
      window.setTimeout(function () { featuredImage.classList.remove('is-changing'); }, 180);

      var preloadIndex = (currentIndex + 1) % slides.length;
      var preload = new Image();
      preload.src = slides[preloadIndex].imageUrl;
    }

    function stopRotation() {
      window.clearInterval(intervalId);
      intervalId = 0;
    }

    function startRotation() {
      stopRotation();
      if (!reducedMotion && document.visibilityState !== 'hidden') {
        intervalId = window.setInterval(function () { showSlide(currentIndex + 1); }, 6000);
      }
    }

    previous.addEventListener('click', function () {
      showSlide(currentIndex - 1);
      startRotation();
    });
    next.addEventListener('click', function () {
      showSlide(currentIndex + 1);
      startRotation();
    });
    shell.addEventListener('mouseenter', stopRotation);
    shell.addEventListener('mouseleave', startRotation);
    shell.addEventListener('focusin', stopRotation);
    shell.addEventListener('focusout', startRotation);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') stopRotation();
      else startRotation();
    });

    showSlide(0);
    startRotation();
  }

  function removeWordPressMediaBreaks(featuredLink) {
    Array.prototype.slice.call(featuredLink.children).forEach(function (child) {
      if (child.tagName === 'BR' || (child.tagName === 'P' && !child.textContent.trim())) child.remove();
    });
  }

  function showFeedLoading(featuredLink, featuredButton, featuredImage, featuredTitle, featuredCaption, featuredDate) {
    var feature = document.querySelector('[data-gallery-instagram-feed]');
    var loadingArt;
    if (!feature) return;

    feature.classList.remove('is-unavailable');
    feature.classList.add('is-loading');
    feature.setAttribute('aria-busy', 'true');
    featuredLink.href = ACCOUNT_URL;
    featuredLink.setAttribute('aria-label', 'Loading the latest ASME OSU Instagram post');
    featuredLink.setAttribute('aria-disabled', 'true');
    featuredLink.setAttribute('tabindex', '-1');
    featuredImage.removeAttribute('src');
    featuredImage.alt = '';
    featuredButton.href = ACCOUNT_URL;
    featuredButton.textContent = 'Loading latest post';
    featuredTitle.textContent = 'Loading the latest post…';
    featuredCaption.textContent = 'Checking @asmeohiostate for the newest chapter update.';
    featuredDate.textContent = 'Loading';

    if (!featuredLink.querySelector('.gallery-instagram-loading-art')) {
      loadingArt = document.createElement('span');
      loadingArt.className = 'gallery-instagram-loading-art';
      loadingArt.setAttribute('aria-hidden', 'true');
      loadingArt.appendChild(document.createElement('span'));
      featuredLink.insertBefore(loadingArt, featuredImage);
    }
  }

  function showFeedUnavailable(featuredLink, featuredButton, featuredImage, featuredTitle, featuredCaption, featuredDate) {
    var feature = document.querySelector('[data-gallery-instagram-feed]');
    if (feature) {
      feature.classList.remove('is-loading');
      feature.classList.add('is-unavailable');
      feature.setAttribute('aria-busy', 'false');
    }
    featuredLink.href = ACCOUNT_URL;
    featuredLink.setAttribute('aria-label', 'Visit ASME OSU on Instagram');
    featuredLink.removeAttribute('aria-disabled');
    featuredLink.removeAttribute('tabindex');
    featuredImage.removeAttribute('src');
    featuredImage.alt = '';
    featuredButton.href = ACCOUNT_URL;
    featuredButton.textContent = 'Visit @asmeohiostate';
    featuredTitle.textContent = 'See the latest on Instagram.';
    featuredCaption.textContent = 'The current post could not be loaded. Visit @asmeohiostate for chapter updates, events, and student opportunities.';
    featuredDate.textContent = 'Instagram';
  }

  function revealFeatured(featured, featuredLink, featuredButton, featuredImage, featuredTitle, featuredCaption, featuredDate) {
    var feature = document.querySelector('[data-gallery-instagram-feed]');
    var imageUrl = text(featured.imageUrl, '');
    var preload;

    if (!imageUrl) {
      showFeedUnavailable(featuredLink, featuredButton, featuredImage, featuredTitle, featuredCaption, featuredDate);
      return;
    }

    preload = new Image();
    preload.onload = function () {
      var revealed = false;
      function finishReveal() {
        if (revealed) return;
        revealed = true;
        if (feature) {
          feature.classList.remove('is-loading');
          feature.setAttribute('aria-busy', 'false');
        }
        setupFeaturedCarousel(featured, featuredLink, featuredImage);
      }

      featuredLink.href = text(featured.permalink, ACCOUNT_URL);
      featuredLink.setAttribute('aria-label', text(featured.title, 'View the latest ASME OSU Instagram post'));
      featuredLink.removeAttribute('aria-disabled');
      featuredLink.removeAttribute('tabindex');
      featuredButton.href = text(featured.permalink, ACCOUNT_URL);
      featuredButton.textContent = 'View featured post';
      featuredImage.alt = text(featured.alt, text(featured.title, 'Latest ASME OSU Instagram post'));
      if (Number(featured.imageWidth) > 0) featuredImage.width = Number(featured.imageWidth);
      if (Number(featured.imageHeight) > 0) featuredImage.height = Number(featured.imageHeight);
      featuredTitle.textContent = text(featured.title, 'Latest from ASME OSU');
      featuredCaption.textContent = text(featured.summary, text(featured.caption, 'Follow ASME OSU for chapter updates, events, and student opportunities.'));
      featuredDate.textContent = shortDate(featured.timestamp);
      removeWordPressMediaBreaks(featuredLink);
      featuredImage.addEventListener('load', finishReveal, { once: true });
      featuredImage.addEventListener('error', function () {
        showFeedUnavailable(featuredLink, featuredButton, featuredImage, featuredTitle, featuredCaption, featuredDate);
      }, { once: true });
      featuredImage.src = imageUrl;
      if (featuredImage.complete && featuredImage.naturalWidth > 0) finishReveal();
    };
    preload.onerror = function () {
      showFeedUnavailable(featuredLink, featuredButton, featuredImage, featuredTitle, featuredCaption, featuredDate);
    };
    preload.src = imageUrl;
  }

  function renderFeed(feed) {
    if (!feed || !Array.isArray(feed.items) || feed.items.length < 1) return;

    var featured = feed.items[0];
    var featuredLink = document.getElementById('galleryInstagramFeaturedLink');
    var featuredButton = document.getElementById('galleryInstagramFeaturedButton');
    var featuredImage = document.getElementById('galleryInstagramFeaturedImage');
    var featuredTitle = document.getElementById('gallery-instagram-title');
    var featuredCaption = document.getElementById('galleryInstagramFeaturedCaption');
    var featuredDate = document.getElementById('galleryInstagramFeaturedDate');
    var recentGrid = document.getElementById('galleryInstagramRecentGrid');

    if (!featuredLink || !featuredButton || !featuredImage || !featuredTitle || !featuredCaption || !featuredDate || !recentGrid) return;

    revealFeatured(featured, featuredLink, featuredButton, featuredImage, featuredTitle, featuredCaption, featuredDate);

    var recent = feed.items.slice(1, 4);
    if (!recent.length) return;
    recentGrid.replaceChildren();
    recent.forEach(function (item) {
      recentGrid.appendChild(renderRecentPost(item));
    });
  }

  function loadInstagramFeed() {
    var featuredLink = document.getElementById('galleryInstagramFeaturedLink');
    var featuredButton = document.getElementById('galleryInstagramFeaturedButton');
    var featuredImage = document.getElementById('galleryInstagramFeaturedImage');
    var featuredTitle = document.getElementById('gallery-instagram-title');
    var featuredCaption = document.getElementById('galleryInstagramFeaturedCaption');
    var featuredDate = document.getElementById('galleryInstagramFeaturedDate');

    if (!document.querySelector('[data-gallery-instagram-feed]')) return;
    if (featuredLink && featuredButton && featuredImage && featuredTitle && featuredCaption && featuredDate) {
      showFeedLoading(featuredLink, featuredButton, featuredImage, featuredTitle, featuredCaption, featuredDate);
    }
    fetch(FEED_URL, { cache: 'no-store', credentials: 'omit' })
      .then(function (response) {
        if (!response.ok) throw new Error('Instagram feed request failed');
        return response.json();
      })
      .then(renderFeed)
      .catch(function () {
        if (featuredLink && featuredButton && featuredImage && featuredTitle && featuredCaption && featuredDate) {
          showFeedUnavailable(featuredLink, featuredButton, featuredImage, featuredTitle, featuredCaption, featuredDate);
        }
      });
  }

  function safeImageUrl(value) {
    try {
      var url = new URL(value, window.location.href);
      return url.protocol === 'https:' && /(^|\.)github\.io$/i.test(url.hostname);
    } catch (error) { return false; }
  }

  function addGooglePhoto(item, gallery) {
    if (!item || typeof item.id !== 'string' || !safeImageUrl(item.thumbnailUrl) || !safeImageUrl(item.imageUrl)) return;
    if (Array.prototype.some.call(gallery.querySelectorAll('[data-gallery-source="google-photos"]'), function (node) { return node.dataset.galleryId === item.id; })) return;
    var galleryItem = document.createElement('figure');
    var icon = document.createElement('div');
    var link = document.createElement('a');
    var image = document.createElement('img');
    var label = text(item.alt, 'ASME OSU chapter photo');
    galleryItem.className = 'gallery-item gallery-item--google-photos';
    galleryItem.dataset.gallerySource = 'google-photos';
    galleryItem.dataset.galleryId = item.id;
    galleryItem.dataset.galleryCategory = text(item.category, 'general').toLowerCase();
    link.href = item.imageUrl;
    link.dataset.galleryLabel = label;
    link.setAttribute('aria-label', 'View photo: ' + label);
    image.src = item.thumbnailUrl;
    image.alt = label;
    image.loading = 'lazy';
    image.decoding = 'async';
    if (Number(item.width) > 0) image.width = Number(item.width);
    if (Number(item.height) > 0) image.height = Number(item.height);
    link.appendChild(image);
    icon.className = 'gallery-icon landscape';
    icon.appendChild(link);
    galleryItem.appendChild(icon);
    gallery.appendChild(galleryItem);
    return galleryItem;
  }

  function loadGooglePhotos(gallery, refresh) {
    fetch(GOOGLE_PHOTOS_FEED_URL, { cache: 'no-store', credentials: 'omit' })
      .then(function (response) { if (!response.ok) throw new Error('Google Photos feed request failed'); return response.json(); })
      .then(function (feed) {
        if (!feed || feed.schemaVersion !== 1 || !Array.isArray(feed.items)) return;
        var inserted = feed.items.map(function (item) { return addGooglePhoto(item, gallery); }).filter(Boolean);
        if (inserted.length) {
          if (typeof window.asmeInitializeGalleryItems === 'function') window.asmeInitializeGalleryItems(inserted);
          window.dispatchEvent(new CustomEvent('asme:gallery-items-added', { detail: { items: inserted } }));
        }
        refresh();
      })
      .catch(function () { /* Archive remains the intentional feed-failure fallback. */ });
  }

  function initArchive() {
    var gallery = document.querySelector('.asme-gallery-page .gallery');
    var filters = Array.prototype.slice.call(document.querySelectorAll('[data-gallery-filter]'));
    var status = document.getElementById('galleryArchiveStatus');
    if (!gallery) return;

    var activeFilter = 'all';
    function items() { return Array.prototype.slice.call(gallery.querySelectorAll('.gallery-item')); }
    function update(selected) {
      activeFilter = selected || activeFilter;
      var currentItems = items();
      var visibleItems = [];
      var hasGeneral = currentItems.some(function (item) { return item.dataset.galleryCategory === 'general'; });
      var general = document.querySelector('[data-gallery-filter="general"]');
      if (hasGeneral && !general) {
        general = document.createElement('button');
        general.className = 'gallery-archive-filter';
        general.type = 'button';
        general.dataset.galleryFilter = 'general';
        general.setAttribute('aria-pressed', 'false');
        general.textContent = 'General';
        if (filters[0] && filters[0].parentNode) filters[0].parentNode.appendChild(general);
        filters.push(general);
        general.addEventListener('click', function () { update('general'); });
      }
      currentItems.forEach(function (item) {
        var visible = activeFilter === 'all' || item.dataset.galleryCategory === activeFilter;
        item.classList.toggle('is-filtered-out', !visible);
        item.classList.remove('is-last-visible');
        if (visible) visibleItems.push(item);
      });
      if (visibleItems.length) visibleItems[visibleItems.length - 1].classList.add('is-last-visible');
      filters.forEach(function (button) {
        var selectedButton = button.dataset.galleryFilter === activeFilter;
        button.classList.toggle('is-active', selectedButton);
        button.setAttribute('aria-pressed', selectedButton ? 'true' : 'false');
      });
      if (status) {
        var label = activeFilter === 'all' ? '' : ' ' + activeFilter;
        status.textContent = visibleItems.length + label + (visibleItems.length === 1 ? ' photo' : ' photos');
      }
    }

    items().forEach(function (item, index) {
      if (item.dataset.gallerySource === 'google-photos') return;
      var metadata = archiveItems[index] || { label: 'ASME OSU chapter photo', category: 'outreach' };
      var link = item.querySelector('a');
      var image = item.querySelector('img');
      item.dataset.galleryCategory = metadata.category;
      if (link) {
        link.dataset.galleryLabel = metadata.label;
        link.setAttribute('aria-label', 'View photo: ' + metadata.label);
      }
      if (image && !image.alt) image.alt = metadata.label;
      item.dataset.gallerySource = 'wordpress';
    });
    filters.forEach(function (button) {
      button.addEventListener('click', function () {
        update(button.dataset.galleryFilter || 'all');
      });
    });
    update('all');
    loadGooglePhotos(gallery, function () { update(activeFilter); });
  }

  function init() {
    loadInstagramFeed();
    initArchive();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
