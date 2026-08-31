// ===========================================
// Reemplaza a comunidad-crear.js, comunidad-listar.js y
// comunidad-comentar.js, juntas en un solo archivo — misma razón
// que denuncias.js: el límite de 12 funciones de Vercel.
// Se usa con /api/comunidad?accion=crear, ?accion=listar o
// ?accion=comentar
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

  const accion = req.query.accion;

  if (accion === "crear") {
    return manejarCrear(req, res);
  }
  if (accion === "listar") {
    return manejarListar(req, res);
  }
  if (accion === "comentar") {
    return manejarComentar(req, res);
  }
  if (accion === "borrarTodo") {
    return manejarBorrarTodo(req, res);
  }

  return res.status(400).json({ error: "Falta indicar ?accion=crear, listar, comentar o borrarTodo" });
}

async function manejarBorrarTodo(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Esta acción solo acepta POST" });
  }

  try {
    const url = URL_BASE_DATOS + "/del/publicaciones";
    const respuesta = await fetch(url, {
      headers: { Authorization: "Bearer " + TOKEN_BASE_DATOS },
    });

    if (!respuesta.ok) {
      throw new Error("No se pudo borrar");
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(502).json({ error: "No se pudo borrar todo", detalle: error.message });
  }
}

async function manejarCrear(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Esta acción solo acepta POST" });
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
    comentarios: [],
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
    return res.status(502).json({ error: "No se pudo guardar la publicación", detalle: error.message });
  }
}

async function manejarListar(req, res) {
  try {
    const url = URL_BASE_DATOS + "/hgetall/publicaciones";

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
      publicaciones.push(JSON.parse(lista[i + 1]));
    }

    publicaciones.sort(function (a, b) {
      return new Date(b.fecha) - new Date(a.fecha);
    });

    return res.status(200).json({ publicaciones: publicaciones });
  } catch (error) {
    return res.status(502).json({ error: "No se pudieron cargar las publicaciones", detalle: error.message });
  }
}

async function manejarComentar(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Esta acción solo acepta POST" });
  }

  const { idPublicacion, autor, texto } = req.body || {};

  if (!idPublicacion || !texto) {
    return res.status(400).json({ error: "Falta el id de la publicación o el texto del comentario" });
  }

  const headers = { Authorization: "Bearer " + TOKEN_BASE_DATOS };

  try {
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

    if (!publicacion.comentarios) {
      publicacion.comentarios = [];
    }
    publicacion.comentarios.push({
      autor: autor && autor.trim() !== "" ? autor.trim() : "Ecoamig@ anónimo",
      texto: texto,
      fecha: new Date().toISOString(),
    });

    const urlEscribir =
      URL_BASE_DATOS +
      "/hset/publicaciones/" + idPublicacion + "/" + encodeURIComponent(JSON.stringify(publicacion));

    const respuestaEscribir = await fetch(urlEscribir, { headers: headers });

    if (!respuestaEscribir.ok) {
      throw new Error("No se pudo guardar el comentario");
    }

    return res.status(200).json({ ok: true, comentarios: publicacion.comentarios });
  } catch (error) {
    return res.status(502).json({ error: "No se pudo agregar el comentario", detalle: error.message });
  }
}
