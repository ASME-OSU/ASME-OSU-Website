import fs from 'node:fs';
const html=fs.readFileSync('Header.html','utf8');
const assets='<link id="asme-header-styles" rel="stylesheet" href="https://asme-osu.github.io/ASME-OSU-Website/Header.css?v=20260906-header12">\n<script src="https://asme-osu.github.io/ASME-OSU-Website/Header%20Integration.js?v=20260906-header13" defer></script>\n';
const bootstrap='<!-- ASME HEADER BOOTSTRAP START -->\n<style id="asme-header-bootstrap">html.asme-header-pending #masthead{visibility:hidden}</style>\n<script>(function(d){d.documentElement.classList.add("asme-header-pending");window.setTimeout(function(){if(!d.getElementById("asme-site-header")){d.documentElement.classList.remove("asme-header-pending");}},3500);})(document);</script>\n<link rel="preload" href="https://asme-osu.github.io/ASME-OSU-Website/Header.css?v=20260906-header12" as="style">\n<link rel="preload" href="https://asme-osu.github.io/ASME-OSU-Website/Header%20Integration.js?v=20260906-header13" as="script">\n<!-- ASME HEADER BOOTSTRAP END -->\n';
fs.writeFileSync('Header Embed.html',html+'\n'+assets);
fs.writeFileSync('Header Bootstrap.html',bootstrap);
const footer=fs.readFileSync('Footer.html','utf8').replace(/\n<!-- ASME HEADER COMPONENT START -->[\s\S]*?<!-- ASME HEADER COMPONENT END -->\n?/g,'');
fs.writeFileSync('Footer.html',footer+'\n<!-- ASME HEADER COMPONENT START -->\n'+html+'\n'+assets+'<!-- ASME HEADER COMPONENT END -->\n');
console.log('Generated Header Embed.html');
