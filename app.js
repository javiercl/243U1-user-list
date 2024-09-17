  const express = require('express');
  const multer = require('multer');
  const sharp = require('sharp');
  const path = require('path');
  const fs = require('fs');
  const { MongoClient, ObjectId } = require('mongodb');

  const app = express();
  const port = 8000;

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/'); // Ruta donde se almacenan temporalmente las imágenes
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname); // Nombre del archivo con marca de tiempo para evitar duplicados
    }
  });
  
  const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Por favor, sube solo archivos de imagen.'), false);
      }
      cb(null, true);
    }
  });
  

  // Configurar el middleware para manejar datos POST y archivos estáticos
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static('public')); // Servir archivos estáticos desde 'public'


  app.use('/uploads', express.static('uploads'));


  // URL de conexión de MongoDB (modifica esta URL según sea necesario)
  const uri = 'mongodb+srv://admin:1234@cluster0.vjpmn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster07'; // O tu URI de MongoDB Atlas
  const client = new MongoClient(uri);

  // Nombre de la base de datos
  const dbName = 'sysdb';
  let db;

  // Conectar a MongoDB
  client.connect()
    .then(() => {
      console.log('Conectado a MongoDB');
      db = client.db(dbName); // Selecciona la base de datos
    })
    .catch(err => {
      console.error('Error al conectar a MongoDB', err);
    });

  app.get('/usuarios', async (req, res) => {
    try {
      const users = await db.collection('users').find({}).toArray();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: 'Error al recuperar usuarios' });
    }
  });

  // Ruta para subir y procesar la imagen
  app.post('/upload', upload.single('imagen'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).send('No se ha subido ninguna imagen.');
      }

      // Obtén el nombre y la extensión del archivo original
      const originalName = path.parse(req.file.originalname).name;
      const originalExtension = path.extname(req.file.originalname).toLowerCase();

      // Define la ruta de destino para la imagen optimizada
      const outputPath = path.join(__dirname, 'uploads', `${originalName}-optimizada${originalExtension}`);

      // Crea una instancia de Sharp para el procesamiento de la imagen
      let image = sharp(req.file.buffer);

      // Procesa y optimiza la imagen dependiendo del formato
      if (originalExtension === '.jpeg' || originalExtension === '.jpg') {
        image = image.resize(800) // Redimensiona la imagen a un ancho de 800px, manteniendo la relación de aspecto
                    .jpeg({ quality: 80 }); // Convierte a JPEG con calidad del 80%
      } else if (originalExtension === '.png') {
        image = image.resize(800) // Redimensiona la imagen a un ancho de 800px
                    .png({ quality: 80, compressionLevel: 8 }); // Convierte a PNG con calidad y nivel de compresión especificados
      } else {
        return res.status(400).send('Formato de imagen no soportado. Solo se permiten JPEG y PNG.');
      }

      // Guarda la imagen optimizada
      await image.toFile(outputPath);

      res.send(`Imagen subida y optimizada exitosamente: ${outputPath}`);
    } catch (err) {
      console.error(err);
      res.status(500).send('Error al procesar la imagen.');
    }
  });

  // Ruta para mostrar el formulario de agregar usuario
  app.get('/agregar', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'add_user.html'));
  });

  const validateUserData = (nombre, password) => {
    if (!nombre || nombre.length < 3) {
      return 'El nombre debe tener al menos 3 caracteres.';
    }
    if (!password || password.length < 6) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }
    return null;
  };
  
  // Validar antes de agregar o actualizar
  app.post('/agregar', upload.single('imagen'), async (req, res) => {
    const { nombre, password } = req.body;
    const imagen = req.file ? req.file.filename : '';
  
    const validationError = validateUserData(nombre, password);
    if (validationError) {
      return res.status(400).send(validationError);
    }
  
    try {
      await db.collection('users').insertOne({ nombre, password, imagen });
      res.redirect('/');
    } catch (err) {
      res.status(500).send('Error al agregar usuario');
    }
  });

  app.get('/eliminar/:id', async (req, res) => {
    const id = req.params.id;
  
    // Verificar si el ID es un ObjectId válido
    if (!ObjectId.isValid(id)) {
      return res.status(400).send('ID de usuario inválido');
    }
    
    try {
      // Intentar eliminar el usuario con el ID proporcionado
      const resultado = await db.collection('users').deleteOne({ _id: new ObjectId(id) });
  
      if (resultado.deletedCount === 0) {
        // Si no se eliminó ningún documento, significa que no se encontró
        return res.status(404).send('Usuario no encontrado');
      }
  
      res.redirect('/');
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
      res.status(500).send('Error al eliminar usuario');
    }
  });


  // Ruta para mostrar el formulario de edición
  app.get('/editar/:id', async (req, res) => {
    const id = req.params.id;
    try {
      // Buscar un usuario por su ID utilizando findOne
      const usuario = await db.collection('users').findOne({ _id: new ObjectId(id) });

      if (!usuario) {
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
                              <img id="preview" src="/uploads/${usuario.imagen}" alt="Avatar" class="rounded-circle" onclick="document.getElementById('imagen').click();">
                          </div>
                          <div class="form-group">
                              <label for="nombre">Nombre</label>
                              <input type="text" name="nombre" id="nombre" class="form-control" value="${usuario.nombre}" required>
                          </div>
                          <div class="form-group">
                              <label for="password">Contraseña</label>
                              <input type="password" name="password" id="password" class="form-control" value="${usuario.password}" required>
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
                          preview.src = '/uploads/${usuario.imagen}'; // Volver a la imagen original si no hay imagen seleccionada
                      }
                  }
              </script>
          </body>
          </html>
        `);
      }
    } catch (err) {
      res.status(500).send('Error al recuperar usuario');
    }

  });


  const deleteImage = (imagePath) => {
    fs.unlink(imagePath, (err) => {
      if (err) {
        console.error('Error al eliminar la imagen anterior:', err);
      } else {
        console.log('Imagen anterior eliminada con éxito');
      }
    });
  };
  
  // Modificar la ruta de actualización para eliminar la imagen anterior
  app.post('/actualizar/:id', upload.single('imagen'), async (req, res) => {
    const id = req.params.id;
    const { nombre, password } = req.body;
    const imagen = req.file ? req.file.filename : '';
  
    try {
      // Buscar el usuario actual para obtener la imagen anterior
      const usuario = await db.collection('users').findOne({ _id: new ObjectId(id) });
  
      if (!usuario) {
        return res.status(404).send('Usuario no encontrado');
      }
  
      const updateData = { nombre, password };
      if (imagen) {
        updateData.imagen = imagen;
        // Eliminar la imagen anterior si existe
        if (usuario.imagen) {
          deleteImage(path.join(__dirname, 'uploads', usuario.imagen));
        }
      }
  
      await db.collection('users').updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      res.redirect('/');
    } catch (err) {
      res.status(500).send('Error al actualizar usuario');
    }
  });
  

  // Iniciar el servidor
  app.listen(port, () => {
    console.log(`Servidor en funcionamiento en http://localhost:${port}`);
  });
