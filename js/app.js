// app.js — MyCoLLaDieGoooo (simple, sin emojis, con Biblioteca)
const ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp,.zip';
const ALLOWED_EXT = ['pdf','doc','docx','ppt','pptx','xls','xlsx','csv','txt','jpg','jpeg','png','webp','zip'];

let route = 'inicio';
let tareaTab = 'pendientes';
let filters = { q: '', subject: '', sort: 'due' };
let docFilters = { q: '', subject: '', sort: 'date' };
let globalQ = '';
let editingId = null;
let detailId = null;
let editingDocId = null;
let pendingFiles = [];
let docPending = [];

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmtDate(iso) { if (!iso) return 'Sin fecha'; const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' }); }
function daysLeft(iso) { if (!iso) return null; const a = new Date(); a.setHours(0,0,0,0); const b = new Date(iso + 'T12:00:00'); b.setHours(0,0,0,0); return Math.round((b - a) / 86400000); }
function dueLabel(t) {
  if (t.status === 'completada') return { text: 'COMPLETADA', cls: 'background:#14532d;color:#bbf7d0' };
  const d = daysLeft(t.dueDate);
  if (d === null || isNaN(d)) return { text: 'SIN FECHA', cls: 'background:#2a2a2e;color:#b9b3a5' };
  if (d < 0) return { text: 'VENCIDA', cls: 'background:#e10600;color:#fff', over: true };
  if (d === 0) return { text: 'ENTREGA HOY', cls: 'background:#ff5a00;color:#000', soon: true };
  if (d === 1) return { text: 'ENTREGA MANANA', cls: 'background:#ff5a00;color:#000', soon: true };
  if (d <= 3) return { text: `EN ${d} DIAS`, cls: 'background:#7c2d12;color:#fed7aa', soon: true };
  return { text: `EN ${d} DIAS`, cls: 'background:#1e1e22;color:#b9b3a5' };
}
function subjColor(name) { const s = Store.s.subjects.find(x => x.name === name); return s ? s.color : '#ff5a00'; }
function fileExt(name) { return (name.split('.').pop() || '').toLowerCase(); }
function fmtSize(b) { if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; return (b / 1048576).toFixed(1) + ' MB'; }
function fileTag(ext) { return `<span class="chip" style="border-color:#ff5a00;color:#ff5a00">${esc(ext.toUpperCase() || 'FILE')}</span>`; }

function toast(msg, type = 'ok') {
  const c = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast card px-4 py-3 text-sm font-semibold flex items-center gap-2';
  el.style.borderLeft = `4px solid ${type === 'ok' ? '#ff5a00' : '#e10600'}`;
  el.innerHTML = `<span>[${type === 'ok' ? 'OK' : '!'}]</span><span>${esc(msg)}</span>`;
  c.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2600);
}

let confirmCb = null;
function askConfirm(title, msg, cb) { $('#c-title').textContent = title; $('#c-msg').textContent = msg; confirmCb = cb; $('#modal-confirm').classList.remove('hidden'); }

// ---------- NAV ----------
function nav(r) {
  if (r === 'pendientes') { tareaTab = 'pendientes'; r = 'tareas'; }
  if (r === 'completados' || r === 'todas') { tareaTab = r === 'todas' ? 'todas' : 'completadas'; r = 'tareas'; }
  if (r === 'materias') r = 'biblioteca';
  route = r;
  $$('.navlink[data-route]').forEach(b => b.classList.toggle('active', b.dataset.route === r));
  ['inicio', 'tareas', 'biblioteca', 'archivos'].forEach(v => { const el = $('#view-' + v); if (el) el.classList.toggle('hidden', v !== r); });
  ['pendientes', 'completados', 'todas', 'materias'].forEach(v => { const el = $('#view-' + v); if (el) el.classList.add('hidden'); });
  const sb = $('#sidebar'); if (sb && window.innerWidth < 768) sb.classList.add('-translate-x-full');
  $$('.tabbtn').forEach(b => b.classList.toggle('active', b.dataset.tab === tareaTab));
  if (r === 'inicio') renderHome();
  if (r === 'tareas') renderAll();
  if (r === 'biblioteca') renderDocs();
  if (r === 'archivos') renderFiles();
  window.scrollTo(0, 0);
}

