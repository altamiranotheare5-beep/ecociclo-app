// ===========================================
// Esta función RECIBE una denuncia nueva (categoría,
// descripción, ubicación) y la GUARDA en la base de datos
// (Upstash), para que quede ahí permanentemente, visible
// para cualquier persona que después use la app.
// ===========================================

// OJO: dependiendo de cómo se llame la integración que
// conectaste en Vercel, las variables de entorno pueden
// llamarse distinto. Probamos varios nombres posibles,
// para no depender de adivinar el correcto.
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

  // Armamos el "paquete" que vamos a guardar
  const denuncia = {
    categoria: categoria,
    descripcion: descripcion,
    lat: lat || null,
    lng: lng || null,
    fecha: new Date().toISOString(),
  };

  try {
    // RPUSH agrega un elemento AL FINAL de una lista guardada
    // bajo el nombre "denuncias" — si la lista no existe todavía,
    // Upstash la crea sola la primera vez
    const url =
      URL_BASE_DATOS + "/rpush/denuncias/" + encodeURIComponent(JSON.stringify(denuncia));

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
