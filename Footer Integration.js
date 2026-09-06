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

  function socialIcon(name, markup) {
    if (name === 'GroupMe') return '<span class="asme-footer-groupme-icon" aria-hidden="true"></span>';
    return svg(markup);
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
      ['LinkedIn', sourceHref(root, 'LinkedIn', 'https://www.linkedin.com/company/asme-osu/'), '<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>'],
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
            '<p>' + svg('<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>') + '<span>Scott Laboratory<br>Office N147</span></p>' +
            '<p>' + svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>') + '<a href="mailto:asme@osu.edu">asme@osu.edu</a></p>' +
          '</div>' +
        '</section>' +
        '<nav class="asme-footer-col asme-footer-links" aria-labelledby="asme-footer-links-title"><h3 id="asme-footer-links-title">Quick Links</h3><ul>' +
          quickLinks.map(function (link) { return '<li><a href="' + link[1] + '"><span>' + link[0] + '</span>' + svg('<path d="m9 18 6-6-6-6"/>') + '</a></li>'; }).join('') +
        '</ul></nav>' +
        '<nav class="asme-footer-col asme-footer-connect" aria-labelledby="asme-footer-connect-title"><h3 id="asme-footer-connect-title">Connect</h3><ul>' +
          socialLinks.map(function (link) { return '<li><a class="asme-footer-' + link[0].toLowerCase() + '" href="' + link[1] + '"' + (link[0] === 'Calendar' ? '' : ' target="_blank" rel="noopener noreferrer"') + ' aria-label="ASME Ohio State ' + link[0] + '">' + socialIcon(link[0], link[2]) + '<span>' + link[0] + '</span></a></li>'; }).join('') +
        '</ul></nav>' +
      '</div>' +
      '<div class="asme-footer-bottom"><span>© 2026 ASME Ohio State University Chapter. All rights reserved.</span><a href="' + home + 'wp-admin/" class="asme-footer-login" aria-label="Admin Login" title="Admin Login">' + svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>') + '</a></div>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
