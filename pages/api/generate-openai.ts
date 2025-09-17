import type { NextApiRequest, NextApiResponse } from 'next';
import FormData from 'form-data';

export const config = { api: { bodyParser: false } };

// ---- multipart parse (busboy) ----
async function parseMultipart(
  req: NextApiRequest
): Promise<{ image: Buffer; style: string; filename: string }> {
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
      if (!img || img.length === 0) return reject(new Error('image not found or empty'));
      resolve({ image: img, style, filename });
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

async function callOpenAI(form: FormData, apiKey: string) {
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
    body: form as any,
  });
  return res;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY missing on server' });

    const { image, style, filename } = await parseMultipart(req);
    const prompt = styleToPrompt(style);

    // ---- TRY #1: alan adı 'image' ----
    const form1 = new FormData();
    form1.append('model', 'gpt-image-1');
    form1.append('prompt', prompt);
    form1.append('image', image as any, { filename, contentType: 'application/octet-stream' });
    form1.append('size', '1024x1024');

    let r = await callOpenAI(form1, OPENAI_API_KEY);

    // 400 ve multipart parse hatası ise TRY #2: 'image[]'
    if (!r.ok) {
      const txt = await r.text();
      const maybeMultipartErr =
        r.status === 400 && /invalid_multipart_form_data|failed to parse multipart/i.test(txt);

      if (maybeMultipartErr) {
        const form2 = new FormData();
        form2.append('model', 'gpt-image-1');
        form2.append('prompt', prompt);
        form2.append('image[]', image as any, { filename, contentType: 'application/octet-stream' });
        form2.append('size', '1024x1024');
        r = await callOpenAI(form2, OPENAI_API_KEY);

        if (!r.ok) {
          return res.status(r.status).json({ error: JSON.parse(txt)?.error ?? txt });
        }
      } else {
        // başka bir hata
        return res.status(r.status).json({ error: (() => { try { return JSON.parse(txt); } catch { return txt; } })() });
      }
    }

    const out = await r.json();
    const b64 = out?.data?.[0]?.b64_json;
    if (!b64) return res.status(500).json({ error: 'No image returned' });

    return res.status(200).json({ image: `data:image/png;base64,${b64}` });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Internal Error' });
  }
}
