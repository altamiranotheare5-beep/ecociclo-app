// ===========================================
// Esta función es el equivalente en Vercel a la que ya
// conocías de Netlify — mismo trabajo, "dialecto" distinto.
// Vercel detecta automáticamente cualquier archivo dentro de
// la carpeta /api y lo convierte en una dirección web propia:
// este archivo va a vivir en /api/puntos-limpios
// ===========================================

// Varios servidores que hablan el mismo idioma que Overpass. Si
// el primero está lento o caído (les pasa, son gratuitos), probamos
// el siguiente automáticamente — como llamar a otro restaurante si
// el primero no contesta.
const ESPEJOS_OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// FUNCIÓN: hace un fetch, pero se rinde sola si demora más de
// "milisegundos" — así ningún servidor lento nos deja esperando
// para siempre (y nuestra función no se pasa del tiempo que Vercel
// le permite correr)
async function fetchConTiempoLimite(url, opciones, milisegundos) {
  const controlador = new AbortController();
  const aviso = setTimeout(function () {
    controlador.abort();
  }, milisegundos);

  try {
    return await fetch(url, { ...opciones, signal: controlador.signal });
  } finally {
    clearTimeout(aviso);
  }
}

export default async function handler(req, res) {
  // En Vercel, los parámetros de la URL vienen en req.query
  // (en Netlify venían en event.queryStringParameters — mismo
  // concepto, nombre distinto)
  const { lat, lng, radio = "8000" } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({
      error: "Faltan los parámetros lat y lng",
      parametrosRecibidos: req.query,
    });
  }

  const consulta =
    '[out:json][timeout:15];' +
    'node["amenity"="recycling"](around:' + radio + ',' + lat + ',' + lng + ');' +
    'out body;';

  const opcionesFetch = {
    headers: {
      "User-Agent": "EcoCicloApp/1.0 (proyecto educativo de reciclaje, Chile)",
      "Accept": "application/json",
    },
  };

  let ultimoError = null;

  // Probamos cada espejo EN ORDEN. Como esto corre en el servidor
  // (no en el navegador de la persona), no hay ningún candado de
  // CORS que nos limite intentar varias veces.
  for (let i = 0; i < ESPEJOS_OVERPASS.length; i++) {
    const url = ESPEJOS_OVERPASS[i] + "?data=" + encodeURIComponent(consulta);

    try {
      console.log("Probando espejo " + (i + 1) + ": " + ESPEJOS_OVERPASS[i]);

      // 8 segundos de paciencia por cada espejo — así, aunque los
      // 3 estén lentos, no nos pasamos del tiempo máximo que Vercel
      // le da a esta función para responder
      const respuesta = await fetchConTiempoLimite(url, opcionesFetch, 8000);

      if (!respuesta.ok) {
        throw new Error("Respondió con estado " + respuesta.status);
      }

      const datos = await respuesta.json();

      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.status(200).json(datos);
    } catch (error) {
      console.log("Falló " + ESPEJOS_OVERPASS[i] + ": " + error.message);
      ultimoError = error;
      // Seguimos con el próximo espejo del "for"
    }
  }

  // Si llegamos aquí, ningún espejo respondió a tiempo
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(502).json({
    error: "Ningún servidor de Overpass respondió a tiempo",
    detalle: ultimoError ? ultimoError.message : "Error desconocido",
  });
}
