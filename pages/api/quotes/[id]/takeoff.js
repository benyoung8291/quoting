import { getSession } from 'next-auth/react';
import prisma from '../../../../lib/prisma';
import ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';

/**
 * API route for importing and exporting takeoff sheets (line items)
 * associated with a quote.  A GET request returns an Excel file
 * representing the line items for the given quote.  A POST
 * request accepts an uploaded Excel file (sent as base64 in the
 * body) and replaces the existing line items.  Parent/child
 * relationships are preserved using a simple indentation column.
 */
export default async function handler(req, res) {
  const session = await getSession({ req });
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { id } = req.query;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { owner: true, lines: { include: { children: true } } }
  });
  if (!quote) {
    return res.status(404).json({ error: 'Quote not found' });
  }
  const canModify = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN' || quote.ownerId === session.user.id;
  if (!canModify) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.method === 'GET') {
    // Export the line items as an Excel workbook.  We use a simple
    // parent indicator where each row has a depth column.  Depth 0
    // indicates a parent line, depth 1 indicates a child of the
    // previous parent, etc.
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Takeoff');
    sheet.columns = [
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Quantity', key: 'qty', width: 10 },
      { header: 'Cost', key: 'cost', width: 10 },
      { header: 'Sell', key: 'sell', width: 10 },
      { header: 'Margin', key: 'margin', width: 10 },
      { header: 'Depth', key: 'depth', width: 6 }
    ];
    function flattenLines(lines, depth = 0) {
      lines.forEach((line) => {
        sheet.addRow({
          description: line.description,
          qty: line.qty,
          cost: line.cost,
          sell: line.sell,
          margin: line.margin,
          depth
        });
        if (line.children && line.children.length) {
          flattenLines(line.children, depth + 1);
        }
      });
    }
    flattenLines(quote.lines);
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="takeoff-${id}.xlsx"`);
    return res.send(Buffer.from(buffer));
  }
  if (req.method === 'POST') {
    // Expect the request body to contain { file: base64String }
    const { file } = req.body || {};
    if (!file) {
      return res.status(400).json({ error: 'Missing file' });
    }
    try {
      const buffer = Buffer.from(file.split(',').pop(), 'base64');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.getWorksheet(1);
      const rows = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        const [description, qty, cost, sell, margin, depth] = row.values.slice(1);
        rows.push({ description, qty: parseFloat(qty) || 0, cost: parseFloat(cost) || 0, sell: parseFloat(sell) || 0, margin: parseFloat(margin) || 0, depth: parseInt(depth) || 0 });
      });
      // Convert the flat list into nested line items based on depth
      const stack = [];
      const newLines = [];
      rows.forEach((row) => {
        const item = {
          description: row.description,
          qty: row.qty,
          cost: row.cost,
          sell: row.sell,
          margin: row.margin,
          markup: 0,
          isParent: false,
          expanded: true,
          parentId: null
        };
        if (row.depth === 0) {
          stack.length = 0;
          stack.push(item);
          newLines.push(item);
        } else {
          // parent is the last item in the stack at depth-1
          const parent = stack[row.depth - 1];
          if (!parent.children) parent.children = [];
          parent.isParent = true;
          parent.children.push(item);
          stack[row.depth] = item;
        }
      });
      // Flatten lines for database insertion.  Generate new UUIDs for
      // each row and set parentId to preserve hierarchy.  Children
      // reference the generated id of their parent.
      function flattenForDb(lines, parentId = null, acc = []) {
        lines.forEach((l) => {
          const id = randomUUID();
          acc.push({
            id,
            description: l.description,
            qty: l.qty,
            cost: l.cost,
            sell: l.sell,
            margin: l.margin,
            markup: l.markup || 0,
            isParent: !!l.children,
            expanded: l.expanded ?? true,
            parentId
          });
          if (l.children) flattenForDb(l.children, id, acc);
        });
        return acc;
      }
      const flat = flattenForDb(newLines);
      await prisma.$transaction(async (tx) => {
        await tx.lineItem.deleteMany({ where: { quoteId: id } });
        await tx.lineItem.createMany({ data: flat.map((l) => ({ ...l, quoteId: id })) });
      });
      return res.status(200).json({ message: 'Imported takeoff sheet' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to import takeoff' });
    }
  }
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method Not Allowed' });
}