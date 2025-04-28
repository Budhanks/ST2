// routes/excel.js
const express = require('express');
const router = express.Router();
const { exportToExcel } = require('../utils/excelExport');
const db = require('../db');

// Middleware para verificar si el usuario está autenticado
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/login');
};

// Ruta para exportar trabajadores a Excel
router.get('/trabajadores', isAuthenticated, async (req, res) => {
  try {
    // Consulta para obtener todos los trabajadores con información relacionada
    const query = `
      SELECT 
        t.id_trabajador,
        t.numero_trabajador,
        t.nombre_completo,
        t.genero,
        t.rfc,
        t.curp,
        c.nombre AS categoria,
        g.nombre AS grado_academico,
        t.antiguedad_unam,
        t.antiguedad_carrera,
        t.email_institucional,
        t.telefono_casa,
        t.telefono_celular,
        t.direccion
      FROM trabajadores t
      LEFT JOIN categorias c ON t.id_categoria = c.id_categoria
      LEFT JOIN grados g ON t.id_grado = g.id_grado
      ORDER BY t.nombre_completo
    `;
    
    const [trabajadores] = await db.query(query);
    
    // Definir columnas para el Excel
    const columns = [
      { header: 'Número de Trabajador', key: 'numero_trabajador' },
      { header: 'Nombre Completo', key: 'nombre_completo' },
      { header: 'Género', key: 'genero' },
      { header: 'RFC', key: 'rfc' },
      { header: 'CURP', key: 'curp' },
      { header: 'Categoría', key: 'categoria' },
      { header: 'Grado Académico', key: 'grado_academico' },
      { header: 'Antigüedad UNAM (años)', key: 'antiguedad_unam' },
      { header: 'Antigüedad Carrera (años)', key: 'antiguedad_carrera' },
      { header: 'Email Institucional', key: 'email_institucional' },
      { header: 'Teléfono Casa', key: 'telefono_casa' },
      { header: 'Teléfono Celular', key: 'telefono_celular' },
      { header: 'Dirección', key: 'direccion' }
    ];
    
    // Generar Excel
    const buffer = await exportToExcel(
      trabajadores, 
      columns, 
      'Trabajadores', 
      'trabajadores.xlsx'
    );
    
    // Enviar el archivo al cliente
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="trabajadores-${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Error al exportar a Excel:', error);
    res.status(500).send('Error al generar el archivo Excel');
  }
});

module.exports = router;