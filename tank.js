'use strict';
/* A port of the game's tank renderer (draw_tank and the helpers it uses in terminaltanks.py) so the website can draw any
   tank, official or custom, with the same pixels. tools/check_tank_port.py compares it against the Python original. */
const TankGfx = (() => {
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const pyRound = (x) => { const f = Math.floor(x), d = x - f; return d < 0.5 ? f : d > 0.5 ? f + 1 : f % 2 === 0 ? f : f + 1; };
  const frac = (x) => x - Math.floor(x);
  const mix = (a, b, t) => (t <= 0 ? a : t >= 1 ? b : [Math.trunc(a[0] + (b[0] - a[0]) * t), Math.trunc(a[1] + (b[1] - a[1]) * t), Math.trunc(a[2] + (b[2] - a[2]) * t)]);
  const shade = (c, k) => [Math.min(255, Math.trunc(c[0] * k)), Math.min(255, Math.trunc(c[1] * k)), Math.min(255, Math.trunc(c[2] * k))];
  const gradient = (stops, t) => {
    if (t <= stops[0][0]) return stops[0][1];
    for (let i = 0; i < stops.length - 1; i++) { const [t0, c0] = stops[i], [t1, c1] = stops[i + 1]; if (t <= t1) return mix(c0, c1, t1 > t0 ? (t - t0) / (t1 - t0) : 1.0); }
    return stops[stops.length - 1][1];
  };
  const hsv = (h, s = 1.0, v = 1.0) => {
    h = frac(h);
    if (s === 0) { const g = Math.trunc(v * 255); return [g, g, g]; }
    let i = Math.trunc(h * 6.0); const f = h * 6.0 - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
    i %= 6;
    const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
    return [Math.trunc(r * 255), Math.trunc(g * 255), Math.trunc(b * 255)];
  };
  const RAINBOW = 'rainbow';
  const rainbow = (t) => hsv(pyRound(frac(t * 0.35) * 36) / 36, 0.85, 1.0);
  const flick = (t, a, b) => ((((Math.trunc(t * 30) * 73856093) ^ (a * 19349663) ^ (b * 83492791)) & 255) / 255.0);

  class Px {
    constructor(w, h, fill = [0, 0, 0]) { this.w = w; this.h = h; this.rows = Array.from({ length: h }, () => Array(w).fill(fill)); }
    plot(x, y, c) { const py = this.h - 1 - y; if (x >= 0 && x < this.w && py >= 0 && py < this.h) this.rows[py][x] = c; }
    blend(x, y, c, a) { const py = this.h - 1 - y; if (x >= 0 && x < this.w && py >= 0 && py < this.h && a > 0.02) this.rows[py][x] = mix(this.rows[py][x], c, a); }
    plotf(x, y, c) { this.plot(Math.floor(x), Math.floor(y), c); }
    blendf(x, y, c, a) { this.blend(Math.floor(x), Math.floor(y), c, a); }
  }

  const MAT = {
    p: (body, a, t, c, r) => hsv(t * 0.35 + c * 0.085 + r * 0.14, 0.62, 1.0),
    q: (body, a, t, c, r) => { const k = Math.max(0.0, 1 - Math.abs((c + r) - (((t * 7) % 18) - 3)) / 2.2); return mix(hsv(t * 0.35 + c * 0.085 + r * 0.14, 0.25, 1.0), [255, 255, 255], k); },
    f: (body, a, t, c, r) => { const k = clamp(0.55 + 0.45 * Math.sin(t * 21 + c * 2.3 + r * 1.7) * Math.sin(t * 9 + c), 0, 1); return gradient([[0, [150, 20, 8]], [0.5, [255, 110, 20]], [1, [255, 236, 120]]], k); },
    e: (body, a, t, c, r) => gradient([[0, shade(body, 0.4)], [1, [255, 90, 30]]], 0.5 + 0.5 * Math.sin(t * 3 + c * 0.9 + r)),
    v: (body, a, t, c, r) => mix([8, 4, 20], [110, 50, 200], 0.5 + 0.5 * Math.sin(t * 4 + c * 0.8 - r)),
    b: (body, a, t, c, r) => (flick(t, c * 7 + r, 11) > 0.84 ? [240, 248, 255] : mix(shade(body, 0.35), a, 0.45)),
    y: (body, a, t, c, r) => { const k = Math.max(0.0, 1 - Math.abs((c * 1.3 + r) - (((t * 6) % 20) - 4)) / 2.5); return mix([196, 150, 50], [255, 244, 180], k); },
  };

  function glowColor(d, body, t, idx) {
    const g = d.glow, a = d.accent;
    switch (g) {
      case 'pulse': return mix(shade(a, 0.3), a, 0.5 + 0.5 * Math.sin(t * 4 + idx));
      case 'blink': return Math.trunc(t * 3 + idx) % 2 === 0 ? a : shade(a, 0.25);
      case 'flame': { const k = 0.5 + 0.5 * Math.sin(t * 23 + idx * 2.1) * Math.sin(t * 11 + idx); return gradient([[0, [120, 30, 10]], [0.5, [255, 120, 20]], [1, [255, 232, 130]]], k); }
      case 'prism': return hsv(t * 0.4 + idx * 0.13, 0.7, 1.0);
      case 'scan': { const k = Math.max(0.0, 1 - Math.abs(idx - (((t * 9) % 15) - 2)) / 2.5); return mix(mix(shade(a, 0.28), a, 0.35), [255, 255, 255], k * 0.85); }
      case 'plasma': return gradient([[0, [255, 90, 20]], [0.5, a], [1, [255, 250, 205]]], 0.5 + 0.5 * Math.sin(t * 4.5 + idx * 0.7));
      case 'lava': { const k = clamp(0.5 + 0.4 * Math.sin(t * 2.2 + idx * 1.7) + 0.2 * (flick(t, idx, 3) - 0.5), 0, 1); return gradient([[0, [90, 10, 6]], [0.6, [230, 70, 18]], [1, [255, 196, 80]]], k); }
      case 'storm': { const f = flick(t, idx, 5); return f > 0.86 ? mix(shade(a, 0.22), [235, 245, 255], 0.85) : mix(shade(a, 0.22), a, f * 0.6); }
      case 'matrix': return flick(t, idx, 9) > 0.5 ? [96, 255, 130] : [18, 96, 44];
      case 'refract': { const k = Math.max(0.0, 1 - Math.abs(idx - (((t * 8) % 16) - 2)) / 2.0); return mix(hsv(t * 0.4 + idx * 0.09, 0.6, 1.0), [255, 255, 255], k * 0.8); }
      case 'ember': return gradient([[0, [110, 14, 8]], [0.6, [230, 60, 20]], [1, [255, 190, 90]]], clamp(0.5 + 0.35 * Math.sin(t * 2.6 + idx * 1.3) + 0.3 * (flick(t, idx, 7) - 0.5), 0, 1));
      case 'void': return mix([10, 4, 24], a, 0.5 + 0.5 * Math.sin(t * 3 + idx * 0.9));
      case 'ice': return mix(shade(a, 0.5), [240, 252, 255], 0.5 + 0.5 * Math.sin(t * 2.4 + idx * 0.8));
      case 'toxic': return mix([20, 70, 20], [170, 255, 60], 0.5 + 0.5 * Math.sin(t * 5 + idx * 1.1));
      case 'neon': return (Math.trunc(t * 4) + idx) % 2 === 0 ? [255, 70, 220] : [60, 240, 255];
      case 'gold': { const k = Math.max(0.0, 1 - Math.abs(idx - (((t * 6) % 15) - 2)) / 2.5); return mix([190, 140, 40], [255, 244, 170], k); }
      default: return mix(body, [255, 255, 255], 0.6);
    }
  }

  function barrelColor(style, base, accent, t, d, lane) {
    switch (style) {
      case 'rail': return Math.trunc(d * 2 - t * 14) % 6 === 0 ? accent : base;
      case 'coil': return Math.trunc(d * 2.2 - t * 9) % 3 === 0 ? accent : shade(base, 0.7);
      case 'prism': return hsv(t * 0.5 + d * 0.04, 0.55, 1.0);
      case 'crystal': { const f = 0.5 + 0.5 * Math.sin(d * 1.7 - t * 5 + lane * 2.0); return mix(hsv(t * 0.45 + d * 0.07 + lane * 0.2, 0.5, 1.0), [255, 255, 255], 0.6 * f); }
      case 'flame': { const k = clamp(d / 8.0 + 0.2 * Math.sin(t * 20 + d * 3), 0, 1); return gradient([[0, base], [0.55, [255, 120, 30]], [1, [255, 230, 120]]], k); }
      case 'spin': return (Math.trunc(t * 18) + lane) % 3 === 0 ? accent : base;
      case 'void': return mix([20, 10, 40], [170, 90, 255], 0.5 + 0.5 * Math.sin(d * 1.3 - t * 6));
      case 'bolt': return flick(t, Math.trunc(d * 2), lane) > 0.8 ? [235, 245, 255] : mix(base, accent, 0.5);
      default: return base;
    }
  }

  function overlay(cv, x, y, scale, d, t) {
    const kinds = d.ambient.split('+'), N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], N4b = [[2, 0], [-2, 0], [0, 2], [0, -2]];
    if (kinds.includes('sparkle')) {
      for (let i = 0; i < 4; i++) {
        const ang = t * 1.3 + i * Math.PI / 2, sx = x + Math.cos(ang) * 8 * scale, sy = y + 3 * scale + Math.sin(ang) * 5 * scale, tw = 0.5 + 0.5 * Math.sin(t * 9 + i * 1.7);
        cv.blendf(sx, sy, [255, 230, 150], 0.85 * tw);
        for (const [dx, dy] of N4) cv.blendf(sx + dx, sy + dy, [255, 200, 110], 0.3 * tw);
      }
    }
    if (kinds.includes('prism')) {
      for (let i = 0; i < 6; i++) {
        const ph = (t * 0.9 + i * 0.37) % 1.0, sx = x + Math.cos(i * 2.4 + t * 0.6) * (5 + i % 3) * scale, sy = y + (1.5 + 3.2 * ((i * 5) % 4) / 3) * scale + 2 * Math.sin(t * 2 + i);
        const col = hsv(frac(i / 6 + t * 0.4), 0.5, 1.0), a = Math.sin(ph * Math.PI);
        cv.blendf(sx, sy, [255, 255, 255], 0.95 * a);
        for (const [dx, dy] of N4) cv.blendf(sx + dx, sy + dy, col, 0.55 * a);
        for (const [dx, dy] of N4b) cv.blendf(sx + dx, sy + dy, col, 0.25 * a);
      }
    }
    if (kinds.includes('orbit')) {
      for (let i = 0; i < 5; i++) {
        const ang = t * (1.6 + 0.2 * i) + i * 1.26, sx = x + Math.cos(ang) * (7 + i % 2) * scale, sy = y + 3.5 * scale + Math.sin(ang) * 2.4 * scale;
        cv.blendf(sx, sy, d.accent, 0.9);
        cv.blendf(sx - Math.cos(ang + 1.5) * 0.9, sy - Math.sin(ang + 1.5) * 0.9, d.accent, 0.35);
      }
    }
    if (kinds.includes('lightning')) {
      const step = Math.trunc(t * 14);
      for (let i = 0; i < 2; i++) {
        if (flick(step / 30.0, i, 33) > 0.55) {
          let px = x + (flick(step / 30.0, i, 1) - 0.5) * 9 * scale, py = y + 6 * scale;
          for (let s = 0; s < 5; s++) { px += (flick(step / 30.0, i, 10 + s) - 0.5) * 3; py += 1.6; cv.blendf(px, py, [230, 245, 255], 0.9 - s * 0.14); }
        }
      }
    }
    if (kinds.includes('void')) {
      for (let i = 0; i < 6; i++) {
        const k = (t * 0.8 + i / 6) % 1.0, ang = i * 1.05 + t * 0.7;
        cv.blendf(x + Math.cos(ang) * (1 - k) * 9 * scale, y + 3 * scale + Math.sin(ang) * (1 - k) * 5 * scale, [170, 110, 255], 0.7 * k);
      }
    }
  }

  /* spec = { mask, barrel, glow, ambient, accent, paint, hover }, R = data/render.json */
  function drawTank(R, cv, x, y, facing, angle, body, scale, d, t, opt = {}) {
    const recoil = opt.recoil || 0;
    if (d.paint) body = d.paint; else if (body === RAINBOW) body = rainbow(t);
    let lift = opt.lift === undefined ? d.hover : opt.lift;
    const air = opt.hover === undefined ? lift : opt.hover;
    let groundY = y;
    if (air > 0) {
      const bob = 0.6 * Math.sin(t * 2.4) * scale;
      y = y + lift + bob;
      groundY = opt.hover !== undefined ? y - air * scale - bob : y - lift - bob;
    } else if (lift) y = y + lift;
    if (air > 0) {
      const sh = clamp(1.0 - air * scale / 16.0, 0.35, 0.9);
      for (let dx = Math.trunc(-5.5 * scale); dx <= Math.trunc(5.5 * scale); dx++) cv.blendf(x + dx, groundY, [0, 0, 0], 0.55 * sh * (1 - Math.abs(dx) / (5.5 * scale)));
      for (let k = 0; k < 3; k++) cv.blendf(x + (k - 1) * 2 * scale, y - 1, d.accent, 0.35 + 0.25 * Math.sin(t * 17 + k * 2));
    }
    const pal = { t: mix(body, [255, 255, 255], 0.28), h: body, g: mix(body, [255, 255, 255], 0.5), k: mix(shade(body, 0.3), [36, 40, 48], 0.5), w: mix(body, [200, 210, 220], 0.3), d: shade(body, 0.38), a: d.accent };
    const a = angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), spec = R.barrels[d.barrel] || R.barrels.single;
    const px = x, py = y + R.pivot * scale, length = (spec.length - recoil * 2.5) * scale, base = mix(body, [225, 232, 240], 0.4);
    spec.offsets.forEach((off, lane) => {
      for (let k = 0; k < Math.trunc(length * 2) + 1; k++) {
        const dd = k * 0.5, bx = px + dd * ca - off * scale * sa, by = py + dd * sa + off * scale * ca, col = barrelColor(spec.style, base, d.accent, t, dd, lane);
        for (let ox = 0; ox < scale; ox++) for (let oy = 0; oy < scale; oy++) cv.plotf(bx + ox * 0.9 - (scale - 1) * 0.45, by + oy * 0.9 - (scale - 1) * 0.45, col);
      }
    });
    cv.plotf(px + length * ca, py + length * sa, mix(base, [255, 255, 255], 0.6));
    const baseX = Math.floor(x) - 5 * scale, baseY = pyRound(y);
    d.mask.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const ch = row[c]; if (ch === '.') continue;
        const cc = facing > 0 ? c : R.w - 1 - c;
        const col = ch === 'l' ? glowColor(d, body, t, cc) : MAT[ch] ? MAT[ch](body, d.accent, t, cc, r, 0) : (pal[ch] || pal.h);
        const wx = baseX + cc * scale, wy = baseY + (R.h - 1 - r) * scale;
        for (let ox = 0; ox < scale; ox++) for (let oy = 0; oy < scale; oy++) cv.plot(wx + ox, wy + oy, col);
      }
    });
    overlay(cv, x, y, scale, d, t);
  }

  /* The particle halves of the ambient kinds (fire, smoke, sparks...), ported from EffectsFactory._ambient_one. */
  class Particles {
    constructor(cap = 600) { this.items = []; this.cap = cap; this.wind = 0; }
    emit(p) { if (this.items.length < this.cap) this.items.push(Object.assign({ gravity: 0, drag: 0, alpha: 1, size: 1, windk: 0 }, p, { max: p.life })); }
    update(dt) {
      this.items = this.items.filter((p) => {
        p.life -= dt; if (p.life <= 0) return false;
        if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
        p.vy -= p.gravity * dt; if (p.windk) p.vx += this.wind * p.windk * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; return true;
      });
    }
    draw(cv) {
      for (const p of this.items) {
        const t = 1 - p.life / p.max, col = mix(p.c0, p.c1, t), a = p.alpha * (1 - t), x = Math.floor(p.x), y = Math.floor(p.y);
        cv.blend(x, y, col, a);
        if (p.size > 1) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) cv.blend(x + dx, y + dy, col, a * 0.5);
      }
    }
  }
  const U = (a, b) => a + Math.random() * (b - a);
  function ambientOne(ps, kind, x, y, dt) {
    const rate = { fire: 15, burn: 15, smoke: 7, prism: 9 }[kind] || 6;
    if (Math.random() > dt * rate) return;
    const P = (o) => ps.emit(o);
    switch (kind) {
      case 'burn': ['fire', 'smoke', 'embers'].forEach((k) => ambientOne(ps, k, x, y, 1e9)); break;
      case 'sparks': P({ x: x + U(-4, 4), y: y + 6, vx: U(-8, 8), vy: U(10, 24), life: 0.5, c0: [255, 230, 120], c1: [255, 120, 20], gravity: 40 }); break;
      case 'embers': P({ x: x + U(-4, 4), y: y + 5, vx: U(-3, 3), vy: U(6, 14), life: 1.2, c0: [255, 150, 40], c1: [80, 20, 10], gravity: -8, alpha: 0.9 }); break;
      case 'mist': P({ x: x + U(-5, 5), y: y + 2, vx: U(-3, 3), vy: U(2, 6), life: 1.8, c0: [150, 110, 230], c1: [20, 10, 40], alpha: 0.45, size: 2, windk: 0.5 }); break;
      case 'static': { const a = U(0, Math.PI * 2); P({ x: x + U(-5, 5), y: y + U(2, 8), vx: Math.cos(a) * 14, vy: Math.sin(a) * 14, life: 0.16, c0: [235, 245, 255], c1: [90, 150, 255], drag: 2.0 }); break; }
      case 'frost': P({ x: x + U(-5, 5), y: y + 8, vx: U(-3, 3), vy: U(-6, -2), life: 1.6, c0: [235, 250, 255], c1: [120, 170, 220], alpha: 0.8, windk: 0.6 }); break;
      case 'flare': P({ x: x + U(-5, 5), y: y + 6, vx: U(-4, 4), vy: U(8, 18), life: 1.0, c0: [255, 244, 190], c1: [255, 130, 30], alpha: 0.9, gravity: -6 }); break;
      case 'bits': P({ x: x + U(-5, 5), y: y + 7, vx: 0, vy: U(6, 14), life: 0.9, c0: [150, 255, 175], c1: [8, 56, 22], alpha: 0.9 }); break;
      case 'fire': P({ x: x + U(-4.5, 4.5), y: y + U(3, 6), vx: U(-3, 3), vy: U(14, 26), life: 0.55, c0: [255, 214, 90], c1: [200, 30, 8], gravity: -24, alpha: 0.95, size: Math.random() < 0.35 ? 2 : 1 }); break;
      case 'smoke': P({ x: x + U(-4, 4), y: y + 7, vx: U(-3, 3), vy: U(5, 11), life: 2.2, c0: [88, 86, 92], c1: [18, 18, 22], gravity: -4, alpha: 0.55, size: 2, windk: 0.9 }); break;
      case 'prism': { const c = hsv(Math.random(), 0.5, 1.0); P({ x: x + U(-5, 5), y: y + U(1, 7), vx: U(-4, 4), vy: U(3, 10), life: 1.1, c0: c, c1: shade(c, 0.2), alpha: 0.9, gravity: -3 }); break; }
      case 'void': P({ x: x + U(-6, 6), y: y + U(1, 8), vx: U(-3, 3), vy: U(-2, 4), life: 1.4, c0: [150, 90, 240], c1: [10, 4, 24], alpha: 0.7, size: 2, windk: 0.2 }); break;
      case 'bubbles': P({ x: x + U(-5, 5), y: y + 2, vx: U(-2, 2), vy: U(5, 12), life: 1.5, c0: [190, 235, 255], c1: [90, 150, 220], alpha: 0.7, windk: 0.4 }); break;
      case 'petals': P({ x: x + U(-5, 5), y: y + 8, vx: U(-5, 5), vy: U(-6, -1), life: 1.8, c0: [255, 170, 200], c1: [200, 80, 130], alpha: 0.85, windk: 0.8 }); break;
      default: break;
    }
  }
  const ambient = (ps, d, x, y, dt) => d.ambient.split('+').forEach((k) => { if (!['none', 'sparkle', 'orbit', 'lightning'].includes(k)) ambientOne(ps, k, x, y, dt); });

  /* Paint a Px onto a 2D canvas context at an integer scale. */
  function paint(ctx, cv, scale) {
    const img = ctx.createImageData(cv.w, cv.h);
    for (let y = 0; y < cv.h; y++) for (let x = 0; x < cv.w; x++) { const c = cv.rows[y][x], i = (y * cv.w + x) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255; }
    ctx.canvas.width = cv.w; ctx.canvas.height = cv.h; ctx.putImageData(img, 0, 0);
    ctx.canvas.style.width = cv.w * scale + 'px'; ctx.canvas.style.height = cv.h * scale + 'px';
  }

  /* Build a design from chosen part ids, the way the game's design_from_custom does. */
  function composeDesign(R, parts) {
    const rows = [...R.turrets[parts.turret], ...R.hulls[parts.hull], ...R.tracks[parts.track]];
    const acc = R.colors.find((c) => c[0] === parts.accent);
    return { mask: rows, barrel: parts.barrel, glow: parts.glow, ambient: parts.ambient || 'none', accent: acc ? acc[1] : [236, 241, 250], paint: null, hover: 0 };
  }
  return { Px, drawTank, Particles, ambient, paint, composeDesign, mix, shade, hsv, rainbow, RAINBOW };
})();
if (typeof module !== 'undefined') module.exports = TankGfx;
