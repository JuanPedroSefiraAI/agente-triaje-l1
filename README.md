# Agente de Soporte Técnico Nivel 1 (Sefira AI)

Agente de soporte IT que resuelve incidencias comunes (contraseñas, conexión, accesos, VPN) basándose estrictamente en el manual de procedimientos interno de la empresa, y escala a Nivel 2 cuando la consulta no está cubierta o supera su alcance.

## Arquitectura

Recorrido de un mensaje, de principio a fin:

```
Usuario escribe mensaje
        │
        ▼
Frontend (public/script.js)
  - Detecta si el mensaje dispara la simulación de auto-diagnóstico de conexión
  - Si no, envía POST /api/chat
        │
        ▼
Backend Express (src/routes/chat.js)
        │
        ▼
Búsqueda RAG por palabras clave (src/retrieval.js)
  - Tokeniza el mensaje, quita stopwords
  - Puntúa cada sección del manual por solapamiento de tokens
  - Devuelve hasta 2 secciones relevantes (o "found: false" si no hay match)
        │
        ▼
Construcción del contexto (src/claudeAgent.js → buildRagContext)
  - Antepone el contenido de las secciones encontradas al system prompt
  - Si no hubo match, inyecta una instrucción explícita de "no hay contexto"
        │
        ▼
Llamada a la API de Claude (@anthropic-ai/sdk)
  - system = systemPrompt + [aviso multi-incidencia] + contexto RAG
  - modelo: claude-opus-4-8
        │
        ▼
Respuesta al usuario
  - Resuelta con base en el manual, o
  - Escalada a soporte Nivel 2 (el propio texto de la respuesta lo indica)
```

## Stack técnico

- **Node.js** (`v26.2.0` en entorno de desarrollo), sin transpilación ni bundler.
- **Express** `^4.19.2` — servidor HTTP, sirve el frontend estático y expone `POST /api/chat`.
- **@anthropic-ai/sdk** `^0.110.0` — cliente oficial de la API de Claude.
- **Modelo:** `claude-opus-4-8` (constante `MODEL` en [src/claudeAgent.js](src/claudeAgent.js)).
- **RAG por palabras clave** (propio, sin dependencias externas) — ver sección siguiente.
- **Frontend:** HTML/CSS/JS vanilla, sin framework ni build step.
- **Persistencia de conversación:** `localStorage` en el navegador (clave `sefira_chat_history`), no hay base de datos.
- **Despliegue:** Vercel, con las variables de entorno configuradas en el propio dashboard de Vercel (no hay `vercel.json` en el repo; el despliegue depende de la detección automática del proyecto Node).

## Cómo funciona el RAG

El manual de procedimientos (`docs/manual-procedimientos.txt`) es un archivo de texto plano dividido en secciones mediante encabezados `## TÍTULO`. Al arrancar, `src/retrieval.js` parsea el archivo una sola vez y cachea cada sección junto con el conjunto de tokens (palabras, sin stopwords en español) que contiene. Ante cada mensaje del usuario, se tokeniza la consulta y se puntúa cada sección por solapamiento de palabras clave, devolviendo como máximo las 2 secciones con más coincidencias. Si ninguna sección alcanza el umbral mínimo de coincidencia, no se inventa contexto: se le indica explícitamente a Claude que no se encontró información relevante en el manual, y el system prompt le instruye a reconocerlo y escalar a Nivel 2 en lugar de responder con conocimiento general.

## Funcionalidades clave

- Respuestas basadas estrictamente en la documentación del cliente (RAG por palabras clave sobre el manual de procedimientos).
- Escalado automático a Nivel 2 cuando no hay contexto suficiente o el problema lo requiere.
- Simulación visual de auto-diagnóstico de conexión en el frontend (secuencia de pasos con delays, sin llamadas reales a ningún sistema de red).
- Dashboard de administrador con clasificación de conversaciones por urgencia y estado.
- Persistencia de la conversación en el navegador vía `localStorage`.

## Instalación y ejecución local

Requisitos: Node.js con soporte para `--env-file-if-exists` (Node 20.6+).

```bash
npm install
```

Crear un archivo `.env` en la raíz a partir de `.env.example`:

```
ANTHROPIC_API_KEY=
```

Rellenar `ANTHROPIC_API_KEY` con una clave válida de la API de Claude (no se incluye ninguna clave real en el repositorio).

Arrancar el servidor:

```bash
npm start
```

Por defecto escucha en `http://localhost:3006` (configurable con la variable de entorno `PORT`). El chat está en `/` y el dashboard de administrador en `/dashboard`.

Para desarrollo con reinicio automático ante cambios:

```bash
npm run dev
```

## Despliegue

El proyecto está desplegado en Vercel. Las variables de entorno (`ANTHROPIC_API_KEY`) se configuran directamente en el panel de Vercel del proyecto, no en el repositorio. No hay archivo `vercel.json`; el despliegue se apoya en la detección automática de un proyecto Node/Express a partir de `package.json`.

## Limitaciones actuales

- La búsqueda RAG es por **solapamiento de palabras clave** (tokenización + stopwords), no por embeddings ni búsqueda vectorial. Funciona razonablemente para un manual corto y bien titulado, pero no generaliza a sinónimos, parafraseo o manuales grandes.
- El manual de procedimientos es un único archivo de texto plano (`docs/manual-procedimientos.txt`); no hay ingesta de múltiples documentos, PDFs, ni actualización dinámica.
- El **dashboard de administrador usa datos de demostración** (`public/mockConversations.js`): las conversaciones, urgencias y estados mostrados son ficticios y no provienen de interacciones reales del agente ni de una base de datos.
- La **simulación de auto-diagnóstico de conexión** en el chat es puramente visual (secuencia de mensajes con retrasos artificiales); no comprueba red, DNS ni estado del proveedor de internet.
- No hay persistencia de conversaciones en servidor: el historial vive solo en `localStorage` del navegador y se pierde al cambiar de dispositivo o borrar datos.
- No hay autenticación ni control de acceso en `/dashboard`: cualquiera que conozca la URL puede verlo.
- No hay tests automatizados en el repositorio.
