/* 이산사건 시뮬레이션 엔진 (Plant Simulation 의 Source → Buffer → Station … → Drain 흐름을 흉내)
   - 모델 = { unit, source:{dist, types:[{name,p,color}]}, stages:[{name, servers, dist, typeDist:{타입:dist}, cap, prio, skip:[타입]}],
              transfer, carriers:{n, travel, back} }
   - cap  = 그 스테이션 앞 버퍼 용량 (Infinity = 무한, 0 = 버퍼 없음 → 앞 스테이션이 Blocked 됨)
   - 첫 스테이션 버퍼가 꽉 차면 도착한 개체는 잃어버림(lost) — 예: 드라이브스루 6칸
   - visitP = 그 스테이션을 들를 확률 (예: 파이프 절단 0.7). skip = 들르지 않는 타입 목록
   - carriers = AMR/AGV 대수. 개체는 운반차를 얻어야 출발하고, 끝날 때까지 운반차를 붙잡고 있음
   - 통계: 스테이션별 Working / Waiting(빈 상태) / Blocked 비율, 대기열 시간가중 평균, 대기시간,
           출발 간격 CV(변동성 전파 확인용), 처리량, 체류시간(리드타임), WIP */
window.SIM = (function () {
  /* ---------- 난수 ---------- */
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function normal(u) { const a = Math.max(1e-12, u()), b = u(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); }
  function sample(d, u) {
    if (d == null) return 0;
    if (typeof d === 'number') return d;
    switch (d.d) {
      case 'const': return d.v;
      case 'exp': return -d.m * Math.log(1 - u());
      case 'uni': return d.a + (d.b - d.a) * u();
      case 'tri': { const { a, c, b } = d, F = (c - a) / (b - a), x = u(); return x < F ? a + Math.sqrt(x * (b - a) * (c - a)) : b - Math.sqrt((1 - x) * (b - a) * (b - c)); }
      case 'norm': { let x; let k = 0; do { x = d.m + d.s * normal(u); } while (x <= 0 && ++k < 50); return Math.max(0, x); }
      case 'logn': { const v = d.s * d.s, mu = Math.log(d.m * d.m / Math.sqrt(v + d.m * d.m)), sg = Math.sqrt(Math.log(1 + v / (d.m * d.m))); return Math.exp(mu + sg * normal(u)); }
      case 'erlang': { let s = 0; for (let i = 0; i < d.k; i++) s += -(d.m / d.k) * Math.log(1 - u()); return s; }
      case 'cv': { /* 평균 m, 변동계수 c 를 맞추는 분포: c=0 상수, c<1 감마(얼랑 근사), c=1 지수, c>1 2-상 초지수 */
        const m = d.m, c = d.c;
        if (c <= 0.001) return m;
        if (Math.abs(c - 1) < 1e-6) return -m * Math.log(1 - u());
        if (c < 1) { const k = Math.max(1, Math.round(1 / (c * c))); let s = 0; for (let i = 0; i < k; i++) s += -(m / k) * Math.log(1 - u()); return s; }
        const c2 = c * c, p = 0.5 * (1 + Math.sqrt((c2 - 1) / (c2 + 1)));
        return u() < p ? -(m / (2 * p)) * Math.log(1 - u()) : -(m / (2 * (1 - p))) * Math.log(1 - u());
      }
      default: return 0;
    }
  }
  function dMean(d) {
    if (d == null) return 0; if (typeof d === 'number') return d;
    return { const: d.v, exp: d.m, uni: (d.a + d.b) / 2, tri: (d.a + d.c + d.b) / 3, norm: d.m, logn: d.m, erlang: d.m, cv: d.m }[d.d] ?? 0;
  }
  function dCV(d) {
    if (d == null || typeof d === 'number') return 0;
    const m = dMean(d) || 1;
    switch (d.d) { case 'const': return 0; case 'exp': return 1; case 'uni': return (d.b - d.a) / Math.sqrt(12) / m;
      case 'tri': { const { a, b, c } = d; return Math.sqrt((a * a + b * b + c * c - a * b - a * c - b * c) / 18) / m; }
      case 'norm': case 'logn': return d.s / m; case 'erlang': return 1 / Math.sqrt(d.k); case 'cv': return d.c; }
    return 0;
  }
  function dLabel(d, unit) {
    unit = unit || '';
    if (d == null) return '—'; if (typeof d === 'number') return d + unit;
    const f = x => +(+x).toFixed(2);
    switch (d.d) { case 'const': return `상수 ${f(d.v)}${unit}`; case 'exp': return `지수 (평균 ${f(d.m)}${unit})`; case 'uni': return `균등 [${f(d.a)}, ${f(d.b)}]`;
      case 'tri': return `삼각 (${f(d.a)}, ${f(d.c)}, ${f(d.b)})`; case 'norm': return `정규 (${f(d.m)}, σ ${f(d.s)})`; case 'logn': return `로그정규 (${f(d.m)}, σ ${f(d.s)})`;
      case 'erlang': return `얼랑 k=${d.k} (평균 ${f(d.m)})`; case 'cv': return `평균 ${f(d.m)}${unit}, CV ${f(d.c)}`; }
    return '?';
  }

  /* ---------- 이벤트 큐 (이진 힙) ---------- */
  class Heap {
    constructor() { this.a = []; this.n = 0; }
    push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (lt(a[i], a[p])) { [a[i], a[p]] = [a[p], a[i]]; i = p; } else break; } }
    pop() { const a = this.a; if (!a.length) return null; const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && lt(a[l], a[m])) m = l; if (r < a.length && lt(a[r], a[m])) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } } return top; }
    peek() { return this.a[0] || null; }
    get size() { return this.a.length; }
  }
  const lt = (x, y) => x.t < y.t || (x.t === y.t && x.s < y.s);

  /* ---------- 시뮬레이션 ---------- */
  class Sim {
    constructor(model, opt = {}) {
      this.m = model; this.opt = opt;
      this.u = rng(opt.seed ?? 12345);
      this.t = 0; this.last = 0; this.seq = 0; this.ev = new Heap();
      this.st = model.stages.map((s, k) => ({
        k, def: s, cap: s.cap == null ? Infinity : s.cap, q: [], inbound: 0, waiters: [],
        sv: Array.from({ length: Math.max(1, s.servers || 1) }, () => ({ e: null, state: 'idle' })),
      }));
      this.ents = new Map(); this.nextId = 1; this.wip = 0; this.log = opt.log ? [] : null; this.trace = opt.trace ? [] : null;
      const C = model.carriers; this.carrier = C && C.n > 0 ? { free: C.n, n: C.n, cq: [], busyArea: 0, waitSum: 0, waitN: 0 } : null;
      this.resetStats();
      const warm = opt.warm || 0; if (warm > 0) this.at(warm, 'warm');
      if (opt.end != null) this.at(opt.end, 'stop');
      this.at(model.source.first != null ? model.source.first : sample(model.source.dist, this.u), 'arr');
    }
    resetStats() {
      this.S = { t0: this.t, done: 0, flowSum: 0, flowSq: 0, flowMax: 0, wipArea: 0, lost: 0, arrived: 0, byType: {} };
      this.st.forEach(s => { s.qArea = 0; s.qMax = s.q.length; s.waitSum = 0; s.waitN = 0; s.time = { work: 0, idle: 0, blocked: 0 }; s.depLast = null; s.depN = 0; s.depM = 0; s.depM2 = 0; s.arrLast = null; s.arrN = 0; s.arrM = 0; s.arrM2 = 0; });
      if (this.carrier) { this.carrier.busyArea = 0; this.carrier.waitSum = 0; this.carrier.waitN = 0; }
    }
    at(t, type, data) { this.ev.push({ t, s: ++this.seq, type, data }); }
    acc() {
      const dt = this.t - this.last; if (dt <= 0) { this.last = this.t; return; }
      this.st.forEach(s => { s.qArea += s.q.length * dt; s.sv.forEach(v => { s.time[v.state] += dt; }); });
      this.S.wipArea += this.wip * dt;
      if (this.carrier) this.carrier.busyArea += (this.carrier.n - this.carrier.free) * dt;
      this.last = this.t;
    }
    note(kind, e, k, extra) { if (this.trace && this.trace.length < 4000) this.trace.push({ t: this.t, kind, id: e ? e.id : null, type: e ? e.type : null, k, ...(extra || {}) }); }
    /* 한 사건 처리. 더 없으면 false */
    step() {
      const x = this.ev.pop(); if (!x) return false;
      this.t = x.t; this.acc();
      const d = x.data;
      switch (x.type) {
        case 'arr': this.arrive(); break;
        case 'end': this.endWork(d.k, d.j); break;
        case 'enter': this.enterStage(d.e, d.k, true); break;
        case 'cfree': this.carrier.free++; this.dispatch(); break;
        case 'warm': this.resetStats(); break;
        case 'stop': this.stopped = true; this.ev = new Heap(); return false;
      }
      return true;
    }
    runUntil(T) { while (this.ev.size && this.ev.peek().t <= T) { if (!this.step()) break; } if (!this.stopped && this.t < T) { this.t = T; this.acc(); } }
    run() { while (this.step()); return this.results(); }
    pickType() {
      const T = this.m.source.types; if (!T || !T.length) return null;
      let x = this.u(), c = 0; for (const ty of T) { c += ty.p; if (x <= c) return ty.name; } return T[T.length - 1].name;
    }
    route(type) { return this.st.map(s => s.k).filter(k => { const d = this.m.stages[k]; if ((d.skip || []).includes(type)) return false; return d.visitP == null || d.visitP >= 1 || this.u() < d.visitP; }); }
    arrive() {
      const src = this.m.source;
      this.S.arrived++;
      if (src.max == null || this.nextId <= src.max) this.at(this.t + sample(src.dist, this.u), 'arr');
      const type = this.pickType();
      const e = { id: this.nextId++, type, tIn: this.t, r: this.route(type), ri: 0, tq: 0 };
      if (!e.r.length) return;
      if (this.carrier) { e.tc = this.t; this.carrier.cq.push(e); this.wip++; this.ents.set(e.id, e); this.note('arr', e, -1); this.dispatch(); return; }
      const k = e.r[0];
      if (!this.canAccept(k)) { this.S.lost++; this.note('lost', e, k); if (this.log) this.log.push({ id: e.id, type, arr: this.t, lost: 1 }); return; }
      this.wip++; this.ents.set(e.id, e); this.note('arr', e, k);
      this.enterStage(e, k, false);
    }
    dispatch() {
      const c = this.carrier; if (!c) return;
      while (c.free > 0 && c.cq.length) {
        const e = c.cq.shift(); c.free--; c.waitSum += this.t - e.tc; c.waitN++;
        const k = e.r[0]; this.st[k].inbound++;
        const tr = this.m.carriers.travel || 0;
        if (tr > 0) this.at(this.t + sample(tr, this.u), 'enter', { e, k }); else this.enterStage(e, k, true);
      }
    }
    idleCount(s) { let n = 0; for (const v of s.sv) if (v.state === 'idle') n++; return n; }
    canAccept(k) { const s = this.st[k]; return s.q.length + s.inbound < s.cap + this.idleCount(s); }
    enterStage(e, k, reserved) {
      const s = this.st[k]; if (reserved) s.inbound--;
      e.tq = this.t;
      if (s.arrLast != null) { const x = this.t - s.arrLast; s.arrN++; const d1 = x - s.arrM; s.arrM += d1 / s.arrN; s.arrM2 += d1 * (x - s.arrM); } s.arrLast = this.t;
      s.q.push(e); if (s.q.length > s.qMax) s.qMax = s.q.length;
      this.note('enter', e, k);
      this.tryStart(k);
    }
    procTime(k, e, j) {
      const def = this.m.stages[k];
      let d = (def.typeDist && e.type != null && def.typeDist[e.type] !== undefined) ? def.typeDist[e.type] : def.dist;
      let x = sample(d, this.u);
      if (def.speeds && def.speeds[j] != null) x *= def.speeds[j];
      return x;
    }
    tryStart(k) {
      const s = this.st[k];
      let pulled = false;
      for (let j = 0; j < s.sv.length; j++) {
        const v = s.sv[j];
        if (v.state !== 'idle' || !s.q.length) continue;
        let idx = 0;
        if (s.def.prio === 'shortest' && this.m.source.types) { /* Sorter: 작업이 적은(=순위 낮은 번호) 타입 먼저 */
          const ord = this.m.source.types.map(t => t.name);
          for (let i = 1; i < s.q.length; i++) if (ord.indexOf(s.q[i].type) < ord.indexOf(s.q[idx].type)) idx = i;
        }
        const e = s.q.splice(idx, 1)[0]; pulled = true;
        s.waitSum += this.t - e.tq; s.waitN++;
        v.e = e; v.state = 'work';
        this.note('start', e, k, { j });
        this.at(this.t + this.procTime(k, e, j), 'end', { k, j });
      }
      if (pulled) this.pullBlocked(k);
    }
    endWork(k, j) {
      const s = this.st[k], v = s.sv[j], e = v.e;
      if (s.depLast != null) { const x = this.t - s.depLast; s.depN++; const d1 = x - s.depM; s.depM += d1 / s.depN; s.depM2 += d1 * (x - s.depM); } s.depLast = this.t;
      e.ri++;
      if (e.ri >= e.r.length) { v.e = null; v.state = 'idle'; this.finish(e, k); this.pullBlocked(k); this.tryStart(k); return; }
      const nk = e.r[e.ri];
      if (this.canAccept(nk)) this.move(k, j, nk);
      else { v.state = 'blocked'; this.st[nk].waiters.push({ k, j }); this.note('block', e, k, { j }); }
    }
    move(k, j, nk) {
      const s = this.st[k], v = s.sv[j], e = v.e;
      v.e = null; v.state = 'idle';
      const ns = this.st[nk]; ns.inbound++;
      const tr = (this.m.transfer || 0) + (this.carrier ? (this.m.carriers.travel || 0) : 0);
      if (tr) this.at(this.t + sample(tr, this.u), 'enter', { e, k: nk }); else this.enterStage(e, nk, true);
      this.pullBlocked(k); this.tryStart(k);
    }
    pullBlocked(k) {
      const s = this.st[k];
      while (s.waiters.length && this.canAccept(k)) { const w = s.waiters.shift(); if (this.st[w.k].sv[w.j].state === 'blocked') this.move(w.k, w.j, k); }
    }
    finish(e, k) {
      this.wip--; this.ents.delete(e.id); this.exited = (this.exited || 0) + 1;
      const ft = this.t - e.tIn, S = this.S;
      S.done++; S.flowSum += ft; S.flowSq += ft * ft; if (ft > S.flowMax) S.flowMax = ft;
      const b = S.byType[e.type] = S.byType[e.type] || { n: 0, flow: 0 }; b.n++; b.flow += ft;
      this.note('exit', e, k);
      if (this.log) this.log.push({ id: e.id, type: e.type, arr: +e.tIn.toFixed(3), out: +this.t.toFixed(3), flow: +ft.toFixed(3) });
      if (this.carrier) { const bk = this.m.carriers.back ?? this.m.carriers.travel ?? 0; if (bk) this.at(this.t + sample(bk, this.u), 'cfree'); else { this.carrier.free++; this.dispatch(); } }
    }
    results() {
      const S = this.S, T = Math.max(1e-9, this.t - S.t0), hour = this.m.hour || 60;
      const stages = this.st.map(s => {
        const n = s.sv.length, tot = (s.time.work + s.time.idle + s.time.blocked) || 1;
        const cv = (N, M, M2) => N > 1 && M > 0 ? Math.sqrt(M2 / (N - 1)) / M : null;
        return { name: s.def.name, servers: n, work: s.time.work / tot, idle: s.time.idle / tot, blocked: s.time.blocked / tot,
          avgQ: s.qArea / T, maxQ: s.qMax, avgWait: s.waitN ? s.waitSum / s.waitN : 0, n: s.waitN,
          depCV: cv(s.depN, s.depM, s.depM2), arrCV: cv(s.arrN, s.arrM, s.arrM2) };
      });
      const r = { T, done: S.done, thru: S.done / T * hour, avgFlow: S.done ? S.flowSum / S.done : 0, maxFlow: S.flowMax, avgWIP: S.wipArea / T, lost: S.lost, arrived: S.arrived, stages, byType: S.byType };
      if (this.carrier) { r.carrierUtil = this.carrier.busyArea / T / this.carrier.n; r.carrierWait = this.carrier.waitN ? this.carrier.waitSum / this.carrier.waitN : 0; }
      return r;
    }
  }

  /* ---------- 반복 실행 · 신뢰구간 ---------- */
  const T975 = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
  const T95 = [0, 6.314, 2.920, 2.353, 2.132, 2.015, 1.943, 1.895, 1.860, 1.833, 1.812, 1.796, 1.782, 1.771, 1.761, 1.753, 1.746, 1.740, 1.734, 1.729, 1.725, 1.721, 1.717, 1.714, 1.711, 1.708, 1.706, 1.703, 1.701, 1.699, 1.697];
  const T995 = [0, 63.657, 9.925, 5.841, 4.604, 4.032, 3.707, 3.499, 3.355, 3.250, 3.169, 3.106, 3.055, 3.012, 2.977, 2.947, 2.921, 2.898, 2.878, 2.861, 2.845, 2.831, 2.819, 2.807, 2.797, 2.787, 2.779, 2.771, 2.763, 2.756, 2.750];
  function tq(df, conf = 0.95) {
    const tab = conf >= 0.99 ? T995 : conf >= 0.95 ? T975 : T95, z = conf >= 0.99 ? 2.576 : conf >= 0.95 ? 1.960 : 1.645;
    if (df < 1) return NaN; if (df <= 30) return tab[Math.round(df)];
    return z + (tab[30] - z) * 30 / df;
  }
  function summary(xs, conf = 0.95) {
    const n = xs.length, m = xs.reduce((a, b) => a + b, 0) / (n || 1);
    const s = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (n - 1)) : 0;
    const h = n > 1 ? tq(n - 1, conf) * s / Math.sqrt(n) : NaN;
    return { n, mean: m, sd: s, hw: h, lo: m - h, hi: m + h };
  }
  function replicate(model, { reps = 10, end, warm = 0, seed = 1000 } = {}) {
    const out = [];
    for (let r = 0; r < reps; r++) { const sim = new Sim(model, { seed: seed + r * 7919, end, warm }); sim.runUntil(end); out.push(sim.results()); }
    return out;
  }
  const fmt = (x, d = 2) => (x == null || !isFinite(x)) ? '—' : (+x).toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: 0 });

  return { rng, sample, dMean, dCV, dLabel, Sim, replicate, summary, tq, fmt };
})();
