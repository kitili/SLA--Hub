'use client';

// Shared report export helpers — PDF, Word, and Excel — driven by a generic
// "sections" description so every Reports page (Marketing, SE, Dispensary)
// can reuse the same three exporters instead of building its own per module.
//
// A section is either:
//   { title, stats: [{ label, value }] }             — a stat grid
//   { title, columns: [string], rows: [[cell]] }     — a table

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell } from 'docx';

export function exportReportPDF(filename, heading, sections) {
  const doc = new jsPDF();
  let y = 18;
  doc.setFontSize(16);
  doc.text(heading, 14, y);
  y += 10;

  sections.forEach(section => {
    if (y > 260) { doc.addPage(); y = 18; }
    doc.setFontSize(12);
    doc.text(section.title, 14, y);
    y += 7;

    if (section.stats) {
      doc.setFontSize(10);
      section.stats.forEach(s => {
        doc.text(`${s.label}: ${s.value}`, 14, y);
        y += 6;
      });
      y += 4;
    } else if (section.columns) {
      autoTable(doc, {
        startY: y,
        head: [section.columns],
        body: section.rows,
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 10;
    }
  });

  doc.save(filename);
}

export function exportReportExcel(filename, heading, sections) {
  const wb = XLSX.utils.book_new();

  sections.forEach((section, i) => {
    const aoa = [[heading], [section.title], []];
    if (section.stats) {
      aoa.push(['Label', 'Value']);
      section.stats.forEach(s => aoa.push([s.label, s.value]));
    } else if (section.columns) {
      aoa.push(section.columns);
      section.rows.forEach(r => aoa.push(r));
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const sheetName = (section.title || `Sheet ${i + 1}`).replace(/[\[\]*/\\?:]/g, '').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  XLSX.writeFile(wb, filename);
}

export function exportSheetExcel(filename, sheetName, heading, columns, rows) {
  const stamp = new Date().toLocaleString('en-GB');
  const aoa = [
    [heading],
    [`Exported ${stamp} — ${rows.length} row${rows.length === 1 ? '' : 's'}`],
    [],
    columns,
    ...rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = columns.map((col, i) => {
    const sample = rows.slice(0, 80).map((r) => String(r[i] ?? ''));
    const max = Math.max(String(col).length, ...sample.map((s) => s.length), 10);
    return { wch: Math.min(42, max + 2) };
  });
  ws['!views'] = [{ state: 'frozen', ySplit: 4 }];
  const wb = XLSX.utils.book_new();
  const safeName = (sheetName || 'Sheet').replace(/[\[\]*/\\?:]/g, '').slice(0, 31) || 'Sheet';
  XLSX.utils.book_append_sheet(wb, ws, safeName);
  XLSX.writeFile(wb, filename);
}

export async function exportReportWord(filename, heading, sections) {
  const children = [new Paragraph({ text: heading, heading: HeadingLevel.HEADING_1 })];

  sections.forEach(section => {
    children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));

    if (section.stats) {
      section.stats.forEach(s => children.push(new Paragraph({ text: `${s.label}: ${s.value}` })));
    } else if (section.columns) {
      const headerRow = new TableRow({
        children: section.columns.map(c => new TableCell({ children: [new Paragraph({ text: String(c) })] })),
      });
      const rows = section.rows.map(r => new TableRow({
        children: r.map(cell => new TableCell({ children: [new Paragraph(String(cell))] })),
      }));
      children.push(new Table({ rows: [headerRow, ...rows] }));
    }
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
