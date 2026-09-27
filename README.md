## Novedades
- Fondo blanco (tema claro por defecto, modo oscuro opcional con el botón Oscuro/Claro).
- Sincronización entre dispositivos: lo que crees en el celular aparece en la PC y viceversa.
- Sin emojis en la interfaz. Lenguaje neutro.
- Vista simplificada: Inicio, Tareas, Biblioteca, Archivos.
- Biblioteca: documentos y notas de investigacion por materia y fecha, con varios archivos cada uno.
- Visor de PDF amplio (80vh, ancho completo).
- Las tareas completadas se conservan siempre (pestana Completadas + Todas).

## Publicar en GitHub Pages
1. Sube estos archivos a la rama `main` del repo (raíz: `index.html`, carpetas `css/`, `js/`).
2. En GitHub: Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.
3. La página queda en `https://Early-Late.github.io/Six-seven/`.
4. Cada cambio que subas (`git push`) se publica solo en 1-2 minutos.

## Sincronizar tareas entre celular y PC (misma página)
GitHub Pages solo sirve archivos: cada navegador guarda lo suyo. Para que los equipos
se reflejen entre sí hay 3 niveles, del más simple al automático:

**Nivel 1 — Mismo equipo, varias pestañas:** automático, sin configurar nada.

**Nivel 2 — Respaldo manual:** botón Sincronizar → Exportar en un equipo →
Importar en el otro. Pasa tareas, documentos, materias y etiquetas.

**Nivel 3 — Tiempo real entre dispositivos (gratis, 5 min, una sola vez):**
1. Entra a console.firebase.google.com y crea un proyecto.
2. Compilación → Realtime Database → Crear base de datos.
3. En Reglas escribe: `{"rules":{".read":true,".write":true}}`.
4. Configuración del proyecto → Tus apps → Web → copia `apiKey`, `authDomain` y `databaseURL`.
5. En la página: Sincronizar → pega los 3 datos + Espacio `casa` → Conectar.
6. Repite el paso 5 en cada dispositivo con el MISMO Espacio. Listo: lo que
   cambies en uno aparece solo en los demás.

Nota: los archivos adjuntos viajan como lista entre equipos, pero su contenido vive
en el equipo donde se subió (límite de los planes gratis). La página avisa en ese caso.

## Arquitectura
- **Frontend only, 0 backend**: HTML + Tailwind CDN + JS vanilla (módulos clásicos para que funcione con `file://`).
- `js/db.js` → IndexedDB `mycolladiegooo-db` guarda los **blobs** de archivos.
- `js/store.js` → `localStorage` key `mycolladiegooo-v1` guarda tareas, materias, etiquetas y metadatos de archivos (+ `rev` y `tombstones` para sincronizar).
- `js/app.js` → routing por secciones, renders, filtros, modales, drag&drop, preview.
- `js/sync.js` → sincronización: pestañas del mismo equipo (BroadcastChannel/storage), nube Firebase Realtime Database entre dispositivos, exportar/importar JSON.
- `css/styles.css` → tema claro por defecto + modo oscuro opcional, tarjetas, sidebar, animaciones.

## Modelo de datos
- **Task**: `{id, title, description, subject, teacher, dueDate, priority, status, tags[], links[], notes, favorite, createdAt, updatedAt, fileIds[]}`
- **FileRec**: `{id, taskId, docId, name, ext, size, uploadedAt}` + blob en IndexedDB con el mismo `id`.
- **Appearance**: `{siteName, siteSub, logoLetter, heroTitle, heroSub, tabTitle, brand, brandDark, accent, bg, panel, ink, line, m1, m2, font, radius, dots, grain, btnAnim}` + `appearanceUpdatedAt` (se sincroniza entre dispositivos).
- **Subject**: `{id, name, color}` · **Tag**: libre por tarea (texto + color auto).

## Estructura
```
mycolladiegooo/
  index.html  css/styles.css
  js/db.js  js/store.js  js/app.js  js/sync.js
  README.md
```

## Personalizar
Vista **Personalizar** (menú lateral): cambia nombre del sitio, subtítulo, letra del logo,
saludo, título de la pestaña, los 9 colores (primario, acento, fondo, tarjetas, texto,
bordes, secundarios), la letra de títulos (4 opciones), el redondeo de esquinas y los
efectos (puntos, textura, animación de botones). Todo se aplica en vivo, se guarda solo
y viaja a tus otros dispositivos con la nube. Botón para restablecer todo.

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
