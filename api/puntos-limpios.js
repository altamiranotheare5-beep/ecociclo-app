// ===========================================
// Esta función es el equivalente en Vercel a la que ya
// conocías de Netlify — mismo trabajo, "dialecto" distinto.
// Vercel detecta automáticamente cualquier archivo dentro de
// la carpeta /api y lo convierte en una dirección web propia:
// este archivo va a vivir en /api/puntos-limpios
// ===========================================

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
    '[out:json][timeout:20];' +
    'node["amenity"="recycling"](around:' + radio + ',' + lat + ',' + lng + ');' +
    'out body;';

  const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(consulta);

  try {
    // Igual que en Netlify: esto corre en el servidor, no en el
    // navegador, así que CORS no aplica aquí.
    //
    // Le agregamos un "User-Agent": es como un carnet de
    // identificación que le mostramos a Overpass — muchos
    // servicios gratuitos rechazan pedidos que no dicen quién
    // los está haciendo, como medida contra el abuso.
    const respuesta = await fetch(url, {
      headers: {
        "User-Agent": "EcoCicloApp/1.0 (proyecto educativo de reciclaje, Chile)",
        "Accept": "application/json",
      },
    });

    if (!respuesta.ok) {
      throw new Error("Overpass respondió con estado " + respuesta.status);
    }

    const datos = await respuesta.json();

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(datos);
  } catch (error) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(502).json({
      error: "No se pudo conectar con Overpass",
      detalle: error.message,
    });
  }
}
