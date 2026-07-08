// jsPDF é carregado sob demanda (lazy) para não pesar o carregamento inicial no Android.
import { formatBRL, formatDateFull } from "@/lib/finance";
import type { Conta } from "@/lib/queries";

const statusLabel: Record<Conta["status"], string> = {
  pendente: "Pendente", paga: "Paga", atrasada: "Atrasada", quitada: "Quitada",
};

function baixarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportarCSV(contas: Conta[], filename: string) {
  const header = ["Nome", "Categoria", "Valor", "Vencimento", "Status", "Tipo", "Pago em", "Observações"];
  const rows = contas.map((c) => [
    csvEscape(c.nome),
    csvEscape(c.categoria?.nome ?? ""),
    csvEscape(Number(c.valor).toFixed(2).replace(".", ",")),
    csvEscape(formatDateFull(c.vencimento)),
    csvEscape(statusLabel[c.status]),
    csvEscape(c.tipo),
    csvEscape(c.pago_em ? formatDateFull(c.pago_em.slice(0, 10)) : ""),
    csvEscape(c.observacoes ?? ""),
  ].join(";"));
  const bom = "\uFEFF"; // Excel BR
  const csv = bom + header.join(";") + "\n" + rows.join("\n");
  baixarBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

export function exportarPDF(contas: Conta[], titulo: string, filename: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  let y = 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(titulo, marginX, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} — ${contas.length} conta(s)`, marginX, y);
  y += 24;

  // Totais
  const soma = (s: Conta["status"]) => contas.filter((c) => c.status === s).reduce((a, c) => a + Number(c.valor), 0);
  const totalPagas = soma("paga") + soma("quitada");
  const totalPendentes = soma("pendente");
  const totalAtrasadas = soma("atrasada");
  const total = totalPagas + totalPendentes + totalAtrasadas;

  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Total: ${formatBRL(total)}`, marginX, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Pagas: ${formatBRL(totalPagas)}   |   Pendentes: ${formatBRL(totalPendentes)}   |   Atrasadas: ${formatBRL(totalAtrasadas)}`,
    marginX,
    y,
  );
  y += 24;

  // Cabeçalho tabela
  const cols = [
    { label: "Nome", x: marginX, w: 160 },
    { label: "Categoria", x: marginX + 160, w: 90 },
    { label: "Vencto", x: marginX + 250, w: 65 },
    { label: "Status", x: marginX + 315, w: 60 },
    { label: "Valor", x: marginX + 375, w: 140, align: "right" as const },
  ];

  const drawHeader = () => {
    doc.setFillColor(240, 250, 246);
    doc.rect(marginX, y - 12, pageWidth - marginX * 2, 20, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(20);
    cols.forEach((col) => {
      doc.text(col.label, col.align === "right" ? col.x + col.w : col.x, y + 2, {
        align: col.align ?? "left",
      });
    });
    y += 16;
  };

  drawHeader();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  for (const c of contas) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 50;
      drawHeader();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
    }
    doc.setTextColor(20);
    doc.text(String(c.nome).slice(0, 40), cols[0].x, y);
    doc.setTextColor(80);
    doc.text(String(c.categoria?.nome ?? "").slice(0, 20), cols[1].x, y);
    doc.text(formatDateFull(c.vencimento), cols[2].x, y);
    doc.text(statusLabel[c.status], cols[3].x, y);
    doc.setTextColor(20);
    doc.text(formatBRL(c.valor), cols[4].x + cols[4].w, y, { align: "right" });
    y += 14;
    doc.setDrawColor(230);
    doc.line(marginX, y - 4, pageWidth - marginX, y - 4);
  }

  doc.save(filename);
}
