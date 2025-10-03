// Core signal processing utilities ported from MATLAB live script
// Pages share a single parameter/state model via localStorage.

export const DEFAULTS = {
  B: 700,            // Hz (one-sided bandwidth)
  T: 0.03,           // s  (window length)
  fs_fine: 200_000,  // Hz (fine grid)
  rect_w: 0.003,     // s  (rect pulse width)
  M: 12,             // windowed-sinc half-length in samples (for page3 Hann)
  Ntap: 1024,        // FIR length for LPF
  phi_frac: 0.30,    // fraction of Ts
  plot_sel: 4,       // 1=f_analog,2=f_digital,3=f_pad,4=all
  signal_sel: 2,     // 1=Sinusoid, 2=Gaussian Pulse, 3=Bandlimited Rect
};

export function loadState() {
  try {
    const raw = localStorage.getItem('mlx_params');
    if (!raw) return { ...DEFAULTS };
    const obj = JSON.parse(raw);
    return { ...DEFAULTS, ...obj };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveState(state) {
  localStorage.setItem('mlx_params', JSON.stringify(state));
}

export function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

// Numeric helpers
export function linspace(start, stop, n) {
  const out = new Array(n);
  const step = (stop - start) / (n - 1);
  for (let i = 0; i < n; i++) out[i] = start + i * step;
  return out;
}

export function argMaxAbs(arr) {
  let max = 0;
  for (let i = 0; i < arr.length; i++) { const a = Math.abs(arr[i]); if (a > max) max = a; }
  return max || 1;
}

export function sinc(x) {
  // normalized sinc: sin(pi x)/(pi x) with sinc(0)=1
  if (Array.isArray(x)) return x.map(sinc);
  if (x === 0) return 1;
  const pix = Math.PI * x;
  return Math.sin(pix) / pix;
}

export function hamming(N) {
  const w = new Array(N);
  if (N === 1) { w[0] = 1; return w; }
  for (let n = 0; n < N; n++) w[n] = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1));
  return w;
}

export function convolveSame(x, h) {
  // Linear convolution then center-crop to length x.length
  const nx = x.length, nh = h.length;
  const ny = nx + nh - 1;
  const y = new Array(ny).fill(0);
  for (let i = 0; i < nx; i++) {
    const xi = x[i];
    for (let k = 0; k < nh; k++) y[i + k] += xi * h[k];
  }
  // center crop
  const start = Math.floor((nh - 1) / 2);
  return y.slice(start, start + nx);
}

export function filtfiltFIR(h, x) {
  // zero-phase via forward-backward filtering
  const y1 = convolveSame(x, h);
  const y1r = [...y1].reverse();
  const y2 = convolveSame(y1r, h);
  return y2.reverse();
}

export function interp1(x, y, xi) {
  // x must be sorted ascending; returns y(xi) via linear interpolation with clamp outside
  function interpOne(xq) {
    if (xq <= x[0]) return y[0];
    if (xq >= x[x.length - 1]) return y[y.length - 1];
    // binary search
    let lo = 0, hi = x.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (x[mid] > xq) hi = mid; else lo = mid;
    }
    const t = (xq - x[lo]) / (x[hi] - x[lo]);
    return y[lo] * (1 - t) + y[hi] * t;
  }
  return Array.isArray(xi) ? xi.map(interpOne) : interpOne(xi);
}

export function computeTimeBase(params) {
  const { B, T, fs_fine, phi_frac } = params;
  const fs = 2 * B; // critical sampling at ~2B
  const Ts = 1 / fs;
  const Nf = Math.round(T * fs_fine);
  const t_fine = linspace(0, Nf - 1, Nf).map(i => i / fs_fine - T / 2);
  const Ns = Math.round(T * fs);
  const n_samp = linspace(0, Ns - 1, Ns);
  const t_samp = n_samp.map(n => n * Ts - T / 2 + phi_frac * Ts);
  return { fs, Ts, Nf, t_fine, Ns, t_samp };
}

function rectSignal(t, rect_w) {
  return t.map(tt => (Math.abs(tt) <= rect_w / 2 ? 1 : 0));
}

export function designLPF({ B, fs_fine, Ntap }) {
  const fc = B / fs_fine; // cycles/sample
  const N = Ntap;
  const n = linspace(0, N - 1, N).map(k => k - (N - 1) / 2);
  const hideal = n.map(nn => 2 * fc * sinc(2 * fc * nn));
  const w = hamming(N);
  let h = hideal.map((v, i) => v * w[i]);
  const sum = h.reduce((a, b) => a + b, 0) || 1;
  h = h.map(v => v / sum);
  return h;
}

export function computeSignals(params) {
  const p = { ...DEFAULTS, ...params };
  const { B, T, fs_fine, rect_w, signal_sel } = p;
  const { fs, Ts, Nf, t_fine, Ns, t_samp } = computeTimeBase(p);

  // Build s_fine according to selected signal
  let s_fine, s_samp;
  if (signal_sel === 1) {
    // Sinusoid with f = fs/4 (like the script example)
    s_fine = t_fine.map(t => Math.sin(2 * Math.PI * (fs / 4) * t));
    s_samp = t_samp.map(t => Math.sin(2 * Math.PI * (fs / 4) * t));
  } else if (signal_sel === 2) {
    // Gaussian pulse with bandwidth ~ B/2 (sigma from script)
    const sigma_t = Math.sqrt(Math.log(2)) / (Math.PI * B);
    s_fine = t_fine.map(t => Math.exp(-0.5 * (t / sigma_t) ** 2));
    // Normalize unit peak
    const peak = argMaxAbs(s_fine);
    s_fine = s_fine.map(v => v / peak);
    s_samp = t_samp.map(t => Math.exp(-0.5 * (t / sigma_t) ** 2));
    const peak2 = argMaxAbs(s_samp);
    s_samp = s_samp.map(v => v / (peak2 || 1));
  } else {
    // Bandlimited rectangular via LPF of a rectangle on fine grid
    const rect = rectSignal(t_fine, rect_w);
    const h = designLPF({ B, fs_fine, Ntap: p.Ntap });
    s_fine = convolveSame(rect, h);
    // normalize
    const maxv = argMaxAbs(s_fine);
    s_fine = s_fine.map(v => v / maxv);
    // sample via interpolation on fine grid
    s_samp = interp1(t_fine, s_fine, t_samp);
  }

  // Build s_zero by placing samples on nearest fine-grid indices
  const s_zero = new Array(Nf).fill(0);
  for (let i = 0; i < t_samp.length; i++) {
    const idx = Math.round((t_samp[i] + T / 2) * fs_fine);
    if (idx >= 0 && idx < Nf) s_zero[idx] = s_fine[idx];
  }

  return { ...p, fs, Ts, Nf, Ns, t_fine, t_samp, s_fine, s_samp, s_zero };
}

