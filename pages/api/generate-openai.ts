import type { NextApiRequest, NextApiResponse } from 'next';
import FormData from 'form-data';

export const config = { api: { bodyParser: false } };

// busboy ile multipart okuma (ekstra type paketine gerek yok)
async function parseMultipart(
  req: NextApiRequest
): Promise<{ image: Buffer; style: string; filename: string }> {
  const busboy = require('busboy');
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });
    let img: Buffer | null = null;
    let filename = 'upload.png';
    let style = 'pixar';

    bb.on('file', (_: string, file: any, info: any) => {
      filename = info?.filename || filename;
      const chunks: Buffer[] = [];
      file.on('data', (d: Buffer) => chunks.push(d));
      file.on('end', () => { img = Buffer.concat(chunks); });
    });

    bb.on('field', (name: string, val: string) => {
      if (name === 'style') style = val;
    });

    bb.on('close', () => {
      if (!img || img.length === 0) return reject(new Error('image not found or empty'));
      resolve({ image: img, style, filename });
    });

    bb.on('error', reject);
    (req as any).pipe(bb);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY missing on server' });

    const { image, /*style*/, filename } = await parseMultipart(req);

    // Variations endpoint — prompt almaz, sadece görsel bekler
    const form = new FormData();
    form.append('model', 'gpt-image-1');
    form.append('image', image as any, {
      filename: filename || 'upload.png',
      // Bazı durumlarda JPG kabul etmeyebilir; generic akış iyi çalışıyor:
      contentType: 'application/octet-stream'
    });
    form.append('size', '1024x1024');

    const r = await fetch('https://api.openai.com/v1/images/variations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders() },
      body: form as any,
    });

    const text = await r.text();
    if (!r.ok) {
      // PNG gereksinimi gibi tipik 400'leri daha anlaşılır döndürelim
      if (/png/i.test(text)) {
        return res.status(400).json({ error: 'OpenAI PNG bekliyor. Lütfen PNG yükleyin veya JPG’yi PNG’ye çevirin.' });
      }
      try { return res.status(r.status).json(JSON.parse(text)); }
      catch { return res.status(r.status).json({ error: text }); }
    }

    const out = JSON.parse(text);
    const b64 = out?.data?.[0]?.b64_json;
    if (!b64) return res.status(500).json({ error: 'No image returned' });

    return res.status(200).json({ image: `data:image/png;base64,${b64}` });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e?.message || 'Internal Error' });
  }
}
