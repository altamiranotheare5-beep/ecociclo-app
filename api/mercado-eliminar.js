// ===========================================
// Elimina una publicación del mercado — PERO SOLO si quien lo
// pide manda la "llave secreta" exacta que se generó cuando esa
// publicación se creó. Sin la llave correcta, no se borra nada.
// ===========================================

const URL_BASE_DATOS = (
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || ""
).replace(/\/+$/, "");
const TOKEN_BASE_DATOS =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};

async function comandoUpstash(comando) {
  return fetch(URL_BASE_DATOS, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + TOKEN_BASE_DATOS,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(comando),
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Este endpoint solo acepta POST" });
  }

  if (!URL_BASE_DATOS || !TOKEN_BASE_DATOS) {
    return res.status(500).json({
      error: "La base de datos no está conectada todavía (faltan variables de entorno)",
    });
  }

  const { idPublicacion, claveEdicion } = req.body || {};

  if (!idPublicacion || !claveEdicion) {
    return res.status(400).json({ error: "Falta el id de la publicación o la llave de edición" });
  }

  try {
    // 1. Leemos la publicación para comparar la llave
    const respuestaLeer = await comandoUpstash(["HGET", "publicaciones_mercado", idPublicacion]);

    if (!respuestaLeer.ok) {
      throw new Error("No se pudo leer la publicación");
    }

    const datosLeer = await respuestaLeer.json();

    if (!datosLeer.result) {
      // Si ya no existe, para el usuario da lo mismo: igual queda
      // eliminada, así que respondemos éxito
      return res.status(200).json({ ok: true, yaNoExistia: true });
    }

    const publicacion = JSON.parse(datosLeer.result);

    // 2. Comparamos la llave secreta. Si no coincide, avisamos
    // con un error 403 ("prohibido") en vez de borrar
    if (publicacion.claveEdicion !== claveEdicion) {
      return res.status(403).json({ error: "No tienes permiso para eliminar esta publicación" });
    }

    // 3. Recién aquí, con la llave correcta confirmada, borramos
    const respuestaBorrar = await comandoUpstash(["HDEL", "publicaciones_mercado", idPublicacion]);

    if (!respuestaBorrar.ok) {
      throw new Error("No se pudo eliminar la publicación");
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(502).json({
      error: "No se pudo eliminar la publicación",
      detalle: error.message,
    });
  }
}
