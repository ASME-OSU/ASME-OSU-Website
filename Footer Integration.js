(function () {
  'use strict';

  var home = 'https://org.osu.edu/asme/';
  var groupMe = 'https://groupme.com/join_group/95825283/iaBgk5Ld';
  var fallbackLogo = 'https://org.osu.edu/asme/files/2026/05/asme_osu_logo_horizontal_black.png';

  function svg(markup) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + markup + '</svg>';
  }

  function sourceHref(root, label, fallback) {
    var link = Array.prototype.find.call(root.querySelectorAll('a'), function (anchor) {
      return anchor.textContent.trim() === label;
    });
    return link ? link.href : fallback;
  }

  function start() {
    var root = document.querySelector('.asme-footer-inner');
    if (!root || root.classList.contains('asme-footer-v2')) return;

    var headerLogo = document.querySelector('#masthead .site-logo img, #asme-site-header .asme-hd-logo img');
    var logo = root.querySelector('img');
    var logoSrc = (headerLogo && (headerLogo.currentSrc || headerLogo.src)) || (logo && logo.src) || fallbackLogo;
    var quickLinks = [
      ['Join ASME', sourceHref(root, 'Join ASME', home + 'join/')],
      ['Leadership', sourceHref(root, 'Leadership', home + 'leadership/')],
      ['Gallery', sourceHref(root, 'Gallery', home + 'pictures/')],
      ['About Us', sourceHref(root, 'About Us', home + 'aboutus/')],
      ['Sponsor ASME', sourceHref(root, 'Sponsor ASME', home + 'sponsor-asme/')]
    ];
    var socialLinks = [
      ['Instagram', sourceHref(root, 'Instagram', 'https://www.instagram.com/asmeohiostate/'), '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>'],
      ['LinkedIn', sourceHref(root, 'LinkedIn', 'https://www.linkedin.com/company/asme-osu/'), '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M6.5 9.5V18M6.5 6v.01M10.5 18v-5a3.5 3.5 0 0 1 7 0v5M10.5 12v6"/>'],
      ['GroupMe', sourceHref(root, 'GroupMe', groupMe), '<path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-14a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3Z"/><path d="M8 9h8M8 13h5"/>'],
      ['Calendar', sourceHref(root, 'Calendar', home + 'calendar/'), '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>']
    ];

    root.className = 'asme-footer-inner asme-footer-v2';
    root.innerHTML =
      '<div class="asme-footer-grid">' +
        '<section class="asme-footer-col asme-footer-brand" aria-labelledby="asme-footer-brand-title">' +
          '<a class="asme-footer-logo" href="' + home + '" aria-label="ASME Ohio State home"><img src="' + logoSrc + '" alt="ASME at The Ohio State University"></a>' +
          '<h3 id="asme-footer-brand-title">Ohio State ASME</h3>' +
          '<div class="asme-footer-contact">' +
            '<p>' + svg('<path d="M4 21h16M5 21V7l7-4 7 4v14M9 21v-8h6v8M8 9h.01M12 9h.01M16 9h.01"/>') + '<span>American Society of Mechanical Engineers<br>@ The Ohio State University</span></p>' +
            '<p>' + svg('<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>') + '<span>Columbus, OH 43210</span></p>' +
            '<p>' + svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>') + '<a href="mailto:asme@osu.edu">asme@osu.edu</a></p>' +
          '</div>' +
        '</section>' +
        '<nav class="asme-footer-col asme-footer-links" aria-labelledby="asme-footer-links-title"><h3 id="asme-footer-links-title">Quick Links</h3><ul>' +
          quickLinks.map(function (link) { return '<li><a href="' + link[1] + '"><span>' + link[0] + '</span>' + svg('<path d="m9 18 6-6-6-6"/>') + '</a></li>'; }).join('') +
        '</ul></nav>' +
        '<nav class="asme-footer-col asme-footer-connect" aria-labelledby="asme-footer-connect-title"><h3 id="asme-footer-connect-title">Connect</h3><ul>' +
          socialLinks.map(function (link) { return '<li><a href="' + link[1] + '"' + (link[0] === 'Calendar' ? '' : ' target="_blank" rel="noopener noreferrer"') + ' aria-label="ASME Ohio State ' + link[0] + '">' + svg(link[2]) + '<span>' + link[0] + '</span></a></li>'; }).join('') +
        '</ul></nav>' +
      '</div>' +
      '<div class="asme-footer-bottom"><span>© 2026 ASME Ohio State University Chapter. All rights reserved.</span></div>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
