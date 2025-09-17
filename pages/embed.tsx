import React, { useState } from 'react';

export default function Embed(){
  const [file, setFile] = useState<File|null>(null);
  const [style, setStyle] = useState('pixar');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [previewUrl, setPreviewUrl] = useState<string|null>(null);
  const [consent, setConsent] = useState(false);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (f) setFile(f);
    setPreviewUrl(null); setError(null);
  };

  const handleGenerate = async () => {
    if (!file) return setError('Lütfen bir fotoğraf seçin.');
    if (!consent) return setError('KVKK/Aydınlatma onayını işaretleyin.');
    setLoading(true); setError(null); setPreviewUrl(null);

    const form = new FormData();
    form.append('image', file);
    form.append('style', style);

    try {
      const res = await fetch('/api/generate-openai', { method: 'POST', body: form });
      if (!res.ok) throw new Error(`Sunucu hatası: ${res.status}`);
      const data = await res.json();
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
    <div style={{maxWidth: 820, margin: '0 auto', fontFamily: 'Inter, system-ui, Arial'}}>
      <h1 style={{fontSize: 28, fontWeight: 700, margin: '24px 0'}}>Fotoğraftan Figüre Dönüştür (OpenAI)</h1>

      <div style={{display:'grid', gap:12}}>
        <label><b>Fotoğraf Yükle</b>
          <input type="file" accept="image/*" onChange={onFile} style={{display:'block', marginTop: 8}} />
        </label>

        <label><b>Stil Seçimi</b>
          <div style={{display:'flex', gap:12, marginTop:8, flexWrap:'wrap'}}>
            {[
              {id:'pixar', label:'Pixar'},
              {id:'funko', label:'Funko'},
              {id:'realistic', label:'Realistik'},
              {id:'cartoon', label:'Karikatürize'},
            ].map(o => (
              <label key={o.id} style={{display:'flex', alignItems:'center', gap:6}}>
                <input type="radio" name="style" value={o.id} checked={style===o.id} onChange={()=>setStyle(o.id)} /> {o.label}
              </label>
            ))}
          </div>
        </label>

        <label style={{display:'flex', gap:8, alignItems:'flex-start'}}>
          <input type="checkbox" checked={consent} onChange={()=>setConsent(v=>!v)} />
          <span>Bu fotoğrafın işlenmesine ve yapay zekâ ile önizleme oluşturulmasına onay veriyorum.</span>
        </label>

        <div>
          <button onClick={handleGenerate} disabled={loading} style={{padding:'12px 16px', borderRadius:10, border:'1px solid #ddd', cursor:'pointer', fontWeight:600}}>
            {loading ? 'Dönüştürülüyor…' : 'Önizlemeyi Oluştur'}
          </button>
        </div>

        {error && <div style={{background:'#ffe7e7', color:'#a40000', padding:12, borderRadius:8}}>{error}</div>}

        {previewUrl && (
          <div style={{marginTop:16}}>
            <b>Önizleme</b>
            <div style={{marginTop:8}}>
              <img src={previewUrl} alt="preview" style={{maxWidth:'100%', borderRadius:12, border:'1px solid #eee'}} />
            </div>
            <div style={{marginTop:12}}>
              <button onClick={handleApprove} style={{padding:'12px 16px', borderRadius:10, border:'1px solid #ddd', cursor:'pointer', fontWeight:600}}>Onayla ve Devam Et</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
