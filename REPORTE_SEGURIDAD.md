# 🔒 Reporte de Auditoría de Seguridad

## Proyecto: soporte-tecnico-agente (Sefira AI — Agente de Soporte Nivel 1)
## Fecha: 2026-08-07

## Resumen ejecutivo

Proyecto pequeño: backend Express + SDK oficial de Anthropic, frontend HTML/CSS/JS vanilla sin build step, sin base de datos, sin Supabase, sin sistema de autenticación/roles. Desplegado en Vercel con variables de entorno gestionadas en el panel de Vercel (no en el repo).

Por el stack real del proyecto, las secciones 3 (proxy/middleware de auth) y 4 (RLS de Supabase) del checklist original **no aplican** tal cual — no hay Next.js, ni Supabase, ni sesiones, ni roles. Se documentan como N/A con la justificación correspondiente, y el resto de la auditoría (secrets, .gitignore, historial git, dependencias, headers, CORS, rate limiting, validación de inputs, XSS) se hizo completa sobre el código real.

- Total de hallazgos: 7
- 🔴 Críticos: 0
- 🟠 Altos: 1
- 🟡 Medios: 2
- 🔵 Bajos: 4

No se encontraron secrets hardcodeados en el código ni en el historial de git. La API key de Anthropic vive únicamente en `.env` local (correctamente ignorado por git) y en variables de entorno de Vercel.

---

## Hallazgos detallados

