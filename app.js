const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 8000;

// Configuración de Multer para almacenar imágenes
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Configurar el middleware para manejar datos POST y archivos estáticos
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Servir archivos estáticos desde 'public'
app.use('/uploads', express.static('uploads'));

// Crear la base de datos SQLite
const db = new sqlite3.Database('usuarios.db', (err) => {
  if (err) {
    console.error('Error al abrir la base de datos', err.message);
  } else {
    console.log('Conectado a la base de datos SQLite.');

    // Crear la tabla de usuarios si no existe
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      password TEXT NOT NULL,
      imagen TEXT
    )`, (err) => {
      if (err) {
        console.error('Error al crear la tabla de usuarios', err.message);
      }
    });
  }
});

// Ruta para obtener la lista de usuarios en formato JSON
app.get('/usuarios', (req, res) => {
  db.all("SELECT * FROM usuarios", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Error al recuperar usuarios' });
    } else {
      res.json(rows); // Enviar la lista de usuarios como JSON
    }
  });
});

// Ruta para mostrar el formulario de agregar usuario
app.get('/agregar', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'add_user.html'));
});

// Ruta para agregar un usuario
app.post('/agregar', upload.single('imagen'), (req, res) => {
  const { nombre, password } = req.body;
  const imagen = req.file ? req.file.filename : '';

  db.run("INSERT INTO usuarios (nombre, password, imagen) VALUES (?, ?, ?)", [nombre, password, imagen], function (err) {
    if (err) {
      res.status(500).send('Error al agregar usuario');
    } else {
      res.redirect('/'); // Redirigir a la página de inicio (lista de usuarios)
    }
  });
});

// Ruta para eliminar un usuario
app.get('/eliminar/:id', (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM usuarios WHERE id = ?", [id], function (err) {
    if (err) {
      res.status(500).send('Error al eliminar usuario');
    } else {
      res.redirect('/');
    }
  });
});

// Ruta para mostrar el formulario de edición
app.get('/editar/:id', (req, res) => {
  const id = req.params.id;
  
  // Obtener el usuario por ID
  db.get("SELECT * FROM usuarios WHERE id = ?", [id], (err, row) => {
    if (err) {
      res.status(500).send('Error al recuperar usuario');
    } else if (!row) {
      res.status(404).send('Usuario no encontrado');
    } else {
      // Enviar el formulario de edición con los datos del usuario
      res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Editar Usuario</title>
            <!-- Incluir CSS de Bootstrap desde la CDN -->
            <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
            <!-- Incluir Font Awesome para iconos -->
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" rel="stylesheet">
            <style>
                .form-container {
                    max-width: 400px;
                    margin: 50px auto;
                    padding: 20px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                }
                #preview {
                    width: 100px;
                    height: 100px;
                    object-fit: cover;
                    display: block;
                    margin: 10px auto;
                    cursor: pointer;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="form-container">
                    <h2 class="text-center mb-4">Editar Usuario</h2>
                    <form action="/actualizar/${id}" method="post" enctype="multipart/form-data">
                        <!-- Campo de entrada de archivo oculto -->
                        <input type="file" name="imagen" id="imagen" class="d-none" accept="image/*" onchange="previewImage(event)">
                        <!-- Imagen de avatar que actúa como botón de carga -->
                        <div class="text-center">
                            <img id="preview" src="/uploads/${row.imagen}" alt="Avatar" class="rounded-circle" onclick="document.getElementById('imagen').click();">
                        </div>
                        <div class="form-group">
                            <label for="nombre">Nombre</label>
                            <input type="text" name="nombre" id="nombre" class="form-control" value="${row.nombre}" required>
                        </div>
                        <div class="form-group">
                            <label for="password">Contraseña</label>
                            <input type="password" name="password" id="password" class="form-control" value="${row.password}" required>
                        </div>
                        <div class="text-center mt-3">
                            <button type="submit" class="btn btn-success">
                                <i class="fas fa-save"></i> <!-- Icono de guardar cambios -->
                            </button>
                            <a href="/" class="btn btn-secondary">
                                <i class="fas fa-arrow-left"></i> <!-- Icono de regresar -->
                            </a>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Incluir JavaScript de Bootstrap y sus dependencias -->
            <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.9.3/dist/umd/popper.min.js"></script>
            <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>

            <!-- Script para vista previa de imagen -->
            <script>
                function previewImage(event) {
                    const input = event.target;
                    const preview = document.getElementById('preview');

                    if (input.files && input.files[0]) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            preview.src = e.target.result;
                        }
                        reader.readAsDataURL(input.files[0]);
                    } else {
                        preview.src = '/uploads/${row.imagen}'; // Volver a la imagen original si no hay imagen seleccionada
                    }
                }
            </script>
        </body>
        </html>
      `);
    }
  });
});


// Ruta para actualizar un usuario
app.post('/actualizar/:id', upload.single('imagen'), (req, res) => {
  const id = req.params.id;
  const { nombre, password } = req.body;
  const imagen = req.file ? req.file.filename : '';

  if (imagen) {
    db.run("UPDATE usuarios SET nombre = ?, password = ?, imagen = ? WHERE id = ?", [nombre, password, imagen, id], function (err) {
      if (err) {
        res.status(500).send('Error al actualizar usuario');
      } else {
        res.redirect('/');
      }
    });
  } else {
    db.run("UPDATE usuarios SET nombre = ?, password = ? WHERE id = ?", [nombre, password, id], function (err) {
      if (err) {
        res.status(500).send('Error al actualizar usuario');
      } else {
        res.redirect('/');
      }
    });
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor en funcionamiento en http://localhost:${port}`);
});
