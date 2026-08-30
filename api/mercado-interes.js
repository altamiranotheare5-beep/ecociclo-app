// ===========================================
// Agrega un mensaje de interés (público) a UNA publicación del
// mercado — así la gente negocia a la vista de todos, sin
// mensajes privados ocultos.
// ===========================================

const URL_BASE_DATOS = (
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || ""
).replace(/\/+$/, "");
const TOKEN_BASE_DATOS =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

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

  const { idPublicacion, autor, texto } = req.body || {};

  if (!idPublicacion || !texto) {
    return res.status(400).json({ error: "Falta el id de la publicación o el mensaje" });
  }

  const headers = { Authorization: "Bearer " + TOKEN_BASE_DATOS };

  try {
    const urlLeer = URL_BASE_DATOS + "/hget/publicaciones_mercado/" + idPublicacion;
    const respuestaLeer = await fetch(urlLeer, { headers: headers });

    if (!respuestaLeer.ok) {
      throw new Error("No se pudo leer la publicación");
    }

    const datosLeer = await respuestaLeer.json();

    if (!datosLeer.result) {
      return res.status(404).json({ error: "Esa publicación no existe" });
    }

    const publicacion = JSON.parse(datosLeer.result);

    if (!publicacion.interesados) {
      publicacion.interesados = [];
    }
    publicacion.interesados.push({
      autor: autor && autor.trim() !== "" ? autor.trim() : "Ecoamig@ anónimo",
      texto: texto,
      fecha: new Date().toISOString(),
    });

    const urlEscribir =
      URL_BASE_DATOS +
      "/hset/publicaciones_mercado/" + idPublicacion + "/" + encodeURIComponent(JSON.stringify(publicacion));

    const respuestaEscribir = await fetch(urlEscribir, { headers: headers });

    if (!respuestaEscribir.ok) {
      throw new Error("No se pudo guardar el mensaje");
    }

    return res.status(200).json({ ok: true, interesados: publicacion.interesados });
  } catch (error) {
    return res.status(502).json({
      error: "No se pudo enviar el mensaje",
      detalle: error.message,
    });
  }
}
