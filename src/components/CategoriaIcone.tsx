import { emojiParaCategoria } from "@/lib/categoria-emoji";

export function CategoriaIcone({
  nome,
  cor,
  icone,
  size = 24,
  className,
}: {
  nome: string;
  cor: string;
  icone?: string | null;
  size?: number;
  className?: string;
}) {
  const emoji = emojiParaCategoria({ nome, icone });
  return (
    <div
      className={`grid place-items-center rounded-2xl shrink-0 ${className ?? ""}`}
      style={{
        width: size + 24,
        height: size + 24,
        background: `${cor}1f`,
        color: cor,
        fontSize: size,
        lineHeight: 1,
      }}
      aria-hidden="true"
    >
      <span style={{ fontSize: size }}>{emoji}</span>
    </div>
  );
}
