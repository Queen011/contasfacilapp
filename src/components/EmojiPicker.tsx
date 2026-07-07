import { useState } from "react";
import { EMOJIS_SUGERIDOS, isEmoji } from "@/lib/categoria-emoji";
import { Input } from "@/components/ui/input";

export function EmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [livre, setLivre] = useState(value && !EMOJIS_SUGERIDOS.includes(value) ? value : "");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-8 gap-1.5">
        {EMOJIS_SUGERIDOS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => { onChange(e); setLivre(""); }}
            className={`h-10 w-full rounded-xl text-xl grid place-items-center border transition ${
              value === e ? "border-primary bg-secondary" : "border-border bg-card"
            }`}
            aria-label={`Escolher ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">
          Ou digite/cole um emoji
        </label>
        <Input
          value={livre}
          onChange={(ev) => {
            const v = ev.target.value.trim();
            setLivre(v);
            if (isEmoji(v)) onChange(v);
          }}
          placeholder="Ex: 🐶"
          maxLength={4}
          className="text-xl h-12"
        />
      </div>
    </div>
  );
}
