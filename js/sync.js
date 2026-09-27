// sync.js — sincronización entre dispositivos para sitio estático (GitHub Pages)
//
// Cómo funciona:
// 1) Mismo equipo, varias pestañas: instantáneo vía BroadcastChannel + evento 'storage'.
// 2) Otros dispositivos (celular/PC): vía Firebase Realtime Database (plan gratis).
//    La página sigue siendo 100% estática; el navegador habla directo con Firebase.
//    Sin configurar Firebase, todo sigue funcionando en local + exportar/importar.
//
// Estrategia de mezcla: gana el cambio más reciente por elemento (updatedAt/uploadedAt)
// y los eliminados viajan como "tombstones" para que borrar en un equipo borre en todos.
// Los archivos adjuntos viajan como metadatos (nombre, tamaño); el contenido del archivo
// vive en cada dispositivo (IndexedDB). Si un archivo no está en este equipo se avisa.
const Sync = (() => {
  const CFG_KEY = 'mycolladiegooo-sync-v1';
  const CH = 'mycolladiegooo-bus';
  const deviceId = (() => {
    try {
      let id = localStorage.getItem('mycolladiegooo-device');
      if (!id) { id = 'eq-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); localStorage.setItem('mycolladiegooo-device', id); }
      return id;
    } catch { return 'eq-' + Math.random().toString(36).slice(2, 8); }
  })();

  let cfg = null;          // { apiKey, authDomain, databaseURL, workspace, deviceName }
  let db = null;           // firebase.database()
  let ref = null;          // ref al workspace
  let connected = false;
  let lastPushedRev = -1;
  let pushTimer = null;
  let bus = null;

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- configuración ----------
  function loadCfg() {
    try { cfg = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch { cfg = null; }
    if (cfg && (!cfg.databaseURL || !cfg.apiKey)) cfg = null;
  }
  function saveCfg(c) {
    cfg = c;
    try {
      if (c) localStorage.setItem(CFG_KEY, JSON.stringify(c));
      else localStorage.removeItem(CFG_KEY);
    } catch {}
  }
  function willSync() { loadCfg(); return !!cfg; }

  // ---------- estado visual ----------
  function setStatus(mode, text) {
    const dot = $('#sync-dot'), tx = $('#sync-text'), foot = $('#sync-foot');
    if (dot) dot.className = 'sync-dot ' + (mode === 'on' ? 'sync-on' : mode === 'warn' ? 'sync-warn' : 'sync-off');
    if (tx) tx.textContent = text;
    if (foot) foot.textContent = text === 'Local' ? 'Solo en este dispositivo.' : text;
  }

  // ---------- mezcla (last-write-wins + tombstones) ----------
  function itemTime(x) { return x.updatedAt || x.uploadedAt || x.createdAt || ''; }
  function mergeList(local, remote, tombs) {
    const map = new Map();
    for (const x of (local || [])) if (x && x.id) map.set(x.id, x);
    for (const x of (remote || [])) {
      if (!x || !x.id) continue;
      const cur = map.get(x.id);
      if (!cur || itemTime(x) >= itemTime(cur)) map.set(x.id, x);
    }
    const out = [];
    for (const [id, x] of map) {
      if (tombs && tombs[id] && tombs[id] >= itemTime(x)) continue; // eliminado después
      out.push(x);
    }
    return out;
  }
  function mergeTombs(a, b) {
    const out = { ...(a || {}) };
    for (const [id, t] of Object.entries(b || {})) if (!out[id] || t > out[id]) out[id] = t;
    return out;
  }
  function mergeState(local, remote) {
    const lt = (local.tombstones || {}), rt = (remote.tombstones || {});
    const tombs = {
      tasks: mergeTombs(lt.tasks, rt.tasks),
      docs: mergeTombs(lt.docs, rt.docs),
      files: mergeTombs(lt.files, rt.files),
    };
    // materias: unión por nombre (conserva colores locales)
    const subs = [...(local.subjects || [])];
    for (const s of (remote.subjects || [])) if (s && s.name && !subs.some((x) => x.name === s.name)) subs.push(s);
    const tags = [...new Set([...(local.tags || []), ...(remote.tags || [])])];
    // apariencia: gana la más reciente completa
    let appearance = local.appearance, appearanceUpdatedAt = local.appearanceUpdatedAt || '';
    if ((remote.appearanceUpdatedAt || '') > appearanceUpdatedAt && remote.appearance) {
      appearance = remote.appearance;
      appearanceUpdatedAt = remote.appearanceUpdatedAt;
    }
    return {
      tasks: mergeList(local.tasks, remote.tasks, tombs.tasks),
      docs: mergeList(local.docs, remote.docs, tombs.docs),
      files: mergeList(local.files, remote.files, tombs.files),
      subjects: subs,
      tags,
      tombstones: tombs,
      appearance,
      appearanceUpdatedAt,
    };
  }

  // ---------- subida ----------
  function snapshot() {
    const s = Store.s;
    return { tasks: s.tasks, files: s.files, docs: s.docs, subjects: s.subjects, tags: s.tags, tombstones: s.tombstones, appearance: s.appearance, appearanceUpdatedAt: s.appearanceUpdatedAt };
  }
  function schedulePush() {
    // avisa a otras pestañas del mismo equipo al instante
    try { bus && bus.postMessage({ t: 'changed', by: deviceId }); } catch {}
    if (!connected || !ref) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushNow, 800);
  }
  function pushNow() {
    if (!connected || !ref) return;
    const rev = Store.s.rev || 0;
    lastPushedRev = rev;
    ref.set({ rev, at: Store.now(), by: deviceId, state: snapshot() }).catch(() => setStatus('warn', 'Nube: error al subir'));
  }

  // ---------- bajada ----------
  function applyRemote(payload) {
    if (!payload || !payload.state) return;
    if (payload.by === deviceId && payload.rev === lastPushedRev) return; // eco propio
    const localRev = Store.s.rev || 0;
    if ((payload.rev || 0) < localRev) { schedulePush(); return; } // el otro va atrasado
    const merged = mergeState(snapshot(), payload.state);
    const newRev = Math.max(localRev, payload.rev || 0);
    Store.replaceAll(merged, newRev);
    try { if (typeof refresh === 'function') refresh(); } catch {}
    try { if (typeof toast === 'function') toast('Cambios recibidos de otro dispositivo'); } catch {}
  }

  // ---------- firebase ----------
  function connect() {
    loadCfg();
    if (!cfg) { setStatus('off', 'Local'); return false; }
    if (typeof firebase === 'undefined') { setStatus('warn', 'Nube: sin conexión (SDK)'); return false; }
    try {
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, databaseURL: cfg.databaseURL });
      db = firebase.database();
      const ws = (cfg.workspace || 'casa').replace(/[.#$/[\]]/g, '_') || 'casa';
      ref = db.ref('mycolladiegooo/' + ws);
      setStatus('warn', 'Nube: conectando…');
      ref.on('value', (snap) => {
        connected = true;
        const val = snap.val();
        if (!val) {
          setStatus('on', 'Nube: conectada');
          if (!(Store.s.tasks || []).length && !(Store.s.docs || []).length) { try { Store.seed(); } catch {} }
          else schedulePush();
          return;
        }
        setStatus('on', 'Nube: conectada');
        applyRemote(val);
      }, () => setStatus('warn', 'Nube: sin permiso (revisa rules)'));
      // presencia simple
      try {
        const p = db.ref('mycolladiegooo/' + ws + '/eq/' + deviceId);
        p.set({ name: cfg.deviceName || deviceId, at: Store.now() });
        p.onDisconnect().remove();
      } catch {}
      return true;
    } catch {
      setStatus('warn', 'Nube: datos inválidos');
      return false;
    }
  }
  function disconnect() {
    try { ref && ref.off(); } catch {}
    ref = null; db = null; connected = false;
    saveCfg(null);
    setStatus('off', 'Local');
  }

  // ---------- respaldo manual (sin nube) ----------
  function exportJSON() {
    const blob = new Blob([JSON.stringify({ app: 'mycolladiegooo', rev: Store.s.rev, exportedAt: Store.now(), state: snapshot() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mycolladiegooo-respaldo.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  function importJSON(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const p = JSON.parse(r.result);
        if (!p || !p.state) throw 0;
        const merged = mergeState(snapshot(), p.state);
        Store.replaceAll(merged, (Store.s.rev || 0) + 1);
        try { if (typeof refresh === 'function') refresh(); } catch {}
        schedulePush();
        try { if (typeof toast === 'function') toast('Respaldo importado'); } catch {}
      } catch { try { if (typeof toast === 'function') toast('Archivo inválido', 'err'); } catch {} }
    };
    r.readAsText(file);
  }

  // ---------- UI del modal ----------
  function openModal() {
    loadCfg();
    const m = $('#modal-sync'); if (!m) return;
    $('#sy-apikey').value = (cfg && cfg.apiKey) || '';
    $('#sy-auth').value = (cfg && cfg.authDomain) || '';
    $('#sy-dburl').value = (cfg && cfg.databaseURL) || '';
    $('#sy-ws').value = (cfg && cfg.workspace) || 'casa';
    $('#sy-dev').value = (cfg && cfg.deviceName) || deviceId;
    $('#sy-msg').textContent = cfg ? 'Nube configurada en este dispositivo.' : 'Sin nube: todo se guarda solo en este dispositivo.';
    m.classList.remove('hidden');
  }
  function closeModal() { const m = $('#modal-sync'); if (m) m.classList.add('hidden'); }
  function saveFromModal() {
    const c = {
      apiKey: $('#sy-apikey').value.trim(),
      authDomain: $('#sy-auth').value.trim(),
      databaseURL: $('#sy-dburl').value.trim().replace(/\/$/, ''),
      workspace: $('#sy-ws').value.trim() || 'casa',
      deviceName: $('#sy-dev').value.trim() || deviceId,
    };
    if (!c.apiKey || !c.databaseURL) { $('#sy-msg').textContent = 'Faltan apiKey y databaseURL.'; return; }
    saveCfg(c);
    if (connect()) { $('#sy-msg').textContent = 'Conectando con la nube…'; schedulePush(); }
  }

  // ---------- init ----------
  function init() {
    // 1) pestañas del mismo equipo
    try {
      bus = ('BroadcastChannel' in window) ? new BroadcastChannel(CH) : null;
      if (bus) bus.onmessage = (e) => {
        if (e.data && e.data.t === 'changed' && e.data.by !== deviceId) {
          try { Store.load(); } catch {}
          try { if (typeof refresh === 'function') refresh(); } catch {}
        }
      };
    } catch {}
    window.addEventListener('storage', (e) => {
      if (e.key === (window.Store && Store.KEY)) {
        try { Store.load(); } catch {}
        try { if (typeof refresh === 'function') refresh(); } catch {}
      }
    });
    // 2) cada guardado local -> empujar a la nube (con retardo)
    try { Store.onChange((kind) => { if (kind !== 'remote') schedulePush(); }); } catch {}

    // 3) nube entre dispositivos (si está configurada)
    loadCfg();
    if (cfg) connect(); else setStatus('off', 'Local');

    // 4) controles
    const pill = $('#sync-pill'); if (pill) pill.onclick = openModal;
    const navS = $('#nav-sync'); if (navS) navS.onclick = openModal;
    const c1 = $('#btn-sync-close'); if (c1) c1.onclick = closeModal;
    const c2 = $('#btn-sync-save'); if (c2) c2.onclick = saveFromModal;
    const c3 = $('#btn-sync-off'); if (c3) c3.onclick = () => { disconnect(); $('#sy-msg').textContent = 'Nube apagada en este dispositivo.'; };
    const c4 = $('#btn-sync-export'); if (c4) c4.onclick = exportJSON;
    const c5 = $('#btn-sync-import'); if (c5) c5.onclick = () => $('#sy-file').click();
    const fi = $('#sy-file'); if (fi) fi.onchange = (e) => { if (e.target.files[0]) importJSON(e.target.files[0]); fi.value = ''; };
  }

  document.addEventListener('DOMContentLoaded', init);
  return { init, connect, disconnect, openModal, exportJSON, importJSON, willSync, get deviceId() { return deviceId; } };
})();
