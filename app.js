const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const path = require('path');
const app = express();
const port = 3000;

// Importar rutas
const authRoutes = require('./routes/auth');
const tablaRoutes = require('./routes/tabla');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// Configuración de sesiones
app.use(session({
  secret: '1234',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 3600000 } // 1 hora
}));

// Hacer que el usuario esté disponible en todas las vistas EJS
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Rutas
app.use('/', authRoutes);
app.use('/tabla', tablaRoutes);

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor ejecutándose en el puerto ${port}`);
});
