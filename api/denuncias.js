// ===========================================
// Esta función reemplaza a las 3 que teníamos antes
// (denuncias-crear.js, denuncias-listar.js,
// denuncias-sumar-voluntario.js) — las juntamos en un solo
// archivo porque Vercel, en el plan gratis, solo deja tener 12
// funciones en total, y entre todas nuestras funciones ya
// pasábamos ese número.
//
// La idea: en vez de que cada acción tenga su propia dirección
// web, ahora todas viven en /api/denuncias, y le agregamos
// "?accion=algo" al final para decirle CUÁL de las 3 cosas
// queremos que haga — como un mesero que atiende varias mesas
// (funciones) en vez de necesitar un mesero por mesa.
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
  if (accion === "voluntario") {
    return manejarVoluntario(req, res);
  }

  return res.status(400).json({ error: "Falta indicar ?accion=crear, listar o voluntario" });
}

// ===========================================
// CREAR una denuncia nueva
// ===========================================
async function manejarCrear(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Esta acción solo acepta POST" });
  }

  const { categoria, descripcion, lat, lng } = req.body || {};

  if (!categoria || !descripcion) {
    return res.status(400).json({ error: "Faltan categoría o descripción" });
  }

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
    const url =
      URL_BASE_DATOS +
      "/hset/denuncias_v2/" + id + "/" + encodeURIComponent(JSON.stringify(denuncia));

    const respuesta = await fetch(url, {
      headers: { Authorization: "Bearer " + TOKEN_BASE_DATOS },
    });

    if (!respuesta.ok) {
      const textoError = await respuesta.text();
      throw new Error("La base de datos respondió con estado " + respuesta.status + " → " + textoError);
    }

    return res.status(200).json({ ok: true, denuncia: denuncia });
  } catch (error) {
    return res.status(502).json({ error: "No se pudo guardar la denuncia", detalle: error.message });
  }
}

// ===========================================
// LISTAR todas las denuncias
// ===========================================
async function manejarListar(req, res) {
  try {
    const url = URL_BASE_DATOS + "/hgetall/denuncias_v2";

    const respuesta = await fetch(url, {
      headers: { Authorization: "Bearer " + TOKEN_BASE_DATOS },
    });

    if (!respuesta.ok) {
      const textoError = await respuesta.text();
      throw new Error("La base de datos respondió con estado " + respuesta.status + " → " + textoError);
    }

    const datos = await respuesta.json();
    const lista = datos.result || [];

    const denuncias = [];
    for (let i = 0; i < lista.length; i += 2) {
      denuncias.push(JSON.parse(lista[i + 1]));
    }

    denuncias.sort(function (a, b) {
      return new Date(b.fecha) - new Date(a.fecha);
    });

    return res.status(200).json({ denuncias: denuncias });
  } catch (error) {
    return res.status(502).json({ error: "No se pudieron cargar las denuncias", detalle: error.message });
  }
}

// ===========================================
// SUMAR VOLUNTARIO a una denuncia
// ===========================================
async function manejarVoluntario(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Esta acción solo acepta POST" });
  }

  const { id } = req.body || {};

  if (!id) {
    return res.status(400).json({ error: "Falta el id de la denuncia" });
  }

  const headers = { Authorization: "Bearer " + TOKEN_BASE_DATOS };

  try {
    const urlLeer = URL_BASE_DATOS + "/hget/denuncias_v2/" + id;
    const respuestaLeer = await fetch(urlLeer, { headers: headers });

    if (!respuestaLeer.ok) {
      throw new Error("No se pudo leer la denuncia");
    }

    const datosLeer = await respuestaLeer.json();

    if (!datosLeer.result) {
      return res.status(404).json({ error: "Esa denuncia no existe" });
    }

    const denuncia = JSON.parse(datosLeer.result);
    denuncia.voluntarios = (denuncia.voluntarios || 0) + 1;

    const urlEscribir =
      URL_BASE_DATOS +
      "/hset/denuncias_v2/" + id + "/" + encodeURIComponent(JSON.stringify(denuncia));

    const respuestaEscribir = await fetch(urlEscribir, { headers: headers });

    if (!respuestaEscribir.ok) {
      throw new Error("No se pudo actualizar la denuncia");
    }

    return res.status(200).json({ ok: true, voluntarios: denuncia.voluntarios });
  } catch (error) {
    return res.status(502).json({ error: "No se pudo sumar el voluntario", detalle: error.message });
  }
}
