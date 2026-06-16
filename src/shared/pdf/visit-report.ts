import PDFDocument from "pdfkit";

type NcData = { description: string };

type ItemData = {
  serviceName: string;
  status: "OK" | "NOK" | null;
  nonConformity: NcData | null;
};

type RoomData = { name: string; items: ItemData[] };

export type VisitReportData = {
  id: number;
  buildingName: string;
  apartmentIdentifier: string;
  floor: number | null;
  block: string | null;
  inspectorName: string | null;
  finalizedAt: Date | null;
  type: "INITIAL" | "REINSPECTION";
  signatureUrl: string | null;
  rooms: RoomData[];
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function generateVisitReport(data: VisitReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 100;
    const gray = "#555555";
    const red = "#cc0000";
    const green = "#006600";

    // ── Header ──────────────────────────────────────────────────────────────
    doc.fontSize(18).font("Helvetica-Bold").text("RELATÓRIO DE VISTORIA", { align: "center" });
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor(gray)
      .text(
        data.type === "REINSPECTION" ? "RE-INSPEÇÃO" : "VISTORIA INICIAL",
        { align: "center" },
      )
      .fillColor("black");
    doc.moveDown(0.8);

    // ── Info block ───────────────────────────────────────────────────────────
    const aptLine = [
      `Apto ${data.apartmentIdentifier}`,
      data.floor != null ? `${data.floor}º andar` : null,
      data.block ? `Bloco ${data.block}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    doc.fontSize(11).font("Helvetica-Bold").text("Informações gerais");
    doc
      .moveTo(50, doc.y)
      .lineTo(50 + W, doc.y)
      .strokeColor("#cccccc")
      .stroke();
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10);

    const infoRows: [string, string][] = [
      ["Edifício", data.buildingName],
      ["Apartamento", aptLine],
      ["Inspetor", data.inspectorName ?? "Não atribuído"],
      ["Data de finalização", data.finalizedAt ? formatDate(data.finalizedAt) : "-"],
    ];
    for (const [label, value] of infoRows) {
      doc.font("Helvetica-Bold").text(label + ": ", { continued: true });
      doc.font("Helvetica").text(value);
    }
    doc.moveDown(0.8);

    // ── Items by room ────────────────────────────────────────────────────────
    doc.fontSize(11).font("Helvetica-Bold").text("Itens avaliados");
    doc
      .moveTo(50, doc.y)
      .lineTo(50 + W, doc.y)
      .strokeColor("#cccccc")
      .stroke();
    doc.moveDown(0.3);

    for (const room of data.rooms) {
      doc.fontSize(10).font("Helvetica-Bold").text(room.name);
      for (const item of room.items) {
        const statusLabel =
          item.status === "OK" ? "OK" : item.status === "NOK" ? "NOK" : "Pendente";
        const color = item.status === "OK" ? green : item.status === "NOK" ? red : gray;
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("black")
          .text(`  ${item.serviceName}   `, { continued: true })
          .fillColor(color)
          .text(statusLabel)
          .fillColor("black");
        if (item.nonConformity) {
          doc
            .fontSize(9)
            .fillColor(gray)
            .text(`      NC: ${item.nonConformity.description}`)
            .fillColor("black");
        }
      }
      doc.moveDown(0.4);
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    const allItems = data.rooms.flatMap((r) => r.items);
    const total = allItems.length;
    const ok = allItems.filter((i) => i.status === "OK").length;
    const nok = allItems.filter((i) => i.status === "NOK").length;
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

    doc.moveDown(0.4);
    doc.fontSize(11).font("Helvetica-Bold").text("Resumo");
    doc
      .moveTo(50, doc.y)
      .lineTo(50 + W, doc.y)
      .strokeColor("#cccccc")
      .stroke();
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Total de itens: ${total}`);
    doc.fillColor(green).text(`Aprovados (OK): ${ok} (${pct(ok)}%)`).fillColor("black");
    doc.fillColor(red).text(`Reprovados (NOK): ${nok} (${pct(nok)}%)`).fillColor("black");

    // ── Signature ────────────────────────────────────────────────────────────
    doc.moveDown(1.5);
    const sigY = doc.y;
    doc
      .moveTo(50 + W * 0.25, sigY)
      .lineTo(50 + W * 0.75, sigY)
      .strokeColor("black")
      .stroke();
    doc.moveDown(0.3);
    doc
      .fontSize(9)
      .fillColor(gray)
      .text(
        data.signatureUrl
          ? `Assinatura digital capturada — ${data.inspectorName ?? ""}`
          : "Assinatura do inspetor",
        { align: "center" },
      )
      .fillColor("black");

    // ── Footer ───────────────────────────────────────────────────────────────
    doc
      .fontSize(8)
      .fillColor(gray)
      .text(`Gerado em ${formatDate(new Date())} · Vistoria #${data.id}`, 50, doc.page.height - 40, { align: "center", width: W })
      .fillColor("black");

    doc.end();
  });
}
