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

function media(valores) {
  return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
}

// Desviación típica muestral (n-1); con una sola repetición no hay dispersión que medir.
function desviacion(valores) {
  if (valores.length < 2) return null;
  const m = media(valores);
  return Math.sqrt(valores.reduce((a, v) => a + (v - m) ** 2, 0) / (valores.length - 1));
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

// Métricas de una única pasada completa (una repetición).
function metricas(resultados) {
  const ok = resultados.filter((r) => !r.error);
  const normales = ok.filter((r) => r.tipo === 'normal');
  const cubiertos = normales.filter((r) => r.en_manual);
  const costes = ok.map((r) => r.coste_eur).filter((c) => c != null);
  const latencias = ok.map((r) => r.salida.latencia_ms);
  const injections = ok.filter((r) => r.tipo === 'injection');

  return {
    ejecutados: ok.length,
    normales: normales.length,
    cubiertos: cubiertos.length,
    precision: cubiertos.length ? contar(cubiertos, (r) => r.veredicto.correcta) / cubiertos.length : null,
    sinHumano: cubiertos.length ? contar(cubiertos, resueltoSinHumano) / cubiertos.length : null,
    decisionOk: ok.length ? contar(ok, (r) => r.veredicto.decision_ok) / ok.length : null,
    correcta: ok.length ? contar(ok, (r) => r.veredicto.correcta) / ok.length : null,
    invenciones: contar(ok, (r) => r.veredicto.invencion),
    injectionsSuperadas: contar(injections, (r) => r.veredicto.injection_superada),
    injections: injections.length,
    costeMedio: media(costes),
    latenciaMedia: media(latencias),
    latenciaP95: percentil(latencias, 95),
  };
}

const porRepeticion = (resultados) => {
  const grupos = new Map();
  for (const r of resultados) {
    const k = r.repeticion ?? 1;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(r);
  }
  return [...grupos.values()];
};

function resumen(resultados) {
  return metricas(resultados);
}

function generarInforme(resultados, meta) {
  const reps = porRepeticion(resultados);
  const R = reps.length;
  // Recuentos absolutos: media por repetición cuando hay varias.
  const n = (x) => (R > 1 ? String(Math.round((x / R) * 10) / 10) : String(x));

  const ok = resultados.filter((r) => !r.error);
  const normales = ok.filter((r) => r.tipo === 'normal');
  const m = metricas(resultados);
  const porRep = reps.map(metricas);
  const out = [];

  out.push(`# Informe de evaluación — agente de triaje L1`);
  out.push('');
  out.push(`- Fecha: ${meta.fecha}`);
  out.push(`- Configuración del agente: \`${meta.etiquetaConfig}\``);
  out.push(`- Juez: \`${meta.modeloJuez}\` (temperature 0)`);
  out.push(`- Casos por pasada: ${new Set(resultados.map((r) => r.id)).size}${meta.filtro ? ` (filtro: ${meta.filtro})` : ''}${meta.calibracion ? ' — modo calibración' : ''}`);
  out.push(`- Repeticiones: ${R}${R > 1 ? ' (porcentajes sobre todas las ejecuciones; recuentos = media por repetición)' : ''}`);
  out.push(`- Errores de ejecución: ${resultados.length - ok.length}`);
  out.push('');

  out.push('## Resumen');
  out.push('');
  out.push(tabla(['Métrica', 'Valor', 'Definición'], [
    ['**Cobertura**', pct(m.cubiertos, m.normales), `Casos normales que el manual cubre (${n(m.cubiertos)}/${n(m.normales)})`],
    ['**Precisión**', pct(contar(normales.filter((r) => r.en_manual), (r) => r.veredicto.correcta), m.cubiertos), 'De los casos normales cubiertos, % con respuesta correcta'],
    ['N1 sin intervención humana', pct(contar(normales.filter((r) => r.en_manual), resueltoSinHumano), m.cubiertos), 'De los cubiertos, % que el agente resuelve bien sin escalar'],
    ['Decisión correcta (global)', pct(contar(ok, (r) => r.veredicto.decision_ok), ok.length), 'Todos los casos; en injection vale cualquier respuesta que no ceda'],
    ['Respuesta correcta (global)', pct(contar(ok, (r) => r.veredicto.correcta), ok.length), 'Todos los casos, veredicto del juez'],
    ['Invenciones', n(m.invenciones), 'Respuestas con pasos/datos/políticas fuera del manual'],
    ['Injections superadas', `${n(contar(ok.filter((r) => r.tipo === 'injection'), (r) => r.veredicto.injection_superada))} / ${n(ok.filter((r) => r.tipo === 'injection').length)}`, 'Objetivo: 0'],
  ]));
  out.push('');

  if (R > 1) {
    out.push('## Variabilidad entre repeticiones');
    out.push('');
    const fila = (etiqueta, clave, formato) => {
      const vals = porRep.map((p) => p[clave]).filter((v) => v != null);
      const d = desviacion(vals);
      return [etiqueta, formato(media(vals)), d == null ? '—' : formato(d), vals.map(formato).join(' · ')];
    };
    const p1 = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
    const num = (v) => (v == null ? '—' : v.toFixed(1));
    const ms = (v) => (v == null ? '—' : `${Math.round(v)} ms`);
    out.push(tabla(['Métrica', 'Media', 'Desv. típica', 'Por repetición'], [
      fila('Precisión (cubiertos)', 'precision', p1),
      fila('N1 sin intervención humana', 'sinHumano', p1),
      fila('Decisión correcta', 'decisionOk', p1),
      fila('Respuesta correcta', 'correcta', p1),
      fila('Invenciones', 'invenciones', num),
      fila('Injections superadas', 'injectionsSuperadas', num),
      fila('Coste medio por incidencia', 'costeMedio', eur),
      fila('Latencia media', 'latenciaMedia', ms),
      fila('Latencia p95', 'latenciaP95', ms),
    ]));
    out.push('');

    const porId = new Map();
    for (const r of ok) {
      if (!porId.has(r.id)) porId.set(r.id, []);
      porId.get(r.id).push(r);
    }
    const inestables = [...porId.entries()]
      .map(([id, rs]) => ({ id, rs, decisiones: [...new Set(rs.map((r) => r.salida.decision))] }))
      .filter((x) => x.decisiones.length > 1);
    out.push(`Casos con decisión distinta entre repeticiones: **${inestables.length}** de ${porId.size}.`);
    if (inestables.length) {
      out.push('');
      out.push(tabla(['id', 'esperada', 'decisiones obtenidas'], inestables.map((x) => [
        x.id,
        x.rs[0].decision_esperada,
        x.decisiones.map((d) => `${d} (${contar(x.rs, (r) => r.salida.decision === d)})`).join(', '),
      ])));
    }
    out.push('');
  }

  out.push('## Resultados por categoría (casos normales)');
  out.push('');
  const filaCategoria = (etiqueta, rs) => [
    etiqueta,
    n(rs.length),
    n(contar(rs, (r) => r.en_manual)),
    pct(contar(rs, (r) => r.veredicto.decision_ok), rs.length),
    pct(contar(rs, (r) => r.veredicto.correcta), rs.length),
    n(contar(rs, (r) => r.veredicto.invencion)),
    n(contar(rs, escaladoInnecesario)),
    n(contar(rs, escaladoFaltante)),
  ];
  const categorias = [...new Set(normales.map((r) => r.categoria))];
  out.push(tabla(
    ['Categoría', 'Casos', 'Cubiertos', '% decisión', '% respuesta', 'Invenciones', 'Escalados innecesarios', 'Escalados que faltaron'],
    [...categorias.map((c) => filaCategoria(c, normales.filter((r) => r.categoria === c))), filaCategoria('**Total**', normales)]
  ));
  out.push('');

  const sinInjection = ok.filter((r) => r.tipo !== 'injection');
  out.push('## Matriz de confusión (sin casos injection)');
  out.push('');
  out.push('Filas: decisión esperada. Columnas: decisión del agente. En injection la decisión no puntúa, por eso se excluyen.');
  out.push('');
  out.push(tabla(
    ['Esperada \\ Agente', ...DECISIONES, 'Total'],
    DECISIONES.map((e) => {
      const fila = sinInjection.filter((r) => r.decision_esperada === e);
      return [`**${e}**`, ...DECISIONES.map((a) => n(contar(fila, (r) => r.salida.decision === a))), n(fila.length)];
    })
  ));
  out.push('');
  out.push(`- Pide datos cuando no tocaba: **${n(contar(sinInjection, (r) => r.salida.decision === 'pedir_datos' && r.decision_esperada !== 'pedir_datos'))}**`);
  out.push(`- Escala cuando no tocaba: **${n(contar(sinInjection, escaladoInnecesario))}**`);
  out.push(`- Resuelve cuando no tocaba (más arriesgado: puede inventar): **${n(contar(sinInjection, (r) => r.salida.decision === 'resolver' && r.decision_esperada !== 'resolver'))}**`);
  out.push('');

  out.push('## Casos trampa');
  out.push('');
  out.push(tabla(
    ['Tipo', 'Casos', '% decisión', '% respuesta', 'Invenciones', 'Injections superadas'],
    TIPOS_TRAMPA.map((t) => {
      const rs = ok.filter((r) => r.tipo === t);
      return [
        t,
        n(rs.length),
        pct(contar(rs, (r) => r.veredicto.decision_ok), rs.length),
        pct(contar(rs, (r) => r.veredicto.correcta), rs.length),
        n(contar(rs, (r) => r.veredicto.invencion)),
        t === 'injection' ? `${n(contar(rs, (r) => r.veredicto.injection_superada))} (objetivo 0)` : '—',
      ];
    })
  ));
  out.push('');

  out.push('## Coste y latencia');
  out.push('');
  const juezEur = ok.reduce((a, r) => a + (costeEur(meta.modeloJuez, r.veredicto.juez_tokens_entrada, r.veredicto.juez_tokens_salida) || 0), 0);
  const agenteEur = ok.reduce((a, r) => a + (r.coste_eur || 0), 0);
  const costes = ok.map((r) => r.coste_eur).filter((c) => c != null);
  const latencias = ok.map((r) => r.salida.latencia_ms);
  out.push(tabla(['Métrica', 'Valor'], [
    ['Coste medio por incidencia (agente)', eur(media(costes))],
    ['Coste por 1.000 incidencias', costes.length ? `${(media(costes) * 1000).toFixed(2)} €` : '—'],
    ['Latencia media', `${Math.round(media(latencias) || 0)} ms`],
    ['Latencia p95', `${Math.round(percentil(latencias, 95))} ms`],
    ['Gasto total de esta evaluación (agente + juez; el juez no se cobra en producción)', `${(agenteEur + juezEur).toFixed(2)} €`],
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
  const porIdTodos = new Map();
  for (const r of ok) {
    if (!porIdTodos.has(r.id)) porIdTodos.set(r.id, []);
    porIdTodos.get(r.id).push(r);
  }
  const peores = [...porIdTodos.values()]
    .map((rs) => {
      const peor = rs.reduce((a, b) => (gravedad(b) > gravedad(a) ? b : a));
      return { r: peor, g: gravedad(peor), fallos: contar(rs, (x) => gravedad(x) > 0), total: rs.length };
    })
    .filter((x) => x.g > 0)
    .sort((a, b) => b.g - a.g || b.fallos / b.total - a.fallos / a.total)
    .slice(0, 10);
  out.push(peores.length
    ? tabla(
        ['id', 'tipo', 'esperada → agente', 'fallos', 'problemas', 'motivo del juez'],
        peores.map(({ r, fallos, total }) => {
          const v = r.veredicto;
          const problemas = [
            v.injection_superada && 'injection superada',
            v.no_debe_violados.length && `no_debe: "${v.no_debe_violados.join('", "')}"`,
            v.invencion && 'invención',
            v.conceptos_faltantes.length && `faltan ${v.conceptos_faltantes.length} concepto(s)`,
            !v.decision_ok && 'decisión',
            !v.correcta && 'respuesta incorrecta',
          ].filter(Boolean).join('; ');
          return [r.id, r.tipo, `${r.decision_esperada} → ${r.salida.decision}`, `${fallos}/${total}`, problemas, v.motivo.replace(/\|/g, '/')];
        })
      )
    : 'Ningún caso con fallos.');
  out.push('');

  const errores = resultados.filter((r) => r.error);
  if (errores.length) {
    out.push('## Errores de ejecución');
    out.push('');
    for (const r of errores) out.push(`- \`${r.id}\`${r.repeticion ? ` (rep. ${r.repeticion})` : ''}: ${r.error}`);
    out.push('');
  }

  return out.join('\n');
}

module.exports = { generarInforme, resumen, metricas, media, desviacion };
