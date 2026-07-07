const fs = require('node:fs');
const path = require('node:path');

const DOC_PATH = path.join(__dirname, '..', 'docs', 'manual-procedimientos.txt');

// Palabras demasiado comunes en español: no aportan señal de relevancia
// y si no se filtran, cualquier pregunta "coincide" con cualquier sección.
const STOPWORDS = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'que', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'con', 'por', 'para', 'es', 'no', 'se', 'su', 'sus', 'al', 'del', 'lo', 'como',
  'mas', 'o', 'si', 'mi', 'tu', 'este', 'esta', 'esto', 'ese', 'esa', 'eso',
  'me', 'te', 'le', 'les', 'nos', 'les', 'yo', 'tengo', 'tiene', 'hola', 'buenas',
  'puedo', 'puede', 'quiero', 'necesito', 'porque', 'pero', 'cuando', 'donde',
  'qué', 'cómo', 'cuándo', 'dónde', 'cuál', 'cuáles', 'sobre', 'ya', 'muy', 'todo',
  'todos', 'nada', 'hay', 'ha', 'he', 'soy', 'sin', 'mas', 'más',
]);

let cachedSections = null;

function stripAccents(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function tokenize(text) {
  const raw = stripAccents(text.toLowerCase()).match(/[a-z0-9]+/g) || [];
  return raw.filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

// Divide el manual en secciones usando los títulos "## " como separador.
function parseSections(rawText) {
  const lines = rawText.split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)/);
    if (heading) {
      current = { title: heading[1].trim(), bodyLines: [] };
      sections.push(current);
    } else if (current) {
      current.bodyLines.push(line);
    }
  }

  return sections.map((section) => ({
    title: section.title,
    content: `${section.title}\n${section.bodyLines.join('\n')}`.trim(),
  }));
}

function loadSections() {
  if (!cachedSections) {
    const rawText = fs.readFileSync(DOC_PATH, 'utf-8');
    cachedSections = parseSections(rawText).map((section) => ({
      ...section,
      tokens: new Set(tokenize(section.content)),
    }));
  }
  return cachedSections;
}

function scoreSection(queryTokens, sectionTokens) {
  let overlap = 0;
  for (const token of queryTokens) {
    if (sectionTokens.has(token)) overlap += 1;
  }
  return overlap;
}

/**
 * Busca las secciones del manual más relevantes para el mensaje del usuario
 * usando solapamiento de palabras clave (sin stopwords). No es semántico,
 * pero para un manual corto y bien titulado es suficiente como primer filtro.
 */
function findRelevantSections(message, { maxSections = 2, minScore = 1 } = {}) {
  const queryTokens = tokenize(message);
  if (queryTokens.length === 0) {
    return { sections: [], found: false };
  }

  const scored = loadSections()
    .map((section) => ({
      title: section.title,
      content: section.content,
      score: scoreSection(queryTokens, section.tokens),
    }))
    .filter((section) => section.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSections);

  return { sections: scored, found: scored.length > 0 };
}

module.exports = { findRelevantSections };
