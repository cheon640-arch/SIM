/* Plant Simulation 흉내 화면: 클래스 라이브러리 · 툴박스 · Frame · 대화상자 · EventController · 콘솔 */
(function () {
  const PS = window.PS, $ = (q, r = document) => r.querySelector(q), $$ = (q, r = document) => [...r.querySelectorAll(q)];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const ft = PS.fmtTime, pt = PS.parseTime;

  /* ---------- 아이콘 (40×40) ---------- */
  function icon(cls, color) {
    const s = (b) => `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">${b}</svg>`;
    const box = '<rect x="3" y="5" width="34" height="30" rx="3" fill="#f4f7fb" stroke="#334155" stroke-width="1.4"/>';
    switch (cls) {
      case 'Source': return s(box + '<path d="M11 20h16M21 13l7 7-7 7" stroke="#0a8a3a" stroke-width="3" fill="none"/>');
      case 'Drain': return s(box + '<path d="M8 20h14M16 13l7 7-7 7" stroke="#c62828" stroke-width="3" fill="none"/><rect x="25" y="12" width="7" height="16" fill="#c62828"/>');
      case 'Station': return s(box + '<rect x="11" y="12" width="18" height="16" rx="2" fill="#cfe3f8" stroke="#0067c0" stroke-width="1.6"/><circle cx="20" cy="20" r="3.4" fill="#0067c0"/>');
      case 'ParallelStation': return s(box + [0, 1].map(i => [0, 1].map(j => `<rect x="${9 + i * 12}" y="${10 + j * 11}" width="10" height="9" rx="1.5" fill="#cfe3f8" stroke="#0067c0" stroke-width="1.3"/>`).join('')).join(''));
      case 'Buffer': return s(box + [0, 1, 2].map(i => `<rect x="${9 + i * 8}" y="15" width="6" height="10" fill="#ffd27a" stroke="#8a5a00" stroke-width="1"/>`).join(''));
      case 'Sorter': return s(box + [0, 1, 2].map(i => `<rect x="${9 + i * 8}" y="${21 - i * 3}" width="6" height="${6 + i * 3}" fill="#ffd27a" stroke="#8a5a00" stroke-width="1"/>`).join('') + '<path d="M9 31h22" stroke="#8a5a00" stroke-width="1.5"/>');
      case 'Conveyor': return s('<rect x="2" y="14" width="36" height="12" rx="6" fill="#e2e8f0" stroke="#334155" stroke-width="1.4"/>' + [0, 1, 2, 3].map(i => `<circle cx="${9 + i * 7.3}" cy="20" r="2.2" fill="#64748b"/>`).join(''));
      case 'FlowControl': return s(box + '<path d="M9 20h8M17 20l9-7M17 20l9 7" stroke="#7c3aed" stroke-width="2.4" fill="none"/><circle cx="17" cy="20" r="2.4" fill="#7c3aed"/>');
      case 'Method': return s('<rect x="7" y="4" width="26" height="32" rx="2" fill="#fff" stroke="#334155" stroke-width="1.4"/><text x="20" y="18" text-anchor="middle" font-size="12" font-weight="700" fill="#0067c0" font-family="Segoe UI,sans-serif">M</text><path d="M12 24h16M12 28h12M12 32h14" stroke="#94a3b8" stroke-width="1.5"/>');
      case 'Variable': return s('<rect x="4" y="9" width="32" height="22" rx="3" fill="#fff" stroke="#334155" stroke-width="1.4"/><text x="20" y="25" text-anchor="middle" font-size="13" font-weight="700" fill="#0a8a3a" font-family="Consolas,monospace">n=</text>');
      case 'DataTable': return s('<rect x="5" y="7" width="30" height="26" fill="#fff" stroke="#334155" stroke-width="1.4"/><path d="M5 14h30M5 21h30M5 28h30M15 7v26M25 7v26" stroke="#94a3b8"/><rect x="5" y="7" width="30" height="7" fill="#cfe3f8" opacity=".7"/>');
      case 'EventController': return s('<circle cx="20" cy="20" r="15" fill="#fff" stroke="#334155" stroke-width="1.6"/><path d="M20 10v10l7 4" stroke="#c62828" stroke-width="2.4" fill="none"/>');
      case 'ExperimentManager': return s('<path d="M15 5h10M17 5v10L9 32a2 2 0 0 0 2 3h18a2 2 0 0 0 2-3L23 15V5" fill="#fff" stroke="#334155" stroke-width="1.5"/><path d="M12 27h16l2 5H10z" fill="#62aef0"/>');
      case 'Connector': return s('<path d="M7 32L31 9" stroke="#1b1f24" stroke-width="2"/><path d="M31 9l-8 2 6 6z" fill="#1b1f24"/><circle cx="7" cy="32" r="3" fill="#1b1f24"/>');
      case 'Frame': return s('<rect x="4" y="6" width="32" height="28" fill="#fff" stroke="#334155" stroke-width="1.4"/><rect x="4" y="6" width="32" height="6" fill="#0067c0"/>');
      case 'Folder': return s('<path d="M4 11h12l3 3h17v19H4z" fill="#ffd27a" stroke="#8a5a00" stroke-width="1.2"/>');
      case 'Comment': return s('<rect x="5" y="8" width="30" height="24" fill="#fff8c5" stroke="#8a5a00"/><path d="M10 15h20M10 20h20M10 25h12" stroke="#8a5a00"/>');
      case 'MU': return s(`<rect x="9" y="12" width="22" height="16" rx="3" fill="${color || '#0075de'}" stroke="#0b1726" stroke-width="1.2"/>`);
    }
    return s(box);
  }
  const CLS_INFO = {
    Source: 'MU 를 만들어 내보내요', Drain: 'MU 를 없애요 (통계 기록)', Station: '한 번에 MU 1개 처리', ParallelStation: '여러 MU 를 동시에 처리 (X×Y 자리)',
    Buffer: 'MU 를 쌓아 두는 대기 공간', Sorter: '속성 순서대로 꺼내는 버퍼', Conveyor: '컨베이어 (길이 ÷ 속도 = 이동시간)', FlowControl: '분기 규칙만 가진 객체',
    Method: 'SimTalk 프로그램', Variable: '전역 변수', DataTable: '표 (2차원 자료)', EventController: '시뮬레이션 시계 · 시작/정지', ExperimentManager: '여러 실험을 자동 실행', Connector: '객체 연결선 (MU 흐름 방향)', Comment: '메모',
  };
  const TOOLBOX = [
    ['Material Flow', ['Connector', 'EventController', 'Source', 'Drain', 'Station', 'ParallelStation', 'Buffer', 'Sorter', 'FlowControl', 'Conveyor']],
    ['Information Flow', ['Method', 'Variable', 'DataTable']],
    ['User Interface', ['Comment']],
    ['Tools', ['ExperimentManager']],
  ];

  /* ---------- 상태 ---------- */
  const S = { model: null, sim: null, playing: false, sel: null, connect: false, connFrom: null, speed: 6, tutorial: null, listeners: [], dirty: false, error: null };
  window.PSUI = S;
  const saveKey = () => 'simnote:ps-model:' + (S.tutorial || 'free');
  function save() { try { localStorage.setItem(saveKey(), JSON.stringify(S.model)); } catch (e) {} }
  function load(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  S.save = save;
  /* 옛 이름(14.0 이전)으로 저장된 모델 → 2201 이름 */
  const REN = { SingleProc: 'Station', ParallelProc: 'ParallelStation', Line: 'Conveyor', TableFile: 'DataTable' };
  function migrate(m) {
    Object.values(m.objects || {}).forEach(o => { if (REN[o.cls]) o.cls = REN[o.cls]; if (o.mu === 'Entity') o.mu = 'Part'; });
    if (m.mus && m.mus.Entity && !m.mus.Part) { m.mus.Part = m.mus.Entity; delete m.mus.Entity; }
    Object.values(m.mus || {}).forEach(u => { if (u.base === 'Entity') u.base = 'Part'; });
    return m;
  }
  function ensureEC(m) { if (!Object.values(m.objects).some(o => o.cls === 'EventController')) m.objects.EventController = { cls: 'EventController', x: 40, y: 30 }; if (!m.ec) m.ec = { end: 86400, statStart: 0 }; return m; }
  S.setModel = (m, keepSel) => { S.model = ensureEC(migrate(m)); if (!keepSel) S.sel = null; resetSim(); renderAll(); };
  S.changed = (what) => { resetSim(); save(); renderFrame(); renderLib(); notify(what || 'model'); };
  function notify(what) { S.listeners.forEach(f => { try { f(what); } catch (e) { console.error(e); } }); }
  S.onChange = f => S.listeners.push(f);

  /* ---------- 이름 ---------- */
  function uniqueName(base) { const M = S.model.objects; if (!M[base] && !S.model.mus[base]) return base; let i = 1; while (M[base + i] || S.model.mus[base + i]) i++; return base + i; }
  const validName = n => /^[A-Za-z_가-힣][A-Za-z0-9_가-힣]*$/.test(n);
  function renameObject(old, nu) {
    if (old === nu) return true;
    if (!validName(nu)) { alert('이름은 문자로 시작하고 문자·숫자·_ 만 쓸 수 있어요.'); return false; }
    if (S.model.objects[nu] || S.model.mus[nu]) { alert(`'${nu}' 는 이미 있는 이름이에요.`); return false; }
    const o = S.model.objects[old]; delete S.model.objects[old]; S.model.objects[nu] = o;
    S.model.connectors.forEach(c => { if (c[0] === old) c[0] = nu; if (c[1] === old) c[1] = nu; });
    Object.values(S.model.objects).forEach(x => { ['entCtrl', 'exitCtrl', 'table'].forEach(k => { if (x[k] === old) x[k] = nu; }); });
    if (S.sel === old) S.sel = nu;
    return true;
  }
  function addObject(cls, x, y) {
    if (cls === 'EventController' && Object.values(S.model.objects).some(o => o.cls === 'EventController')) { alert('EventController 는 Frame 에 하나만 둘 수 있어요.'); return null; }
    const name = uniqueName(cls === 'EventController' ? 'EventController' : cls);
    S.model.objects[name] = { cls, x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10, ...(PS.DEFAULTS[cls] ? PS.DEFAULTS[cls]() : {}) };
    S.sel = name; S.changed('add'); return name;
  }
  S.addObject = addObject;
  function deleteSel() {
    if (S.sel == null) return;
    if (typeof S.sel === 'object' && S.sel.conn != null) { S.model.connectors.splice(S.sel.conn, 1); S.sel = null; S.changed('conn'); return; }
    const o = S.model.objects[S.sel]; if (!o) return;
    if (o.cls === 'EventController') { alert('EventController 는 지울 수 없어요.'); return; }
    S.model.connectors = S.model.connectors.filter(c => c[0] !== S.sel && c[1] !== S.sel);
    delete S.model.objects[S.sel]; S.sel = null; S.changed('delete');
  }

  /* ---------- 시뮬레이션 제어 ---------- */
  function resetSim() { stop(); S.sim = null; S.error = null; paintStatus(); paintDynamic(); }
  function ensureSim() {
    if (S.sim) return S.sim;
    S.sim = new PS.Sim(S.model, { seed: S.model.ec.seed || 1, console: S.consoleLines = [] });
    try { S.sim.init(); } catch (e) { showError(e); }
    return S.sim;
  }
  function showError(e) {
    stop(); S.error = e; logConsole((e.method ? `[${e.method}] ` : '') + e.message, true);
    paintStatus();
    if (e.method && S.model.objects[e.method]) openDialog(e.method, { errLine: e.line, errMsg: e.message });
    else alert('시뮬레이션 오류: ' + e.message);
  }
  let raf = 0, lastTs = 0;
  function play() {
    const sim = ensureSim(); if (sim.finished || S.error) return;
    S.playing = true; lastTs = performance.now(); paintStatus(); raf = requestAnimationFrame(loop);
  }
  function stop() { S.playing = false; cancelAnimationFrame(raf); paintStatus(); }
  function loop(ts) {
    if (!S.playing) return;
    const dt = Math.min(.25, (ts - lastTs) / 1000); lastTs = ts;
    const sim = S.sim, factor = Math.pow(10, S.speed / 2);
    try { sim.runUntil(Math.min(pt(S.model.ec.end) || Infinity, sim.t + factor * dt)); } catch (e) { showError(e); return; }
    paintDynamic(); flushConsole();
    if (sim.finished || !sim.ev.size) { stop(); paintDynamic(); notify('run'); refreshOpenStats(); return; }
    if (++fc % 15 === 0) { notify('tick'); refreshOpenStats(); }
    raf = requestAnimationFrame(loop);
  }
  let fc = 0;
  function stepOne() {
    stop(); const sim = ensureSim(); if (sim.finished) return;
    const x = sim.ev.peek(); const nb = sim.trace.length;
    try { sim.step(); } catch (e) { showError(e); return; }
    const msg = sim.trace.slice(nb).map(r => r.msg).join(' → ');
    $('#ps-steplog').textContent = `${ft(sim.t, true)}  ${evLabel(x)}${msg ? ' — ' + msg : ''}`;
    paintDynamic(); flushConsole(); notify('tick'); refreshOpenStats();
  }
  function fastForward() {
    stop(); const sim = ensureSim(); if (sim.finished) return;
    const end = pt(S.model.ec.end); $('#ps-state').textContent = '빠르게 실행 중…';
    const chunk = () => { try { const t0 = performance.now(); while (performance.now() - t0 < 40 && !sim.finished && sim.ev.size) sim.step(); } catch (e) { showError(e); return; }
      paintDynamic(); flushConsole();
      if (!sim.finished && sim.ev.size) setTimeout(chunk, 0); else { if (!sim.finished && isFinite(end)) sim.endSim(); paintDynamic(); flushConsole(); paintStatus(); notify('run'); refreshOpenStats(); } };
    chunk();
  }
  S.fastForward = fastForward;
  const evLabel = x => x ? ({ create: `${x.who} 생성 사건`, end: `${x.who} 작업 완료 사건`, pull: `${x.who} 자리 남 → 대기 MU 당기기`, dwell: `${x.who} 체류 끝`, line: `${x.who} 컨베이어 끝 도착`, statStart: '통계 시작(워밍업 끝)', end_: '' }[x.kind] || (x.kind === 'end' ? '' : x.kind)) : '';
  function paintStatus() {
    const sim = S.sim, st = $('#ps-state'); if (!st) return;
    st.textContent = S.error ? '오류로 정지' : !sim ? '초기화됨 (Reset)' : sim.finished ? '종료 (End)' : S.playing ? '실행 중' : '일시 정지';
    $('#ps-time').textContent = ft(sim ? sim.t : 0, true);
    $('#rb-play').innerHTML = S.playing ? '<span class="ic">❚❚</span>Stop' : '<span class="ic">▶</span>Start';
    $('#ps-end').textContent = 'End ' + ft(pt(S.model.ec.end), true);
    const nx = sim && sim.ev.peek(); $('#ps-next').textContent = nx && !sim.finished ? `다음 사건: ${ft(nx.t, true)} ${evLabel(nx)}` : '';
  }

  /* ---------- 콘솔 ---------- */
  S.consoleLines = [];
  let shown = 0;
  function logConsole(line, err) { const p = $('#bt-console'); p.insertAdjacentHTML('beforeend', `<div class="${err ? 'err' : ''}">${esc(line)}</div>`); p.scrollTop = p.scrollHeight; }
  function flushConsole() { const L = S.sim ? S.sim.console : []; if (L !== S._lastL) { S._lastL = L; shown = 0; } while (shown < L.length) logConsole(L[shown++]); if (!$('#bt-trace').hidden) paintTrace(); if (!$('#bt-ev').hidden) paintEvents(); }
  function paintTrace() { const sim = S.sim; $('#bt-trace').innerHTML = sim ? '<table>' + sim.trace.slice(-150).reverse().map(r => `<tr><td>${ft(r.t, true)}</td><td>${esc(r.msg)}</td></tr>`).join('') + '</table>' : '<i>Reset 상태 — 시작하면 사건이 기록돼요.</i>'; }
  function paintEvents() { const sim = S.sim; if (!sim) { $('#bt-ev').innerHTML = '<i>Reset 상태</i>'; return; } const a = sim.ev.a.slice().sort((x, y) => x.t - y.t || x.s - y.s).slice(0, 40); $('#bt-ev').innerHTML = `<table><tr><th>시각</th><th>사건</th><th>객체</th></tr>${a.map(x => `<tr><td>${ft(x.t, true)}</td><td>${esc(evLabel(x) || x.kind)}</td><td>${esc(x.who || '')}</td></tr>`).join('')}</table>`; }

  /* ---------- 클래스 라이브러리 ---------- */
  function renderLib() {
    const mus = Object.entries(S.model.mus);
    const frameObjs = Object.entries(S.model.objects);
    const leaf = (cls, label, attrs = '') => `<li><div class="nd" ${attrs}><span class="tw"></span><span class="ico">${icon(cls)}</span>${esc(label)}</div></li>`;
    const folder = (label, inner, open = true) => `<li class="${open ? '' : 'closed'}"><div class="nd"><span class="tw" data-tw>${open ? '▾' : '▸'}</span><span class="ico">${icon('Folder')}</span>${label}</div><ul class="tree">${inner}</ul></li>`;
    $('#ps-tree').innerHTML = folder('Models', `<li><div class="nd sel"><span class="tw">▾</span><span class="ico">${icon('Frame')}</span>Frame</div><ul class="tree">${frameObjs.map(([n, o]) => `<li><div class="nd" data-obj="${esc(n)}"><span class="tw"></span><span class="ico">${icon(o.cls)}</span>${esc(n)}</div></li>`).join('')}</ul></li>`) +
      folder('MaterialFlow', ['Connector', 'EventController', 'Source', 'Drain', 'Station', 'ParallelStation', 'Buffer', 'Sorter', 'FlowControl', 'Conveyor'].map(c => leaf(c, c, `draggable="true" data-cls="${c}" title="${esc(CLS_INFO[c])}"`)).join('')) +
      folder('InformationFlow', ['Method', 'Variable', 'DataTable'].map(c => leaf(c, c, `draggable="true" data-cls="${c}" title="${esc(CLS_INFO[c])}"`)).join('')) +
      folder('UserInterface', leaf('Comment', 'Comment', 'draggable="true" data-cls="Comment"'), false) +
      folder('MUs', mus.map(([n, m]) => `<li><div class="nd ${S.selMU === n ? 'sel' : ''}" data-mu="${esc(n)}" title="더블클릭: 속성 편집"><span class="tw"></span><span class="ico">${icon('MU', m.color)}</span>${esc(n)}${m.base ? ` <span style="color:#94a3b8;font-size:11px">(${esc(m.base)} 파생)</span>` : ''}</div></li>`).join('')) +
      folder('Tools', leaf('ExperimentManager', 'ExperimentManager', 'draggable="true" data-cls="ExperimentManager"'));
    $$('#ps-tree [data-tw]').forEach(t => t.onclick = () => { const li = t.closest('li'); li.classList.toggle('closed'); t.textContent = li.classList.contains('closed') ? '▸' : '▾'; });
    $$('#ps-tree [data-cls]').forEach(n => { n.addEventListener('dragstart', e => { e.dataTransfer.setData('text/ps-cls', n.dataset.cls); }); n.onclick = () => { if (n.dataset.cls === 'Connector') toggleConnect(); else setPlacing(n.dataset.cls); }; });
    $$('#ps-tree [data-obj]').forEach(n => { n.onclick = () => { S.sel = n.dataset.obj; renderFrame(); }; n.ondblclick = () => openDialog(n.dataset.obj); });
    $$('#ps-tree [data-mu]').forEach(n => { n.onclick = () => { S.selMU = n.dataset.mu; renderLib(); }; n.ondblclick = () => openMUDialog(n.dataset.mu); });
  }
  function muAction(kind) {
    const base = S.selMU || 'Part', src = S.model.mus[base]; if (!src) return;
    const name = uniqueName(kind === 'derive' ? base : 'my' + base.replace(/^my/, ''));
    S.model.mus[name] = kind === 'derive' ? { ...clone(src), base } : { ...clone(src), base: undefined };
    S.selMU = name; S.changed('mu'); openMUDialog(name);
  }

  /* ---------- 툴박스 ---------- */
  let tbTab = 0;
  function renderToolbox() {
    $('#tb-tabs').innerHTML = TOOLBOX.map((t, i) => `<button class="${i === tbTab ? 'on' : ''}" data-i="${i}">${t[0]}</button>`).join('') + `<button data-i="mu" class="${tbTab === 'mu' ? 'on' : ''}">MUs</button>`;
    $$('#tb-tabs button').forEach(b => b.onclick = () => { tbTab = b.dataset.i === 'mu' ? 'mu' : +b.dataset.i; renderToolbox(); });
    if (tbTab === 'mu') { $('#tb-icons').innerHTML = Object.entries(S.model.mus).map(([n, m]) => `<div class="tbi" data-mu="${esc(n)}" title="더블클릭: 속성">${icon('MU', m.color)}${esc(n)}</div>`).join('') + '<span style="font-size:11.5px;color:#64748b;align-self:center;margin-left:8px">MU 는 Frame 에 놓지 않아요 — Source 의 MU 설정에서 골라요. 새 MU: 클래스 라이브러리 MUs 에서 복제/파생.</span>'; $$('#tb-icons [data-mu]').forEach(n => n.ondblclick = () => openMUDialog(n.dataset.mu)); return; }
    $('#tb-icons').innerHTML = TOOLBOX[tbTab][1].map(c => `<div class="tbi ${c === 'Connector' && S.connect ? 'on' : ''}" draggable="${c !== 'Connector'}" data-cls="${c}" title="${esc(c + ' — ' + CLS_INFO[c])}">${icon(c)}${c}</div>`).join('');
    $$('#tb-icons [data-cls]').forEach(n => { if (n.dataset.cls === 'Connector') n.onclick = toggleConnect; else { n.addEventListener('dragstart', e => e.dataTransfer.setData('text/ps-cls', n.dataset.cls)); n.onclick = () => setPlacing(S.placing === n.dataset.cls ? null : n.dataset.cls); } if (S.placing === n.dataset.cls) n.classList.add('on'); });
  }
  function setPlacing(cls) { S.placing = cls; if (cls && S.connect) { S.connect = false; S.connFrom = null; $('#ps-frame').classList.remove('connect'); } $('#ps-frame').style.cursor = cls ? 'copy' : ''; $('#fw-hint').textContent = cls ? `${cls}: Frame 의 빈 곳을 클릭하면 놓여요 (Esc 취소)` : '도구 상자에서 끌어다 놓기 또는 클릭 후 Frame 클릭 · 더블클릭 = 설정 · Delete = 삭제'; renderToolbox(); }
  function toggleConnect(on) { if (S.placing) { S.placing = null; $('#ps-frame').style.cursor = ''; } S.connect = typeof on === 'boolean' ? on : !S.connect; S.connFrom = null; $('#ps-frame').classList.toggle('connect', S.connect); $('#fw-hint').textContent = S.connect ? 'Connector: 시작 객체 클릭 → 도착 객체 클릭 (Esc 로 끝)' : '도구 상자에서 끌어다 놓기 또는 클릭 후 Frame 클릭 · 더블클릭 = 설정 · Delete = 삭제'; renderToolbox(); renderFrame(); }

  /* ---------- Frame ---------- */
  const IW = 44;
  function center(o) { return [o.x + IW / 2, o.y + IW / 2]; }
  function renderFrame() {
    const M = S.model.objects; let W = 900, H = 560;
    Object.values(M).forEach(o => { W = Math.max(W, o.x + 180); H = Math.max(H, o.y + 140); });
    const g = [`<svg id="ps-svg" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="pa" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="#1b1f24"/></marker><marker id="pas" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="#0067c0"/></marker></defs>`];
    S.model.connectors.forEach(([a, b], i) => {
      const A = M[a], B = M[b]; if (!A || !B) return;
      const [x1, y1] = center(A), [x2, y2] = center(B), d = Math.hypot(x2 - x1, y2 - y1) || 1, r = IW / 2 + 3;
      const sx = x1 + (x2 - x1) / d * r, sy = y1 + (y2 - y1) / d * r, ex = x2 - (x2 - x1) / d * r, ey = y2 - (y2 - y1) / d * r;
      const on = S.sel && S.sel.conn === i;
      g.push(`<g data-conn="${i}"><line class="conn-hit" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}"/><line class="conn ${on ? 'sel' : ''}" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" marker-end="url(#${on ? 'pas' : 'pa'})"/></g>`);
    });
    for (const [n, o] of Object.entries(M)) {
      const sel = S.sel === n || S.connFrom === n;
      let extra = '';
      if (o.cls === 'Variable') extra = `<text class="sub" x="${IW + 6}" y="26" id="dv-${esc(n)}">= ${esc(String(o.value))}</text>`;
      if (o.cls === 'Comment') extra = `<text class="sub" x="${IW + 6}" y="26">${esc(o.text)}</text>`;
      const led = PS.MATERIAL.has(o.cls) && o.cls !== 'FlowControl' ? `<rect id="led-${esc(n)}" x="-3" y="-3" width="9" height="9" rx="2" fill="#cbd5e1" stroke="#475569" stroke-width=".8"/>` : '';
      g.push(`<g class="fo ${sel ? 'sel' : ''}" data-obj="${esc(n)}" transform="translate(${o.x},${o.y})"><rect class="box" x="-6" y="-6" width="${IW + 12}" height="${IW + 28}" rx="4"/><g>${icon(o.cls).replace('<svg ', `<svg width="${IW}" height="${IW}" `)}</g>${led}<g id="mu-${esc(n)}"></g><text class="nm" x="${IW / 2}" y="${IW + 14}" text-anchor="middle">${esc(n)}</text><text class="sub" id="cnt-${esc(n)}" x="${IW / 2}" y="${IW + 26}" text-anchor="middle"></text>${extra}</g>`);
    }
    if (S.connFrom && M[S.connFrom]) { const [x, y] = center(M[S.connFrom]); g.push(`<line id="rubber" x1="${x}" y1="${y}" x2="${x}" y2="${y}" stroke="#0067c0" stroke-dasharray="4 3" stroke-width="1.4"/>`); }
    g.push('</svg>');
    $('#ps-frame').innerHTML = g.join('');
    paintDynamic();
  }
  const MU_COLOR = n => (S.model.mus[n] && S.model.mus[n].color) || '#0075de';
  function paintDynamic() {
    const sim = S.sim;
    for (const [n, o] of Object.entries(S.model.objects)) {
      const led = document.getElementById('led-' + n), cnt = document.getElementById('cnt-' + n), mu = document.getElementById('mu-' + n);
      const ro = sim && sim.O[n];
      if (led) { let c = '#cbd5e1'; if (ro) { const w = ro.items.some(i => i.st === 'work'), b = ro.items.some(i => i.st === 'ready'); if (o.cls === 'Station' || o.cls === 'ParallelStation') c = w ? '#22c55e' : b ? '#facc15' : '#cbd5e1'; else if (o.cls === 'Source') c = ro.items.length ? '#facc15' : '#22c55e'; else if (o.cls === 'Drain') c = '#22c55e'; else c = ro.items.length ? '#22c55e' : '#cbd5e1'; } led.setAttribute('fill', c); }
      if (cnt) {
        let t = '';
        if (ro) { if (o.cls === 'Drain') t = `${ro.st.in}개 도착`; else if (o.cls === 'Source') t = `${ro.st.created}개 생성${ro.st.lost ? ` · ${ro.st.lost} 소멸` : ''}`; else if (o.cls === 'Buffer' || o.cls === 'Sorter' || o.cls === 'Conveyor') t = `${ro.items.length}/${(+o.cap < 0 || o.cap === '') ? '∞' : o.cap}`; else if (o.cls === 'ParallelStation') t = `${ro.items.length}/${ro.n}`; }
        else { if (o.cls === 'Buffer' || o.cls === 'Sorter') t = `용량 ${(+o.cap < 0) ? '∞' : o.cap}`; if (o.cls === 'ParallelStation') t = `${o.xdim}×${o.ydim}`; }
        cnt.textContent = t;
      }
      if (mu) { let h = ''; if (ro && ro.items.length) { const k = Math.min(ro.items.length, 6); for (let i = 0; i < k; i++) { const it = ro.items[i]; h += `<rect x="${IW - 4 - i * 7}" y="${IW - 12}" width="9" height="9" rx="1.5" fill="${MU_COLOR(it.mu.name)}" stroke="${it.st === 'ready' && o.cls !== 'Buffer' && o.cls !== 'Sorter' ? '#facc15' : '#0b1726'}" stroke-width="1.2"/>`; } } mu.innerHTML = h; }
      if (o.cls === 'Variable') { const dv = document.getElementById('dv-' + n); if (dv) { const v = sim ? sim.vars[n].v : o.value; dv.textContent = '= ' + (typeof v === 'number' && !Number.isInteger(v) ? (+v.toFixed(4)) : String(v)); } }
    }
    if (sim) { $('#ps-time').textContent = ft(sim.t, true); $('#ps-wip').textContent = `시스템 안 MU ${sim.mus.size}개`; } else { $('#ps-wip').textContent = ''; }
    const nx = sim && sim.ev.peek(); const ne = $('#ps-next'); if (ne) ne.textContent = nx && !sim.finished ? `다음 사건: ${ft(nx.t, true)} ${evLabel(nx)}` : '';
  }
  function frameEvents() {
    const fr = $('#ps-frame');
    fr.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/ps-cls')) e.preventDefault(); });
    fr.addEventListener('drop', e => { const cls = e.dataTransfer.getData('text/ps-cls'); if (!cls) return; e.preventDefault(); const r = fr.getBoundingClientRect(); if (cls === 'Connector') { toggleConnect(true); return; } addObject(cls, e.clientX - r.left + fr.scrollLeft - IW / 2, e.clientY - r.top + fr.scrollTop - IW / 2); });
    let drag = null;
    fr.addEventListener('mousedown', e => {
      const g = e.target.closest('.fo'), c = e.target.closest('[data-conn]');
      if (e.button !== 0) return;
      if (g) {
        const n = g.dataset.obj;
        if (S.connect) {
          if (!S.connFrom) { S.connFrom = n; renderFrame(); }
          else if (S.connFrom !== n) { const ok = connect(S.connFrom, n); S.connFrom = ok && e.ctrlKey ? n : null; renderFrame(); }
          return;
        }
        S.sel = n; const o = S.model.objects[n]; drag = { n, sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y, moved: false };
        $$('#ps-svg .fo').forEach(x => x.classList.toggle('sel', x.dataset.obj === n)); $$('#ps-svg .conn').forEach(x => x.classList.remove('sel'));
        return;
      }
      if (c) { S.sel = { conn: +c.dataset.conn }; renderFrame(); return; }
      if (S.connect && S.connFrom) { S.connFrom = null; renderFrame(); return; }
      if (S.placing) { const r = fr.getBoundingClientRect(), cls = S.placing; setPlacing(null); addObject(cls, e.clientX - r.left + fr.scrollLeft - IW / 2, e.clientY - r.top + fr.scrollTop - IW / 2); return; }
      S.sel = null; renderFrame();
    });
    window.addEventListener('mousemove', e => {
      if (S.connect && S.connFrom) { const rb = $('#rubber'); if (rb) { const r = fr.getBoundingClientRect(); rb.setAttribute('x2', e.clientX - r.left + fr.scrollLeft); rb.setAttribute('y2', e.clientY - r.top + fr.scrollTop); } }
      if (!drag) return; const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (drag.moved) { const o = S.model.objects[drag.n]; o.x = Math.max(4, Math.round((drag.ox + dx) / 10) * 10); o.y = Math.max(4, Math.round((drag.oy + dy) / 10) * 10); const g = $(`#ps-svg .fo[data-obj="${CSS.escape(drag.n)}"]`); if (g) g.setAttribute('transform', `translate(${o.x},${o.y})`); }
    });
    window.addEventListener('mouseup', () => { if (drag && drag.moved) { save(); renderFrame(); } drag = null; });
    fr.addEventListener('dblclick', e => { const g = e.target.closest('.fo'); if (g && !S.connect) openDialog(g.dataset.obj); });
    fr.addEventListener('contextmenu', e => { const g = e.target.closest('.fo'); if (!g) return; e.preventDefault(); S.sel = g.dataset.obj; renderFrame(); ctxMenu(e.clientX, e.clientY, [['열기 (Open)', () => openDialog(g.dataset.obj)], ['이름 바꾸기', () => { const nu = prompt('새 이름', g.dataset.obj); if (nu && renameObject(g.dataset.obj, nu.trim())) S.changed('rename'); }], ['삭제 (Delete)', deleteSel]]); });
    document.addEventListener('keydown', e => {
      if (e.target.closest('input, textarea, select, .dlg')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { if (S.sel != null) { e.preventDefault(); deleteSel(); } }
      if (e.key === 'Escape') { if (S.connect) toggleConnect(false); if (S.placing) setPlacing(null); }
    });
  }
  function connect(a, b) {
    const A = S.model.objects[a], B = S.model.objects[b];
    if (!PS.MATERIAL.has(A.cls) || !PS.MATERIAL.has(B.cls)) { alert('Connector 는 물류 객체(Source, Buffer, Station …)끼리만 연결해요. Method 는 Controls 탭에서 지정합니다.'); return false; }
    if (A.cls === 'Drain') { alert('Drain 에서는 MU 가 나가지 않아요 (Drain → … 연결 불가).'); return false; }
    if (B.cls === 'Source') { alert('Source 로는 MU 가 들어갈 수 없어요.'); return false; }
    if (S.model.connectors.some(c => c[0] === a && c[1] === b)) return false;
    S.model.connectors.push([a, b]); S.changed('conn'); return true;
  }
  S.connectObjs = connect;
  function ctxMenu(x, y, items) { closeMenus(); const m = document.createElement('div'); m.className = 'menu ctx'; m.style.left = x + 'px'; m.style.top = y + 'px'; items.forEach(([l, f]) => { if (l === '-') { m.appendChild(document.createElement('hr')); return; } const b = document.createElement('button'); b.textContent = l; b.onclick = () => { closeMenus(); f(); }; m.appendChild(b); }); document.body.appendChild(m); }
  function closeMenus() { $$('.menu').forEach(m => m.remove()); }
  document.addEventListener('mousedown', e => { if (!e.target.closest('.menu') && !e.target.closest('[data-menu]')) closeMenus(); });

  /* ---------- 대화상자 공통 ---------- */
  let zTop = 70;
  function dialog({ title, path, tabs, head, foot, big, onApply, key }) {
    if (key) { const ex = $(`.dlg[data-key="${CSS.escape(key)}"]`); if (ex) ex.remove(); }
    const d = document.createElement('div'); d.className = 'dlg' + (big ? ' big' : ''); if (key) d.dataset.key = key;
    d.style.zIndex = ++zTop; const n = $$('.dlg').length; d.style.left = (Math.min(innerWidth - 500, 260 + n * 24)) + 'px'; d.style.top = (90 + n * 24) + 'px';
    d.innerHTML = `<div class="dlg-tb"><span class="t">${esc(title)}</span><span class="p">${esc(path || '')}</span><button class="x" title="닫기">✕</button></div>${head ? '<div class="dlg-head"></div>' : ''}${tabs.length > 1 ? `<div class="dlg-tabs">${tabs.map((t, i) => `<button class="${i ? '' : 'on'}" data-i="${i}">${esc(t[0])}</button>`).join('')}</div>` : ''}<div class="dlg-body">${tabs.map((t, i) => `<div class="pane" data-i="${i}" ${i ? 'hidden' : ''}></div>`).join('')}</div><div class="dlg-foot"></div>`;
    document.body.appendChild(d);
    if (head) $('.dlg-head', d).append(head);
    tabs.forEach((t, i) => { const p = $(`.pane[data-i="${i}"]`, d); if (typeof t[1] === 'string') p.innerHTML = t[1]; else p.append(t[1]); });
    $$('.dlg-tabs button', d).forEach(b => b.onclick = () => { $$('.dlg-tabs button', d).forEach(x => x.classList.toggle('on', x === b)); $$('.pane', d).forEach(p => p.hidden = p.dataset.i !== b.dataset.i); if (d._onTab) d._onTab(+b.dataset.i); });
    const close = () => { d.remove(); };
    $('.x', d).onclick = close;
    const fb = $('.dlg-foot', d);
    if (foot) fb.append(foot);
    if (onApply) {
      const mk = (l, cls, f) => { const b = document.createElement('button'); b.className = 'sbtn' + (cls ? ' ' + cls : ''); b.textContent = l; b.onclick = f; fb.append(b); };
      mk('OK', 'pri', () => { if (onApply() !== false) close(); }); mk('Cancel', '', close); mk('Apply', '', () => onApply());
    }
    d.addEventListener('mousedown', () => d.style.zIndex = ++zTop);
    const tb = $('.dlg-tb', d); tb.addEventListener('mousedown', e => { if (e.target.closest('button')) return; const sx = e.clientX - d.offsetLeft, sy = e.clientY - d.offsetTop; const mv = ev => { d.style.left = Math.max(0, ev.clientX - sx) + 'px'; d.style.top = Math.max(0, ev.clientY - sy) + 'px'; }; const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); }; window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up); });
    d.addEventListener('keydown', e => { if (e.key === 'Escape') close(); if (e.key === 'Enter' && onApply && e.target.tagName === 'INPUT') { if (onApply() !== false) close(); } });
    return d;
  }
  const el = (h) => { const t = document.createElement('div'); t.innerHTML = h; return t; };
  function row(label, ctrl, hint) { const r = document.createElement('div'); r.className = 'fr'; r.innerHTML = `<label>${label}</label>`; const c = document.createElement('div'); if (typeof ctrl === 'string') c.innerHTML = ctrl; else c.append(ctrl); if (hint) c.insertAdjacentHTML('beforeend', `<div class="hint" style="font-size:11.5px;color:#64748b;margin-top:2px">${hint}</div>`); r.append(c); return r; }
  const methodNames = () => Object.entries(S.model.objects).filter(([, o]) => o.cls === 'Method').map(([n]) => n);
  const tableNames = () => Object.entries(S.model.objects).filter(([, o]) => o.cls === 'DataTable').map(([n]) => n);

  /* 분포 편집기: Plant Sim 처럼 [분포 ▾] + 시간 칸 (mm:ss) */
  function distEditor(d, opt = {}) {
    let cur = clone(d || { t: 'Const', v: 0 });
    const w = document.createElement('div'); w.className = 'dl';
    const draw = () => {
      const kinds = Object.keys(PS.DISTS).concat(opt.listType ? ['ListType'] : []);
      w.innerHTML = `<select>${kinds.map(k => `<option value="${k}" ${k === cur.t ? 'selected' : ''}>${k === 'ListType' ? 'List(Type) — MU 별' : k}</option>`).join('')}</select>`;
      if (cur.t === 'ListType') {
        const mus = Object.keys(S.model.mus); cur.list = cur.list || {};
        const box = document.createElement('div'); box.style.cssText = 'flex-basis:100%;display:grid;gap:4px;margin-top:4px';
        mus.forEach(m => { const r = document.createElement('div'); r.className = 'dl'; r.innerHTML = `<span style="width:90px;font-size:12px">${esc(m)}</span>`; const ed = distEditor(cur.list[m] || { t: 'Const', v: 0 }); ed._on = v => { cur.list[m] = v; }; r.append(ed); box.append(r); ed.addEventListener('input', () => { cur.list[m] = ed.value; }); ed.addEventListener('change', () => { cur.list[m] = ed.value; }); });
        w.append(box);
      } else {
        PS.DISTS[cur.t].p.forEach(([k, l]) => { const lab = document.createElement('label'); lab.innerHTML = `${l} <input data-k="${k}" value="${cur[k] == null || cur[k] === '' || cur[k] === Infinity ? '' : (opt.raw ? cur[k] : ft(cur[k]))}">`; w.append(lab); });
        $$(':scope > label > input[data-k]', w).forEach(i => i.oninput = () => { const v = opt.raw ? +i.value : pt(i.value); cur[i.dataset.k] = i.value.trim() === '' ? '' : v; i.style.background = i.value.trim() !== '' && isNaN(v) ? '#fdeceb' : ''; });
      }
      $(':scope > select', w).onchange = e => { const t = e.target.value, m = PS.dMean(cur) || 60; cur = t === 'ListType' ? { t, list: {} } : { t }; ({ Const: () => cur.v = m, Negexp: () => cur.beta = m, Uniform: () => { cur.a = m * .8; cur.b = m * 1.2; }, Triangle: () => { cur.c = m; cur.a = m * .7; cur.b = m * 1.3; }, Normal: () => { cur.mu = m; cur.sigma = m * .2; cur.lo = 0; cur.hi = ''; }, Lognorm: () => { cur.mu = m; cur.sigma = m * .3; }, Erlang: () => { cur.mu = m; cur.sigma = m * .5; }, ListType: () => {} })[t](); draw(); w.dispatchEvent(new Event('change')); };
    };
    draw();
    Object.defineProperty(w, 'value', { get: () => { const c = clone(cur); if (c.t === 'Normal' && c.hi === '') c.hi = Infinity; return c; } });
    return w;
  }
  S.distEditor = distEditor;
  function ctrlSelect(v) { const s = document.createElement('div'); s.className = 'dl'; s.innerHTML = `<select style="min-width:150px"><option value="">(없음)</option>${methodNames().map(n => `<option ${n === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><button class="sbtn" type="button">새 메서드</button><button class="sbtn" type="button">열기</button>`;
    const [sel, nb, ob] = [$('select', s), ...$$('button', s)];
    nb.onclick = () => { const n = addObject('Method', 60 + Math.random() * 200, 360 + Math.random() * 80); if (!n) return; sel.insertAdjacentHTML('beforeend', `<option>${esc(n)}</option>`); sel.value = n; openDialog(n); };
    ob.onclick = () => { if (sel.value) openDialog(sel.value); };
    Object.defineProperty(s, 'value', { get: () => sel.value }); return s; }
  function exitPane(name, o) {
    const ex = clone(o.exit || { strategy: 'cyclic', blocking: false, pct: [], attr: '' }), succ = S.model.connectors.filter(c => c[0] === name).map(c => c[1]);
    const w = document.createElement('div');
    const draw = () => {
      w.innerHTML = '';
      const s = document.createElement('select'); s.innerHTML = [['cyclic', 'Cyclic (차례로)'], ['first', 'Start at successor 1 (1번부터 빈 곳)'], ['random', 'Random'], ['percentage', 'Percentage'], ['attribute', 'MU Attribute (속성 값 = 후속 번호)']].map(([v, l]) => `<option value="${v}" ${v === ex.strategy ? 'selected' : ''}>${l}</option>`).join('');
      s.onchange = () => { ex.strategy = s.value; draw(); };
      w.append(row('Strategy', s));
      const bl = el(`<label><input type="checkbox" ${ex.blocking ? 'checked' : ''}> Blocking</label>`); $('input', bl).onchange = e => ex.blocking = e.target.checked;
      w.append(row('', bl, 'Blocking: 정해진 후속 객체가 빌 때까지 기다림 · 끄면(Non-blocking) 비어 있는 다른 후속 객체로 보냄'));
      if (ex.strategy === 'percentage') { const t = document.createElement('table'); t.className = 'grid-t'; t.innerHTML = `<tr><th>#</th><th>Successor</th><th>Percentage</th></tr>` + succ.map((sn, i) => `<tr><td class="rn">${i + 1}</td><td style="padding:2px 6px">${esc(sn)}</td><td><input data-i="${i}" value="${ex.pct[i] ?? ''}"></td></tr>`).join(''); $$('input', t).forEach(i => i.oninput = () => ex.pct[+i.dataset.i] = +i.value); w.append(row('비율 표', t, '합이 100 이 되게 (예: 70, 30)')); }
      if (ex.strategy === 'attribute') { const i = el(`<input type="text" value="${esc(ex.attr)}" placeholder="예: aRoute">`).firstChild; i.oninput = () => ex.attr = i.value; w.append(row('MU attribute', i, '그 속성 값이 2 면 2번째 후속 객체로')); }
      w.append(row('후속 객체 (Show successors)', succ.length ? succ.map((x, i) => `${i + 1}. ${esc(x)}`).join('<br>') : '<span style="color:#c62828">연결 없음 — Connector 로 이어 주세요</span>'));
    };
    draw();
    Object.defineProperty(w, 'value', { get: () => clone(ex) }); return w;
  }
  function statsPane(name, o) {
    const w = document.createElement('div'); w.className = 'statpane'; w.dataset.obj = name;
    w.paint = () => {
      const sim = S.sim; if (!sim || !sim.O[name]) { w.innerHTML = '<p style="color:#64748b">시뮬레이션을 시작하면 통계가 보여요. (통계 시작 시각 = EventController 의 Statistics start)</p>'; return; }
      const r = sim.stats().objects[name], pct = x => (x * 100).toFixed(2) + ' %';
      let h = `<table class="grid-t"><tr><th>통계</th><th>값</th></tr><tr><td style="padding:2px 6px">StatNumIn</td><td style="padding:2px 6px">${r.in}</td></tr><tr><td style="padding:2px 6px">StatNumOut</td><td style="padding:2px 6px">${r.out}</td></tr>`;
      if (r.work != null && (o.cls === 'Station' || o.cls === 'ParallelStation')) h += `<tr><td style="padding:2px 6px">Working</td><td style="padding:2px 6px">${pct(r.work)}</td></tr><tr><td style="padding:2px 6px">Waiting</td><td style="padding:2px 6px">${pct(r.wait)}</td></tr><tr><td style="padding:2px 6px">Blocked</td><td style="padding:2px 6px">${pct(r.blocked)}</td></tr>`;
      if (r.avg != null) h += `<tr><td style="padding:2px 6px">평균 내용물 (시간가중)</td><td style="padding:2px 6px">${r.avg.toFixed(4)}</td></tr><tr><td style="padding:2px 6px">최대 내용물</td><td style="padding:2px 6px">${r.max}</td></tr><tr><td style="padding:2px 6px">비어 있지 않은 비율</td><td style="padding:2px 6px">${pct(r.work)}</td></tr>`;
      if (o.cls === 'Drain') h += `<tr><td style="padding:2px 6px">Average lifespan (statAvgLifeSpan)</td><td style="padding:2px 6px">${ft(r.life)} (${r.life.toFixed(2)} 초)</td></tr><tr><td style="padding:2px 6px">Throughput per hour</td><td style="padding:2px 6px">${r.thru.toFixed(4)}</td></tr>`;
      if (o.cls === 'Source') h += `<tr><td style="padding:2px 6px">생성한 MU</td><td style="padding:2px 6px">${r.created}</td></tr><tr><td style="padding:2px 6px">소멸 (Non-blocking)</td><td style="padding:2px 6px">${r.lost}</td></tr>`;
      if (o.cls === 'Variable') h += `<tr><td style="padding:2px 6px">현재 값</td><td style="padding:2px 6px">${r.value}</td></tr><tr><td style="padding:2px 6px">시간가중 평균</td><td style="padding:2px 6px">${(+r.mean).toFixed(4)}</td></tr><tr><td style="padding:2px 6px">최소 / 최대</td><td style="padding:2px 6px">${r.min} / ${r.max}</td></tr>`;
      h += '</table>';
      if (o.cls === 'Station' || o.cls === 'ParallelStation') h += `<div class="statbar"><i style="width:${r.work * 100}%;background:#22c55e"></i><i style="width:${r.wait * 100}%;background:#cbd5e1"></i><i style="width:${r.blocked * 100}%;background:#facc15"></i></div><div class="legend-s"><span><i style="background:#22c55e"></i>Working</span><span><i style="background:#cbd5e1"></i>Waiting</span><span><i style="background:#facc15"></i>Blocked</span></div>`;
      if (o.cls === 'Drain' && Object.keys(r.byType).length) h += `<h4 style="margin:12px 0 4px">Type statistics</h4><table class="grid-t"><tr><th>MU</th><th>개수</th><th>평균 체류</th></tr>${Object.entries(r.byType).map(([k, b]) => `<tr><td style="padding:2px 6px">${esc(k)}</td><td style="padding:2px 6px">${b.n}</td><td style="padding:2px 6px">${ft(b.life / b.n)}</td></tr>`).join('')}</table>`;
      w.innerHTML = h + `<p style="font-size:11.5px;color:#64748b">측정 구간 ${ft(sim.t - sim.t0, true)} (시뮬레이션 시각 ${ft(sim.t, true)})</p>`;
    };
    w.paint(); return w;
  }
  function refreshOpenStats() { $$('.statpane').forEach(p => p.paint && p.paint()); $$('.tablegrid').forEach(t => t.paintLive && t.paintLive()); }

  /* ---------- 객체별 대화상자 ---------- */
  function nameHead(name) { const h = document.createDocumentFragment(); const lab = document.createElement('label'); lab.textContent = 'Name:'; const i = document.createElement('input'); i.type = 'text'; i.value = name; h.append(lab, i, document.createElement('span')); return { h, i }; }
  function openDialog(name, opt = {}) {
    const o = S.model.objects[name]; if (!o) return;
    if (o.cls === 'Method') return openMethod(name, opt);
    if (o.cls === 'DataTable') return openTable(name);
    if (o.cls === 'EventController') return openEC(name);
    if (o.cls === 'ExperimentManager') return openEM(name);
    const { h, i: nmIn } = nameHead(name), tabs = [], getters = [];
    const timeIn = (v) => { const x = el(`<input type="text" class="tm" value="${v === '' || v == null ? '' : esc(ft(+v))}">`).firstChild; return x; };
    const P = (title, rows) => { const w = document.createElement('div'); rows.forEach(r => w.append(r)); tabs.push([title, w]); };
    if (o.cls === 'Source') {
      const mode = el(`<label><input type="checkbox" ${o.mode === 'blocking' ? 'checked' : ''}> Blocking</label>`), iv = distEditor(o.interval), st = timeIn(o.start), sp = timeIn(o.stop), am = el(`<input type="number" min="0" value="${esc(o.amount)}" style="width:90px">`).firstChild;
      const ms = el(`<select>${['Constant', 'Sequence', 'Percentage'].map(x => `<option ${x === o.musel ? 'selected' : ''}>${x}</option>`).join('')}</select>`).firstChild;
      const mu = el(`<select>${Object.keys(S.model.mus).map(x => `<option value="${esc(x)}" ${x === o.mu ? 'selected' : ''}>.MUs.${esc(x)}</option>`).join('')}</select>`).firstChild;
      const tb = el(`<select><option value=""></option>${tableNames().map(x => `<option ${x === o.table ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`).firstChild;
      const muRow = row('MU', mu), tbRow = row('Table', tb, 'DataTable: 1열 MU 경로(.MUs.myEntity1), 2열 Frequency(비율)');
      const vis = () => { muRow.style.display = ms.value === 'Constant' ? '' : 'none'; tbRow.style.display = ms.value === 'Constant' ? 'none' : ''; }; ms.onchange = vis; vis();
      P('Attributes', [row('Operating mode', mode, '켜면 Blocking: 뒤가 막히면 Source 도 기다림 · 끄면 만든 MU 를 버림(손님 이탈)'), row('Time of creation', '<span>Interval adaptable</span>'), row('Interval', iv, '시간은 Plant Sim 형식: 6:00 = 6분, 1:00:00 = 1시간, 숫자만 = 초'), row('Start', st), row('Stop', sp, '비우면 끝까지'), row('Amount', am, '비우면 무제한'), row('MU selection', ms), muRow, tbRow]);
      getters.push(() => { o.mode = $('input', mode).checked ? 'blocking' : 'non-blocking'; o.interval = iv.value; o.start = pt(st.value) || 0; o.stop = sp.value.trim() === '' ? '' : pt(sp.value); o.amount = am.value; o.musel = ms.value; o.mu = mu.value; o.table = tb.value; });
    }
    if (o.cls === 'ParallelStation') { const x = el(`<input type="number" min="1" value="${o.xdim}" style="width:80px">`).firstChild, y = el(`<input type="number" min="1" value="${o.ydim}" style="width:80px">`).firstChild; P('Attributes', [row('X-dimension', x, '예제 4: 점원 수 k'), row('Y-dimension', y), row('', '<span style="color:#64748b">자리 수 = X × Y</span>')]); getters.push(() => { o.xdim = Math.max(1, +x.value || 1); o.ydim = Math.max(1, +y.value || 1); }); }
    if (o.cls === 'Station' || o.cls === 'ParallelStation') { const pe = distEditor(o.procTime, { listType: true }); P('Times', [row('Processing time', pe, 'List(Type): MU 이름별로 다른 처리시간'), row('Set-up time', '<span style="color:#94a3b8">0 (이 연습장에선 생략)</span>')]); getters.push(() => { o.procTime = pe.value; }); }
    if (o.cls === 'Buffer') { const c = el(`<input type="number" value="${o.cap}" style="width:90px">`).firstChild, dw = timeIn(o.dwell), bt = el(`<select>${['Queue', 'Stack'].map(x => `<option ${x === o.btype ? 'selected' : ''}>${x}</option>`).join('')}</select>`).firstChild;
      P('Attributes', [row('Capacity', c, '-1 = 무한'), row('Processing time', dw, '버퍼 안에서 최소로 머무는 시간 (보통 0)'), row('Buffer type', bt, 'Queue = 먼저 온 것 먼저(FIFO) · Stack = 나중 온 것 먼저(LIFO)')]); getters.push(() => { o.cap = c.value === '' ? -1 : +c.value; o.dwell = pt(dw.value) || 0; o.btype = bt.value; }); }
    if (o.cls === 'Sorter') { const c = el(`<input type="number" value="${o.cap}" style="width:90px">`).firstChild, at = el(`<input type="text" value="${esc(o.sortAttr)}" placeholder="예: aNoRecipes">`).firstChild, od = el(`<select><option value="ascending" ${o.order === 'ascending' ? 'selected' : ''}>Ascending (작은 값 먼저)</option><option value="descending" ${o.order === 'descending' ? 'selected' : ''}>Descending (큰 값 먼저)</option></select>`).firstChild;
      P('Attributes', [row('Capacity', c, '-1 = 무한')]); P('Sort', [row('Order: Sort criterion', '<span>MU attribute</span>'), row('Attribute', at, 'MU 의 사용자 정의 속성 이름'), row('Sorting order', od)]); getters.push(() => { o.cap = c.value === '' ? -1 : +c.value; o.sortAttr = at.value.trim(); o.order = od.value; }); }
    if (o.cls === 'Conveyor') { const L = el(`<input type="number" step="any" value="${o.length}" style="width:90px">`).firstChild, sp = el(`<input type="number" step="any" value="${o.speed}" style="width:90px">`).firstChild, c = el(`<input type="number" value="${o.cap}" style="width:90px">`).firstChild;
      P('Attributes', [row('Length (m)', L), row('Speed (m/s)', sp), row('Capacity', c), row('', '<span style="color:#64748b">이동시간 = 길이 ÷ 속도</span>')]); getters.push(() => { o.length = +L.value; o.speed = +sp.value || 1; o.cap = +c.value; }); }
    if (o.cls === 'Variable') { const dt = el(`<select>${['integer', 'real', 'string', 'boolean', 'time'].map(x => `<option ${x === o.dtype ? 'selected' : ''}>${x}</option>`).join('')}</select>`).firstChild, v = el(`<input type="text" value="${esc(o.value)}">`).firstChild;
      P('Value', [row('Data type', dt), row('Value (초깃값)', v, 'Reset 할 때 이 값으로 돌아가요')]); getters.push(() => { o.dtype = dt.value; o.value = PS.castVar(v.value, dt.value); }); }
    if (o.cls === 'Comment') { const t = el(`<input type="text" value="${esc(o.text)}" style="width:100%">`).firstChild; P('Text', [row('내용', t)]); getters.push(() => { o.text = t.value; }); }
    if (o.cls !== 'Drain' && o.cls !== 'Variable' && o.cls !== 'Comment' && PS.MATERIAL.has(o.cls)) { const ep = exitPane(name, o); tabs.push(['Exit Strategy', ep]); getters.push(() => { o.exit = ep.value; }); }
    if (PS.MATERIAL.has(o.cls)) {
      const rows = [], gs = [];
      if (o.cls !== 'Source' && o.cls !== 'FlowControl') { const en = ctrlSelect(o.entCtrl); rows.push(row('Entrance', en, 'MU 가 들어온 직후 실행 · @ = 들어온 MU, ? = 이 객체')); gs.push(() => o.entCtrl = en.value); }
      if (o.cls !== 'Drain') { const ex = ctrlSelect(o.exitCtrl); rows.push(row('Exit', ex, 'MU 가 나갈 준비가 되면 실행 · 메서드 안에서 @.move(목적지) 로 직접 보냄')); gs.push(() => o.exitCtrl = ex.value); }
      P('Controls', rows); getters.push(() => gs.forEach(f => f()));
    }
    if (PS.MATERIAL.has(o.cls) || o.cls === 'Variable') tabs.push(['Statistics', statsPane(name, o)]);
    dialog({ title: `${name}`, path: `.Models.Frame.${name}  (${o.cls})`, head: h, tabs, key: name, onApply: () => {
      if (S.sim && !confirm('설정을 바꾸면 시뮬레이션이 Reset 돼요. 계속할까요?')) return false;
      const nn = nmIn.value.trim(); let cur = name;
      if (nn !== name) { if (!renameObject(name, nn)) return false; cur = nn; }
      getters.forEach(f => f()); S.changed('edit:' + cur); return true; } });
  }

  /* MU 클래스 */
  function openMUDialog(n) {
    const m = S.model.mus[n]; if (!m) return; const attrs = clone(m.attrs || []);
    const { h, i: nmIn } = nameHead(n);
    const col = el(`<input type="color" value="${m.color || '#0075de'}">`).firstChild;
    const tw = document.createElement('div');
    const draw = () => { tw.innerHTML = `<table class="grid-t"><tr><th></th><th>Name</th><th>Data type</th><th>Value</th><th></th></tr>${attrs.map((a, i) => `<tr><td class="rn">${i + 1}</td><td><input data-i="${i}" data-f="name" value="${esc(a.name)}"></td><td><select data-i="${i}" data-f="type">${['integer', 'real', 'string', 'boolean', 'time', 'table'].map(t => `<option ${t === a.type ? 'selected' : ''}>${t}</option>`).join('')}</select></td><td><input data-i="${i}" data-f="value" value="${esc(a.value)}"></td><td><button class="sbtn" data-del="${i}">−</button></td></tr>`).join('')}</table><button class="sbtn" id="mu-add" style="margin-top:6px">+ 속성 추가 (New attribute)</button>`;
      $$('[data-f]', tw).forEach(x => x.oninput = x.onchange = () => attrs[+x.dataset.i][x.dataset.f] = x.value); $$('[data-del]', tw).forEach(b => b.onclick = () => { attrs.splice(+b.dataset.del, 1); draw(); }); $('#mu-add', tw).onclick = () => { attrs.push({ name: 'aAttr' + (attrs.length + 1), type: 'integer', value: 0 }); draw(); }; };
    draw();
    const w = document.createElement('div'); w.append(row('Icon 색', col), row('User-defined attributes', tw, '모든 MU 가 가질 속성 (예: aNoRecipes = 1). 파생한 MU 는 값만 바꿔 쓰면 돼요.'));
    const foot = document.createDocumentFragment();
    dialog({ title: n, path: `.MUs.${n}${m.base ? '  (' + m.base + ' 에서 파생)' : ''}`, head: h, tabs: [['User-defined Attributes', w]], key: 'mu:' + n, onApply: () => {
      const nn = nmIn.value.trim(); if (nn !== n) { if (!validName(nn) || S.model.mus[nn] || S.model.objects[nn]) { alert('쓸 수 없는 이름이에요'); return false; } S.model.mus[nn] = m; delete S.model.mus[n]; Object.values(S.model.objects).forEach(o => { if (o.mu === n) o.mu = nn; if (o.cls === 'DataTable') o.rows.forEach(r => { if (String(r[0]).split('.').pop() === n) r[0] = '.MUs.' + nn; }); }); n = nn; }
      m.attrs = attrs.filter(a => a.name.trim()).map(a => ({ name: a.name.trim(), type: a.type, value: PS.castVar(a.value, a.type) })); m.color = col.value; S.changed('mu'); return true; } });
  }

  /* Method 편집기 */
  function openMethod(name, opt = {}) {
    const o = S.model.objects[name]; const { h, i: nmIn } = nameHead(name);
    const w = document.createElement('div');
    w.innerHTML = `<div class="ed-bar"><span class="pill" style="font-size:11px;background:#e6f0fb;color:#0067c0;padding:1px 8px;border-radius:9px">SimTalk 2.0</span><button class="sbtn" data-a="check">문법 검사</button><button class="sbtn" data-a="run">실행 (Run)</button><span style="font-size:11.5px;color:#64748b">예약 이름: Init · Reset · EndSim · Tab = 들여쓰기</span></div><div class="ed"><div class="gut"></div><textarea spellcheck="false"></textarea></div><div class="ed-msg"></div>`;
    const ta = $('textarea', w), gut = $('.gut', w), msg = $('.ed-msg', w);
    ta.value = o.code || '';
    let bad = opt.errLine || 0;
    const lines = () => { const n = ta.value.split('\n').length; gut.innerHTML = Array.from({ length: n }, (_, i) => `<span class="${i + 1 === bad ? 'bad' : ''}" style="display:block">${i + 1}</span>`).join(''); gut.scrollTop = ta.scrollTop; };
    ta.addEventListener('input', () => { bad = 0; lines(); }); ta.addEventListener('scroll', () => gut.scrollTop = ta.scrollTop);
    ta.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); lines(); } if (e.key === 'F7' || (e.ctrlKey && e.key === 's')) { e.preventDefault(); apply(); } });
    lines();
    if (opt.errMsg) { msg.className = 'ed-msg err'; msg.textContent = '실행 오류: ' + opt.errMsg; }
    const check = () => { try { window.SIMTALK.parse(ta.value); msg.className = 'ed-msg ok'; msg.textContent = '문법 OK ✓'; bad = 0; lines(); return true; } catch (e) { msg.className = 'ed-msg err'; msg.textContent = `${e.line || ''}행: ${e.message}`; bad = e.line || 0; lines(); return false; } };
    $('[data-a=check]', w).onclick = check;
    $('[data-a=run]', w).onclick = () => { if (!check()) return; o.code = ta.value; save(); const sim = S.sim || new PS.Sim(S.model, { console: [] }); const before = sim.console.length; try { sim.callMethod(name, {}); msg.className = 'ed-msg ok'; msg.textContent = '실행 완료 — 출력은 아래 Console 탭'; } catch (e) { msg.className = 'ed-msg err'; msg.textContent = e.message; bad = e.line || 0; lines(); } sim.console.slice(before).forEach(l => logConsole(l)); if (S.sim) { paintDynamic(); } notify('methodrun:' + name); showBottom('console'); };
    const apply = () => { if (S.sim && o.code !== ta.value && !confirm('코드를 바꾸면 Reset 돼요. 계속할까요?')) return false; const nn = nmIn.value.trim(); let cur = name; if (nn !== name) { if (!renameObject(name, nn)) return false; cur = nn; } o.code = ta.value; check(); S.changed('edit:' + cur); return true; };
    const d = dialog({ title: name, path: `.Models.Frame.${name}  (Method)`, head: h, tabs: [['Program', w]], big: true, key: name, onApply: apply });
    setTimeout(() => ta.focus(), 30);
  }

  /* DataTable */
  function openTable(name) {
    const o = S.model.objects[name]; const { h, i: nmIn } = nameHead(name);
    const cols = clone(o.cols), rows = clone(o.rows);
    const w = document.createElement('div'); w.className = 'tablegrid';
    const draw = (live) => {
      const R = live || rows;
      w.innerHTML = `${live ? '<p style="color:#0067c0;font-size:12px;margin:0 0 6px">시뮬레이션 중인 표 내용 (Reset 하면 아래 편집 내용으로 돌아가요)</p>' : ''}<div style="overflow:auto;max-height:46vh"><table class="grid-t"><tr><th></th>${cols.map((c, j) => `<th><input data-c="${j}" data-f="name" value="${esc(c.name)}" style="font-weight:600"><select data-c="${j}" data-f="type">${['string', 'integer', 'real', 'object', 'boolean', 'time'].map(t => `<option ${t === c.type ? 'selected' : ''}>${t}</option>`).join('')}</select></th>`).join('')}</tr>${R.map((r, i) => `<tr><td class="rn">${i + 1}</td>${cols.map((c, j) => `<td><input data-r="${i}" data-j="${j}" value="${esc(r[j] ?? '')}" ${live ? 'readonly' : ''}></td>`).join('')}</tr>`).join('')}</table></div>
        ${live ? '' : '<div style="display:flex;gap:6px;margin-top:6px"><button class="sbtn" data-a="row">+ 행</button><button class="sbtn" data-a="col">+ 열</button><button class="sbtn" data-a="delrow">마지막 행 삭제</button><button class="sbtn" data-a="delcol">마지막 열 삭제</button></div>'}<p style="font-size:11.5px;color:#64748b">SimTalk: <code>${esc(name)}[열, 행]</code> 로 읽고 쓰기, <code>${esc(name)}.yDim</code> = 행 수, <code>${esc(name)}.writeRow(1, 행, 값1, 값2 …)</code></p>`;
      if (live) return;
      $$('[data-f]', w).forEach(x => x.oninput = x.onchange = () => cols[+x.dataset.c][x.dataset.f] = x.value);
      $$('[data-r]', w).forEach(x => x.oninput = () => { rows[+x.dataset.r][+x.dataset.j] = x.value; });
      $('[data-a=row]', w).onclick = () => { rows.push(cols.map(() => '')); draw(); }; $('[data-a=col]', w).onclick = () => { cols.push({ name: 'Col' + (cols.length + 1), type: 'string' }); rows.forEach(r => r.push('')); draw(); };
      $('[data-a=delrow]', w).onclick = () => { rows.pop(); draw(); }; $('[data-a=delcol]', w).onclick = () => { if (cols.length > 1) { cols.pop(); rows.forEach(r => r.pop()); draw(); } };
    };
    w.paintLive = () => { if (S.sim && S.sim.tables[name]) draw(S.sim.tables[name].rows); };
    if (S.sim && S.sim.tables[name]) draw(S.sim.tables[name].rows); else draw();
    dialog({ title: name, path: `.Models.Frame.${name}  (DataTable)`, head: h, tabs: [['Table', w]], big: true, key: name, onApply: () => { if (S.sim && !confirm('표를 바꾸면 Reset 돼요. 계속할까요?')) return false; const nn = nmIn.value.trim(); let cur = name; if (nn !== name) { if (!renameObject(name, nn)) return false; cur = nn; } o.cols = cols; o.rows = rows.map(r => r.map((v, j) => cols[j] && ['integer', 'real'].includes(cols[j].type) && v !== '' ? +v : v)); S.changed('edit:' + cur); return true; } });
  }

  /* EventController */
  function openEC() {
    const ec = S.model.ec, en = el(`<input type="text" class="tm" value="${esc(ft(pt(ec.end), true))}">`).firstChild, ss = el(`<input type="text" class="tm" value="${esc(ft(pt(ec.statStart) || 0, true))}">`).firstChild, sd = el(`<input type="number" value="${ec.seed || 1}" style="width:80px">`).firstChild;
    const w = document.createElement('div'); w.append(row('End', en, '형식 일:시:분:초 — 예) 1:00:00:00 = 1일, 30:00:00:00 = 30일'), row('Statistics start', ss, '이 시각에 통계를 0으로 초기화 = 워밍업 (4장)'), row('Random number variant (시드)', sd, '같은 값이면 같은 결과가 재현돼요'));
    const ctl = document.createElement('div'); ctl.style.cssText = 'display:flex;gap:6px;margin-top:10px'; ctl.innerHTML = '<button class="sbtn" data-a="reset">⟲ Reset</button><button class="sbtn pri" data-a="start">▶ Start</button><button class="sbtn" data-a="stop">❚❚ Stop</button><button class="sbtn" data-a="step">⏭ Step</button>';
    w.append(ctl);
    $('[data-a=reset]', ctl).onclick = resetSim; $('[data-a=start]', ctl).onclick = play; $('[data-a=stop]', ctl).onclick = stop; $('[data-a=step]', ctl).onclick = stepOne;
    dialog({ title: 'EventController', path: '.Models.Frame.EventController', tabs: [['Settings', w]], key: 'EventController', onApply: () => { const e = pt(en.value); if (!(e > 0)) { alert('End 시각을 확인하세요'); return false; } ec.end = e; ec.statStart = pt(ss.value) || 0; ec.seed = +sd.value || 1; S.changed('ec'); return true; } });
  }

  /* ExperimentManager */
  function openEM(name) {
    const o = S.model.objects[name]; const em = { outputs: clone(o.outputs || []), inputs: clone(o.inputs || []), exps: clone(o.exps || []), obs: o.obs || 5 };
    const w = document.createElement('div'), res = document.createElement('div');
    const list = (arr, label, ph) => { const b = document.createElement('div'); const draw = () => { b.innerHTML = `<table class="grid-t">${arr.map((p, i) => `<tr><td class="rn">${i + 1}</td><td><input data-i="${i}" value="${esc(p)}" placeholder="${ph}" style="min-width:220px"></td><td><button class="sbtn" data-d="${i}">−</button></td></tr>`).join('')}</table><button class="sbtn" style="margin-top:4px">+ ${label}</button>`; $$('input', b).forEach(x => x.oninput = () => { arr[+x.dataset.i] = x.value.trim(); }); $$('[data-d]', b).forEach(x => x.onclick = () => { arr.splice(+x.dataset.d, 1); if (arr === em.inputs) em.exps.forEach(r => r.splice(+x.dataset.d, 1)); draw(); drawExps(); }); $('button:last-child', b).onclick = () => { arr.push(''); if (arr === em.inputs) em.exps.forEach(r => r.push('')); draw(); drawExps(); }; }; draw(); return b; };
    const exb = document.createElement('div');
    const drawExps = () => { exb.innerHTML = `<table class="grid-t"><tr><th>Exp</th>${em.inputs.map(p => `<th>${esc(p || '?')}</th>`).join('')}<th></th></tr>${em.exps.map((r, i) => `<tr><td class="rn">Exp ${i + 1}</td>${em.inputs.map((_, j) => `<td><input data-r="${i}" data-j="${j}" value="${esc(r[j] ?? '')}"></td>`).join('')}<td><button class="sbtn" data-d="${i}">−</button></td></tr>`).join('')}</table><button class="sbtn" style="margin-top:4px">+ 실험 추가</button>`;
      $$('[data-r]', exb).forEach(x => x.oninput = () => em.exps[+x.dataset.r][+x.dataset.j] = x.value === '' ? '' : +x.value); $$('[data-d]', exb).forEach(x => x.onclick = () => { em.exps.splice(+x.dataset.d, 1); drawExps(); }); $('button:last-child', exb).onclick = () => { em.exps.push(em.inputs.map(() => '')); drawExps(); }; };
    drawExps();
    const ob = el(`<input type="number" min="1" max="50" value="${em.obs}" style="width:70px">`).firstChild; ob.oninput = () => em.obs = +ob.value;
    w.append(row('Output values', list(em.outputs, '출력', '예: Drain.StatNumIn, vTotalProfit'), 'Drain.StatNumIn · Drain.statAvgLifeSpan · 변수 이름 …'), row('Input values', list(em.inputs, '입력', '예: Window.XDim'), '객체.XDim · 객체.Capacity · 객체.ProcTime · Source.Interval · 변수 이름'), row('Experiments', exb), row('Observations per experiment', ob, '실험마다 반복 횟수 (서로 다른 난수)'));
    const runB = document.createElement('button'); runB.className = 'sbtn pri'; runB.textContent = '▶ 실험 실행 (Start)';
    res.innerHTML = '<p style="color:#64748b">Define 탭에서 설정하고 실행하세요.</p>';
    runB.onclick = () => {
      o.outputs = em.outputs.filter(Boolean); o.inputs = em.inputs.filter(Boolean); o.exps = em.exps; o.obs = em.obs; save();
      if (!o.outputs.length || !o.inputs.length || !o.exps.length) { alert('출력·입력·실험을 하나 이상 넣으세요'); return; }
      res.innerHTML = '<p>실행 중…</p>'; $$('.dlg-tabs button', d)[1].click();
      setTimeout(() => {
        try {
          const R = PS.runExperiments(S.model, o);
          o.results = R.map(r => ({ row: r.row, sum: r.sum }));
          res.innerHTML = `<table class="grid-t"><tr><th>Exp</th>${o.inputs.map(p => `<th>${esc(p)}</th>`).join('')}${o.outputs.map(p => `<th>${esc(p)} 평균</th><th>표준편차</th><th>95% 반폭</th>`).join('')}</tr>${R.map((r, i) => `<tr><td class="rn">Exp ${i + 1}</td>${r.row.map(v => `<td style="padding:2px 6px">${esc(v)}</td>`).join('')}${r.sum.map(s => `<td style="padding:2px 6px;font-weight:600">${(+s.mean).toFixed(3)}</td><td style="padding:2px 6px">${(+s.sd).toFixed(3)}</td><td style="padding:2px 6px">${isFinite(s.hw) ? (+s.hw).toFixed(3) : '—'}</td>`).join('')}</tr>`).join('')}</table><p style="font-size:11.5px;color:#64748b">실험마다 ${o.obs}회 관측 · 신뢰구간 = 평균 ± 반폭. 구간이 겹치면 차이가 있다고 말하기 어려워요.</p><div id="em-plot-${esc(name)}"></div>`;
          if (window.PLOT) { const s0 = R.map(r => r.sum[0]); const ymax = Math.max(...s0.map(s => s.mean + (isFinite(s.hw) ? s.hw : 0))), ymin = Math.min(0, ...s0.map(s => s.mean - (isFinite(s.hw) ? s.hw : 0)));
            PLOT($(`#em-plot-${CSS.escape(name)}`, res), { w: 520, h: 200, xmin: .5, xmax: R.length + .5, xticks: R.length, ymin, ymax: ymax * 1.08 || 1, series: [{ type: 'bar', data: s0.map((s, i) => [i + .7, i + 1.3, s.mean]), color: '#62aef0' }, ...s0.map((s, i) => ({ type: 'line', data: [[i + 1, s.mean - s.hw], [i + 1, s.mean + s.hw]], color: '#000', w: 2 }))], xlabel: 'Exp 번호', ylabel: o.outputs[0] }); }
          save(); notify('experiment');
        } catch (e) { res.innerHTML = `<p style="color:#c62828">오류: ${esc(e.message)}</p>`; }
      }, 30);
    };
    const def = document.createElement('div'); def.append(w, runB);
    const d = dialog({ title: name, path: `.Models.Frame.${name}  (ExperimentManager)`, tabs: [['Define', def], ['Results', res]], big: true, key: name, onApply: () => { o.outputs = em.outputs.filter(Boolean); o.inputs = em.inputs.filter(Boolean); o.exps = em.exps; o.obs = em.obs; save(); notify('edit:' + name); return true; } });
    if (o.results) { res.innerHTML = '<p style="color:#64748b">이전 결과가 있어요 — 다시 실행하면 갱신돼요.</p>'; }
  }
  S.openDialog = openDialog;

  /* ---------- 아래 패널 ---------- */
  function showBottom(k) { $$('.bt-tabs [data-bt]').forEach(b => b.classList.toggle('on', b.dataset.bt === k)); $$('.bt-pane').forEach(p => p.hidden = p.id !== 'bt-' + k); if (k === 'trace') paintTrace(); if (k === 'ev') paintEvents(); $('.ps-bottom').classList.remove('min'); }

  /* ---------- 파일 메뉴 ---------- */
  function fileMenu(btn) {
    const r = btn.getBoundingClientRect(), items = [['새 모델 (빈 Frame)', () => { if (confirm('지금 Frame 을 비울까요?')) { S.setModel(PS.newModel()); save(); notify('new'); } }], ['-']];
    (window.PS_EXAMPLES || []).forEach(ex => items.push([`예제 열기: ${ex.title}`, () => { if (confirm(`'${ex.title}' 예제를 열면 지금 Frame 이 바뀌어요. 계속할까요?`)) { S.setModel(ex.build()); save(); notify('new'); } }]));
    items.push(['-'], ['모델 파일로 저장 (.json)', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S.model, null, 1)], { type: 'application/json' })); a.download = 'plantsim-model.json'; a.click(); }], ['모델 파일 열기 (.json)', () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json'; i.onchange = () => { const f = i.files[0]; if (!f) return; f.text().then(t => { try { S.setModel(JSON.parse(t)); save(); notify('new'); } catch (e) { alert('파일을 읽을 수 없어요'); } }); }; i.click(); }]);
    ctxMenu(r.left, r.bottom + 2, items);
  }

  /* ---------- 시작 ---------- */
  function renderAll() { renderLib(); renderToolbox(); renderFrame(); paintStatus(); }
  S.boot = function (initial) {
    const root = $('#ps-root');
    root.innerHTML = `
    <div class="ps-ribbon">
      <div class="grp"><button class="rb" data-menu="file" id="rb-file"><span class="ic">📁</span>File</button><span class="gl">파일</span></div>
      <div class="grp"><button class="rb" id="rb-reset" title="Reset: 시각 0, 통계·MU 초기화"><span class="ic">⟲</span>Reset</button><button class="rb" id="rb-play"><span class="ic">▶</span>Start</button><button class="rb" id="rb-step" title="사건 하나만 실행 (Step)"><span class="ic">⏭</span>Step</button><button class="rb" id="rb-fast" title="애니메이션 없이 End 까지"><span class="ic">⏩</span>Fast</button><span class="gl">EventController</span></div>
      <div class="grp"><div style="display:grid;gap:2px"><span class="ps-time" id="ps-time">0:00:00:00</span><span class="lbl" id="ps-end"></span></div><span class="gl">시뮬레이션 시각</span></div>
      <div class="grp"><div style="display:grid;gap:2px"><input type="range" id="ps-speed" min="0" max="10" step="1" value="6"><span class="lbl" id="ps-speedv"></span></div><span class="gl">속도</span></div>
      <div class="grp"><button class="rb" id="rb-ec"><span class="ic">⏱</span>설정</button><button class="rb" id="rb-del" title="선택한 객체/연결 삭제 (Delete)"><span class="ic">🗑</span>Delete</button><span class="gl">편집</span></div>
      <div class="grp" style="margin-left:auto;border-right:0"><button class="rb on" id="rb-guide"><span class="ic">📘</span>실습 가이드</button><span class="gl">보기</span></div>
    </div>
    <div class="ps-main" id="ps-main">
      <div class="ps-lib"><div class="ttl">Class Library</div><ul class="tree" id="ps-tree"></ul><div class="libbtns"><button id="mu-dup" title="선택한 MU 를 복제 (Duplicate)">MU 복제</button><button id="mu-der" title="선택한 MU 에서 파생 (Derive)">MU 파생</button></div></div>
      <div class="ps-center"><div class="ps-toolbox"><div class="tb-tabs" id="tb-tabs"></div><div class="tb-icons" id="tb-icons"></div></div>
        <div class="ps-framewin"><div class="fw-title"><span style="font-weight:600">Frame</span><span class="path">.Models.Frame</span><span class="hint" id="fw-hint">도구 상자에서 끌어다 놓기 또는 클릭 후 Frame 클릭 · 더블클릭 = 설정 · Delete = 삭제</span></div><div id="ps-frame"></div></div></div>
      <div class="ps-guide" id="ps-guide"><div class="pane-ttl">📘 실습 가이드</div><div class="g-body" id="g-body"></div></div>
    </div>
    <div class="ps-bottom"><div class="bt-tabs"><button data-bt="console" class="on">Console</button><button data-bt="trace">사건 기록</button><button data-bt="ev">Event list</button><span class="sp"></span><button id="bt-clear">지우기</button><button id="bt-min">▁</button></div>
      <div class="bt-pane" id="bt-console"><div style="color:#64748b">print 출력과 오류가 여기에 나와요.</div></div><div class="bt-pane" id="bt-trace" hidden></div><div class="bt-pane" id="bt-ev" hidden></div></div>
    <div class="ps-status"><span id="ps-state"></span><span id="ps-wip"></span><span id="ps-next"></span><span id="ps-steplog" style="flex:1;text-align:right;overflow:hidden;white-space:nowrap;text-overflow:ellipsis"></span></div>`;
    $('#rb-file').onclick = e => fileMenu(e.currentTarget);
    $('#rb-reset').onclick = () => { resetSim(); $('#ps-steplog').textContent = ''; notify('reset'); };
    $('#rb-play').onclick = () => S.playing ? stop() : play();
    $('#rb-step').onclick = stepOne; $('#rb-fast').onclick = fastForward; $('#rb-ec').onclick = () => openEC(); $('#rb-del').onclick = deleteSel;
    const sp = $('#ps-speed'), spv = () => { const f = Math.pow(10, S.speed / 2); $('#ps-speedv').textContent = `실제 1초 = ${f < 60 ? f.toFixed(0) + '초' : f < 3600 ? (f / 60).toFixed(1) + '분' : (f / 3600).toFixed(1) + '시간'}`; };
    sp.oninput = () => { S.speed = +sp.value; spv(); }; spv();
    $('#rb-guide').onclick = () => { $('#ps-main').classList.toggle('noguide'); $('#rb-guide').classList.toggle('on'); };
    $$('.bt-tabs [data-bt]').forEach(b => b.onclick = () => showBottom(b.dataset.bt));
    $('#bt-clear').onclick = () => { $('#bt-console').innerHTML = ''; }; $('#bt-min').onclick = () => $('.ps-bottom').classList.toggle('min');
    $('#mu-dup').onclick = () => muAction('dup'); $('#mu-der').onclick = () => muAction('derive');
    frameEvents();
    S.setModel(initial || PS.newModel());
  };
  S.icon = icon; S.resetSim = resetSim; S.showBottom = showBottom; S.renderAll = renderAll;
})();
