// ===========================================
// Esta función busca puntos de reciclaje reales usando Overpass
// (la base de datos de OpenStreetMap).
//
// HISTORIAL DE CAMBIOS:
// 1° versión: probaba los espejos uno por uno — muy lento.
// 2° versión: probaba los 4 a la vez y usaba el PRIMERO que
//    respondiera — rápido, pero con un bug: si el más rápido
//    resultaba tener 0 resultados, nos quedábamos con esa
//    respuesta vacía sin revisar si los otros 3 sí tenían datos.
// 3° versión (esta): sigue preguntando a los 4 a la vez, pero
//    ahora ESPERA a que todos terminen (o se rindan) y JUNTA los
//    resultados de todos los que sí respondieron bien — como
//    preguntarle a 4 vecinos dónde queda el punto limpio más
//    cercano, y armar una sola lista completa con lo que cada uno
//    supo, en vez de quedarte solo con la respuesta del primero
//    que te contestó el teléfono.
// ===========================================

export const config = {
  maxDuration: 45,
};

const ESPEJOS_OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

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

  // Le pedimos a los 4 espejos a la vez, con un límite de tiempo
  // más corto que antes (8 segundos, no 20) — el plan gratis de
  // Vercel puede cortar la función a la fuerza cerca de los 10
  // segundos sin importar lo que le pidamos en el código, así que
  // preferimos rendirnos nosotros mismos ANTES de esa pared, en
  // vez de que Vercel nos corte a mitad de camino de mala manera
  const intentos = ESPEJOS_OVERPASS.map(function (espejo) {
    const url = espejo + "?data=" + encodeURIComponent(consulta);
    return fetchConTiempoLimite(url, opcionesFetch, 8000);
  });

  const resultados = await Promise.allSettled(intentos);

  const respuestasExitosas = resultados
    .filter(function (r) {
      return r.status === "fulfilled";
    })
    .map(function (r) {
      return r.value;
    });

  if (respuestasExitosas.length === 0) {
    // Ninguno de los 4 espejos contestó bien — ahí sí es un
    // problema real de conexión, no falta de datos
    const detalleErrores = resultados
      .map(function (r) {
        return r.reason ? r.reason.message : "desconocido";
      })
      .join(" | ");

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(502).json({
      error: "Ningún servidor de Overpass respondió a tiempo",
      detalle: detalleErrores,
    });
  }

  // Juntamos los "elements" (los puntos encontrados) de TODAS las
  // respuestas exitosas en una sola lista, sin repetir el mismo
  // punto 2 veces (cada punto de OpenStreetMap tiene un "id" único,
  // así que usamos eso para detectar y descartar duplicados)
  const puntosVistos = new Map();

  respuestasExitosas.forEach(function (datos) {
    (datos.elements || []).forEach(function (punto) {
      puntosVistos.set(punto.id, punto);
    });
  });

  const elementosJuntados = Array.from(puntosVistos.values());

  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(200).json({ elements: elementosJuntados });
}
