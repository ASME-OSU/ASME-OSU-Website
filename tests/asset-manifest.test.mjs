import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('every distributed sprite and tour compatibility asset exists',()=>{
 const manifest=JSON.parse(fs.readFileSync('assets/gearly/sprites.json','utf8'));
 for(const sprite of manifest.sprites)for(const key of ['file','webFile'])if(sprite[key])assert.ok(fs.existsSync('assets/gearly/'+sprite[key]),sprite[key]);
 const tour=fs.readFileSync('assets/gearly/gearly-tour.js','utf8');
 for(const [,name] of tour.matchAll(/"(gearly-[a-z-]+\.(?:png|webp))"/g))assert.ok(fs.existsSync('assets/gearly/sprites/'+name),name);
});
