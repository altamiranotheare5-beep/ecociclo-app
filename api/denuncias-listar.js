// ===========================================
// Esta función DEVUELVE todas las denuncias que se han
// guardado hasta ahora, para mostrarlas en la lista de la app.
// ===========================================

const URL_BASE_DATOS =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
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
    // LRANGE nombre 0 -1 significa "dame TODOS los elementos de
    // esa lista, desde el primero (0) hasta el último (-1)"
    const url = URL_BASE_DATOS + "/lrange/denuncias/0/-1";

    const respuesta = await fetch(url, {
      headers: { Authorization: "Bearer " + TOKEN_BASE_DATOS },
    });

    if (!respuesta.ok) {
      throw new Error("La base de datos respondió con estado " + respuesta.status);
    }

    const datos = await respuesta.json();

    // Cada elemento viene guardado como texto (JSON.stringify),
    // así que lo "desempacamos" de vuelta a objetos normales
    const denuncias = (datos.result || []).map(function (textoGuardado) {
      return JSON.parse(textoGuardado);
    });

    // Mostramos las más nuevas primero
    denuncias.reverse();

    return res.status(200).json({ denuncias: denuncias });
  } catch (error) {
    return res.status(502).json({
      error: "No se pudieron cargar las denuncias",
      detalle: error.message,
    });
  }
}
