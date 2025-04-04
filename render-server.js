require("dotenv").config();
const express = require("express");
const { google } = require("googleapis");

const app = express();
const PORT = process.env.PORT || 3000;

// Función para convertir nombre de archivo en un slug amigable
const slugify = (str) => {
  return str
    .toLowerCase()
    .replace(/\.[^/.]+$/, "") // eliminar extensión
    .replace(/[^\w\s-]/g, "") // eliminar caracteres especiales
    .replace(/\s+/g, "-") // reemplazar espacios por guiones
    .replace(/-+/g, "-"); // evitar guiones repetidos
};

// Autenticación con Google Drive
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_API_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});
const drive = google.drive({ version: "v3", auth });

// Ruta para obtener una canción desde Google Drive por filename (método viejo)
app.get("/song/:fileName", async (req, res) => {
  const { fileName } = req.params;
  console.log(`🔍 Buscando archivo: ${fileName}`);

  try {
    const authClient = await auth.getClient();

    const list = await drive.files.list({
      q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed=false`,
      fields: "files(id, name)",
      auth: authClient,
    });

    const file = list.data.files.find((f) => f.name === fileName);
    if (!file) {
      console.error(`🚨 Archivo no encontrado: ${fileName}`);
      return res.status(404).send("Archivo no encontrado en Drive");
    }

    const stream = await drive.files.get(
      { fileId: file.id, alt: "media" },
      { responseType: "stream", auth: authClient }
    );

    res.setHeader("Content-Type", "audio/ogg");
    stream.data.pipe(res);
  } catch (error) {
    console.error("❌ Error al servir archivo:", error);
    res.status(500).send("Error al obtener la canción");
  }
});

// 🆕 Ruta para servir canción por slug limpio
app.get("/songs/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    const authClient = await auth.getClient();

    const list = await drive.files.list({
      q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed=false`,
      fields: "files(id, name)",
      auth: authClient,
    });

    const file = list.data.files.find((f) => slugify(f.name) === slug);
    if (!file) {
      return res.status(404).send("Canción no encontrada");
    }

    const stream = await drive.files.get(
      { fileId: file.id, alt: "media" },
      { responseType: "stream", auth: authClient }
    );

    res.setHeader("Content-Type", "audio/ogg");
    stream.data.pipe(res);
  } catch (error) {
    console.error("❌ Error al obtener canción por slug:", error);
    res.status(500).send("Error al obtener la canción");
  }
});

// Ruta para listar todas las canciones disponibles con slug y url amigable
app.get("/songs", async (req, res) => {
  try {
    const authClient = await auth.getClient();

    const list = await drive.files.list({
      q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed=false`,
      fields: "files(id, name)",
      auth: authClient,
    });

    if (!list.data.files.length) {
      return res.status(404).json({ message: "No se encontraron canciones." });
    }

    const songs = list.data.files.map((file) => {
      const slug = slugify(file.name);
      return {
        name: file.name,
        slug,
        url: `${req.protocol}://${req.get("host")}/songs/${slug}`,
      };
    });

    res.json(songs);
  } catch (error) {
    console.error("❌ Error al obtener las canciones:", error);
    res.status(500).json({ message: "Error al obtener las canciones" });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
