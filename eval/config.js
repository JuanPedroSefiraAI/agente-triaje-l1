// Constantes editables de la evaluación.

// Modelo que usa hoy el agente en producción (src/claudeAgent.js).
const MODELO_PRODUCCION = 'claude-opus-4-8';

// USD por millón de tokens (tarifa API de Anthropic, cacheada a 2026-09-25).
const PRECIOS_USD_POR_MTOK = {
  'claude-opus-5-5': { entrada: 4, salida: 20 },
  'claude-opus-4-8': { entrada: 5, salida: 25 },
  'claude-sonnet-5-5': { entrada: 2, salida: 10 },
  'claude-haiku-4-5': { entrada: 1, salida: 5 },
  'claude-haiku-4-5-20251001': { entrada: 1, salida: 5 },
};

// Tipo de cambio aproximado: actualízalo antes de presentar cifras.
const EUR_POR_USD = 0.92;

function costeEur(modelo, tokensEntrada, tokensSalida) {
  const precio = PRECIOS_USD_POR_MTOK[modelo];
  if (!precio) return null;
  const usd = (tokensEntrada * precio.entrada + tokensSalida * precio.salida) / 1e6;
  return usd * EUR_POR_USD;
}

module.exports = { MODELO_PRODUCCION, PRECIOS_USD_POR_MTOK, EUR_POR_USD, costeEur };
