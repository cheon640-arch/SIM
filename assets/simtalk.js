/* SimTalk 2.0 부분집합 인터프리터 (연습용)
   지원: -- 주석, 블록 주석, var 선언, := += -= *= /=, if/elseif/else/end (then 생략 가능), switch/case/else/end,
         while … end (loop 생략 가능), repeat … until, for i := a to/downto b … next/end, param … -> 타입, return / result,
         + - * / div mod, = <> < > <= >=, and or not, 문자열 +, print, 내장 함수, 객체.속성, 표[열, 행]
   Plant Simulation 과 100% 같지는 않아요 — 문법 감각을 익히는 용도. */
window.SIMTALK = (function () {
  const KW = new Set(['var', 'if', 'then', 'elseif', 'else', 'end', 'while', 'loop', 'repeat', 'until', 'for', 'to', 'downto', 'next', 'switch', 'case', 'return', 'param', 'and', 'or', 'not', 'div', 'mod', 'true', 'false', 'void', 'print', 'step']);
  class STErr extends Error { constructor(msg, line) { super(msg); this.line = line; } }

  function lex(src) {
    const T = []; let i = 0, line = 1;
    const push = (t, v) => T.push({ t, v, line });
    while (i < src.length) {
      const c = src[i];
      if (c === '\n') { push('nl'); line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (src.startsWith('--', i)) { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (src.startsWith('/*', i)) { const j = src.indexOf('*/', i + 2); const seg = src.slice(i, j < 0 ? src.length : j + 2); line += (seg.match(/\n/g) || []).length; i = j < 0 ? src.length : j + 2; continue; }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) { let j = i; while (/[0-9]/.test(src[j])) j++; let real = false; if (src[j] === '.' && /[0-9]/.test(src[j + 1])) { real = true; j++; while (/[0-9]/.test(src[j])) j++; } if (/[eE]/.test(src[j]) && /[-+0-9]/.test(src[j + 1])) { real = true; j += 2; while (/[0-9]/.test(src[j])) j++; } push('num', { v: Number(src.slice(i, j)), real }); i = j; continue; }
      if (c === '"' || c === "'") { let j = i + 1, s = ''; while (j < src.length && src[j] !== c) { if (src[j] === '\n') throw new STErr('문자열이 닫히지 않았어요', line); s += src[j++]; } if (j >= src.length) throw new STErr('문자열이 닫히지 않았어요', line); push('str', s); i = j + 1; continue; }
      if (/[A-Za-z_가-힣]/.test(c)) { let j = i; while (j < src.length && /[A-Za-z0-9_가-힣]/.test(src[j])) j++; const w = src.slice(i, j), lw = w.toLowerCase(); if (KW.has(lw)) push('kw', lw); else push('id', w); i = j; continue; }
      const two = src.slice(i, i + 2);
      if ([':=', '+=', '-=', '*=', '/=', '<=', '>=', '<>', '!=', '->', '=='].includes(two)) { push('op', two === '!=' ? '<>' : two === '==' ? '=' : two); i += 2; continue; }
      if ('+-*/=<>()[],:;.@?&'.includes(c)) { push('op', c === ';' ? 'nl' : c); if (c === ';') T[T.length - 1].t = 'nl'; i++; continue; }
      throw new STErr(`알 수 없는 문자 '${c}'`, line);
    }
    push('eof'); return T;
  }

  function parse(src) {
    const T = lex(src); let p = 0;
    const pk = (o = 0) => T[p + o], nx = () => T[p++];
    const is = (t, v) => pk().t === t && (v === undefined || pk().v === v);
    const isKw = v => is('kw', v), isOp = v => is('op', v);
    const expect = (t, v, what) => { if (!is(t, v)) throw new STErr(`${what || v || t} 이(가) 필요해요 (지금: ${pk().v ?? pk().t})`, pk().line); return nx(); };
    const skipNL = () => { while (is('nl')) nx(); };
    const ENDERS = new Set(['end', 'else', 'elseif', 'case', 'next', 'until']);
    function block() { const out = []; skipNL(); while (!is('eof') && !(is('kw') && ENDERS.has(pk().v))) { out.push(stmt()); skipNL(); } return out; }
    function typeName() { const t = expect('id', undefined, '타입 이름'); let n = t.v; if (isOp('[')) { nx(); n += '[' + expect('id', undefined, '타입').v + ']'; expect('op', ']'); } return n; }
    function stmt() {
      const tk = pk(), line = tk.line;
      if (isKw('var')) { nx(); const names = [expect('id', undefined, '변수 이름').v]; while (isOp(',')) { nx(); names.push(expect('id', undefined, '변수 이름').v); } expect('op', ':', "':' 와 타입"); const ty = typeName(); let init = null; if (isOp(':=')) { nx(); init = expr(); } return { k: 'var', names, ty, init, line }; }
      if (isKw('if')) { nx(); const arms = []; let c = expr(); if (isKw('then')) nx(); arms.push([c, block()]); let els = null;
        while (isKw('elseif')) { nx(); c = expr(); if (isKw('then')) nx(); arms.push([c, block()]); }
        if (isKw('else')) { nx(); els = block(); } expect('kw', 'end', "'end'"); return { k: 'if', arms, els, line }; }
      if (isKw('while')) { nx(); const c = expr(); if (isKw('loop')) nx(); const b = block(); expect('kw', 'end', "'end'"); return { k: 'while', c, b, line }; }
      if (isKw('repeat')) { nx(); const b = block(); expect('kw', 'until', "'until'"); return { k: 'repeat', b, c: expr(), line }; }
      if (isKw('for')) { nx(); if (isKw('var')) nx(); const v = expect('id', undefined, '반복 변수').v; if (isOp(':')) { nx(); typeName(); } expect('op', ':=', "':='"); const a = expr(); let down = false; if (isKw('downto')) { nx(); down = true; } else expect('kw', 'to', "'to'"); const b = expr(); let st = null; if (isKw('step')) { nx(); st = expr(); } if (isKw('loop')) nx(); const body = block(); if (isKw('next')) nx(); else expect('kw', 'end', "'next'"); return { k: 'for', v, a, b, down, st, body, line }; }
      if (isKw('switch')) { nx(); const e = expr(); skipNL(); const cases = []; let els = null;
        while (isKw('case')) { nx(); const vals = []; do { if (isOp(',')) nx(); const lo = expr(); if (isKw('to')) { nx(); vals.push({ lo, hi: expr() }); } else vals.push({ lo }); } while (isOp(',')); cases.push([vals, block()]); }
        if (isKw('else')) { nx(); els = block(); } expect('kw', 'end', "'end'"); return { k: 'switch', e, cases, els, line }; }
      if (isKw('return')) { nx(); return { k: 'ret', e: is('nl') || is('eof') || (is('kw') && ENDERS.has(pk().v)) ? null : expr(), line }; }
      if (isKw('print')) { nx(); const es = [expr()]; while (isOp(',')) { nx(); es.push(expr()); } return { k: 'print', es, line }; }
      const lhs = expr();
      if (is('op') && [':=', '+=', '-=', '*=', '/='].includes(pk().v)) { const op = nx().v; if (!['name', 'mem', 'idx'].includes(lhs.k)) throw new STErr('값을 넣을 수 없는 곳이에요', line); return { k: 'set', lhs, op, e: expr(), line }; }
      if (isOp('=')) throw new STErr("대입은 ':=' 예요 (SimTalk 2.0 에서 '=' 는 비교)", line);
      if (lhs.k === 'bin' && lhs.op === '=') throw new STErr("대입은 ':=' 예요 (SimTalk 2.0 에서 '=' 는 비교)", line);
      if (lhs.k !== 'call' && lhs.k !== 'name' && lhs.k !== 'mem') throw new STErr('문장이 아니에요', line);
      return { k: 'expr', e: lhs, line };
    }
    function expr() { return orE(); }
    function orE() { let l = andE(); while (isKw('or')) { nx(); l = { k: 'bin', op: 'or', l, r: andE() }; } return l; }
    function andE() { let l = notE(); while (isKw('and')) { nx(); l = { k: 'bin', op: 'and', l, r: notE() }; } return l; }
    function notE() { if (isKw('not')) { nx(); return { k: 'un', op: 'not', e: notE() }; } return cmp(); }
    function cmp() { let l = add(); while (is('op') && ['=', '<>', '<', '>', '<=', '>='].includes(pk().v)) { const op = nx().v; l = { k: 'bin', op, l, r: add() }; } return l; }
    function add() { let l = mul(); while (isOp('+') || isOp('-')) { const op = nx().v; l = { k: 'bin', op, l, r: mul() }; } return l; }
    function mul() { let l = unary(); while (isOp('*') || isOp('/') || isKw('div') || isKw('mod')) { const op = nx().v; l = { k: 'bin', op, l, r: unary() }; } return l; }
    function unary() { if (isOp('-')) { nx(); return { k: 'un', op: '-', e: unary() }; } if (isOp('+')) { nx(); return unary(); } return post(); }
    function post() {
      let e = prim();
      for (;;) {
        if (isOp('.')) { nx(); const n = pk(); if (n.t !== 'id' && n.t !== 'kw') throw new STErr('속성 이름이 필요해요', n.line); nx(); e = { k: 'mem', o: e, n: n.v, line: n.line }; continue; }
        if (isOp('(')) { nx(); const args = []; skipNL(); if (!isOp(')')) { args.push(expr()); while (isOp(',')) { nx(); args.push(expr()); } } expect('op', ')', "')'"); e = { k: 'call', f: e, args, line: pk().line }; continue; }
        if (isOp('[')) { nx(); const ix = [expr()]; while (isOp(',')) { nx(); ix.push(expr()); } expect('op', ']', "']'"); e = { k: 'idx', o: e, ix, line: pk().line }; continue; }
        return e;
      }
    }
    function prim() {
      const t = pk();
      if (t.t === 'num') { nx(); return { k: 'lit', v: t.v.v, real: t.v.real }; }
      if (t.t === 'str') { nx(); return { k: 'lit', v: t.v }; }
      if (isKw('true') || isKw('false')) { nx(); return { k: 'lit', v: t.v === 'true' }; }
      if (isKw('void')) { nx(); return { k: 'lit', v: null }; }
      if (t.t === 'id') { nx(); return { k: 'name', n: t.v, line: t.line }; }
      if (isOp('@') || isOp('?')) { nx(); return { k: 'name', n: t.v, line: t.line }; }
      if (isOp('&')) { nx(); const n = expect('id', undefined, '메서드 이름'); return { k: 'ref', n: n.v, line: n.line }; }
      if (isOp('(')) { nx(); const e = expr(); expect('op', ')', "')'"); return e; }
      throw new STErr(`식이 필요해요 (지금: ${t.v ?? t.t})`, t.line);
    }
    skipNL();
    let params = [], rtype = null;
    if (isKw('param')) { nx(); do { if (isOp(',')) nx(); const n = expect('id', undefined, '매개변수 이름').v; expect('op', ':', "':'"); params.push({ n, ty: typeName() }); } while (isOp(',')); if (isOp('->')) { nx(); rtype = typeName(); } }
    else if (isOp('->')) { nx(); rtype = typeName(); }
    const body = block();
    if (!is('eof')) throw new STErr(`'${pk().v}' 가 짝이 맞지 않아요`, pk().line);
    return { params, rtype, body };
  }

  const PC = new Map();
  function cachedParse(src) { let a = PC.get(src); if (!a) { a = parse(src); if (PC.size > 300) PC.clear(); PC.set(src, a); } return a; }
  /* ---------- 실행 ---------- */
  class Ret { constructor(v) { this.v = v; } }
  const show = v => v === null || v === undefined ? 'void' : typeof v === 'boolean' ? (v ? 'true' : 'false') : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : String(+v.toPrecision(10))) : typeof v === 'object' ? (v.name ? v.name : '[object]') : String(v);
  function builtins(out, rnd) {
    const num = x => { if (typeof x !== 'number') throw new STErr('숫자가 필요해요: ' + show(x)); return x; };
    return {
      abs: Math.abs, sqrt: Math.sqrt, pow: Math.pow, exp: Math.exp, ln: Math.log, log: Math.log10, sin: Math.sin, cos: Math.cos,
      round: (x, n) => n ? +num(x).toFixed(n) : Math.round(num(x)), floor: Math.floor, ceil: Math.ceil, trunc: Math.trunc, min: Math.min, max: Math.max,
      to_str: (...a) => a.map(show).join(''), num_to_str: x => show(x), str_to_num: s => Number(s), str_to_bool: s => String(s).toLowerCase() === 'true', bool_to_str: b => show(!!b),
      strlen: s => String(s).length, copy: (s, i, n) => String(s).substr(i - 1, n), pos: (sub, s) => String(s).indexOf(sub) + 1, omit: (s, i, n) => { s = String(s); return s.slice(0, i - 1) + s.slice(i - 1 + n); }, incl: (s, i, t) => { s = String(s); return s.slice(0, i - 1) + t + s.slice(i - 1); },
      uppercase: s => String(s).toUpperCase(), lowercase: s => String(s).toLowerCase(),
      z_uniform: (st, a, b) => a + (b - a) * rnd(), z_negexp: (st, b) => -b * Math.log(1 - rnd()), z_normal: (st, m, s) => m + s * Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd()),
      messagebox: (m) => { out.push('[messageBox] ' + show(m)); }, debug: () => { out.push('[debug]'); },
    };
  }
  function run(src, opt = {}) {
    const out = opt.out || [], ast = typeof src === 'string' ? cachedParse(src) : src, env = opt.env || {}, rnd = opt.rnd || Math.random, B = builtins(out, rnd);
    const methods = opt.methods || {};
    let steps = 0; const LIMIT = opt.limit || 200000;
    function call(ast, args, name) {
      const sc = new Map();
      if (args.length !== ast.params.length) throw new STErr(`${name || '메서드'} 는 인자 ${ast.params.length}개가 필요해요 (받은 것 ${args.length}개)`);
      ast.params.forEach((p, i) => sc.set(p.n.toLowerCase(), { v: args[i], ty: p.ty }));
      if (ast.rtype) sc.set('result', { v: null, ty: ast.rtype });
      try { execB(ast.body, sc); } catch (e) { if (e instanceof Ret) return e.v; throw e; }
      return ast.rtype ? sc.get('result').v : null;
    }
    const lookup = (sc, n, line) => {
      const l = n.toLowerCase();
      if (sc.has(l)) return sc.get(l).v;
      for (const k in env) if (k.toLowerCase() === l) return env[k];
      if (l in B) return B[l];
      for (const k in methods) if (k.toLowerCase() === l) return { __method: k };
      throw new STErr(`'${n}' 를 모르겠어요 — var 로 선언했나요?`, line);
    };
    const coerce = (v, ty) => { if (!ty) return v; const t = ty.toLowerCase(); if (t === 'integer' && typeof v === 'number') return Math.round(v); if (t === 'string' && typeof v !== 'string' && v !== null) return show(v); if (t === 'real' && typeof v === 'number') return v; return v; };
    function setVar(sc, n, v, line) {
      const l = n.toLowerCase();
      if (sc.has(l)) { const o = sc.get(l); o.v = coerce(v, o.ty); return; }
      for (const k in env) if (k.toLowerCase() === l) { env[k] = v; return; }
      throw new STErr(`'${n}' 를 선언하지 않았어요 (var ${n} : 타입)`, line);
    }
    function ev(e, sc) {
      if (++steps > LIMIT) throw new STErr('실행 단계가 너무 많아요 — 무한 반복인가요?');
      switch (e.k) {
        case 'lit': return e.v;
        case 'name': { const v = lookup(sc, e.n, e.line); return v; }
        case 'ref': return { __ref: e.n };
        case 'mem': { const o = ev(e.o, sc); if (o == null || typeof o !== 'object') throw new STErr(`'${show(o)}' 에는 속성 ${e.n} 이 없어요`, e.line); const k = Object.keys(o).find(x => x.toLowerCase() === e.n.toLowerCase()); if (k === undefined) throw new STErr(`${o.name || '객체'} 에 '${e.n}' 속성/메서드가 없어요`, e.line); const v = o[k]; return typeof v === 'function' ? v.bind(o) : v; }
        case 'idx': { const o = ev(e.o, sc), ix = e.ix.map(x => ev(x, sc)); if (o && typeof o.get === 'function') return o.get(...ix); if (Array.isArray(o)) return o[ix[0] - 1]; throw new STErr('[ ] 로 읽을 수 없는 값이에요', e.line); }
        case 'call': {
          const args = e.args.map(a => ev(a, sc));
          if (e.f.k === 'name') { const l = e.f.n.toLowerCase(); const mk = Object.keys(methods).find(k => k.toLowerCase() === l); if (mk && !sc.has(l)) return call(methods[mk], args, mk); }
          const f = ev(e.f, sc);
          if (f && f.__method) return call(methods[f.__method], args, f.__method);
          if (typeof f !== 'function') throw new STErr(`'${show(f)}' 는 호출할 수 없어요`, e.line);
          const r = f(...args); return r === undefined ? null : r;
        }
        case 'un': { const v = ev(e.e, sc); if (e.op === '-') return -v; return !truthy(v); }
        case 'bin': {
          if (e.op === 'and') return truthy(ev(e.l, sc)) && truthy(ev(e.r, sc));
          if (e.op === 'or') return truthy(ev(e.l, sc)) || truthy(ev(e.r, sc));
          const a = ev(e.l, sc), b = ev(e.r, sc);
          switch (e.op) {
            case '+': if (typeof a === 'string' || typeof b === 'string') return show(a) + show(b); return a + b;
            case '-': return a - b; case '*': return a * b;
            case '/': if (b === 0) throw new STErr('0 으로 나눌 수 없어요'); return a / b;
            case 'div': if (b === 0) throw new STErr('0 으로 나눌 수 없어요'); return Math.trunc(a / b);
            case 'mod': if (b === 0) throw new STErr('0 으로 나눌 수 없어요'); return +((a % b).toPrecision(12));
            case '=': return a === b; case '<>': return a !== b; case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b;
          }
        }
      }
      throw new STErr('알 수 없는 식');
    }
    const truthy = v => { if (typeof v !== 'boolean') throw new STErr(`조건은 true/false 여야 해요 (지금 ${show(v)})`); return v; };
    function assign(lhs, v, sc, line) {
      if (lhs.k === 'name') return setVar(sc, lhs.n, v, line);
      if (lhs.k === 'mem') { const o = ev(lhs.o, sc); if (o == null || typeof o !== 'object') throw new STErr('속성을 바꿀 수 없어요', line); const k = Object.keys(o).find(x => x.toLowerCase() === lhs.n.toLowerCase()) || lhs.n; o[k] = v; return; }
      if (lhs.k === 'idx') { const o = ev(lhs.o, sc), ix = lhs.ix.map(x => ev(x, sc)); if (o && o.set) return o.set(...ix, v); if (Array.isArray(o)) { o[ix[0] - 1] = v; return; } }
      throw new STErr('대입할 수 없어요', line);
    }
    function execB(b, sc) { for (const s of b) exec(s, sc); }
    function exec(s, sc) {
      if (++steps > LIMIT) throw new STErr('실행 단계가 너무 많아요 — 무한 반복인가요?', s.line);
      try {
        switch (s.k) {
          case 'var': s.names.forEach(n => { const t = s.ty.toLowerCase(); const d = t === 'integer' || t === 'real' ? 0 : t === 'boolean' ? false : t === 'string' ? '' : null; sc.set(n.toLowerCase(), { v: coerce(s.init ? ev(s.init, sc) : d, s.ty), ty: s.ty }); }); return;
          case 'set': { let v = ev(s.e, sc); if (s.op !== ':=') { const cur = ev(s.lhs, sc), op = s.op[0]; v = op === '+' ? (typeof cur === 'string' || typeof v === 'string' ? show(cur) + show(v) : cur + v) : op === '-' ? cur - v : op === '*' ? cur * v : cur / v; } assign(s.lhs, v, sc, s.line); return; }
          case 'expr': { const v = ev(s.e, sc); if (s.e.k === 'name' && v && v.__method) call(methods[v.__method], [], v.__method); return; }
          case 'print': out.push(s.es.map(e => show(ev(e, sc))).join('')); return;
          case 'if': for (const [c, b] of s.arms) if (truthy(ev(c, sc))) return execB(b, sc); if (s.els) execB(s.els, sc); return;
          case 'while': while (truthy(ev(s.c, sc))) execB(s.b, sc); return;
          case 'repeat': do execB(s.b, sc); while (!truthy(ev(s.c, sc))); return;
          case 'for': { const a = ev(s.a, sc), b = ev(s.b, sc), st = s.st ? Math.abs(ev(s.st, sc)) : 1; const l = s.v.toLowerCase(); if (!sc.has(l)) sc.set(l, { v: a, ty: 'integer' });
            for (let i = a; s.down ? i >= b : i <= b; i += s.down ? -st : st) { sc.get(l).v = i; execB(s.body, sc); } return; }
          case 'switch': { const v = ev(s.e, sc); for (const [vals, b] of s.cases) { if (vals.some(x => x.hi ? v >= ev(x.lo, sc) && v <= ev(x.hi, sc) : v === ev(x.lo, sc))) return execB(b, sc); } if (s.els) execB(s.els, sc); return; }
          case 'ret': throw new Ret(s.e ? ev(s.e, sc) : null);
        }
      } catch (e) { if (e instanceof STErr && e.line == null) e.line = s.line; throw e; }
    }
    const ret = call(ast, opt.args || [], opt.name);
    return { out, ret, steps };
  }
  /* 연습용 객체들 */
  function table(name, cols, rows) {
    const data = rows.map(r => r.slice());
    return { name, get xDim() { return cols.length; }, get yDim() { return data.length; }, get(c, r) { if (r < 1 || r > data.length || c < 1 || c > cols.length) throw new STErr(`${name}[${c}, ${r}] 는 표 범위 밖이에요 (열 ${cols.length}, 행 ${data.length})`); return data[r - 1][c - 1]; }, set(c, r, v) { while (data.length < r) data.push(Array(cols.length).fill(null)); data[r - 1][c - 1] = v; }, writeRow(c, r, ...vals) { vals.forEach((v, i) => this.set(c + i, r, v)); }, delete() { data.length = 0; }, cols, data };
  }
  return { lex, parse, cachedParse, run, show, table, STErr };
})();
