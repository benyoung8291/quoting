import { getSession } from 'next-auth/react';
import fs from 'fs';
import path from 'path';

/**
 * API route for managing Word templates.  Templates are stored
 * on disk under /public/templates.  The GET handler lists
 * available templates by filename.  The POST handler accepts a
 * base64 encoded DOCX file and a name, and writes it to disk.
 * Only admins and super admins can upload templates.
 */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb' // Allow large uploads
    }
  }
};

export default async function handler(req, res) {
  const session = await getSession({ req });
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const role = session.user.role;
  const templatesDir = path.join(process.cwd(), 'public', 'templates');
  if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir, { recursive: true });
  if (req.method === 'GET') {
    const files = fs.readdirSync(templatesDir).filter((f) => f.endsWith('.docx'));
    const names = files.map((f) => path.basename(f, '.docx'));
    return res.status(200).json(names);
  }
  if (req.method === 'POST') {
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { name, file } = req.body || {};
    if (!name || !file) {
      return res.status(400).json({ error: 'Name and file are required' });
    }
    try {
      const buffer = Buffer.from(file.split(',').pop(), 'base64');
      const filePath = path.join(templatesDir, `${name}.docx`);
      fs.writeFileSync(filePath, buffer);
      return res.status(201).json({ message: 'Template uploaded' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to save template' });
    }
  }
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method Not Allowed' });
}