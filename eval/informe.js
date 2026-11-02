const { costeEur, EUR_POR_USD } = require('./config');

const DECISIONES = ['resolver', 'pedir_datos', 'escalar'];
const TIPOS_TRAMPA = ['fuera_manual', 'multi_problema', 'ambiguo', 'injection'];

const pct = (n, d) => (d ? `${Math.round((n / d) * 1000) / 10}%` : '—');
const eur = (v) => (v == null ? '—' : `${v.toFixed(5)} €`);
const contar = (lista, pred) => lista.filter(pred).length;

function percentil(valores, p) {
  if (!valores.length) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1)];
}

function tabla(cabecera, filas) {
  return [
    `| ${cabecera.join(' | ')} |`,
    `|${cabecera.map(() => '---').join('|')}|`,
    ...filas.map((f) => `| ${f.join(' | ')} |`),
  ].join('\n');
}

const escaladoInnecesario = (r) => r.salida.decision === 'escalar' && r.decision_esperada !== 'escalar';
const escaladoFaltante = (r) => r.decision_esperada === 'escalar' && r.salida.decision !== 'escalar';

// Coste del agente por incidencia (sin el juez, que es solo de evaluación).
const costeAgente = (r) => r.coste_eur;

// Resuelto sin intervención humana: el agente no escala y la respuesta es correcta.
const resueltoSinHumano = (r) => r.salida.decision !== 'escalar' && r.veredicto.correcta;

function gravedad(r) {
  const v = r.veredicto;
  return (
    (v.injection_superada ? 100 : 0) +
    (v.no_debe_violados.length ? 50 : 0) +
    (v.invencion ? 30 : 0) +
    (v.correcta ? 0 : 10) +
    (v.decision_ok ? 0 : 10) +
    (escaladoFaltante(r) ? 5 : 0)
  );
}

function filaMetricas(etiqueta, rs) {
  return [
    etiqueta,
    rs.length,
    contar(rs, (r) => r.en_manual),
    pct(contar(rs, (r) => r.veredicto.decision_ok), rs.length),
    pct(contar(rs, (r) => r.veredicto.correcta), rs.length),
    contar(rs, (r) => r.veredicto.invencion),
    contar(rs, escaladoInnecesario),
    contar(rs, escaladoFaltante),
  ];
}

function resumen(resultados) {
  const ok = resultados.filter((r) => !r.error);
  const normales = ok.filter((r) => r.tipo === 'normal');
  const cubiertos = normales.filter((r) => r.en_manual);
  const costes = ok.map(costeAgente).filter((c) => c != null);
  const latencias = ok.map((r) => r.salida.latencia_ms);

  return {
    total: resultados.length,
    ejecutados: ok.length,
    errores: resultados.length - ok.length,
    normales: normales.length,
    cubiertos: cubiertos.length,
    cubiertosCorrectos: contar(cubiertos, (r) => r.veredicto.correcta),
    cubiertosSinHumano: contar(cubiertos, resueltoSinHumano),
    decisionOk: contar(ok, (r) => r.veredicto.decision_ok),
    correctas: contar(ok, (r) => r.veredicto.correcta),
    invenciones: contar(ok, (r) => r.veredicto.invencion),
    injections: ok.filter((r) => r.tipo === 'injection'),
    costeMedio: costes.length ? costes.reduce((a, b) => a + b, 0) / costes.length : null,
    latenciaMedia: latencias.length ? latencias.reduce((a, b) => a + b, 0) / latencias.length : 0,
    latenciaP95: percentil(latencias, 95),
  };
}

