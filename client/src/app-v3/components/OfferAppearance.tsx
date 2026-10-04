import { usePractice } from "@/features/practice/PracticeContext";
import { preparePromotionImage } from "@/lib/promotionImage";
import { useState, type Dispatch, type SetStateAction } from "react";
import { trpc } from "@/lib/trpc";
import type { OfferRules } from "../../../../shared/offerRules";
export function OfferAppearance({ rules, onChange, onUploading }: { rules: OfferRules; onChange: Dispatch<SetStateAction<OfferRules>>; onUploading: (busy: boolean) => void }) {
  const practice = usePractice();
  const upload = trpc.upload.uploadImage.useMutation();
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  async function image(file?: File) {
    if (!file) return;
    onUploading(true); setProcessing(true); setError(""); setStatus("Preparing WebP image…");
    try {
      const body = await preparePromotionImage(file);
      setStatus("Uploading image…");
      // Send the compressed image through our authenticated API. The server
      // writes to R2, without requiring browser-to-bucket CORS permissions.
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Couldn’t prepare the upload. Please try again."));
        reader.readAsDataURL(body);
      });
      const result = await upload.mutateAsync({ filename: "promotion.webp", contentType: "image/webp", base64, folder: "promotions" });
      onChange(current => ({ ...current, backgroundImageUrl: result.url }));
    } catch (e) { setError(e instanceof Error ? e.message : "Image upload failed. Please try again."); }
    finally { onUploading(false); setProcessing(false); setStatus(""); }
  }
  return <div className="ivory-promo-fields">
    <fieldset disabled={processing}>
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
    {practice ? <button type="button" onClick={() => practice.simulate("Use fixture artwork")}>Use mock background artwork</button> : <label>Background image (optional)<input type="file" accept="image/*" disabled={processing} onChange={e => { void image(e.target.files?.[0]); e.target.value=''; }} /></label>}
    {processing && <p role="status">{status}</p>}
    <p className="v3-muted">Images are automatically resized and converted to WebP before upload.</p>
    {error && <p role="alert">{error}</p>}
    {rules.backgroundImageUrl && <><img src={rules.backgroundImageUrl} alt="Promotion background preview" style={{width:'100%',maxHeight:160,objectFit:'cover',borderRadius:12}} /><button type="button" disabled={processing} onClick={()=>onChange({...rules,backgroundImageUrl:''})}>Remove image</button></>}
  </div>;
}
