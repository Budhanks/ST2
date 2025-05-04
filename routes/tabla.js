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

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { categorias, grados } = await getCategoriesAndDegrees();
    
    const [trabajadores] = await db.execute(`
      SELECT t.*, c.nombre as categoria, g.nombre as grado_academico
      FROM trabajadores t
      LEFT JOIN categorias c ON t.id_categoria = c.id_categoria
      LEFT JOIN grados_academicos g ON t.id_grado = g.id_grado
    `);
    
    res.render('tabla', {
      user: req.session.user,
      trabajadores: trabajadores,
      categorias: categorias,
      grados: grados,
      searchParams: null
    });
  } catch (error) {
    console.error('Error en tabla:', error);
    res.status(500).send('Error al cargar la tabla');
  }
});

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
    
    res.render('tabla', {
      user: req.session.user,
      trabajadores: trabajadores,
      categorias: categorias,
      grados: grados,
      searchParams: req.query
    });
  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(500).send('Error al realizar la búsqueda');
  }
});

router.get('/admin', isAuthenticated, async (req, res) => {
  if (!req.session.user.isAdmin) {
    return res.redirect('/tabla');
  }
  try {
    const { categorias, grados } = await getCategoriesAndDegrees();
    res.render('admin', {
      user: req.session.user,
      categorias: categorias,
      grados: grados
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

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=trabajadores.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error al generar Excel:', error);
    res.status(500).send('Error al generar el archivo Excel');
  }
});

router.post('/worker/add', isAuthenticated, async (req, res) => {
  if (!req.session.user.isAdmin) {
    return res.status(403).send('Acceso denegado');
  }
  try {
    const {
      numero_trabajador,
      nombre_completo,
      genero,
      rfc,
      curp,
      id_categoria,
      id_grado,
      antiguedad_unam,
      antiguedad_carrera,
      email_institucional,
      telefono_casa,
      telefono_celular,
      direccion
    } = req.body;
    await db.execute(
      `INSERT INTO trabajadores (
        numero_trabajador, nombre_completo, genero, rfc, curp,
        id_categoria, id_grado, antiguedad_unam, antiguedad_carrera,
        email_institucional, telefono_casa, telefono_celular, direccion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numero_trabajador, nombre_completo, genero, rfc, curp,
        id_categoria, id_grado, antiguedad_unam, antiguedad_carrera,
        email_institucional, telefono_casa, telefono_celular, direccion
      ]
    );
    res.redirect('/tabla');
  } catch (error) {
    console.error('Error al agregar trabajador:', error);
    res.status(500).send('Error al agregar trabajador');
  }
});

router.get('/worker/edit/:id', isAuthenticated, async (req, res) => {
  try {
    const [trabajador] = await db.execute(
      'SELECT * FROM trabajadores WHERE id_trabajador = ?', 
      [req.params.id]
    );
    const { categorias, grados } = await getCategoriesAndDegrees();

    res.render('edit-worker', {
      user: req.session.user,
      trabajador: trabajador[0],
      categorias,
      grados,
      isAdmin: req.session.user.isAdmin
    });
  } catch (error) {
    console.error('Error al cargar edición:', error);
    res.status(500).send('Error al cargar formulario');
  }
});

router.post('/worker/update/:id', isAuthenticated, async (req, res) => {
  if (!req.session.user.isAdmin) return res.status(403).send('Acceso denegado');
  try {
    const {
      numero_trabajador,
      nombre_completo,
      genero,
      rfc,
      curp,
      id_categoria,
      id_grado,
      antiguedad_unam,
      antiguedad_carrera,
      email_institucional,
      telefono_casa,
      telefono_celular,
      direccion
    } = req.body;

    await db.execute(
      `UPDATE trabajadores SET
        numero_trabajador = ?,
        nombre_completo = ?,
        genero = ?,
        rfc = ?,
        curp = ?,
        id_categoria = ?,
        id_grado = ?,
        antiguedad_unam = ?,
        antiguedad_carrera = ?,
        email_institucional = ?,
        telefono_casa = ?,
        telefono_celular = ?,
        direccion = ?
      WHERE id_trabajador = ?`,
      [
        numero_trabajador,
        nombre_completo,
        genero,
        rfc,
        curp,
        id_categoria,
        id_grado,
        antiguedad_unam,
        antiguedad_carrera,
        email_institucional,
        telefono_casa,
        telefono_celular,
        direccion,
        req.params.id
      ]
    );
    res.redirect('/tabla');
  } catch (error) {
    console.error('Error al actualizar:', error);
    res.status(500).send('Error al actualizar trabajador');
  }
});

router.get('/worker/delete/:id', isAuthenticated, async (req, res) => {
  if (!req.session.user.isAdmin) return res.status(403).send('Acceso denegado');
  try {
    await db.execute(
      'DELETE FROM trabajadores WHERE id_trabajador = ?',
      [req.params.id]
    );
    res.redirect('/tabla');
  } catch (error) {
    console.error('Error al eliminar:', error);
    res.status(500).send('Error al eliminar trabajador');
  }
});

module.exports = router;
