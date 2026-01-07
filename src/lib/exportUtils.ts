import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExportOptions {
  filename: string;
  sheetName?: string;
  title?: string;
}

export const exportToExcel = <T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  options: ExportOptions
) => {
  const exportData = data.map(row => {
    const exportRow: Record<string, any> = {};
    columns.forEach(col => {
      exportRow[col.header] = row[col.key] || '';
    });
    return exportRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName || 'Datos');

  const colWidths = columns.map(col => ({ wch: col.width || 15 }));
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, `${options.filename}.xlsx`);
};

export const exportToPDF = <T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  options: ExportOptions
) => {
  const doc = new jsPDF();

  if (options.title) {
    doc.setFontSize(16);
    doc.text(options.title, 14, 15);
  }

  const tableData = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'number') return value.toFixed(2);
      return String(value);
    })
  );

  autoTable(doc, {
    head: [columns.map(col => col.header)],
    body: tableData,
    startY: options.title ? 25 : 10,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [240, 240, 240],
    },
  });

  doc.save(`${options.filename}.pdf`);
};

export const formatCurrency = (value: number): string => {
  return `$${value.toFixed(2)}`;
};

export const formatDate = (date: string | Date): string => {
  if (!date) return '';
  
  // Si es un string en formato YYYY-MM-DD, lo tratamos como fecha local
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-').map(Number);
    // Creamos la fecha usando el constructor local (año, mes-1, día)
    const localDate = new Date(year, month - 1, day);
    return localDate.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const formatDateTime = (date: string | Date): string => {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
