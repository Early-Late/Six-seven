// store.js — estado + persistencia localStorage
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
  let state = { tasks: [], files: [], docs: [], subjects: [...DEFAULT_SUBJECTS], tags: [], theme: 'dark' };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        state = { ...state, ...p };
        if (!Array.isArray(state.tasks)) state.tasks = [];
        if (!Array.isArray(state.files)) state.files = [];
        if (!Array.isArray(state.docs)) state.docs = [];
        if (!Array.isArray(state.subjects) || !state.subjects.length) state.subjects = [...DEFAULT_SUBJECTS];
        if (!Array.isArray(state.tags)) state.tags = [];
      }
    } catch {}
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
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
    save();
  }
  return {
    get s() { return state; },
    load, save, seed, uid, now,
    upsertTask(t) { const i = state.tasks.findIndex(x => x.id === t.id); if (i >= 0) state.tasks[i] = t; else state.tasks.unshift(t); save(); },
    deleteTask(id) { state.tasks = state.tasks.filter(x => x.id !== id); state.files = state.files.filter(f => f.taskId !== id && f.docId !== id); save(); },
    upsertDoc(d) { const i = state.docs.findIndex(x => x.id === d.id); if (i >= 0) state.docs[i] = d; else state.docs.unshift(d); save(); },
    deleteDoc(id) { state.docs = state.docs.filter(x => x.id !== id); state.files = state.files.filter(f => f.docId !== id); save(); },
    addFiles(recs) { state.files.push(...recs); save(); },
    deleteFile(id) { state.files = state.files.filter(f => f.id !== id); save(); },
  };
})();
