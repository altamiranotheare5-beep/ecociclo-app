// ===========================================
// Guarda una publicación nueva de la comunidad (texto +
// opcionalmente un video de YouTube), usando el mismo tipo de
// "archivador" (Hash de Redis) que ya usamos para denuncias.
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

  const { autor, texto, idVideoYoutube } = req.body || {};

  if (!texto) {
    return res.status(400).json({ error: "Falta el texto de la publicación" });
  }

  const id = Date.now() + "-" + Math.random().toString(36).slice(2, 8);

  const publicacion = {
    id: id,
    autor: autor && autor.trim() !== "" ? autor.trim() : "Ecoamig@ anónimo",
    texto: texto,
    idVideoYoutube: idVideoYoutube || null,
    fecha: new Date().toISOString(),
    comentarios: [], // arranca sin comentarios; se van agregando después
  };

  try {
    const url =
      URL_BASE_DATOS +
      "/hset/publicaciones/" + id + "/" + encodeURIComponent(JSON.stringify(publicacion));

    const respuesta = await fetch(url, {
      headers: { Authorization: "Bearer " + TOKEN_BASE_DATOS },
    });

    if (!respuesta.ok) {
      const textoError = await respuesta.text();
      throw new Error("La base de datos respondió con estado " + respuesta.status + " → " + textoError);
    }

    return res.status(200).json({ ok: true, publicacion: publicacion });
  } catch (error) {
    return res.status(502).json({
      error: "No se pudo guardar la publicación",
      detalle: error.message,
    });
  }
}
