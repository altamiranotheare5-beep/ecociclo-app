// ===========================================
// Guarda una publicación nueva del Mercado / Intercambio
// (vender, intercambiar o regalar), ahora con foto opcional.
//
// OJO — cambio importante respecto a las otras funciones: como
// una foto pesa mucho más que un simple texto, ya no la mandamos
// "pegada en la dirección web" (como hacíamos con /hset/.../valor).
// Una dirección web tiene un largo máximo, y una foto lo rompería.
// En vez de eso, mandamos el comando completo DENTRO del cuerpo
// del mensaje (el "body"), que no tiene ese límite tan estrecho.
// ===========================================

const URL_BASE_DATOS = (
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || ""
).replace(/\/+$/, "");
const TOKEN_BASE_DATOS =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Netlify/Vercel a veces limitan el tamaño del "body" que reciben
// las funciones — le avisamos a Vercel que necesitamos un poco más
// de espacio del que viene por defecto, para que quepan fotos.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};

// FUNCIÓN: le manda un comando a Upstash METIÉNDOLO EN EL BODY,
// en vez de pegado en la URL — así no importa si el valor es
// grande (como una foto en base64)
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

  const { autor, categoria, titulo, descripcion, precio, buscaACambio, foto } = req.body || {};

  const categoriasValidas = ["Vender", "Intercambiar", "Regalar"];

  if (!titulo || !descripcion || categoriasValidas.indexOf(categoria) === -1) {
    return res.status(400).json({ error: "Faltan datos obligatorios o la categoría no es válida" });
  }

  const id = Date.now() + "-" + Math.random().toString(36).slice(2, 8);

  const publicacion = {
    id: id,
    autor: autor && autor.trim() !== "" ? autor.trim() : "Ecoamig@ anónimo",
    categoria: categoria,
    titulo: titulo,
    descripcion: descripcion,
    precio: categoria === "Vender" ? (precio || null) : null,
    buscaACambio: categoria === "Intercambiar" ? (buscaACambio || null) : null,
    // Guardamos la foto ya "aplastada" en texto (base64) que nos
    // manda el navegador — o null si no pusieron ninguna
    foto: foto || null,
    fecha: new Date().toISOString(),
    interesados: [],
  };

  try {
    const respuesta = await comandoUpstash([
      "HSET",
      "publicaciones_mercado",
      id,
      JSON.stringify(publicacion),
    ]);

    if (!respuesta.ok) {
      const textoError = await respuesta.text();
      throw new Error("La base de datos respondió con estado " + respuesta.status + " → " + textoError);
    }

    return res.status(200).json({ ok: true, publicacion: publicacion });
  } catch (error) {
    return res.status(502).json({
      error: "No se pudo guardar la publicación",
      detalle: error.message,
    });
  }
}
