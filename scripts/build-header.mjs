import fs from 'node:fs';
const html=fs.readFileSync('Header.html','utf8');
const assets='<link id="asme-header-styles" rel="stylesheet" href="https://asme-osu.github.io/ASME-OSU-Website/Header.css?v=20260905-header3">\n<script src="https://asme-osu.github.io/ASME-OSU-Website/Header%20Integration.js?v=20260905-header3" defer></script>\n';
fs.writeFileSync('Header Embed.html',html+'\n'+assets);
const footer=fs.readFileSync('Footer.html','utf8').replace(/\n<!-- ASME HEADER COMPONENT START -->[\s\S]*?<!-- ASME HEADER COMPONENT END -->\n?/g,'');
fs.writeFileSync('Footer.html',footer+'\n<!-- ASME HEADER COMPONENT START -->\n'+html+'\n'+assets+'<!-- ASME HEADER COMPONENT END -->\n');
console.log('Generated Header Embed.html');
