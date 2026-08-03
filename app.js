/* ===== InteliTech — app.js v2 ===== */
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

  function preloadFrame(i) {
    if (frames[i]) return Promise.resolve();
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { frames[i] = img; loaded++; resolve(); };
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
  let pendingFrame = 0;
  let drawScheduled = false;

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
    const scale = Math.min(cw / FRAME_W, ch / FRAME_H);
    const w = FRAME_W * scale, h = FRAME_H * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    currentFrame = n;
  }

  function requestDraw(n) {
    pendingFrame = n;
    if (drawScheduled) return;
    drawScheduled = true;
    requestAnimationFrame(() => {
      drawScheduled = false;
      if (pendingFrame && pendingFrame !== currentFrame) drawFrame(pendingFrame);
      pendingFrame = 0;
    });
  }

  function updateCounter(n) {
    $('#frame-now').textContent = pad(n);
    $('#frame-total').textContent = pad(FRAME_COUNT);
  }

  /* ===== Preloader ===== */
  resizeCanvas();

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
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  const HERO_TEXT = [
    { el: '.eyebrow', a: 0.02, b: 0.09, out: 0.5 },
    { el: '#hero h1', a: 0.09, b: 0.17, out: 0.55 },
    { el: '.tagline', a: 0.16, b: 0.24, out: 0.6 },
    { el: '.ctas', a: 0.23, b: 0.31, out: 0.65 },
    { el: '.trust', a: 0.3, b: 0.38, out: 0.7 }
  ].map((t) => Object.assign({ node: $(t.el) }, t));

  function updateHeroText(p) {
    HERO_TEXT.forEach((t) => {
      const node = t.node;
      if (!node) return;
      const o = clamp01((p - t.a) / (t.b - t.a)) * (1 - clamp01((p - t.out) / 0.06));
      node.style.opacity = o;
      node.style.transform = 'translateY(' + (26 - o * 26).toFixed(1) + 'px)';
    });
  }

  function initHeroScrub() {
    if (heroDone) return;
    heroDone = true;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    updateHeroText(0);

    ScrollTrigger.create({
      trigger: '#hero',
      start: 'top top',
      end: '+=' + (FRAME_COUNT - 1) * 14,
      pin: true,
      scrub: true,
      snap: {
        snapTo: 1 / (FRAME_COUNT - 1),
        duration: { min: 0.06, max: 0.16 },
        ease: 'power1.inOut'
      },
      onUpdate: (self) => {
        const p = self.progress;
        const f = Math.max(1, Math.min(FRAME_COUNT, Math.round(p * (FRAME_COUNT - 1)) + 1));
        if (f !== currentFrame) {
          requestDraw(f);
          updateCounter(f);
        }
        $('#scr-progress').style.height = (p * 100).toFixed(1) + '%';
        const hint = $('#scroll-hint');
        if (p > 0.02) hint.style.opacity = Math.max(0, 1 - p * 6);
        updateHeroText(p);
      }
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

  /* ===== Navbar / scroll state ===== */
  const nav = $('#nav');
  const toTop = $('#to-top');

  function onScrollPos() {
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > window.innerHeight * 0.7);
    toTop.classList.toggle('show', y > window.innerHeight * 1.3);
  }
  if (lenis) lenis.on('scroll', onScrollPos);
  window.addEventListener('scroll', onScrollPos, { passive: true });
  onScrollPos();

  toTop.addEventListener('click', () => smoothTo(0));

  const burger = $('#burger');
  const mobileMenu = $('#mobile-menu');

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

  /* ===== Anclas suaves (Lenis) ===== */
  function smoothTo(target) {
    if (target === 0) {
      if (lenis) lenis.scrollTo(0, { duration: 1.2 });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (lenis) {
      lenis.scrollTo(target, { offset: -72, duration: 1.25 });
    } else {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function initAnchors() {
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href');
        if (!href || href === '#') return;
        const target = href === '#inicio' ? 0 : document.querySelector(href);
        if (target === null) return;
        e.preventDefault();
        closeMenu();
        smoothTo(target);
      });
    });
  }

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

  /* ===== Servicios: reveals direccionales (RTL en móvil) ===== */
  function initSvcReveals() {
    const mm = gsap.matchMedia();
    mm.add('(max-width: 959px)', () => {
      $$('.svc').forEach((el) => {
        const text = el.querySelector('.svc-text');
        const media = el.querySelector('.svc-media');
        if (!text || !media) return;
        gsap.fromTo(text, { opacity: 0, x: 96 }, {
          opacity: 1, x: 0, duration: 0.9, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 82%' }
        });
        gsap.fromTo(media, { opacity: 0, x: -96 }, {
          opacity: 1, x: 0, duration: 0.9, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 82%' }
        });
      });
    });
    mm.add('(min-width: 960px)', () => {
      $$('.svc').forEach((el) => {
        gsap.fromTo(el, { opacity: 0, y: 48 }, {
          opacity: 1, y: 0, duration: 1.05, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 84%' }
        });
      });
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

  /* ===== Cotizador 2026 ===== */
  const PRICES = {
    iphone: {
      label: 'iPhone',
      models: [
        { id: 'x', label: 'iPhone X · XS · XR', mult: 1, screen: 85000 },
        { id: '11', label: 'iPhone 11 · 11 Pro', mult: 1.15, screen: 90000 },
        { id: '12', label: 'iPhone 12 · 12 Pro', mult: 1.35, screen: 129000 },
        { id: '13', label: 'iPhone 13 · 13 Pro', mult: 1.5, screen: 149000 },
        { id: '14', label: 'iPhone 14 · 14 Pro', mult: 1.65, screen: 169000 },
        { id: '15', label: 'iPhone 15 · 15 Pro', mult: 2.0, screen: 319000 },
        { id: '16', label: 'iPhone 16 · 16 Pro', mult: 2.3, screen: 359000 }
      ],
      faults: {
        pantalla: { label: 'Cambio de pantalla', base: 85000 },
        bateria: { label: 'Cambio de batería', base: 55000 },
        carga: { label: 'Puerto de carga / no carga', base: 45000 },
        noenciende: { label: 'No enciende', base: 80000 },
        camara: { label: 'Cámara / vidrio de cámara', base: 70000 },
        software: { label: 'Software / no arranca iOS', base: 25000 },
        otros: { label: 'Otro repuesto / diagnóstico', base: 30000 }
      }
    },
    android: {
      label: 'Samsung / Android',
      models: [
        { id: 'media', label: 'Gama media · A / M / Redmi', mult: 1, screen: 65000 },
        { id: 'alta', label: 'Gama alta · S / Note / flagship', mult: 1.4, screen: 149000 },
        { id: 'fold', label: 'Plegable · Z Fold / Z Flip', mult: 1.9, screen: 380000 }
      ],
      faults: {
        pantalla: { label: 'Cambio de pantalla', base: 65000 },
        bateria: { label: 'Cambio de batería', base: 45000 },
        carga: { label: 'Puerto de carga / no carga', base: 35000 },
        noenciende: { label: 'No enciende', base: 60000 },
        camara: { label: 'Cámara / vidrio de cámara', base: 50000 },
        software: { label: 'Software / flasheo', base: 20000 },
        otros: { label: 'Otro repuesto / diagnóstico', base: 30000 }
      }
    },
    notebook: {
      label: 'Notebook',
      models: [
        { id: 'std', label: 'Estándar / oficina', mult: 1 },
        { id: 'gamer', label: 'Gamer / pro (GPU dedicada)', mult: 1.35 },
        { id: 'mac', label: 'MacBook / Apple Silicon', mult: 1.55 }
      ],
      faults: {
        mantenimiento: { label: 'Mantenimiento térmico / limpieza', base: 59000 },
        placa: { label: 'Placa madre / micro-soldadura', base: 129000 },
        pantalla: { label: 'Pantalla / flex / bisagras', base: 129000 },
        bateria: { label: 'Batería / cargador / DC', base: 79000 },
        ssd: { label: 'SSD / RAM / clonación', base: 69000 },
        noenciende: { label: 'No enciende', base: 99000 },
        software: { label: 'Software / formateo', base: 39000 }
      }
    },
    consola: {
      label: 'Consola',
      models: [
        { id: 'ps5', label: 'PS5 · Slim · Pro', mult: 1 },
        { id: 'ps4', label: 'PS4 · PS4 Pro', mult: 0.75 },
        { id: 'xbox', label: 'Xbox Series X|S · One', mult: 1 },
        { id: 'switch', label: 'Nintendo Switch · OLED', mult: 0.7 }
      ],
      faults: {
        hdmi: { label: 'Puerto HDMI / sin señal', base: 59000 },
        metal: { label: 'Sobrecalentamiento / metal líquido', base: 59000 },
        drift: { label: 'Drift de joysticks / Hall Effect', base: 49000 },
        noenciende: { label: 'No enciende / apagones', base: 99000 },
        limpieza: { label: 'Limpieza y mantención', base: 39000 },
        software: { label: 'Software / actualización', base: 29000 },
        otros: { label: 'Otro repuesto / diagnóstico', base: 40000 }
      }
    },
    tv: {
      label: 'Smart TV',
      models: [
        { id: 's', label: '32" – 50"', mult: 0.9 },
        { id: 'm', label: '50" – 65"', mult: 1 },
        { id: 'l', label: '65" en adelante', mult: 1.3 }
      ],
      faults: {
        backlight: { label: 'Sonido pero no imagen (LED)', base: 49000 },
        fuente: { label: 'No enciende / fuente de poder', base: 39000 },
        mainboard: { label: 'Mainboard / placa principal', base: 79000 },
        hdmi: { label: 'Puertos HDMI dañados', base: 49000 },
        firmware: { label: 'Pegado en logo / firmware', base: 45000 },
        otros: { label: 'Otro repuesto / diagnóstico', base: 55000 }
      }
    },
    empresa: {
      label: 'Empresa / Corporativo',
      models: null,
      faults: {
        flota: { label: 'Flota corporativa / convenio', base: 0 },
        preventiva: { label: 'Mantención preventiva', base: 0 },
        urgencia: { label: 'Soporte urgente / SLA', base: 0 },
        repuestos: { label: 'Repuestos al por mayor', base: 0 },
        otros: { label: 'Otro requerimiento', base: 0 }
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
  let selModel = null;

  function fmtCLP(v) {
    return '$' + Math.round(v).toLocaleString('es-CL');
  }

  function currentModel(dev) {
    if (!dev.models || !selModel) return null;
    return dev.models.find((m) => m.id === selModel.id) || dev.models[0];
  }

  function faultPrice(dev, fault) {
    const model = currentModel(dev);
    if (!model) return fault.base;
    if (fault.key === 'pantalla' && model.screen) return model.screen;
    return fault.base * model.mult;
  }

  function refreshQuote() {
    const dev = PRICES[selDevice];
    const fKey = $('#fault-select').value;
    const fault = Object.assign({ key: fKey }, dev.faults[fKey] || Object.values(dev.faults)[0]);
    const tier = TIERS[selTier];
    const isEmpresa = !dev.models;
    const detail = $('#q-detail');

    if (isEmpresa) {
      $('#q-clp').textContent = 'A medida';
      $('#q-usd').textContent = 'SLA';
      detail.innerHTML = '<b>Convenio corporativo</b> · cotización personalizada con SLA, reportes técnicos y facturación SII. Diagnóstico sin costo.';
      return;
    }

    const raw = faultPrice(dev, fault) * tier.mult;
    const rounded = Math.round(raw / 1000) * 1000;
    const usd = Math.round(rounded / USD_CLP);
    const model = currentModel(dev);
    const modelLabel = model ? (model.label.indexOf(dev.label) === 0 ? model.label : dev.label + ' · ' + model.label) : dev.label;
    $('#q-clp').textContent = fmtCLP(rounded);
    $('#q-usd').textContent = usd.toLocaleString('es-CL');
    detail.innerHTML = '<b>' + modelLabel + '</b><br>' + fault.label + ' · nivel <b>' + tier.label + '</b>';
  }

  function fillModels() {
    const dev = PRICES[selDevice];
    const sel = $('#model-select');
    const field = $('#model-field');
    if (!dev.models) {
      field.classList.add('hidden');
      selModel = null;
    } else {
      field.classList.remove('hidden');
      sel.innerHTML = dev.models
        .map((m) => '<option value="' + m.id + '">' + m.label + '</option>')
        .join('');
      selModel = dev.models[0];
    }
  }

  function fillFaults() {
    const dev = PRICES[selDevice];
    const sel = $('#fault-select');
    sel.innerHTML = Object.entries(dev.faults)
      .map(([k, v]) => '<option value="' + k + '">' + v.label + '</option>')
      .join('');
    refreshQuote();
  }

  function setStep(n) {
    for (let i = 1; i <= 5; i++) {
      const st = $('#st-' + i);
      if (st) st.classList.toggle('on', i <= n);
    }
  }

  function initCotizador() {
    $('#device-chips').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      selDevice = chip.dataset.device;
      $$('#device-chips .chip').forEach((c) => c.classList.toggle('active', c === chip));
      fillModels();
      fillFaults();
      setStep(3);
    });

    $('#model-select').addEventListener('change', () => {
      const dev = PRICES[selDevice];
      if (dev.models) {
        selModel = dev.models.find((m) => m.id === $('#model-select').value) || dev.models[0];
      }
      refreshQuote();
      setStep(3);
    });

    $('#fault-select').addEventListener('change', () => {
      refreshQuote();
      setStep(4);
    });

    $$('.tier').forEach((t) => {
      t.addEventListener('click', () => {
        selTier = t.dataset.tier;
        $$('.tier').forEach((x) => x.classList.toggle('active', x === t));
        refreshQuote();
        setStep(4);
      });
    });

    const checkStep5 = () => {
      const ok = $('#q-name').value.trim() && $('#q-phone').value.trim();
      if (ok) setStep(5);
    };
    $('#q-name').addEventListener('input', checkStep5);
    $('#q-phone').addEventListener('input', checkStep5);

    $('#q-send').addEventListener('click', sendQuote);
  }

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
    const fKey = $('#fault-select').value;
    const fault = Object.assign({ key: fKey }, dev.faults[fKey]);
    const tier = TIERS[selTier];
    const model = currentModel(dev);
    const isEmpresa = !dev.models;
    let valueLine;
    if (isEmpresa) {
      valueLine = 'Valor: cotización personalizada (SLA)';
    } else {
      const rounded = Math.round((faultPrice(dev, fault) * tier.mult) / 1000) * 1000;
      valueLine = 'Valor estimado: ' + fmtCLP(rounded) + ' CLP (≈ USD ' + Math.round(rounded / USD_CLP).toLocaleString('es-CL') + ')';
    }
    const msg = [
      'Hola InteliTech, quiero cotizar una reparación:',
      '',
      '• Nombre: ' + name,
      '• Teléfono: ' + phone,
      '• Dispositivo: ' + dev.label + (model ? ' · ' + model.label : ''),
      '• Falla: ' + fault.label,
      '• Nivel de servicio: ' + tier.label,
      '• ' + valueLine,
      '',
      'Solicito confirmación del presupuesto final. ¡Gracias!'
    ].join('\n');
    window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(msg), '_blank');
  }

  /* ===== Formulario contacto ===== */
  function initContact() {
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
  }

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

  function initMusic() {
    musicBtn.addEventListener('click', toggleMusic);
  }

  /* ===== Consentimiento ===== */
  const consent = $('#consent');

  function setConsent(value) {
    try {
      localStorage.setItem('it_consent_v1', JSON.stringify({ accepted: value, at: Date.now() }));
    } catch (err) {}
    consent.classList.remove('show');
    if (value) startMusic();
  }

  function initConsent() {
    $('#consent-ok').addEventListener('click', () => setConsent(true));
    $('#consent-no').addEventListener('click', () => setConsent(false));
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
    initSvcReveals();
    initManifesto();
    initCounters();
    fillModels();
    fillFaults();
    initCotizador();
    initContact();
    initAnchors();
    initMusic();
    initConsent();
    setStep(3);
    $('#year').textContent = new Date().getFullYear();
    ScrollTrigger.refresh();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => ScrollTrigger.refresh());
    }
    window.addEventListener('load', () => ScrollTrigger.refresh());
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    boot();
  } else {
    window.addEventListener('DOMContentLoaded', boot);
  }
})();