### 🟠 ALTO — `POST /api/chat` sin rate limiting, público y sin autenticación
- **Ubicación**: [src/routes/chat.js](src/routes/chat.js), [src/server.js](src/server.js)
- **Descripción**: El endpoint `/api/chat` está montado sin ningún middleware de autenticación ni límite de peticiones. Cualquiera que acceda a la URL pública puede invocarlo repetidamente. Cada llamada dispara una petición a la API de Claude (`model: claude-opus-4-8`, `max_tokens: 1024`) en [src/claudeAgent.js:7](src/claudeAgent.js#L7), que tiene coste por token.
- **Impacto**: Un actor malicioso (o un bot/scraper) puede hacer scripting contra el endpoint y generar un consumo de API arbitrariamente alto a cargo de la cuenta de Anthropic del proyecto (abuso económico / agotamiento de cuota), además de una posible degradación de servicio para usuarios legítimos.
- **Remediación**:
  1. Añadir rate limiting por IP (p. ej. `express-rate-limit`) al router de `/api`:
     ```js
     const rateLimit = require('express-rate-limit');
     router.use(rateLimit({ windowMs: 60_000, max: 10 }));
     ```
  2. Evaluar límite de longitud de `message` (ver hallazgo BAJO más abajo) para acotar tokens de entrada.
  3. Si el uso previsto es interno (empresa), considerar autenticación mínima (API key compartida, cookie de sesión corporativa, o al menos un captcha/verificación ligera) antes de exponer el endpoint sin restricciones en producción.

### 🟡 MEDIO — `/dashboard` sin autenticación ni control de acceso
- **Ubicación**: [src/server.js:13-15](src/server.js#L13-L15), enlazado públicamente desde [public/index.html:25](public/index.html#L25)
- **Descripción**: La ruta `/dashboard` sirve `dashboard.html` sin ninguna verificación de identidad o rol. Está enlazada directamente desde la página principal del chat ("Dashboard Admin"), por lo que cualquier visitante puede acceder a ella. Esto ya está documentado como limitación conocida en el propio [README.md:106](README.md#L106).
- **Impacto**: Actualmente el dashboard solo renderiza datos mock ([public/mockConversations.js](public/mockConversations.js)), por lo que no hay fuga de datos reales hoy. Pero es una ruta con nombre y contenido de "administrador" completamente abierta: si en el futuro se conecta a datos reales (conversaciones de usuarios, urgencias, resúmenes de incidencias) sin añadir auth en ese momento, quedaría expuesta a cualquiera.
- **Remediación**:
  1. Antes de conectar `/dashboard` a datos reales, añadir un middleware de autenticación (aunque sea básico: sesión de empleado, Basic Auth detrás de un proxy, o SSO corporativo) que proteja la ruta y, si se añade una API que sirva esos datos, protegerla también server-side.
  2. Mientras siga siendo demo, mantener visible el aviso "Datos de demostración" (ya presente) para evitar confusión, pero no depender de "seguridad por oscuridad" (ruta no listada) como única protección.

### 🟡 MEDIO — Riesgo latente de XSS en `dashboard.js` vía `innerHTML` con datos no controlados en origen
- **Ubicación**: [public/dashboard.js:33-53](public/dashboard.js#L33-L53) y [public/dashboard.js:61-74](public/dashboard.js#L61-L74)
- **Descripción**: `renderSummaryBar` y `renderConversations` construyen HTML con template strings e insertan campos (`c.user`, `c.summary`, etc.) directamente vía `innerHTML`, sin escapar. Hoy esos datos vienen de un array estático hardcodeado ([public/mockConversations.js](public/mockConversations.js)), así que no hay vector de ataque real todavía.
- **Impacto**: El README indica explícitamente que el dashboard está pensado para conectarse a datos reales de conversaciones más adelante. Si esos datos (resumen de la incidencia, nombre de usuario, etc.) llegan a incluir texto escrito por usuarios finales del chat y se siguen inyectando con `innerHTML` sin sanitizar, se abre una vía de XSS almacenado (un usuario podría escribir `<img src=x onerror=...>` en su consulta y que se ejecute en el navegador de un administrador).
- **Remediación**:
  1. Al conectar datos reales, sustituir la interpolación directa en `innerHTML` por creación de nodos con `textContent` (como ya se hace correctamente en `public/script.js:35` con `el.textContent = text`), o por una función de escape HTML antes de interpolar.
  2. Si se necesita HTML enriquecido en algún campo, usar una librería de sanitización (`DOMPurify`) en vez de confiar en la fuente de datos.

### 🔵 BAJO — Ausencia de headers de seguridad HTTP
- **Ubicación**: [src/server.js](src/server.js) (no hay configuración de headers en toda la app)
- **Descripción**: No se configuran `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Strict-Transport-Security` ni `Referrer-Policy`. Express no los añade por defecto.
- **Impacto**: Mayor superficie ante clickjacking (falta `X-Frame-Options`/CSP `frame-ancestors`), MIME sniffing, y ausencia de defensa en profundidad frente a XSS (sin CSP). Riesgo bajo dado el tamaño y naturaleza interna de la app, pero es una mejora barata.
- **Remediación**: Añadir `helmet`:
  ```js
  const helmet = require('helmet');
  app.use(helmet());
  ```

### 🔵 BAJO — Sin límite de longitud en el mensaje enviado a `/api/chat`
- **Ubicación**: [src/routes/chat.js:10-12](src/routes/chat.js#L10-L12)
- **Descripción**: Solo se valida que `message` sea un string no vacío tras `trim()`. No hay límite máximo de longitud antes de reenviarlo como `messages[0].content` a la API de Claude ([src/claudeAgent.js:46](src/claudeAgent.js#L46)).
- **Impacto**: Refuerza el vector de abuso de coste descrito en el hallazgo ALTO (mensajes muy largos = más tokens de entrada por request).
- **Remediación**: Añadir un límite razonable, p. ej.:
  ```js
  if (message.length > 4000) {
    return res.status(400).json({ error: 'El mensaje es demasiado largo.' });
  }
  ```

### 🔵 BAJO — Vulnerabilidad conocida en dependencia transitiva `body-parser`
- **Ubicación**: `package-lock.json` (dependencia transitiva de `express@^4.19.2`)
- **Descripción**: `npm audit` reporta 1 vulnerabilidad de severidad **baja** en `body-parser` (< 1.20.6): un valor de `limit` inválido puede desactivar silenciosamente la validación de tamaño ([GHSA-v422-hmwv-36x6](https://github.com/advisories/GHSA-v422-hmwv-36x6)).
- **Impacto**: Riesgo de denegación de servicio limitado; requiere condiciones específicas de configuración de `limit`. No se detectó uso explícito de un `limit` inválido en el proyecto.
- **Remediación**: Ejecutar `npm audit fix` o actualizar Express a una versión que incluya `body-parser >= 1.20.6`.

### 🔵 BAJO — Entrada duplicada de `.env` en `.gitignore`
- **Ubicación**: [.gitignore:6](.gitignore#L6) y [.gitignore:22](.gitignore#L22)
- **Descripción**: `.env` aparece listado dos veces. No es un problema de seguridad (ambas entradas son correctas y `.env` está efectivamente ignorado), pero es ruido/cosmético.
- **Impacto**: Ninguno funcional. Se reporta solo por completitud del checklist.
- **Remediación**: Eliminar la línea duplicada.

---

## Verificaciones realizadas sin hallazgos (confirmado seguro)

- **`.env`**: contiene `ANTHROPIC_API_KEY` real, existe solo en disco local, está correctamente cubierto por `.gitignore` y **no aparece** en el historial de git (`git log --all --full-history -- "**/.env*"` sin resultados). Tampoco hay `.pem`/`.key` en el historial.
- **`.env.example`**: solo contiene el nombre de la variable sin valor real (`ANTHROPIC_API_KEY=`), versionado correctamente en el repo.
- **Secrets hardcodeados**: búsqueda de patrones (`sk-`, `AKIA`, `AIza`, `ghp_`, `xoxb-`, `password`, `secret`, `token`, `api_key`) en todo el código fuente y `docs/` sin resultados reales (un único falso positivo: una regex literal `/\bpassword\b/` usada para detección de intents en `public/script.js:99`).
- **Exposición al cliente**: la API key de Anthropic solo se lee vía `process.env` en `src/claudeAgent.js` (código server-side, Node puro). El frontend (`public/*.js`) no referencia ninguna variable de entorno ni hace `fetch` a terceros salvo `/api/chat` (mismo origen). No hay endpoint que haga dump de `process.env`.
- **CORS**: no se configura ningún middleware de CORS; por defecto el navegador aplica same-origin, y el único `fetch` del frontend es a `/api/chat` (mismo origen). No hay wildcard `*` expuesto.
- **Inyección / sanitización**: no hay SQL (no hay base de datos), no hay `eval`, no hay acceso a filesystem con paths derivados de input de usuario (el único `fs.readFileSync` en `src/retrieval.js:53` usa una ruta fija al manual, no un path de usuario). El mensaje del usuario se envía a la API de Claude como texto plano de conversación, no se interpreta como comando.
- **XSS en el chat principal**: `public/script.js` usa `el.textContent = text` (línea 35) para renderizar tanto los mensajes del usuario como la respuesta del modelo — correcto, sin riesgo de inyección HTML.

---

## Mapa de rutas y protección

| Ruta | Tipo | Protección | Observaciones |
|---|---|---|---|
| `GET /` | Página (estático, `public/index.html`) | ✅ Pública | Chat de soporte, sin datos sensibles |
| `GET /dashboard` | Página (estático, `public/dashboard.html`) | ❓ Sin clasificar / debería protegerse | Etiquetada "Administrador"; hoy solo datos mock — ver hallazgo MEDIO |
| `POST /api/chat` | API | ❓ Sin autenticación ni rate limit | Invoca API de pago sin control — ver hallazgo ALTO |
| `GET /*.js, /*.css, /*.png` (estáticos vía `express.static`) | Archivos estáticos | ✅ Pública | Sin datos sensibles servidos |

No hay rutas dinámicas (`[id]`, `[slug]`), no hay endpoints de admin adicionales, no hay webhooks.

## Autenticación, autorización y RLS — No aplica

El proyecto no usa Supabase, no tiene base de datos, no tiene Next.js (ni `middleware.ts`/`proxy.ts`), no maneja sesiones ni JWT, y no tiene sistema de usuarios/roles. Por tanto, las secciones 3.2–3.4 (proxy/middleware, validación de sesiones, autorización por rol, IDOR) y la sección 4 completa (RLS, `SECURITY DEFINER`, `service_role`, Storage buckets, Realtime) del checklist original no tienen superficie sobre la que auditar en el estado actual del proyecto.

Si en el futuro se añade backend con estado (base de datos, cuentas de usuario, o se conecta el dashboard a datos reales — como sugiere el README), esta auditoría debería repetirse cubriendo esas secciones, empezando por proteger `/dashboard` y cualquier API nueva que exponga datos de conversaciones.

---

## Checklist final

- [x] Todas las variables sensibles en `.env` y excluidas de git
- [x] No hay secrets en el historial de git
- [x] No hay secrets hardcodeados en el código
- [ ] Todas las rutas protegidas tienen proxy/middleware de auth — `/dashboard` no tiene ninguna protección (🟡 MEDIO)
- [ ] N/A — Proxy/Middleware (no aplica, no hay Next.js ni sistema de auth en este proyecto)
- [ ] N/A — `proxy.ts` vs `middleware.ts` (no aplica, no es Next.js)
- [ ] N/A — RLS de Supabase (no aplica, no hay Supabase)
- [ ] N/A — Políticas RLS (no aplica)
- [x] No se usa `service_role` key en el cliente (no aplica Supabase, pero se confirmó que ningún secret está expuesto al cliente)
- [ ] N/A — Funciones `SECURITY DEFINER` (no aplica)
- [ ] Los inputs se validan y sanitizan — validación mínima presente (no vacío), falta límite de longitud (🔵 BAJO)
- [x] CORS está configurado correctamente (sin CORS habilitado; same-origin por defecto, adecuado para este proyecto)
- [ ] Headers de seguridad están presentes — ausentes, recomendado `helmet` (🔵 BAJO)
- [ ] Rate limiting en endpoints públicos — ausente en `/api/chat` (🟠 ALTO)
