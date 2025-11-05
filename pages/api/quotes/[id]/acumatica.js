import { getSession } from 'next-auth/react';
import prisma from '../../../../lib/prisma';
import ExcelJS from 'exceljs';

/**
 * API route for exporting a quote to an Acumatica compatible Excel
 * workbook.  The generated file contains the line items in a
 * flattened format with columns appropriate for Acumatica's
 * Projects module (e.g. Task, InventoryID, Description, Quantity,
 * UnitCost, ExtendedCost, UnitPrice, ExtendedPrice).  Only
 * accepted quotes can be exported.  Only admins or the quote
 * owner may perform the export.
 */
export default async function handler(req, res) {
  const session = await getSession({ req });
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { id } = req.query;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { lines: { include: { children: true } } }
  });
  if (!quote) {
    return res.status(404).json({ error: 'Quote not found' });
  }
  const canExport = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN' || quote.ownerId === session.user.id;
  if (!canExport) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const status = (quote.status || '').toLowerCase();
  if (status !== 'accepted') {
    return res.status(400).json({ error: 'Only accepted quotes can be exported' });
  }
  // Flatten line items for export.  Each child inherits the parent
  // description prefix.  For demonstration we map fields to some
  // typical Acumatica columns.
  const rows = [];
  function traverse(lines, parentDesc = '') {
    lines.forEach((line) => {
      const desc = parentDesc ? `${parentDesc} > ${line.description}` : line.description;
      rows.push({
        Task: quote.id,
        InventoryID: line.id.substring(0, 10),
        Description: desc,
        Quantity: line.qty,
        UnitCost: line.cost,
        ExtendedCost: line.cost * line.qty,
        UnitPrice: line.sell,
        ExtendedPrice: line.sell * line.qty
      });
      if (line.children && line.children.length) traverse(line.children, desc);
    });
  }
  traverse(quote.lines);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Export');
  sheet.columns = Object.keys(rows[0] || { Task: '' }).map((key) => ({ header: key, key }));
  rows.forEach((r) => sheet.addRow(r));
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="acumatica-${id}.xlsx"`);
  return res.send(Buffer.from(buffer));
}