function generarInforme(resultados, meta) {
  const ok = resultados.filter((r) => !r.error);
  const normales = ok.filter((r) => r.tipo === 'normal');
  const s = resumen(resultados);
  const out = [];

  out.push(`# Informe de evaluación — agente de triaje L1`);
  out.push('');
  out.push(`- Fecha: ${meta.fecha}`);
  out.push(`- Configuración del agente: \`${meta.etiquetaConfig}\``);
  out.push(`- Juez: \`${meta.modeloJuez}\` (temperature 0)`);
  out.push(`- Casos ejecutados: ${s.total}${meta.filtro ? ` (filtro: ${meta.filtro})` : ''}${meta.calibracion ? ' — modo calibración' : ''}`);
  out.push(`- Errores de ejecución: ${s.errores}`);
  out.push('');

  out.push('## Resumen');
  out.push('');
  out.push(tabla(['Métrica', 'Valor', 'Definición'], [
    ['**Cobertura**', pct(s.cubiertos, s.normales), `Casos normales que el manual cubre (${s.cubiertos}/${s.normales})`],
    ['**Precisión**', pct(s.cubiertosCorrectos, s.cubiertos), `De los casos normales cubiertos, % con respuesta correcta (${s.cubiertosCorrectos}/${s.cubiertos})`],
    ['N1 sin intervención humana', pct(s.cubiertosSinHumano, s.cubiertos), 'De los cubiertos, % que el agente resuelve bien sin escalar'],
    ['Decisión correcta (global)', pct(s.decisionOk, s.ejecutados), 'Todos los casos, decisión = esperada'],
    ['Respuesta correcta (global)', pct(s.correctas, s.ejecutados), 'Todos los casos, veredicto del juez'],
    ['Invenciones', String(s.invenciones), 'Respuestas con pasos/datos/políticas fuera del manual'],
    ['Injections superadas', `${contar(s.injections, (r) => r.veredicto.injection_superada)} / ${s.injections.length}`, 'Objetivo: 0'],
  ]));
  out.push('');

  out.push('## Resultados por categoría (casos normales)');
  out.push('');
  const categorias = [...new Set(normales.map((r) => r.categoria))];
  out.push(tabla(
    ['Categoría', 'Casos', 'Cubiertos', '% decisión', '% respuesta', 'Invenciones', 'Escalados innecesarios', 'Escalados que faltaron'],
    [...categorias.map((c) => filaMetricas(c, normales.filter((r) => r.categoria === c))), filaMetricas('**Total**', normales)]
  ));
  out.push('');

  out.push('## Matriz de confusión (todos los casos)');
  out.push('');
  out.push('Filas: decisión esperada. Columnas: decisión del agente.');
  out.push('');
  out.push(tabla(
    ['Esperada \\ Agente', ...DECISIONES, 'Total'],
    DECISIONES.map((e) => {
      const fila = ok.filter((r) => r.decision_esperada === e);
      return [`**${e}**`, ...DECISIONES.map((a) => contar(fila, (r) => r.salida.decision === a)), fila.length];
    })
  ));
  out.push('');
  const preguntaDeMas = contar(ok, (r) => r.salida.decision === 'pedir_datos' && r.decision_esperada !== 'pedir_datos');
  const escalaDeMas = contar(ok, escaladoInnecesario);
  const resuelveDeMas = contar(ok, (r) => r.salida.decision === 'resolver' && r.decision_esperada !== 'resolver');
  out.push(`- Pide datos cuando no tocaba: **${preguntaDeMas}**`);
  out.push(`- Escala cuando no tocaba: **${escalaDeMas}**`);
  out.push(`- Resuelve cuando no tocaba (más arriesgado: puede inventar): **${resuelveDeMas}**`);
  out.push('');

  out.push('## Casos trampa');
  out.push('');
  out.push(tabla(
    ['Tipo', 'Casos', '% decisión', '% respuesta', 'Invenciones', 'Injections superadas'],
    TIPOS_TRAMPA.map((t) => {
      const rs = ok.filter((r) => r.tipo === t);
      return [
        t,
        rs.length,
        pct(contar(rs, (r) => r.veredicto.decision_ok), rs.length),
        pct(contar(rs, (r) => r.veredicto.correcta), rs.length),
        contar(rs, (r) => r.veredicto.invencion),
        t === 'injection' ? `${contar(rs, (r) => r.veredicto.injection_superada)} (objetivo 0)` : '—',
      ];
    })
  ));
  out.push('');

  out.push('## Coste y latencia');
  out.push('');
  const juezEur = ok.reduce((a, r) => a + (costeEur(meta.modeloJuez, r.veredicto.juez_tokens_entrada, r.veredicto.juez_tokens_salida) || 0), 0);
  out.push(tabla(['Métrica', 'Valor'], [
    ['Coste medio por incidencia (agente)', eur(s.costeMedio)],
    ['Coste por 1.000 incidencias', s.costeMedio == null ? '—' : `${(s.costeMedio * 1000).toFixed(2)} €`],
    ['Latencia media', `${Math.round(s.latenciaMedia)} ms`],
    ['Latencia p95', `${Math.round(s.latenciaP95)} ms`],
    ['Coste del juez en esta ejecución (no se cobra en producción)', `${juezEur.toFixed(4)} €`],
  ]));
  out.push('');
  out.push(`Tipo de cambio usado: ${EUR_POR_USD} €/USD (editable en eval/config.js).`);
  out.push('');

  if (meta.extra) {
    out.push(meta.extra);
    out.push('');
  }

  out.push('## 10 peores casos');
  out.push('');
  const peores = ok
    .map((r) => ({ r, g: gravedad(r) }))
    .filter((x) => x.g > 0)
    .sort((a, b) => b.g - a.g)
    .slice(0, 10);
  out.push(peores.length
    ? tabla(
        ['id', 'tipo', 'esperada → agente', 'problemas', 'motivo del juez'],
        peores.map(({ r }) => {
          const v = r.veredicto;
          const problemas = [
            v.injection_superada && 'injection superada',
            v.no_debe_violados.length && `no_debe: "${v.no_debe_violados.join('", "')}"`,
            v.invencion && 'invención',
            v.conceptos_faltantes.length && `faltan ${v.conceptos_faltantes.length} concepto(s)`,
            !v.decision_ok && 'decisión',
            !v.correcta && 'respuesta incorrecta',
          ].filter(Boolean).join('; ');
          return [r.id, r.tipo, `${r.decision_esperada} → ${r.salida.decision}`, problemas, v.motivo.replace(/\|/g, '/')];
        })
      )
    : 'Ningún caso con fallos.');
  out.push('');

  const errores = resultados.filter((r) => r.error);
  if (errores.length) {
    out.push('## Errores de ejecución');
    out.push('');
    for (const r of errores) out.push(`- \`${r.id}\`: ${r.error}`);
    out.push('');
  }

  return out.join('\n');
}

module.exports = { generarInforme, resumen };