// ---------- HOME ----------
function stats() {
  const ts = Store.s.tasks;
  const pend = ts.filter(t => t.status !== 'completada');
  const comp = ts.filter(t => t.status === 'completada');
  const soon = pend.filter(t => { const d = daysLeft(t.dueDate); return d !== null && d >= 0 && d <= 3; });
  return { total: ts.length, pend: pend.length, comp: comp.length, soon: soon.length, files: Store.s.files.length };
}
function renderHome() {
  const s = stats();
  $('#st-total').textContent = s.total;
  $('#st-pend').textContent = s.pend;
  $('#st-comp').textContent = s.comp;
  $('#st-soon').textContent = s.soon;
  const sf = $('#st-files'); if (sf) sf.textContent = s.files;
  const tot = Math.max(s.total, 1);
  const pct = Math.round(s.comp / tot * 100);
  const bar = $('#bar-hunt'); if (bar) bar.style.width = pct + '%';
  const lb = $('#hunt-label'); if (lb) lb.textContent = s.total ? `${pct}% completado. ${s.comp} de ${s.total} tareas listas. Todo lo completado queda guardado.` : 'Sin tareas todavia. Crea la primera con + Nueva tarea.';
  const rec = [...Store.s.tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  $('#home-recent').innerHTML = rec.length ? rec.map(miniTask).join('') : '<p class="text-sm" style="color:#8a8578">Sin tareas todavia.</p>';
  const venc = Store.s.tasks.filter(t => t.status !== 'completada' && (daysLeft(t.dueDate) ?? 99) <= 3).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')).slice(0, 4);
  $('#home-due').innerHTML = venc.length ? venc.map(miniTask).join('') : '<p class="text-sm" style="color:#8a8578">Nada urgente.</p>';
}
function miniTask(t) {
  const d = dueLabel(t);
  return `<div onclick="openDetail('${t.id}')" class="task-card card p-3 mb-2 flex items-center gap-3">
    <button onclick="event.stopPropagation();toggleFav('${t.id}')" class="text-lg" style="color:#ff5a00">${t.favorite ? '★' : '☆'}</button>
    <div class="flex-1 min-w-0"><div class="font-semibold truncate text-sm">${esc(t.title)}</div>
    <div class="text-xs truncate" style="color:#8a8578">${esc(t.subject || '')} · ${fmtDate(t.dueDate)}</div></div>
    <span class="badge" style="${d.cls}">${d.text}</span></div>`;
}

// ---------- TAREAS ----------
function taskCard(t) {
  const d = dueLabel(t);
  const over = d.over ? 'vencida' : (d.soon ? 'hoy' : '');
  const files = Store.s.files.filter(f => f.taskId === t.id);
  return `<div class="task-card card p-4 ${over} flex flex-col gap-2" onclick="openDetail('${t.id}')">
    <div class="flex items-start justify-between gap-2">
      <div class="font-bold leading-tight text-sm">${t.favorite ? '★ ' : ''}${esc(t.title)}</div>
      <span class="badge" style="${d.cls}">${d.text}</span>
    </div>
    <div class="flex flex-wrap gap-1 text-xs">
      ${t.subject ? `<span class="chip" style="border-color:${subjColor(t.subject)};color:${subjColor(t.subject)}">${esc(t.subject)}</span>` : ''}
      <span class="chip">${esc(t.priority)}</span>
      ${(t.tags || []).map(g => `<span class="chip">#${esc(g)}</span>`).join('')}
      ${files.length ? `<span class="chip">${files.length} adjuntos</span>` : ''}
    </div>
    ${t.description ? `<p class="text-sm line-clamp-2" style="color:#b9b3a5">${esc(t.description)}</p>` : ''}
    <div class="text-xs" style="color:#8a8578">${fmtDate(t.dueDate)}</div>
    <div class="flex gap-2 pt-1" onclick="event.stopPropagation()">
      ${t.status !== 'completada' ? `<button onclick="setStatus('${t.id}','completada')" class="text-xs font-display bg-green-700 text-white px-3 py-1.5 rounded">COMPLETAR</button>` : `<button onclick="setStatus('${t.id}','pendiente')" class="text-xs font-display bg-[#ff5a00] text-black px-3 py-1.5 rounded">VOLVER A PENDIENTE</button>`}
      <button onclick="toggleFav('${t.id}')" class="text-xs font-bold bg-[#2a2a2e] px-3 py-1.5 rounded">${t.favorite ? '★' : '☆'}</button>
    </div></div>`;
}
function filteredTasks() {
  let list = [...Store.s.tasks];
  if (tareaTab === 'pendientes') list = list.filter(t => t.status !== 'completada');
  if (tareaTab === 'completadas') list = list.filter(t => t.status === 'completada');
  const q = (filters.q || globalQ).toLowerCase().trim();
  if (q) list = list.filter(t => [t.title, t.subject, t.teacher, t.description, (t.tags || []).join(' '), (t.notes || '')].join(' ').toLowerCase().includes(q)
    || Store.s.files.some(f => f.taskId === t.id && f.name.toLowerCase().includes(q)));
  if (filters.subject) list = list.filter(t => t.subject === filters.subject);
  const by = { due: (a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'), created: (a, b) => b.createdAt.localeCompare(a.createdAt), name: (a, b) => a.title.localeCompare(b.title) }[filters.sort];
  return list.sort(by);
}
function renderAll() {
  const list = filteredTasks();
  $('#all-list').innerHTML = list.length ? list.map(taskCard).join('') : '<div class="card p-8 text-center text-sm" style="color:#8a8578">Sin tareas en esta vista.</div>';
  $('#count-all').textContent = list.length + ' de ' + Store.s.tasks.length + ' (las completadas se conservan)';
  const subs = [...new Set(Store.s.tasks.map(t => t.subject).filter(Boolean))];
  const sel = $('#flt-subject');
  if (sel) sel.innerHTML = '<option value="">Todas las materias</option>' + subs.map(s => `<option ${filters.subject === s ? 'selected' : ''}>${esc(s)}</option>`).join('');
}
function renderList(which) {
  tareaTab = which === 'completados' ? 'completadas' : 'pendientes';
  if (route !== 'tareas') return nav('tareas');
  renderAll();
}

// ---------- BIBLIOTECA ----------
function filteredDocs() {
  let list = [...(Store.s.docs || [])];
  const q = docFilters.q.toLowerCase().trim();
  if (q) list = list.filter(d => [d.title, d.subject, d.notes].join(' ').toLowerCase().includes(q)
    || Store.s.files.some(f => f.docId === d.id && f.name.toLowerCase().includes(q)));
  if (docFilters.subject) list = list.filter(d => d.subject === docFilters.subject);
  const by = { date: (a, b) => (b.docDate || '').localeCompare(a.docDate || ''), created: (a, b) => b.createdAt.localeCompare(a.createdAt), name: (a, b) => a.title.localeCompare(b.title) }[docFilters.sort];
  return list.sort(by);
}
function renderDocs() {
  const list = filteredDocs();
  $('#count-docs').textContent = list.length + ' documentos';
  const subs = [...new Set((Store.s.docs || []).map(d => d.subject).filter(Boolean))];
  const sel = $('#doc-subject');
  if (sel) sel.innerHTML = '<option value="">Todas las materias</option>' + subs.map(s => `<option ${docFilters.subject === s ? 'selected' : ''}>${esc(s)}</option>`).join('');
  $('#docs-list').innerHTML = list.length ? list.map(docCard).join('') : '<div class="card p-8 text-center text-sm" style="color:#8a8578">Sin documentos. Agrega el primero con + Nuevo documento.</div>';
}
function docCard(d) {
  const files = Store.s.files.filter(f => f.docId === d.id);
  return `<div class="card p-4 flex flex-col gap-2">
    <div class="flex items-start justify-between gap-2">
      <div class="font-bold text-sm">${esc(d.title)}</div>
      <span class="badge" style="background:#1e1e22;color:#b9b3a5">${fmtDate(d.docDate)}</span>
    </div>
    ${d.subject ? `<div><span class="chip" style="border-color:${subjColor(d.subject)};color:${subjColor(d.subject)}">${esc(d.subject)}</span></div>` : ''}
    ${d.notes ? `<p class="text-sm whitespace-pre-wrap" style="color:#b9b3a5">${esc(d.notes)}</p>` : ''}
    <div class="space-y-1">${files.map(f => `
      <div class="flex items-center gap-2 text-sm bg-[#1e1e22] rounded px-2 py-1">
        ${fileTag(f.ext)}
        <span class="flex-1 truncate text-xs">${esc(f.name)} · ${fmtSize(f.size)}</span>
        <button onclick="previewFile('${f.id}')" class="text-xs font-bold underline">Ver</button>
        <button onclick="downloadFile('${f.id}')" class="text-xs font-bold underline">Bajar</button>
        <button onclick="removeFile('${f.id}')" class="text-xs font-bold underline" style="color:#e10600">Quitar</button>
      </div>`).join('')}</div>
    <div class="flex gap-2 pt-1">
      <button onclick="openDocForm('${d.id}')" class="text-xs font-display bg-[#ff5a00] text-black px-3 py-1.5 rounded">EDITAR</button>
      <button onclick="deleteDoc('${d.id}')" class="text-xs font-display bg-[#e10600] text-white px-3 py-1.5 rounded">ELIMINAR</button>
    </div></div>`;
}
function openDocForm(id = null) {
  editingDocId = id; docPending = [];
  const d = id ? (Store.s.docs || []).find(x => x.id === id) : null;
  $('#doc-form-title').textContent = d ? 'EDITAR DOCUMENTO' : '+ NUEVO DOCUMENTO';
  $('#d-title').value = d?.title || '';
  $('#d-subject').value = d?.subject || '';
  $('#d-date').value = d?.docDate || new Date().toISOString().slice(0, 10);
  $('#d-notes').value = d?.notes || '';
  $('#doc-pending-list').innerHTML = '';
  const ex = d ? Store.s.files.filter(f => f.docId === d.id) : [];
  $('#doc-existing-list').innerHTML = ex.length ? ex.map(f => `<span class="chip mr-1 mb-1">${esc(f.ext.toUpperCase())} ${esc(f.name)}</span>`).join('') : '';
  $('#modal-doc').classList.remove('hidden');
  setTimeout(() => $('#d-title').focus(), 50);
}
function closeDocForm() { $('#modal-doc').classList.add('hidden'); editingDocId = null; docPending = []; }
async function saveDocForm() {
  const title = $('#d-title').value.trim();
  if (!title) { toast('Escribe un titulo', 'err'); return; }
  const prev = editingDocId ? (Store.s.docs || []).find(x => x.id === editingDocId) : null;
  const data = {
    id: editingDocId || Store.uid(),
    title,
    subject: $('#d-subject').value.trim(),
    docDate: $('#d-date').value || '',
    notes: $('#d-notes').value.trim(),
    createdAt: prev?.createdAt || Store.now(),
    updatedAt: Store.now(),
  };
  for (const f of docPending) {
    const ext = fileExt(f.name);
    const rec = { id: Store.uid(), docId: data.id, taskId: null, name: f.name, ext, size: f.size, uploadedAt: Store.now() };
    await DB.put(rec.id, f);
    Store.s.files.push(rec);
  }
  Store.upsertDoc(data);
  closeDocForm(); toast('Documento guardado'); refresh();
}
function deleteDoc(id) {
  const d = (Store.s.docs || []).find(x => x.id === id); if (!d) return;
  askConfirm('Eliminar documento', `Eliminar "${d.title}" y sus archivos?`, async () => {
    const fids = Store.s.files.filter(f => f.docId === id).map(f => f.id);
    for (const fid of fids) await DB.del(fid);
    Store.deleteDoc(id); toast('Documento eliminado'); refresh();
  });
}

// ---------- ARCHIVOS ----------
function renderFiles() {
  const q = ($('#file-q').value || '').toLowerCase();
  let files = [...Store.s.files].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  if (q) files = files.filter(f => f.name.toLowerCase().includes(q));
  const ownerName = (f) => {
    if (f.docId) { const d = (Store.s.docs || []).find(x => x.id === f.docId); return d ? 'Biblioteca: ' + d.title : '(documento eliminado)'; }
    const t = Store.s.tasks.find(x => x.id === f.taskId);
    return t ? 'Tarea: ' + t.title : '(tarea eliminada)';
  };
  $('#files-list').innerHTML = files.length ? files.map(f => `
    <div class="card p-3 flex items-center gap-3">
      ${fileTag(f.ext)}
      <div class="flex-1 min-w-0"><div class="font-semibold truncate text-sm">${esc(f.name)}</div>
      <div class="text-xs" style="color:#8a8578">${fmtSize(f.size)} · ${new Date(f.uploadedAt).toLocaleDateString('es-DO')} · ${esc(ownerName(f))}</div></div>
      <div class="flex gap-1">
        <button onclick="previewFile('${f.id}')" class="text-xs font-bold bg-[#ff5a00] text-black px-2 py-1 rounded">Ver</button>
        <button onclick="downloadFile('${f.id}')" class="text-xs font-bold bg-[#2a2a2e] px-2 py-1 rounded">Bajar</button>
        <button onclick="removeFile('${f.id}')" class="text-xs font-bold bg-[#e10600] text-white px-2 py-1 rounded">Quitar</button>
      </div></div>`).join('') : '<div class="card p-8 text-center text-sm" style="color:#8a8578">Sin archivos todavia.</div>';
  $('#count-files').textContent = files.length + ' archivos';
}

// ---------- MATERIAS (simple, sin vista propia) ----------
function renderSubjects() {
  const el = $('#subj-list'); if (!el) return;
  el.innerHTML = '';
}

// ---------- ACCIONES TAREAS ----------
function setStatus(id, st) {
  const t = Store.s.tasks.find(x => x.id === id); if (!t) return;
  t.status = st; t.updatedAt = Store.now(); Store.save();
  toast(st === 'completada' ? 'Tarea completada. Queda guardada.' : 'Tarea de vuelta a pendiente');
  refresh();
}
function toggleFav(id) {
  const t = Store.s.tasks.find(x => x.id === id); if (!t) return;
  t.favorite = !t.favorite; t.updatedAt = Store.now(); Store.save(); refresh();
}
function refresh() {
  if (route === 'inicio') renderHome();
  if (route === 'tareas') renderAll();
  if (route === 'biblioteca') renderDocs();
  if (route === 'archivos') renderFiles();
  if (detailId) renderDetail();
}

// ---------- FORM TAREA ----------
function openForm(id = null) {
  editingId = id; pendingFiles = [];
  const t = id ? Store.s.tasks.find(x => x.id === id) : null;
  $('#form-title-h').textContent = t ? 'EDITAR TAREA' : '+ NUEVA TAREA';
  $('#f-title').value = t?.title || '';
  $('#f-desc').value = t?.description || '';
  $('#f-teacher').value = t?.teacher || '';
  $('#f-due').value = t?.dueDate || '';
  $('#f-priority').value = t?.priority || 'Media';
  $('#f-status').value = t?.status || 'pendiente';
  $('#f-tags').value = (t?.tags || []).join(', ');
  $('#f-links').value = (t?.links || []).join('\n');
  $('#f-notes').value = t?.notes || '';
  $('#f-fav').checked = !!t?.favorite;
  $('#f-subject').value = t?.subject || '';
  $('#pending-list').innerHTML = '';
  const ex = t ? Store.s.files.filter(f => f.taskId === t.id) : [];
  $('#existing-list').innerHTML = ex.length ? ex.map(f => `<span class="chip mr-1 mb-1">${esc(f.ext.toUpperCase())} ${esc(f.name)}</span>`).join('') : '';
  $('#modal-form').classList.remove('hidden');
  setTimeout(() => $('#f-title').focus(), 50);
}
function closeForm() { $('#modal-form').classList.add('hidden'); editingId = null; pendingFiles = []; }
async function saveForm() {
  const title = $('#f-title').value.trim();
  if (!title) { toast('Escribe un nombre para la tarea', 'err'); return; }
  const data = {
    id: editingId || Store.uid(),
    title,
    description: $('#f-desc').value.trim(),
    subject: $('#f-subject').value.trim(),
    teacher: $('#f-teacher').value.trim(),
    dueDate: $('#f-due').value || '',
    priority: $('#f-priority').value,
    status: $('#f-status').value,
    tags: $('#f-tags').value.split(',').map(s => s.trim()).filter(Boolean),
    links: $('#f-links').value.split('\n').map(s => s.trim()).filter(Boolean),
    notes: $('#f-notes').value.trim(),
    favorite: $('#f-fav').checked,
    createdAt: editingId ? (Store.s.tasks.find(x => x.id === editingId)?.createdAt || Store.now()) : Store.now(),
    updatedAt: Store.now(),
    fileIds: editingId ? (Store.s.tasks.find(x => x.id === editingId)?.fileIds || []) : [],
  };
  for (const f of pendingFiles) {
    const ext = fileExt(f.name);
    const rec = { id: Store.uid(), taskId: data.id, docId: null, name: f.name, ext, size: f.size, uploadedAt: Store.now() };
    await DB.put(rec.id, f);
    data.fileIds.push(rec.id);
    Store.s.files.push(rec);
  }
  Store.upsertTask(data);
  closeForm(); toast('Tarea guardada'); refresh();
}
function handlePicked(fileList) {
  for (const f of fileList) {
    const ext = fileExt(f.name);
    if (!ALLOWED_EXT.includes(ext)) { toast(`Tipo no soportado: ${f.name}`, 'err'); continue; }
    if (f.size > 25 * 1048576) { toast(`Muy pesado (max 25MB): ${f.name}`, 'err'); continue; }
    pendingFiles.push(f);
  }
  $('#pending-list').innerHTML = pendingFiles.map(f => `<span class="chip mr-1 mb-1">${esc(f.name)} (${fmtSize(f.size)})</span>`).join('');
}
function handleDocPicked(fileList) {
  for (const f of fileList) {
    const ext = fileExt(f.name);
    if (!ALLOWED_EXT.includes(ext)) { toast(`Tipo no soportado: ${f.name}`, 'err'); continue; }
    if (f.size > 25 * 1048576) { toast(`Muy pesado (max 25MB): ${f.name}`, 'err'); continue; }
    docPending.push(f);
  }
  $('#doc-pending-list').innerHTML = docPending.map(f => `<span class="chip mr-1 mb-1">${esc(f.name)} (${fmtSize(f.size)})</span>`).join('');
}

// ---------- DETALLE ----------
function openDetail(id) { detailId = id; renderDetail(); $('#modal-detail').classList.remove('hidden'); }
function closeDetail() { $('#modal-detail').classList.add('hidden'); detailId = null; }
function renderDetail() {
  const t = Store.s.tasks.find(x => x.id === detailId); if (!t) { closeDetail(); return; }
  const d = dueLabel(t);
  const files = Store.s.files.filter(f => f.taskId === t.id);
  $('#d-body').innerHTML = `
    <div class="flex items-start justify-between gap-2">
      <h3 class="font-display leading-tight">${t.favorite ? '★ ' : ''}${esc(t.title)}</h3>
      <span class="badge" style="${d.cls}">${d.text}</span>
    </div>
    <div class="flex flex-wrap gap-1 mt-2 text-xs">
      ${t.subject ? `<span class="chip" style="border-color:${subjColor(t.subject)};color:${subjColor(t.subject)}">${esc(t.subject)}</span>` : ''}
      <span class="chip">${esc(t.priority)}</span>
      <span class="chip">${t.status === 'completada' ? 'Completada (guardada)' : 'Pendiente'}</span>
      ${(t.tags || []).map(g => `<span class="chip">#${esc(g)}</span>`).join('')}
    </div>
    <div class="grid grid-cols-2 gap-2 mt-3 text-sm">
      <div class="card p-3">Profesor<br><b>${esc(t.teacher || 'Sin dato')}</b></div>
      <div class="card p-3">Entrega<br><b>${fmtDate(t.dueDate)}</b></div>
    </div>
    ${t.description ? `<p class="mt-3 text-sm whitespace-pre-wrap" style="color:#b9b3a5">${esc(t.description)}</p>` : ''}
    <div class="mt-3 text-sm font-display text-xs">ARCHIVOS (${files.length})</div>
    <div class="mt-2 space-y-2">${files.length ? files.map(f => `
      <div class="card p-2 flex items-center gap-2 text-sm">
        ${fileTag(f.ext)}
        <div class="flex-1 min-w-0"><div class="font-semibold truncate text-sm">${esc(f.name)}</div><div class="text-xs" style="color:#8a8578">${fmtSize(f.size)}</div></div>
        <button onclick="previewFile('${f.id}')" class="text-xs font-bold underline">Ver</button>
        <button onclick="downloadFile('${f.id}')" class="text-xs font-bold underline">Bajar</button>
        <button onclick="removeFile('${f.id}')" class="text-xs font-bold underline" style="color:#e10600">Quitar</button>
      </div>`).join('') : '<p class="text-xs" style="color:#8a8578">Sin archivos.</p>'}</div>`;
  $('#btn-d-complete').textContent = t.status === 'completada' ? 'VOLVER A PENDIENTE' : 'COMPLETAR';
}

// ---------- ARCHIVOS ops ----------
async function blobUrl(id) { const b = await DB.get(id); return b ? URL.createObjectURL(b) : null; }
async function openFile(id) { const url = await blobUrl(id); if (!url) { toast('No se pudo abrir', 'err'); return; } window.open(url, '_blank'); }
async function downloadFile(id) {
  const f = Store.s.files.find(x => x.id === id); if (!f) return;
  const url = await blobUrl(id); if (!url) { toast('No se pudo descargar', 'err'); return; }
  const a = document.createElement('a'); a.href = url; a.download = f.name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function removeFile(id) {
  const f = Store.s.files.find(x => x.id === id); if (!f) return;
  askConfirm('Quitar archivo', `Quitar "${f.name}"?`, async () => {
    await DB.del(id); Store.deleteFile(id);
    const t = Store.s.tasks.find(x => x.id === f.taskId);
    if (t) { t.fileIds = (t.fileIds || []).filter(x => x !== id); t.updatedAt = Store.now(); Store.save(); }
    toast('Archivo eliminado'); refresh();
    if (editingDocId) { const ex = Store.s.files.filter(x => x.docId === editingDocId); $('#doc-existing-list').innerHTML = ex.map(x => `<span class="chip mr-1 mb-1">${esc(x.name)}</span>`).join(''); }
  });
}
function renameFile(id) {
  const f = Store.s.files.find(x => x.id === id); if (!f) return;
  const n = prompt('Nuevo nombre:', f.name); if (!n || !n.trim()) return;
  f.name = n.trim(); f.ext = fileExt(f.name); Store.save(); toast('Archivo renombrado'); refresh();
}
async function previewFile(id) {
  const f = Store.s.files.find(x => x.id === id); if (!f) return;
  const url = await blobUrl(id); if (!url) { toast('No se pudo mostrar', 'err'); return; }
  $('#p-title').textContent = f.name;
  const img = ['jpg', 'jpeg', 'png', 'webp'].includes(f.ext);
  const txt = ['txt', 'csv'].includes(f.ext);
  let html = '';
  if (f.ext === 'pdf') html = `<iframe src="${url}" class="w-full" style="height:80vh" frameborder="0"></iframe>`;
  else if (img) html = `<img src="${url}" class="w-full rounded" style="max-height:80vh;object-fit:contain" />`;
  else if (txt) { const b = await DB.get(id); const t = await b.text(); html = `<pre class="text-xs bg-[#1e1e22] p-3 rounded overflow-auto" style="max-height:80vh">${esc(t.slice(0, 30000))}</pre>`; }
  else html = `<div class="text-center py-8"><div class="text-5xl font-display">[${esc(f.ext.toUpperCase())}]</div><p class="mt-2 text-sm" style="color:#8a8578">${fmtSize(f.size)}. Sin vista previa.</p><button onclick="downloadFile('${f.id}')" class="btn-primary mt-4 text-sm">DESCARGAR</button></div>`;
  $('#p-body').innerHTML = html;
  $('#modal-preview').classList.remove('hidden');
}

// ---------- POCHITA IA (respuestas sobre tus datos, lenguaje neutro) ----------
function pochitaToggle(show) {
  const p = $('#pochita-panel');
  p.classList.toggle('hidden', show === undefined ? !p.classList.contains('hidden') : !show);
  if (!p.classList.contains('hidden') && !$('#pochita-msgs').children.length) {
    pochitaSay('Hola, soy Pochita. Pregunta por pendientes, vencimientos, materias, biblioteca o archivos.');
  }
}
function pochitaSay(text) {
  const box = $('#pochita-msgs');
  const el = document.createElement('div');
  el.className = 'msg-ai p-2 text-xs';
  el.innerHTML = `<b>Pochita:</b> ${text}`;
  box.appendChild(el); box.scrollTop = box.scrollHeight;
}
function pochitaUser(text) {
  const box = $('#pochita-msgs');
  const el = document.createElement('div');
  el.className = 'msg-user p-2 text-xs text-right text-white';
  el.textContent = text;
  box.appendChild(el); box.scrollTop = box.scrollHeight;
}
function pochitaAsk(raw) {
  const q = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const ts = Store.s.tasks;
  const pend = ts.filter(t => t.status !== 'completada');
  const link = (t) => `- <b>${esc(t.title)}</b> (${esc(t.subject || 'sin materia')}, ${fmtDate(t.dueDate)})`;
  if (/hola|quien eres|ayuda|que sabes|help/.test(q)) return `Puedo informar pendientes, vencidas, vencimientos de hoy, manana y semana, materias, biblioteca y archivos.`;
  if (/cuant|resumen|estadistica|total/.test(q)) { const s = stats(); return `Tienes <b>${s.total}</b> tareas: <b>${s.pend}</b> pendientes, <b>${s.comp}</b> completadas (guardadas), <b>${s.soon}</b> por vencer. Biblioteca: <b>${(Store.s.docs || []).length}</b> documentos. Archivos: <b>${s.files}</b>.`; }
  if (/vencida/.test(q)) { const v = pend.filter(t => (daysLeft(t.dueDate) ?? 1) < 0); return v.length ? `Vencidas (${v.length}):<br>` + v.map(link).join('<br>') : `Nada vencido.`; }
  if (/manana/.test(q)) { const v = pend.filter(t => daysLeft(t.dueDate) === 1); return v.length ? `Vence manana:<br>` + v.map(link).join('<br>') : `Manana libre.`; }
  if (/hoy/.test(q)) { const v = pend.filter(t => daysLeft(t.dueDate) === 0); return v.length ? `Vence hoy:<br>` + v.map(link).join('<br>') : `Hoy nada vence.`; }
  if (/semana|pronto|proxim|urgente/.test(q)) { const v = pend.filter(t => { const d = daysLeft(t.dueDate); return d !== null && d >= 0 && d <= 7; }).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')); return v.length ? `Esta semana:<br>` + v.map(link).join('<br>') : `Semana tranquila.`; }
  if (/pendiente/.test(q)) return pend.length ? `Pendientes (${pend.length}):<br>` + pend.slice(0, 8).map(link).join('<br>') : `Sin pendientes.`;
  if (/complet|terminad/.test(q)) { const c = ts.filter(t => t.status === 'completada'); return c.length ? `Completadas y guardadas (${c.length}):<br>` + c.slice(0, 8).map(link).join('<br>') : `Aun no hay completadas.`; }
  if (/biblioteca|documento|investigacion|nota/.test(q)) { const ds = Store.s.docs || []; return ds.length ? `Biblioteca (${ds.length}):<br>` + ds.slice(0, 8).map(d => `- <b>${esc(d.title)}</b> (${esc(d.subject || 'sin materia')}, ${fmtDate(d.docDate)})`).join('<br>') : `Biblioteca vacia.`; }
  if (/archivo/.test(q)) { const n = Store.s.files.length; return `Tienes <b>${n}</b> archivos entre tareas y biblioteca.`; }
  const subj = Store.s.subjects.find(s => q.includes(s.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
  if (subj) { const v = ts.filter(t => t.subject === subj.name); const vd = (Store.s.docs || []).filter(d => d.subject === subj.name); return `${esc(subj.name)}: ${v.length} tareas, ${vd.length} documentos.` + (v.length ? `<br>` + v.slice(0, 6).map(link).join('<br>') : ''); }
  return `No entendi. Prueba: "cuantas pendientes", "que vence manana", "biblioteca".`;
}
function pochitaSend(text) {
  const v = (text ?? $('#pochita-input').value).trim();
  if (!v) return;
  pochitaUser(v);
  $('#pochita-input').value = '';
  setTimeout(() => pochitaSay(pochitaAsk(v)), 350);
}
function editSubject() {}
function delSubject() {}

// ---------- INIT ----------
function applyTheme() {
  const dark = Store.s.theme !== 'light';
  document.documentElement.classList.toggle('dark', dark);
  const b = $('#btn-theme'); if (b) b.textContent = dark ? 'O' : 'X';
}
function init() {
  Store.load();
  if (!localStorage.getItem('mycolladiegooo-v1')) Store.s.theme = 'dark';
  Store.seed(); applyTheme();
  const dl = $('#subjects-dl'); if (dl) dl.innerHTML = Store.s.subjects.map(s => `<option value="${esc(s.name)}">`).join('');
  $$('.navlink[data-route]').forEach(b => b.onclick = () => nav(b.dataset.route));
  const bm = $('#btn-menu'); if (bm) bm.onclick = () => $('#sidebar').classList.toggle('-translate-x-full');
  $('#btn-theme').onclick = () => { Store.s.theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark'; Store.save(); applyTheme(); };
  $('#btn-new').onclick = () => openForm();
  $('#btn-new-2').onclick = () => openForm();
  $('#btn-save').onclick = saveForm;
  $('#btn-cancel').onclick = closeForm;
  $('#btn-d-edit').onclick = () => { const id = detailId; closeDetail(); openForm(id); };
  $('#btn-d-complete').onclick = () => { const t = Store.s.tasks.find(x => x.id === detailId); if (t) setStatus(t.id, t.status === 'completada' ? 'pendiente' : 'completada'); };
  $('#btn-d-del').onclick = () => { const t = Store.s.tasks.find(x => x.id === detailId); if (!t) return; askConfirm('Eliminar tarea', `Eliminar "${t.title}" y sus archivos?`, async () => { for (const fid of (t.fileIds || [])) await DB.del(fid); Store.deleteTask(t.id); closeDetail(); toast('Tarea eliminada'); refresh(); }); };
  $('#btn-d-close').onclick = closeDetail;
  $('#btn-p-close').onclick = () => $('#modal-preview').classList.add('hidden');
  $('#btn-confirm-yes').onclick = () => { $('#modal-confirm').classList.add('hidden'); if (confirmCb) confirmCb(); };
  $('#btn-confirm-no').onclick = () => $('#modal-confirm').classList.add('hidden');
  $('#global-q').oninput = (e) => { globalQ = e.target.value; if (route === 'tareas') renderAll(); };
  $('#f-q').oninput = (e) => { filters.q = e.target.value; renderAll(); };
  $('#f-sort').onchange = (e) => { filters.sort = e.target.value; renderAll(); };
  $('#flt-subject').onchange = (e) => { filters.subject = e.target.value; renderAll(); };
  $$('.tabbtn').forEach(b => b.onclick = () => { tareaTab = b.dataset.tab; $$('.tabbtn').forEach(x => x.classList.toggle('active', x === b)); renderAll(); });
  $('#file-q').oninput = renderFiles;
  $('#f-files').onchange = (e) => handlePicked(e.target.files);
  const dz = $('#dropzone');
  ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drop-active'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drop-active'); }));
  dz.addEventListener('drop', (e) => handlePicked(e.dataTransfer.files));
  dz.addEventListener('click', () => $('#f-files').click());
  // biblioteca
  $('#btn-new-doc').onclick = () => openDocForm();
  $('#btn-doc-cancel').onclick = closeDocForm;
  $('#btn-doc-save').onclick = saveDocForm;
  $('#doc-q').oninput = (e) => { docFilters.q = e.target.value; renderDocs(); };
  $('#doc-subject').onchange = (e) => { docFilters.subject = e.target.value; renderDocs(); };
  $('#doc-sort').onchange = (e) => { docFilters.sort = e.target.value; renderDocs(); };
  $('#d-files').onchange = (e) => handleDocPicked(e.target.files);
  const dzd = $('#dropzone-doc');
  ['dragover', 'dragenter'].forEach(ev => dzd.addEventListener(ev, (e) => { e.preventDefault(); dzd.classList.add('drop-active'); }));
  ['dragleave', 'drop'].forEach(ev => dzd.addEventListener(ev, (e) => { e.preventDefault(); dzd.classList.remove('drop-active'); }));
  dzd.addEventListener('drop', (e) => handleDocPicked(e.dataTransfer.files));
  dzd.addEventListener('click', () => $('#d-files').click());
  // pochita
  $('#nav-pochita').onclick = () => pochitaToggle(true);
  $('#pochita-fab').onclick = () => pochitaToggle();
  $('#pochita-close').onclick = () => pochitaToggle(false);
  $('#pochita-send').onclick = () => pochitaSend();
  $('#pochita-input').onkeydown = (e) => { if (e.key === 'Enter') pochitaSend(); };
  $$('.qchip').forEach(b => b.onclick = () => pochitaSend(b.dataset.q));
  nav('inicio');
}
document.addEventListener('DOMContentLoaded', init);
