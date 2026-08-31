// ===========================================
// Guarda tus Puntos Eco en la base de datos, ligados a tu cuenta
// de Google (no al celular) — así, si cambias de dispositivo o
// reinstalas la app, tu progreso te sigue esperando.
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

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Este endpoint solo acepta POST" });
  }

  if (!URL_BASE_DATOS || !TOKEN_BASE_DATOS) {
    return res.status(500).json({
      error: "La base de datos no está conectada todavía (faltan variables de entorno)",
    });
  }

  // Sin sesión de Google, no hay dónde guardar los puntos "en la
  // nube" — el celular sigue llevando su propia cuenta por su lado
  const usuarioSesion = await obtenerUsuarioDeSesion(req);
  if (!usuarioSesion) {
    return res.status(401).json({ error: "No hay sesión iniciada" });
  }

  const { residuos, puntos, co2, conteoMateriales } = req.body || {};

  const datosAGuardar = {
    residuos: residuos || 0,
    puntos: puntos || 0,
    co2: co2 || 0,
    conteoMateriales: conteoMateriales || {},
    actualizado: new Date().toISOString(),
  };

  try {
    const respuesta = await comandoUpstash([
      "SET",
      "puntos_usuario:" + usuarioSesion.googleId,
      JSON.stringify(datosAGuardar),
    ]);

    if (!respuesta.ok) {
      throw new Error("No se pudo guardar");
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(502).json({
      error: "No se pudieron guardar tus puntos",
      detalle: error.message,
    });
  }
}
