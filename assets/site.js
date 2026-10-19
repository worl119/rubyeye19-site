/* reader shell v2 — device behaviour. Nothing here touches content. */
(function(){
  var root = document.documentElement;
  var screen = document.getElementById('screen');
  var KEYS = ['page','face','size','lead','width','align'];
  var DEF = {page:'grey', face:'serif', size:'3', lead:'normal', width:'medium', align:'justify'};
  function get(k){ return root.getAttribute('data-'+k) || DEF[k]; }
  function set(k, v){
    root.setAttribute('data-'+k, v);
    try{ localStorage.setItem('rd-'+k, v); }catch(e){}
    paint();
  }
  function paint(){
    document.querySelectorAll('[data-var]').forEach(function(g){
      var k = g.dataset.var, cur = get(k);
      g.querySelectorAll('button').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.v === cur)); });
    });
    var dn = document.getElementById('daynight');
    if (dn) dn.textContent = get('page') === 'dark' ? 'Day' : 'Night';
  }

  /* The inverted flash between pages is gone (Howard, 2026-10-18: "번쩍이는건 빼자"). A page turn
     now lets the text fade out and the next page's text fade in, in a few grey steps (site.css). */
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- day / night: dark ↔ the last light page colour ---- */
  var dn = document.getElementById('daynight');
  if (dn) dn.addEventListener('click', function(){
    var cur = get('page');
    var back = 'grey'; try{ back = localStorage.getItem('rd-light') || 'grey'; }catch(e){}
    if (cur === 'dark'){ set('page', back); }
    else { try{ localStorage.setItem('rd-light', cur); }catch(e){} set('page', 'dark'); }
  });

  /* ---- settings ---- */
  document.querySelectorAll('[data-var]').forEach(function(g){
    g.addEventListener('click', function(e){
      var b = e.target.closest('button'); if (!b) return;
      set(g.dataset.var, b.dataset.v);
      if (g.dataset.var === 'page'){ if (b.dataset.v !== 'dark'){ try{ localStorage.setItem('rd-light', b.dataset.v); }catch(e){} } }
    });
  });
  var reset = document.getElementById('aa-reset');
  if (reset) reset.addEventListener('click', function(){ KEYS.forEach(function(k){ set(k, DEF[k]); }); });
  document.querySelectorAll('.tabs [data-tab]').forEach(function(t){
    t.addEventListener('click', function(){
      document.querySelectorAll('.tabs [data-tab]').forEach(function(x){ x.setAttribute('aria-selected', String(x === t)); });
      document.querySelectorAll('.tab[data-tab]').forEach(function(p){ p.hidden = p.dataset.tab !== t.dataset.tab; });
    });
  });
  paint();

  /* ---- panels: Go To and Aa; one open at a time; click-out / Esc closes ---- */
  var panels = [
    {btn: document.getElementById('goto-btn'), panel: document.getElementById('goto')},
    {btn: document.getElementById('aa-btn'),  panel: document.getElementById('aa-panel')}
  ].filter(function(p){ return p.btn && p.panel; });
  function setOpen(p, on){ p.panel.hidden = !on; p.btn.setAttribute('aria-expanded', String(on)); }
  function closeAll(){ panels.forEach(function(p){ setOpen(p, false); }); }
  panels.forEach(function(p){
    p.btn.addEventListener('click', function(e){ e.stopPropagation(); var open = p.panel.hidden; closeAll(); setOpen(p, open); });
    p.panel.addEventListener('click', function(e){ e.stopPropagation(); });
  });
  var gx = document.getElementById('goto-close'); if (gx) gx.addEventListener('click', closeAll);
  document.addEventListener('click', closeAll);
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape'){ var o = panels.find(function(p){ return !p.panel.hidden; }); closeAll(); if (o) o.btn.focus(); }
  });

  /* ---- progress: the screen's own scroll position, top bar and bottom line ---- */
  var bar = document.querySelector('.prog > i'), pct = document.getElementById('pct'), loc = document.getElementById('loc-pct');
  function tick(){
    if (!screen) return;
    var max = screen.scrollHeight - screen.clientHeight;
    var none = max <= 4;
    [bar && bar.parentNode, pct, loc].forEach(function(el){ if (el) el.classList.toggle('none', none); });
    var p = none ? 0 : Math.max(0, Math.min(100, screen.scrollTop / max * 100));
    var t = Math.round(p) + '%';
    if (bar) bar.style.width = p + '%';
    if (pct) pct.textContent = t;
    if (loc) loc.textContent = t;
  }
  if (screen){ screen.addEventListener('scroll', tick, {passive:true}); addEventListener('resize', tick); tick(); }

  /* ---- page turn: the text fades out before the next page draws ---- */
  document.addEventListener('click', function(e){
    var a = e.target.closest('a[href]'); if (!a) return;
    if (a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname) return;
    if (reduced) return;
    e.preventDefault();
    root.classList.add('leaving');
    setTimeout(function(){ location.href = a.href; }, 170);
  });
  /* Back/Forward can restore this page from memory with the text still faded out */
  addEventListener('pageshow', function(){ root.classList.remove('leaving'); });

  /* ---- images: pushed to 16 grey levels, as an e-ink panel would draw them ---- */
  document.querySelectorAll('img[data-eink]').forEach(function(img){
    img.dataset.color = img.currentSrc || img.src;   /* the colour original, kept for the lightbox */
    function toEink(){
      try{
        var c = document.createElement('canvas'), w = c.width = img.naturalWidth, h = c.height = img.naturalHeight;
        var x = c.getContext('2d'); x.drawImage(img, 0, 0);
        var d = x.getImageData(0, 0, w, h), px = d.data;
        for (var i = 0; i < px.length; i += 4){
          var g = px[i]*.299 + px[i+1]*.587 + px[i+2]*.114;
          g = Math.round(g / 17) * 17;               /* 16 levels */
          px[i] = px[i+1] = px[i+2] = g;
        }
        x.putImageData(d, 0, 0);
        img.src = c.toDataURL('image/jpeg', .9);
        img.removeAttribute('data-eink');
        img.classList.add('eink');
      }catch(err){ /* cross-origin or too large: leave the photo as it is */ }
    }
    if (img.complete && img.naturalWidth) toEink(); else img.addEventListener('load', toEink, {once:true});
  });

  /* ---- the panel cannot show colour, so a tap lifts the photograph off it ---- */
  var box = document.createElement('div'); box.id = 'lightbox'; box.hidden = true;
  box.innerHTML = '<figure><img alt=""><figcaption></figcaption></figure><button type="button" class="x" aria-label="Close">×</button>';
  document.body.appendChild(box);
  var boxImg = box.querySelector('img'), boxCap = box.querySelector('figcaption');
  function openBox(img){
    var fig = img.closest('figure'), cap = fig && fig.querySelector('figcaption');
    boxImg.src = img.dataset.color || img.src; boxImg.alt = img.alt || '';
    boxCap.textContent = cap ? cap.textContent : ''; boxCap.hidden = !boxCap.textContent;
    box.hidden = false; document.body.classList.add('boxed'); box.querySelector('.x').focus();
  }
  function closeBox(){ if (box.hidden) return; box.hidden = true; document.body.classList.remove('boxed'); }
  document.addEventListener('click', function(e){
    var img = e.target.closest('.prose img'); if (!img || !img.dataset.color) return;
    e.preventDefault(); openBox(img);
  });
  box.addEventListener('click', closeBox);
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeBox(); });
})();

