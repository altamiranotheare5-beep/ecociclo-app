// ===========================================
// Agrega un comentario nuevo a UNA publicación específica.
// Mismo patrón que usamos para sumar voluntarios a una denuncia:
// leemos la publicación completa, le agregamos el comentario a
// su lista interna, y la volvemos a guardar entera.
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
    return res.status(400).json({ error: "Falta el id de la publicación o el texto del comentario" });
  }

  const headers = { Authorization: "Bearer " + TOKEN_BASE_DATOS };

  try {
    // 1. Leemos la publicación tal como está guardada ahora mismo
    const urlLeer = URL_BASE_DATOS + "/hget/publicaciones/" + idPublicacion;
    const respuestaLeer = await fetch(urlLeer, { headers: headers });

    if (!respuestaLeer.ok) {
      throw new Error("No se pudo leer la publicación");
    }

    const datosLeer = await respuestaLeer.json();

    if (!datosLeer.result) {
      return res.status(404).json({ error: "Esa publicación no existe" });
    }

    const publicacion = JSON.parse(datosLeer.result);

    // 2. Le agregamos el comentario nuevo a su lista
    if (!publicacion.comentarios) {
      publicacion.comentarios = [];
    }
    publicacion.comentarios.push({
      autor: autor && autor.trim() !== "" ? autor.trim() : "Ecoamig@ anónimo",
      texto: texto,
      fecha: new Date().toISOString(),
    });

    // 3. Guardamos la publicación actualizada, en el mismo lugar
    const urlEscribir =
      URL_BASE_DATOS +
      "/hset/publicaciones/" + idPublicacion + "/" + encodeURIComponent(JSON.stringify(publicacion));

    const respuestaEscribir = await fetch(urlEscribir, { headers: headers });

    if (!respuestaEscribir.ok) {
      throw new Error("No se pudo guardar el comentario");
    }

    return res.status(200).json({ ok: true, comentarios: publicacion.comentarios });
  } catch (error) {
    return res.status(502).json({
      error: "No se pudo agregar el comentario",
      detalle: error.message,
    });
  }
}
