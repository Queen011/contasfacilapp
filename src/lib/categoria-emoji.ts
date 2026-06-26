// Mapa de categoria → emoji. Usado tanto nos cards quanto na tela "Nova conta".
// As chaves cobrem o nome e variações de acento/case que vêm do banco.
const EMOJIS: Record<string, string> = {
  luz: "💡",
  internet: "📶",
  agua: "💧",
  "água": "💧",
  gas: "🔥",
  "gás": "🔥",
  cartao: "💳",
  "cartão": "💳",
  boleto: "🧾",
  ipva: "🚗",
  carro: "🚗",
  mei: "📄",
  aluguel: "🏠",
  casa: "🏠",
  streaming: "📺",
  tv: "📺",
  mercado: "🛒",
  comida: "🍔",
  saude: "💊",
  "saúde": "💊",
  educacao: "🎓",
  "educação": "🎓",
  outros: "🏷️",
};

export function emojiDaCategoria(nome: string | null | undefined): string {
  if (!nome) return "🏷️";
  const k = nome.toString().trim().toLowerCase();
  return EMOJIS[k] ?? "🏷️";
}
