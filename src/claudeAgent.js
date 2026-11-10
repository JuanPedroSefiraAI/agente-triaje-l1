const Anthropic = require('@anthropic-ai/sdk');
const systemPrompt = require('./systemPrompt');
const { findRelevantSections } = require('./retrieval');

const client = new Anthropic();

const MODEL = 'claude-opus-4-8';

// Construye el bloque de contexto que se antepone al system prompt.
// Si no hay secciones relevantes, se lo dice explícitamente a Claude
// para que no rellene el hueco con conocimiento general.
function buildRagContext(message) {
  const { sections, found } = findRelevantSections(message);

  const contextBody = found
    ? sections.map((s) => `### ${s.title}\n${s.content}`).join('\n\n')
    : 'No se encontró ninguna sección del manual de procedimientos relacionada con esta consulta.';

  const context = `## CONTEXTO OFICIAL (extraído del manual interno de procedimientos)
${contextBody}

## INSTRUCCIONES SOBRE EL USO DEL CONTEXTO OFICIAL
- Responde ÚNICAMENTE con base en el CONTEXTO OFICIAL de arriba. No completes huecos con conocimiento general ni supongas procedimientos, URLs o plazos que no estén ahí.
- Si el contexto indica que no se encontró información relevante, o si no cubre lo que pregunta el usuario, no inventes un procedimiento, política, URL o plazo que no esté documentado aquí. Esto no te impide hacer el triaje básico (preguntar datos) ni proponer las pruebas de la sección "COMPROBACIONES BÁSICAS" si aparece en este contexto (ver "CUÁNDO ESCALAR" del system prompt); no añadas ningún otro consejo, aunque parezca razonable.
- No mezcles el contexto oficial con suposiciones "razonables": si no está en el contexto, no lo afirmes.`;

  return { context, sectionTitles: found ? sections.map((s) => s.title) : [] };
}

// Se antepone cuando el front-end detecta que el mensaje dispara el trigger
// de conexión PERO además trae otras incidencias: evita que el agente se
// quede solo con el problema de conexión al construir su respuesta.
const MULTIPLE_ISSUES_NOTE = `## AVISO: MENSAJE CON VARIAS INCIDENCIAS
El usuario ha reportado en este mismo mensaje un posible problema de
conexión junto con, al menos, otra incidencia distinta. Reconoce
explícitamente TODAS las incidencias mencionadas (aunque sea en una
lista breve) antes de resolver o escalar cada una por separado.`;

const ESCALATION_TOOL_NOTE = `## HERRAMIENTA DE ESCALADO A NIVEL 2
Cuando decidas escalar la consulta a soporte Nivel 2 (según los criterios
y el triaje previo de la sección "CUÁNDO ESCALAR"), además de tu
respuesta habitual al usuario, invoca la herramienta "escalar_a_nivel2"
con un resumen del problema para el equipo humano. Si no vas a escalar,
no la uses.`;

// Herramienta que el modelo invoca cuando decide escalar, para separar el
// resumen estructurado (destinado a Nivel 2 / Freshdesk) del mensaje en
// lenguaje natural que se muestra al usuario en el chat.
const ESCALATION_TOOL = {
  name: 'escalar_a_nivel2',
  description:
    'Crea un ticket de soporte Nivel 2 para que un humano continúe la conversación. ' +
    'Llámala únicamente cuando, según los criterios de "CUÁNDO ESCALAR" del system prompt, decidas escalar la consulta.',
  input_schema: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        description: 'Título breve del problema (máx. 100 caracteres) para el asunto del ticket.',
      },
      summary: {
        type: 'string',
        description:
          'Resumen del problema, incluyendo las respuestas del triaje básico (desde cuándo ocurre, a quién afecta, qué se ha probado) y cualquier comprobación ya realizada, para que el equipo de Nivel 2 no tenga que volver a preguntar todo.',
      },
      priority: {
        type: 'integer',
        enum: [1, 2, 3, 4],
        description: '1 = Baja, 2 = Media, 3 = Alta, 4 = Urgente.',
      },
    },
    required: ['subject', 'summary'],
  },
};

// Solo se usa en modo evaluación (dryRun: true, ver eval/). No se añade en
// producción para no alterar el comportamiento ni el coste/latencia del
// agente real: la clasificación es metadata para medir, no para servir.
const CLASSIFICATION_TOOL_NOTE = `## HERRAMIENTA DE CLASIFICACIÓN (solo evaluación interna)
Además de tu respuesta y de la herramienta de escalado si aplica, invoca
SIEMPRE la herramienta "clasificar_triaje" con tu clasificación interna de
este turno. Es solo para métricas internas, no afecta a lo que ve el
usuario.`;

