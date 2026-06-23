/**
 * Parser de boleto bancário (linha digitável 47 dígitos / código de barras 44)
 * e Pix copia-e-cola (formato EMV).
 *
 * O que conseguimos extrair:
 * - Boleto bancário: valor + vencimento (NÃO traz nome do beneficiário)
 * - Boleto de concessionária (48 dígitos, começa com 8): valor
 * - Pix copia-e-cola: valor + nome do recebedor
 */

export type CodigoExtraido = {
  valor?: number;
  vencimento?: string; // ISO yyyy-mm-dd
  nome?: string;
  tipo: "boleto-bancario" | "boleto-arrecadacao" | "pix" | "desconhecido";
};

/** Fator de vencimento → data (base 07/10/1997, padrão Febraban) */
function fatorParaData(fator: number): string | undefined {
  if (!fator || fator < 1000) return undefined;
  const base = new Date(Date.UTC(1997, 9, 7));
  const d = new Date(base.getTime() + fator * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function parseBoletoBancario(digitos: string): CodigoExtraido {
  // Linha digitável (47) → reorganiza para barcode (44)
  let barcode = digitos;
  if (digitos.length === 47) {
    barcode =
      digitos.substring(0, 4) +
      digitos.substring(32, 33) +
      digitos.substring(33, 37) +
      digitos.substring(37, 47) +
      digitos.substring(4, 9) +
      digitos.substring(10, 20) +
      digitos.substring(21, 31);
  }
  if (barcode.length !== 44) return { tipo: "desconhecido" };

  const fator = parseInt(barcode.substring(5, 9), 10);
  const valorCent = parseInt(barcode.substring(9, 19), 10);
  const valor = valorCent > 0 ? valorCent / 100 : undefined;
  const vencimento = fatorParaData(fator);

  return { tipo: "boleto-bancario", valor, vencimento };
}

function parseBoletoArrecadacao(digitos: string): CodigoExtraido {
  // Concessionária: 48 dígitos, começa com 8.
  // Valor: posições 5-14 (10 dígitos), 2 casas decimais.
  if (digitos.length !== 48) return { tipo: "desconhecido" };
  const valorCent = parseInt(digitos.substring(4, 15), 10);
  const valor = valorCent > 0 ? valorCent / 100 : undefined;
  return { tipo: "boleto-arrecadacao", valor };
}

/** Pix EMV TLV parser — extrai tags simples no nível raiz */
function parsePixEMV(payload: string): Record<string, string> {
  const tags: Record<string, string> = {};
  let i = 0;
  while (i < payload.length - 4) {
    const id = payload.substring(i, i + 2);
    const len = parseInt(payload.substring(i + 2, i + 4), 10);
    if (isNaN(len)) break;
    const value = payload.substring(i + 4, i + 4 + len);
    tags[id] = value;
    i += 4 + len;
  }
  return tags;
}

function parsePix(payload: string): CodigoExtraido {
  const tags = parsePixEMV(payload);
  const valor = tags["54"] ? Number(tags["54"]) : undefined;
  const nome = tags["59"]?.trim() || undefined;
  return {
    tipo: "pix",
    valor: valor && !isNaN(valor) && valor > 0 ? valor : undefined,
    nome,
  };
}

/** Entry point: identifica o tipo do código e extrai o que conseguir. */
export function parseCodigo(raw: string): CodigoExtraido {
  const texto = raw.trim();

  // Pix copia-e-cola começa com "00020" (Payload Format Indicator EMV)
  if (texto.startsWith("00020") && texto.includes("BR.GOV.BCB.PIX")) {
    return parsePix(texto);
  }

  // Boleto: só dígitos (remove pontos/espaços/traços da linha digitável)
  const digitos = texto.replace(/[^\d]/g, "");

  if (digitos.length === 48 && digitos.startsWith("8")) {
    return parseBoletoArrecadacao(digitos);
  }
  if (digitos.length === 47 || digitos.length === 44) {
    return parseBoletoBancario(digitos);
  }

  return { tipo: "desconhecido" };
}
