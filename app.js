const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const path = require('path');
const app = express();
const port = 3000;

// Importar rutas
const authRoutes = require('./routes/auth');
const tablaRoutes = require('./routes/tabla');
const excelRoutes = require('./routes/excel');

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

// Rutas
app.use('/', authRoutes);
app.use('/tabla', tablaRoutes);
app.use('/exportar-excel', excelRoutes);


app.listen(port, () => {
  console.log(`Servidor ejecutándose en el puerto ${port}`);
});