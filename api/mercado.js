// ===========================================
// Reemplaza a mercado-crear.js, mercado-listar.js,
// mercado-interes.js y mercado-eliminar.js, juntas en un solo
// archivo — misma razón que denuncias.js y comunidad.js: el
// límite de 12 funciones de Vercel.
// Se usa con /api/mercado?accion=crear, listar, interes o eliminar
// ===========================================

const URL_BASE_DATOS = (
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || ""
).replace(/\/+$/, "");
const TOKEN_BASE_DATOS =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Le avisamos a Vercel que necesitamos más espacio del normal en
// el "body", ya que las publicaciones pueden traer una foto
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

function leerCookie(textoCookies, nombre) {
  if (!textoCookies) {
    return null;
  }
  const partes = textoCookies.split(";").map(function (p) {
    return p.trim();
  });
  const encontrada = partes.find(function (p) {
    return p.startsWith(nombre + "=");
  });
  return encontrada ? encontrada.slice(nombre.length + 1) : null;
}

async function obtenerUsuarioDeSesion(req) {
  const idSesion = leerCookie(req.headers.cookie, "ecociclo_sesion");
  if (!idSesion) {
    return null;
  }
  try {
    const respuesta = await comandoUpstash(["GET", "sesion:" + idSesion]);
    if (!respuesta.ok) {
      return null;
    }
    const datos = await respuesta.json();
    return datos.result ? JSON.parse(datos.result) : null;
  } catch (error) {
    return null;
  }
}

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
  if (accion === "interes") {
    return manejarInteres(req, res);
  }
  if (accion === "eliminar") {
    return manejarEliminar(req, res);
  }
  if (accion === "borrarTodo") {
    return manejarBorrarTodo(req, res);
  }

  return res.status(400).json({ error: "Falta indicar ?accion=crear, listar, interes, eliminar o borrarTodo" });
}

async function manejarBorrarTodo(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Esta acción solo acepta POST" });
  }

  try {
    const respuesta = await comandoUpstash(["DEL", "publicaciones_mercado"]);

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

  const { autor, categoria, titulo, descripcion, precio, buscaACambio, foto } = req.body || {};

  const categoriasValidas = ["Vender", "Intercambiar", "Regalar"];

  if (!titulo || !descripcion || categoriasValidas.indexOf(categoria) === -1) {
    return res.status(400).json({ error: "Faltan datos obligatorios o la categoría no es válida" });
  }

  const usuarioSesion = await obtenerUsuarioDeSesion(req);

  const id = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  const claveEdicion = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  const publicacion = {
    id: id,
    autor: usuarioSesion ? usuarioSesion.nombre : (autor && autor.trim() !== "" ? autor.trim() : "Ecoamig@ anónimo"),
    autorFoto: usuarioSesion ? usuarioSesion.foto : null,
    autorGoogleId: usuarioSesion ? usuarioSesion.googleId : null,
    categoria: categoria,
    titulo: titulo,
    descripcion: descripcion,
    precio: categoria === "Vender" ? (precio || null) : null,
    buscaACambio: categoria === "Intercambiar" ? (buscaACambio || null) : null,
    foto: foto || null,
    fecha: new Date().toISOString(),
    interesados: [],
    claveEdicion: claveEdicion,
  };

  try {
    const respuesta = await comandoUpstash(["HSET", "publicaciones_mercado", id, JSON.stringify(publicacion)]);

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
    const url = URL_BASE_DATOS + "/hgetall/publicaciones_mercado";

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
      const publicacion = JSON.parse(lista[i + 1]);
      delete publicacion.claveEdicion;
      publicaciones.push(publicacion);
    }

    publicaciones.sort(function (a, b) {
      return new Date(b.fecha) - new Date(a.fecha);
    });

    return res.status(200).json({ publicaciones: publicaciones });
  } catch (error) {
    return res.status(502).json({ error: "No se pudieron cargar las publicaciones", detalle: error.message });
  }
}

async function manejarInteres(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Esta acción solo acepta POST" });
  }

  const { idPublicacion, autor, texto } = req.body || {};

  if (!idPublicacion || !texto) {
    return res.status(400).json({ error: "Falta el id de la publicación o el mensaje" });
  }

  try {
    const respuestaLeer = await comandoUpstash(["HGET", "publicaciones_mercado", idPublicacion]);

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

    const respuestaEscribir = await comandoUpstash([
      "HSET",
      "publicaciones_mercado",
      idPublicacion,
      JSON.stringify(publicacion),
    ]);

    if (!respuestaEscribir.ok) {
      throw new Error("No se pudo guardar el mensaje");
    }

    return res.status(200).json({ ok: true, interesados: publicacion.interesados });
  } catch (error) {
    return res.status(502).json({ error: "No se pudo enviar el mensaje", detalle: error.message });
  }
}

async function manejarEliminar(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Esta acción solo acepta POST" });
  }

  const { idPublicacion, claveEdicion } = req.body || {};

  if (!idPublicacion) {
    return res.status(400).json({ error: "Falta el id de la publicación" });
  }

  try {
    const respuestaLeer = await comandoUpstash(["HGET", "publicaciones_mercado", idPublicacion]);

    if (!respuestaLeer.ok) {
      throw new Error("No se pudo leer la publicación");
    }

    const datosLeer = await respuestaLeer.json();

    if (!datosLeer.result) {
      return res.status(200).json({ ok: true, yaNoExistia: true });
    }

    const publicacion = JSON.parse(datosLeer.result);

    const usuarioSesion = await obtenerUsuarioDeSesion(req);

    const coincidePorLlave = claveEdicion && publicacion.claveEdicion === claveEdicion;
    const coincidePorGoogle =
      usuarioSesion && publicacion.autorGoogleId && usuarioSesion.googleId === publicacion.autorGoogleId;

    if (!coincidePorLlave && !coincidePorGoogle) {
      return res.status(403).json({ error: "No tienes permiso para eliminar esta publicación" });
    }

    const respuestaBorrar = await comandoUpstash(["HDEL", "publicaciones_mercado", idPublicacion]);

    if (!respuestaBorrar.ok) {
      throw new Error("No se pudo eliminar la publicación");
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(502).json({ error: "No se pudo eliminar la publicación", detalle: error.message });
  }
}
