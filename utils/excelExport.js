// utils/excelExport.js
const ExcelJS = require('exceljs');

/**
 * Función para exportar datos a Excel
 * @param {Array} data - Datos a exportar
 * @param {Array} columns - Configuración de columnas [{header: 'Nombre', key: 'nombre_campo'}]
 * @param {String} title - Título de la hoja de Excel
 * @param {String} fileName - Nombre del archivo a generar
 * @returns {Promise<Buffer>} - Buffer con el archivo Excel
 */
async function exportToExcel(data, columns, title = 'Datos', fileName = 'export.xlsx') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Secretaría Técnica';
  workbook.created = new Date();
  
  const worksheet = workbook.addWorksheet(title);
  
  // Definir columnas
  worksheet.columns = columns;
  
  // Añadir filas de datos
  worksheet.addRows(data);
  
  // Dar formato a las celdas de encabezado
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD3D3D3' }
  };
  
  // Ajustar ancho de columnas automáticamente
  worksheet.columns.forEach(column => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const columnLength = cell.value ? cell.value.toString().length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = maxLength < 10 ? 10 : maxLength + 2;
  });
  
  // Crear buffer
  return await workbook.xlsx.writeBuffer();
}

module.exports = { exportToExcel };