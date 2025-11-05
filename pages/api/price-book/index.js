import { getSession } from 'next-auth/react';
import prisma from '../../../lib/prisma';

/**
 * API route for the price book.  The GET handler returns all
 * price book items ordered by SKU.  The POST handler allows
 * admins to create a new price book entry.  Each creation is
 * recorded in PriceBookHistory.
 */
export default async function handler(req, res) {
  const session = await getSession({ req });
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const role = session.user.role;
  if (req.method === 'GET') {
    try {
      const items = await prisma.priceBookItem.findMany({ orderBy: { sku: 'asc' } });
      return res.status(200).json(items);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to fetch price book' });
    }
  }
  if (req.method === 'POST') {
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { sku, description, cost, margin, sellPrice } = req.body || {};
    if (!sku || !description) {
      return res.status(400).json({ error: 'SKU and description are required' });
    }
    try {
      const item = await prisma.priceBookItem.create({
        data: {
          sku,
          description,
          cost: parseFloat(cost) || 0,
          margin: parseFloat(margin) || 0,
          sellPrice: parseFloat(sellPrice) || 0,
          createdBy: { connect: { id: session.user.id } },
          histories: {
            create: [
              {
                fieldChanged: 'created',
                oldValue: null,
                newValue: JSON.stringify({ sku, description, cost, margin, sellPrice }),
                changedBy: { connect: { id: session.user.id } }
              }
            ]
          }
        }
      });
      return res.status(201).json(item);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to create price book item' });
    }
  }
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method Not Allowed' });
}