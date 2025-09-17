import React, { useState, useRef } from 'react';

export default function Embed(){
  const [file, setFile] = useState<File|null>(null);
  const [style, setStyle] = useState('pixar');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [previewUrl, setPreviewUrl] = useState<string|null>(null);
  const [consent, setConsent] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const onFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError(null);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    onFile(f || null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    onFile(f || null);
    dropRef.current?.classList.remove('drop-over');
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); dropRef.current?.classList.add('drop-over'); };
  const handleDragLeave = () => dropRef.current?.classList.remove('drop-over');

  const handleGenerate = async () => {
    if (!file) return setError('Lütfen bir fotoğraf seçin.');
    if (!consent) return setError('KVKK/Aydınlatma onayını işaretleyin.');

    setLoading(true); setError(null);
    const form = new FormData();
    form.append('image', file);
    form.append('style', style);

    try {
      const res = await fetch('/api/generate-openai', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : `Sunucu hatası: ${res.status}`);
      setPreviewUrl(data.image);
    } catch (e: any) {
      setError(e.message || 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = () => {
    window.parent?.postMessage({ type: 'FIGUR_APPROVED', payload: { style, image: previewUrl } }, '*');
    alert('Önizleme onaylandı. Sipariş akışına bağlayabilirsiniz.');
  };

  return (
    <div className="wrap">
      <div className="card">
        <h1 className="title">Fotoğraftan Figüre Dönüştür (OpenAI)</h1>

        <div className="grid">
          <div>
            <label className="label">Fotoğraf Yükle</label>

            <div
              ref={dropRef}
              className="dropzone"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <input id="file" type="file" accept="image/*" onChange={handleInput} />
              <p><b>Dosya seç</b> ya da görseli buraya sürükle-bırak</p>
            </div>

            {previewUrl && (
              <div className="preview">
                <img src={previewUrl} alt="preview" />
              </div>
            )}
          </div>

          <div>
            <label className="label">Stil Seçimi</label>
            <div className="options">
              {[
                {id:'pixar', label:'Pixar'},
                {id:'funko', label:'Funko'},
                {id:'realistic', label:'Realistik'},
                {id:'cartoon', label:'Karikatürize'},
              ].map(o => (
                <label key={o.id} className="opt">
                  <input type="radio" name="style" value={o.id} checked={style===o.id} onChange={()=>setStyle(o.id)} />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>

            <label className="consent">
              <input type="checkbox" checked={consent} onChange={()=>setConsent(v=>!v)} />
              Bu fotoğrafın işlenmesine ve yapay zekâ ile önizleme oluşturulmasına onay veriyorum.
            </label>

            <button className="btn" onClick={handleGenerate} disabled={loading}>
              {loading ? 'Dönüştürülüyor…' : 'Önizlemeyi Oluştur'}
            </button>

            {error && <div className="alert">{error}</div>}

            {previewUrl && !loading && (
              <div className="actions">
                <button className="btn-sec" onClick={handleApprove}>Onayla ve Devam Et</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .wrap { display:flex; justify-content:center; padding:32px; background:#f7f7fb; min-height:100vh; }
        .card { width:100%; max-width:980px; background:#fff; border:1px solid #eee; border-radius:16px; padding:24px; box-shadow:0 10px 30px rgba(16,24,40,.06); }
        .title { margin:0 0 16px; font-size:28px; }
        .label { display:block; font-weight:600; margin:8px 0; }
        .grid { display:grid; grid-template-columns:1.1fr .9fr; gap:24px; }
        @media (max-width:900px){ .grid { grid-template-columns:1fr; } }
        .dropzone { border:2px dashed #d1d5db; border-radius:12px; padding:24px; text-align:center; color:#6b7280; background:#fafafa; position:relative; }
        .dropzone input[type="file"] { position:absolute; inset:0; opacity:0; cursor:pointer; }
        .drop-over { background:#f0f6ff; border-color:#3b82f6; color:#3b82f6; }
        .preview { margin-top:12px; border:1px solid #eee; border-radius:12px; overflow:hidden; }
        .preview img { width:100%; display:block; }
        .options { display:flex; flex-wrap:wrap; gap:12px; margin:8px 0 16px; }
        .opt { display:flex; align-items:center; gap:8px; padding:8px 12px; border:1px solid #e5e7eb; border-radius:999px; }
        .consent { display:flex; gap:8px; align-items:flex-start; margin:6px 0 14px; color:#475569; }
        .btn { width:100%; padding:12px 16px; border-radius:10px; background:#111827; color:#fff; font-weight:600; border:0; cursor:pointer; }
        .btn[disabled] { opacity:.6; cursor:not-allowed; }
        .btn-sec { width:100%; padding:12px 16px; border-radius:10px; background:#fff; border:1px solid #e5e7eb; font-weight:600; cursor:pointer; }
        .alert { margin-top:12px; background:#fee2e2; color:#991b1b; padding:10px 12px; border-radius:10px; border:1px solid #fecaca; }
        .actions { margin-top:12px; }
      `}</style>
    </div>
  );
}
