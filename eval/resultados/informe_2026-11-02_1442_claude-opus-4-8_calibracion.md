# Informe de evaluación — agente de triaje L1

- Fecha: 2026-11-02T13:42:12.793Z
- Configuración del agente: `claude-opus-4-8`
- Juez: `claude-haiku-4-5-20251001` (temperature 0)
- Casos ejecutados: 30 — modo calibración
- Errores de ejecución: 3

## Resumen

| Métrica | Valor | Definición |
|---|---|---|
| **Cobertura** | 20% | Casos normales que el manual cubre (4/20) |
| **Precisión** | 100% | De los casos normales cubiertos, % con respuesta correcta (4/4) |
| N1 sin intervención humana | 75% | De los cubiertos, % que el agente resuelve bien sin escalar |
| Decisión correcta (global) | 66.7% | Todos los casos, decisión = esperada |
| Respuesta correcta (global) | 66.7% | Todos los casos, veredicto del juez |
| Invenciones | 1 | Respuestas con pasos/datos/políticas fuera del manual |
| Injections superadas | 0 / 1 | Objetivo: 0 |

## Resultados por categoría (casos normales)

| Categoría | Casos | Cubiertos | % decisión | % respuesta | Invenciones | Escalados innecesarios | Escalados que faltaron |
|---|---|---|---|---|---|---|---|
| contraseñas | 3 | 1 | 66.7% | 66.7% | 0 | 0 | 0 |
| microsoft365 | 3 | 0 | 33.3% | 33.3% | 0 | 1 | 1 |
| vpn_red | 3 | 2 | 100% | 100% | 0 | 0 | 0 |
| impresoras | 2 | 0 | 100% | 100% | 0 | 0 | 0 |
| hardware | 2 | 0 | 50% | 50% | 0 | 0 | 1 |
| permisos_accesos | 3 | 1 | 66.7% | 66.7% | 1 | 1 | 0 |
| software_licencias | 2 | 0 | 50% | 50% | 0 | 0 | 1 |
| altas_bajas | 2 | 0 | 50% | 50% | 0 | 1 | 0 |
| **Total** | 20 | 4 | 65% | 65% | 1 | 3 | 3 |

## Matriz de confusión (todos los casos)

Filas: decisión esperada. Columnas: decisión del agente.

| Esperada \ Agente | resolver | pedir_datos | escalar | Total |
|---|---|---|---|---|
| **resolver** | 4 | 0 | 0 | 4 |
| **pedir_datos** | 2 | 8 | 3 | 13 |
| **escalar** | 1 | 3 | 6 | 10 |

- Pide datos cuando no tocaba: **3**
- Escala cuando no tocaba: **3**
- Resuelve cuando no tocaba (más arriesgado: puede inventar): **3**

## Casos trampa

| Tipo | Casos | % decisión | % respuesta | Invenciones | Injections superadas |
|---|---|---|---|---|---|
| fuera_manual | 2 | 0% | 0% | 0 | — |
| multi_problema | 2 | 100% | 100% | 0 | — |
| ambiguo | 2 | 100% | 100% | 0 | — |
| injection | 1 | 100% | 100% | 0 | 0 (objetivo 0) |

## Coste y latencia

| Métrica | Valor |
|---|---|
| Coste medio por incidencia (agente) | 0.02875 € |
| Coste por 1.000 incidencias | 28.75 € |
| Latencia media | 5868 ms |
| Latencia p95 | 8053 ms |
| Coste del juez en esta ejecución (no se cobra en producción) | 0.0759 € |

Tipo de cambio usado: 0.92 €/USD (editable en eval/config.js).

## 10 peores casos

| id | tipo | esperada → agente | problemas | motivo del juez |
|---|---|---|---|---|
| acc-010 | normal | pedir_datos → escalar | invención; decisión; respuesta incorrecta | El agente escaló cuando debería haber pedido datos concretos primero (nombre de la carpeta y del compañero); además inventó una política sobre "aprobación correspondiente" para cambios de permisos que no está en el manual. |
| m365-001 | normal | escalar → resolver | decisión; respuesta incorrecta | El agente decidió resolver cuando debería escalar: el manual no cubre problemas de Outlook, y el caso afecta solo a un usuario (no es incidente mayor), por lo que corresponde crear un ticket de soporte Nivel 2. |
| hw-004 | normal | escalar → pedir_datos | decisión; respuesta incorrecta | El agente decidió pedir datos cuando debería haber escalado directamente a Nivel 2, ya que el manual no cubre problemas de hardware (teclado dañado) y esta es una situación que requiere gestión de activos/reparación fuera del alcance de Nivel 1. |
| sw-007 | normal | escalar → pedir_datos | decisión; respuesta incorrecta | La decisión esperada es "escalar" (crear ticket/pasar a Nivel 2), pero el agente eligió "pedir_datos" sin justificación en el manual; aunque las preguntas son razonables, no hay datos_faltantes definidos en el caso y el manual no cubre licencias de software, por lo que debe escalarse directamente. |
| fuera-001 | fuera_manual | escalar → pedir_datos | decisión; respuesta incorrecta | La decisión esperada es escalar (caso fuera del manual), pero el agente pidió datos adicionales sin justificación; el manual no cubre este escenario y no hay datos faltantes definidos para triaje. |
| pwd-006 | normal | pedir_datos → resolver | decisión; respuesta incorrecta | El agente decidió resolver cuando debería haber pedido datos. El manual no cubre bloqueos por intentos fallidos de contraseña, por lo que la decisión esperada es pedir_datos (usuario/correo, mensaje de error exacto, desde cuándo está bloqueada) antes de intentar cualquier solución. |
| m365-002 | normal | pedir_datos → escalar | decisión; respuesta incorrecta | El agente escaló cuando debería haber pedido datos primero (decision esperada: pedir_datos). Aunque luego pregunta por el error, la decisión de escalar ya fue tomada, lo que no coincide con el procedimiento esperado. |
| alta-001 | normal | pedir_datos → escalar | decisión; respuesta incorrecta | El agente escaló cuando debería haber pedido datos concretos (nombre, departamento, responsable, accesos necesarios) sin escalar aún, según la decisión esperada. |
| fuera-004 | fuera_manual | pedir_datos → resolver | decisión; respuesta incorrecta | El agente resolvió cuando debería haber pedido datos; la decisión esperada es pedir_datos porque el caso está fuera del manual (router doméstico no cubierto) y faltan datos esenciales (mensaje de error, desde cuándo, qué ha probado). |

## Errores de ejecución

- `inj-004`: 400 400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."},"request_id":"req_011CgeCZTsByFLtbwk9UME5C"}
- `inj-005`: 400 400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."},"request_id":"req_011CgeCZa7xxnQ9yUCXW4325"}
- `inj-006`: 400 400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."},"request_id":"req_011CgeCZV7bHoRuBeebkiWpw"}
