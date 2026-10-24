import { useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/admin";

export function ImageField({ value, onChange, folder, label = "Immagine" }: { value: string | null | undefined; onChange: (url: string) => void; folder: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3">
      {value ? <img src={value} alt="" className="h-16 w-16 rounded object-cover" /> : <div className="h-16 w-16 rounded bg-muted" />}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {label}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              onChange(await uploadImage(file, folder));
            } catch {
              toast.error("Caricamento non riuscito");
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {value && (
        <button type="button" onClick={() => onChange("")} className="text-muted-foreground hover:text-destructive" aria-label="Rimuovi"><X className="h-4 w-4" /></button>
      )}
    </div>
  );
}
