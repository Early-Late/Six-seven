// store.js — estado + persistencia localStorage + soporte de sincronización
const Store = (() => {
  const KEY = 'mycolladiegooo-v1';
  const DEFAULT_SUBJECTS = [
    { id: 'mat', name: 'Matemáticas', color: '#3b82f6' },
    { id: 'len', name: 'Lengua Española', color: '#ef4444' },
    { id: 'ing', name: 'Inglés', color: '#8b5cf6' },
    { id: 'fis', name: 'Física', color: '#06b6d4' },
    { id: 'soc', name: 'Sociales', color: '#f59e0b' },
    { id: 'for', name: 'Formación Humana', color: '#10b981' },
    { id: 'efi', name: 'Educación Física', color: '#84cc16' },
    { id: 'cal', name: 'Control de Calidad', color: '#6366f1' },
    { id: 'cul', name: 'Cultura Empresarial', color: '#ec4899' },
    { id: 'art', name: 'Artística', color: '#14b8a6' },
  ];
  const APPEARANCE_DEFAULTS = {
    siteName: 'MYCOLLA\nDIEGOOOO',
    siteSub: 'tareas y documentos',
    logoLetter: 'M',
    heroTitle: 'HOLA, DIEGO',
    heroSub: 'Tu resumen de hoy, simple y directo.',
    tabTitle: 'MyCoLLaDieGoooo',
    brand: '#e10600',
    brandDark: '#8f0400',
    accent: '#ff5a00',
    bg: '#ffffff',
    panel: '#ffffff',
    ink: '#111827',
    line: '#e5e7eb',
    m1: '#475569',
    m2: '#64748b',
    font: 'Bungee',
    radius: 14,
    dots: true,
    grain: true,
    btnAnim: true,
  };
  let state = { tasks: [], files: [], docs: [], subjects: [...DEFAULT_SUBJECTS], tags: [], theme: 'light', rev: 0, tombstones: { tasks: {}, docs: {}, files: {} }, appearance: { ...APPEARANCE_DEFAULTS }, appearanceUpdatedAt: '' };
  const listeners = new Set();

  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function emit(kind) { listeners.forEach((fn) => { try { fn(kind); } catch {} }); }

  function normalize() {
    if (!Array.isArray(state.tasks)) state.tasks = [];
    if (!Array.isArray(state.files)) state.files = [];
    if (!Array.isArray(state.docs)) state.docs = [];
    if (!Array.isArray(state.subjects) || !state.subjects.length) state.subjects = [...DEFAULT_SUBJECTS];
    if (!Array.isArray(state.tags)) state.tags = [];
    if (typeof state.rev !== 'number') state.rev = 0;
    if (!state.tombstones || typeof state.tombstones !== 'object') state.tombstones = { tasks: {}, docs: {}, files: {} };
    for (const k of ['tasks', 'docs', 'files']) if (!state.tombstones[k] || typeof state.tombstones[k] !== 'object') state.tombstones[k] = {};
    if (state.theme !== 'dark' && state.theme !== 'light') state.theme = 'light';
    state.appearance = { ...APPEARANCE_DEFAULTS, ...(state.appearance || {}) };
    if (typeof state.appearanceUpdatedAt !== 'string') state.appearanceUpdatedAt = '';
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        state = { ...state, ...p };
      }
    } catch {}
    normalize();
  }
  // Guardado local: sube la revisión y avisa (la nube escucha este aviso)
  function save(kind = 'local') {
    state.rev = (state.rev || 0) + 1;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
    emit(kind);
  }
  // Guardado silencioso (para aplicar datos que vienen de otro dispositivo)
  function saveRaw() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const now = () => new Date().toISOString();

  function seed() {
    if (state.tasks.length) return;
    const t = new Date(); const iso = (d) => { const x = new Date(t); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
    state.tasks = [
      { id: uid(), title: 'Ensayo Cultura Empresarial', description: 'Ensayo de 2 páginas sobre emprendimiento local.', subject: 'Cultura Empresarial', teacher: 'Profe María', dueDate: iso(2), priority: 'Alta', status: 'pendiente', tags: ['ensayo'], links: [], notes: 'Revisar ortografía.', favorite: true, createdAt: now(), updatedAt: now(), fileIds: [] },
      { id: uid(), title: 'Problemas Matemáticas pág. 45', description: 'Ejercicios 1 al 15.', subject: 'Matemáticas', teacher: '', dueDate: iso(0), priority: 'Media', status: 'pendiente', tags: [], links: [], notes: '', favorite: false, createdAt: now(), updatedAt: now(), fileIds: [] },
      { id: uid(), title: 'Mapa Sociales', description: 'Mapa de provincias terminado.', subject: 'Sociales', teacher: '', dueDate: iso(-3), priority: 'Baja', status: 'completada', tags: ['mapa'], links: [], notes: '', favorite: false, createdAt: now(), updatedAt: now(), fileIds: [] },
    ];
    save('seed');
  }

  function tomb(col, id) { state.tombstones[col][id] = now(); }

  // Aplica un estado ya combinado que viene de otro dispositivo
  function replaceAll(data, rev) {
    state.tasks = Array.isArray(data.tasks) ? data.tasks : [];
    state.files = Array.isArray(data.files) ? data.files : [];
    state.docs = Array.isArray(data.docs) ? data.docs : [];
    if (Array.isArray(data.subjects) && data.subjects.length) state.subjects = data.subjects;
    if (Array.isArray(data.tags)) state.tags = data.tags;
    if (data.tombstones) state.tombstones = data.tombstones;
    if (data.appearance) state.appearance = { ...APPEARANCE_DEFAULTS, ...data.appearance };
    if (typeof data.appearanceUpdatedAt === 'string') state.appearanceUpdatedAt = data.appearanceUpdatedAt;
    state.rev = typeof rev === 'number' ? rev : (state.rev || 0);
    normalize();
    saveRaw();
    emit('remote');
  }

  return {
    KEY,
    get s() { return state; },
    get defaults() { return { appearance: { ...APPEARANCE_DEFAULTS } }; },
    load, save, seed, uid, now, onChange, replaceAll,
    setAppearance(patch) { state.appearance = { ...state.appearance, ...patch }; state.appearanceUpdatedAt = now(); save(); },
    upsertTask(t) { const i = state.tasks.findIndex(x => x.id === t.id); if (i >= 0) state.tasks[i] = t; else state.tasks.unshift(t); delete state.tombstones.tasks[t.id]; save(); },
    deleteTask(id) { state.tasks = state.tasks.filter(x => x.id !== id); state.files = state.files.filter(f => f.taskId !== id && f.docId !== id); tomb('tasks', id); save(); },
    upsertDoc(d) { const i = state.docs.findIndex(x => x.id === d.id); if (i >= 0) state.docs[i] = d; else state.docs.unshift(d); delete state.tombstones.docs[d.id]; save(); },
    deleteDoc(id) { state.docs = state.docs.filter(x => x.id !== id); state.files = state.files.filter(f => f.docId !== id); tomb('docs', id); save(); },
    addFiles(recs) { state.files.push(...recs); save(); },
    deleteFile(id) { state.files = state.files.filter(f => f.id !== id); tomb('files', id); save(); },
  };
})();
