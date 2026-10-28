/* sim notebook 공통: 헤더/푸터, 목차·진도, 수식, 실습(채점) 프레임워크 */
(function () {
  const CHAPTERS = [
    { id: '01', file: 'ch01-intro.html', title: '시뮬레이션 개요' },
    { id: '02', file: 'ch02-modeling.html', title: '기본 모델링' },
    { id: '03', file: 'ch03-input.html', title: '입력 모델링' },
    { id: '04', file: 'ch04-output.html', title: '출력 분석' },
    { id: '05', file: 'ch05-simtalk.html', title: 'SimTalk' },
  ];
  const TOOLS = [
    { id: 'sim', file: 'simulator.html', title: 'Plant Sim 연습장' },
    { id: 'pr', file: 'practice.html', title: '연습문제' },
    { id: 'proj', file: 'project.html', title: '팀 프로젝트' },
    { id: 'cheat', file: 'cheatsheet.html', title: '치트시트' },
  ];
  window.RL_CHAPTERS = CHAPTERS;

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem('simnote:' + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('simnote:' + k, JSON.stringify(v)); } catch (e) {} },
  };
  window.RL_STORE = store;

  const LOGO = `<svg viewBox="0 0 32 32" fill="none"><rect x="1" y="1" width="30" height="30" rx="7" fill="#fff" stroke="#000" stroke-width="1.6"/><circle cx="9" cy="16" r="3" fill="#ffb110" stroke="#000" stroke-width="1.4"/><rect x="14" y="12" width="8" height="8" rx="2" fill="#62aef0" stroke="#000" stroke-width="1.4"/><path d="M12 16h2M22 16h3" stroke="#000" stroke-width="1.4"/><path d="M25 13l3 3-3 3" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

  function header(cur) {
    const ch = CHAPTERS.map(c => `<a href="${c.file}" class="${c.id === cur ? 'on' : ''}">${c.id} ${c.title}</a>`).join('');
    const tl = TOOLS.map(t => `<a href="${t.file}" class="tool ${t.id === cur ? 'on' : ''}">${t.title}</a>`).join('');
    return `<header class="site-header"><div class="in"><a class="brand" href="index.html">${LOGO}<span>sim notebook</span></a><nav class="nav">${ch}${tl}</nav></div></header>`;
  }
  function footer() {
    return `<footer class="foot"><div class="wrap">시뮬레이션 (부산대 산업공학과 홍순도 교수, 2026) 강의자료 기반 개인 학습 노트 · Plant Simulation 실습을 브라우저에서 따라 해 볼 수 있게 만든 연습장이에요. 실제 과제·시험 답안은 Plant Simulation 결과로 확인하세요.</div></footer>`;
  }

  /* ---------- 목차 · 진도 ---------- */
  function buildToc(chId) {
    const toc = document.querySelector('.toc'); if (!toc) return;
    const secs = [...document.querySelectorAll('section.card[id]')];
    const done = store.get('done-' + chId) || {};
    toc.innerHTML = `<div class="tt">이번 장 목차</div><ol>${secs.map(s => {
      const t = s.dataset.toc || s.querySelector('h2')?.textContent.trim() || s.id;
      const pr = s.querySelector('.ps-lab') ? ' pr ps' : s.querySelector('.lab-box') ? ' pr' : '';
      return `<li><a href="#${s.id}" data-id="${s.id}" class="${done[s.id] ? 'done' : ''}${pr}"><span class="d"></span><span>${t}</span></a></li>`;
    }).join('')}</ol><div class="prog"><span class="pct"></span><div class="bar"><i></i></div></div>`;
    secs.forEach(s => {
      const b = document.createElement('button'); b.type = 'button';
      const paint = () => { const on = !!(store.get('done-' + chId) || {})[s.id]; b.className = 'done-toggle' + (on ? ' on' : ''); b.textContent = on ? '✓ 이해했어요' : '이해했으면 체크'; };
      b.onclick = () => { const d = store.get('done-' + chId) || {}; d[s.id] = !d[s.id]; store.set('done-' + chId, d); paint(); toc.querySelector(`a[data-id="${s.id}"]`).classList.toggle('done', d[s.id]); pct(); };
      paint();
      const tools = document.createElement('div'); tools.className = 'card-tools'; tools.appendChild(b); s.appendChild(tools);
    });
    store.set('total-' + chId, secs.length);
    function pct() { const d = store.get('done-' + chId) || {}, n = secs.filter(s => d[s.id]).length, p = secs.length ? Math.round(n / secs.length * 100) : 0; toc.querySelector('.pct').textContent = `${n} / ${secs.length} 섹션 (${p}%)`; toc.querySelector('.bar i').style.width = p + '%'; }
    pct();
    const links = toc.querySelectorAll('a[data-id]');
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(l => l.classList.toggle('cur', l.dataset.id === e.target.id)); }), { rootMargin: '-25% 0px -65% 0px' });
    secs.forEach(s => io.observe(s));
  }
  function chapterNav(chId) {
    const nav = document.querySelector('.ch-nav'); if (!nav) return;
    const i = CHAPTERS.findIndex(c => c.id === chId), p = CHAPTERS[i - 1], n = CHAPTERS[i + 1];
    nav.innerHTML = (p ? `<a class="btn ghost" href="${p.file}">← ${p.id} ${p.title}</a>` : `<a class="btn ghost" href="index.html">← 홈</a>`) +
      (n ? `<a class="btn ghost" href="${n.file}">${n.id} ${n.title} →</a>` : `<a class="btn ghost" href="practice.html">연습문제 풀기 →</a>`);
  }

  function renderMath(el) {
    if (window.renderMathInElement) renderMathInElement(el || document.body, { delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }], throwOnError: false });
  }
  window.RL_RENDER_MATH = renderMath;

  /* ---------- 실습 채점 ----------
     · 숫자: <input class="ans" data-a="0.5" data-tol="0.01">  (tol 생략 시 상대 1% 또는 0.01)
     · 선택: <select class="ans" data-a="값"> 또는 <div class="choices" data-a="번호(0부터)"><button>…</button></div>
     · 표 칸: <input class="cell" data-a="…">
     · 버튼: <button class="btn primary check">확인</button>  → 같은 .q (없으면 .lab-box) 안을 채점
     · .q 에 data-id 가 있으면 결과를 저장 (연습문제 오답 모음에 쓰임) */
  const RES = () => store.get('pr-results') || {};
  function saveRes(id, ok, meta) { if (!id) return; const r = RES(); r[id] = { ok, t: Date.now(), page: location.pathname.split('/').pop(), ...(meta || {}) }; store.set('pr-results', r); }
  window.SIM_SAVE_RESULT = saveRes;
  function parseNum(s) {
    s = String(s).trim().replace(/,/g, '').replace(/−/g, '-');
    if (s === '') return NaN;
    const f = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/); if (f) return +f[1] / +f[2];
    if (/%$/.test(s)) return parseFloat(s) / 100;
    return Number(s);
  }
  window.SIM_PARSE = parseNum;
  function gradeInput(inp) {
    const want = inp.dataset.a;
    let ok;
    if (inp.tagName === 'SELECT' || isNaN(Number(want))) ok = String(inp.value).trim().toLowerCase() === String(want).trim().toLowerCase();
    else {
      const v = parseNum(inp.value), a = Number(want);
      const tol = inp.dataset.tol != null ? Number(inp.dataset.tol) : Math.max(0.01, Math.abs(a) * 0.01);
      ok = !isNaN(v) && Math.abs(v - a) <= tol;
    }
    inp.classList.toggle('ok', ok); inp.classList.toggle('no', !ok);
    return ok;
  }
  function initPractice(root) {
    root.querySelectorAll('.check').forEach(btn => {
      if (btn._bound) return; btn._bound = true;
      btn.addEventListener('click', () => {
        const scope = btn.closest('.q') || btn.closest('.lab-box');
        const ins = [...scope.querySelectorAll('input.ans, select.ans, input.cell')].filter(i => i.dataset.a != null);
        if (!ins.length) return;
        const empty = ins.filter(i => String(i.value).trim() === '');
        let fb = scope.querySelector(':scope > .fb') || scope.querySelector('.fb');
        if (!fb) { fb = document.createElement('div'); fb.className = 'fb'; btn.after(fb); }
        if (empty.length === ins.length) { fb.className = 'fb no'; fb.textContent = '답을 먼저 입력하세요.'; return; }
        const n = ins.filter(gradeInput).length, all = n === ins.length;
        fb.className = 'fb ' + (all ? 'ok' : 'no');
        fb.textContent = all ? '정답이에요! ✓' : `${ins.length}개 중 ${n}개 맞았어요. 빨간 칸을 다시 보세요.`;
        const sol = scope.querySelector('details.sol'); if (sol && !all) sol.dataset.hint = '1';
        if (scope.dataset.id) saveRes(scope.dataset.id, all, { title: scope.dataset.title || '' });
      });
    });
    root.querySelectorAll('.choices[data-a]').forEach(box => {
      if (box._bound) return; box._bound = true;
      const want = +box.dataset.a, q = box.closest('.q');
      box.querySelectorAll('button').forEach((b, i) => b.addEventListener('click', () => {
        if (box.dataset.done) return; box.dataset.done = '1';
        box.querySelectorAll('button').forEach((x, j) => { x.disabled = true; if (j === want) x.classList.add('right'); else if (j === i) x.classList.add('wrong'); });
        let fb = q && q.querySelector('.fb'); if (!fb) { fb = document.createElement('div'); fb.className = 'fb'; box.after(fb); }
        fb.className = 'fb ' + (i === want ? 'ok' : 'no'); fb.textContent = i === want ? '정답! ✓' : '아쉬워요 — 초록색이 정답이에요.';
        const sol = q && q.querySelector('details.sol'); if (sol) sol.open = true;
        if (q && q.dataset.id) saveRes(q.dataset.id, i === want, { title: q.dataset.title || '' });
      }));
      const rs = document.createElement('button'); rs.type = 'button'; rs.className = 'btn sm'; rs.textContent = '↺ 다시'; rs.style.marginTop = '4px';
      rs.onclick = () => { delete box.dataset.done; box.querySelectorAll('button').forEach(x => { x.disabled = false; x.classList.remove('right', 'wrong'); }); const fb = q && q.querySelector('.fb'); if (fb) fb.textContent = ''; };
      box.after(rs);
    });
  }
  window.SIM_INIT_PRACTICE = initPractice;

  /* ---------- Plant Sim 실습 카드 ---------- */
  const GUIDES = {
    coffee: ['커피 부스 — 첫 Plant Simulation 모델', ['Source · Buffer · SingleProc(TakeOrder) · Drain 끌어다 놓기', 'Connector 로 연결', 'Interval Negexp 6:00, Processing time Negexp 3:00, Capacity −1', 'EventController End 30일 → 실행', 'Statistics 에서 Working %, Average lifespan, 평균 대기열 읽고 M/M/1 이론과 비교']],
    recipes: ['수정된 커피 부스 — 사용자 정의 MU · TableFile · Method', ['MUs: Entity 복제 → myEntity, 속성 aNoRecipes · aArrTime', '파생 myEntity1·2·3', 'TableFile tbEntity + Source MU selection Percentage', 'Processing time List(Type)', 'Variable vWIP · Method mCustArrival / mLeaveSys (Entrance control)', 'tbSystemLog 기록 · Type statistics']],
    block: ['버퍼와 블로킹', ['버퍼 없는 직렬 라인 실행 → S1 의 Blocked % 확인', '연결선 지우고 Buffer(용량 2) 끼워 넣기', '처리량 비교']],
    mill: ['밀링 병목 — 병렬 기계와 Exit strategy', ['병목 Milling 의 Working % 확인', 'Milling2(3:00) 추가 · 분기 연결', 'Cyclic vs Start at successor 1 비교']],
    sorter: ['Sorter — 레시피 적은 손님 먼저', ['Buffer 를 Sorter 로 교체', 'Sort 기준 aNoRecipes Ascending', 'Type statistics 로 타입별 체류 비교']],
    drive: ['드라이브스루 — ExperimentManager', ['Source Non-blocking (손님 이탈)', 'ParallelProc X-dimension = 점원 수 k', 'Variable 3개 + EndSim 메서드로 이익 계산', 'ExperimentManager: Input Window.XDim · Buffer.Capacity, Output vTotalProfit', '실험 결과로 최적 k 찾기']],
    pipe: ['파이프 공장 — FlowControl 확률 분기', ['FlowControl 후속 연결 순서', 'Exit strategy Percentage 70/30', 'Lognorm · Triangle 처리시간 확인', '굽힘 스테이션 이용률 > 1 확인 → 60/40 으로 바꿔 보기']],
    output: ['출력 분석 — 반복 실행과 워밍업', ['한 번 실행 → 시드 바꿔 다시 (RIRO)', 'ExperimentManager Observations 10 → 반폭', 'Statistics start(워밍업) 3시간 → 이론값과 비교']],
    simtalk: ['SimTalk — Method 편집기 · Exit control', ['Init 메서드 print → Console', 'for 루프로 1~100 합 (Variable)', 'param / return 함수 getMax', 'Exit control 로 타입별 라우팅 (@.move)']],
  };
  function initPsLabs() {
    document.querySelectorAll('.ps-lab[data-guide]').forEach(el => {
      const g = GUIDES[el.dataset.guide]; if (!g) return;
      el.innerHTML = `<div class="pl-h"><span class="pl-tag">Plant Sim 실습</span><b>${g[0]}</b></div><ol>${g[1].map(x => `<li>${x}</li>`).join('')}</ol>${el.dataset.note ? `<p class="pl-note">${el.dataset.note}</p>` : ''}<a class="btn primary" href="simulator.html?guide=${el.dataset.guide}">Plant Sim 연습장에서 열기 →</a> <span class="pl-sub">단계마다 내가 만든 모델을 자동으로 확인해요</span>`;
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const chId = document.body.dataset.ch || '', page = document.body.dataset.page || chId;
    document.body.insertAdjacentHTML('afterbegin', header(page));
    document.body.insertAdjacentHTML('beforeend', footer());
    if (chId) { buildToc(chId); chapterNav(chId); }
    initPsLabs();
    initPractice(document);
    renderMath();
  });
})();
