// ===========================================
// ESTE ARCHIVO NO CORRE EN EL NAVEGADOR DEL USUARIO.
// Corre en un servidor de Netlify, "detrás de escena".
// Por eso puede hablar con Overpass sin chocar con CORS:
// CORS es una regla que protege al NAVEGADOR, no a los
// servidores que hablan entre ellos.
// ===========================================

exports.handler = async function (event) {
  // Leemos la latitud, longitud y radio que la app nos mande
  // como parámetros en la URL, ej: ?lat=-33.4&lng=-70.6&radio=8000
  const parametros = event.queryStringParameters || {};
  const lat = parametros.lat;
  const lng = parametros.lng;
  const radio = parametros.radio || "8000";

  // Si faltan datos, avisamos con un error claro en vez de
  // dejar que la función truene sin explicación. Además,
  // le devolvemos exactamente qué parámetros SÍ recibió, para
  // poder diagnosticar de inmediato si el problema fue que el
  // navegador no los mandó, o que se llamaron distinto.
  if (!lat || !lng) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: "Faltan los parámetros lat y lng",
        parametrosRecibidos: parametros,
        urlCompleta: event.rawUrl || event.path,
      }),
    };
  }

  // La misma consulta de Overpass QL que ya conocíamos
  const consulta =
    '[out:json][timeout:20];' +
    'node["amenity"="recycling"](around:' + radio + ',' + lat + ',' + lng + ');' +
    'out body;';

  const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(consulta);

  try {
    // Este fetch ocurre SERVIDOR-a-SERVIDOR: Netlify hablando
    // directo con Overpass, sin navegador de por medio, así que
    // el candado de CORS ni siquiera aplica aquí.
    const respuesta = await fetch(url);

    if (!respuesta.ok) {
      throw new Error("Overpass respondió con estado " + respuesta.status);
    }

    const datos = await respuesta.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        // Este SÍ es el permiso de CORS, pero ahora lo damos
        // NOSOTROS (nuestro propio servidor) hacia nuestra propia
        // app — así que sí lo controlamos y sí lo autorizamos.
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(datos),
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "No se pudo conectar con Overpass", detalle: error.message }),
    };
  }
};
