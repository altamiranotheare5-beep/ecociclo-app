// ===========================================
// Suma +1 al contador de voluntarios de UNA denuncia
// específica (identificada por su ID).
// ===========================================

// El ".replace(...)" le quita cualquier barra "/" que haya quedado
// sobrando al final de la URL — una barra de más ahí puede hacer
// que la dirección final quede mal formada (dos barras seguidas)
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

  const { id } = req.body || {};

  if (!id) {
    return res.status(400).json({ error: "Falta el id de la denuncia" });
  }

  const headers = { Authorization: "Bearer " + TOKEN_BASE_DATOS };

  try {
    // 1. Buscamos esa denuncia específica dentro del archivador
    const urlLeer = URL_BASE_DATOS + "/hget/denuncias/" + id;
    const respuestaLeer = await fetch(urlLeer, { headers: headers });

    if (!respuestaLeer.ok) {
      throw new Error("No se pudo leer la denuncia");
    }

    const datosLeer = await respuestaLeer.json();

    if (!datosLeer.result) {
      return res.status(404).json({ error: "Esa denuncia no existe" });
    }

    const denuncia = JSON.parse(datosLeer.result);

    // 2. Le sumamos 1 al contador
    denuncia.voluntarios = (denuncia.voluntarios || 0) + 1;

    // 3. Guardamos la denuncia actualizada, en el mismo lugar
    const urlEscribir =
      URL_BASE_DATOS +
      "/hset/denuncias/" + id + "/" + encodeURIComponent(JSON.stringify(denuncia));

    const respuestaEscribir = await fetch(urlEscribir, { headers: headers });

    if (!respuestaEscribir.ok) {
      throw new Error("No se pudo actualizar la denuncia");
    }

    return res.status(200).json({ ok: true, voluntarios: denuncia.voluntarios });
  } catch (error) {
    return res.status(502).json({
      error: "No se pudo sumar el voluntario",
      detalle: error.message,
    });
  }
}

