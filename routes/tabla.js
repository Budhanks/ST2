const express = require('express');
const router = express.Router();
const db = require('../config/db');
const ExcelJS = require('exceljs');

function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  }
  res.redirect('/login');
}

async function getCategoriesAndDegrees() {
  const [categorias] = await db.execute('SELECT * FROM categorias');
  const [grados] = await db.execute('SELECT * FROM grados_academicos');
  return { categorias, grados };
}

// Vista principal de trabajadores
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { categorias, grados } = await getCategoriesAndDegrees();

    const [trabajadores] = await db.execute(`
      SELECT t.*, c.nombre as categoria, g.nombre as grado_academico
      FROM trabajadores t
      LEFT JOIN categorias c ON t.id_categoria = c.id_categoria
      LEFT JOIN grados_academicos g ON t.id_grado = g.id_grado
    `);

    let graficaData = null;
    let gradosData = null;
    let antiguedadData = null;

    if (req.session.user.isAdmin) {
      // Gráfico por categoría
      const [categoriasConteo] = await db.execute(`
        SELECT c.nombre AS categoria, COUNT(*) AS total
        FROM trabajadores t
        LEFT JOIN categorias c ON t.id_categoria = c.id_categoria
        GROUP BY c.nombre
      `);

      graficaData = {
        labels: categoriasConteo.map(row => row.categoria || 'Sin categoría'),
        valores: categoriasConteo.map(row => row.total)
      };

      // Gráfico por grado académico
      const [gradosConteo] = await db.execute(`
        SELECT g.nombre AS grado, COUNT(*) AS total
        FROM trabajadores t
        LEFT JOIN grados_academicos g ON t.id_grado = g.id_grado
        GROUP BY g.nombre
      `);

      gradosData = {
        labels: gradosConteo.map(row => row.grado || 'Sin grado'),
        valores: gradosConteo.map(row => row.total)
      };

      // Gráfico por antigüedad UNAM agrupada en rangos
      const [antiguedadConteo] = await db.execute(`
        SELECT
          CASE
            WHEN antiguedad_unam IS NULL THEN 'Sin dato'
            WHEN antiguedad_unam < 5 THEN 'Menos de 5 años'
            WHEN antiguedad_unam BETWEEN 5 AND 9 THEN '5-9 años'
            WHEN antiguedad_unam BETWEEN 10 AND 14 THEN '10-14 años'
            WHEN antiguedad_unam BETWEEN 15 AND 19 THEN '15-19 años'
            WHEN antiguedad_unam BETWEEN 20 AND 29 THEN '20-29 años'
            ELSE '30 años o más'
          END AS rango_antiguedad,
          COUNT(*) AS total
        FROM trabajadores
        GROUP BY rango_antiguedad
        ORDER BY 
          CASE rango_antiguedad
            WHEN 'Sin dato' THEN 0
            WHEN 'Menos de 5 años' THEN 1
            WHEN '5-9 años' THEN 2
            WHEN '10-14 años' THEN 3
            WHEN '15-19 años' THEN 4
            WHEN '20-29 años' THEN 5
            WHEN '30 años o más' THEN 6
          END
      `);

      antiguedadData = {
        labels: antiguedadConteo.map(row => row.rango_antiguedad),
        valores: antiguedadConteo.map(row => row.total)
      };
    }

    res.render('tabla', {
      user: req.session.user,
      trabajadores,
      categorias,
      grados,
      graficaData,
      gradosData,
      antiguedadData,
      searchParams: null
    });
  } catch (error) {
    console.error('Error en tabla:', error);
    res.status(500).send('Error al cargar la tabla');
  }
});

