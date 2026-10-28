/* 아주 작은 SVG 그래프 도우미: 막대·선·점, 축 눈금. PLOT(el, {xmin,xmax,ymin,ymax, xlabel, ylabel, series:[{type,data,color,w}]}) */
window.PLOT = function (el, o) {
  const W = o.w || 520, H = o.h || 240, L = 44, R = 12, T = 12, B = 34;
  const xmin = o.xmin, xmax = o.xmax, ymin = o.ymin ?? 0, ymax = o.ymax;
  const X = x => L + (x - xmin) / (xmax - xmin || 1) * (W - L - R), Y = y => H - B - (y - ymin) / (ymax - ymin || 1) * (H - T - B);
  const nice = (a, b, n) => { const span = b - a, raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p, st = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; const out = []; for (let v = Math.ceil(a / st) * st; v <= b + st * 1e-9; v += st) out.push(+v.toFixed(10)); return out; };
  const f = v => Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : +v.toFixed(3);
  let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;display:block" xmlns="http://www.w3.org/2000/svg" font-family="Inter,Noto Sans KR,sans-serif">`;
  nice(ymin, ymax, 4).forEach(v => { s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(0,0,0,.07)"/><text x="${L - 6}" y="${Y(v) + 3.5}" font-size="10" text-anchor="end" fill="#757575">${f(v)}</text>`; });
  nice(xmin, xmax, o.xticks || 6).forEach(v => { s += `<text x="${X(v)}" y="${H - B + 14}" font-size="10" text-anchor="middle" fill="#757575">${f(v)}</text>`; });
  s += `<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="#000" stroke-width=".8"/><line x1="${L}" x2="${L}" y1="${T}" y2="${H - B}" stroke="#000" stroke-width=".8"/>`;
  (o.series || []).forEach(se => {
    const c = se.color || '#0075de';
    if (se.type === 'bar') se.data.forEach(([a, b, h]) => { s += `<rect x="${X(a) + .5}" y="${Y(h)}" width="${Math.max(0, X(b) - X(a) - 1)}" height="${Math.max(0, Y(ymin) - Y(h))}" fill="${c}" opacity="${se.op ?? .85}"/>`; });
    if (se.type === 'line') s += `<path d="${se.data.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ')}" fill="none" stroke="${c}" stroke-width="${se.w || 2}" ${se.dash ? `stroke-dasharray="${se.dash}"` : ''}/>`;
    if (se.type === 'pts') se.data.forEach(p => { s += `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="${se.r || 3}" fill="${p[2] || c}" opacity="${se.op ?? .8}"/>`; });
  });
  if (o.xlabel) s += `<text x="${(L + W - R) / 2}" y="${H - 4}" font-size="11" text-anchor="middle" fill="#000">${o.xlabel}</text>`;
  if (o.ylabel) s += `<text x="12" y="${(T + H - B) / 2}" font-size="11" text-anchor="middle" fill="#000" transform="rotate(-90 12 ${(T + H - B) / 2})">${o.ylabel}</text>`;
  if (o.legend) s += o.legend.map((l, i) => `<rect x="${W - R - 150}" y="${T + 4 + i * 15}" width="10" height="10" fill="${l[1]}"/><text x="${W - R - 135}" y="${T + 13 + i * 15}" font-size="11" fill="#000">${l[0]}</text>`).join('');
  el.innerHTML = s + '</svg>';
};
