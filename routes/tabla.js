  const express = require('express');
  const router = express.Router();
  const db = require('../config/db');
  const ExcelJS = require('exceljs');

  function isAuthenticated(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login');
  }

  async function getCategoriesAndDegrees() {
    const [categorias] = await db.execute('SELECT * FROM categorias');
    const [grados] = await db.execute('SELECT * FROM grados_academicos');
    return { categorias, grados };
  }

  async function obtenerGraficas() {
    try {
      const [categoriasConteo] = await db.execute(`
        SELECT c.nombre AS categoria, COUNT(*) AS total
        FROM trabajadores t
        LEFT JOIN categorias c ON t.id_categoria = c.id_categoria
        GROUP BY c.nombre
      `);

      const graficaData = {
        labels: categoriasConteo.map(row => row.categoria || 'Sin categoría'),
        valores: categoriasConteo.map(row => row.total)
      };

      const [gradosConteo] = await db.execute(`
        SELECT g.nombre AS grado, COUNT(*) AS total
        FROM trabajadores t
        LEFT JOIN grados_academicos g ON t.id_grado = g.id_grado
        GROUP BY g.nombre
      `);

      const gradosData = {
        labels: gradosConteo.map(row => row.grado || 'Sin grado'),
        valores: gradosConteo.map(row => row.total)
      };

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

      const antiguedadData = {
        labels: antiguedadConteo.map(row => row.rango_antiguedad),
        valores: antiguedadConteo.map(row => row.total)
      };

      const [generoConteo] = await db.execute(`
        SELECT 
          CASE 
            WHEN genero = 'M' THEN 'Masculino'
            WHEN genero = 'F' THEN 'Femenino'
            ELSE 'Otro'
          END AS genero,
          COUNT(*) AS total
        FROM trabajadores
        GROUP BY genero
      `);

      const generoData = {
        labels: generoConteo.map(row => row.genero),
        valores: generoConteo.map(row => row.total)
      };

      return { 
        graficaData: categoriasConteo.length > 0 ? graficaData : null, 
        gradosData: gradosConteo.length > 0 ? gradosData : null, 
        antiguedadData: antiguedadConteo.length > 0 ? antiguedadData : null, 
        generoData: generoConteo.length > 0 ? generoData : null 
      };
    } catch (error) {
      console.error("Error al obtener datos para gráficas:", error);
      return { graficaData: null, gradosData: null, antiguedadData: null, generoData: null };
    }
  }

  // Vista principal
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
      let generoData = null;

      if (req.session.user.isAdmin) {
        ({ graficaData, gradosData, antiguedadData, generoData } = await obtenerGraficas());
      }

      res.render('tabla', {
        user: req.session.user,
        trabajadores,
        categorias,
        grados,
        graficaData,
        gradosData,
        antiguedadData,
        generoData,
        searchParams: req.query || {}
      });

    } catch (error) {
      console.error('Error en tabla:', error);
      res.status(500).send('Error al cargar la tabla');
    }
  });

  // Búsqueda
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

      if (nombre && nombre.trim()) {
        sql += ` AND t.nombre_completo LIKE ?`;
        params.push(`%${nombre}%`);
      }

      if (categoria) {
        sql += ` AND t.id_categoria = ?`;
        params.push(categoria);
      }

      if (grado) {
        sql += ` AND t.id_grado = ?`;
        params.push(grado);
      }

      const [trabajadores] = await db.execute(sql, params);

      let graficaData = null;
      let gradosData = null;
      let antiguedadData = null;
      let generoData = null;

      if (req.session.user.isAdmin) {
        ({ graficaData, gradosData, antiguedadData, generoData } = await obtenerGraficas());
      }

      res.render('tabla', {
        user: req.session.user,
        trabajadores,
        categorias,
        grados,
        graficaData,
        gradosData,
        antiguedadData,
        generoData,
        searchParams: req.query
      });
    } catch (error) {
      console.error('Error en búsqueda:', error);
      res.status(500).send('Error al realizar la búsqueda');
    }
  });

  // Panel admin
  router.get('/admin', isAuthenticated, async (req, res) => {
    if (!req.session.user.isAdmin) return res.redirect('/tabla');
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

  // Exportar a Excel
  router.get('/exportar', isAuthenticated, async (req, res) => {
    if (!req.session.user.isAdmin) {
      return res.status(403).send('No autorizado');
    }

    try {
      const { nombre, categoria, grado } = req.query;

      let sql = `
        SELECT t.id_trabajador, t.numero_trabajador, t.nombre_completo, 
              t.genero, c.nombre AS categoria, g.nombre AS grado_academico,
              t.antiguedad_unam, t.email_institucional,
              t.rfc, t.curp, t.telefono_casa, t.telefono_celular, t.direccion,
              t.antiguedad_carrera
        FROM trabajadores t
        LEFT JOIN categorias c ON t.id_categoria = c.id_categoria
        LEFT JOIN grados_academicos g ON t.id_grado = g.id_grado
        WHERE 1=1
      `;

      const params = [];

      if (nombre && nombre.trim()) {
        sql += ` AND t.nombre_completo LIKE ?`;
        params.push(`%${nombre}%`);
      }

      if (categoria) {
        sql += ` AND t.id_categoria = ?`;
        params.push(categoria);
      }

      if (grado) {
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
        { header: 'Género', key: 'genero', width: 12 },
        { header: 'Categoría', key: 'categoria', width: 25 },
        { header: 'Grado Académico', key: 'grado_academico', width: 20 },
        { header: 'Antigüedad UNAM', key: 'antiguedad_unam', width: 15 },
        { header: 'Email Institucional', key: 'email_institucional', width: 30 },
        { header: 'RFC', key: 'rfc', width: 15 },
        { header: 'CURP', key: 'curp', width: 20 },
        { header: 'Teléfono Casa', key: 'telefono_casa', width: 15 },
        { header: 'Teléfono Celular', key: 'telefono_celular', width: 15 },
        { header: 'Dirección', key: 'direccion', width: 40 },
      ];

      rows.forEach(row => {
        row.genero = row.genero === 'M' ? 'Masculino' : row.genero === 'F' ? 'Femenino' : 'Otro';
        worksheet.addRow(row);
      });

      const headerRow = worksheet.getRow(1);
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      headerRow.height = 20;

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber > 1) {
          row.height = 18;
          row.eachCell(cell => {
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
          });
        }
      });

      worksheet.views = [{ state: 'frozen', ySplit: 1 }];

      res.setHeader('Content-Disposition', 'attachment; filename=trabajadores.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Error al exportar datos:', error);
      res.status(500).send('Error al generar el archivo Excel');
    }
  });

  // Importar Excel
  router.post('/importar-excel', isAuthenticated, async (req, res) => {
    if (!req.session.user.isAdmin) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    try {
      const { workers } = req.body;

      if (!workers || !Array.isArray(workers) || workers.length === 0) {
        return res.status(400).json({ message: 'No se recibieron datos válidos' });
      }

      // Obtener categorías y grados con insensibilidad a mayúsculas/minúsculas y espacios
      const [categorias] = await db.execute('SELECT id_categoria, LOWER(TRIM(nombre)) as nombre_lower, nombre FROM categorias');
      const [grados] = await db.execute('SELECT id_grado, LOWER(TRIM(nombre)) as nombre_lower, nombre FROM grados_academicos');

      const categoriasMap = categorias.reduce((map, cat) => {
        const key = cat.nombre_lower.replace(/\s+/g, ' ').trim();
        map[key] = cat.id_categoria;
        // Mapear también sin acentos para mejor coincidencia
        const keyWithoutAccents = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (keyWithoutAccents !== key) {
          map[keyWithoutAccents] = cat.id_categoria;
        }
        return map;
      }, {});

      const gradosMap = grados.reduce((map, grado) => {
        const key = grado.nombre_lower.replace(/\s+/g, ' ').trim();
        map[key] = grado.id_grado;
        // Mapear también sin acentos para mejor coincidencia
        const keyWithoutAccents = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (keyWithoutAccents !== key) {
          map[keyWithoutAccents] = grado.id_grado;
        }
        return map;
      }, {});

      let insertedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      const errors = [];

      for (const [index, worker] of workers.entries()) {
        try {
          if (!worker.numero_trabajador || !worker.nombre_completo) {
            skippedCount++;
            errors.push(`Fila ${index + 2}: Falta número de trabajador o nombre`);
            continue;
          }

          // Procesar categoría
          let id_categoria = null;
          if (worker.categoria_nombre) {
            const categoriaKey = worker.categoria_nombre.toLowerCase().trim().replace(/\s+/g, ' ');
            const categoriaKeyWithoutAccents = categoriaKey.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            id_categoria = categoriasMap[categoriaKey] || 
                          categoriasMap[categoriaKeyWithoutAccents];
          }

          // Procesar grado académico
          let id_grado = null;
          if (worker.grado_academico_nombre) {
            const gradoKey = worker.grado_academico_nombre.toLowerCase().trim().replace(/\s+/g, ' ');
            const gradoKeyWithoutAccents = gradoKey.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            id_grado = gradosMap[gradoKey] || 
                      gradosMap[gradoKeyWithoutAccents];
          }

          // Verificar si el trabajador ya existe
          const [existingWorker] = await db.execute(
            'SELECT id_trabajador FROM trabajadores WHERE numero_trabajador = ?',
            [worker.numero_trabajador]
          );

          if (existingWorker.length > 0) {
            // Actualizar registro existente
            await db.execute(
              `UPDATE trabajadores SET 
                nombre_completo = ?,
                genero = ?,
                id_categoria = ?,
                id_grado = ?,
                antiguedad_unam = ?,
                email_institucional = ?,
                rfc = ?,
                curp = ?,
                telefono_casa = ?,
                telefono_celular = ?,
                direccion = ?,
                antiguedad_carrera = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE numero_trabajador = ?`,
              [
                worker.nombre_completo,
                worker.genero || null,
                id_categoria,
                id_grado,
                worker.antiguedad_unam || 0,
                worker.email_institucional || null,
                worker.rfc || null,
                worker.curp || null,
                worker.telefono_casa || null,
                worker.telefono_celular || null,
                worker.direccion || null,
                worker.antiguedad_carrera || 0,
                worker.numero_trabajador
              ]
            );
            updatedCount++;
          } else {
            // Insertar nuevo registro
            await db.execute(
              `INSERT INTO trabajadores (
                numero_trabajador, nombre_completo, genero, id_categoria, id_grado,
                antiguedad_unam, email_institucional, rfc, curp,
                telefono_casa, telefono_celular, direccion, antiguedad_carrera
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                worker.numero_trabajador,
                worker.nombre_completo,
                worker.genero || null,
                id_categoria,
                id_grado,
                worker.antiguedad_unam || 0,
                worker.email_institucional || null,
                worker.rfc || null,
                worker.curp || null,
                worker.telefono_casa || null,
                worker.telefono_celular || null,
                worker.direccion || null,
                worker.antiguedad_carrera || 0
              ]
            );
            insertedCount++;
          }
        } catch (error) {
          console.error(`Error procesando fila ${index + 2}:`, error);
          errors.push(`Fila ${index + 2}: ${error.message}`);
          skippedCount++;
        }
      }

      const response = {
        success: true,
        message: `Importación completada. ${insertedCount} nuevos, ${updatedCount} actualizados, ${skippedCount} omitidos.`,
        insertedCount,
        updatedCount,
        skippedCount
      };

      if (errors.length > 0) {
        response.errors = errors.slice(0, 10); // Limitar a 10 errores para no saturar
        if (errors.length > 10) {
          response.message += ` (mostrando 10 de ${errors.length} errores)`;
        }
      }

      res.json(response);

    } catch (error) {
      console.error('Error al importar Excel:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error al procesar el archivo: ' + error.message 
      });
    }
  });

  router.get('/worker/edit/:id', isAuthenticated, async (req, res) => {
  try {
    const id = req.params.id;
    const { categorias, grados } = await getCategoriesAndDegrees();
    
    const [trabajadores] = await db.execute(
      'SELECT * FROM trabajadores WHERE id_trabajador = ?',
      [id]
    );
    
    if (trabajadores.length === 0) {
      return res.status(404).send('Trabajador no encontrado');
    }
    
    res.render('edit-worker', {
      user: req.session.user,
      trabajador: trabajadores[0],
      categorias,
      grados
    });
    
  } catch (error) {
    console.error('Error al cargar formulario de edición:', error);
    res.status(500).send('Error al cargar el formulario de edición');
  }
});

// Actualizar trabajador
router.post('/worker/update/:id', isAuthenticated, async (req, res) => {
  if (!req.session.user.isAdmin) {
    return res.status(403).send('No autorizado');
  }
  
  try {
    const id = req.params.id;
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
        rfc || null,
        curp || null,
        id_categoria || null,
        id_grado || null,
        antiguedad_unam || 0,
        antiguedad_carrera || 0,
        email_institucional || null,
        telefono_casa || null,
        telefono_celular || null,
        direccion || null,
        id
      ]
    );
    
    res.redirect('/tabla');
    
  } catch (error) {
    console.error('Error al actualizar trabajador:', error);
    res.status(500).send('Error al actualizar el trabajador');
  }
});

// Eliminar trabajador
router.get('/worker/delete/:id', isAuthenticated, async (req, res) => {
  if (!req.session.user.isAdmin) {
    return res.status(403).send('No autorizado');
  }
  
  try {
    const id = req.params.id;
    
    await db.execute(
      'DELETE FROM trabajadores WHERE id_trabajador = ?',
      [id]
    );
    
    res.redirect('/tabla');
    
  } catch (error) {
    console.error('Error al eliminar trabajador:', error);
    res.status(500).send('Error al eliminar el trabajador');
  }
});

// Ruta para agregar un nuevo trabajador (desde panel admin)
router.post('/worker/add', isAuthenticated, async (req, res) => {
  if (!req.session.user.isAdmin) {
    return res.status(403).send('No autorizado');
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
    
    // Validar campos obligatorios
    if (!numero_trabajador || !nombre_completo) {
      return res.status(400).send('El número de trabajador y nombre son obligatorios');
    }
    
    // Verificar si ya existe un trabajador con ese número
    const [existingWorker] = await db.execute(
      'SELECT id_trabajador FROM trabajadores WHERE numero_trabajador = ?',
      [numero_trabajador]
    );
    
    if (existingWorker.length > 0) {
      return res.status(400).send('Ya existe un trabajador con ese número');
    }
    
    await db.execute(
      `INSERT INTO trabajadores (
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numero_trabajador,
        nombre_completo,
        genero || null,
        rfc || null,
        curp || null,
        id_categoria || null,
        id_grado || null,
        antiguedad_unam || 0,
        antiguedad_carrera || 0,
        email_institucional || null,
        telefono_casa || null,
        telefono_celular || null,
        direccion || null
      ]
    );
    
    res.redirect('/tabla');
    
  } catch (error) {
    console.error('Error al agregar trabajador:', error);
    res.status(500).send('Error al agregar el trabajador');
  }
});

  module.exports = router;