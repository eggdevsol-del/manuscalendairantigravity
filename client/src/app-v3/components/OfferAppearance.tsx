import { useState, type Dispatch, type SetStateAction } from "react";
import { trpc } from "@/lib/trpc";
import type { OfferRules } from "../../../../shared/offerRules";
export function OfferAppearance({ rules, onChange, onUploading }: { rules: OfferRules; onChange: Dispatch<SetStateAction<OfferRules>>; onUploading: (busy: boolean) => void }) {
  const upload = trpc.upload.uploadImage.useMutation();
  const [error, setError] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  async function image(file?: File) {
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10*1024*1024) { setError("Choose a JPG, PNG or WebP image under 10 MB."); return; }
    onUploading(true); setError("");
    try {
      const fileData = await new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      const result = await upload.mutateAsync({ fileName: file.name, contentType: file.type, fileData });
      onChange(current => ({ ...current, backgroundImageUrl: result.url }));
    } catch { setError("Image upload failed. Please try again."); }
    finally { onUploading(false); }
  }
  return <div className="ivory-promo-fields">
    <fieldset disabled={upload.isPending}>
      <legend>Offer for the month/months of</legend>
      <label>Year<select value={year} onChange={e => setYear(Number(e.target.value))}>{Array.from({length:6},(_,i)=>new Date().getFullYear()+i).map(y=><option key={y}>{y}</option>)}</select></label>
      <div className="ivory-months">{Array.from({length:12},(_,i)=>{
        const value = `${year}-${String(i+1).padStart(2,'0')}`;
        return <label className="ivory-offer-check" key={value}><input type="checkbox" checked={rules.sittingMonths?.includes(value) || false} onChange={e => onChange({ ...rules, sittingFrom:null, sittingUntil:null, sittingMonths:e.target.checked ? [...(rules.sittingMonths || []),value].sort() : rules.sittingMonths?.filter(m=>m!==value) })} />{new Intl.DateTimeFormat('en',{month:'short'}).format(new Date(year,i,1))}</label>;
      })}</div>
      <p className="v3-muted">{rules.sittingMonths?.length ? `Selected: ${rules.sittingMonths.join(', ')}` : 'No months selected: any month.'}</p>
      {(rules.sittingFrom || rules.sittingUntil) && <p>Existing date restriction: {rules.sittingFrom?.slice(0,10) || 'Any start'} – {rules.sittingUntil?.slice(0,10) || 'Any end'}. Selecting months replaces it.</p>}
      <button type="button" onClick={()=>onChange({...rules,sittingMonths:[],sittingFrom:null,sittingUntil:null})}>Allow any month</button>
    </fieldset>
    <label>Background image (optional)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={upload.isPending} onChange={e => { void image(e.target.files?.[0]); e.target.value=''; }} /></label>
    {upload.isPending && <p role="status">Uploading image…</p>}
    {error && <p role="alert">{error}</p>}
    {rules.backgroundImageUrl && <><img src={rules.backgroundImageUrl} alt="Promotion background preview" style={{width:'100%',maxHeight:160,objectFit:'cover',borderRadius:12}} /><button type="button" disabled={upload.isPending} onClick={()=>onChange({...rules,backgroundImageUrl:''})}>Remove image</button></>}
  </div>;
}
