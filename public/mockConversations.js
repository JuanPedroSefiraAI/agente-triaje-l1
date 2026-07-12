// Datos de demostración (mock) para el Dashboard de Administrador.
// No provienen de conversaciones reales ni del backend/RAG del agente.

const MOCK_CONVERSATIONS = [
  {
    id: 1,
    user: 'Marta G. - Contabilidad',
    summary: 'No puede acceder a la carpeta compartida de Facturas 2026; lleva 2 días esperando la aprobación de su responsable.',
    urgency: 'Media',
    status: 'En curso',
    time: 'hace 8 min',
  },
  {
    id: 2,
    user: 'Carlos R. - Logística (Oficina Valencia)',
    summary: 'Reporta caída total de internet en toda la oficina; ya son 4 compañeros afectados simultáneamente.',
    urgency: 'Alta',
    status: 'Escalado a Nivel 2',
    time: 'hace 3 min',
  },
  {
    id: 3,
    user: 'Laura P. - RRHH',
    summary: 'Olvidó su contraseña corporativa y necesita restablecerla antes de una reunión.',
    urgency: 'Baja',
    status: 'Resuelto por IA',
    time: 'hace 12 min',
  },
  {
    id: 4,
    user: 'Javier M. - Ventas',
    summary: 'La VPN (GlobalProtect) no conecta; certificado caducado detectado y redirigido al portal de certificados.',
    urgency: 'Media',
    status: 'Resuelto por IA',
    time: 'hace 25 min',
  },
  {
    id: 5,
    user: 'Sofía T. - Marketing',
    summary: 'Sin conexión a internet junto a todo su equipo; el panel de estado confirma una incidencia general del proveedor.',
    urgency: 'Alta',
    status: 'Escalado a Nivel 2',
    time: 'hace 1 min',
  },
  {
    id: 6,
    user: 'Diego F. - Proyectos Cliente X',
    summary: 'Solicita acceso a la carpeta compartida del proyecto; ya cuenta con la aprobación de su responsable directo.',
    urgency: 'Baja',
    status: 'Resuelto por IA',
    time: 'hace 45 min',
  },
  {
    id: 7,
    user: 'Elena V. - Dirección',
    summary: 'No recibe el SMS de verificación para resetear su contraseña; posible número desactualizado en RRHH.',
    urgency: 'Media',
    status: 'Escalado a Nivel 2',
    time: 'hace 18 min',
  },
  {
    id: 8,
    user: 'Pablo S. - Almacén',
    summary: 'VPN caída: no puede acceder al sistema de inventario antes del cierre de turno.',
    urgency: 'Media',
    status: 'En curso',
    time: 'hace 6 min',
  },
];
