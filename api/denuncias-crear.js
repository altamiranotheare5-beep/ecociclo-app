// ===========================================
// Guarda una denuncia nueva. Ahora usamos un "Hash" de Redis
// (piensa en él como un archivador con carpetas: cada denuncia
// tiene su propia carpetita, identificada por un ID único) en
// vez de solo una lista — así después SÍ podemos abrir una
// denuncia específica y actualizarla (por ejemplo, sumarle un
// voluntario), cosa que con una lista simple era muy difícil.
// ===========================================

const URL_BASE_DATOS =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
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

  const { categoria, descripcion, lat, lng } = req.body || {};

  if (!categoria || !descripcion) {
    return res.status(400).json({ error: "Faltan categoría o descripción" });
  }

  // Creamos un ID único combinando la fecha exacta (en
  // milisegundos) con un número al azar, para que nunca se
  // repita entre dos denuncias
  const id = Date.now() + "-" + Math.random().toString(36).slice(2, 8);

  const denuncia = {
    id: id,
    categoria: categoria,
    descripcion: descripcion,
    lat: lat || null,
    lng: lng || null,
    fecha: new Date().toISOString(),
    voluntarios: 0,
  };

  try {
    // HSET nombreArchivador carpetaID contenido
    const url =
      URL_BASE_DATOS +
      "/hset/denuncias/" + id + "/" + encodeURIComponent(JSON.stringify(denuncia));

    const respuesta = await fetch(url, {
      headers: { Authorization: "Bearer " + TOKEN_BASE_DATOS },
    });

    if (!respuesta.ok) {
      throw new Error("La base de datos respondió con estado " + respuesta.status);
    }

    return res.status(200).json({ ok: true, denuncia: denuncia });
  } catch (error) {
    return res.status(502).json({
      error: "No se pudo guardar la denuncia",
      detalle: error.message,
    });
  }
}