/* ---- shelf: regroup the covers by course or by type, as a reader's library does ---- */
(function(){
  var shelf = document.querySelector('.shelf'); if (!shelf) return;
  var books = Array.prototype.slice.call(shelf.querySelectorAll('.book'));
  var order = { course: (shelf.dataset.courses || '').split('|'), type: (shelf.dataset.types || '').split('|') };
  var other = { course: 'type', type: 'course' };
  function slug(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function arrange(by){
    Array.prototype.slice.call(shelf.querySelectorAll('.shelf-group')).forEach(function(g){ g.remove(); });
    order[by].forEach(function(name){
      var mine = books.filter(function(b){ return b.dataset[by] === name; });
      if (!mine.length) return;
      mine.sort(function(a, b){ return order[other[by]].indexOf(a.dataset[other[by]]) - order[other[by]].indexOf(b.dataset[other[by]]); });
      var sec = document.createElement('section'); sec.className = 'shelf-group';
      var h = document.createElement('h2'); h.id = slug(name); h.textContent = name;
      var ul = document.createElement('ul'); ul.className = 'books';
      mine.forEach(function(b){ ul.appendChild(b); });
      sec.appendChild(h); sec.appendChild(ul); shelf.appendChild(sec);
    });
    Array.prototype.slice.call(shelf.querySelectorAll('.shelf-bar button')).forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.by === by)); });
    try { localStorage.setItem('rd-shelf', by); } catch (e) {}
  }
  shelf.addEventListener('click', function(e){ var b = e.target.closest('.shelf-bar button'); if (b) arrange(b.dataset.by); });
  try { if (localStorage.getItem('rd-shelf') === 'type') arrange('type'); } catch (e) {}
})();