const CLASSIFICATION_TOOL = {
  name: 'clasificar_triaje',
  description:
    'Reporta la clasificación interna de este turno (decisión, categoría, prioridad) para métricas de evaluación. ' +
    'Llámala siempre en modo evaluación, junto con "escalar_a_nivel2" si también la usas.',
  input_schema: {
    type: 'object',
    properties: {
      decision: {
        type: 'string',
        enum: ['resolver', 'escalar', 'pedir_datos'],
        description:
          '"resolver" si das pasos de solución o la respuesta a la consulta, aunque termines preguntando si ha funcionado; ' +
          '"escalar" si invocaste escalar_a_nivel2; ' +
          '"pedir_datos" si tu respuesta consiste en preguntar datos para acotar el problema y todavía no das una solución ni escalas.',
      },
      categoria: {
        type: 'string',
        description:
          'Categoría breve de la incidencia, p.ej.: contraseñas, microsoft365, vpn_red, impresoras, hardware, permisos_accesos, software_licencias, altas_bajas.',
      },
      prioridad: {
        type: 'string',
        enum: ['baja', 'media', 'alta', 'critica'],
      },
    },
    required: ['decision', 'categoria', 'prioridad'],
  },
};

const PRIORITY_NUMBER_TO_LABEL = { 1: 'baja', 2: 'media', 3: 'alta', 4: 'critica' };

// Construye el system prompt exactamente como se envía a la API. Se exporta
// para poder inspeccionarlo (eval/generar-prompts-manuales.js) sin llamar a Claude.
function buildSystem({ message, multipleIssues = false, dryRun = false }) {
  const { context: ragContext, sectionTitles } = buildRagContext(message);

  const system = [
    systemPrompt,
    multipleIssues ? MULTIPLE_ISSUES_NOTE : null,
    ESCALATION_TOOL_NOTE,
    dryRun ? CLASSIFICATION_TOOL_NOTE : null,
    ragContext,
  ]
    .filter(Boolean)
    .join('\n\n');

  return { system, ragContext, sectionTitles };
}

/**
 * Función pura del agente de triaje L1: construye el prompt (system +
 * contexto RAG + historial + mensaje) y llama a la API de Claude. No hace
 * I/O propia (ni Freshdesk ni Supabase): esos efectos los decide quien la
 * llama (ver src/routes/chat.js) según el flag `dryRun`.
 *
 * `dryRun: true` añade la herramienta de clasificación interna (ver
 * CLASSIFICATION_TOOL) para obtener decision/categoria/prioridad de forma
 * fiable en evaluación. En producción (`dryRun: false`, por defecto) nunca
 * se añade, para no tocar el comportamiento ni el coste del agente real.
 */
async function runAgent({ message, history = [], multipleIssues = false, dryRun = false, model } = {}) {
  const startedAt = Date.now();
  const { system, sectionTitles } = buildSystem({ message, multipleIssues, dryRun });

  const tools = dryRun ? [ESCALATION_TOOL, CLASSIFICATION_TOOL] : [ESCALATION_TOOL];

  const response = await client.messages.create({
    model: model || MODEL,
    max_tokens: 1024,
    system,
    tools,
    messages: [...history, { role: 'user', content: message }],
  });

  const latencia_ms = Date.now() - startedAt;

  if (response.stop_reason === 'refusal') {
    throw new Error('La consulta fue rechazada por los filtros de seguridad del modelo.');
  }

  const textBlock = response.content.find((block) => block.type === 'text');
  const escalationBlock = response.content.find(
    (block) => block.type === 'tool_use' && block.name === 'escalar_a_nivel2'
  );
  const classificationBlock = response.content.find(
    (block) => block.type === 'tool_use' && block.name === 'clasificar_triaje'
  );

  const escalation = escalationBlock
    ? {
        subject: escalationBlock.input.subject,
        summary: escalationBlock.input.summary,
        priority: escalationBlock.input.priority,
      }
    : null;

  const decision = classificationBlock
    ? classificationBlock.input.decision
    : escalation
      ? 'escalar'
      : 'resolver';

  const categoria = classificationBlock ? classificationBlock.input.categoria : null;

  const prioridad = classificationBlock
    ? classificationBlock.input.prioridad
    : escalation
      ? PRIORITY_NUMBER_TO_LABEL[escalation.priority] || 'media'
      : null;

  return {
    decision,
    categoria,
    prioridad,
    respuesta: textBlock ? textBlock.text : '',
    secciones_manual_usadas: sectionTitles,
    tokens_entrada: response.usage?.input_tokens ?? 0,
    tokens_salida: response.usage?.output_tokens ?? 0,
    latencia_ms,
    escalation,
    dryRun,
  };
}

module.exports = { runAgent, buildSystem };
