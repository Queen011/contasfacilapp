import {
  Lightbulb, Wifi, Droplet, Flame, CreditCard, Receipt, Car,
  FileText, Home, Tv, Tag, type LucideIcon,
} from "lucide-react";

const map: Record<string, LucideIcon> = {
  Lightbulb, Wifi, Droplet, Flame, CreditCard, Receipt, Car, FileText, Home, Tv, Tag,
};

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
  const Icon = map[nome] ?? Tag;
  return (
    <div
      className={`grid place-items-center rounded-2xl shrink-0 ${className ?? ""}`}
      style={{
        width: size + 24,
        height: size + 24,
        background: `${cor}1f`,
        color: cor,
      }}
    >
      <Icon size={size} strokeWidth={2.2} />
    </div>
  );
}
