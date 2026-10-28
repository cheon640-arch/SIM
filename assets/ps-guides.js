/* 실습 가이드 (Plant Simulation 따라 하기) + 예제 모델
   단계마다 ok(모델) 로 자동 확인, 질문 단계는 실행 결과와 비교 */
(function () {
  const PS = window.PS, S = window.PSUI, $ = (q, r = document) => r.querySelector(q), $$ = (q, r = document) => [...r.querySelectorAll(q)];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MIN = 60, HOUR = 3600, DAY = 86400;

  /* ---------- 모델 빌더 ---------- */
  function B() {
    const m = PS.newModel(); m.objects.EventController = { cls: 'EventController', x: 40, y: 30 };
    const api = {
      m,
      add(name, cls, x, y, attrs) { m.objects[name] = { cls, x, y, ...PS.DEFAULTS[cls](), ...(attrs || {}) }; return api; },
      con(...names) { for (let i = 0; i < names.length - 1; i++) m.connectors.push([names[i], names[i + 1]]); return api; },
      mu(name, attrs, color, base) { m.mus[name] = { attrs: attrs || [], color: color || '#0075de', base }; return api; },
      end(t) { m.ec.end = t; return api; },
    };
    return api;
  }
  const neg = s => ({ t: 'Negexp', beta: s }), cst = s => ({ t: 'Const', v: s }), uni = (a, b) => ({ t: 'Uniform', a, b });
  const coffee = () => B().add('Source', 'Source', 120, 160, { interval: neg(6 * MIN) }).add('Buffer', 'Buffer', 240, 160, { cap: -1 }).add('TakeOrder', 'Station', 360, 160, { procTime: neg(3 * MIN) }).add('Drain', 'Drain', 480, 160).con('Source', 'Buffer', 'TakeOrder', 'Drain').end(30 * DAY);
  const recipes = () => {
    const b = coffee(); const at = v => [{ name: 'aNoRecipes', type: 'integer', value: v }, { name: 'aArrTime', type: 'real', value: 0 }];
    b.mu('myEntity', at(0), '#64748b').mu('myEntity1', at(1), '#0075de', 'myEntity').mu('myEntity2', at(2), '#f64932', 'myEntity').mu('myEntity3', at(3), '#ffb110', 'myEntity');
    b.add('tbEntity', 'DataTable', 120, 300, { cols: [{ name: 'MU', type: 'object' }, { name: 'Frequency', type: 'real' }], rows: [['.MUs.myEntity1', .5], ['.MUs.myEntity2', .3], ['.MUs.myEntity3', .2]] });
    const o = b.m.objects; o.Source.musel = 'Percentage'; o.Source.table = 'tbEntity';
    o.TakeOrder.procTime = { t: 'ListType', list: { myEntity1: neg(3 * MIN), myEntity2: neg(4 * MIN), myEntity3: neg(5 * MIN) } };
    b.add('vWIP', 'Variable', 240, 300, { dtype: 'integer', value: 0 });
    b.add('tbSystemLog', 'DataTable', 360, 300, { cols: [{ name: 'Name', type: 'string' }, { name: 'Arrival', type: 'real' }, { name: 'Departure', type: 'real' }, { name: 'TimeInSystem', type: 'real' }], rows: [] });
    b.add('mCustArrival', 'Method', 240, 400, { code: '-- Buffer 의 Entrance control\nvWIP += 1\n@.aArrTime := EventController.SimTime' });
    b.add('mLeaveSys', 'Method', 480, 400, { code: '-- Drain 의 Entrance control\nvWIP -= 1\ntbSystemLog.writeRow(1, tbSystemLog.yDim + 1, @.Name, @.aArrTime, EventController.SimTime, EventController.SimTime - @.aArrTime)' });
    b.add('Init', 'Method', 120, 400, { code: '-- Init 버튼/시작 때 자동 실행\ntbSystemLog.delete' });
    o.Buffer.entCtrl = 'mCustArrival'; o.Drain.entCtrl = 'mLeaveSys'; b.end(DAY);
    return b;
  };
  const EX = [
    { id: 'coffee', title: '커피 부스 (1장)', build: () => coffee().m },
    { id: 'recipes', title: '수정된 커피 부스 — MU·DataTable·Method (2장 예제1)', build: () => recipes().m },
    { id: 'block', title: '버퍼와 블로킹 (2장)', build: () => B().add('Source', 'Source', 100, 160, { interval: neg(75) }).add('S1', 'Station', 220, 160, { procTime: neg(60) }).add('Buffer', 'Buffer', 340, 160, { cap: 2 }).add('S2', 'Station', 460, 160, { procTime: neg(60) }).add('Drain', 'Drain', 580, 160).con('Source', 'S1', 'Buffer', 'S2', 'Drain').end(5 * DAY).m },
    { id: 'mill', title: '밀링 병목 → 밀링기 추가 (2장 예제2)', build: () => B().add('Source', 'Source', 100, 180, { interval: neg(5 * MIN) }).add('CutToSize', 'Station', 220, 180, { procTime: uni(3 * MIN, 5 * MIN) }).add('Milling', 'Station', 360, 120, { procTime: uni(5 * MIN, 7 * MIN) }).add('Milling2', 'Station', 360, 240, { procTime: cst(3 * MIN) }).add('Drain', 'Drain', 500, 180).con('Source', 'CutToSize', 'Milling', 'Drain').con('CutToSize', 'Milling2', 'Drain').end(2 * DAY).m },
    { id: 'drive', title: '드라이브스루 k 최적화 — ExperimentManager (2장 예제4)', build: () => { const b = B().add('Source', 'Source', 100, 160, { interval: neg(6 * MIN), mode: 'non-blocking' }).add('Buffer', 'Buffer', 220, 160, { cap: 5 }).add('Window', 'ParallelStation', 340, 160, { xdim: 1, procTime: neg(8 * MIN) }).add('Drain', 'Drain', 460, 160).con('Source', 'Buffer', 'Window', 'Drain').end(30 * DAY);
      b.add('vProfitPerMonth', 'Variable', 100, 300, { dtype: 'real' }).add('vCostForHiring', 'Variable', 100, 360, { dtype: 'real' }).add('vTotalProfit', 'Variable', 100, 420, { dtype: 'real' });
      b.add('EndSim', 'Method', 340, 320, { code: '-- 종료 시 자동 실행 (예약 이름 EndSim)\nvProfitPerMonth := 3 * Drain.StatNumIn\nvCostForHiring := 4000 * Window.XDim + 500 * 6\nvTotalProfit := vProfitPerMonth - vCostForHiring' });
      b.add('ExperimentManager', 'ExperimentManager', 460, 320, { outputs: ['vTotalProfit'], inputs: ['Window.XDim', 'Buffer.Capacity'], exps: [[1, 5], [2, 4], [3, 3], [4, 2]], obs: 5 }); return b.m; } },
    { id: 'pipe', title: '파이프 절단·굽힘·청동 (2장 예제5)', build: () => B().add('Source', 'Source', 80, 180, { interval: neg(15 * MIN) }).add('bf01', 'Buffer', 180, 180, { cap: -1 }).add('FC', 'FlowControl', 280, 180, { exit: { strategy: 'percentage', blocking: false, pct: [70, 30], attr: '' } })
      .add('bfCut', 'Buffer', 380, 100, { cap: -1 }).add('Cutting', 'Station', 480, 100, { procTime: { t: 'Lognorm', mu: 10 * MIN, sigma: 5 * MIN } }).add('bfBend', 'Buffer', 380, 260, { cap: -1 }).add('Bending', 'Station', 480, 260, { procTime: { t: 'Lognorm', mu: 20 * MIN, sigma: 5 * MIN } })
      .add('bfBronze', 'Buffer', 600, 260, { cap: 10 }).add('Bronzing', 'ParallelStation', 700, 260, { xdim: 3, procTime: { t: 'Triangle', c: 20 * MIN, a: 10 * MIN, b: 30 * MIN } }).add('Drain', 'Drain', 800, 260)
      .con('Source', 'bf01', 'FC', 'bfCut', 'Cutting', 'bfBend').con('FC', 'bfBend', 'Bending', 'bfBronze', 'Bronzing', 'Drain').end(10 * DAY).m },
    { id: 'route', title: 'Exit control 로 타입별 라우팅 (5장)', build: () => B().mu('PartA', [], '#0075de').mu('PartB', [], '#f64932').add('tbMix', 'DataTable', 100, 300, { cols: [{ name: 'MU', type: 'object' }, { name: 'Frequency', type: 'real' }], rows: [['.MUs.PartA', .6], ['.MUs.PartB', .4]] })
      .add('Source', 'Source', 100, 170, { interval: neg(2 * MIN), musel: 'Percentage', table: 'tbMix' }).add('Buffer', 'Buffer', 220, 170, { cap: -1, exitCtrl: 'mRoute' }).add('StationA', 'Station', 360, 100, { procTime: neg(2.5 * MIN) }).add('StationB', 'Station', 360, 240, { procTime: neg(3 * MIN) }).add('Drain', 'Drain', 500, 170)
      .add('mRoute', 'Method', 220, 320, { code: '-- Buffer 의 Exit control: 타입별로 보낼 곳을 정함\nif @.Name = "PartA"\n  @.move(StationA)\nelse\n  @.move(StationB)\nend' })
      .con('Source', 'Buffer', 'StationA', 'Drain').con('Buffer', 'StationB', 'Drain').end(DAY).m },

    { id: 'door-asis', title: '팀 프로젝트: 도어 라인 AS-IS (컨베이어 직렬)', build: () => doorLine('asis') },
    { id: 'door-tobe', title: '팀 프로젝트: 도어 라인 TO-BE (필요한 스테이션만 · 버퍼)', build: () => doorLine('tobe') },
  ];
  /* 도어 라인: 공정시간표_확정안 기준 (A56 : B22 : C22, 초) */
  function doorLine(mode) {
    const ST = [['WStrip', 65, 56, 69], ['Assy1', 78, 61, 53], ['Bezel', 60, 75, 65], ['D_A', 71, 0, 0], ['E_B', 0, 53, 0], ['F_C', 0, 0, 75], ['Assy3', 75, 62, 60], ['Assy4', 63, 56, 69], ['J_A', 78, 0, 0], ['K_B', 0, 75, 0], ['L_C', 0, 0, 65], ['Inspect', 75, 56, 75]];
    const T = ['A', 'B', 'C'], b = B();
    b.mu('A', [{ name: 'aStep', type: 'integer', value: 0 }], '#0075de').mu('B', [{ name: 'aStep', type: 'integer', value: 0 }], '#f64932').mu('C', [{ name: 'aStep', type: 'integer', value: 0 }], '#ffb110');
    b.add('tbMix', 'DataTable', 80, 440, { cols: [{ name: 'MU', type: 'object' }, { name: 'Frequency', type: 'real' }], rows: [['.MUs.A', .56], ['.MUs.B', .22], ['.MUs.C', .22]] });
    b.add('Source', 'Source', 60, 140, { interval: cst(60), musel: 'Percentage', table: 'tbMix' });
    const dist = v => v ? { t: 'Normal', mu: v, sigma: v * .1, lo: 0, hi: Infinity } : cst(0);
    const pos = i => [180 + (i % 6) * (mode === 'tobe' ? 150 : 120), i < 6 ? 140 : 300];
    ST.forEach(([n, a, bb, c], i) => {
      const [x, y] = pos(i);
      if (mode === 'tobe') b.add('bf_' + n, 'Buffer', x - 60, y, { cap: 2 });
      b.add(n, 'Station', x, y, { procTime: { t: 'ListType', list: { A: dist(a), B: dist(bb), C: dist(c) } } });
    });
    b.add('Drain', 'Drain', mode === 'tobe' ? 1080 : 900, 300);
    if (mode === 'asis') { b.con('Source', ...ST.map(r => r[0]), 'Drain'); b.end(8 * HOUR); b.m.ec.statStart = 30 * MIN; return b.m; }
    // TO-BE: 타입별 경로표 + 공통 Exit control 메서드 (AMR 이 필요한 스테이션만 방문하는 것을 근사)
    const routes = T.map((_, k) => ST.filter(r => r[k + 1] > 0).map(r => r[0]));
    const nRows = Math.max(...routes.map(r => r.length));
    b.add('tbRoute', 'DataTable', 220, 440, { cols: T.map(t => ({ name: t, type: 'string' })), rows: Array.from({ length: nRows + 1 }, (_, i) => routes.map(r => r[i] || '')) });
    b.add('Comment', 'Comment', 520, 440, { text: '스테이션 사이 이동은 mNext 의 @.move 가 결정 (Connector 없음)' });
    b.add('mNext', 'Method', 360, 440, { code: '-- Source 와 모든 스테이션의 Exit control\n-- tbRoute[타입, 순서] 에서 다음 스테이션을 찾아 그 앞 버퍼로 보냄\nvar nxt : string\nnxt := tbRoute[@.Name, @.aStep + 1]\nif nxt = ""\n  @.move(Drain)\nelse\n  if @.move(str_to_obj("bf_" + nxt))\n    @.aStep += 1\n  end\nend' });
    b.m.objects.Source.exitCtrl = 'mNext';
    // @.move(목적지) 는 Connector 가 없어도 동작 → 버퍼 → 스테이션만 연결 (AMR 이동 경로는 메서드가 결정)
    ST.forEach(([n]) => { b.m.objects[n].exitCtrl = 'mNext'; b.con('bf_' + n, n); });
    b.end(8 * HOUR); b.m.ec.statStart = 30 * MIN;
    return b.m;
  }
  window.PS_EXAMPLES = EX;

  /* ---------- 확인 도우미 ---------- */
  const objs = (m, cls) => Object.entries(m.objects).filter(([, o]) => o.cls === cls);
  const has = (m, cls) => objs(m, cls).length > 0;
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const isDist = (d, t, mean, tol = 1) => d && d.t === t && near(PS.dMean(d), mean, tol);
  const conn = (m, a, b) => m.connectors.some(c => c[0] === a && c[1] === b);
  function path(m, names) { for (let i = 0; i < names.length - 1; i++) if (!conn(m, names[i], names[i + 1])) return false; return true; }
  const one = (m, cls) => (objs(m, cls)[0] || [])[0];
  const fin = () => S.sim && S.sim.finished;
  const stat = n => S.sim ? S.sim.stats().objects[n] : null;
  function sandbox(fnName, args) { const sim = new PS.Sim(S.model, { console: [] }); const r = sim.callMethod(fnName, { args }); return { r, sim }; }
  const codeOf = n => (S.model.objects[n] && S.model.objects[n].code) || '';

  /* ---------- 실습 ---------- */
  const G = [
    { id: 'coffee', ch: '1장', title: '커피 부스 — 첫 Plant Simulation 모델', start: () => PS.newModel(),
      intro: '드라이브스루 커피 부스: 손님은 포아송 도착(시간당 10명 = 평균 6분 간격), 점원 1명이 평균 3분(지수분포) 동안 주문을 받아요. 강의 슬라이드 27~34쪽을 그대로 따라 해요.',
      steps: [
        { t: '도구 상자 <b>Material Flow</b> 탭(또는 왼쪽 Class Library 의 MaterialFlow)에서 <b>Source</b> 를 Frame 으로 끌어다 놓으세요.', ok: m => has(m, 'Source') },
        { t: '<b>Buffer</b> 를 Source 오른쪽에 놓으세요. (주차장 대기 줄)', ok: m => has(m, 'Buffer') },
        { t: '<b>Station</b> 를 놓고 더블클릭 → Name 칸에 <code>TakeOrder</code> 입력 → OK.', hint: '대화상자 맨 위 Name 칸이 객체 이름이에요. SimTalk 에서도 이 이름으로 불러요.', ok: m => m.objects.TakeOrder && m.objects.TakeOrder.cls === 'Station' },
        { t: '<b>Drain</b> 을 놓으세요.', ok: m => has(m, 'Drain') },
        { t: '도구 상자의 <b>Connector</b> 를 클릭한 다음 Source → Buffer → TakeOrder → Drain 순서로 클릭해 연결하세요. (Ctrl 을 누른 채 클릭하면 이어서 연결, Esc 로 끝)', hint: 'Connector 는 MU 가 흐르는 방향이에요. 화살표가 Drain 쪽을 향해야 해요.', ok: m => { const s = one(m, 'Source'), b = one(m, 'Buffer'), d = one(m, 'Drain'); return s && b && d && path(m, [s, b, 'TakeOrder', d]); } },
        { t: 'Source 더블클릭 → Attributes 탭 → <b>Interval</b> 을 <code>Negexp</code>, Beta = <code>6:00</code> (6분) 으로.', hint: 'Plant Sim 은 초 단위라 6:00 = 360초. 포아송 도착이면 도착 간격은 지수분포(Negexp).', ok: m => objs(m, 'Source').some(([, o]) => isDist(o.interval, 'Negexp', 360)) },
        { t: 'Buffer 더블클릭 → <b>Capacity</b> = <code>-1</code> (무한 — 주차장이 충분히 넓음).', ok: m => objs(m, 'Buffer').some(([, o]) => +o.cap < 0) },
        { t: 'TakeOrder 더블클릭 → Times 탭 → <b>Processing time</b> = <code>Negexp</code>, <code>3:00</code>.', ok: m => m.objects.TakeOrder && isDist(m.objects.TakeOrder.procTime, 'Negexp', 180) },
        { t: 'EventController(시계 아이콘) 더블클릭 → <b>End</b> = <code>30:00:00:00</code> (30일).', hint: '형식은 일:시:분:초. 길게 돌릴수록 평균이 이론값에 가까워져요.', ok: m => PS.parseTime(m.ec.end) >= 10 * DAY },
        { t: '리본의 <b>▶ Start</b> 로 애니메이션을 잠깐 보고, <b>⏩ Fast</b> 로 End 까지 실행하세요.', hint: '초록 LED = Working, 노랑 = Blocked, 회색 = Waiting(비어 있음). 버퍼 아래 숫자 = 대기 중인 손님 수.', ok: () => fin() },
        { t: 'TakeOrder 더블클릭 → <b>Statistics</b> 탭. <b>Working</b> 은 몇 % ? (정수로)', q: { ans: () => fin() && stat('TakeOrder').work * 100, tol: 1.5, unit: '%' }, after: '이론값 ρ = λ/μ = (1/6)/(1/3) = 50%. 시뮬레이션이 이론과 비슷하면 모델이 맞게 만들어진 것 (Validation).' },
        { t: 'Drain → Statistics 의 <b>Average lifespan</b> 은 몇 분? (소수 첫째 자리)', q: { ans: () => fin() && stat(one(S.model, 'Drain')).life / 60, tol: .15, unit: '분' }, after: '체류시간 W = 대기 Wq + 서비스 3분. M/M/1 이론 Wq = 3분 → W ≈ 6분.' },
        { t: 'Buffer → Statistics 의 <b>평균 내용물</b>(= 대기열 길이 Lq) 은? (소수 둘째 자리)', q: { ans: () => fin() && stat(one(S.model, 'Buffer')).avg, tol: .03, unit: '명' }, after: '이론 Lq = ρ²/(1−ρ) = 0.5. 1장의 "해석적 결과로 검증"을 Plant Sim 으로 직접 해 본 거예요.' },
      ] },
    { id: 'recipes', ch: '2장 예제 1', title: '수정된 커피 부스 — 사용자 정의 MU · DataTable · Method', start: () => coffee().end(DAY).m,
      intro: '손님마다 레시피 수가 1개(50%) · 2개(30%) · 3개(20%), 서비스 평균 3 · 4 · 5분. 1장 모델에서 시작해요. 강의 슬라이드 15~33쪽.',
      steps: [
        { t: '왼쪽 Class Library → <b>MUs</b> 의 <b>Part</b> 를 클릭해 선택 → 아래 <b>MU 복제</b> → 이름을 <code>myEntity</code> 로.', hint: '강의 슬라이드: "Duplicate Entity on MUs → MyObjects 로 옮기고 이름 바꾸기" — 2201 에서는 Entity 가 Part 예요. 열린 창의 Name 칸에서 이름을 바꾸고 OK.', ok: m => !!m.mus.myEntity },
        { t: 'myEntity 창 → <b>+ 속성 추가</b>: <code>aNoRecipes</code> (integer), <code>aArrTime</code> (real).', ok: m => m.mus.myEntity && ['aNoRecipes', 'aArrTime'].every(a => m.mus.myEntity.attrs.some(x => x.name === a)) },
        { t: 'myEntity 를 선택한 채 <b>MU 파생</b> 3번 → 각각 이름 <code>myEntity1</code>·<code>myEntity2</code>·<code>myEntity3</code>, aNoRecipes 값 <code>1</code>·<code>2</code>·<code>3</code>.', hint: '파생(Derive)한 MU 는 부모의 속성을 물려받아요. 값만 바꾸면 돼요.', ok: m => [1, 2, 3].every(k => { const u = m.mus['myEntity' + k]; return u && (u.attrs.find(a => a.name === 'aNoRecipes') || {}).value === k; }) },
        { t: 'Information Flow 탭에서 <b>DataTable</b> 을 놓고 이름 <code>tbEntity</code>. 열 2개: <code>MU</code>(object), <code>Frequency</code>(real) / 행 3개: <code>.MUs.myEntity1</code> 0.5, <code>.MUs.myEntity2</code> 0.3, <code>.MUs.myEntity3</code> 0.2', ok: m => { const t = m.objects.tbEntity; if (!t || t.cls !== 'DataTable' || t.rows.length < 3) return false; const f = {}; t.rows.forEach(r => f[String(r[0]).split('.').pop()] = +r[1]); return near(f.myEntity1, .5, .001) && near(f.myEntity2, .3, .001) && near(f.myEntity3, .2, .001); } },
        { t: 'Source → Attributes: <b>MU selection</b> = <code>Percentage</code>, <b>Table</b> = <code>tbEntity</code>.', ok: m => objs(m, 'Source').some(([, o]) => o.musel === 'Percentage' && o.table === 'tbEntity') },
        { t: 'TakeOrder → Times: Processing time 를 <code>List(Type)</code> 로 바꾸고 myEntity1 = Negexp <code>3:00</code>, myEntity2 = Negexp <code>4:00</code>, myEntity3 = Negexp <code>5:00</code>.', hint: '"How to express three cases of processing time?" — 타입별 처리시간. Entrance control 메서드에서 <code>?.ProcTime := …</code> 로 바꾸는 방법도 있어요 (5장).', ok: m => { const p = m.objects.TakeOrder && m.objects.TakeOrder.procTime; return p && p.t === 'ListType' && [3, 4, 5].every((v, i) => isDist(p.list['myEntity' + (i + 1)], 'Negexp', v * 60)); } },
        { t: '<b>Variable</b> 을 놓고 이름 <code>vWIP</code>, Data type integer, 값 0. (시스템 안 손님 수)', ok: m => m.objects.vWIP && m.objects.vWIP.cls === 'Variable' },
        { t: '<b>Method</b> 를 놓고 이름 <code>mCustArrival</code>. 내용:<pre>vWIP += 1\n@.aArrTime := EventController.SimTime</pre>그리고 Buffer → Controls → <b>Entrance</b> = mCustArrival.', hint: '@ = 메서드를 부른 MU (지금 버퍼에 들어온 손님). 시스템 진입 시각을 손님 속성에 기록해요.', ok: m => m.objects.mCustArrival && /vWIP\s*\+=\s*1|vWIP\s*:=\s*vWIP\s*\+\s*1/i.test(codeOf('mCustArrival')) && /aArrTime/i.test(codeOf('mCustArrival')) && objs(m, 'Buffer').some(([, o]) => o.entCtrl === 'mCustArrival') },
        { t: 'DataTable <code>tbSystemLog</code> (열: Name string, Arrival real, Departure real, TimeInSystem real) 을 만들고, Method <code>mLeaveSys</code>:<pre>vWIP -= 1\ntbSystemLog.writeRow(1, tbSystemLog.yDim + 1,\n  @.Name, @.aArrTime, EventController.SimTime,\n  EventController.SimTime - @.aArrTime)</pre>Drain → Controls → <b>Entrance</b> = mLeaveSys.', ok: m => m.objects.tbSystemLog && m.objects.tbSystemLog.cls === 'DataTable' && /writeRow/i.test(codeOf('mLeaveSys')) && /vWIP/i.test(codeOf('mLeaveSys')) && objs(m, 'Drain').some(([, o]) => o.entCtrl === 'mLeaveSys') },
        { t: 'Method 하나를 더 놓고 이름을 <code>Init</code> 으로 — 내용 <code>tbSystemLog.delete</code>. (예약 이름: 시작할 때 자동 실행)', ok: m => Object.keys(m.objects).some(n => n.toLowerCase() === 'init' && m.objects[n].cls === 'Method' && /delete/i.test(m.objects[n].code)) },
        { t: 'EventController End = <code>1:00:00:00</code> (1일) 로 두고 <b>⏩ Fast</b> 실행. tbSystemLog 를 더블클릭해 기록이 쌓였는지 보세요.', ok: () => fin() && S.sim.tables.tbSystemLog && S.sim.tables.tbSystemLog.rows.length > 50 },
        { t: 'vWIP → Statistics 의 <b>시간가중 평균</b> 은? (소수 둘째 자리)', q: { ans: () => fin() && S.sim.varMean('vWIP'), tol: .03 }, after: '변수의 시간가중 평균 = 시스템 안 평균 손님 수 L (4장 time-based 통계).' },
        { t: 'Drain → Statistics → <b>Type statistics</b>: myEntity3 의 평균 체류시간은 몇 분? (소수 첫째 자리)', q: { ans: () => { if (!fin()) return null; const b = stat(one(S.model, 'Drain')).byType.myEntity3; return b ? b.life / b.n / 60 : null; }, tol: .15, unit: '분' } },
      ] },
    { id: 'block', ch: '2장', title: '버퍼와 블로킹 — Blocked 상태 직접 보기', start: () => B().add('Source', 'Source', 100, 160, { interval: neg(75) }).add('S1', 'Station', 240, 160, { procTime: neg(60) }).add('S2', 'Station', 380, 160, { procTime: neg(60) }).add('Drain', 'Drain', 520, 160).con('Source', 'S1', 'S2', 'Drain').end(5 * DAY).m,
      intro: 'S1 → S2 사이에 버퍼가 없어요. 둘 다 평균 1분(지수)인데 S2 가 바쁘면 S1 은 끝낸 부품을 못 넘기고 <b>Blocked</b>(노랑) 상태가 돼요.',
      steps: [
        { t: '<b>▶ Start</b> 로 S1 의 LED 가 노랗게 되는 순간을 찾아보고, <b>⏩ Fast</b> 로 End(5일)까지 실행.', ok: () => fin() && !has(S.model, 'Buffer') },
        { t: 'S1 → Statistics: <b>Blocked</b> 는 몇 %? (정수)', q: { ans: () => fin() && !has(S.model, 'Buffer') && stat('S1').blocked * 100, tol: 2, unit: '%' } },
        { t: 'Drain 의 <b>Throughput per hour</b> 는? (정수) — 도착은 시간당 48개인데…', q: { ans: () => fin() && !has(S.model, 'Buffer') && stat('Drain').thru, tol: 1 }, after: '블로킹 때문에 라인 능력이 도착률보다 작아져서 Source 도 막혀요(Source LED 노랑).' },
        { t: 'S1 → S2 연결선을 클릭해 선택 → <b>Delete</b>. 그 사이에 <b>Buffer</b>(Capacity <code>2</code>)를 놓고 S1 → Buffer → S2 로 다시 연결.', ok: m => { const b = one(m, 'Buffer'); return b && !conn(m, 'S1', 'S2') && path(m, ['S1', b, 'S2']) && +m.objects[b].cap === 2; } },
        { t: '⟲ Reset 후 ⏩ Fast. S1 의 Blocked 는 이제 몇 %?', q: { ans: () => fin() && has(S.model, 'Buffer') && stat('S1').blocked * 100, tol: 2, unit: '%' } },
        { t: '버퍼 2칸으로 처리량은?', q: { ans: () => fin() && has(S.model, 'Buffer') && stat('Drain').thru, tol: 1 }, after: '버퍼는 두 스테이션의 변동을 떼어 놓아요(decoupling). 팀 프로젝트의 "버퍼 0/2/5/10" 실험이 바로 이것 — Capacity 를 5, 10 으로도 바꿔 보세요.' },
      ] },
    { id: 'mill', ch: '2장 예제 2', title: '밀링 병목 — 병렬 기계 추가와 Exit strategy', start: () => B().add('Source', 'Source', 100, 180, { interval: neg(5 * MIN) }).add('CutToSize', 'Station', 230, 180, { procTime: uni(3 * MIN, 5 * MIN) }).add('Milling', 'Station', 370, 120, { procTime: uni(5 * MIN, 7 * MIN) }).add('Drain', 'Drain', 510, 180).con('Source', 'CutToSize', 'Milling', 'Drain').end(2 * DAY).m,
      intro: '도착 평균 5분, CutToSize 균등(3~5분), Milling 균등(5~7분). Milling 의 ρ = 6/5 = 1.2 — 병목이에요.',
      steps: [
        { t: '⏩ Fast 로 실행 → Milling → Statistics 의 <b>Working</b> %? (정수)', q: { ans: () => fin() && !S.model.objects.Milling2 && stat('Milling').work * 100, tol: 1.5, unit: '%' }, after: '거의 100% — 쉴 틈이 없는 병목. 그 앞 CutToSize 는 Blocked 가 많을 거예요.' },
        { t: 'Drain Throughput per hour? (소수 첫째 자리)', q: { ans: () => fin() && !S.model.objects.Milling2 && stat('Drain').thru, tol: .3 } },
        { t: 'Station 을 하나 더 놓고 이름 <code>Milling2</code>, Processing time = Const <code>3:00</code> (더 빠른 새 기계).', ok: m => m.objects.Milling2 && isDist(m.objects.Milling2.procTime, 'Const', 180, 5) },
        { t: 'Connector: CutToSize → Milling2, Milling2 → Drain.', ok: m => path(m, ['CutToSize', 'Milling2']) && objs(m, 'Drain').some(([d]) => conn(m, 'Milling2', d)) },
        { t: 'Reset → ⏩ Fast. 처리량은? (소수 첫째 자리)', q: { ans: () => fin() && S.model.objects.Milling2 && stat('Drain').thru, tol: .3 }, after: '도착률 12개/시간을 거의 다 처리 — 병목 해소.' },
        { t: 'CutToSize → Exit Strategy 는 기본 <b>Cyclic</b>(차례로). <code>Start at successor 1</code> 로 바꾸고 다시 실행하면 Milling2 의 Working 은 Cyclic 때보다?', choices: ['늘어난다', '줄어든다', '같다'], a: 1, hint: 'Start at successor 1: 항상 1번 후속(먼저 연결한 Milling)부터 빈 곳을 찾아요. Show successors 순서를 확인!', after: '분기 규칙만 바꿔도 어느 기계가 일을 많이 하는지가 달라져요. 더 빠른 기계를 1번으로 두는 게 유리하죠.' },
      ] },
    { id: 'sorter', ch: '2장 예제 3', title: 'Sorter — 레시피 적은 손님 먼저', start: () => { const b = recipes(); b.m.objects.Source.interval = neg(4.5 * MIN); return b.m; },
      intro: '완성된 예제 1 모델에서 시작 (도착 간격을 4:30 으로 바쁘게 했어요). Buffer 를 Sorter 로 바꿔 1잔 손님을 먼저 처리해요.',
      steps: [
        { t: '먼저 그대로 ⏩ Fast. Drain Type statistics 에서 myEntity1 평균 체류(분)?', q: { ans: () => { if (!fin() || has(S.model, 'Sorter')) return null; const b = stat('Drain').byType.myEntity1; return b && b.life / b.n / 60; }, tol: .3, unit: '분' } },
        { t: 'Buffer 를 선택해 Delete (연결선도 같이 지워져요). <b>Sorter</b> 를 놓고 Source → Sorter → TakeOrder 연결.', ok: m => !has(m, 'Buffer') && (() => { const s = one(m, 'Sorter'); return s && path(m, ['Source', s, 'TakeOrder']); })() },
        { t: 'Sorter: Capacity <code>-1</code>, Sort 탭 Attribute = <code>aNoRecipes</code>, <code>Ascending</code>. Controls → Entrance = <code>mCustArrival</code>.', ok: m => objs(m, 'Sorter').some(([, o]) => +o.cap < 0 && o.sortAttr === 'aNoRecipes' && o.order === 'ascending' && o.entCtrl === 'mCustArrival') },
        { t: 'Reset → ⏩ Fast. myEntity1 평균 체류(분)?', q: { ans: () => { if (!fin() || !has(S.model, 'Sorter')) return null; const b = stat('Drain').byType.myEntity1; return b && b.life / b.n / 60; }, tol: .3, unit: '분' } },
        { t: 'myEntity3 (3잔) 손님은 어떻게 됐을까?', choices: ['더 짧아졌다', '더 길어졌다', '변화 없다'], a: 1, after: '짧은 작업 먼저(SPT) → 평균은 줄지만 긴 작업은 더 기다려요. 처리량(Drain StatNumIn)은 거의 같아요.' },
      ] },
    { id: 'drive', ch: '2장 예제 4', title: '드라이브스루 — ExperimentManager 로 점원 수 k 최적화', start: () => B().add('Source', 'Source', 100, 160, { interval: neg(6 * MIN) }).add('Buffer', 'Buffer', 220, 160, { cap: 5 }).add('Window', 'ParallelStation', 340, 160, { xdim: 1, procTime: neg(8 * MIN) }).add('Drain', 'Drain', 460, 160).con('Source', 'Buffer', 'Window', 'Drain').end(30 * DAY).m,
      intro: '시간당 10명 도착, 서비스 평균 8분, 창구 앞 공간 6칸(서비스 중 포함) — 꽉 차면 손님이 떠나요. 공간 1칸 월 $500, 손님당 이익 $3, 점원 월급 $4,000. (실행 1회 = 1개월 = 30일로 줄였어요)',
      steps: [
        { t: 'Source → <b>Operating mode</b> 의 Blocking 체크를 끄세요 (Non-blocking: 자리가 없으면 손님이 떠남).', ok: m => objs(m, 'Source').some(([, o]) => o.mode !== 'blocking') },
        { t: 'Window(ParallelStation) 의 <b>X-dimension</b> = 점원 수 k. 지금 1, Buffer Capacity = 6 − k = 5 인지 확인.', ok: m => m.objects.Window && +m.objects.Window.xdim === 1 && +m.objects.Buffer.cap === 5 },
        { t: 'Variable 3개 (Data type real): <code>vProfitPerMonth</code>, <code>vCostForHiring</code>, <code>vTotalProfit</code>.', ok: m => ['vProfitPerMonth', 'vCostForHiring', 'vTotalProfit'].every(n => m.objects[n] && m.objects[n].cls === 'Variable') },
        { t: 'Method 이름 <code>EndSim</code> (종료 시 자동 실행):<pre>vProfitPerMonth := 3 * Drain.StatNumIn\nvCostForHiring := 4000 * Window.XDim + 500 * 6\nvTotalProfit := vProfitPerMonth - vCostForHiring</pre>', ok: m => { const k = Object.keys(m.objects).find(n => n.toLowerCase() === 'endsim'); return k && /vTotalProfit/i.test(m.objects[k].code) && /XDim/i.test(m.objects[k].code); } },
        { t: '⏩ Fast 실행 → Frame 의 vTotalProfit 값은? (k = 1, 정수)', q: { ans: () => fin() && S.sim.vars.vTotalProfit && S.sim.vars.vTotalProfit.v, tol: 300, unit: '$' } },
        { t: 'Tools 탭에서 <b>ExperimentManager</b> 를 놓고 더블클릭 → Output values: <code>vTotalProfit</code> / Input values: <code>Window.XDim</code>, <code>Buffer.Capacity</code> / Experiments 4개: (1, 5) (2, 4) (3, 3) (4, 2) / Observations 5.', hint: '입력 경로 이름은 객체 이름.속성 이름. 강의: "Find X-dimension from the Attribute and its name".', ok: m => objs(m, 'ExperimentManager').some(([, o]) => (o.outputs || []).some(p => /vTotalProfit/i.test(p)) && (o.inputs || []).some(p => /Window\.XDim/i.test(p)) && (o.exps || []).length >= 4) },
        { t: 'ExperimentManager 의 <b>▶ 실험 실행</b> → Results 탭. 이익이 최대인 k 는?', choices: ['k = 1', 'k = 2', 'k = 3', 'k = 4'], a: 1, after: 'k=1 은 ρ = 8/6 ≈ 1.33 이라 손님을 많이 잃고, k ≥ 3 은 더 받는 손님보다 월급이 커요. 신뢰구간(평균 ± 반폭)이 겹치지 않는지도 확인!' },
      ] },
    { id: 'pipe', ch: '2장 예제 5·6', title: '파이프 공장 — FlowControl 확률 분기', start: () => { const m = EX.find(e => e.id === 'pipe').build(); m.connectors = m.connectors.filter(c => c[0] !== 'FC'); m.objects.FC.exit = { strategy: 'cyclic', blocking: false, pct: [], attr: '' }; return m; },
      intro: '시간당 4개 도착 → bf01 → 70% 는 절단 후 굽힘, 30% 는 바로 굽힘 → 청동 도금(작업자 3명, 앞 버퍼 10) → 출하. FlowControl 의 연결과 분기 규칙을 직접 설정해요.',
      steps: [
        { t: 'Connector: <b>FC → bfCut</b> 를 먼저, 그다음 <b>FC → bfBend</b>. (후속 번호 1 = bfCut, 2 = bfBend)', ok: m => m.connectors.filter(c => c[0] === 'FC').map(c => c[1]).join() === 'bfCut,bfBend' },
        { t: 'FC 더블클릭 → Exit Strategy = <code>Percentage</code>, 1번 70, 2번 30.', ok: m => { const e = m.objects.FC.exit; return e.strategy === 'percentage' && +e.pct[0] === 70 && +e.pct[1] === 30; } },
        { t: 'Cutting 의 처리시간이 Lognorm μ <code>10:00</code>, σ <code>5:00</code> 인지, Bronzing 이 X-dimension 3 · Triangle(20:00, 10:00, 30:00) 인지 열어서 확인하고 ⏩ Fast (10일).', ok: () => fin() },
        { t: 'Bending 의 Working %? (정수)', q: { ans: () => fin() && stat('Bending').work * 100, tol: 1.5, unit: '%' }, after: '굽힘 ρ = (4/60)×20 = 1.33 — 강의 수치 그대로면 굽힘이 감당 못 해요. bfBend 의 최대 내용물을 보세요.' },
        { t: '예제 6 처럼 FC 비율을 60 / 40 으로 바꾸면 Cutting 의 Working 은? (이론 ρ = 0.6 × 4/60 × 10)', q: { ans: () => fin() && +S.model.objects.FC.exit.pct[0] === 60 && stat('Cutting').work * 100, tol: 2.5, unit: '%' } },
      ] },
    { id: 'output', ch: '4장', title: '출력 분석 — 반복 실행과 워밍업', start: () => B().add('Source', 'Source', 100, 160, { interval: neg(60) }).add('Buffer', 'Buffer', 220, 160, { cap: -1 }).add('Server', 'Station', 340, 160, { procTime: neg(54) }).add('Drain', 'Drain', 460, 160).con('Source', 'Buffer', 'Server', 'Drain').end(DAY).m,
      intro: 'ρ = 0.9 인 M/M/1 (도착 평균 1:00, 서비스 0:54). 이론 체류시간 W = 1/(μ−λ) = 540초 = 9:00. 한 번 실행한 숫자를 믿어도 될까요?',
      steps: [
        { t: '⏩ Fast (End 1일). Drain Average lifespan (초)?', q: { ans: () => fin() && stat('Drain').life, tol: 8, unit: '초' } },
        { t: 'EventController → <b>Random number variant</b> = 2 로 바꾸고 다시 실행. Average lifespan (초)?', q: { ans: () => fin() && (S.model.ec.seed || 1) !== 1 && stat('Drain').life, tol: 8, unit: '초' }, after: '시드만 바꿨는데 값이 크게 달라요 — RIRO. 그래서 여러 번 반복해 신뢰구간을 봐야 해요.' },
        { t: 'ExperimentManager: Output <code>Drain.statAvgLifeSpan</code>, Input <code>Source.Interval</code>, Experiment 1개 (값 <code>60</code>), Observations <code>10</code> → 실행. 95% <b>반폭</b>은? (초, 정수)', q: { ans: () => { const e = objs(S.model, 'ExperimentManager')[0]; return e && e[1].results && e[1].results[0] && e[1].results[0].sum[0].hw; }, tol: 4, unit: '초' } },
        { t: 'EventController <b>Statistics start</b> = <code>3:00:00</code> (워밍업 3시간) 로 두고 실험을 다시 실행. 평균은 이론 540 에 가까워졌나요? 평균(초)을 적어 보세요.', q: { ans: () => { const e = objs(S.model, 'ExperimentManager')[0]; return PS.parseTime(S.model.ec.statStart) > 0 && e && e[1].results && e[1].results[0] && e[1].results[0].sum[0].mean; }, tol: 4, unit: '초' }, after: '빈 상태에서 시작한 초반 자료(초기화 편향)를 버리면 정상상태 값에 가까워져요. 반폭을 절반으로 줄이려면 관측 수를 4배로!' },
      ] },
    { id: 'simtalk', ch: '5장', title: 'SimTalk — Method 편집기 · Exit control', start: () => EX.find(e => e.id === 'route').build(),
      intro: 'A/B 부품이 섞여 오고, Buffer 의 <b>Exit control</b> 메서드 mRoute 가 타입별로 보낼 곳을 정해요. Method 편집기에서 SimTalk 2.0 을 직접 써 봐요.',
      steps: [
        { t: 'Method 를 놓고 이름 <code>Init</code>, 내용 <code>print "Hello, Plant Simulation"</code> → <b>실행(Run)</b> 버튼. 아래 Console 에 출력되면 성공.', ok: m => Object.keys(m.objects).some(n => n.toLowerCase() === 'init' && /print/i.test(m.objects[n].code)) },
        { t: 'Variable <code>vSum</code>(integer) 과 Method <code>mSum</code>: for 루프로 1~100 의 합을 vSum 에 넣으세요.', hint: '<pre>var i : integer\nvSum := 0\nfor i := 1 to 100\n  vSum += i\nnext</pre>', ok: m => { if (!m.objects.vSum || !m.objects.mSum) return false; try { const { sim } = sandbox('mSum', []); return sim.vars.vSum.v === 5050; } catch (e) { return false; } } },
        { t: 'Method <code>getMax</code>: 두 수 중 큰 값을 돌려주는 함수.<pre>param number1: integer, number2: integer -> integer</pre>로 시작하고 <code>return</code> 사용. (자동으로 getMax(3, 9), getMax(5, 2) 를 불러 확인해요)', ok: m => { if (!m.objects.getMax) return false; try { return sandbox('getMax', [3, 9]).r === 9 && sandbox('getMax', [5, 2]).r === 5 && sandbox('getMax', [4, 4]).r === 4; } catch (e) { return false; } } },
        { t: 'mRoute 를 열어 읽어 보세요. <code>@</code> 와 <code>?</code> 는 각각 무엇?', choices: ['@ = 메서드를 부른 객체, ? = MU', '@ = 메서드를 부른 MU, ? = 메서드를 부른 객체', '@ = root, ? = self'], a: 1 },
        { t: '이제 PartB 는 StationA 로, PartA 는 StationB 로 가게 mRoute 를 고치고 ⏩ Fast. (자동 확인: 사건 기록에서 잘못 간 부품이 없어야 해요)', ok: () => { if (!fin()) return false; let okA = 0, bad = 0; S.sim.trace.forEach(r => { const mm = /^(Part[AB])#\d+: Buffer → (Station[AB])/.exec(r.msg); if (mm) { if ((mm[1] === 'PartB') === (mm[2] === 'StationA')) okA++; else bad++; } }); return okA > 20 && bad === 0; } },
        { t: 'SimTalk 2.0 에서 <b>대입</b>과 <b>비교</b> 연산자는?', choices: ['대입 =, 비교 ==', '대입 :=, 비교 =', '대입 :=, 비교 :=='], a: 1, after: '17 div 5 = 3, 17 mod 5 = 2. 주석은 -- 한 줄. if … else … end, for … next, while … end, repeat … until.' },
      ] },
  ];
  window.PS_GUIDES = G;

  /* ---------- 가이드 패널 ---------- */
  const ansKey = id => 'simnote:guide:' + id;
  const getAns = id => { try { return JSON.parse(localStorage.getItem(ansKey(id))) || {}; } catch (e) { return {}; } };
  const setAns = (id, v) => { try { localStorage.setItem(ansKey(id), JSON.stringify(v)); } catch (e) {} };
  let cur = null, openHint = {};
  function stepDone(g, i, ans) { const s = g.steps[i]; if (s.q || s.choices) return !!ans[i]; try { return !!s.ok(S.model, S); } catch (e) { return false; } }
  function render() {
    const body = $('#g-body'); if (!body) return;
    const g = G.find(x => x.id === cur);
    let h = `<select id="g-sel"><option value="">— 실습 고르기 (자유 모델링) —</option>${G.map(x => `<option value="${x.id}" ${x.id === cur ? 'selected' : ''}>[${x.ch}] ${esc(x.title)}</option>`).join('')}</select>`;
    if (!g) { h += `<div class="g-intro">위에서 실습을 고르면 단계별 안내가 나오고, 모델을 만들 때마다 자동으로 확인해요.<br><br><b>자유 모델링</b>: 도구 상자에서 객체를 끌어다 놓고, Connector 로 잇고, 더블클릭으로 설정 → ▶ Start. File 메뉴에서 예제 모델을 열 수도 있어요.</div>`; body.innerHTML = h; bind(); return; }
    const ans = getAns(g.id), done = g.steps.map((_, i) => stepDone(g, i, ans)), ci = done.findIndex(d => !d), n = done.filter(Boolean).length;
    h += `<div class="g-intro"><b>${esc(g.title)}</b><br>${g.intro}</div><div style="display:flex;gap:6px;align-items:center"><button class="sbtn" id="g-restart">처음부터 다시</button><span style="font-size:12px;color:#64748b">${n} / ${g.steps.length} 단계</span></div><div class="g-prog"><i style="width:${n / g.steps.length * 100}%"></i></div><ol class="g-steps">`;
    g.steps.forEach((s, i) => {
      const st = done[i] ? 'done' : i === ci ? 'cur' : 'todo';
      h += `<li class="${st}">${s.t}`;
      if (s.hint) h += `<br><button class="hintbtn" data-h="${i}">💡 힌트</button><div class="hintbox ${openHint[i] ? 'show' : ''}">${s.hint}</div>`;
      if (s.q && !done[i]) h += `<div class="g-q"><input data-q="${i}" placeholder="답">${s.q.unit ? `<span>${esc(s.q.unit)}</span>` : ''}<button class="sbtn pri" data-qa="${i}">확인</button><span class="g-fb" data-fb="${i}"></span></div>`;
      if (s.choices && !done[i]) h += `<div style="display:grid;gap:4px;margin-top:6px">${s.choices.map((c, j) => `<button class="sbtn" style="text-align:left" data-c="${i}" data-j="${j}">${esc(c)}</button>`).join('')}<span class="g-fb" data-fb="${i}"></span></div>`;
      if ((s.q || s.choices) && done[i]) h += `<div style="font-size:12.5px;color:#0f6b3a;margin-top:3px">✓ ${esc(String(ans[i] === true ? '정답' : ans[i]))}</div>`;
      if (s.after && done[i]) h += `<div style="font-size:12.5px;background:#f1f6fc;border-radius:4px;padding:5px 7px;margin-top:5px">${s.after}</div>`;
      h += '</li>';
    });
    h += '</ol>';
    if (ci < 0) h += `<div class="g-done">🎉 실습 완료! 다른 실습을 고르거나, 값을 바꿔 가며 더 실험해 보세요.</div>`;
    body.innerHTML = h; bind();
  }
  function bind() {
    $('#g-sel').onchange = e => startGuide(e.target.value, true);
    const g = G.find(x => x.id === cur); if (!g) return;
    $('#g-restart').onclick = () => { if (confirm('이 실습의 모델과 답을 처음 상태로 되돌릴까요?')) { setAns(g.id, {}); S.tutorial = g.id; S.setModel(g.start()); S.save(); render(); } };
    $$('[data-h]').forEach(b => b.onclick = () => { openHint[b.dataset.h] = !openHint[b.dataset.h]; render(); });
    $$('[data-qa]').forEach(b => b.onclick = () => {
      const i = +b.dataset.qa, s = g.steps[i], inp = $(`[data-q="${i}"]`), fb = $(`[data-fb="${i}"]`), v = parseFloat(String(inp.value).replace(/,/g, ''));
      let want = null; try { want = s.q.ans(); } catch (e) {}
      if (want === null || want === false || want === undefined || !isFinite(want)) { fb.textContent = '먼저 위 단계대로 실행해야 확인할 수 있어요.'; fb.style.color = '#b45309'; return; }
      if (isNaN(v)) { fb.textContent = '숫자를 넣어 주세요'; fb.style.color = '#c62828'; return; }
      if (Math.abs(v - want) <= s.q.tol) { const a = getAns(g.id); a[i] = `${v}${s.q.unit ? ' ' + s.q.unit : ''} (시뮬레이션 값 ${(+want).toFixed(2)})`; setAns(g.id, a); render(); }
      else { fb.textContent = `아니에요 — 통계 창을 다시 보세요`; fb.style.color = '#c62828'; }
    });
    $$('[data-c]').forEach(b => b.onclick = () => { const i = +b.dataset.c, s = g.steps[i], j = +b.dataset.j, fb = $(`[data-fb="${i}"]`); if (j === s.a) { const a = getAns(g.id); a[i] = s.choices[j]; setAns(g.id, a); render(); } else { b.style.background = '#fdeceb'; fb.textContent = '다시 생각해 보세요'; fb.style.color = '#c62828'; } });
  }
  function startGuide(id, ask) {
    const g = G.find(x => x.id === id);
    cur = g ? id : null; openHint = {};
    try { localStorage.setItem('simnote:ps-guide', cur || ''); } catch (e) {}
    S.tutorial = cur;
    const saved = (() => { try { return JSON.parse(localStorage.getItem('simnote:ps-model:' + (cur || 'free'))); } catch (e) { return null; } })();
    S.setModel(saved || (g ? g.start() : PS.newModel()));
    if (!saved) S.save();
    render();
  }
  window.PS_START_GUIDE = startGuide;
  let rt = 0; S.onChange(w => { if (w === 'tick') return; clearTimeout(rt); rt = setTimeout(render, 60); });
})();
