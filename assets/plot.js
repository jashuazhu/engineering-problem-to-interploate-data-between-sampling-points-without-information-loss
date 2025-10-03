// Lightweight plotting helpers for time-domain lines and markers
// No external dependencies; uses Canvas 2D.

export class CanvasPlot {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = Object.assign({
      gridColor: '#2a2f3a',
      axisColor: '#6b7280',
      textColor: '#9ca3af',
      padding: { left: 48, right: 12, top: 12, bottom: 28 },
    }, options);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(600, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(300, Math.floor(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.clear();
  }

  clear() {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
    this.drawGrid();
  }

  drawGrid() {
    const ctx = this.ctx;
    const pad = this.options.padding;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    ctx.save();
    ctx.translate(pad.left, pad.top);
    ctx.strokeStyle = this.options.gridColor;
    ctx.lineWidth = 1;
    const nx = 10, ny = 6;
    for (let i = 0; i <= nx; i++) {
      const x = (i / nx) * plotW + 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, plotH); ctx.stroke();
    }
    for (let j = 0; j <= ny; j++) {
      const y = (j / ny) * plotH + 0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(plotW, y); ctx.stroke();
    }
    ctx.restore();
  }

  plotLines({ x, y, color = '#60a5fa', width = 2, label }) {
    const { xToPx, yToPx } = this;
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let i = 0; i < x.length; i++) {
      const xp = xToPx(x[i]);
      const yp = yToPx(y[i]);
      if (i === 0) ctx.moveTo(xp, yp); else ctx.lineTo(xp, yp);
    }
    ctx.stroke();
    ctx.restore();
  }

  plotMarkers({ x, y, color = '#f59e0b', size = 4, label }) {
    const { xToPx, yToPx } = this;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    for (let i = 0; i < x.length; i++) {
      const xp = xToPx(x[i]);
      const yp = yToPx(y[i]);
      ctx.beginPath();
      ctx.arc(xp, yp, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  setDomain({ xMin, xMax, yMin, yMax }) {
    const pad = this.options.padding;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    this.xMin = xMin; this.xMax = xMax; this.yMin = yMin; this.yMax = yMax;
    this.xToPx = (x) => pad.left + ((x - xMin) / (xMax - xMin)) * plotW;
    this.yToPx = (y) => pad.top + (1 - (y - yMin) / (yMax - yMin)) * plotH;
    this.clear();
    this.drawAxes();
  }

  drawAxes() {
    const ctx = this.ctx;
    const pad = this.options.padding;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    ctx.save();
    ctx.strokeStyle = this.options.axisColor;
    ctx.lineWidth = 1.5;
    // X axis
    ctx.beginPath();
    ctx.moveTo(pad.left, h - pad.bottom + 0.5);
    ctx.lineTo(w - pad.right, h - pad.bottom + 0.5);
    ctx.stroke();
    // Y axis
    ctx.beginPath();
    ctx.moveTo(pad.left + 0.5, pad.top);
    ctx.lineTo(pad.left + 0.5, h - pad.bottom);
    ctx.stroke();
    ctx.restore();
  }
}

export function autoDomain(series) {
  // series: array of {x:[...], y:[...]}
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const s of series) {
    for (const v of s.x) { if (v < xMin) xMin = v; if (v > xMax) xMax = v; }
    for (const v of s.y) { if (v < yMin) yMin = v; if (v > yMax) yMax = v; }
  }
  if (!(isFinite(xMin) && isFinite(xMax))) { xMin = 0; xMax = 1; }
  if (!(isFinite(yMin) && isFinite(yMax))) { yMin = -1; yMax = 1; }
  const yPad = 0.05 * (yMax - yMin || 1);
  return { xMin, xMax, yMin: yMin - yPad, yMax: yMax + yPad };
}

