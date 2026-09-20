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
    var existing = Array.prototype.filter.call(gallery.querySelectorAll('[data-gallery-source="google-photos"]'), function (node) { return node.dataset.galleryId === item.id; })[0];
    if (existing) {
      var existingLink = existing.querySelector(':scope > a');
      if (existingLink) {
        var existingIcon = document.createElement('div');
        existingIcon.className = 'gallery-icon landscape';
        existing.replaceChild(existingIcon, existingLink);
        existingIcon.appendChild(existingLink);
      }
      return existing;
    }
    var galleryItem = document.createElement('figure');
    var icon = document.createElement('div');
    var link = document.createElement('a');
    var image = document.createElement('img');
    var label = text(item.alt, 'ASME OSU chapter photo');
    galleryItem.className = 'gallery-item gallery-item--google-photos';
    var width = Number(item.width);
    var height = Number(item.height);
    if (width > 0 && height > 0) {
      var ratio = width / height;
      galleryItem.classList.add(ratio >= 1.75 ? 'is-panorama' : ratio >= 1.15 ? 'is-landscape' : ratio <= 0.85 ? 'is-portrait' : 'is-square');
    }
    galleryItem.dataset.gallerySource = 'google-photos';
    galleryItem.dataset.galleryId = item.id;
    if (typeof item.takenAt === 'string' && Number.isFinite(Date.parse(item.takenAt))) galleryItem.dataset.galleryTakenAt = item.takenAt;
    galleryItem.dataset.galleryCategory = text(item.category, 'general').toLowerCase();
    link.href = item.imageUrl;
    link.dataset.galleryLabel = label;
    link.setAttribute('aria-label', 'View photo: ' + label);
    image.src = item.thumbnailUrl;
    image.alt = label;
    image.loading = 'lazy';
    image.decoding = 'async';
    if (width > 0) image.width = width;
    if (height > 0) image.height = height;
    link.appendChild(image);
    icon.className = 'gallery-icon landscape';
    icon.appendChild(link);
    galleryItem.appendChild(icon);
    return galleryItem;
  }

  function loadGooglePhotos(gallery, refresh) {
    fetch(GOOGLE_PHOTOS_FEED_URL, { cache: 'no-store', credentials: 'omit' })
      .then(function (response) { if (!response.ok) throw new Error('Google Photos feed request failed'); return response.json(); })
      .then(function (feed) {
        if (!feed || feed.schemaVersion !== 1 || !Array.isArray(feed.items)) return;
        // Dates, not upload order or the album's manually chosen arrangement.
        // Undated legacy entries keep their relative order after dated photos.
        var ordered = feed.items.map(function (item, index) { return { item: item, index: index }; })
          .sort(function (a, b) {
            var aDate = a.item && typeof a.item.takenAt === 'string' ? Date.parse(a.item.takenAt) : NaN;
            var bDate = b.item && typeof b.item.takenAt === 'string' ? Date.parse(b.item.takenAt) : NaN;
            return (Number.isFinite(bDate) ? bDate : 0) - (Number.isFinite(aDate) ? aDate : 0) || a.index - b.index;
          });
        var inserted = ordered.map(function (entry) { return addGooglePhoto(entry.item, gallery); }).filter(Boolean);
        if (inserted.length) {
          var fragment = document.createDocumentFragment();
          inserted.forEach(function (item) { fragment.appendChild(item); });
          gallery.insertBefore(fragment, gallery.firstChild);
          window.dispatchEvent(new CustomEvent('asme:gallery-items-added', { detail: { items: inserted } }));
        }
        refresh();
      })
      .catch(function () { /* Archive remains the intentional feed-failure fallback. */ });
  }

  function galleryAspect(item) {
    var image = item.querySelector('img');
    var width = image && (image.naturalWidth || Number(image.getAttribute('width')));
    var height = image && (image.naturalHeight || Number(image.getAttribute('height')));
    if (width > 0 && height > 0) return Math.max(0.55, Math.min(2.6, width / height));
    return item.classList.contains('is-panorama') ? 2.1 : item.classList.contains('is-landscape') ? 1.5 : item.classList.contains('is-portrait') ? 0.72 : 1;
  }

  function gallerySpans(ratios) {
    if (ratios.length === 1) return [12];
    var sum = ratios.reduce(function (total, ratio) { return total + ratio; }, 0);
    var spans = ratios.map(function () { return 2; });
    var left = 12 - spans.length * 2;
    while (left > 0) {
      var best = 0;
      ratios.forEach(function (ratio, index) {
        if (spans[index] >= 8) return;
        if (spans[best] >= 8 || 12 * ratio / sum - spans[index] > 12 * ratios[best] / sum - spans[best]) best = index;
      });
      spans[best] += 1;
      left -= 1;
    }
    return spans;
  }

  // Justified rows: choose contiguous groups of photos whose natural ratios
  // fit the available width, then divide all 12 columns between them. Unlike
  // grid-auto-flow:dense, no older photo moves ahead of a newer one.
  function planGalleryRows(ratios, width, gap) {
    if (!ratios.length) return [];
    var mobile = width <= 560;
    var target = mobile ? 195 : width <= 900 ? 250 : 295;
    var minimum = mobile ? 145 : 175;
    var maximum = mobile ? 280 : 380;
    var maxItems = mobile ? 2 : width <= 900 ? 3 : 4;
    var costs = Array(ratios.length + 1).fill(Infinity);
    var choices = [];
    costs[ratios.length] = 0;
    for (var start = ratios.length - 1; start >= 0; start -= 1) {
      for (var count = 1; count <= maxItems && start + count <= ratios.length; count += 1) {
        var group = ratios.slice(start, start + count);
        var ratioSum = group.reduce(function (total, ratio) { return total + ratio; }, 0);
        var naturalHeight = (width - gap * (count - 1)) / ratioSum;
        var height = Math.round(Math.max(minimum, Math.min(maximum, naturalHeight)));
        var spans = gallerySpans(group);
        var column = (width + gap) / 12;
        var distortion = group.reduce(function (total, ratio, index) {
          var renderedRatio = (column * spans[index] - gap) / height;
          return total + Math.pow(Math.log(renderedRatio / ratio), 2);
        }, 0);
        var cost = 2 * Math.pow(Math.log(naturalHeight / target), 2) + distortion * 3 + 0.12 +
          (count === 1 && ratios.length > 1 ? 1.8 : 0) + costs[start + count];
        if (cost < costs[start]) {
          costs[start] = cost;
          choices[start] = { count: count, height: height, spans: spans };
        }
      }
    }
    var rows = [];
    for (var cursor = 0; cursor < ratios.length;) {
      rows.push(choices[cursor]);
      cursor += choices[cursor].count;
    }
    return rows;
  }

  function layoutGallery(gallery, visibleItems) {
    var width = gallery.getBoundingClientRect().width || gallery.clientWidth || window.innerWidth || 1024;
    var gap = parseFloat(window.getComputedStyle(gallery).columnGap) || 12;
    var rows = planGalleryRows(visibleItems.map(galleryAspect), width, gap);
    gallery.classList.add('asme-gallery-justified');
    gallery.style.setProperty('grid-template-columns', 'repeat(12, minmax(0, 1fr))', 'important');
    gallery.style.setProperty('grid-auto-rows', 'auto', 'important');
    gallery.style.setProperty('grid-template-rows', rows.map(function (row) { return row.height + 'px'; }).join(' '), 'important');
    var offset = 0;
    rows.forEach(function (row, rowIndex) {
      var start = 1;
      for (var index = 0; index < row.count; index += 1) {
        var item = visibleItems[offset + index];
        var span = row.spans[index];
        item.style.setProperty('grid-column', start + ' / span ' + span, 'important');
        item.style.setProperty('grid-row', String(rowIndex + 1), 'important');
        start += span;
      }
      offset += row.count;
    });
  }

  function initArchive() {
    var gallery = document.querySelector('.asme-gallery-page .gallery');
    var filters = Array.prototype.slice.call(document.querySelectorAll('[data-gallery-filter]'));
    var status = document.getElementById('galleryArchiveStatus');
    if (!gallery) return;

    // WordPress hosts archive CSS separately. This scoped rule also neutralizes
    // its mobile square-image rule once the ratio-aware layout is active.
    if (!document.getElementById('asme-gallery-justified-images')) {
      var justifiedImages = document.createElement('style');
      justifiedImages.id = 'asme-gallery-justified-images';
      justifiedImages.textContent = 'body #page .asme-gallery-page .gallery.asme-gallery-justified .gallery-item img {' +
        'width: 100% !important; height: 100% !important; aspect-ratio: auto !important; object-fit: cover !important; }';
      document.head.appendChild(justifiedImages);
    }

    var activeFilter = 'all';
    function items() { return Array.prototype.slice.call(gallery.querySelectorAll('.gallery-item')); }
    var pendingLayout = false;
    function scheduleLayout() {
      if (pendingLayout) return;
      pendingLayout = true;
      (window.requestAnimationFrame || window.setTimeout).call(window, function () {
        pendingLayout = false;
        layoutGallery(gallery, items().filter(function (item) { return !item.classList.contains('is-filtered-out'); }));
      });
    }
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
      visibleItems.forEach(function (item) {
        var image = item.querySelector('img');
        if (image && image.dataset.asmeGalleryLayoutReady !== 'true') {
          image.dataset.asmeGalleryLayoutReady = 'true';
          image.addEventListener('load', scheduleLayout);
        }
      });
      layoutGallery(gallery, visibleItems);
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

    items().filter(function (item) { return item.dataset.gallerySource !== 'google-photos'; }).forEach(function (item, index) {
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
    window.addEventListener('resize', scheduleLayout);
    loadGooglePhotos(gallery, function () { update(activeFilter); });
  }

  function init() {
    var page = document.querySelector('.asme-gallery-page');
    if (!page || page.dataset.asmeGalleryIntegrationReady === 'true') return;
    page.dataset.asmeGalleryIntegrationReady = 'true';
    loadInstagramFeed();
    initArchive();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
