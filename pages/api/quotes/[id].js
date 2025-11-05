import { getSession } from 'next-auth/react';
import prisma from '../../../lib/prisma';
import { randomUUID } from 'crypto';

/**
 * API route for a single quote.  Provides GET, PUT and DELETE
 * handlers.  Only the owner of a quote or an admin/super admin
 * can modify or delete it.  Updates accept partial quote
 * properties and will also handle nested line items if present.
 */
export default async function handler(req, res) {
  const session = await getSession({ req });
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { id } = req.query;
  const userId = session.user.id;
  const userRole = session.user.role;
  // fetch quote once for permission checks
  const existing = await prisma.quote.findUnique({ where: { id }, include: { owner: true } });
  if (!existing) {
    return res.status(404).json({ error: 'Quote not found' });
  }
  const canModify = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || existing.ownerId === userId;
  if (req.method === 'GET') {
    try {
      const quote = await prisma.quote.findUnique({
        where: { id },
        include: {
          lines: { include: { children: true } },
          owner: { select: { id: true, name: true, email: true } }
        }
      });
      return res.status(200).json(quote);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to fetch quote' });
    }
  }
  if (req.method === 'PUT') {
    if (!canModify) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    try {
      const data = req.body || {};
      // If lines are included in the payload update them individually.
      // For simplicity this example replaces all existing line items
      // with the provided set.  A production system could diff
      // changes to avoid deleting old lines.
      let linesData;
      if (Array.isArray(data.lines)) {
        /**
         * Flatten nested line items into a flat list.  Each item
         * receives a new UUID.  Children reference their parent
         * via the generated id.  The function recursively walks
         * the input structure and accumulates flat records.  This
         * ensures parent/child relationships are preserved when
         * storing in the database.
         *
         * @param {Array} lines - array of line items with optional children
         * @param {String|null} parentId - id of the parent line if any
         * @param {Array} acc - accumulator for flat records
         * @returns {Array} flattened records
         */
        function flattenLines(lines, parentId = null, acc = []) {
          lines.forEach((item) => {
            const id = randomUUID();
            const record = {
              id,
              description: item.description,
              qty: item.qty,
              cost: item.cost,
              markup: item.markup,
              sell: item.sell,
              margin: item.margin,
              isParent: !!(item.children && item.children.length),
              expanded: item.expanded,
              parentId
            };
            acc.push(record);
            if (item.children && item.children.length) {
              flattenLines(item.children, id, acc);
            }
          });
          return acc;
        }
        linesData = flattenLines(data.lines);
        delete data.lines;
      }
      const quote = await prisma.$transaction(async (tx) => {
        // update quote core fields
        const updatedQuote = await tx.quote.update({
          where: { id },
          data: {
            name: data.name,
            client: data.client,
            status: data.status,
            probability: data.probability,
            date: data.date ? new Date(data.date) : undefined,
            expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
            stage: data.stage,
            summary: data.summary,
            address: data.address,
            descriptionHtml: data.descriptionHtml,
            descriptionInitialized: data.descriptionInitialized,
            archived: data.archived
          }
        });
        if (linesData) {
          // Remove existing lines
          await tx.lineItem.deleteMany({ where: { quoteId: id } });
          // Recreate lines
          await tx.lineItem.createMany({ data: linesData.map((l) => ({ ...l, quoteId: id })) });
        }
        return updatedQuote;
      });
      return res.status(200).json(quote);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to update quote' });
    }
  }
  if (req.method === 'DELETE') {
    if (!canModify) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    try {
      await prisma.quote.delete({ where: { id } });
      return res.status(204).end();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to delete quote' });
    }
  }
  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ error: 'Method Not Allowed' });
}