// ===========================================
// Devuelve todas las publicaciones del mercado, más nuevas primero.
// ===========================================

const URL_BASE_DATOS = (
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || ""
).replace(/\/+$/, "");
const TOKEN_BASE_DATOS =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (!URL_BASE_DATOS || !TOKEN_BASE_DATOS) {
    return res.status(500).json({
      error: "La base de datos no está conectada todavía (faltan variables de entorno)",
    });
  }

  try {
    const url = URL_BASE_DATOS + "/hgetall/publicaciones_mercado";

    const respuesta = await fetch(url, {
      headers: { Authorization: "Bearer " + TOKEN_BASE_DATOS },
    });

    if (!respuesta.ok) {
      const textoError = await respuesta.text();
      throw new Error("La base de datos respondió con estado " + respuesta.status + " → " + textoError);
    }

    const datos = await respuesta.json();
    const lista = datos.result || [];

    const publicaciones = [];
    for (let i = 0; i < lista.length; i += 2) {
      const publicacion = JSON.parse(lista[i + 1]);

      // MUY IMPORTANTE: le quitamos la "llave secreta" antes de
      // devolver la publicación — esto es lo que la mantiene
      // secreta de verdad. Si la dejáramos, cualquier persona
      // podría copiarla desde la app y borrar publicaciones ajenas.
      delete publicacion.claveEdicion;

      publicaciones.push(publicacion);
    }

    publicaciones.sort(function (a, b) {
      return new Date(b.fecha) - new Date(a.fecha);
    });

    return res.status(200).json({ publicaciones: publicaciones });
  } catch (error) {
    return res.status(502).json({
      error: "No se pudieron cargar las publicaciones",
      detalle: error.message,
    });
  }
}
