/* 공부 도구: 형광펜 · 직접 그리기 · 아무 데나 붙이는 메모장 · 사진 · 복습 필요 표시.
   모든 데이터는 이 브라우저에만 저장됨 (글자: localStorage, 사진: IndexedDB).
   - 글자 드래그 → 형광펜 색 / 🖍+📝 (칠하고 메모장 붙이기)
   - 오른쪽 아래 모드: ✋ 보통 · 🖍 형광펜 · ✏️ 그리기 · 🧽 지우개 · 📝 메모 붙이기
   - 메모장·섹션 메모: Ctrl+V 로 캡처 붙여넣기, 📷 버튼, 끌어다 놓기
   - 섹션 오른쪽 위 🔁 복습 → 목차·내 노트·홈 화면에 모아 보기 */
(function () {
  const COLORS = [['y', '노랑'], ['o', '주황'], ['g', '초록'], ['p', '분홍'], ['b', '파랑']];
  const STROKE = { y: '#d9a400', o: '#ff6f1e', g: '#16a34a', p: '#e83fb4', b: '#2563eb' };
  const SKIP = '.widget,.anim,.card-tools,.memo-box,.hl-note-mark,.ann-layer,script,style,button,select,input,textarea,svg';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const r1 = x => Math.round(x * 10) / 10;

  /* ---------- 사진 저장소 (IndexedDB, 안 되면 localStorage) ---------- */
  const IMG = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open('simnote-images', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('img');
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    }));
    const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
      const t = db.transaction('img', mode), req = fn(t.objectStore('img'));
      t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error);
    }));
    const toDataURL = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
    const urls = new Map();
    async function compress(file) {
      if (file.size < 350 * 1024) return file;
      try {
        const bmp = await createImageBitmap(file);
        const sc = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas');
        c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
        return await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
      } catch (e) { return file; }
    }
    return {
      async add(file) {
        const blob = await compress(file), id = uid('im');
        try { await tx('readwrite', s => s.put(blob, id)); }
        catch (e) { try { localStorage.setItem('simnote-img:' + id, await toDataURL(blob)); } catch (e2) { alert('사진을 저장할 공간이 부족해요. 오래된 사진을 지워 주세요.'); return null; } }
        return id;
      },
      async url(id) {
        if (urls.has(id)) return urls.get(id);
        let u = null;
        try { const b = await tx('readonly', s => s.get(id)); if (b) u = URL.createObjectURL(b); } catch (e) { }
        if (!u) u = localStorage.getItem('simnote-img:' + id);
        if (u) urls.set(id, u);
        return u;
      },
      del(id) {
        tx('readwrite', s => s.delete(id)).catch(() => { });
        try { localStorage.removeItem('simnote-img:' + id); } catch (e) { }
        const u = urls.get(id); if (u && u.startsWith('blob:')) URL.revokeObjectURL(u); urls.delete(id);
      },
    };
  })();
  const imageFiles = list => [...(list || [])].filter(f => f && f.type && f.type.startsWith('image/'));
  function lightbox(src) {
    const lb = document.createElement('div');
    lb.className = 'img-lb';
    lb.innerHTML = `<img src="${src}" alt=""><span class="lb-x">× 닫기</span>`;
    lb.onclick = () => lb.remove();
    document.body.appendChild(lb);
  }
  /* 썸네일 줄: ids 를 보여 주고, ×로 지우면 onRemove(id) */
  function drawThumbs(box, ids, onRemove) {
    box.innerHTML = '';
    box.hidden = !ids.length;
    ids.forEach(id => {
      const w = document.createElement('span'); w.className = 'thumb';
      w.innerHTML = '<img alt=""><button type="button" class="th-x" title="사진 지우기">×</button>';
      IMG.url(id).then(u => { if (u) w.querySelector('img').src = u; else w.remove(); });
      w.querySelector('img').onclick = e => { e.stopPropagation(); lightbox(w.querySelector('img').src); };
      w.querySelector('.th-x').onclick = e => { e.stopPropagation(); if (confirm('이 사진을 지울까요?')) onRemove(id); };
      box.appendChild(w);
    });
  }
  /* 입력칸/상자에 사진 붙여넣기·끌어다 놓기 연결 */
  function acceptImages(textarea, dropZone, onFiles) {
    textarea.addEventListener('paste', e => {
      const files = imageFiles([...(e.clipboardData?.items || [])].filter(i => i.kind === 'file').map(i => i.getAsFile()));
      if (!files.length) return;
      e.preventDefault(); onFiles(files);
    });
    dropZone.addEventListener('dragover', e => { if ([...(e.dataTransfer?.items || [])].some(i => i.kind === 'file')) { e.preventDefault(); dropZone.classList.add('drop-on'); } });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drop-on'));
    dropZone.addEventListener('drop', e => { dropZone.classList.remove('drop-on'); const f = imageFiles(e.dataTransfer?.files); if (f.length) { e.preventDefault(); onFiles(f); } });
  }
  function pickFiles(onFiles) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
    inp.onchange = () => onFiles(imageFiles(inp.files)); inp.click();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const ch = document.body.dataset.ch;
    if (!ch || !window.RL_STORE) return;
    const S = window.RL_STORE;
    const K = { hl: 'hl-' + ch, memo: 'memo-' + ch, mimg: 'memoimg-' + ch, ink: 'ink-' + ch, free: 'free-' + ch, rev: 'review-' + ch, txt: 'txt-' + ch };
    let hls = S.get(K.hl) || [];
    let memos = S.get(K.memo) || {};
    let memoImgs = S.get(K.mimg) || {};
    let inks = S.get(K.ink) || [];
    let frees = S.get(K.free) || [];
    let txts = S.get(K.txt) || [];
    let reviews = S.get(K.rev) || {};
    let curColor = S.get('hl-color') || 'y';
    let mode = S.get('tool-mode') || '';
    if (mode !== 'hl') mode = '';   // 그리기·지우개는 새로 열 때마다 꺼진 상태로 시작
    let notesHidden = !!S.get('notes-hidden');
    hls.forEach(h => { h.k = h.k || 'hl'; if (h.sticky === undefined) h.sticky = !!(h.n && h.n.trim()); h.imgs = h.imgs || []; });
    const saveHl = () => { S.set(K.hl, hls.map(({ lost, ...x }) => x)); refreshDock(); };
    const saveMemo = () => { S.set(K.memo, memos); S.set(K.mimg, memoImgs); refreshDock(); };
    const saveInk = () => { S.set(K.ink, inks); refreshDock(); };
    const saveFree = () => { S.set(K.free, frees); refreshDock(); };
    const saveTxt = () => { S.set(K.txt, txts.filter(x => (x.t || '').trim())); refreshDock(); };
    const saveRev = () => { S.set(K.rev, reviews); refreshDock(); };
    const sections = [...document.querySelectorAll('section.card[id]')];
    const secById = id => document.getElementById(id);
    const secTitle = id => { const s = secById(id); return s ? (s.dataset.toc || s.querySelector('h2')?.textContent.trim() || id) : id; };
    const pageFile = location.pathname.split('/').pop() || 'index.html';

    /* ---------- 텍스트 좌표계 (형광펜용) ---------- */
    function units(sec) {
      const out = []; let pos = 0;
      (function walk(n) {
        for (const c of n.childNodes) {
          if (c.nodeType === 3) { const L = c.nodeValue.length; if (L) { out.push({ node: c, type: 't', start: pos, end: pos + L }); pos += L; } }
          else if (c.nodeType === 1) {
            if (c.matches(SKIP)) continue;
            if (c.classList.contains('katex')) { out.push({ node: c, type: 'a', start: pos, end: pos + 1 }); pos += 1; continue; }
            walk(c);
          }
        }
      })(sec);
      out.total = pos;
      return out;
    }
    function matchText(us, s, e) {
      let r = '';
      for (const u of us) { if (u.end <= s || u.start >= e) continue; r += u.type === 'a' ? '§' : u.node.nodeValue.slice(Math.max(s, u.start) - u.start, Math.min(e, u.end) - u.start); }
      return r;
    }
    function dispText(us, s, e) {
      let r = '';
      for (const u of us) {
        if (u.end <= s || u.start >= e) continue;
        r += u.type === 'a' ? ' ' + (u.node.querySelector('annotation')?.textContent || '수식').trim() + ' ' : u.node.nodeValue.slice(Math.max(s, u.start) - u.start, Math.min(e, u.end) - u.start);
      }
      return r.replace(/\s+/g, ' ').trim();
    }
    function pointOff(us, node, off, isEnd) {
      for (const u of us) {
        if (u.type === 't' && u.node === node) return u.start + off;
        const r = document.createRange();
        if (u.type === 't') r.selectNodeContents(u.node); else r.selectNode(u.node);
        let c; try { c = r.comparePoint(node, off); } catch (e) { continue; }
        if (c < 0) return u.start;
        if (c === 0) {
          const e2 = r.cloneRange(); e2.collapse(false);
          if (e2.comparePoint(node, off) === 0) continue;
          if (u.type === 'a') { const s2 = r.cloneRange(); s2.collapse(true); return (isEnd && s2.comparePoint(node, off) !== 0) ? u.end : u.start; }
          return u.start;
        }
      }
      return us.total;
    }
    const markClass = h => h.k === 'circ' ? 'hl circ' : 'hl hl-' + h.c;
    function paint(h) {
      const sec = secById(h.sec); if (!sec) return false;
      const us = units(sec);
      if (matchText(us, h.s, h.e) !== h.t) { const idx = matchText(us, 0, us.total).indexOf(h.t); if (idx < 0) return false; h.s = idx; h.e = idx + h.t.length; }
      const segs = us.filter(u => u.end > h.s && u.start < h.e);
      const wrap = n => { const m = document.createElement('mark'); m.className = markClass(h); m.dataset.hid = h.id; n.parentNode.insertBefore(m, n); m.appendChild(n); return m; };
      let last = null;
      for (let i = segs.length - 1; i >= 0; i--) {
        const u = segs[i]; let n = u.node;
        if (u.type === 'a') { const m = wrap(n); if (!last) last = m; continue; }
        const s = Math.max(h.s, u.start) - u.start, e = Math.min(h.e, u.end) - u.start;
        if (!n.nodeValue.slice(s, e).trim()) continue;
        if (e < n.nodeValue.length) n.splitText(e);
        if (s > 0) n = n.splitText(s);
        const m = wrap(n); if (!last) last = m;
      }
      if (last) { const sup = document.createElement('sup'); sup.className = 'hl-note-mark'; sup.dataset.hid = h.id; sup.textContent = '📝'; last.after(sup); }
      return !!last;
    }
    function unpaint(id) {
      document.querySelectorAll(`.hl-note-mark[data-hid="${id}"]`).forEach(x => x.remove());
      document.querySelectorAll(`mark.hl[data-hid="${id}"]`).forEach(m => { const p = m.parentNode; while (m.firstChild) p.insertBefore(m.firstChild, m); m.remove(); p.normalize(); });
      document.querySelectorAll(`.ann-layer [data-hid="${id}"]`).forEach(x => x.remove());
    }
    hls.forEach(h => { h.lost = !paint(h); });

    /* ---------- 레이어 (그림·메모장이 올라가는 투명 판) ---------- */
    function layerOf(sec) {
      let L = sec.querySelector(':scope > .ann-layer');
      if (!L) {
        L = document.createElement('div'); L.className = 'ann-layer';
        L.innerHTML = '<svg class="ann-svg" xmlns="http://www.w3.org/2000/svg"></svg><svg class="ink-svg" xmlns="http://www.w3.org/2000/svg"></svg>';
        sec.appendChild(L);
      }
      return L;
    }
    function rnd(seed) { let x = 0; for (const c of seed) x = (x * 31 + c.charCodeAt(0)) >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
    function roughEllipse(b, seed) {
      const R = rnd(seed), cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2 + 12, ry = b.h / 2 + 8, pts = [], n = 14, a0 = -Math.PI * 0.75 + R() * 0.4;
      for (let i = 0; i <= n + 2; i++) { const a = a0 + (i / n) * Math.PI * 2, j = 1 + (R() - 0.5) * 0.09 + (i > n ? 0.06 : 0); pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]); }
      let d = `M${pts[0][0]} ${pts[0][1]}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
      }
      return d;
    }
    function bboxOf(h, sr) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      document.querySelectorAll(`mark.hl[data-hid="${h.id}"]`).forEach(m => { for (const r of m.getClientRects()) { if (!r.width && !r.height) continue; x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); } });
      return x0 === Infinity ? null : { x: x0 - sr.left, y: y0 - sr.top, w: x1 - x0, h: y1 - y0 };
    }
    function inkD(pts, sx) {
      const P = pts.map(([x, y]) => [x * sx, y]);
      if (P.length < 2) return `M${P[0][0]} ${P[0][1]} l0.1 0.1`;
      let d = `M${P[0][0]} ${P[0][1]}`;
      for (let i = 1; i < P.length - 1; i++) d += ` Q${P[i][0]} ${P[i][1]} ${(P[i][0] + P[i + 1][0]) / 2} ${(P[i][1] + P[i + 1][1]) / 2}`;
      const l = P[P.length - 1]; return d + ` L${l[0]} ${l[1]}`;
    }
    const SVGNS = 'http://www.w3.org/2000/svg';
    const svgEl = (tag, attrs) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

    /* ---------- 메모장(포스트잇) 하나 만들기: att = 형광펜에 붙은 것, free = 아무 데나 ---------- */
    function noteEl(o, L, kind) {
      let el = L.querySelector(`.sticky[data-nid="${o.id}"]`);
      if (el) return el;
      el = document.createElement('div');
      el.className = `sticky st-${o.c || 'y'}${kind === 'free' ? ' free' : ''}`;
      el.dataset.nid = o.id; el.dataset.hid = o.id;
      el.innerHTML = `<div class="st-bar"><span class="st-grip" title="끌어서 옮기기">⠿ 메모</span><button type="button" class="st-cam" title="사진 추가 (Ctrl+V 로 붙여넣기도 돼요)">📷</button><button type="button" class="st-min" title="접기">–</button><button type="button" class="st-del" title="메모장 떼기">×</button></div>
        <textarea placeholder="여기에 바로 적어요 · 캡처는 Ctrl+V"></textarea><div class="st-imgs" hidden></div>`;
      const ta = el.querySelector('textarea');
      ta.value = o.n || '';
      const save = () => { (kind === 'free' ? saveFree : saveHl)(); renderDrawer(); };
      const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.max(46, ta.scrollHeight) + 'px'; };
      let t;
      ta.addEventListener('input', () => { fit(); clearTimeout(t); t = setTimeout(() => { o.n = ta.value; save(); }, 350); });
      setTimeout(fit, 0);
      o.imgs = o.imgs || [];
      const thumbs = el.querySelector('.st-imgs');
      const redraw = () => drawThumbs(thumbs, o.imgs, id => { IMG.del(id); o.imgs = o.imgs.filter(x => x !== id); save(); redraw(); });
      const addFiles = async files => { for (const f of files) { const id = await IMG.add(f); if (id) o.imgs.push(id); } save(); redraw(); };
      redraw();
      acceptImages(ta, el, addFiles);
      el.querySelector('.st-cam').onclick = () => pickFiles(addFiles);
      el.querySelector('.st-min').onclick = () => { o.min = true; save(); layoutSec(secById(o.sec)); };
      el.querySelector('.st-del').onclick = () => {
        if (((o.n || '').trim() || o.imgs.length) && !confirm('이 메모장을 뗄까요? (적은 내용과 사진도 같이 지워져요)')) return;
        o.imgs.forEach(id => IMG.del(id));
        if (kind === 'free') { frees = frees.filter(x => x !== o); saveFree(); }
        else { o.sticky = false; o.n = ''; o.imgs = []; o.dx = o.dy = 0; saveHl(); }
        el.remove(); layoutSec(secById(o.sec)); renderDrawer();
      };
      const grip = el.querySelector('.st-bar');
      grip.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        e.preventDefault();
        const sec = secById(o.sec), sc = sec.getBoundingClientRect().width / (o.w0 || 1);
        const sx = e.clientX, sy = e.clientY;
        const a0 = kind === 'free' ? [o.x, o.y] : [o.dx || 0, o.dy || 0];
        grip.setPointerCapture(e.pointerId); el.classList.add('dragging');
        const mv = ev => {
          if (kind === 'free') { o.x = a0[0] + (ev.clientX - sx) / sc; o.y = a0[1] + ev.clientY - sy; }
          else { o.dx = a0[0] + ev.clientX - sx; o.dy = a0[1] + ev.clientY - sy; }
          layoutSec(sec);
        };
        const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); el.classList.remove('dragging'); save(); };
        grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up);
      });
      L.appendChild(el);
      return el;
    }
    function txtEl(x, L) {
      let el = L.querySelector(`.ann-text[data-tid="${x.id}"]`);
      if (el) return el;
      el = document.createElement('div');
      el.className = 'ann-text'; el.dataset.tid = x.id;
      el.style.color = STROKE[x.c] || STROKE.o;
      el.innerHTML = '<span class="at-grip" title="끌어서 옮기기">⠿</span><div class="at-body" contenteditable="true" spellcheck="false"></div>';
      const body = el.querySelector('.at-body');
      body.textContent = x.t || '';
      let tm;
      body.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { x.t = body.innerText; saveTxt(); }, 300); });
      body.addEventListener('blur', () => {
        x.t = body.innerText;
        if (!x.t.trim()) { txts = txts.filter(y => y !== x); el.remove(); }
        saveTxt();
      });
      const grip = el.querySelector('.at-grip');
      grip.addEventListener('pointerdown', e => {
        e.preventDefault();
        const sec = secById(x.sec), sc = sec.getBoundingClientRect().width / (x.w0 || 1);
        const sx = e.clientX, sy = e.clientY, a0 = [x.x, x.y];
        grip.setPointerCapture(e.pointerId);
        const mv = ev => { x.x = a0[0] + (ev.clientX - sx) / sc; x.y = a0[1] + ev.clientY - sy; layoutSec(sec); };
        const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); saveTxt(); };
        grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up);
      });
      L.appendChild(el);
      return el;
    }
    function miniEl(o, L) {
      let m = L.querySelector(`.st-mini[data-nid="${o.id}"]`);
      if (m) return m;
      m = document.createElement('button'); m.type = 'button'; m.className = `st-mini st-${o.c || 'y'}`; m.dataset.nid = o.id; m.textContent = '📝'; m.title = (o.n || '').slice(0, 80) || '메모 펼치기';
      m.onclick = () => { o.min = false; saveFree(); if (notesHidden) { notesHidden = false; S.set('notes-hidden', false); refreshDock(); } layoutSec(secById(o.sec)); };
      L.appendChild(m);
      return m;
    }

    function layoutSec(sec) {
      if (!sec) return;
      const L = layerOf(sec), svg = L.querySelector('.ann-svg'), isvg = L.querySelector('.ink-svg');
      const sr = sec.getBoundingClientRect();
      if (!sr.width) return;
      [svg, isvg].forEach(s => { s.setAttribute('width', sr.width); s.setAttribute('height', sr.height); });
      svg.innerHTML = ''; isvg.innerHTML = '';
      // 손그림
      for (const k of inks.filter(k => k.sec === sec.id)) {
        isvg.appendChild(svgEl('path', { d: inkD(k.pts, sr.width / k.w0), fill: 'none', stroke: STROKE[k.c] || STROKE.o, 'stroke-width': k.sz || 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-ink': k.id }));
      }
      // 형광펜/옛날 동그라미 + 거기 붙은 메모장
      const mine = hls.filter(h => h.sec === sec.id && !h.lost);
      const keep = new Set();
      for (const h of mine) {
        const b = bboxOf(h, sr);
        const sup = sec.querySelector(`.hl-note-mark[data-hid="${h.id}"]`);
        const show = h.sticky && !h.min && !notesHidden;
        if (sup) sup.style.display = (h.sticky && !show) ? '' : 'none';
        if (!b) continue;
        if (h.k === 'circ') svg.appendChild(svgEl('path', { d: roughEllipse(b, h.id), fill: 'none', stroke: STROKE[h.c] || STROKE.o, 'stroke-width': 2.6, 'stroke-linecap': 'round' }));
        if (!show) continue;
        keep.add(h.id);
        const el = noteEl(h, L, 'att'); el.hidden = false;
        const w = el.offsetWidth || 220, hh = el.offsetHeight || 90;
        let left = Math.max(-40, Math.min(sr.width - w + 40, b.x + b.w / 2 - 30 + (h.dx || 0)));
        const top = b.y - hh - 26 + (h.dy || 0);
        el.style.left = left + 'px'; el.style.top = top + 'px';
        const ax = Math.min(Math.max(left + 24, b.x), b.x + b.w), ay = b.y - (h.k === 'circ' ? 8 : 2), fx = left + 24, fy = top + hh - 4;
        svg.appendChild(svgEl('path', { d: `M${fx} ${fy} Q${(fx + ax) / 2} ${(fy + ay) / 2 + 10} ${ax} ${ay}`, fill: 'none', stroke: '#8a6d00', 'stroke-width': 1.4, 'stroke-dasharray': '4 3' }));
        svg.appendChild(svgEl('circle', { cx: ax, cy: ay, r: 3.5, fill: STROKE[h.c] || STROKE.o }));
      }
      // 아무 데나 붙인 메모장
      for (const f of frees.filter(f => f.sec === sec.id)) {
        const sc = sr.width / (f.w0 || sr.width), x = f.x * sc, y = f.y;
        if (notesHidden || f.min) { const m = miniEl(f, L); m.style.left = x + 'px'; m.style.top = y + 'px'; continue; }
        keep.add(f.id);
        const el = noteEl(f, L, 'free'); el.hidden = false;
        el.style.left = x + 'px'; el.style.top = y + 'px';
      }
      // 아무 데나 적은 글자
      const tkeep = new Set();
      for (const x of txts.filter(x => x.sec === sec.id)) {
        tkeep.add(x.id);
        const el = txtEl(x, L), sc = sr.width / (x.w0 || sr.width);
        el.style.left = x.x * sc + 'px'; el.style.top = x.y + 'px';
      }
      L.querySelectorAll('.ann-text').forEach(t => { if (!tkeep.has(t.dataset.tid)) t.remove(); });
      L.querySelectorAll('.sticky').forEach(s => { if (!keep.has(s.dataset.nid)) s.remove(); });
      L.querySelectorAll('.st-mini').forEach(m => { const f = frees.find(x => x.id === m.dataset.nid); if (!f || !(notesHidden || f.min)) m.remove(); });
    }
    let tmr = 0;
    const layoutAll = () => { clearTimeout(tmr); tmr = setTimeout(() => sections.forEach(layoutSec), 30); };
    const ro = new ResizeObserver(layoutAll);
    sections.forEach(s => ro.observe(s));
    addEventListener('resize', layoutAll);
    document.addEventListener('toggle', layoutAll, true);
    document.fonts && document.fonts.ready.then(layoutAll);
    setTimeout(layoutAll, 600); setTimeout(layoutAll, 2000);

    /* ---------- 직접 그리기 · 지우개 · 메모 붙이기 ---------- */
    const undo = [];
    const blockTarget = t => t.closest('.card-tools,.ann-text,.sticky,.st-mini,.memo-box,.note-dock,.note-drawer,.hl-pop,.img-lb,input,textarea,select,button,a');
    function secAt(e) { const s = e.target.closest && e.target.closest('section.card[id]'); return s && sections.includes(s) ? s : null; }
    let drawing = null;
    document.addEventListener('pointerdown', e => {
      if (!mode || mode === 'hl' || e.button > 0) return;
      const sec = secAt(e);
      if (!sec || blockTarget(e.target)) return;
      e.preventDefault();
      const sr = sec.getBoundingClientRect(), p = [r1(e.clientX - sr.left), r1(e.clientY - sr.top)];
      if (mode === 'text') {
        const x = { id: uid('tx'), sec: sec.id, x: p[0] - 4, y: p[1] - 12, w0: sr.width, t: '', c: curColor };
        txts.push(x); layoutSec(sec);
        const el = sec.querySelector(`.ann-text[data-tid="${x.id}"] .at-body`);
        if (el) setTimeout(() => el.focus({ preventScroll: true }), 20);
        return;
      }
      if (mode === 'note') {
        const f = { id: uid('fn'), sec: sec.id, x: p[0] - 20, y: p[1] - 18, w0: sr.width, n: '', c: curColor, imgs: [] };
        frees.push(f); saveFree(); setMode('');
        layoutSec(sec);
        const el = sec.querySelector(`.sticky[data-nid="${f.id}"]`);
        if (el) setTimeout(() => el.querySelector('textarea').focus({ preventScroll: true }), 30);
        renderDrawer();
        return;
      }
      try { sec.setPointerCapture(e.pointerId); } catch (err) { /* 캡처가 안 돼도 그리기는 계속 */ }
      if (mode === 'draw') {
        const k = { id: uid('ik'), sec: sec.id, w0: r1(sr.width), c: curColor, sz: 3, pts: [p] };
        const path = svgEl('path', { d: inkD(k.pts, 1), fill: 'none', stroke: STROKE[k.c], 'stroke-width': k.sz, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
        layerOf(sec).querySelector('.ink-svg').appendChild(path);
        drawing = { sec, k, path, sr };
      } else if (mode === 'erase') {
        drawing = { sec, erase: true };
        eraseAt(sec, e);
      }
    });
    document.addEventListener('pointermove', e => {
      if (!drawing) return;
      if (drawing.erase) return eraseAt(drawing.sec, e);
      const sr = drawing.sec.getBoundingClientRect(), p = [r1(e.clientX - sr.left), r1(e.clientY - sr.top)], last = drawing.k.pts[drawing.k.pts.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 2.5) return;
      drawing.k.pts.push(p);
      drawing.path.setAttribute('d', inkD(drawing.k.pts, 1));
    });
    const endDraw = () => {
      if (!drawing) return;
      if (!drawing.erase) { inks.push(drawing.k); undo.push(drawing.k.id); saveInk(); renderDrawer(); }
      drawing = null;
    };
    document.addEventListener('pointerup', endDraw);
    document.addEventListener('pointercancel', endDraw);
    function eraseAt(sec, e) {
      const sr = sec.getBoundingClientRect(), x = e.clientX - sr.left, y = e.clientY - sr.top;
      const before = inks.length;
      inks = inks.filter(k => {
        if (k.sec !== sec.id) return true;
        const sx = sr.width / k.w0;
        return !k.pts.some(([px, py]) => Math.hypot(px * sx - x, py - y) < 12);
      });
      if (inks.length !== before) { saveInk(); layoutSec(sec); renderDrawer(); }
    }
    function undoInk() {
      const id = undo.pop() || (inks.length ? inks[inks.length - 1].id : null);
      if (!id) return;
      const k = inks.find(x => x.id === id); inks = inks.filter(x => x.id !== id); saveInk();
      if (k) layoutSec(secById(k.sec)); renderDrawer();
    }

    /* ---------- 형광펜 팝업 ---------- */
    const pop = document.createElement('div');
    pop.className = 'hl-pop'; pop.hidden = true;
    document.body.appendChild(pop);
    let pending = null;
    const dots = active => COLORS.map(([c, nm]) => `<button type="button" class="dot hl-${c}${c === active ? ' on' : ''}" data-c="${c}" title="${nm}"></button>`).join('');
    function place(rect) {
      pop.hidden = false;
      const w = pop.offsetWidth, x = Math.max(8, Math.min(innerWidth - w - 8, rect.left + rect.width / 2 - w / 2));
      pop.style.left = (x + scrollX) + 'px'; pop.style.top = (rect.bottom + scrollY + 10) + 'px';
    }
    const hidePop = () => { pop.hidden = true; pop.innerHTML = ''; };
    function showSelPop(rect) {
      pop.innerHTML = `<div class="row">${dots(curColor)}<span class="sep"></span><button type="button" class="txt" data-act="hlnote">🖍 + 📝 메모장</button></div>`;
      pop.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.c) { curColor = b.dataset.c; S.set('hl-color', curColor); create(false); refreshDock(); }
        else if (b.dataset.act === 'hlnote') create(true);
      };
      place(rect);
    }
    function showMarkPop(h, rect) {
      const isC = h.k === 'circ';
      pop.innerHTML = `<div class="row">${dots(h.c)}<span class="sep"></span>
        ${isC ? '<button type="button" class="txt" data-act="kind">🖍 형광펜으로</button>' : ''}
        <button type="button" class="txt" data-act="note">${h.sticky ? '📝 메모 펼치기' : '📝 메모장 붙이기'}</button>
        <button type="button" class="txt del" data-act="del">지우기</button></div>`;
      pop.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.c) { h.c = b.dataset.c; restyle(h); saveHl(); showMarkPop(h, rect); }
        else if (b.dataset.act === 'kind') { h.k = 'hl'; restyle(h); saveHl(); hidePop(); }
        else if (b.dataset.act === 'note') { openSticky(h); hidePop(); }
        else if (b.dataset.act === 'del') { (h.imgs || []).forEach(id => IMG.del(id)); unpaint(h.id); hls = hls.filter(x => x !== h); saveHl(); hidePop(); renderDrawer(); layoutSec(secById(h.sec)); }
      };
      place(rect);
    }
    function restyle(h) {
      document.querySelectorAll(`mark.hl[data-hid="${h.id}"]`).forEach(m => { m.className = markClass(h); });
      const st = document.querySelector(`.sticky[data-nid="${h.id}"]`); if (st) st.className = 'sticky st-' + h.c;
      layoutSec(secById(h.sec)); renderDrawer();
    }
    function openSticky(h) {
      h.sticky = true; h.min = false;
      if (notesHidden) { notesHidden = false; S.set('notes-hidden', false); refreshDock(); }
      saveHl();
      const sec = secById(h.sec); layoutSec(sec);
      const el = sec.querySelector(`.sticky[data-nid="${h.id}"]`);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => el.querySelector('textarea').focus({ preventScroll: true }), 300); }
      renderDrawer();
    }
    function create(withNote) {
      if (!pending) return;
      const sec = secById(pending.sec), us = units(sec);
      const h = { id: uid('h'), sec: pending.sec, s: pending.s, e: pending.e, k: 'hl', c: curColor, t: matchText(us, pending.s, pending.e), d: dispText(us, pending.s, pending.e), n: '', sticky: false, imgs: [] };
      pending = null; getSelection().removeAllRanges(); hidePop();
      if (!h.t.trim() || !paint(h)) return;
      hls.push(h); saveHl(); renderDrawer();
      if (withNote) openSticky(h); else layoutSec(sec);
    }
    function onSelection() {
      if (mode && mode !== 'hl') return;
      const sel = getSelection();
      if (!sel.rangeCount || sel.isCollapsed) return;
      const r = sel.getRangeAt(0);
      const secOf = n => (n.nodeType === 1 ? n : n.parentElement)?.closest('section.card[id]');
      const sec = secOf(r.startContainer);
      if (!sec || sec !== secOf(r.endContainer)) return;
      const ca = r.commonAncestorContainer;
      if ((ca.nodeType === 1 ? ca : ca.parentElement).closest(SKIP)) return;
      const us = units(sec), s = pointOff(us, r.startContainer, r.startOffset, false), e = pointOff(us, r.endContainer, r.endOffset, true);
      if (e <= s) return;
      pending = { sec: sec.id, s, e };
      if (mode === 'hl') create(false); else showSelPop(r.getBoundingClientRect());
    }
    const ignoreTarget = t => t.closest('.hl-pop,.note-dock,.note-drawer,.memo-box,.widget,.anim,.card-tools,.ann-layer,.img-lb,input,textarea,select');
    document.addEventListener('mouseup', e => { if (!ignoreTarget(e.target)) setTimeout(onSelection, 0); });
    document.addEventListener('touchend', e => { if (!ignoreTarget(e.target)) setTimeout(onSelection, 250); });
    document.addEventListener('mousedown', e => { if (!pop.hidden && !e.target.closest('.hl-pop')) hidePop(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { hidePop(); closeDrawer(); if (mode) setMode(''); document.querySelector('.img-lb')?.remove(); } });
    document.addEventListener('click', e => {
      if (mode === 'draw' || mode === 'erase') return;
      const sup = e.target.closest('.hl-note-mark');
      if (sup) { const h = hls.find(x => x.id === sup.dataset.hid); if (h) openSticky(h); return; }
      const m = e.target.closest('mark.hl');
      if (!m || !getSelection().isCollapsed) return;
      const h = hls.find(x => x.id === m.dataset.hid);
      if (h) { e.preventDefault(); setTimeout(() => showMarkPop(h, m.getBoundingClientRect()), 0); }
    });

    /* ---------- 섹션마다: 🔁 복습 · ✎ 메모(+사진) ---------- */
    sections.forEach(sec => {
      let tools = sec.querySelector(':scope > .card-tools');
      if (!tools) { tools = document.createElement('div'); tools.className = 'card-tools'; sec.appendChild(tools); }
      // 섹션 메모
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'memo-btn'; btn.textContent = '✎ 메모';
      tools.prepend(btn);
      // 복습 필요
      const rb = document.createElement('button');
      rb.type = 'button'; rb.className = 'rev-btn'; rb.title = '복습이 필요한 섹션으로 표시';
      tools.prepend(rb);
      const syncRev = () => {
        const on = !!reviews[sec.id];
        rb.classList.toggle('on', on); rb.textContent = on ? '🔁 복습 필요' : '🔁 복습';
        sec.classList.toggle('needs-review', on);
        document.querySelector(`.toc a[data-id="${sec.id}"]`)?.classList.toggle('rev', on);
      };
      rb.onclick = () => {
        if (reviews[sec.id]) delete reviews[sec.id];
        else reviews[sec.id] = { t: secTitle(sec.id), page: pageFile, at: Date.now() };
        saveRev(); syncRev(); renderDrawer();
      };
      syncRev();

      let box = null;
      const hasMemo = () => !!(memos[sec.id] || '').trim() || !!(memoImgs[sec.id] || []).length;
      const sync = () => btn.classList.toggle('has', hasMemo());
      function open(focus) {
        if (!box) {
          box = document.createElement('div');
          box.className = 'memo-box';
          box.innerHTML = `<div class="memo-head"><span>내 메모</span><span class="memo-saved"></span><button type="button" class="memo-cam" title="사진 추가">📷 사진</button><button type="button" class="memo-close" title="닫기">×</button></div>
            <textarea placeholder="헷갈린 점, 외울 것, 교수님이 강조한 것… (캡처는 Ctrl+V, 사진은 끌어다 놓기)"></textarea><div class="memo-imgs" hidden></div>`;
          sec.insertBefore(box, tools);
          const ta = box.querySelector('textarea');
          ta.value = memos[sec.id] || '';
          const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.max(80, ta.scrollHeight + 2) + 'px'; };
          const saved = txt => { box.querySelector('.memo-saved').textContent = txt; };
          let t;
          ta.addEventListener('input', () => {
            fit(); clearTimeout(t); saved('…');
            t = setTimeout(() => { if (ta.value.trim()) memos[sec.id] = ta.value; else delete memos[sec.id]; saveMemo(); sync(); renderDrawer(); saved('저장됨 ✓'); }, 400);
          });
          const strip = box.querySelector('.memo-imgs');
          const redraw = () => drawThumbs(strip, memoImgs[sec.id] || [], id => {
            IMG.del(id); memoImgs[sec.id] = (memoImgs[sec.id] || []).filter(x => x !== id);
            if (!memoImgs[sec.id].length) delete memoImgs[sec.id];
            saveMemo(); sync(); redraw(); renderDrawer();
          });
          const addFiles = async files => {
            saved('사진 저장 중…');
            for (const f of files) { const id = await IMG.add(f); if (id) (memoImgs[sec.id] = memoImgs[sec.id] || []).push(id); }
            saveMemo(); sync(); redraw(); renderDrawer(); saved('저장됨 ✓');
          };
          acceptImages(ta, box, addFiles);
          box.querySelector('.memo-cam').onclick = () => pickFiles(addFiles);
          box.querySelector('.memo-close').onclick = () => { box.hidden = true; };
          redraw();
          setTimeout(fit, 0);
        }
        box.hidden = false;
        if (focus) box.querySelector('textarea').focus();
      }
      btn.onclick = () => { if (box && !box.hidden) box.hidden = true; else open(true); };
      if (hasMemo()) open(false);
      sec._openMemo = open;
      sync();
    });

    /* ---------- 오른쪽 아래 도구 ---------- */
    const MODES = [['', '✋', '보통 (글자 드래그하면 색 고르기)'], ['hl', '🖍', '형광펜: 드래그하자마자 칠하기'], ['draw', '✏️', '그리기: 동그라미·밑줄 직접 그리기'], ['erase', '🧽', '지우개: 그린 선 위를 문지르기'], ['text', 'T', '글자 쓰기: 원하는 곳을 클릭하고 바로 타이핑'], ['note', '📝', '메모 붙이기: 원하는 곳을 클릭']];
    const dock = document.createElement('div');
    dock.className = 'note-dock';
    dock.innerHTML = `<span class="dock-modes">${MODES.map(([m, ic, tt]) => `<button type="button" class="dm" data-m="${m}" title="${tt}">${ic}</button>`).join('')}</span>
      <span class="dock-colors">${dots(curColor)}</span>
      <button type="button" class="dock-undo" title="방금 그린 선 되돌리기">↶</button>
      <button type="button" class="dock-show" title="메모장 보이기/숨기기"></button>
      <button type="button" class="dock-open">📒 내 노트 <span class="cnt"></span></button>
      <div class="dock-hint"></div>`;
    document.body.appendChild(dock);
    function setMode(m) { mode = m; if (m !== 'note' && m !== 'text') S.set('tool-mode', m); refreshDock(); }
    dock.querySelector('.dock-modes').onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; setMode(mode === b.dataset.m && b.dataset.m ? '' : b.dataset.m); };
    dock.querySelector('.dock-colors').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; curColor = b.dataset.c; S.set('hl-color', curColor); refreshDock(); };
    dock.querySelector('.dock-undo').onclick = undoInk;
    dock.querySelector('.dock-show').onclick = () => { notesHidden = !notesHidden; S.set('notes-hidden', notesHidden); refreshDock(); layoutAll(); };
    dock.querySelector('.dock-open').onclick = () => (drawer.classList.contains('open') ? closeDrawer() : openDrawer());
    function refreshDock() {
      dock.querySelectorAll('.dm').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
      ['hl', 'draw', 'erase', 'note', 'text'].forEach(m => document.body.classList.toggle('mode-' + m, mode === m));
      document.body.classList.toggle('pen-mode', mode === 'hl');
      dock.querySelector('.dock-undo').hidden = !(mode === 'draw' || mode === 'erase');
      dock.querySelector('.dock-show').textContent = notesHidden ? '📝 숨김' : '📝 보임';
      dock.querySelector('.dock-show').classList.toggle('off', notesHidden);
      dock.querySelectorAll('.dock-colors .dot').forEach(d => d.classList.toggle('on', d.dataset.c === curColor));
      const hint = { hl: '🖍 형광펜 모드 · 글자를 드래그하면 바로 칠해져요', draw: '✏️ 그리기 모드 · 본문 위에 마우스/펜으로 그려요 (Esc 로 끝)', erase: '🧽 지우개 · 지울 선 위를 문질러요', note: '📝 메모장을 붙일 곳을 클릭하세요', text: 'T 글자 모드 · 원하는 곳을 클릭하고 바로 타이핑 (비우면 사라져요, ⠿ 로 옮기기)' }[mode] || '';
      const hb = dock.querySelector('.dock-hint'); hb.textContent = hint; hb.hidden = !hint;
      const n = hls.length + Object.keys(memos).length + frees.length + txts.length + Object.keys(reviews).length;
      dock.querySelector('.cnt').textContent = n ? n : '';
    }

    /* ---------- 내 노트 모아보기 ---------- */
    const drawer = document.createElement('aside');
    drawer.className = 'note-drawer';
    document.body.appendChild(drawer);
    function openDrawer() { renderDrawer(); drawer.classList.add('open'); }
    function closeDrawer() { drawer.classList.remove('open'); }
    function renderDrawer() {
      const order = sections.map(s => s.id);
      const ids = [...new Set([...Object.keys(memos), ...Object.keys(memoImgs), ...hls.map(h => h.sec), ...frees.map(f => f.sec), ...inks.map(k => k.sec), ...Object.keys(reviews)])]
        .filter(id => order.includes(id)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
      const revs = order.filter(id => reviews[id]);
      const body = ids.map(id => {
        const m = (memos[id] || '').trim(), mi = (memoImgs[id] || []).length;
        const hs = hls.filter(h => h.sec === id).sort((a, b) => a.s - b.s);
        const fs = frees.filter(f => f.sec === id), ink = inks.filter(k => k.sec === id).length;
        return `<div class="nd-sec"><a href="#${id}" class="nd-title" data-jump="${id}">${esc(secTitle(id))}</a>${reviews[id] ? ' <span class="rev-chip">🔁 복습</span>' : ''}
          ${m || mi ? `<div class="nd-memo" data-memo="${id}">${esc(m)}${mi ? `<div class="nd-imgs">📷 사진 ${mi}장</div>` : ''}</div>` : ''}
          ${hs.map(h => `<div class="nd-hl"><span class="chip ${h.k === 'circ' ? 'circ-chip' : 'hl-' + h.c}" style="${h.k === 'circ' ? 'border-color:' + STROKE[h.c] : ''}"></span><div><a href="#" data-hl="${h.id}" class="nd-q">${esc(h.d.length > 140 ? h.d.slice(0, 140) + '…' : h.d)}</a>${h.lost ? ' <i class="lost">(위치를 못 찾음)</i>' : ''}${(h.n || '').trim() ? `<div class="nd-note">📝 ${esc(h.n.trim())}</div>` : ''}${(h.imgs || []).length ? `<div class="nd-imgs">📷 ${h.imgs.length}장</div>` : ''}</div><button type="button" class="x" data-del="${h.id}" title="지우기">×</button></div>`).join('')}
          ${fs.map(f => `<div class="nd-hl"><span class="chip hl-${f.c || 'y'}" style="border-radius:3px"></span><div><a href="#" data-free="${f.id}" class="nd-q">📌 ${esc((f.n || '').trim() || '(빈 메모장)')}</a>${(f.imgs || []).length ? `<div class="nd-imgs">📷 ${f.imgs.length}장</div>` : ''}</div></div>`).join('')}
          ${ink ? `<div class="nd-ink">✏️ 그림 ${ink}개 <button type="button" class="linkbtn" data-clearink="${id}">이 섹션 그림 지우기</button></div>` : ''}
        </div>`;
      }).join('');
      drawer.innerHTML = `<div class="nd-head"><span class="nd-h">이 장의 내 노트</span><button type="button" class="pill small" data-act="copy">텍스트로 복사</button><button type="button" class="nd-close" title="닫기">×</button></div>
        <div class="nd-body">
          ${revs.length ? `<div class="nd-rev"><b>🔁 복습 필요 ${revs.length}개</b>${revs.map(id => `<a href="#${id}" data-jump="${id}">${esc(secTitle(id))}</a>`).join('')}</div>` : ''}
          ${body || '<p class="nd-empty">아직 아무것도 없어요.<br>글자를 드래그해서 형광펜을 칠하거나, 오른쪽 아래 ✏️ 로 직접 그리거나, 📝 로 메모장을 붙여 보세요. 섹션 오른쪽 위 <b>🔁 복습</b>·<b>✎ 메모</b> 버튼도 있어요.</p>'}
        </div>
        ${hls.length || inks.length ? `<div class="nd-foot">${hls.length ? '<button type="button" class="pill small" data-act="clear">형광펜 모두 지우기</button>' : ''}${inks.length ? '<button type="button" class="pill small" data-act="clearink">그림 모두 지우기</button>' : ''}</div>` : ''}`;
    }
    drawer.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('.nd-close')) return closeDrawer();
      if (t.closest('[data-jump]')) { if (innerWidth < 900) closeDrawer(); return; }
      const memo = t.closest('[data-memo]');
      if (memo) { const sec = secById(memo.dataset.memo); sec.scrollIntoView({ block: 'start' }); sec._openMemo && sec._openMemo(true); if (innerWidth < 900) closeDrawer(); return; }
      const q = t.closest('[data-hl]');
      if (q) {
        e.preventDefault();
        const m = document.querySelector(`mark.hl[data-hid="${q.dataset.hl}"]`);
        if (m) { m.scrollIntoView({ block: 'center' }); document.querySelectorAll(`mark.hl[data-hid="${q.dataset.hl}"]`).forEach(x => { x.classList.remove('flash'); void x.offsetWidth; x.classList.add('flash'); }); }
        if (innerWidth < 900) closeDrawer(); return;
      }
      const fq = t.closest('[data-free]');
      if (fq) {
        e.preventDefault();
        const f = frees.find(x => x.id === fq.dataset.free);
        if (f) { f.min = false; if (notesHidden) { notesHidden = false; S.set('notes-hidden', false); refreshDock(); } saveFree(); const sec = secById(f.sec); layoutSec(sec); sec.querySelector(`.sticky[data-nid="${f.id}"]`)?.scrollIntoView({ block: 'center' }); }
        if (innerWidth < 900) closeDrawer(); return;
      }
      const del = t.closest('[data-del]');
      if (del) { const h = hls.find(x => x.id === del.dataset.del); (h?.imgs || []).forEach(id => IMG.del(id)); unpaint(del.dataset.del); hls = hls.filter(x => x.id !== del.dataset.del); saveHl(); renderDrawer(); h && layoutSec(secById(h.sec)); return; }
      const ci = t.closest('[data-clearink]');
      if (ci && confirm('이 섹션에 그린 선을 모두 지울까요?')) { inks = inks.filter(k => k.sec !== ci.dataset.clearink); saveInk(); layoutSec(secById(ci.dataset.clearink)); renderDrawer(); return; }
      const act = t.closest('[data-act]')?.dataset.act;
      if (act === 'clear' && confirm('이 장의 형광펜(과 거기 붙은 메모장)을 모두 지울까요? 섹션 메모·붙인 메모장·그림은 남아요.')) { hls.forEach(h => { (h.imgs || []).forEach(id => IMG.del(id)); unpaint(h.id); }); hls = []; saveHl(); renderDrawer(); layoutAll(); }
      if (act === 'clearink' && confirm('이 장에 그린 선을 모두 지울까요?')) { inks = []; saveInk(); renderDrawer(); layoutAll(); }
      if (act === 'copy') {
        const ids = [...new Set([...Object.keys(memos), ...Object.keys(memoImgs), ...hls.map(h => h.sec), ...frees.map(f => f.sec), ...Object.keys(reviews)])];
        const txt = [`[${document.title}] 내 노트`, ''].concat(ids.map(id => {
          const lines = [`■ ${secTitle(id)}${reviews[id] ? '  🔁 복습 필요' : ''}`];
          if ((memos[id] || '').trim()) lines.push('메모: ' + memos[id].trim());
          if ((memoImgs[id] || []).length) lines.push(`[사진 ${memoImgs[id].length}장]`);
          hls.filter(h => h.sec === id).forEach(h => lines.push(`- “${h.d}”` + ((h.n || '').trim() ? `  → ${h.n.trim()}` : '') + ((h.imgs || []).length ? ` [사진 ${h.imgs.length}장]` : '')));
          frees.filter(f => f.sec === id).forEach(f => lines.push(`📌 ${(f.n || '').trim() || '(빈 메모장)'}` + ((f.imgs || []).length ? ` [사진 ${f.imgs.length}장]` : '')));
          return lines.join('\n') + '\n';
        })).join('\n');
        const done = () => { t.closest('button').textContent = '복사됨 ✓'; setTimeout(renderDrawer, 1200); };
        (navigator.clipboard?.writeText(txt) || Promise.reject()).then(done, () => { prompt('아래 내용을 복사하세요', txt); });
      }
    });

    renderDrawer();
    refreshDock();
    layoutAll();
  });
})();