export function restoreAnalogFromZeroPad(state) {
  // Page 2: LPF restore s_zero to approximate analog
  const { B, fs_fine, Ntap, t_fine, s_zero, s_fine } = state;
  const h = designLPF({ B, fs_fine, Ntap });
  let s_restored = filtfiltFIR(h, s_zero);
  // normalize against its own max to compare shape
  const maxv = argMaxAbs(s_restored);
  if (maxv > 0) s_restored = s_restored.map(v => v / maxv);
  const err = s_fine.map((v, i) => v - s_restored[i]);
  return { t: t_fine, s_restored, err };
}

export function reconstructSinc(state) {
  // Page 3: ideal sinc and windowed-sinc (Hann, width M*Ts)
  const { fs, Ts, M, t_fine, t_samp, s_fine, s_samp } = state;
  const Nf = t_fine.length;
  const Ns = t_samp.length;
  const x_samp = s_samp.slice();

  // Ideal sinc interpolation
  const x_recon_sinc = new Array(Nf).fill(0);
  for (let i = 0; i < Nf; i++) {
    let acc = 0;
    const tf = t_fine[i];
    for (let n = 0; n < Ns; n++) {
      const u = fs * (tf - t_samp[n]);
      acc += x_samp[n] * sinc(u);
    }
    x_recon_sinc[i] = acc;
  }

  // Windowed-sinc with Hann window and finite support |t-t_n| <= M*Ts
  const x_recon_winsinc = new Array(Nf).fill(0);
  for (let i = 0; i < Nf; i++) {
    let acc = 0;
    const tf = t_fine[i];
    for (let n = 0; n < Ns; n++) {
      const d = tf - t_samp[n];
      if (Math.abs(d) > M * Ts) continue;
      const wnorm = d / (M * Ts);
      const W = 0.5 * (1 + Math.cos(Math.PI * wnorm));
      acc += x_samp[n] * sinc(fs * d) * W;
    }
    x_recon_winsinc[i] = acc;
  }

  const err_sinc = x_recon_sinc.map((v, i) => v - s_fine[i]);
  const err_wsin = x_recon_winsinc.map((v, i) => v - s_fine[i]);
  return { x_recon_sinc, x_recon_winsinc, err_sinc, err_wsin };
}

// ===================== FFT and Spectrum =====================
// Radix-2 FFT for power-of-two length, real/imag arrays
function bitReverse(n, bits) {
  let rev = 0;
  for (let i = 0; i < bits; i++) { rev = (rev << 1) | (n & 1); n >>= 1; }
  return rev >>> 0;
}

function nextPow2(n) {
  let p = 1; while (p < n) p <<= 1; return p;
}

function fftRadix2(re, im) {
  const N = re.length;
  const levels = Math.log2(N) | 0;
  // bit-reverse copy
  for (let i = 0; i < N; i++) {
    const j = bitReverse(i, levels);
    if (j > i) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1;
    const tabStep = Math.PI * 2 / size;
    for (let i = 0; i < N; i += size) {
      for (let j = 0; j < half; j++) {
        const k = i + j;
        const l = k + half;
        const ang = tabStep * j;
        const wr = Math.cos(ang), wi = -Math.sin(ang);
        const tr = wr * re[l] - wi * im[l];
        const ti = wr * im[l] + wi * re[l];
        re[l] = re[k] - tr; im[l] = im[k] - ti;
        re[k] = re[k] + tr; im[k] = im[k] + ti;
      }
    }
  }
}

function fftReal(x, Nfft) {
  const N = x.length;
  const M = Nfft ?? nextPow2(N);
  const re = new Float64Array(M);
  const im = new Float64Array(M);
  for (let i = 0; i < N; i++) re[i] = x[i];
  for (let i = N; i < M; i++) re[i] = 0;
  fftRadix2(re, im);
  return { re, im };
}

export function magSpec(x, Fs, Nfft) {
  const M = Nfft ?? nextPow2(x.length);
  const { re, im } = fftReal(x, M);
  const mag = new Array(M);
  let maxv = 0;
  for (let i = 0; i < M; i++) { const m = Math.hypot(re[i], im[i]); mag[i] = m; if (m > maxv) maxv = m; }
  const norm = maxv || 1;
  const magN = mag.map(v => v / norm);
  // fftshift
  const half = M >> 1;
  const magShift = magN.slice(half).concat(magN.slice(0, half));
  const f = new Array(M);
  for (let i = 0; i < M; i++) f[i] = (i - half) * (Fs / M);
  // dB scale for display
  const magdB = magShift.map(v => 20 * Math.log10(v + 1e-12));
  return { f, magdB };
}

