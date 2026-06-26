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

/** Fator de vencimento → data.
 *
 * A Febraban reiniciou o fator em 22/02/2025: fator 1000 voltou a valer.
 * Se a data calculada pela base antiga cair muito no passado, usamos o novo ciclo.
 */
function fatorParaData(fator: number): string | undefined {
  if (!fator || fator < 1000) return undefined;
  const dia = 24 * 60 * 60 * 1000;
  const baseAntiga = new Date(Date.UTC(1997, 9, 7));
  const dataAntiga = new Date(baseAntiga.getTime() + fator * dia);
  const limitePassado = new Date();
  limitePassado.setFullYear(limitePassado.getFullYear() - 5);

  const d = dataAntiga < limitePassado
    ? new Date(Date.UTC(2025, 1, 22) + (fator - 1000) * dia)
    : dataAntiga;
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
  if (barcode.length !== 44 || barcode.startsWith("8")) return { tipo: "desconhecido" };

  const fator = parseInt(barcode.substring(5, 9), 10);
  const valorCent = parseInt(barcode.substring(9, 19), 10);
  const valor = valorCent > 0 ? valorCent / 100 : undefined;
  const vencimento = fatorParaData(fator);

  return { tipo: "boleto-bancario", valor, vencimento };
}

function parseBoletoArrecadacao(digitos: string): CodigoExtraido {
  // Concessionária/arrecadação: código de barras 44 ou linha digitável 48.
  if (!digitos.startsWith("8")) return { tipo: "desconhecido" };

  let barcode = digitos;
  if (digitos.length === 48) {
    // Linha digitável de arrecadação: 4 blocos de 11 dígitos + 1 DV.
    barcode =
      digitos.substring(0, 11) +
      digitos.substring(12, 23) +
      digitos.substring(24, 35) +
      digitos.substring(36, 47);
  }

  if (barcode.length !== 44) return { tipo: "desconhecido" };

  // Indicador 6/8 = valor efetivo nas posições 5-15; 7/9 = referência sem valor confiável.
  const indicadorValor = barcode.substring(2, 3);
  const valorCent = ["6", "8"].includes(indicadorValor) ? parseInt(barcode.substring(4, 15), 10) : 0;
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
  const texto = raw.trim().replace(/[\u200B-\u200D\uFEFF]/g, "");

  // Pix copia-e-cola começa com "00020" — alguns QRs não trazem BR.GOV.BCB.PIX no nível raiz.
  const pixStart = texto.search(/00020[12]/);
  if (pixStart >= 0) {
    const pix = parsePix(texto.slice(pixStart));
    if (pix.valor || pix.nome || texto.toUpperCase().includes("BR.GOV.BCB")) {
      return pix;
    }
  }

  // Boleto: só dígitos (remove pontos/espaços/traços da linha digitável)
  const digitos = texto.replace(/[^\d]/g, "");
  const candidatos = new Set<string>();
  if (digitos) candidatos.add(digitos);

  for (const tamanho of [48, 47, 44]) {
    if (digitos.length >= tamanho) {
      for (let i = 0; i <= digitos.length - tamanho; i += 1) {
        candidatos.add(digitos.slice(i, i + tamanho));
      }
    }
  }

  for (const candidato of candidatos) {
    if ((candidato.length === 48 || candidato.length === 44) && candidato.startsWith("8")) {
      const parsed = parseBoletoArrecadacao(candidato);
      if (parsed.tipo !== "desconhecido") return parsed;
    }
    if (candidato.length === 47 || (candidato.length === 44 && !candidato.startsWith("8"))) {
      const parsed = parseBoletoBancario(candidato);
      if (parsed.tipo !== "desconhecido") return parsed;
    }
  }

  // Fallback: 44+ dígitos provavelmente é boleto. Devolve sem valor/venc para o usuário editar.
  if (digitos.length >= 44) {
    return digitos.startsWith("8")
      ? { tipo: "boleto-arrecadacao" }
      : { tipo: "boleto-bancario" };
  }

  return { tipo: "desconhecido" };
}
