/* ===== InteliTech — app.js ===== */
(function () {
  'use strict';

  const FRAME_COUNT = 192;
  const FRAME_DIR = 'frame movil/frame_';
  const WHATSAPP = '56948922008';
  const USD_CLP = 38000;
  const MIN_PRELOAD_MS = 5500;
  const CAP_PRELOAD_MS = 12000;
  const EARLY_FRAMES = 60;

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const pad = (n) => String(n).padStart(4, '0');

  /* ===== Preload de frames ===== */
  const frames = new Array(FRAME_COUNT).fill(null);
  let loaded = 0;
  let done = 0;

  function preloadFrame(i) {
    if (frames[i]) return Promise.resolve();
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        frames[i] = img;
        loaded++;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = FRAME_DIR + pad(i + 1) + '.jpg';
    });
  }

  async function preloadAll(onProgress) {
    let first = true;
    for (let start = 0; start < FRAME_COUNT; start += 8) {
      const batch = [];
      for (let j = start; j < Math.min(start + 8, FRAME_COUNT); j++) {
        batch.push(loadWithRetry(j, 3));
      }
      await Promise.all(batch);
      if (first) {
        first = false;
        if (frames[0]) drawFrame(1);
      }
      onProgress && onProgress(loaded);
    }
  }

  async function loadWithRetry(i, retries) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (frames[i]) return;
      await preloadFrame(i);
      if (frames[i]) return;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }

  /* ===== Canvas hero ===== */
  const canvas = $('#hero-canvas');
  const ctx = canvas.getContext('2d');
  const FRAME_W = 720, FRAME_H = 1280;
  let dpr = 1;
  let currentFrame = 0;

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    if (currentFrame > 0) drawFrame(currentFrame);
    else if (frames[0]) drawFrame(1);
  }

  function drawFrame(n) {
    const img = frames[n - 1];
    if (!img || !img.complete) return;
    const cw = canvas.width, ch = canvas.height;
    const scale = Math.max(cw / FRAME_W, ch / FRAME_H);
    const w = FRAME_W * scale, h = FRAME_H * scale;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    currentFrame = n;
  }

  function updateCounter(n) {
    $('#frame-now').textContent = pad(n);
    $('#frame-total').textContent = pad(FRAME_COUNT);
  }

  /* ===== Preloader ===== */
  const preloader = $('#preloader');
  const plNum = $('#pl-num');
  const plBar = $('#pl-bar');
  const plHint = $('#pl-hint');
  const startTime = performance.now();
  let preloadDone = false;

  preloadAll(() => {
    const pct = Math.round((loaded / FRAME_COUNT) * 100);
    plNum.textContent = pct;
    plBar.style.width = pct + '%';
    plHint.textContent = loaded + ' / ' + FRAME_COUNT + ' frames';
  }).then(() => {
    preloadDone = true;
    tryFinishPreload();
  });

  function tryFinishPreload() {
    if (preloader.classList.contains('hidden')) return;
    const elapsed = performance.now() - startTime;
    const ready = (preloadDone && loaded >= EARLY_FRAMES) || elapsed >= CAP_PRELOAD_MS;
    const minTimeOk = elapsed >= MIN_PRELOAD_MS;
    if (ready && minTimeOk) finishPreload();
    else if (ready) setTimeout(finishPreload, MIN_PRELOAD_MS - elapsed);
  }
  setTimeout(tryFinishPreload, MIN_PRELOAD_MS);

  function finishPreload() {
    const elapsed = Math.max(0, MIN_PRELOAD_MS - (performance.now() - startTime));
    gsap.to(preloader, {
      opacity: 0,
      duration: 0.8,
      delay: elapsed / 1000,
      onComplete: () => {
        preloader.classList.add('hidden');
        document.body.classList.remove('locked');
        gsap.set(preloader, { display: 'none' });
      }
    });
    heroIntro();
  }

  function heroIntro() {
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .to('.eyebrow', { opacity: 1, y: 0, duration: 0.9 }, 0.1)
      .to('#hero h1', { opacity: 1, y: 0, duration: 1 }, 0.25)
      .to('.tagline', { opacity: 1, y: 0, duration: 0.9 }, 0.45)
      .to('.ctas', { opacity: 1, y: 0, duration: 0.9 }, 0.6)
      .to('.trust', { opacity: 1, y: 0, duration: 0.9 }, 0.75);
  }

  /* ===== Lenis smooth scroll ===== */
  let lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ===== ScrollTrigger frame player ===== */
  let heroDone = false;
  function initHeroScrub() {
    if (heroDone) return;
    heroDone = true;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    gsap.set('.eyebrow, #hero h1, .tagline, .ctas, .trust', { opacity: 0, y: 30 });
    gsap.set('.eyebrow', { opacity: 0, y: -14 });

    ScrollTrigger.create({
      trigger: '#hero',
      start: 'top top',
      end: '+=' + (FRAME_COUNT - 1) * 8,
      pin: true,
      scrub: true,
      snap: {
        snapTo: 1 / (FRAME_COUNT - 1),
        duration: { min: 0.08, max: 0.2 },
        ease: 'power1.inOut'
      },
      onUpdate: (self) => {
        const f = Math.max(1, Math.min(FRAME_COUNT, Math.round(self.progress * (FRAME_COUNT - 1)) + 1));
        if (f !== currentFrame) {
          drawFrame(f);
          updateCounter(f);
        }
        $('#scr-progress').style.height = (self.progress * 100).toFixed(1) + '%';
        const hint = $('#scroll-hint');
        if (self.progress > 0.04) hint.style.opacity = Math.max(0, 1 - self.progress * 8);
      }
    });

    gsap.to('.content', {
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: '+=14%',
        scrub: true
      },
      opacity: 0.22,
      scale: 0.96,
      y: -40,
      ease: 'none'
    });
  }

  /* ===== Three.js partículas ===== */
  function initParticles() {
    const pCanvas = $('#particles');
    const renderer = new THREE.WebGLRenderer({ canvas: pCanvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.z = 420;

    const COUNT = 260;
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1400;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 800;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 800;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xA855F7,
      size: 3.2,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    let targetX = 0, targetY = 0;
    window.addEventListener('mousemove', (e) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 0.4;
      targetY = (e.clientY / window.innerHeight - 0.5) * 0.3;
    });

    function tick() {
      requestAnimationFrame(tick);
      const t = Date.now() * 0.00008;
      points.rotation.y = t + targetX;
      points.rotation.x = t * 0.6 + targetY;
      points.position.y = Math.sin(t * 2) * 14;
      renderer.render(scene, camera);
    }
    tick();

    window.addEventListener('resize', () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });
  }

  /* ===== Navbar ===== */
  const nav = $('#nav');
  const burger = $('#burger');
  const mobileMenu = $('#mobile-menu');
  const hero = $('#hero');

  function onScrollNav() {
    nav.classList.toggle('scrolled', window.scrollY > window.innerHeight * 0.7);
  }
  window.addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();

  function closeMenu() {
    mobileMenu.classList.remove('open');
    burger.classList.remove('open');
    document.body.classList.remove('locked');
  }
  burger.addEventListener('click', () => {
    const open = !mobileMenu.classList.contains('open');
    mobileMenu.classList.toggle('open', open);
    burger.classList.toggle('open', open);
    document.body.classList.toggle('locked', open);
    if (open) {
      $$('#mobile-menu a').forEach((a, i) => {
        gsap.fromTo(a, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.05 * i, ease: 'power3.out' });
      });
    }
  });
  $$('#mobile-menu a').forEach((a) => a.addEventListener('click', closeMenu));

  /* ===== Reveals ===== */
  function initReveals() {
    $$('[data-reveal]').forEach((el) => {
      gsap.fromTo(el,
        { opacity: 0, y: 42 },
        {
          opacity: 1, y: 0, duration: 1.05, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 84%' }
        }
      );
    });
  }

  /* ===== Manifiesto (filosofía) ===== */
  function initManifesto() {
    const lines = $$('[data-mani]');
    const section = $('#filosofia');
    ScrollTrigger.create({
      trigger: section,
      start: 'top 70%',
      end: 'bottom 40%',
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;
        lines.forEach((line, i) => {
          const span = 1 / lines.length;
          const start = i * span;
          const a = p < start ? 0.14 : p > start + span * 0.72 ? 1 : 0.14 + (p - start) / (span * 0.72) * 0.86;
          line.style.opacity = Math.min(1, a);
          line.style.transform = 'translateY(' + Math.max(0, 40 - a * 40) + 'px)';
        });
      }
    });
  }

  /* ===== Contadores stats ===== */
  function initCounters() {
    $$('[data-count]').forEach((el) => {
      const target = parseInt(el.dataset.count, 10);
      const prefix = el.dataset.prefix || '';
      const obj = { v: 0 };
      gsap.to(obj, {
        v: target,
        duration: 2.2,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%' },
        onUpdate: () => {
          el.textContent = prefix + Math.round(obj.v).toLocaleString('es-CL');
        }
      });
    });
  }

  /* ===== Cotizador ===== */
  const PRICES = {
    iphone: {
      label: 'iPhone',
      faults: {
        pantalla: { label: 'Cambio de pantalla / cristal', price: 149000 },
        bateria: { label: 'Cambio de batería', price: 59900 },
        carga: { label: 'Puerto de carga / no carga', price: 49900 },
        noenciende: { label: 'No enciende', price: 89900 },
        camara: { label: 'Cámara / vidrio de cámara', price: 79900 },
        software: { label: 'Software / no arranca iOS', price: 29900 },
        repuestos: { label: 'Otro repuesto / diagnóstico', price: 49900 }
      }
    },
    android: {
      label: 'Samsung / Android',
      faults: {
        pantalla: { label: 'Cambio de pantalla / cristal', price: 89900 },
        bateria: { label: 'Cambio de batería', price: 49900 },
        carga: { label: 'Puerto de carga / no carga', price: 39900 },
        noenciende: { label: 'No enciende', price: 69900 },
        camara: { label: 'Cámara / vidrio de cámara', price: 59900 },
        software: { label: 'Software / flasheo', price: 24900 },
        repuestos: { label: 'Otro repuesto / diagnóstico', price: 39900 }
      }
    },
    notebook: {
      label: 'Notebook',
      faults: {
        mantenimiento: { label: 'Mantenimiento térmico / limpieza', price: 59900 },
        placa: { label: 'Placa madre / micro-soldadura', price: 129000 },
        pantalla: { label: 'Pantalla / flex / bisagras', price: 129000 },
        bateria: { label: 'Batería / cargador / DC', price: 79900 },
        ssd: { label: 'SSD / RAM / clonación', price: 69900 },
        noenciende: { label: 'No enciende', price: 99900 },
        software: { label: 'Software / formateo', price: 39900 }
      }
    },
    consola: {
      label: 'Consola',
      faults: {
        hdmi: { label: 'Puerto HDMI / sin señal', price: 79900 },
        metal: { label: 'Sobrecalentamiento / metal líquido', price: 59900 },
        drift: { label: 'Drift de joysticks / Hall Effect', price: 49900 },
        noenciende: { label: 'No enciende / apagones', price: 99900 },
        limpieza: { label: 'Limpieza y mantención', price: 39900 },
        software: { label: 'Software / actualización', price: 29900 },
        repuestos: { label: 'Otro repuesto / diagnóstico', price: 49900 }
      }
    },
    tv: {
      label: 'Smart TV',
      faults: {
        backlight: { label: 'Tiene sonido pero no imagen (LED)', price: 89900 },
        fuente: { label: 'No enciende / fuente', price: 79900 },
        mainboard: { label: 'Mainboard / placa principal', price: 119000 },
        hdmi: { label: 'Puertos HDMI dañados', price: 59900 },
        noenciende: { label: 'Pegado en logo / firmware', price: 49900 },
        repuestos: { label: 'Otro repuesto / diagnóstico', price: 69900 }
      }
    },
    empresa: {
      label: 'Empresa / Corporativo',
      faults: {
        flota: { label: 'Flota corporativa / convenio', price: 0 },
        preventiva: { label: 'Mantención preventiva', price: 0 },
        urgencia: { label: 'Soporte urgente / SLA', price: 0 },
        repuestos: { label: 'Repuestos al por mayor', price: 0 },
        otros: { label: 'Otro requerimiento', price: 0 }
      }
    }
  };

  const TIERS = {
    estandar: { label: 'Estándar', mult: 1 },
    premium: { label: 'Premium', mult: 1.25 },
    expres: { label: 'Exprés', mult: 1.45 }
  };

  let selDevice = 'iphone';
  let selTier = 'estandar';

  function fmtCLP(v) {
    return '$' + Math.round(v).toLocaleString('es-CL');
  }

  function currentPrice() {
    const dev = PRICES[selDevice];
    const fault = dev.faults[$('#fault-select').value] || Object.values(dev.faults)[0];
    const mult = TIERS[selTier].mult;
    return { base: fault.price, mult };
  }

  function refreshQuote() {
    const dev = PRICES[selDevice];
    const fault = dev.faults[$('#fault-select').value] || Object.values(dev.faults)[0];
    if (selDevice === 'empresa') {
      $('#q-clp').textContent = 'A medida';
      $('#q-usd').textContent = 'SLA';
      return;
    }
    const mult = TIERS[selTier].mult;
    const raw = fault.price * mult;
    const rounded = Math.round(raw / 1000) * 1000;
    const usd = Math.round(rounded / USD_CLP);
    $('#q-clp').textContent = fmtCLP(rounded);
    $('#q-usd').textContent = usd.toLocaleString('es-CL');
  }

  function fillFaults() {
    const dev = PRICES[selDevice];
    const sel = $('#fault-select');
    sel.innerHTML = Object.entries(dev.faults)
      .map(([k, v]) => '<option value="' + k + '">' + v.label + '</option>')
      .join('');
    refreshQuote();
  }

  $('#device-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    selDevice = chip.dataset.device;
    $$('#device-chips .chip').forEach((c) => c.classList.toggle('active', c === chip));
    fillFaults();
  });

  $('#fault-select').addEventListener('change', refreshQuote);

  $$('.tier').forEach((t) => {
    t.addEventListener('click', () => {
      selTier = t.dataset.tier;
      $$('.tier').forEach((x) => x.classList.toggle('active', x === t));
      refreshQuote();
    });
  });

  function sendQuote() {
    const name = $('#q-name').value.trim();
    const phone = $('#q-phone').value.trim();
    if (!name || !phone) {
      const panel = $('.qz-panel');
      gsap.fromTo(panel, { x: 0 }, { x: -10, duration: 0.08, repeat: 5, yoyo: true, onComplete: () => gsap.set(panel, { x: 0 }) });
      $('#q-name').focus();
      return;
    }
    const dev = PRICES[selDevice];
    const fault = dev.faults[$('#fault-select').value];
    const tier = TIERS[selTier];
    const isEmpresa = selDevice === 'empresa';
    let valueLine;
    if (isEmpresa) {
      valueLine = 'Valor: cotización personalizada (SLA)';
    } else {
      const raw = fault.price * tier.mult;
      const rounded = Math.round(raw / 1000) * 1000;
      valueLine = 'Valor estimado: ' + fmtCLP(rounded) + ' CLP (≈ USD ' + Math.round(rounded / USD_CLP).toLocaleString('es-CL') + ')';
    }
    const msg = [
      'Hola InteliTech, quiero cotizar una reparación:',
      '',
      '• Nombre: ' + name,
      '• Teléfono: ' + phone,
      '• Dispositivo: ' + dev.label,
      '• Falla: ' + fault.label,
      '• Nivel de servicio: ' + tier.label,
      '• ' + valueLine,
      '',
      'Solicito confirmación del presupuesto final. ¡Gracias!'
    ].join('\n');
    window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(msg), '_blank');
  }
  $('#q-send').addEventListener('click', sendQuote);

  /* ===== Formulario contacto ===== */
  $('#ct-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#ct-name').value.trim();
    const phone = $('#ct-phone').value.trim();
    const msg = $('#ct-msg').value.trim();
    if (!name || !phone || !msg) return;
    const text = [
      'Hola InteliTech, mensaje desde la web:',
      '',
      '• Nombre: ' + name,
      '• Teléfono: ' + phone,
      '• Mensaje: ' + msg
    ].join('\n');
    window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(text), '_blank');
  });

  /* ===== Música ===== */
  const audio = $('#bg-music');
  const musicBtn = $('#music-btn');
  let musicStarted = false;
  let musicAllowed = false;
  let fadeTween = null;

  function fadeTo(v, dur) {
    if (fadeTween) fadeTween.kill();
    fadeTween = gsap.to(audio, { volume: v, duration: dur, ease: 'power1.out' });
  }

  function startMusic() {
    if (musicStarted) return;
    musicStarted = true;
    audio.volume = 0;
    audio.play().catch(() => { musicStarted = false; });
    fadeTo(0.3, 1.6);
    musicBtn.classList.remove('paused');
    musicBtn.classList.add('playing');
  }

  function toggleMusic() {
    if (!musicAllowed) {
      if (musicStarted) {
        audio.pause();
        musicStarted = false;
        musicBtn.classList.remove('playing');
        musicBtn.classList.add('paused');
      } else {
        startMusic();
      }
      return;
    }
    if (musicStarted) {
      fadeTo(0, 0.8);
      setTimeout(() => {
        audio.pause();
        musicStarted = false;
        musicBtn.classList.remove('playing');
        musicBtn.classList.add('paused');
      }, 800);
    } else {
      startMusic();
    }
  }
  musicBtn.addEventListener('click', toggleMusic);

  /* ===== Consentimiento ===== */
  const consent = $('#consent');
  function setConsent(value) {
    try {
      localStorage.setItem('it_consent_v1', JSON.stringify({ accepted: value, at: Date.now() }));
    } catch (err) {}
    consent.classList.remove('show');
    if (value) startMusic();
  }
  $('#consent-ok').addEventListener('click', () => setConsent(true));
  $('#consent-no').addEventListener('click', () => setConsent(false));

  let consentDone = false;
  function maybeShowConsent() {
    if (consentDone) return;
    consentDone = true;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('it_consent_v1') || 'null'); } catch (err) {}
    if (saved === null) {
      setTimeout(() => consent.classList.add('show'), 2600);
    } else if (saved.accepted) {
      musicAllowed = true;
      startMusic();
    }
  }

  /* ===== Init ===== */
  function boot() {
    initParticles();
    initHeroScrub();
    initReveals();
    initManifesto();
    initCounters();
    fillFaults();
    $('#year').textContent = new Date().getFullYear();
    maybeShowConsent();
    ScrollTrigger.refresh();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    boot();
  } else {
    window.addEventListener('DOMContentLoaded', boot);
  }
})();
