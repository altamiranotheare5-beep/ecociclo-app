// ===========================================
// Trae tus Puntos Eco guardados en la base de datos, ligados a tu
// cuenta de Google — se llama apenas inicias sesión, para
// "recuperar" tu progreso en este dispositivo nuevo.
// ===========================================

const URL_BASE_DATOS = (
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || ""
).replace(/\/+$/, "");
const TOKEN_BASE_DATOS =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

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
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (!URL_BASE_DATOS || !TOKEN_BASE_DATOS) {
    return res.status(500).json({
      error: "La base de datos no está conectada todavía (faltan variables de entorno)",
    });
  }

  const usuarioSesion = await obtenerUsuarioDeSesion(req);
  if (!usuarioSesion) {
    return res.status(401).json({ error: "No hay sesión iniciada" });
  }

  try {
    const respuesta = await comandoUpstash(["GET", "puntos_usuario:" + usuarioSesion.googleId]);

    if (!respuesta.ok) {
      throw new Error("No se pudo leer");
    }

    const datos = await respuesta.json();

    // Si esta cuenta nunca ha guardado puntos antes (primera vez
    // que inicia sesión), devolvemos "null" — el navegador sabrá
    // que debe SUBIR sus puntos locales en vez de bajarlos
    return res.status(200).json({
      puntosGuardados: datos.result ? JSON.parse(datos.result) : null,
    });
  } catch (error) {
    return res.status(502).json({
      error: "No se pudieron cargar tus puntos",
      detalle: error.message,
    });
  }
}
