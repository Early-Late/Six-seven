## Novedades
- Estetica oscura con imagenes locales en `assets/` (logo, hero, side, cover, pochita).
- Sin emojis en la interfaz. Lenguaje neutro.
- Vista simplificada: Inicio, Tareas, Biblioteca, Archivos.
- Biblioteca: documentos y notas de investigacion por materia y fecha, con varios archivos cada uno.
- Visor de PDF amplio (80vh, ancho completo).
- Las tareas completadas se conservan siempre (pestana Completadas + Todas).

## Arquitectura
- **Frontend only, 0 backend**: HTML + Tailwind CDN + JS vanilla (3 módulos clásicos para que funcione con `file://`).
- `js/db.js` → IndexedDB `mycolladiegooo-db` guarda los **blobs** de archivos.
- `js/store.js` → `localStorage` key `mycolladiegooo-v1` guarda tareas, materias, etiquetas y metadatos de archivos.
- `js/app.js` → routing por secciones, renders, filtros, modales, drag&drop, preview.
- `css/styles.css` → tarjetas, sidebar, dark mode, animaciones.

## Modelo de datos
- **Task**: `{id, title, description, subject, teacher, dueDate, priority, status, tags[], links[], notes, favorite, createdAt, updatedAt, fileIds[]}`
- **FileRec**: `{id, taskId, name, ext, size, uploadedAt}` + blob en IndexedDB con el mismo `id`.
- **Subject**: `{id, name, color}` · **Tag**: libre por tarea (texto + color auto).

## Estructura
```
mycolladiegooo/
  index.html  css/styles.css
  js/db.js  js/store.js  js/app.js
  README.md
```

## Instalación / ejecución local
No requiere Node ni base de datos.

Opción A (más fácil): doble clic en `index.html`.
Opción B (recomendada, evita límites de `file://`):
```powershell
cd "C:\Users\diego\OneDrive\Documentos\cosas de diego\mycolladiegooo"
python -m http.server 8080
# abre http://localhost:8080
```
O con Node: `npx serve .`

## Variables de entorno / BD
No hay. Todo es local: `localStorage` + `IndexedDB` del navegador. Los datos sobreviven al cerrar/reabrir. Para borrar todo: DevTools → Application → Clear storage.

## Producción
Es un sitio estático: sube la carpeta a Netlify / Vercel / GitHub Pages tal cual. No hay build.

## Funciones incluidas
Inicio con stats + barras + recientes/favoritas/actividad · Pendientes/Completadas con completar/reabrir en 1 clic · Todas con buscador + filtros (materia, estado, prioridad, fecha) + orden (entrega, creación, nombre) · + Nueva tarea (título, materia, profe, fecha, prioridad, estado, etiquetas, links, notas, ⭐, multi-archivo drag&drop) · Página de detalle con editar/completar/eliminar · Archivos: abrir, descargar, renombrar, eliminar, preview (PDF/IMG/TXT) · Materias CRUD · Buscador global (nombre, materia, profe, etiqueta, descripción, archivo) · Etiquetas "Entrega en X / hoy / mañana / Vencida" · Favoritos · Claro/oscuro · Responsive · Confirms + toasts.
