import { getSession } from 'next-auth/react';
import prisma from '../../../../lib/prisma';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import fs from 'fs';
import path from 'path';
import { chromium } from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

/**
 * API route for exporting quotes as Word (.docx) or PDF documents.
 *
 * Query parameters:
 *   format=docx|pdf (default: docx)
 *   template=templateName (without extension) – optional template
 *
 * A template must exist under /public/templates with the
 * `.docx` extension.  The template may include placeholders
 * matching the keys of the `data` object below (e.g.
 * {{quoteName}}, {{client}}, {{date}}, {{expiryDate}}).  If a
 * template is not found an error is returned.
 */
export default async function handler(req, res) {
  const session = await getSession({ req });
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { id } = req.query;
  const format = req.query.format || 'docx';
  const templateName = req.query.template || 'default';
  // Fetch quote and lines
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
  if (format === 'docx') {
    try {
      const templatePath = path.join(process.cwd(), 'public', 'templates', `${templateName}.docx`);
      if (!fs.existsSync(templatePath)) {
        return res.status(404).json({ error: 'Template not found' });
      }
      const content = fs.readFileSync(templatePath, 'binary');
      const zip = new PizZip(content);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      // Prepare data for templating
      function flattenLines(lines, acc = []) {
        lines.forEach((l) => {
          acc.push({ description: l.description, qty: l.qty, cost: l.cost, sell: l.sell, margin: l.margin });
          if (l.children && l.children.length) flattenLines(l.children, acc);
        });
        return acc;
      }
      const lines = flattenLines(quote.lines);
      const data = {
        quoteName: quote.name,
        client: quote.client,
        date: quote.date ? new Date(quote.date).toLocaleDateString() : '',
        expiryDate: quote.expiryDate ? new Date(quote.expiryDate).toLocaleDateString() : '',
        status: quote.status,
        summary: quote.summary,
        address: quote.address,
        lines
      };
      doc.setData(data);
      doc.render();
      const buf = doc.getZip().generate({ type: 'nodebuffer' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="quote-${id}.docx"`);
      return res.send(buf);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to generate docx' });
    }
  }
  if (format === 'pdf') {
    try {
      // Render a simple HTML representation of the quote.  A real
      // implementation would leverage a dedicated PDF template.
      function renderLines(lines) {
        return lines
          .map((l) => `
            <tr>
              <td>${l.description}</td>
              <td>${l.qty}</td>
              <td>${l.cost}</td>
              <td>${l.sell}</td>
              <td>${l.margin}</td>
            </tr>
            ${l.children && l.children.length ? renderLines(l.children) : ''}
          `)
          .join('');
      }
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 1.3rem; margin-bottom: .5rem; }
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          th, td { border: 1px solid #ccc; padding: 4px; font-size: .8rem; }
          th { background: #f0f0f0; }
        </style>
        </head><body>
          <h1>Quote ${quote.id}</h1>
          <p><strong>Name:</strong> ${quote.name}</p>
          <p><strong>Client:</strong> ${quote.client}</p>
          <p><strong>Date:</strong> ${quote.date ? new Date(quote.date).toLocaleDateString() : ''}</p>
          <p><strong>Expiry:</strong> ${quote.expiryDate ? new Date(quote.expiryDate).toLocaleDateString() : ''}</p>
          <table><thead><tr><th>Description</th><th>Qty</th><th>Cost</th><th>Sell</th><th>Margin</th></tr></thead><tbody>
          ${renderLines(quote.lines)}
          </tbody></table>
        </body></html>`;
      // Launch headless Chromium.  The @sparticuz/chromium package
      // provides a version of Chromium that works in serverless
      // environments.
      const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: true
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4' });
      await browser.close();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="quote-${id}.pdf"`);
      return res.send(pdfBuffer);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to generate PDF' });
    }
  }
  return res.status(400).json({ error: 'Invalid format' });
}