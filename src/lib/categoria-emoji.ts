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

const emojiRegex = /\p{Extended_Pictographic}/u;

/** Verifica se uma string é um emoji (pictograma unicode). */
export function isEmoji(value: string | null | undefined): boolean {
  if (!value) return false;
  return emojiRegex.test(value);
}

/** Emoji só pelo nome (compatibilidade). */
export function emojiDaCategoria(nome: string | null | undefined): string {
  if (!nome) return "🏷️";
  const k = nome.toString().trim().toLowerCase();
  return EMOJIS[k] ?? "🏷️";
}

/** Emoji a partir de icone (se for emoji) ou fallback pelo nome. */
export function emojiParaCategoria(
  cat: { nome?: string | null; icone?: string | null } | null | undefined,
): string {
  if (!cat) return "🏷️";
  if (isEmoji(cat.icone)) return cat.icone as string;
  return emojiDaCategoria(cat.nome);
}

/** Emojis sugeridos no seletor de categoria. */
export const EMOJIS_SUGERIDOS: string[] = [
  "💡","📶","💧","🔥","💳","🧾","🚗","📄","🏠","📺",
  "🛒","🍔","💊","🎓","🏷️","💰","💵","💸","📱","💻",
  "🎮","🎬","🎵","☕","🍺","🏋️","⛽","🚌","✈️","🐾",
  "👶","🎁","📚","🧹","🛠️","🔑","🩺","👕","💍","🌐",
];
