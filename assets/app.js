import { DEFAULTS, loadState, saveState, clamp, computeSignals, restoreAnalogFromZeroPad, reconstructSinc, magSpec } from './signal.js';
import { CanvasPlot, autoDomain } from './plot.js';

function getEl(id) { return document.getElementById(id); }

export const App = {
  state: null,

  initControls(onChange) {
    const s = loadState();
    this.state = s;
    const phi = getEl('phi_frac');
    const phiVal = getEl('phi_frac_val');
    const plotSel = getEl('plot_sel');
    const sigSel = getEl('signal_sel');

    // Initialize control values
    if (phi) { phi.value = s.phi_frac; phiVal.textContent = s.phi_frac.toFixed(2); }
    if (plotSel) plotSel.value = String(s.plot_sel);
    if (sigSel) sigSel.value = String(s.signal_sel);

    // Bind events
    if (phi) phi.addEventListener('input', () => {
      const v = clamp(parseFloat(phi.value || '0'), 0, 1);
      this.state.phi_frac = v; phiVal.textContent = v.toFixed(2);
      saveState(this.state); onChange?.();
    });
    if (plotSel) plotSel.addEventListener('change', () => {
      this.state.plot_sel = parseInt(plotSel.value, 10);
      saveState(this.state); onChange?.();
    });
    if (sigSel) sigSel.addEventListener('change', () => {
      this.state.signal_sel = parseInt(sigSel.value, 10);
      saveState(this.state); onChange?.();
    });
  },

  compute() {
    // Recompute all dependent signals for current parameters
    this.state = { ...loadState() };
    const model = computeSignals(this.state);
    return model;
  },

  renderPage1() {
    const model = this.compute();
    const { t_fine, t_samp, s_fine, s_samp, s_zero, plot_sel, fs, fs_fine, B } = model;

    const canvas = getEl('plot_time');
    const plot = new CanvasPlot(canvas);
    // Build series according to plot_sel
    const series = [];
    if (plot_sel === 1 || plot_sel === 4) series.push({ x: t_fine, y: s_fine });
    if (plot_sel === 2 || plot_sel === 4) series.push({ x: t_samp, y: s_samp });
    if (plot_sel === 3 || plot_sel === 4) series.push({ x: t_fine, y: s_zero });

    const dom = autoDomain(series);
    plot.setDomain(dom);
    // Colors
    const cFine = '#60a5fa', cSamp = '#f59e0b', cZero = '#34d399';
    if (plot_sel === 1 || plot_sel === 4) plot.plotLines({ x: t_fine, y: s_fine, color: cFine, width: 2 });
    if (plot_sel === 2 || plot_sel === 4) plot.plotMarkers({ x: t_samp, y: s_samp, color: cSamp, size: 3 });
    if (plot_sel === 3 || plot_sel === 4) plot.plotLines({ x: t_fine, y: s_zero, color: cZero, width: 1.5 });

    // Legend
    const legend = getEl('legend_time');
    legend.innerHTML = '';
    function item(color, text) {
      const el = document.createElement('div'); el.className = 'item';
      el.innerHTML = `<span class="swatch" style="background:${color}"></span>${text}`;
      return el;
    }
    if (plot_sel === 1 || plot_sel === 4) legend.appendChild(item('#60a5fa', 's_fine (analog ref)'));
    if (plot_sel === 2 || plot_sel === 4) legend.appendChild(item('#f59e0b', 's_samp (samples)'));
    if (plot_sel === 3 || plot_sel === 4) legend.appendChild(item('#34d399', 's_zero (padded)'));

    // Frequency domain (magnitude, dB)
    const FMAX = 10 * B;
    function cropPos({ f, magdB }) {
      const xf = []; const yf = [];
      for (let i = 0; i < f.length; i++) {
        if (f[i] >= 0 && f[i] <= FMAX) { xf.push(f[i]); yf.push(magdB[i]); }
      }
      return { x: xf, y: yf };
    }
    const seriesF = [];
    if (plot_sel === 1 || plot_sel === 4) {
      seriesF.push(cropPos(magSpec(s_fine, fs_fine)));
    }
    if (plot_sel === 2 || plot_sel === 4) {
      seriesF.push(cropPos(magSpec(s_samp, fs)));
    }
    if (plot_sel === 3 || plot_sel === 4) {
      seriesF.push(cropPos(magSpec(s_zero, fs_fine)));
    }
    const canvasF = getEl('plot_freq');
    if (canvasF) {
      const pF = new CanvasPlot(canvasF);
      const domF = autoDomain(seriesF);
      pF.setDomain(domF);
      let idx = 0;
      if (plot_sel === 1 || plot_sel === 4) { const s = seriesF[idx++]; pF.plotLines({ x: s.x, y: s.y, color: cFine, width: 2 }); }
      if (plot_sel === 2 || plot_sel === 4) { const s = seriesF[idx++]; pF.plotMarkers({ x: s.x, y: s.y, color: cSamp, size: 2 }); }
      if (plot_sel === 3 || plot_sel === 4) { const s = seriesF[idx++]; pF.plotLines({ x: s.x, y: s.y, color: cZero, width: 1.5 }); }
      const legendF = getEl('legend_freq');
      if (legendF) {
        legendF.innerHTML = '';
        if (plot_sel === 1 || plot_sel === 4) legendF.appendChild(item('#60a5fa', '|S_f_i_n_e(f)| (dB)'));
        if (plot_sel === 2 || plot_sel === 4) legendF.appendChild(item('#f59e0b', '|S_s_a_m_p(f)| (dB)'));
        if (plot_sel === 3 || plot_sel === 4) legendF.appendChild(item('#34d399', '|S_z_e_r_o(f)| (dB)'));
      }
    }
  },

  renderPage2() {
    const model = this.compute();
    const { t_fine, s_fine, fs_fine, B } = model;
    const { t, s_restored, err } = restoreAnalogFromZeroPad(model);

    // Plot restored vs fine
    const canvas1 = getEl('plot_restored');
    const p1 = new CanvasPlot(canvas1);
    const dom1 = autoDomain([{ x: t, y: s_restored }, { x: t_fine, y: s_fine }]);
    p1.setDomain(dom1);
    p1.plotLines({ x: t, y: s_restored, color: '#34d399', width: 2 });
    p1.plotLines({ x: t_fine, y: s_fine, color: '#f472b6', width: 1.5 });

    // Plot error
    const canvas2 = getEl('plot_error');
    const p2 = new CanvasPlot(canvas2);
    const dom2 = autoDomain([{ x: t, y: err }]);
    p2.setDomain(dom2);
    p2.plotLines({ x: t, y: err, color: '#f59e0b', width: 1.5 });

    // Frequency domain: restored vs fine
    const FMAX = 10 * B;
    const canvasF = getEl('plot_restored_freq');
    if (canvasF) {
      const specR = magSpec(s_restored, fs_fine);
      const specF = magSpec(s_fine, fs_fine);
      function crop({ f, magdB }) { const x=[],y=[]; for (let i=0;i<f.length;i++){ if(f[i]>=0&&f[i]<=FMAX){x.push(f[i]);y.push(magdB[i]);}} return {x,y}; }
      const sR = crop(specR), sF = crop(specF);
      const pF = new CanvasPlot(canvasF);
      const domF = autoDomain([sR, sF]);
      pF.setDomain(domF);
      pF.plotLines({ x: sR.x, y: sR.y, color: '#34d399', width: 2 });
      pF.plotLines({ x: sF.x, y: sF.y, color: '#f472b6', width: 1.5 });
    }
  },

  renderPage3() {
    const model = this.compute();
    const { t_fine, s_fine, fs_fine, B } = model;
    const { x_recon_sinc, x_recon_winsinc, err_sinc, err_wsin } = reconstructSinc(model);

    // Recon plot
    const canvas1 = getEl('plot_recon');
    const p1 = new CanvasPlot(canvas1);
    const dom1 = autoDomain([
      { x: t_fine, y: x_recon_sinc },
      { x: t_fine, y: x_recon_winsinc },
      { x: t_fine, y: s_fine },
    ]);
    p1.setDomain(dom1);
    p1.plotLines({ x: t_fine, y: x_recon_sinc, color: '#60a5fa', width: 2 });
    p1.plotLines({ x: t_fine, y: x_recon_winsinc, color: '#10b981', width: 2 });
    p1.plotLines({ x: t_fine, y: s_fine, color: '#f472b6', width: 1.25 });

    // Error plot
    const canvas2 = getEl('plot_recon_err');
    const p2 = new CanvasPlot(canvas2);
    const dom2 = autoDomain([
      { x: t_fine, y: err_sinc },
      { x: t_fine, y: err_wsin },
    ]);
    p2.setDomain(dom2);
    p2.plotLines({ x: t_fine, y: err_sinc, color: '#f59e0b', width: 1.5 });
    p2.plotLines({ x: t_fine, y: err_wsin, color: '#f59e0b', width: 1.5 });

    // Frequency domain: recon vs fine
    const FMAX = 10 * B;
    const canvasF = getEl('plot_recon_freq');
    if (canvasF) {
      const specI = magSpec(x_recon_sinc, fs_fine);
      const specW = magSpec(x_recon_winsinc, fs_fine);
      const specF = magSpec(s_fine, fs_fine);
      function crop({ f, magdB }) { const x=[],y=[]; for (let i=0;i<f.length;i++){ if(f[i]>=0&&f[i]<=FMAX){x.push(f[i]);y.push(magdB[i]);}} return {x,y}; }
      const sI = crop(specI), sW = crop(specW), sF = crop(specF);
      const pF = new CanvasPlot(canvasF);
      const domF = autoDomain([sI, sW, sF]);
      pF.setDomain(domF);
      pF.plotLines({ x: sI.x, y: sI.y, color: '#60a5fa', width: 2 });
      pF.plotLines({ x: sW.x, y: sW.y, color: '#10b981', width: 2 });
      pF.plotLines({ x: sF.x, y: sF.y, color: '#f472b6', width: 1.25 });
    }
  },
};

window.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;

  function render() {
    if (page === 'page1') App.renderPage1();
    else if (page === 'page2') App.renderPage2();
    else if (page === 'page3') App.renderPage3();
  }

  App.initControls(render);
  // Cross-tab updates: re-render if localStorage params change
  window.addEventListener('storage', (e) => { if (e.key === 'mlx_params') { App.state = loadState(); render(); } });
  render();
});
