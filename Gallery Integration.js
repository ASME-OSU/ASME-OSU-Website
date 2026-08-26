(function () {
  'use strict';

  var FEED_URL = 'https://asme-osu.github.io/ASME-OSU-Website/data/instagram-feed.json';
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

    featuredLink.href = text(featured.permalink, ACCOUNT_URL);
    featuredLink.setAttribute('aria-label', text(featured.title, 'View the latest ASME OSU Instagram post'));
    featuredButton.href = text(featured.permalink, ACCOUNT_URL);
    featuredImage.src = text(featured.imageUrl, featuredImage.src);
    featuredImage.alt = text(featured.alt, text(featured.title, 'Latest ASME OSU Instagram post'));
    if (Number(featured.imageWidth) > 0) featuredImage.width = Number(featured.imageWidth);
    if (Number(featured.imageHeight) > 0) featuredImage.height = Number(featured.imageHeight);
    featuredTitle.textContent = text(featured.title, 'Latest from ASME OSU');
    featuredCaption.textContent = text(featured.summary, text(featured.caption, 'Follow ASME OSU for chapter updates, events, and student opportunities.'));
    featuredDate.textContent = shortDate(featured.timestamp);
    setupFeaturedCarousel(featured, featuredLink, featuredImage);

    var recent = feed.items.slice(1, 4);
    if (!recent.length) return;
    recentGrid.replaceChildren();
    recent.forEach(function (item) {
      recentGrid.appendChild(renderRecentPost(item));
    });
  }

  function loadInstagramFeed() {
    if (!document.querySelector('[data-gallery-instagram-feed]')) return;
    fetch(FEED_URL, { cache: 'no-store', credentials: 'omit' })
      .then(function (response) {
        if (!response.ok) throw new Error('Instagram feed request failed');
        return response.json();
      })
      .then(renderFeed)
      .catch(function () {
        /* The static WordPress content is the intentional offline fallback. */
      });
  }

  function initArchive() {
    var gallery = document.querySelector('.asme-gallery-page .gallery');
    var filters = Array.prototype.slice.call(document.querySelectorAll('[data-gallery-filter]'));
    var status = document.getElementById('galleryArchiveStatus');
    if (!gallery) return;

    var items = Array.prototype.slice.call(gallery.querySelectorAll('.gallery-item'));
    items.forEach(function (item, index) {
      var metadata = archiveItems[index] || { label: 'ASME OSU chapter photo', category: 'outreach' };
      var link = item.querySelector('a');
      var image = item.querySelector('img');
      item.dataset.galleryCategory = metadata.category;
      if (link) {
        link.dataset.galleryLabel = metadata.label;
        link.setAttribute('aria-label', 'View photo: ' + metadata.label);
      }
      if (image && !image.alt) image.alt = metadata.label;
    });

    filters.forEach(function (button) {
      button.addEventListener('click', function () {
        var selected = button.dataset.galleryFilter || 'all';
        var visibleCount = 0;
        filters.forEach(function (filter) {
          var active = filter === button;
          filter.classList.toggle('is-active', active);
          filter.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        items.forEach(function (item) {
          var visible = selected === 'all' || item.dataset.galleryCategory === selected;
          item.classList.toggle('is-filtered-out', !visible);
          if (visible) visibleCount += 1;
        });
        if (status) {
          var label = button.textContent.trim().toLowerCase();
          status.textContent = selected === 'all'
            ? 'Showing all ' + visibleCount + ' chapter photos.'
            : 'Showing ' + visibleCount + ' ' + label + ' photos.';
        }
      });
    });
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
