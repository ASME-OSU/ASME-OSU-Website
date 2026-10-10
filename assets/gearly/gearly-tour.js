(function (root) {
  'use strict';
  var doc = root.document, config = {}, memory = {}, active = null, offerNode = null, generation = 0;
  function key() { return 'asme-gearly-tour-' + ((config.data && config.data.tour && config.data.tour.version) || 1); }
  function read() { try { return root.localStorage.getItem(key()) || memory[key()]; } catch (_) { return memory[key()]; } }
  function remember(value) { memory[key()] = value; try { root.localStorage.setItem(key(), value); } catch (_) {} }
  function button(text, fn) { var b = doc.createElement('button'); b.type = 'button'; b.textContent = text; b.addEventListener('click', fn); return b; }
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
    generation++; dismissOffer();
    if (!active) return;
    var old = active; active = null; root.removeEventListener('resize', old.reposition); root.removeEventListener('scroll', old.reposition, true); doc.removeEventListener('keydown', old.keyboard, true); doc.removeEventListener('click', old.blockClick, true); doc.removeEventListener('focusin', old.blockFocus, true); old.inert.forEach(function(saved){if(saved.value === null) saved.element.removeAttribute('inert'); else saved.element.setAttribute('inert',saved.value);}); old.container.remove();
    if (value) remember(value);
    if (old.previous && old.previous.isConnected && typeof old.previous.focus === 'function') old.previous.focus({ preventScroll: true });
  }
  function update() {
    if (!active || !active.element) return;
    var r = active.element.getBoundingClientRect();
    active.ring.style.left = r.left - 5 + 'px'; active.ring.style.top = r.top - 5 + 'px'; active.ring.style.width = r.width + 10 + 'px'; active.ring.style.height = r.height + 10 + 'px';
    var p = position(r, 340, active.tip.getBoundingClientRect().height || 220, {width:root.innerWidth,height:root.innerHeight});
    active.tip.style.left = p.left + 'px'; active.tip.style.top = p.top + 'px'; active.tip.style.width = p.width + 'px';
  }
  function show(index, direction) {
    if (!active) return;
    var steps = active.steps, el;
    while (index >= 0 && index < steps.length) { el = target(steps[index]); if (el) break; index += direction || 1; }
    if (!el) { finish('completed'); return; }
    active.index = index; active.element = el; var step = steps[index], tip = active.tip; tip.textContent = '';
    var count = doc.createElement('p'); count.className = 'gearly-tour-count'; count.textContent = 'Step ' + (index + 1) + ' of ' + steps.length;
    var title = doc.createElement('h2'); title.id = 'gearly-tour-title'; title.textContent = step.title;
    var body = doc.createElement('p'); body.textContent = step.text;
    tip.append(count,title,body);
    if (step.url) { try { var u = new URL(step.url, root.location.href); if (u.protocol === 'https:' && u.hostname === 'org.osu.edu') { var link = doc.createElement('a'); link.href = u.href; link.textContent = 'Open this page'; tip.appendChild(link); } } catch (_) {} }
    var controls = doc.createElement('div'); controls.className = 'gearly-tour-controls';
    controls.appendChild(button('Skip', function () { finish('dismissed'); }));
    if (index > 0) controls.appendChild(button('Back', function () { show(active.index - 1, -1); }));
    var next = button(index === steps.length - 1 ? 'Done' : 'Next', function () { if (active.index === steps.length - 1) finish('completed'); else show(active.index + 1, 1); }); controls.appendChild(next); tip.appendChild(controls);
    if (el.scrollIntoView) el.scrollIntoView({block:'center',behavior:root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    update(); next.focus({preventScroll:true});
  }
  function launch(steps) {
    steps = steps.filter(function(s){return target(s);}).slice(0, Number(config.data.tour.maxSteps) || 8);
    if (!steps.length) return;
    var container = doc.createElement('div'); container.className = 'gearly-tour';
    var ring = doc.createElement('div'); ring.className = 'gearly-tour-ring'; ring.setAttribute('aria-hidden','true');
    var tip = doc.createElement('section'); tip.className = 'gearly-tour-tip'; tip.setAttribute('role','dialog'); tip.setAttribute('aria-modal','true'); tip.setAttribute('aria-labelledby','gearly-tour-title');
    container.append(ring,tip); doc.body.appendChild(container);
    var inert = Array.from(doc.body.children).filter(function(el){return el !== container && !/^(SCRIPT|STYLE|LINK)$/.test(el.tagName);}).map(function(el){var saved={element:el,value:el.getAttribute('inert')};el.setAttribute('inert','');return saved;});
    active = {inert:inert,blockClick:function(event){if(!tip.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();}},blockFocus:function(event){if(!tip.contains(event.target)){var control=tip.querySelector('button,a[href]');if(control)control.focus({preventScroll:true});}},container:container,ring:ring,tip:tip,steps:steps,index:0,previous:doc.activeElement,reposition:update,keyboard:function (event) {
      if (event.key === 'Escape') { event.preventDefault(); finish('dismissed'); }
      if (event.key === 'Tab' && active) { var controls = Array.from(tip.querySelectorAll('button,a[href]')); var first=controls[0],last=controls[controls.length-1]; if (event.shiftKey && (doc.activeElement===first || !tip.contains(doc.activeElement))) {event.preventDefault();last.focus();} else if (!event.shiftKey && (doc.activeElement===last || !tip.contains(doc.activeElement))) {event.preventDefault();first.focus();} }
    }};
    root.addEventListener('resize',update); root.addEventListener('scroll',update,true); doc.addEventListener('keydown',active.keyboard,true); doc.addEventListener('click',active.blockClick,true); doc.addEventListener('focusin',active.blockFocus,true); show(0,1);
  }
  root.GearlyTour = {
    configure:function (options) { config = options || {}; },
    start:function () {
      finish(); var token = ++generation, attempts = 0;
      var steps = config.data && config.data.tour && config.data.tour.steps;
      if (!Array.isArray(steps) || !steps.length) return;
      steps = steps.filter(function(s){return s && typeof s.selector==='string' && typeof s.title==='string' && typeof s.text==='string';});
      function wait() { if (token !== generation) return; if (target(steps[0]) || attempts++ >= 12) launch(steps); else setTimeout(wait,250); }
      wait();
    },
    offer:function () {
      if (read() || offerNode || active || !config.data || !config.data.tour) return;
      offerNode=doc.createElement('aside'); offerNode.className='gearly-tour-offer'; offerNode.setAttribute('aria-label','Website tour invitation');
      var offer=config.data.tour.offer || {}; if (typeof offer.title === 'string') { var heading=doc.createElement('strong');heading.textContent=offer.title;offerNode.appendChild(heading); } var text=doc.createElement('p');text.textContent=typeof offer.text === 'string' ? offer.text : 'New here? Take a quick tour of useful ASME sections.';offerNode.appendChild(text);
      offerNode.appendChild(button('Start tour',function(){root.GearlyTour.start();})); offerNode.appendChild(button('Not now',function(){remember('dismissed');dismissOffer();}));doc.body.appendChild(offerNode);
    },
    close:function () {finish('dismissed');},
    position:position
  };
})(typeof window !== 'undefined' ? window : globalThis);
