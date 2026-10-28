/* Plant Simulation 구조를 그대로 흉내 낸 이산사건 엔진
   모델 = { objects: {이름: {cls, x, y, ...속성}}, connectors: [[from, to]], mus: {MU이름: {attrs, color}}, ec: {end, statStart} }
   - 시간 단위: 초 (Plant Sim 과 같음). 입력은 "6:00" = 6분, "1:00:00" = 1시간
   - 이동 규칙: MU 가 나갈 준비가 되면 Exit strategy 로 후속 객체를 고르고, 받을 수 없으면 그 객체의
     Forward Blocking List(waiters)에 이름을 올리고 기다림. 자리가 나면 대기 순서대로 다시 시도.
   - Controls: Entrance control (들어온 직후), Exit control (나갈 준비가 됐을 때). @ = MU, ? = 호출한 객체 */
window.PS = (function () {
  const ST = window.SIMTALK;
  /* ---------- 난수 · 분포 (Plant Sim 이름) ---------- */
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const nrm = u => Math.sqrt(-2 * Math.log(Math.max(1e-12, u()))) * Math.cos(2 * Math.PI * u());
  const DISTS = {
    Const: { label: 'Const', p: [['v', '값']] },
    Negexp: { label: 'Negexp', p: [['beta', 'Beta (평균)']] },
    Uniform: { label: 'Uniform', p: [['a', 'Start'], ['b', 'Stop']] },
    Triangle: { label: 'Triangle', p: [['c', 'c (최빈)'], ['a', 'a (최소)'], ['b', 'b (최대)']] },
    Normal: { label: 'Normal', p: [['mu', 'μ'], ['sigma', 'σ'], ['lo', 'Lower'], ['hi', 'Upper']] },
    Lognorm: { label: 'Lognorm', p: [['mu', 'μ (평균)'], ['sigma', 'σ (표준편차)']] },
    Erlang: { label: 'Erlang', p: [['mu', 'μ'], ['sigma', 'σ']] },
  };
  const TIME_PARAMS = new Set(['v', 'beta', 'a', 'b', 'c', 'mu', 'sigma', 'lo', 'hi']);
  function sample(d, u) {
    if (d == null) return 0; if (typeof d === 'number') return d;
    switch (d.t) {
      case 'Const': return +d.v || 0;
      case 'Negexp': return -d.beta * Math.log(1 - u());
      case 'Uniform': return d.a + (d.b - d.a) * u();
      case 'Triangle': { const { a, b, c } = d; if (b <= a) return a; const F = (c - a) / (b - a), x = u(); return x < F ? a + Math.sqrt(x * (b - a) * (c - a)) : b - Math.sqrt((1 - x) * (b - a) * (b - c)); }
      case 'Normal': { const lo = d.lo ?? 0, hi = d.hi ?? Infinity; for (let k = 0; k < 100; k++) { const x = d.mu + d.sigma * nrm(u); if (x >= lo && x <= hi) return x; } return Math.max(lo, d.mu); }
      case 'Lognorm': { const m = d.mu, v = d.sigma * d.sigma, mu = Math.log(m * m / Math.sqrt(v + m * m)), sg = Math.sqrt(Math.log(1 + v / (m * m))); return Math.exp(mu + sg * nrm(u)); }
      case 'Erlang': { const k = Math.max(1, Math.round((d.mu / (d.sigma || d.mu)) ** 2)); let s = 0; for (let i = 0; i < k; i++) s += -(d.mu / k) * Math.log(1 - u()); return s; }
    }
    return 0;
  }
  function dMean(d) { if (d == null) return 0; if (typeof d === 'number') return d; return { Const: d.v, Negexp: d.beta, Uniform: (d.a + d.b) / 2, Triangle: (d.a + d.b + d.c) / 3, Normal: d.mu, Lognorm: d.mu, Erlang: d.mu }[d.t] ?? 0; }

  /* ---------- 시간 형식 ---------- */
  function parseTime(s) {
    if (typeof s === 'number') return s; s = String(s).trim(); if (s === '') return NaN;
    if (/^-?\d+(\.\d+)?$/.test(s)) return +s;
    const parts = s.split(':').map(Number); if (parts.some(isNaN)) return NaN;
    let v = 0; const mul = [1, 60, 3600, 86400]; parts.reverse().forEach((x, i) => v += x * (mul[i] || 0)); return v;
  }
  function fmtTime(sec, full) {
    if (sec == null || !isFinite(sec)) return '∞';
    const neg = sec < 0; sec = Math.abs(sec);
    const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    const ss = (Number.isInteger(+s.toFixed(4)) ? String(Math.round(s)) : (+s.toFixed(4)).toString()).replace(/^(\d)(\.|$)/, '0$1$2');
    let r;
    if (full || d) r = `${d}:${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${ss}`;
    else if (h) r = `${h}:${String(m).padStart(2, '0')}:${ss}`;
    else r = `${m}:${ss}`;
    return (neg ? '-' : '') + r;
  }

  /* ---------- 클래스 기본값 ---------- */
  const exitDef = () => ({ strategy: 'cyclic', blocking: false, pct: [], attr: '' });
  const DEFAULTS = {
    Source: () => ({ interval: { t: 'Const', v: 60 }, start: 0, stop: '', amount: '', mode: 'blocking', musel: 'Constant', mu: 'Part', table: '', exit: exitDef(), exitCtrl: '' }),
    Station: () => ({ procTime: { t: 'Const', v: 60 }, exit: exitDef(), entCtrl: '', exitCtrl: '' }),
    ParallelStation: () => ({ xdim: 2, ydim: 1, procTime: { t: 'Const', v: 60 }, exit: exitDef(), entCtrl: '', exitCtrl: '' }),
    Buffer: () => ({ cap: 10, dwell: 0, btype: 'Queue', exit: exitDef(), entCtrl: '', exitCtrl: '' }),
    Sorter: () => ({ cap: 10, sortAttr: '', order: 'ascending', exit: exitDef(), entCtrl: '', exitCtrl: '' }),
    Conveyor: () => ({ length: 10, speed: 1, cap: 10, exit: exitDef(), entCtrl: '', exitCtrl: '' }),
    FlowControl: () => ({ exit: { strategy: 'percentage', blocking: false, pct: [], attr: '' }, exitCtrl: '' }),
    Drain: () => ({ entCtrl: '' }),
    Method: () => ({ code: '' }),
    Variable: () => ({ dtype: 'integer', value: 0 }),
    DataTable: () => ({ cols: [{ name: 'Col1', type: 'string' }], rows: [] }),
    ExperimentManager: () => ({ outputs: [], inputs: [], exps: [], obs: 5 }),
    Comment: () => ({ text: '메모' }),
  };
  const MATERIAL = new Set(['Source', 'Station', 'ParallelStation', 'Buffer', 'Sorter', 'Conveyor', 'FlowControl', 'Drain']);
  function newModel() { return { objects: {}, connectors: [], mus: { Part: { attrs: [], color: '#0075de' }, Container: { attrs: [], color: '#b18164' } }, ec: { end: 86400, statStart: 0 } }; }

  /* ---------- 이벤트 큐 ---------- */
  class Heap {
    constructor() { this.a = []; }
    push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (lt(a[i], a[p])) { [a[i], a[p]] = [a[p], a[i]]; i = p; } else break; } }
    pop() { const a = this.a; if (!a.length) return null; const top = a[0], l = a.pop(); if (a.length) { a[0] = l; let i = 0; for (;;) { const L = 2 * i + 1, R = L + 1; let m = i; if (L < a.length && lt(a[L], a[m])) m = L; if (R < a.length && lt(a[R], a[m])) m = R; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } } return top; }
    peek() { return this.a[0] || null; } get size() { return this.a.length; }
  }
  const lt = (x, y) => x.t < y.t || (x.t === y.t && x.s < y.s);
  class SimError extends Error { constructor(msg, where) { super(msg); this.where = where; } }

  /* ---------- 시뮬레이션 ---------- */
  class Sim {
    constructor(model, opt = {}) {
      this.m = JSON.parse(JSON.stringify(model)); this.opt = opt;
      this.u = rng(opt.seed ?? 1); this.t = 0; this.last = 0; this.seq = 0; this.ev = new Heap();
      this.console = opt.console || []; this.muId = 0; this.mus = new Set(); this.finished = false;
      this.O = {}; this.vars = {}; this.tables = {}; this.methods = {};
      for (const [name, d] of Object.entries(this.m.objects)) {
        const o = { name, cls: d.cls, d, succ: [], pred: [], items: [], waiters: [], ptr: 0 };
        if (d.cls === 'Variable') this.vars[name] = { v: castVar(d.value, d.dtype), dtype: d.dtype, area: 0, last: 0, min: castVar(d.value, d.dtype), max: castVar(d.value, d.dtype), t0: 0 };
        if (d.cls === 'DataTable') this.tables[name] = d;
        if (d.cls === 'Method') this.methods[name] = d;
        if (d.cls === 'ParallelStation') o.n = Math.max(1, (+d.xdim || 1) * (+d.ydim || 1));
        if (d.cls === 'Station') o.n = 1;
        if (d.procTime) o.procTime = d.procTime;
        this.O[name] = o;
      }
      for (const [a, b] of this.m.connectors) if (this.O[a] && this.O[b]) { this.O[a].succ.push(b); this.O[b].pred.push(a); }
      this.resetStats();
      this.env = this.buildEnv();
      this.trace = [];
    }
    /* 시작: Init 메서드 → Source 첫 생성 예약 → 통계 시작/종료 예약 */
    init() {
      this.callNamed('init');
      for (const o of Object.values(this.O)) if (o.cls === 'Source') this.at(parseTime(o.d.start) || 0, () => this.create(o), 'create', o.name);
      const ss = parseTime(this.m.ec.statStart) || 0; if (ss > 0) this.at(ss, () => this.resetStats(), 'statStart');
      const end = parseTime(this.m.ec.end); if (isFinite(end) && end > 0) this.at(end, () => this.endSim(), 'end');
      this.started = true;
    }
    endSim() { if (this.finished) return; this.finished = true; this.acc(); this.callNamed('endsim'); this.ev = new Heap(); }
    callNamed(n) { const k = Object.keys(this.methods).find(x => x.toLowerCase() === n); if (k) this.callMethod(k, {}); }
    resetStats() {
      this.t0 = this.t;
      for (const o of Object.values(this.O)) o.st = { in: 0, out: 0, work: 0, blocked: 0, wait: 0, occ: 0, occMax: o.items.length, life: 0, lifeN: 0, lost: 0, created: 0, byType: {}, cap: 0 };
      for (const v of Object.values(this.vars)) { v.area = 0; v.last = this.t; v.t0 = this.t; v.min = v.max = v.v; }
    }
    at(t, fn, kind, who) { this.ev.push({ t, s: ++this.seq, fn, kind, who }); }
    acc() {
      const dt = this.t - this.last; if (dt > 0) {
        for (const o of Object.values(this.O)) {
          const st = o.st;
          if (o.n) { let w = 0, b = 0; for (const it of o.items) { if (it.st === 'work') w++; else b++; } st.work += w * dt; st.blocked += b * dt; st.wait += (o.n - w - b) * dt; st.cap += o.n * dt; }
          if (o.cls === 'Buffer' || o.cls === 'Sorter' || o.cls === 'Conveyor') { st.occ += o.items.length * dt; st.cap += dt; if (o.items.length) st.work += dt; else st.wait += dt; }
        }
      }
      this.last = this.t;
    }
    note(kind, msg) { if (this.trace.length > 3000) this.trace.splice(0, 1000); this.trace.push({ t: this.t, kind, msg }); }
    step() {
      const x = this.ev.pop(); if (!x) return false;
      this.t = x.t; this.acc(); this.cur = x;
      x.fn();
      return true;
    }
    runUntil(T) { while (this.ev.size && this.ev.peek().t <= T && !this.finished) this.step(); if (!this.finished && this.t < T) { this.t = T; this.acc(); } }
    run() { if (!this.started) this.init(); while (!this.finished && this.step()); return this; }

    /* ---- MU ---- */
    newMU(cls) {
      const c = this.m.mus[cls]; if (!c) throw new SimError(`MU '${cls}' 가 클래스 라이브러리에 없어요`, 'Source');
      const mu = { id: ++this.muId, name: cls, attrs: {}, created: this.t, loc: null };
      (c.attrs || []).forEach(a => mu.attrs[a.name] = castVar(a.value, a.type));
      this.mus.add(mu); return mu;
    }
    pickMU(o) {
      const d = o.d;
      if (d.musel === 'Percentage' || d.musel === 'Sequence') {
        const tb = this.tables[d.table]; if (!tb || !tb.rows.length) throw new SimError(`Source '${o.name}': MU selection 표 '${d.table}' 가 없거나 비었어요`, o.name);
        if (d.musel === 'Sequence') { const r = tb.rows[(o.seqI = ((o.seqI ?? -1) + 1) % tb.rows.length)]; return String(r[0]).split('.').pop(); }
        const tot = tb.rows.reduce((s, r) => s + (+r[1] || 0), 0); let x = this.u() * tot;
        for (const r of tb.rows) { x -= (+r[1] || 0); if (x <= 0) return String(r[0]).split('.').pop(); }
        return String(tb.rows[tb.rows.length - 1][0]).split('.').pop();
      }
      return String(d.mu || 'Part').split('.').pop();
    }
    /* ---- Source ---- */
    create(o) {
      const d = o.d, stop = parseTime(d.stop), amt = parseInt(d.amount);
      if (isFinite(stop) && this.t > stop) return;
      if (amt > 0 && (o.made || 0) >= amt) return;
      const mu = this.newMU(this.pickMU(o)); o.made = (o.made || 0) + 1; o.st.created++;
      o.items.push({ mu, st: 'ready', rt: this.t }); mu.loc = o.name;
      this.note('create', `${o.name}: ${mu.name}#${mu.id} 생성`);
      const moved = this.tryExit(o);
      const next = () => this.at(this.t + Math.max(0, sample(d.interval, this.u)), () => this.create(o), 'create', o.name);
      if (o.items.length && d.mode !== 'blocking') { const it = o.items.shift(); this.kill(it.mu); o.st.lost++; this.note('lost', `${o.name}: 받을 곳이 없어 ${mu.name}#${mu.id} 소멸 (Non-blocking)`); next(); }
      else if (!o.items.length) next();
      else o.waitNext = true; // Blocking: 나간 뒤에 다음 생성 예약
    }
    kill(mu) { this.mus.delete(mu); mu.loc = null; mu.dead = true; }

    /* ---- 받기 ---- */
    capOf(o) { switch (o.cls) { case 'Station': case 'ParallelStation': return o.n; case 'Buffer': case 'Sorter': case 'Conveyor': { const c = +o.d.cap; return c < 0 || o.d.cap === '' ? Infinity : c; } case 'Drain': return Infinity; } return 0; }
    canAccept(o, mu) {
      if (o.cls === 'FlowControl') return !!this.chooseTargets(o, mu, true).find(t => this.canAccept(this.O[t], mu));
      if (o.cls === 'Source') return false;
      if (!MATERIAL.has(o.cls)) return false;
      return o.items.length < this.capOf(o);
    }
    enter(o, mu, from) {
      mu.loc = o.name; o.st.in++;
      if (o.cls === 'FlowControl') { const it = { mu, st: 'ready', rt: this.t }; o.items.push(it); if (!this.moveOut(o, it)) { /* 받을 수 있다고 했는데 실패 */ } return; }
      if (o.cls === 'Drain') {
        const life = this.t - mu.created; o.st.life += life; o.st.lifeN++;
        const b = o.st.byType[mu.name] = o.st.byType[mu.name] || { n: 0, life: 0 }; b.n++; b.life += life;
        this.note('exit', `${o.name}: ${mu.name}#${mu.id} 도착, 체류 ${fmtTime(life)}`);
        if (o.d.entCtrl) { o.items.push({ mu, st: 'ready' }); this.callMethod(o.d.entCtrl, { mu, obj: o }); o.items = o.items.filter(i => i.mu !== mu); }
        this.kill(mu); o.st.out++; return;
      }
      const it = { mu, st: 'work', rt: Infinity, tin: this.t };
      o.items.push(it); if (o.items.length > o.st.occMax) o.st.occMax = o.items.length;
      if (o.d.entCtrl) this.callMethod(o.d.entCtrl, { mu, obj: o });
      if (mu.loc !== o.name) return; // 엔트런스 컨트롤에서 다른 곳으로 옮김
      if (o.cls === 'Station' || o.cls === 'ParallelStation') {
        const pt = Math.max(0, this.procTimeFor(o, mu));
        this.note('start', `${o.name}: ${mu.name}#${mu.id} 작업 시작 (${fmtTime(pt)})`);
        this.at(this.t + pt, () => { if (it.mu.loc !== o.name || !o.items.includes(it)) return; it.st = 'ready'; it.rt = this.t; this.note('done', `${o.name}: ${mu.name}#${mu.id} 작업 끝`); this.tryExit(o); }, 'end', o.name);
      } else if (o.cls === 'Conveyor') {
        const tt = (+o.d.length || 0) / Math.max(1e-9, +o.d.speed || 1); it.st = 'work';
        this.at(this.t + tt, () => { it.st = 'ready'; it.rt = this.t; this.tryExit(o); }, 'line', o.name);
      } else { // Buffer, Sorter
        const dw = parseTime(o.d.dwell) || 0;
        if (dw > 0) this.at(this.t + dw, () => { it.st = 'ready'; it.rt = this.t; this.tryExit(o); }, 'dwell', o.name);
        else { it.st = 'ready'; it.rt = this.t; this.tryExit(o); }
      }
    }
    procTimeFor(o, mu) {
      const p = o.procTime;
      if (p && p.t === 'ListType') { const d = p.list && p.list[mu.name]; return d ? sample(d, this.u) : 0; }
      return sample(p, this.u);
    }
    /* ---- 내보내기 ---- */
    exitOrder(o) {
      const ready = o.items.filter(i => i.st === 'ready');
      if (o.cls === 'Buffer') { if (!o.items.length) return []; const f = o.d.btype === 'Stack' ? o.items[o.items.length - 1] : o.items[0]; return f.st === 'ready' ? [f] : []; }
      if (o.cls === 'Conveyor') return o.items.length && o.items[0].st === 'ready' ? [o.items[0]] : [];
      if (o.cls === 'Sorter') { const a = o.d.sortAttr, sgn = o.d.order === 'descending' ? -1 : 1; return ready.slice().sort((x, y) => { const vx = a ? (x.mu.attrs[a] ?? 0) : 0, vy = a ? (y.mu.attrs[a] ?? 0) : 0; return vx === vy ? x.rt - y.rt : (vx < vy ? -1 : 1) * sgn; }); }
      return ready.sort((x, y) => x.rt - y.rt);
    }
    tryExit(o) {
      let guard = 0;
      for (;;) {
        const cand = this.exitOrder(o); if (!cand.length) return;
        let moved = false;
        for (const it of cand) { if (this.moveOut(o, it)) { moved = true; break; } if (o.cls === 'Buffer' || o.cls === 'Conveyor') break; }
        if (!moved || ++guard > 10000) return;
      }
    }
    chooseTargets(o, mu, dry) {
      const S = o.succ, ex = o.d.exit || exitDef(); if (!S.length) return [];
      if (mu._target && !dry) return [mu._target];
      let list;
      switch (ex.strategy) {
        case 'random': { const k = Math.floor(this.u() * S.length); list = ex.blocking ? [S[k]] : [...S.slice(k), ...S.slice(0, k)]; if (ex.blocking && !dry) mu._target = S[k]; break; }
        case 'percentage': {
          if (mu._pct && mu._pctAt === o.name) return [mu._pct];
          const p = S.map((_, i) => +ex.pct[i] || 0), tot = p.reduce((a, b) => a + b, 0) || 1; let x = this.u() * tot, k = 0; for (; k < S.length - 1; k++) { x -= p[k]; if (x <= 0) break; }
          mu._pct = S[k]; mu._pctAt = o.name; list = [S[k]]; break; }
        case 'attribute': { const v = mu.attrs[ex.attr] ?? mu.attrs[Object.keys(mu.attrs).find(k => k.toLowerCase() === String(ex.attr).toLowerCase())]; const k = Math.round(+v) - 1; list = S[k] ? [S[k]] : []; break; }
        case 'first': list = S.slice(); break;
        default: { const k = o.ptr % S.length; list = ex.blocking ? [S[k]] : [...S.slice(k), ...S.slice(0, k)]; if (ex.blocking && !dry) mu._target = S[k]; }
      }
      return list;
    }
    moveOut(o, it) {
      const mu = it.mu;
      if (o.d.exitCtrl && !it.inCtrl) {
        it.inCtrl = true; mu._try = null; mu._moved = false;
        this.callMethod(o.d.exitCtrl, { mu, obj: o });
        it.inCtrl = false;
        if (mu._moved || mu.loc !== o.name || mu.dead) return true;
        if (mu._try) { this.wait(o, [mu._try]); it.st = 'ready'; return false; }
        // 메서드가 move 를 안 하면 기본 출구 전략으로 진행
      }
      const list = this.chooseTargets(o, mu, false);
      for (const tn of list) { const t = this.O[tn]; if (this.canAccept(t, mu)) { this.transfer(o, it, t); if (o.d.exit && o.d.exit.strategy === 'cyclic' || !o.d.exit) o.ptr++; return true; } }
      if (list.length) this.wait(o, list); else if (o.cls !== 'Drain') this.note('stuck', `${o.name}: 후속 객체가 없어요 (Connector 확인)`);
      return false;
    }
    wait(o, list, depth = 0) { for (const tn of list) { const t = this.O[tn]; if (!t) continue; if (t.cls === 'FlowControl' && depth < 5) { this.wait(o, t.succ, depth + 1); continue; } if (!t.waiters.includes(o.name)) t.waiters.push(o.name); } }
    transfer(o, it, t) {
      o.items = o.items.filter(x => x !== it); o.st.out++;
      const mu = it.mu; mu._target = null; mu._pct = null; mu._moved = true;
      this.note('move', `${mu.name}#${mu.id}: ${o.name} → ${t.name}`);
      this.enter(t, mu, o);
      this.freed(o);
      if (o.cls === 'Source' && o.waitNext) { o.waitNext = false; this.at(this.t + Math.max(0, sample(o.d.interval, this.u)), () => this.create(o), 'create', o.name); }
    }
    freed(o) { if (!o.waiters.length || o.pulling) return; this.at(this.t, () => { const w = o.waiters; o.waiters = []; for (const n of w) this.tryExit(this.O[n]); }, 'pull', o.name); }
    moveMU(mu, target) { // @.move(target)
      const from = this.O[mu.loc]; if (!from) return false;
      const t = typeof target === 'string' ? this.O[target] : target;
      const it = from.items.find(i => i.mu === mu); if (!it) return false;
      if (!t) { const list = this.chooseTargets(from, mu, false); for (const tn of list) if (this.canAccept(this.O[tn], mu)) { this.transfer(from, it, this.O[tn]); return true; } mu._try = list[0]; return false; }
      if (!MATERIAL.has(t.cls)) throw new SimError(`${t.name} 로는 MU 를 옮길 수 없어요`, from.name);
      if (this.canAccept(t, mu)) { this.transfer(from, it, t); return true; }
      mu._try = t.name; return false;
    }

    /* ---- SimTalk 연결 ---- */
    buildEnv() {
      const sim = this, env = {};
      const def = (o, k, get, set) => Object.defineProperty(o, k, { enumerable: true, configurable: true, get, set });
      this.proxies = {};
      for (const o of Object.values(this.O)) {
        if (o.cls === 'Method') continue;
        if (o.cls === 'Variable') { def(env, o.name, () => this.vars[o.name].v, v => this.setVar(o.name, v)); continue; }
        if (o.cls === 'DataTable') { const tb = this.tableApi(o); env[o.name] = tb; continue; }
        const p = {}; Object.defineProperty(p, '__o', { value: o });
        def(p, 'Name', () => o.name);
        def(p, 'NumMU', () => o.items.length);
        def(p, 'Empty', () => o.items.length === 0);
        def(p, 'Full', () => o.items.length >= this.capOf(o));
        def(p, 'Occupied', () => o.items.length > 0);
        def(p, 'StatNumIn', () => o.st.in); def(p, 'StatNumOut', () => o.st.out);
        def(p, 'statAvgLifeSpan', () => o.st.lifeN ? o.st.life / o.st.lifeN : 0);
        def(p, 'StatWorkingPortion', () => this.portions(o).work); def(p, 'StatBlockingPortion', () => this.portions(o).blocked); def(p, 'StatWaitingPortion', () => this.portions(o).wait);
        def(p, 'Capacity', () => o.d.cap, v => { o.d.cap = v; });
        def(p, 'XDim', () => o.d.xdim, v => { o.d.xdim = v; o.n = Math.max(1, v * (+o.d.ydim || 1)); });
        def(p, 'ProcTime', () => dMean(o.procTime), v => { o.procTime = { t: 'Const', v: +v }; });
        def(p, 'Cont', () => o.items[0] ? this.muProxy(o.items[0].mu) : null);
        p.MU = i => o.items[i - 1] ? this.muProxy(o.items[i - 1].mu) : null;
        env[o.name] = p; this.proxies[o.name] = p;
      }
      def(env, 'EventController', () => ({ SimTime: this.t, Name: 'EventController', End: parseTime(this.m.ec.end) }));
      def(env, '@', () => this.ctx && this.ctx.mu ? this.muProxy(this.ctx.mu) : null);
      def(env, '?', () => this.ctx && this.ctx.obj ? this.proxies[this.ctx.obj.name] || null : null);
      def(env, 'self', () => this.ctx && this.ctx.self ? { Name: this.ctx.self } : null);
      def(env, 'root', () => this.proxies); def(env, 'current', () => this.proxies);
      env.str_to_obj = n => { const k = Object.keys(this.proxies).find(x => x.toLowerCase() === String(n).toLowerCase()); return k ? this.proxies[k] : null; };
      return env;
    }
    muProxy(mu) {
      const sim = this, p = {};
      Object.defineProperty(p, '__mu', { value: mu });
      Object.defineProperty(p, 'Name', { enumerable: true, get: () => mu.name });
      Object.defineProperty(p, 'ID', { enumerable: true, get: () => mu.id });
      Object.defineProperty(p, 'Location', { enumerable: true, get: () => sim.proxies[mu.loc] || null });
      for (const k of Object.keys(mu.attrs)) Object.defineProperty(p, k, { enumerable: true, get: () => mu.attrs[k], set: v => { mu.attrs[k] = v; } });
      p.move = (t) => { if (t && t.__o === undefined && t !== null && typeof t !== 'string') throw new ST.STErr('move 의 목적지는 객체여야 해요'); return sim.moveMU(mu, t ? (t.__o || t) : null); };
      p.delete = () => { const o = sim.O[mu.loc]; if (o) { o.items = o.items.filter(i => i.mu !== mu); sim.freed(o); } sim.kill(mu); return true; };
      return p;
    }
    tableApi(o) {
      const d = o.d, ci = c => { if (typeof c === 'string') { const k = d.cols.findIndex(x => x.name.toLowerCase() === c.toLowerCase()); if (k < 0) throw new ST.STErr(`${o.name} 에 '${c}' 열이 없어요`); return k; } return c - 1; };
      const api = { Name: o.name };
      Object.defineProperty(api, 'yDim', { enumerable: true, get: () => d.rows.length });
      Object.defineProperty(api, 'xDim', { enumerable: true, get: () => d.cols.length });
      api.get = (c, r) => { const k = ci(c); if (r < 1 || r > d.rows.length || k < 0 || k >= d.cols.length) throw new ST.STErr(`${o.name}[${c}, ${r}] 는 표 범위 밖이에요`); const v = d.rows[r - 1][k]; return castVar(v, d.cols[k].type); };
      api.set = (c, r, v) => { const k = ci(c); while (d.rows.length < r) d.rows.push(d.cols.map(() => '')); d.rows[r - 1][k] = v; };
      api.writeRow = (c, r, ...vals) => { vals.forEach((v, i) => api.set(c + i, r, v)); };
      api.delete = () => { d.rows.length = 0; };
      return api;
    }
    setVar(n, v) { const x = this.vars[n]; this.accVar(x); x.v = castVar(v, x.dtype); if (x.v < x.min) x.min = x.v; if (x.v > x.max) x.max = x.v; }
    accVar(x) { if (typeof x.v === 'number') x.area += x.v * (this.t - x.last); x.last = this.t; }
    varMean(n) { const x = this.vars[n]; this.accVar(x); const T = this.t - x.t0; return T > 0 ? x.area / T : x.v; }
    callMethod(name, ctx) {
      const m = this.methods[name] || this.methods[Object.keys(this.methods).find(k => k.toLowerCase() === String(name).toLowerCase())];
      if (!m) throw new SimError(`메서드 '${name}' 가 Frame 에 없어요`, ctx.obj ? ctx.obj.name : '');
      const prev = this.ctx; this.ctx = { ...ctx, self: name };
      const methods = {}; for (const k of Object.keys(this.methods)) methods[k] = ST.cachedParse(this.methods[k].code || '');
      try { return ST.run(m.code || '', { env: this.env, methods, out: this.console, name, args: ctx.args || [], rnd: this.u, limit: 500000 }).ret; }
      catch (e) { const err = new SimError(`${name} ${e.line ? e.line + '행' : ''}: ${e.message}`, name); err.method = name; err.line = e.line; throw err; }
      finally { this.ctx = prev; }
    }
    portions(o) { const st = o.st, c = st.cap || 1; return { work: st.work / c, blocked: st.blocked / c, wait: st.wait / c }; }
    /* 결과 요약 */
    stats() {
      this.acc(); const T = Math.max(1e-9, this.t - this.t0), out = {};
      for (const o of Object.values(this.O)) {
        const s = o.st, r = { cls: o.cls, in: s.in, out: s.out };
        if (o.n) Object.assign(r, this.portions(o));
        if (o.cls === 'Buffer' || o.cls === 'Sorter' || o.cls === 'Conveyor') { r.avg = s.occ / T; r.max = s.occMax; r.cur = o.items.length; r.work = s.work / T; r.wait = s.wait / T; r.blocked = 0; }
        if (o.cls === 'Drain') { r.life = s.lifeN ? s.life / s.lifeN : 0; r.thru = s.in / T * 3600; r.byType = s.byType; }
        if (o.cls === 'Source') { r.created = s.created; r.lost = s.lost; }
        if (o.cls === 'Variable') { r.value = this.vars[o.name].v; r.mean = this.varMean(o.name); r.min = this.vars[o.name].min; r.max = this.vars[o.name].max; }
        out[o.name] = r;
      }
      return { T, t: this.t, objects: out, wip: this.mus.size };
    }
    evalPath(path) { // "Drain.StatNumIn", "vProfit"
      const parts = String(path).split('.').filter(Boolean); let v = this.env;
      for (const p of parts) { if (v == null) return NaN; const k = Object.keys(v).find(x => x.toLowerCase() === p.toLowerCase()); v = k === undefined ? undefined : v[k]; }
      return v;
    }
  }
  function castVar(v, ty) {
    const t = String(ty || '').toLowerCase();
    if (t === 'integer') { const n = Number(v); return isFinite(n) ? Math.round(n) : 0; }
    if (t === 'real' || t === 'time' || t === 'length' || t === 'speed' || t === 'money') { const n = Number(v); return isFinite(n) ? n : 0; }
    if (t === 'boolean') return v === true || String(v).toLowerCase() === 'true';
    if (t === 'string') return v == null ? '' : String(v);
    return v;
  }
  /* 실험 관리자: 입력값을 모델 정의에 대입 */
  function applyInput(model, path, value) {
    const [on, attr] = String(path).split('.'), o = model.objects[on]; if (!o) throw new SimError(`입력 경로 '${path}' 의 객체가 없어요`);
    if (o.cls === 'Variable' && !attr) { o.value = value; return; }
    const a = (attr || '').toLowerCase();
    const map = { xdim: 'xdim', ydim: 'ydim', capacity: 'cap', value: 'value', length: 'length', speed: 'speed' };
    if (map[a]) { o[map[a]] = value; return; }
    if (a === 'proctime') { o.procTime = { t: 'Const', v: +value }; return; }
    if (a === 'interval') { o.interval = { t: o.interval?.t === 'Negexp' ? 'Negexp' : 'Const', beta: +value, v: +value }; return; }
    throw new SimError(`입력 경로 '${path}' 는 지원하지 않아요 (XDim, Capacity, ProcTime, Interval, 변수 이름)`);
  }
  const T975 = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
  function summary(xs) { const n = xs.length, m = xs.reduce((a, b) => a + b, 0) / (n || 1), s = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0, t = n > 1 ? (n - 1 <= 30 ? T975[n - 1] : 1.96) : NaN; return { n, mean: m, sd: s, hw: t * s / Math.sqrt(n), min: Math.min(...xs), max: Math.max(...xs) }; }
  function runExperiments(model, em, onProgress) {
    const res = [];
    em.exps.forEach((row, ei) => {
      const vals = [];
      for (let r = 0; r < Math.max(1, +em.obs || 1); r++) {
        const m = JSON.parse(JSON.stringify(model)); em.inputs.forEach((p, i) => applyInput(m, p, row[i]));
        const sim = new Sim(m, { seed: 1000 + r * 7919 }); sim.run();
        vals.push(em.outputs.map(p => +sim.evalPath(p)));
      }
      res.push({ row, vals, sum: em.outputs.map((_, j) => summary(vals.map(v => v[j]))) });
      onProgress && onProgress(ei + 1);
    });
    return res;
  }
  return { rng, sample, dMean, DISTS, TIME_PARAMS, parseTime, fmtTime, DEFAULTS, MATERIAL, newModel, Sim, SimError, castVar, summary, runExperiments, applyInput };
})();
