// ===========================================
// Reemplaza a auth-google.js, auth-me.js y auth-logout.js, juntas
// en un solo archivo — misma razón que las demás: el límite de
// 12 funciones de Vercel.
// Se usa con /api/auth?accion=google, ?accion=me o ?accion=logout
// ===========================================

const URL_BASE_DATOS = (
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || ""
).replace(/\/+$/, "");
const TOKEN_BASE_DATOS =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Este es el mismo "Client ID" que pegamos en el HTML — lo
// repetimos acá para comprobar que el token que llegó fue
// generado específicamente para NUESTRA app, y no para otra.
const CLIENT_ID_GOOGLE = "PEGA_AQUI_TU_CLIENT_ID.apps.googleusercontent.com";

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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  const accion = req.query.accion;

  if (accion === "google") {
    return manejarGoogle(req, res);
  }
  if (accion === "me") {
    return manejarMe(req, res);
  }
  if (accion === "logout") {
    return manejarLogout(req, res);
  }

  return res.status(400).json({ error: "Falta indicar ?accion=google, me o logout" });
}

async function manejarGoogle(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Esta acción solo acepta POST" });
  }

  if (!URL_BASE_DATOS || !TOKEN_BASE_DATOS) {
    return res.status(500).json({ error: "La base de datos no está conectada todavía" });
  }

  const { credential } = req.body || {};

  if (!credential) {
    return res.status(400).json({ error: "Falta el token de Google" });
  }

  try {
    const respuestaGoogle = await fetch(
      "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential)
    );

    if (!respuestaGoogle.ok) {
      return res.status(401).json({ error: "El token de Google no es válido" });
    }

    const datosGoogle = await respuestaGoogle.json();

    if (datosGoogle.aud !== CLIENT_ID_GOOGLE) {
      return res.status(401).json({ error: "El token no corresponde a esta aplicación" });
    }

    const usuario = {
      googleId: datosGoogle.sub,
      nombre: datosGoogle.name || "Ecoamig@",
      correo: datosGoogle.email || null,
      foto: datosGoogle.picture || null,
    };

    const idSesion = Date.now() + "-" + Math.random().toString(36).slice(2, 15);

    const respuestaGuardar = await comandoUpstash([
      "SET", "sesion:" + idSesion, JSON.stringify(usuario), "EX", "2592000",
    ]);

    if (!respuestaGuardar.ok) {
      throw new Error("No se pudo guardar la sesión");
    }

    res.setHeader(
      "Set-Cookie",
      "ecociclo_sesion=" + idSesion + "; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax"
    );

    return res.status(200).json({ ok: true, usuario: usuario });
  } catch (error) {
    return res.status(502).json({ error: "No se pudo iniciar sesión", detalle: error.message });
  }
}

async function manejarMe(req, res) {
  if (!URL_BASE_DATOS || !TOKEN_BASE_DATOS) {
    return res.status(500).json({ error: "La base de datos no está conectada todavía" });
  }

  const idSesion = leerCookie(req.headers.cookie, "ecociclo_sesion");

  if (!idSesion) {
    return res.status(200).json({ usuario: null });
  }

  try {
    const respuesta = await comandoUpstash(["GET", "sesion:" + idSesion]);

    if (!respuesta.ok) {
      throw new Error("No se pudo consultar la sesión");
    }

    const datos = await respuesta.json();

    if (!datos.result) {
      return res.status(200).json({ usuario: null });
    }

    return res.status(200).json({ usuario: JSON.parse(datos.result) });
  } catch (error) {
    return res.status(502).json({ error: "No se pudo revisar la sesión", detalle: error.message });
  }
}

async function manejarLogout(req, res) {
  const idSesion = leerCookie(req.headers.cookie, "ecociclo_sesion");

  if (idSesion && URL_BASE_DATOS && TOKEN_BASE_DATOS) {
    try {
      await comandoUpstash(["DEL", "sesion:" + idSesion]);
    } catch (error) {
      // no es grave si falla — la cookie igual se borra abajo
    }
  }

  res.setHeader(
    "Set-Cookie",
    "ecociclo_sesion=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
  );

  return res.status(200).json({ ok: true });
}
