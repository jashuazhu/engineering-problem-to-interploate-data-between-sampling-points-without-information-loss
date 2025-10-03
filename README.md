Nyquist Recovery Web (static)

Overview
- Static, publishable HTML version of the MATLAB Live Script “Signal_interpolate_Web.mlx”.
- Pages mirror the live script sections: index, Page 1 (signals), Page 2 (LPF restoration), Page 3 (sinc interpolation).
- All computations happen in the browser with vanilla JavaScript; no external libraries.

Files
- web/index.html — landing page and shared controls
- web/page1.html — analog/discrete/zero-padded views
- web/page2.html — LPF restoration (forward–backward FIR)
- web/page3.html — ideal sinc and windowed-sinc reconstruction
- web/assets/styles.css — theme and layout
- web/assets/signal.js — math/compute layer
- web/assets/plot.js — lightweight canvas plotting
- web/assets/app.js — UI and page orchestration

Controls (persist across pages)
- phi_frac: phase shift fraction of Ts in [0, 1]
- plot_sel: 1=f_analog (s_fine), 2=f_digital (s_samp), 3=f_pad (s_zero), 4=all
- signal_sel: 1=Sinusoid, 2=Gaussian, 3=Bandlimited Rectangular

Model defaults
- B=700 Hz, T=0.03 s, fs_fine=200 kHz, fs=2B, rect_w=3 ms, M=12 (windowed-sinc), FIR Ntap=1024.

Notes
- The analog “fine” rectangular is approximated by a Hamming-windowed-sinc LPF applied to a rectangle on the fine grid (close to the script’s ideal LPF).
- LPF restoration uses zero-phase filtering via forward/backward FIR convolution (filtfilt style).
- Ideal sinc and windowed-sinc interpolation follow the live script equations directly.

Publish
- This is a static site; serve the `web/` folder with any static server (e.g., `python -m http.server`), or upload to any static hosting (S3, GitHub Pages, etc.).

