import type { NextApiRequest, NextApiResponse } from 'next';
import FormData from 'form-data';

export const config = { api: { bodyParser: false } };

async function parseMultipart(req: NextApiRequest): Promise<{ image: Buffer; style: string; filename: string; }>{
  const busboy = require('busboy');
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });
    let img: Buffer | null = null;
    let filename = 'upload.jpg';
    let style = 'pixar';

    bb.on('file', (_: string, file: any, info: any) => {
      filename = info?.filename || filename;
      const chunks: Buffer[] = [];
      file.on('data', (d: Buffer) => chunks.push(d));
      file.on('end', () => { img = Buffer.concat(chunks); });
    });

    bb.on('field', (name: string, val: string) => { if (name === 'style') style = val; });

    bb.on('close', () => {
      if (!img) return reject(new Error('image not found'));
      resolve({ image: img!, style, filename });
    });
    bb.on('error', reject);
    (req as any).pipe(bb);
  });
}

function styleToPrompt(style: string) {
  const base =
    'Turn the person in the input photo into a full-body toy figure while preserving identity cues. Clean studio background, appealing proportions, smooth edges, high quality render.';
  switch (style) {
    case 'pixar':     return base + ' Style: Pixar-inspired, large expressive eyes, soft materials, cinematic lighting.';
    case 'funko':     return base + ' Style: Funko Pop-inspired, chibi proportions, big head small body, matte finish.';
    case 'realistic': return base + ' Style: Realistic figurine render, natural textures, true-to-life colors.';
    case 'cartoon':   return base + ' Style: Bold cartoon lines, saturated colors, simplified shapes.';
    default:          return base;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY missing on server' });

    const { image, style, filename } = await parseMultipart(req);
    const prompt = styleToPrompt(style);

    // 🔧 DÜZELTME: images/edits için alan adı 'image' olmalı
    const form = new FormData();
    form.append('model', 'gpt-image-1');
    form.append('prompt', prompt);
    form.append('image', image as any, { filename, contentType: 'image/jpeg' }); // ← burada 'image'
    form.append('size', '1024x1024');

    const r = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders() },
      body: form as any,
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('OpenAI error', r.status, errText);
      return res.status(r.status).json({ error: errText });
    }

    const out = await r.json();
    const b64 = out?.data?.[0]?.b64_json;
    if (!b64) return res.status(500).json({ error: 'No image returned' });

    return res.status(200).json({ image: `data:image/png;base64,${b64}` });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Internal Error' });
  }
}
