(function (root) {
  'use strict';
  var doc = root.document, config = {}, memory = {}, active = null, offerNode = null, generation = 0;

  var spriteFiles = ["gearly-peeking-thumbs-up.png", "gearly-executive-briefcase.webp", "gearly-peeking-banner.webp", "gearly-peeking-side.webp", "gearly-smiling-wave.webp", "gearly-surprised-head.webp", "gearly-laptop-presenting.webp", "gearly-open-eyes-wave.webp", "gearly-growth-chart.webp", "gearly-double-pointing.webp", "gearly-open-eyes-wave.png", "gearly-winking-peek.webp", "gearly-winking-head.webp", "gearly-executive-briefcase.png", "gearly-surprised-head.png", "gearly-neutral-head.webp", "gearly-double-thumbs-up.png", "gearly-peeking-thumbs-up.webp", "gearly-laughing-head.webp", "gearly-double-thumbs-up.webp", "gearly-sitting-wave.png", "gearly-presenting-open-arms.png", "gearly-smiling-wave.png", "gearly-celebrating-jump.png", "gearly-happy-head.webp", "gearly-thinking-chin.png", "gearly-winking-peek.png", "gearly-pointing-right.webp", "gearly-calendar-presenting.webp", "gearly-laptop-presenting.png", "gearly-growth-chart.png", "gearly-neutral-head.png", "gearly-celebrating-jump.webp", "gearly-laughing-head.png", "gearly-happy-head.png", "gearly-presenting-open-arms.webp", "gearly-calendar-presenting.png", "gearly-thinking-chin.webp", "gearly-sitting-wave.webp", "gearly-winking-head.png", "gearly-pointing-right.png", "gearly-peeking-banner.png", "gearly-double-pointing.png", "gearly-peeking-side.png"];
  // Section requests use registered actions, never selectors or routes from storage.
  var guide = null, guideToken = 0, guideKey = 'asme-gearly-section-v1';
  function clearSectionPending(){try{root.sessionStorage.removeItem(guideKey);}catch(_){}}
  function registered(action){
    var found=null;(config.data && config.data.intents || []).some(function(intent){return (intent.actions || []).some(function(a,index){if(a && ['scrollTo','openFaq'].includes(a.type) && a.page && a.selector && a.type===action.type && a.page===action.page && a.selector===action.selector && destination({page:a.page})){found={action:a,intent:intent.id,index:index};return true;}return false;});});return found;
  }
  function stopGuide(){guideToken++;if(!guide)return;guide.element.classList.remove('gearly-section-focus');doc.removeEventListener('keydown',guide.keyboard);guide.card.remove();guide=null;}
  function sectionSprite(action){var page=action.page || '';return /member-points/.test(page)?'gearly-growth-chart.webp':/calendar/.test(page)?'gearly-calendar-presenting.webp':/member-resources|sponsor/.test(page)?'gearly-executive-briefcase.webp':/join/.test(page)?'gearly-double-thumbs-up.webp':'gearly-pointing-right.webp';}
  function scrollTarget(element){
    if(element.scrollIntoView){element.scrollIntoView({block:'start',behavior:'instant'});if(typeof root.scrollBy==='function')root.scrollBy({top:-96,left:0,behavior:'instant'});}
  }
  function focusSection(element){var control=element.querySelector('input:not([type=hidden]):not(:disabled),button:not(:disabled),a[href],summary') || element.querySelector('h1,h2,h3') || element;var old=control.getAttribute('tabindex');if(!control.matches('input,button,a[href],summary,[tabindex]')){control.setAttribute('tabindex','-1');control.addEventListener('blur',function(){if(old===null)control.removeAttribute('tabindex');else control.setAttribute('tabindex',old);},{once:true});}control.focus({preventScroll:true});}
  function revealSection(entry){
    stopGuide();finish();var token=guideToken,attempts=0,action=entry.action;
    function wait(){
      if(token!==guideToken)return;var element=target(action);if(!element && attempts++<12){setTimeout(wait,250);return;}
      if(action.type==='openFaq' && element && element.tagName==='DETAILS')element.open=true;
      var card=doc.createElement('aside');card.className='gearly-section-card';card.setAttribute('aria-label','Gearly section guide');
      var image=doc.createElement('img');image.src=new URL('sprites/'+sectionSprite(action),config.assetBase).href;image.alt='';image.width=72;image.height=72;image.className='gearly-section-sprite';image.addEventListener('error',function(){image.remove();});
      var copy=doc.createElement('div');copy.className='gearly-section-copy';var eyebrow=doc.createElement('p');eyebrow.className='gearly-section-eyebrow';eyebrow.textContent=element?'Found it':'Section unavailable';var title=doc.createElement('h2');title.textContent=action.title || action.label || 'Your ASME section';var description=doc.createElement('p');description.setAttribute('role','status');description.textContent=element?(action.text || 'You can explore this section or ask me another question.'):'This section could not be found. You can still explore this page.';copy.append(eyebrow,title,description);card.append(image,copy);
      var controls=doc.createElement('div');controls.className='gearly-section-controls';if(element)controls.append(button('Explore section',function(){var selected=guide.element;stopGuide();focusSection(selected);}));controls.append(button('Ask Gearly',function(){stopGuide();if(root.Gearly)root.Gearly.open();}));var dismiss=button('Close section guide',function(){stopGuide();var launcher=doc.querySelector('.gearly-launcher');if(launcher)launcher.focus({preventScroll:true});});dismiss.textContent='×';dismiss.className='gearly-section-dismiss';card.append(controls,dismiss);doc.body.append(card);
      // A native outline follows layout immediately, including changing chart height.
      if(element){element.classList.add('gearly-section-focus');scrollTarget(element);}guide={card:card,element:element || doc.body,keyboard:function(event){if(event.key==='Escape'){event.preventDefault();stopGuide();var launcher=doc.querySelector('.gearly-launcher');if(launcher)launcher.focus({preventScroll:true});}}};doc.addEventListener('keydown',guide.keyboard);
    }
    wait();
  }
  function showSection(action){
    var entry=registered(action);if(!entry)return false;var url=destination({page:entry.action.page});if(current(url)){clearSectionPending();revealSection(entry);return true;}
    try{root.sessionStorage.setItem(guideKey,JSON.stringify({intent:entry.intent,index:entry.index,to:url,expires:Date.now()+180000}));}catch(_){} // Denied storage still opens the approved page.
    stopGuide();finish();try{root.location.assign(url);return true;}catch(_){clearSectionPending();return false;}
  }
  function resumeSection(){
    try{var pending=JSON.parse(root.sessionStorage.getItem(guideKey));if(!pending)return;clearSectionPending();var intent=(config.data.intents || []).find(function(i){return i.id===pending.intent;});var action=intent && Number.isInteger(pending.index) && (intent.actions || [])[pending.index],entry=action && registered(action);if(entry && pending.expires>Date.now() && pending.expires<=Date.now()+180000 && pending.to===destination({page:action.page}) && current(pending.to))revealSection(entry);}catch(_){clearSectionPending();}
  }
  function sessionKey() { return key() + '-session'; }
  function clearPending() { try {root.sessionStorage.removeItem(sessionKey());}catch(_){} }
  function destination(step) {
    if (!step.page) return null;
    try {
      var u=new URL(step.page,root.location.href);
      if(u.protocol!=='https:' || u.origin!=='https://org.osu.edu' || !u.pathname.startsWith('/asme/') || u.search || u.hash || u.username || u.password) return null;
      var page=(config.data.pages || []).find(function(p){return p.url === u.href;});
      if(!page) return null;
      if (/^(localhost|127\.0\.0\.1)$/.test(root.location.hostname)) { if(typeof page.sourceFile!=='string' || !/^[A-Za-z0-9 &-]+\.html$/.test(page.sourceFile)) return null; var preview=new URL('/',root.location.href);preview.searchParams.set('page',page.sourceFile);var scheme=new URL(root.location.href).searchParams.get('scheme');if(scheme)preview.searchParams.set('scheme',scheme);return preview.href; }
      return u.origin === root.location.origin ? u.href : null;
    } catch(_){return null;}
  }
  function current(url) { if(!url)return true;var a=new URL(url),b=new URL(root.location.href);return a.origin===b.origin && a.pathname===b.pathname && a.searchParams.get('page')===b.searchParams.get('page'); }
  function navigate(index,direction) {
    var url=destination(active.steps[index]);
    try {root.sessionStorage.setItem(sessionKey(),JSON.stringify({index:index,direction:direction,to:url,expires:Date.now()+1800000}));}
    catch(_) {return false;}
    try {root.location.assign(url);}catch(_){clearPending();return false;}
    finish();return true;
  }
  function validSteps() {var t=config.data && config.data.tour;return t && Array.isArray(t.steps) ? t.steps.filter(function(s){return s && typeof s.selector==='string' && typeof s.title==='string' && typeof s.text==='string' && (!s.page || destination(s));}).slice(0,Number(t.maxSteps)||8) : [];}
  function begin(index,direction) {
    stopGuide();finish();var steps=validSteps();if(!steps.length)return;var token=++generation,attempts=0;
    function wait(){if(token!==generation)return;var step=steps[index];if(!step)return;if(!current(destination(step)) || target(step) || attempts++>=12)launch(steps,index,direction);else setTimeout(wait,250);}
    wait();
  }
  function key() { return 'asme-gearly-tour-' + ((config.data && config.data.tour && config.data.tour.version) || 1); }
  function read() { try { return root.localStorage.getItem(key()) || memory[key()]; } catch (_) { return memory[key()]; } }
  function remember(value) { memory[key()] = value; try { root.localStorage.setItem(key(), value); } catch (_) {} }
  function button(text, fn) { var b = doc.createElement('button'); b.type = 'button'; b.textContent = ({Skip:'×',Back:'← Back',Next:'Next →',Done:'Finish','Not now':'×'})[text] || text; b.setAttribute('aria-label',text === 'Skip' ? 'Skip tour' : text); b.addEventListener('click', fn); return b; }
  function position(rect, width, height, viewport) {
    var pad = 12, w = Math.min(width, Math.max(0, viewport.width - pad * 2));
    var left = Math.max(pad, Math.min(rect.left, viewport.width - w - pad));
    var top = rect.bottom + pad;
    if (top + height > viewport.height - pad) top = rect.top - height - pad;
    top = Math.max(pad, Math.min(top, Math.max(pad, viewport.height - height - pad)));
    return { left: left, top: top, width: w };
  }
  function visible(el) { if (!el || el.closest('[hidden], [aria-hidden="true"]')) return false; var r = el.getBoundingClientRect(), s = root.getComputedStyle(el); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; }
  function target(step) { try { return Array.from(doc.querySelectorAll(step.selector)).find(visible); } catch (_) { return null; } }
  function dismissOffer() { if (offerNode) offerNode.remove(); offerNode = null; }
  function finish(value) {
    generation++; dismissOffer(); if(value)clearPending();
    if (!active) return;
    var old = active; active = null;if(old.observer)old.observer.disconnect();if(old.frame && root.cancelAnimationFrame)root.cancelAnimationFrame(old.frame);root.removeEventListener('resize', old.reposition); root.removeEventListener('scroll', old.reposition, true); doc.removeEventListener('keydown', old.keyboard, true); doc.removeEventListener('click', old.blockClick, true); doc.removeEventListener('focusin', old.blockFocus, true); old.inert.forEach(function(saved){if(saved.value === null) saved.element.removeAttribute('inert'); else saved.element.setAttribute('inert',saved.value);}); old.container.remove();
    if (value) remember(value);
    var restore=old.previous;if(!restore || !restore.isConnected || /^(BODY|HTML)$/.test(restore.tagName))restore=doc.querySelector('.gearly-launcher');if(restore && typeof restore.focus === 'function')restore.focus({preventScroll:true});
  }
  function update() {
    if (!active || !active.element) return;
    var r = active.element.getBoundingClientRect();
    // No geometric easing: the highlight stays on the element during layout changes.
    active.ring.style.left = r.left - 5 + 'px'; active.ring.style.top = r.top - 5 + 'px'; active.ring.style.width = r.width + 10 + 'px'; active.ring.style.height = r.height + 10 + 'px';
    var height=active.tip.getBoundingClientRect().height || 220,width=Math.min(340,root.innerWidth-24);
    active.tip.style.width=width+'px';active.tip.style.left=Math.max(12,root.innerWidth-width-16)+'px';active.tip.style.top=Math.max(12,root.innerHeight-height-16)+'px';
  }
  function scheduleUpdate(){if(!active || active.frame)return;if(!root.requestAnimationFrame){update();return;}active.frame=root.requestAnimationFrame(function(){if(!active)return;active.frame=null;update();});}
  function show(index, direction) {
    if (!active) return;
    var steps = active.steps, el;
    while (index >= 0 && index < steps.length) { var route=destination(steps[index]);if(route && !current(route)){if(navigate(index,direction||1))return;} else {el = target(steps[index]);if(el)break;} index += direction || 1; }
    if (!el) { finish('completed'); return; }
    active.index = index; active.element = el; var step = steps[index], tip = active.tip; tip.textContent = '';
    var count = doc.createElement('p'); count.className = 'gearly-tour-count'; count.id = 'gearly-tour-progress'; count.textContent = 'Step ' + (index + 1) + ' of ' + steps.length;
    var title = doc.createElement('h2'); title.id = 'gearly-tour-title'; title.textContent = step.title;
    var body = doc.createElement('p'); body.id = 'gearly-tour-description'; body.textContent = step.text;
    tip.append(count,title,body);
    if(spriteFiles.includes(step.sprite) && config.assetBase){try{var image=doc.createElement('img');image.src=new URL('sprites/'+step.sprite,config.assetBase).href;image.alt='';image.className='gearly-tour-sprite';image.width=72;image.height=72;image.addEventListener('error',function(){image.remove();});tip.insertBefore(image,count);}catch(_){}}
    var nextRoute=steps.slice(index+1).map(destination).find(function(url){return url && !current(url);});
    if(nextRoute){try{root.sessionStorage.setItem(sessionKey()+'-probe','1');root.sessionStorage.removeItem(sessionKey()+'-probe');}catch(_){var note=doc.createElement('p');note.textContent='Browser storage is unavailable. This tour stays on this page; explore the next section here:';var fallback=doc.createElement('a');fallback.href=nextRoute;fallback.textContent='Open next tour page';tip.append(note,fallback);}}
    if (step.url) { try { var u = new URL(step.url, root.location.href); if (u.protocol === 'https:' && u.hostname === 'org.osu.edu') { var link = doc.createElement('a'); link.href = u.href; link.textContent = 'Open this page'; tip.appendChild(link); } } catch (_) {} }
    var controls = doc.createElement('div'); controls.className = 'gearly-tour-controls';
    controls.appendChild(button('Skip', function () { finish('dismissed'); }));
    if (index > 0) controls.appendChild(button('Back', function () { show(active.index - 1, -1); }));
    var next = button(index === steps.length - 1 ? 'Done' : 'Next', function () { if (active.index === steps.length - 1) finish('completed'); else show(active.index + 1, 1); }); controls.appendChild(next); tip.appendChild(controls);
    if(index < steps.length-1){var following=steps[index+1],page=(config.data.pages || []).find(function(p){return p.url===following.page;}),cue=doc.createElement('p');cue.className='gearly-tour-destination';cue.textContent='Next: '+(!current(destination(following)) && page && page.title || following.title);tip.appendChild(cue);next.title=cue.textContent;}
    if(active.observer){active.observer.disconnect();active.observer.observe(el);active.observer.observe(tip);}scrollTarget(el);
    update(); next.focus({preventScroll:true});
  }
  function launch(steps,index,direction) {
    if(!steps.some(function(s){return s.page;})) steps = steps.filter(function(s){return target(s);});
    if (!steps.length) return;
    var container = doc.createElement('div'); container.className = 'gearly-tour';
    var ring = doc.createElement('div'); ring.className = 'gearly-tour-ring'; ring.setAttribute('aria-hidden','true');
    var tip = doc.createElement('section'); tip.className = 'gearly-tour-tip'; tip.setAttribute('role','dialog'); tip.setAttribute('aria-modal','true'); tip.setAttribute('aria-labelledby','gearly-tour-title'); tip.setAttribute('aria-describedby','gearly-tour-progress gearly-tour-description');
    container.append(ring,tip); doc.body.appendChild(container);
    var inert = Array.from(doc.body.children).filter(function(el){return el !== container && !/^(SCRIPT|STYLE|LINK)$/.test(el.tagName);}).map(function(el){var saved={element:el,value:el.getAttribute('inert')};el.setAttribute('inert','');return saved;});
    active = {inert:inert,blockClick:function(event){if(!tip.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();}},blockFocus:function(event){if(!tip.contains(event.target)){var control=tip.querySelector('button,a[href]');if(control)control.focus({preventScroll:true});}},container:container,ring:ring,tip:tip,steps:steps,index:0,previous:doc.activeElement,reposition:scheduleUpdate,keyboard:function (event) {
      if (event.key === 'Escape') { event.preventDefault(); finish('dismissed'); }
      if (event.key === 'Tab' && active) { var controls = Array.from(tip.querySelectorAll('button,a[href]')); var first=controls[0],last=controls[controls.length-1]; if (event.shiftKey && (doc.activeElement===first || !tip.contains(doc.activeElement))) {event.preventDefault();last.focus();} else if (!event.shiftKey && (doc.activeElement===last || !tip.contains(doc.activeElement))) {event.preventDefault();first.focus();} }
    }};
    if(root.ResizeObserver)active.observer=new root.ResizeObserver(scheduleUpdate);
    root.addEventListener('resize',scheduleUpdate); root.addEventListener('scroll',scheduleUpdate,true); doc.addEventListener('keydown',active.keyboard,true); doc.addEventListener('click',active.blockClick,true); doc.addEventListener('focusin',active.blockFocus,true); show(index || 0,direction || 1);
  }
  root.GearlyTour = {
    configure:function (options) { config = options || {};resumeSection();try {var saved=JSON.parse(root.sessionStorage.getItem(sessionKey()));if(saved && saved.expires>Date.now() && Number.isInteger(saved.index) && saved.index>=0 && saved.index<validSteps().length && saved.to===destination(validSteps()[saved.index]) && current(saved.to)){clearPending();begin(saved.index,saved.direction===-1?-1:1);}else clearPending();}catch(_){clearPending();} },
    showSection:showSection,
    clearSection:function(){clearSectionPending();stopGuide();},
    start:function () {clearPending();begin(0,1);},
    offer:function () {
      if (read() || offerNode || active || guide || !config.data || !config.data.tour) return;
      offerNode=doc.createElement('aside'); offerNode.className='gearly-tour-offer'; offerNode.setAttribute('aria-label','Website tour invitation');
      var startButton=button('Start tour',function(){root.GearlyTour.start();});startButton.className='gearly-tour-offer-start';var label=config.data.tour.offer && config.data.tour.offer.label;if(typeof label==='string' && label.trim() && label.length<=40)startButton.textContent=label;var sprite=config.data.tour.steps && config.data.tour.steps[0] && config.data.tour.steps[0].sprite;if(spriteFiles.includes(sprite) && config.assetBase){try{var image=doc.createElement('img');image.src=new URL('sprites/'+sprite,config.assetBase).href;image.alt='';image.width=40;image.height=40;startButton.prepend(image);}catch(_){}}offerNode.appendChild(startButton); offerNode.appendChild(button('Not now',function(){remember('dismissed');dismissOffer();}));doc.body.appendChild(offerNode);
    },
    dismissOffer:dismissOffer,
    close:function () {finish('dismissed');},
    position:position
  };
})(typeof window !== 'undefined' ? window : globalThis);
