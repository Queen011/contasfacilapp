import { emojiDaCategoria } from "@/lib/categoria-emoji";

export function CategoriaIcone({
  nome,
  cor,
  size = 24,
  className,
}: {
  nome: string;
  cor: string;
  size?: number;
  className?: string;
}) {
  const emoji = emojiDaCategoria(nome);
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
