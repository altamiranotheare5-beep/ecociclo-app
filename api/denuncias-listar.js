// ===========================================
// Devuelve todas las denuncias guardadas en el "archivador"
// (Hash de Redis).
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

  if (!URL_BASE_DATOS || !TOKEN_BASE_DATOS) {
    return res.status(500).json({
      error: "La base de datos no está conectada todavía (faltan variables de entorno)",
    });
  }

  try {
    // HGETALL trae TODAS las carpetitas del archivador de una vez.
    // La respuesta viene como una lista "aplanada": [id1, valor1,
    // id2, valor2, id3, valor3, ...] — hay que separarla de a pares
    const url = URL_BASE_DATOS + "/hgetall/denuncias";

    const respuesta = await fetch(url, {
      headers: { Authorization: "Bearer " + TOKEN_BASE_DATOS },
    });

    if (!respuesta.ok) {
      const textoError = await respuesta.text();
      throw new Error(
        "La base de datos respondió con estado " + respuesta.status + " → " + textoError
      );
    }

    const datos = await respuesta.json();
    const lista = datos.result || [];

    const denuncias = [];
    // Avanzamos de 2 en 2: la posición par es el ID, la impar
    // (la siguiente) es el contenido guardado
    for (let i = 0; i < lista.length; i += 2) {
      const textoGuardado = lista[i + 1];
      denuncias.push(JSON.parse(textoGuardado));
    }

    // Mostramos las más nuevas primero
    denuncias.sort(function (a, b) {
      return new Date(b.fecha) - new Date(a.fecha);
    });

    return res.status(200).json({ denuncias: denuncias });
  } catch (error) {
    return res.status(502).json({
      error: "No se pudieron cargar las denuncias",
      detalle: error.message,
    });
  }
}

