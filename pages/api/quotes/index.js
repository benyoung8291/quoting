import { getSession } from 'next-auth/react';
import prisma from '../../../lib/prisma';

/**
 * API route for creating and retrieving quotes.  The GET handler
 * returns a list of quotes for the current user.  Super admins
 * and admins receive all quotes, while regular users only see
 * their own.  The POST handler creates a new quote with the
 * current user as the owner.  Date and expiry are defaulted
 * automatically if not provided.  The response includes the
 * newly created quote record.
 */
export default async function handler(req, res) {
  const session = await getSession({ req });
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = session.user.id;
  const userRole = session.user.role;
  if (req.method === 'GET') {
    try {
      const where = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' ? {} : { ownerId: userId };
      const quotes = await prisma.quote.findMany({
        where,
        include: {
          lines: {
            include: { children: true }
          },
          owner: { select: { id: true, name: true, email: true } }
        },
        orderBy: { updatedAt: 'desc' }
      });
      return res.status(200).json(quotes);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to fetch quotes' });
    }
  }
  if (req.method === 'POST') {
    const { name, client, status, probability, date, expiryDate, stage, summary, address } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'Quote name is required' });
    }
    try {
      const now = new Date();
      const quoteDate = date ? new Date(date) : now;
      const expiry = expiryDate ? new Date(expiryDate) : new Date(quoteDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const quote = await prisma.quote.create({
        data: {
          name,
          client: client || '',
          status: status || 'Draft',
          probability: probability ?? 0,
          date: quoteDate,
          expiryDate: expiry,
          stage: stage || 'Lead',
          summary: summary || '',
          address: address || '',
          descriptionHtml: '',
          descriptionInitialized: false,
          archived: false,
          owner: { connect: { id: userId } },
          lines: { create: [] }
        }
      });
      return res.status(201).json(quote);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to create quote' });
    }
  }
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method Not Allowed' });
}