/* Pocket Pair app: sign-in, the device view with tactile switches, recording, playback,
   weather, settings and the update check. Engine globals used: DEV, DL, TICK, tick, press,
   setAct, setOv, after, crtOn, nameOf, herName, rockyName, NOWWX, soundOn, AC, clockStr. */
(function () {
  'use strict';
  const APP_VERSION = '1.2.0';
  const $ = s => document.querySelector(s);
  const other = w => (w === 'rocky' ? 'her' : 'rocky');
  let ME = null, P = null, partnerOnline = null, partnerSeen = 0, netOk = true, loop = null;

  /* ------------------------------------------------------------ prefs */
  const pref = {
    get(k, d) { try { const v = localStorage.getItem('pp-' + k); return v === null ? d : v === '1'; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('pp-' + k, v ? '1' : '0'); } catch (e) {} }
  };
  const FEEL = { sound: pref.get('sound', true), haptic: pref.get('haptic', true), awake: pref.get('awake', false) };

  /* ------------------------------------------------------------ tactile: click sound + vibration */
  let noise = null;
  function ctx() {
    try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; } catch (e) { return null; }
  }
  const sink = document.querySelector('.haptic-sink');
  function feel(down) {
    if (FEEL.sound) {
      const c = ctx();
      if (c) {
        if (!noise) { noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.04), c.sampleRate); const ch = noise.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 5); }
        const t = c.currentTime, src = c.createBufferSource(), bp = c.createBiquadFilter(), gn = c.createGain();
        src.buffer = noise; bp.type = 'bandpass'; bp.frequency.value = down ? 2400 : 3800; bp.Q.value = 1.1; gn.gain.value = down ? 0.55 : 0.3;
        src.connect(bp).connect(gn).connect(c.destination); src.start(t);
        if (down) { // the "thock" of the keycap bottoming out
          const o = c.createOscillator(), og = c.createGain();
          o.type = 'sine'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.05);
          og.gain.setValueAtTime(0.32, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
          o.connect(og).connect(c.destination); o.start(t); o.stop(t + 0.08);
        }
      }
    }
    if (FEEL.haptic) {
      if (navigator.vibrate) navigator.vibrate(down ? 14 : 6);
      else if (down && sink) sink.click(); // iPhone (iOS 18+): toggling a native switch gives a light tap
    }
  }

  /* ------------------------------------------------------------ voice recording */
  function pickMime() {
    const list = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'];
    if (!window.MediaRecorder) return null;
    return list.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || '';
  }
  window.REC = {
    mr: null, stream: null, chunks: [], live: false,
    async start() {
      this.live = false;
      if (NET.mode === 'demo') { this.live = true; return; }
      const mime = pickMime();
      if (mime === null || !navigator.mediaDevices) { cancelRec('NO MIC IN THIS BROWSER'); return; }
      try { this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
      catch (e) { cancelRec('MIC IS BLOCKED'); return; }
      if (!(ME.ov && ME.ov.type === 'rec')) { this.kill(); ME.toast = { s: 'MIC READY. HOLD REC AGAIN', t0: TICK }; return; }
      try {
        this.mr = new MediaRecorder(this.stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
        this.chunks = []; this.mr.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
        this.mr.start(); this.live = true;
      } catch (e) { this.kill(); cancelRec('CANNOT RECORD HERE'); }
    },
    stop(secs) { // returns false when nothing was recorded, so the engine drops the "sending" animation
      if (!this.live) { this.kill(); ME.toast = { s: 'NOTHING RECORDED', t0: TICK }; return false; }
      this.live = false;
      if (NET.mode === 'demo') { NET.voice(null, secs); return true; }
      const mr = this.mr; this.mr = null;
      mr.onstop = async () => {
        const blob = new Blob(this.chunks, { type: mr.mimeType || 'audio/webm' }); this.kill();
        const ok = await NET.voice(blob, secs);
        if (!ok) ME.toast = { s: 'NOTE NOT SENT. TRY AGAIN', t0: TICK + 30 };
      };
      try { mr.stop(); } catch (e) { this.kill(); return false; }
      return true;
    },
    kill() { if (this.stream) this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
  };
  function cancelRec(s) { if (ME.ov && ME.ov.type === 'rec') ME.ov = null; ME.toast = { s, t0: TICK }; }

  /* ------------------------------------------------------------ playback */
  window.AUDIO = {
    el: new Audio(),
    play(note) {
      if (NET.mode === 'demo') { demoVoice(note.secs); return; }
      const url = NET.audioUrl(note.id);
      if (!url) { ME.toast = { s: 'STILL DOWNLOADING', t0: TICK }; return; }
      this.el.src = url; this.el.play().catch(() => { ME.toast = { s: 'CANNOT PLAY THIS NOTE', t0: TICK }; });
    },
    stop() { try { this.el.pause(); } catch (e) {} }
  };
  function demoVoice(secs) { // a little babble so the demo has something to hear
    if (!FEEL.sound) return; const c = ctx(); if (!c) return;
    for (let i = 0; i < secs * 4; i++) { const o = c.createOscillator(), g2 = c.createGain(), t = c.currentTime + 0.3 + i * 0.25;
      o.type = 'triangle'; o.frequency.value = 260 + Math.random() * 220; g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.05, t + 0.03); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g2).connect(c.destination); o.start(t); o.stop(t + 0.22); }
  }

  /* ------------------------------------------------------------ partner + connection label */
  function ago(ms) { const m = Math.round(ms / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; }
  function pname() { const n = nameOf(other(ME.owner)); return n.charAt(0) + n.slice(1).toLowerCase(); }
  function connLabel() {
    const el = $('#conn'), tx = $('#conn-txt'); el.classList.remove('on', 'away');
    if (!netOk) { tx.textContent = 'No connection'; return; }
    if (partnerOnline) { el.classList.add('on'); tx.textContent = pname() + ' is online'; }
    else if (partnerOnline === false) { el.classList.add('away'); tx.textContent = pname() + (partnerSeen ? ' was here ' + ago(Date.now() - partnerSeen) : ' is away'); }
    else tx.textContent = 'Connecting…';
  }
  function setPresence(on) {
    partnerOnline = on; P.off = !on;
    if (!on) P.offAt = TICK - Math.round((Date.now() - (partnerSeen || Date.now())) / 100);
    connLabel();
  }

  NET.hooks = {
    onPartner(r) {
      if (r.act && r.act !== P.act) { P.act = r.act; P.flash = TICK; }
      if (r.lastSeen) { partnerSeen = Date.parse(r.lastSeen); if (partnerOnline === false) P.offAt = TICK - Math.round((Date.now() - partnerSeen) / 100); }
      if (r.online !== undefined) setPresence(r.online);
      connLabel();
    },
    onPresence: setPresence,
    onMine(r) {
      if (r.act && r.act !== ME.act) { if (r.first) { ME.act = r.act; ME.snap = true; ME.statusAt = TICK; } else setAct(ME, r.act, true); }
      if (typeof r.sent === 'number') ME.sent = r.sent;
    },
    onLove(n, away) {
      for (let i = 0; i < Math.min(n, 3); i++) setOv(ME, { type: 'loveIn' });
      if (away && n > 1) after(40, () => { ME.toast = { s: n + ' HEARTS WHILE AWAY', t0: TICK }; });
    },
    onNote(n) { setOv(ME, Object.assign({ type: 'noteIn' }, n)); },
    onInbox(list) { ME.notes = list.map(n => Object.assign({}, n)); ME.sel = 0; },
    onError(e, what) { ME.toast = { s: what === 'voice' ? 'NOTE NOT SENT' : 'NO CONNECTION', t0: TICK }; },
    onNet(ok) { if (ok === undefined) return; netOk = ok; ME.net = ok; connLabel(); }
  };

  /* ------------------------------------------------------------ switches */
  const LEG = { home: ['MODE', 'LOVE', 'REC'], menu: ['PICK', 'UP', 'DOWN'], inbox: ['NEXT', 'PLAY', 'BACK'], rec: ['MODE', 'LOVE', 'SEND'] };
  const HINT = {
    home: 'MODE changes your status. LOVE sends a heart. Tap REC for your inbox, hold it to record.',
    menu: 'UP and DOWN move through the list. PICK sets your status, and it shows on the other screen right away.',
    inbox: 'NEXT picks a note, PLAY plays it, BACK closes the inbox. Hold REC here to record a reply.',
    rec: 'Recording, up to 10 seconds. Let go of SEND to send it.'
  };
  let lastLeg = '';
  function legends() {
    const rec = ME.ov && ME.ov.type === 'rec', v = rec ? 'rec' : (LEG[ME.view] ? ME.view : 'home');
    if (v === lastLeg) return; lastLeg = v;
    ['mode', 'love', 'rec'].forEach((k, i) => {
      const b = $('#k-' + k), s = b.querySelector('.silk'); s.textContent = LEG[v][i]; s.classList.toggle('alt', v !== 'home');
      b.setAttribute('aria-label', 'Switch ' + (i + 1) + ': ' + LEG[v][i].toLowerCase());
    });
    $('#hint').textContent = HINT[v];
  }
  function wireSwitch(k, keyName) {
    const b = $('#k-' + k); let isDown = false, held = false, timer = null;
    const down = () => {
      if (isDown) return; isDown = true; held = false; b.classList.add('down'); feel(true);
      if (k === 'rec') timer = setTimeout(() => { held = true; press(ME, 'recHold'); }, 350);
    };
    const up = fire => {
      if (!isDown) return; isDown = false; b.classList.remove('down'); clearTimeout(timer); feel(false);
      if (!fire) { if (k === 'rec' && held) press(ME, 'recUp'); return; }
      if (k === 'rec') press(ME, held ? 'recUp' : 'recTap'); else press(ME, k);
    };
    b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) {} down(); });
    b.addEventListener('pointerup', () => up(true));
    b.addEventListener('pointercancel', () => up(false));
    b.addEventListener('contextmenu', e => e.preventDefault());
    b.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); down(); } });
    b.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); up(true); } });
    return { down, up };
  }

  /* ------------------------------------------------------------ weather (Open-Meteo, no key) */
  const CITY = { rocky: [61.0587, 28.1887], her: [60.1699, 24.9384] };
  function wmo(c) { return c <= 1 ? 'clear' : c <= 48 ? 'cloudy' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : 'rain'; }
  async function weather() {
    for (const who of ['rocky', 'her']) {
      try {
        const [la, lo] = CITY[who];
        const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + la + '&longitude=' + lo + '&current=temperature_2m,weather_code&timezone=auto');
        const j = await r.json(); NOWWX[who].t = Math.round(j.current.temperature_2m); NOWWX[who].cond = wmo(j.current.weather_code);
      } catch (e) { /* keep the last values */ }
    }
  }

  /* ------------------------------------------------------------ update check: same link, new version */
  async function checkUpdate(manual) {
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      const j = await r.json();
      if (j.version && j.version !== APP_VERSION) { $('#update').hidden = false; return true; }
      if (manual) $('#set-version').textContent = 'Version ' + APP_VERSION + '. You have the newest one.';
    } catch (e) { if (manual) $('#set-version').textContent = 'Version ' + APP_VERSION + '. Could not check right now.'; }
    return false;
  }

  /* ------------------------------------------------------------ keep screen on */
  let lock = null;
  async function wake(on) {
    try { if (on && navigator.wakeLock && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen'); else if (!on && lock) { await lock.release(); lock = null; } } catch (e) {}
  }

  /* ------------------------------------------------------------ push notifications */
  const NOTIFY = {
    reg: null,
    supported: () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
    ios: () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    standalone: () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches,
    prefs() { return { status: $('#n-status').checked, love: $('#n-love').checked, notes: $('#n-notes').checked }; },
    key() { const b = (window.PAIR_CONFIG.vapidPublicKey || '').replace(/-/g, '+').replace(/_/g, '/'); const raw = atob(b + '='.repeat((4 - b.length % 4) % 4)); return Uint8Array.from(raw, c => c.charCodeAt(0)); },
    async sub() { if (!this.reg) return null; try { return await this.reg.pushManager.getSubscription(); } catch (e) { return null; } },
    show(on, text) {
      const btn = $('#notify-btn'); btn.textContent = on ? 'Turn off notifications' : 'Turn on notifications';
      btn.classList.toggle('primary', !on); btn.dataset.on = on ? '1' : '';
      $('#notify-kinds').querySelectorAll('input').forEach(i => { i.disabled = !on; });
      if (text) $('#notify-msg').textContent = text;
      $('#nudge').hidden = on || !this.canAsk() || pref.get('nudged', false) || NET.mode !== 'live';
    },
    canAsk() { return this.supported() && Notification.permission !== 'denied' && !!(window.PAIR_CONFIG && window.PAIR_CONFIG.vapidPublicKey); },
    async init() {
      ['status', 'love', 'notes'].forEach(k => { const el = $('#n-' + k); el.checked = pref.get('n-' + k, true);
        el.addEventListener('change', async () => { pref.set('n-' + k, el.checked); const sb = await this.sub(); if (sb) NET.pushSave(sb, this.prefs()).catch(() => {}); }); });
      $('#notify-btn').addEventListener('click', () => ($('#notify-btn').dataset.on ? this.off() : this.on()));
      $('#nudge-on').addEventListener('click', () => { pref.set('nudged', true); this.on(); });
      $('#nudge-later').addEventListener('click', () => { pref.set('nudged', true); $('#nudge').hidden = true; });
      if (NET.mode !== 'live') { $('#notify-btn').disabled = true; this.show(false, 'Notifications work once you sign in. The demo can’t send any.'); return; }
      if (!this.supported()) {
        $('#notify-btn').disabled = true;
        this.show(false, this.ios() && !this.standalone()
          ? 'On iPhone, add Pocket Pair to your Home Screen first (Share, then Add to Home Screen), open it from there, and turn this on.'
          : 'This browser can’t show notifications from a web page.');
        $('#nudge').hidden = true; return;
      }
      try { this.reg = await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; } catch (e) { this.show(false, 'Notifications could not start in this browser.'); return; }
      const sb = await this.sub();
      if (sb && Notification.permission === 'granted') { this.show(true, 'Notifications are on for this device.'); NET.pushSave(sb, this.prefs()).catch(() => {}); }
      else this.show(false, Notification.permission === 'denied' ? 'Notifications are blocked for this site. Allow them in the browser or phone settings, then reload.' : null);
    },
    async on() {
      try {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { this.show(false, 'Notifications were not allowed. You can allow them later in the browser or phone settings.'); return; }
        let sb = await this.sub();
        if (!sb) sb = await this.reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: this.key() });
        await NET.pushSave(sb, this.prefs());
        this.show(true, 'Notifications are on for this device.'); ME.toast = { s: 'NOTIFICATIONS ON', t0: TICK };
      } catch (e) { console.error(e); this.show(false, 'Could not turn notifications on. Check the connection and try again.'); }
    },
    async off() {
      const sb = await this.sub();
      if (sb) { try { await NET.pushRemove(sb.endpoint); } catch (e) {} try { await sb.unsubscribe(); } catch (e) {} }
      this.show(false, 'Notifications are off for this device.');
    }
  };

  /* ------------------------------------------------------------ views */
  function show(id) {
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== id; });
    document.querySelectorAll('.tab').forEach(t => { if (t.dataset.view === id) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
    if (id === 'v-studio') STUDIO.refresh();
    try { localStorage.setItem('pp-tab', id); } catch (e) {}
  }

  /* ------------------------------------------------------------ enter the app as rocky or her */
  function enter(who) {
    $('#gate').hidden = true; $('#app').hidden = false;
    document.body.dataset.who = who;
    rockyName = (NET.names.rocky || 'ROCKY').toUpperCase(); herName = (NET.names.her || 'HAZEL').toUpperCase();
    ME = DEV[who]; P = DEV[other(who)];
    ME.ctx = $('#screen').getContext('2d'); ME.leds = Array.from(document.querySelectorAll('.leds i')); ME.notes = []; ME.net = true;
    P.ctx = null; P.leds = []; P.off = NET.mode === 'live'; P.offAt = 0;
    if (NET.mode === 'live') partnerOnline = null;
    DL.length = 0; DL.push(ME);
    soundOn = FEEL.sound;
    document.querySelectorAll('.pname').forEach(s => { s.textContent = pname(); });
    $('#demo-tag').hidden = NET.mode !== 'demo';

    const sw = { mode: wireSwitch('mode'), love: wireSwitch('love'), rec: wireSwitch('rec') };
    const keymap = { '1': 'mode', '2': 'love', '3': 'rec' };
    document.addEventListener('keydown', e => {
      const k = keymap[e.key]; if (!k || e.repeat || e.target.closest('input') || $('#v-device').hidden) return;
      e.preventDefault(); sw[k].down();
    });
    document.addEventListener('keyup', e => { const k = keymap[e.key]; if (!k || $('#v-device').hidden) return; sw[k].up(true); });

    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => show(t.dataset.view)));
    let tab = 'v-device'; try { tab = localStorage.getItem('pp-tab') || tab; } catch (e) {}
    show(document.getElementById(tab) ? tab : 'v-device');

    // settings
    const nm = $('#set-name'); nm.value = nameOf(who);
    nm.addEventListener('input', () => { nm.value = nm.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6); });
    $('#set-name-save').addEventListener('click', async () => {
      const v = nm.value || (who === 'rocky' ? 'ROCKY' : 'HAZEL');
      try { await NET.setName(v); if (who === 'rocky') rockyName = v; else herName = v; ME.toast = { s: 'HI ' + v, t0: TICK }; } catch (e) { ME.toast = { s: 'NAME NOT SAVED', t0: TICK }; }
    });
    const tg = (id, key, fn) => { const el = $(id); el.checked = FEEL[key]; el.addEventListener('change', () => { FEEL[key] = el.checked; pref.set(key, el.checked); if (fn) fn(el.checked); if (el.checked && key !== 'awake') feel(true); }); };
    tg('#set-sound', 'sound', v => { soundOn = v; });
    tg('#set-haptic', 'haptic');
    tg('#set-awake', 'awake', v => wake(v));
    $('#haptic-note').textContent = navigator.vibrate ? 'Vibration works on this device.' : 'This browser cannot vibrate from a web page (iPhones mostly can’t). On iOS 18 or newer you may still feel a light tap. Click sounds work everywhere.';
    $('#set-account').textContent = NET.mode === 'live' ? 'Signed in as ' + (NET.user && NET.user.email) + ' (' + (who === 'rocky' ? 'Rocky' : 'Hazel') + ').' : 'Demo mode. Nothing is sent anywhere.';
    $('#set-signout').textContent = NET.mode === 'live' ? 'Sign out' : 'Leave demo';
    $('#set-signout').addEventListener('click', () => { if (NET.mode === 'live') NET.signOut(); else { location.hash = ''; location.reload(); } });
    $('#set-update').addEventListener('click', () => checkUpdate(true));
    $('#set-version').textContent = 'Version ' + APP_VERSION;
    $('#update').addEventListener('click', () => location.reload());

    STUDIO.init();
    NOTIFY.init();
    connLabel();
    if (NET.mode === 'demo') { partnerOnline = true; connLabel(); }

    loop = setInterval(() => { tick(); legends(); if (TICK % 600 === 0) connLabel(); }, 100);
    tick(); crtOn(ME); ME.toast = { s: 'HELLO ' + nameOf(who), t0: TICK + 13 };
    weather(); setInterval(weather, 15 * 60 * 1000);
    checkUpdate(false); setInterval(() => checkUpdate(false), 10 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { checkUpdate(false); if (FEEL.awake) wake(true); } });
    if (FEEL.awake) wake(true);
    NET.start(who).catch(e => { console.error(e); netOk = false; connLabel(); });
  }

  /* ------------------------------------------------------------ gate: demo, sign in, join */
  function gate(which, note) {
    $('#gate').hidden = false; $('#app').hidden = true;
    ['f-auth', 'f-join', 'f-demo'].forEach(id => { $('#' + id).hidden = id !== which; });
    if (note) $(which === 'f-demo' ? '#demo-msg' : which === 'f-join' ? '#join-msg' : '#auth-msg').textContent = note;
  }

  async function afterAuth() {
    const who = await NET.membership();
    if (!who) { gate('f-join'); return; }
    enter(who);
  }

  async function boot() {
    const cfg = window.PAIR_CONFIG || {};
    const demo = window.PAIR_DEMO || location.hash === '#demo' || !cfg.supabaseUrl || !cfg.supabaseKey || !window.supabase;
    document.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', () => { NET.mode = 'demo'; enter(b.dataset.demo); }));
    $('#l-demo').addEventListener('click', e => { e.preventDefault(); location.hash = 'demo'; location.reload(); });
    if (demo) { gate('f-demo', !window.PAIR_DEMO && (!cfg.supabaseUrl || !cfg.supabaseKey) ? 'The server is not set up yet, so this runs as a demo.' : ''); return; }

    try {
      const user = await NET.initLive({ url: cfg.supabaseUrl, key: cfg.supabaseKey });
      if (user) { await afterAuth(); return; }
    } catch (e) { console.error(e); gate('f-auth', 'Could not reach the server. Check the connection and reload.'); return; }
    gate('f-auth');

    const email = $('#in-email'), pass = $('#in-pass'), amsg = $('#auth-msg');
    $('#f-auth').addEventListener('submit', async e => {
      e.preventDefault(); amsg.textContent = 'Signing in…';
      try { await NET.signIn(email.value.trim(), pass.value); amsg.textContent = ''; await afterAuth(); }
      catch (x) { amsg.textContent = /invalid/i.test(x.message) ? 'That email and password don’t match an account.' : x.message; }
    });
    $('#b-signup').addEventListener('click', async () => {
      if (!$('#f-auth').reportValidity()) return;
      amsg.textContent = 'Creating your account…';
      try {
        const now = await NET.signUp(email.value.trim(), pass.value);
        if (now) { amsg.textContent = ''; await afterAuth(); } else amsg.textContent = 'Check your email and tap the link to confirm, then sign in here.';
      } catch (x) { amsg.textContent = x.message; }
    });
    const nameIn = $('#in-name');
    nameIn.addEventListener('input', () => { nameIn.value = nameIn.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6); });
    $('#f-join').addEventListener('submit', async e => {
      e.preventDefault(); const jm = $('#join-msg'); jm.textContent = 'Joining…';
      const who = new FormData(e.target).get('who');
      try { await NET.join($('#in-code').value.trim(), who, nameIn.value || (who === 'rocky' ? 'ROCKY' : 'HAZEL')); await afterAuth(); }
      catch (x) { jm.textContent = (x.message || '').replace(/^.*?:\s*/, '') || 'Could not join.'; }
    });
  }

  boot();
})();
