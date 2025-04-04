require("dotenv").config();
const express = require("express");
const { google } = require("googleapis");

const app = express();
const PORT = process.env.PORT || 3000;

// Autenticación con Google Drive
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_API_CREDENTIALS,
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});
const drive = google.drive({ version: "v3", auth });

// Ruta para obtener una canción desde Google Drive
app.get("/song/:fileName", async (req, res) => {
  const { fileName } = req.params;

  try {
    const authClient = await auth.getClient();

    const list = await drive.files.list({
      q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and name='${fileName}' and trashed=false`,
      fields: "files(id, name)",
      auth: authClient,
    });

    const file = list.data.files[0];
    if (!file) return res.status(404).send("Archivo no encontrado");

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

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
