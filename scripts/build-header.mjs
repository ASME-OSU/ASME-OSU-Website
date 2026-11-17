import fs from 'node:fs';
const guide = JSON.parse(fs.readFileSync('assets/gearly/gearly-data.json', 'utf8'));
const searchPages = guide.pages.map(({ id, title, url, keywords }) => ({ id, title, url, keywords }));
const searchAttribute = JSON.stringify(searchPages).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const html = fs.readFileSync('Header.html', 'utf8')
  .replace('<template id="asme-header-template">', '<template id="asme-header-template" data-asme-search-pages="' + searchAttribute + '">');
const stylesheet = 'https://asme-osu.github.io/ASME-OSU-Website/Header.css?v=20261114-headerload1';
const integration = 'https://asme-osu.github.io/ASME-OSU-Website/Header%20Integration.js?v=20261117-audit1';
const assets = '<link id="asme-header-styles" rel="stylesheet" href="' + stylesheet + '">\n<script src="' + integration + '" defer></script>\n';
const bootstrap = '<!-- ASME HEADER BOOTSTRAP START -->\n<style id="asme-header-bootstrap">html.asme-header-pending #masthead{visibility:hidden}</style>\n<script>(function(d){d.documentElement.classList.add("asme-header-pending");window.setTimeout(function(){if(!d.getElementById("asme-site-header")){d.documentElement.classList.remove("asme-header-pending");}},3500);})(document);</script>\n<link rel="preload" href="' + stylesheet + '" as="style">\n<link rel="preload" href="' + integration + '" as="script">\n<!-- ASME HEADER BOOTSTRAP END -->\n';
fs.writeFileSync('Header Embed.html',html+'\n'+assets);
fs.writeFileSync('Header Bootstrap.html',bootstrap);
const footer=fs.readFileSync('Footer.html','utf8').replace(/\n<!-- ASME HEADER COMPONENT START -->[\s\S]*?<!-- ASME HEADER COMPONENT END -->\n?/g,'');
fs.writeFileSync('Footer.html',footer+'\n<!-- ASME HEADER COMPONENT START -->\n'+html+'\n'+assets+'<!-- ASME HEADER COMPONENT END -->\n');
console.log('Generated Header Embed.html');
