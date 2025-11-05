import { getSession } from 'next-auth/react';
import prisma from '../../../lib/prisma';

/**
 * API route for individual price book items.  Supports GET,
 * PUT, and DELETE operations.  PUT updates the item and
 * records a history entry for each changed field.  Only
 * admins and super admins may create or update entries.  Only
 * super admins may delete entries.
 */
export default async function handler(req, res) {
  const session = await getSession({ req });
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { id } = req.query;
  const role = session.user.role;
  // Load item to check existence and compute diffs
  const item = await prisma.priceBookItem.findUnique({
    where: { id },
    include: { histories: { orderBy: { createdAt: 'desc' } } }
  });
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  if (req.method === 'GET') {
    return res.status(200).json(item);
  }
  if (req.method === 'PUT') {
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { sku, description, cost, margin, sellPrice } = req.body || {};
    const updates = {};
    const historyEntries = [];
    const fields = { sku, description, cost: parseFloat(cost), margin: parseFloat(margin), sellPrice: parseFloat(sellPrice) };
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== item[key]) {
        updates[key] = value;
        historyEntries.push({
          fieldChanged: key,
          oldValue: item[key] != null ? String(item[key]) : null,
          newValue: String(value),
          changedBy: { connect: { id: session.user.id } }
        });
      }
    });
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const updatedItem = await tx.priceBookItem.update({ where: { id }, data: updates });
        if (historyEntries.length) {
          await tx.priceBookHistory.createMany({
            data: historyEntries.map((h) => ({ ...h, priceBookItemId: id }))
          });
        }
        return updatedItem;
      });
      return res.status(200).json(updated);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to update item' });
    }
  }
  if (req.method === 'DELETE') {
    if (role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only super admins can delete items' });
    }
    try {
      await prisma.priceBookItem.delete({ where: { id } });
      return res.status(204).end();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to delete item' });
    }
  }
  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ error: 'Method Not Allowed' });
}