// Búsqueda de trabajadores
router.get('/search', isAuthenticated, async (req, res) => {
  try {
    const { nombre, categoria, grado } = req.query;
    const { categorias, grados } = await getCategoriesAndDegrees();

    let sql = `
      SELECT t.*, c.nombre as categoria, g.nombre as grado_academico
      FROM trabajadores t
      LEFT JOIN categorias c ON t.id_categoria = c.id_categoria
      LEFT JOIN grados_academicos g ON t.id_grado = g.id_grado
      WHERE 1=1
    `;

    const params = [];

    if (nombre && nombre.trim() !== '') {
      sql += ` AND t.nombre_completo LIKE ?`;
      params.push(`%${nombre}%`);
    }

    if (categoria && categoria !== '') {
      sql += ` AND t.id_categoria = ?`;
      params.push(categoria);
    }

    if (grado && grado !== '') {
      sql += ` AND t.id_grado = ?`;
      params.push(grado);
    }

    const [trabajadores] = await db.execute(sql, params);

    let graficaData = null;
    let gradosData = null;
    let antiguedadData = null;

    if (req.session.user.isAdmin) {
      // Gráfico por categoría
      const [categoriasConteo] = await db.execute(`
        SELECT c.nombre AS categoria, COUNT(*) AS total
        FROM trabajadores t
        LEFT JOIN categorias c ON t.id_categoria = c.id_categoria
        GROUP BY c.nombre
      `);

      graficaData = {
        labels: categoriasConteo.map(row => row.categoria || 'Sin categoría'),
        valores: categoriasConteo.map(row => row.total)
      };

      // Gráfico por grado académico
      const [gradosConteo] = await db.execute(`
        SELECT g.nombre AS grado, COUNT(*) AS total
        FROM trabajadores t
        LEFT JOIN grados_academicos g ON t.id_grado = g.id_grado
        GROUP BY g.nombre
      `);

      gradosData = {
        labels: gradosConteo.map(row => row.grado || 'Sin grado'),
        valores: gradosConteo.map(row => row.total)
      };

      // Gráfico por antigüedad UNAM agrupada en rangos
      const [antiguedadConteo] = await db.execute(`
        SELECT
          CASE
            WHEN antiguedad_unam IS NULL THEN 'Sin dato'
            WHEN antiguedad_unam < 5 THEN 'Menos de 5 años'
            WHEN antiguedad_unam BETWEEN 5 AND 9 THEN '5-9 años'
            WHEN antiguedad_unam BETWEEN 10 AND 14 THEN '10-14 años'
            WHEN antiguedad_unam BETWEEN 15 AND 19 THEN '15-19 años'
            WHEN antiguedad_unam BETWEEN 20 AND 29 THEN '20-29 años'
            ELSE '30 años o más'
          END AS rango_antiguedad,
          COUNT(*) AS total
        FROM trabajadores
        GROUP BY rango_antiguedad
        ORDER BY 
          CASE rango_antiguedad
            WHEN 'Sin dato' THEN 0
            WHEN 'Menos de 5 años' THEN 1
            WHEN '5-9 años' THEN 2
            WHEN '10-14 años' THEN 3
            WHEN '15-19 años' THEN 4
            WHEN '20-29 años' THEN 5
            WHEN '30 años o más' THEN 6
          END
      `);

      antiguedadData = {
        labels: antiguedadConteo.map(row => row.rango_antiguedad),
        valores: antiguedadConteo.map(row => row.total)
      };
    }

    res.render('tabla', {
      user: req.session.user,
      trabajadores,
      categorias,
      grados,
      graficaData,
      gradosData,
      antiguedadData,
      searchParams: req.query
    });
  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(500).send('Error al realizar la búsqueda');
  }
});

// Panel de administración
router.get('/admin', isAuthenticated, async (req, res) => {
  if (!req.session.user.isAdmin) {
    return res.redirect('/tabla');
  }
  try {
    const { categorias, grados } = await getCategoriesAndDegrees();
    res.render('admin', {
      user: req.session.user,
      categorias,
      grados
    });
  } catch (error) {
    console.error('Error en panel admin:', error);
    res.status(500).send('Error al cargar el panel de administración');
  }
});

// Exportar lista de trabajadores a Excel (solo admin)
router.get('/exportar', isAuthenticated, async (req, res) => {
  if (!req.session.user.isAdmin) {
    return res.status(403).send('No autorizado');
  }

  try {
    // Obtener los parámetros de búsqueda para exportar resultados filtrados
    const { nombre, categoria, grado } = req.query;

    let sql = `
      SELECT t.id_trabajador, t.numero_trabajador, t.nombre_completo, 
             c.nombre AS categoria, g.nombre AS grado_academico,
             t.antiguedad_unam, t.email_institucional,
             t.rfc, t.curp, t.telefono_casa, t.telefono_celular, t.direccion,
             t.genero, t.antiguedad_carrera
      FROM trabajadores t
      LEFT JOIN categorias c ON t.id_categoria = c.id_categoria
      LEFT JOIN grados_academicos g ON t.id_grado = g.id_grado
      WHERE 1=1
    `;

    const params = [];

    if (nombre && nombre.trim() !== '') {
      sql += ` AND t.nombre_completo LIKE ?`;
      params.push(`%${nombre}%`);
    }

    if (categoria && categoria !== '') {
      sql += ` AND t.id_categoria = ?`;
      params.push(categoria);
    }

    if (grado && grado !== '') {
      sql += ` AND t.id_grado = ?`;
      params.push(grado);
    }

    const [rows] = await db.execute(sql, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Trabajadores');

    worksheet.columns = [
      { header: 'ID', key: 'id_trabajador', width: 10 },
      { header: 'Número de Trabajador', key: 'numero_trabajador', width: 20 },
      { header: 'Nombre Completo', key: 'nombre_completo', width: 30 },
      { header: 'Categoría', key: 'categoria', width: 25 },
      { header: 'Grado Académico', key: 'grado_academico', width: 20 },
      { header: 'Antigüedad UNAM (años)', key: 'antiguedad_unam', width: 15 },
      { header: 'Email Institucional', key: 'email_institucional', width: 30 },
      { header: 'RFC', key: 'rfc', width: 15 },
      { header: 'CURP', key: 'curp', width: 20 },
      { header: 'Teléfono Casa', key: 'telefono_casa', width: 15 },
      { header: 'Teléfono Celular', key: 'telefono_celular', width: 15 },
      { header: 'Dirección', key: 'direccion', width: 40 },
      { header: 'Género', key: 'genero', width: 10 },
      { header: 'Antigüedad Carrera (años)', key: 'antiguedad_carrera', width: 15 }
    ];

    rows.forEach(row => {
      if (row.genero === 'M') row.genero = 'Masculino';
      else if (row.genero === 'F') row.genero = 'Femenino';
      else if (row.genero === 'O') row.genero = 'Otro';
      worksheet.addRow(row);
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    res.setHeader('Content-Disposition', 'attachment; filename=trabajadores.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error al exportar datos:', error);
    res.status(500).send('Error al generar el archivo Excel');
  }
});

module.exports = router;
