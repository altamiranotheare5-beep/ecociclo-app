// ===========================================
// Esta función busca puntos de reciclaje reales usando Overpass
// (la base de datos de OpenStreetMap).
//
// CAMBIO IMPORTANTE: antes probábamos cada "espejo" (copia) de
// Overpass uno detrás del otro — si el primero fallaba, recién
// ahí probábamos el segundo, y así. El problema es que sumando
// la espera de cada intento, nos pasábamos del tiempo máximo que
// Vercel le da a una función para responder, y la mataba a mitad
// de camino.
//
// Ahora los probamos TODOS A LA VEZ (en paralelo) y nos quedamos
// con el primero que responda bien — como llamar a 4 restaurantes
// al mismo tiempo en vez de uno por uno, y quedarte con el primero
// que te conteste.
// ===========================================

// Le damos hasta 45 segundos a esta función completa (el máximo
// que permite el plan gratuito de Vercel), para tener margen de
// sobra aunque algún espejo esté lento.
export const config = {
  maxDuration: 45,
};

const ESPEJOS_OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// FUNCIÓN: hace un fetch, pero se rinde sola si demora más de
// "milisegundos" — así ningún servidor lento nos deja esperando
// para siempre
async function fetchConTiempoLimite(url, opciones, milisegundos) {
  const controlador = new AbortController();
  const aviso = setTimeout(function () {
    controlador.abort();
  }, milisegundos);

  try {
    const respuesta = await fetch(url, { ...opciones, signal: controlador.signal });
    if (!respuesta.ok) {
      throw new Error("Respondió con estado " + respuesta.status);
    }
    return await respuesta.json();
  } finally {
    clearTimeout(aviso);
  }
}

export default async function handler(req, res) {
  const { lat, lng, radio = "8000" } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({
      error: "Faltan los parámetros lat y lng",
      parametrosRecibidos: req.query,
    });
  }

  const consulta =
    '[out:json][timeout:25];' +
    'node["amenity"="recycling"](around:' + radio + ',' + lat + ',' + lng + ');' +
    'out body;';

  const opcionesFetch = {
    headers: {
      "User-Agent": "EcoCicloApp/1.0 (proyecto educativo de reciclaje, Chile)",
      "Accept": "application/json",
    },
  };

  // Armamos UNA promesa por cada espejo (todas empiezan a correr
  // AL MISMO TIEMPO apenas se crean, no esperan su turno)
  const intentos = ESPEJOS_OVERPASS.map(function (espejo) {
    const url = espejo + "?data=" + encodeURIComponent(consulta);
    return fetchConTiempoLimite(url, opcionesFetch, 20000);
  });

  try {
    // Promise.any espera a que UNA CUALQUIERA de las promesas
    // funcione, y usa esa — ignora las que van fallando, y solo
    // se rinde si TODAS fallan
    const datos = await Promise.any(intentos);

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(datos);
  } catch (error) {
    // Cuando TODAS las promesas fallan, Promise.any junta todos
    // los errores dentro de error.errors — los resumimos para
    // poder diagnosticar sin adivinar
    const detalleErrores = (error.errors || [error])
      .map(function (e) {
        return e.message;
      })
      .join(" | ");

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(502).json({
      error: "Ningún servidor de Overpass respondió a tiempo",
      detalle: detalleErrores,
    });
  }
}
