import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { format } from "date-fns";

interface ExportReportButtonProps {
  targetId?: string;
  fileName?: string;
}

export function ExportReportButton({
  targetId = "dashboard-export-root",
  fileName,
}: ExportReportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    const root = document.getElementById(targetId);
    if (!root) return;
    setLoading(true);
    try {
      // Capture each "section block" (SectionHeader + following grid) when possible,
      // falling back to the entire root. We split on direct children of the root.
      const blocks = Array.from(root.children) as HTMLElement[];

      // Group: a SectionHeader (h2) starts a new block and consumes following siblings
      // until the next header.
      const groups: HTMLElement[][] = [];
      let current: HTMLElement[] = [];
      for (const el of blocks) {
        const isHeader = el.querySelector("h2") || el.tagName === "H2";
        if (isHeader && current.length) {
          groups.push(current);
          current = [];
        }
        current.push(el);
      }
      if (current.length) groups.push(current);

      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const contentW = pageW - margin * 2;
      let cursorY = margin;
      let firstPage = true;

      // Cover header
      pdf.setFillColor(13, 79, 79);
      pdf.rect(0, 0, pageW, 70, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.text("Coral Moment 2026 — Relatório Consolidado", margin, 35);
      pdf.setFontSize(10);
      pdf.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, margin, 55);
      cursorY = 90;

      const renderEl = async (el: HTMLElement) => {
        const canvas = await html2canvas(el, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
        });
        const imgW = contentW;
        const imgH = (canvas.height * imgW) / canvas.width;

        if (imgH <= pageH - margin * 2) {
          if (cursorY + imgH > pageH - margin) {
            pdf.addPage();
            cursorY = margin;
          }
          pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, cursorY, imgW, imgH);
          cursorY += imgH + 16;
        } else {
          // Slice tall canvas across pages
          const pxPerPt = canvas.width / imgW;
          const pageSlicePx = (pageH - margin * 2) * pxPerPt;
          let sy = 0;
          while (sy < canvas.height) {
            const sliceH = Math.min(pageSlicePx, canvas.height - sy);
            const slice = document.createElement("canvas");
            slice.width = canvas.width;
            slice.height = sliceH;
            const ctx = slice.getContext("2d");
            if (!ctx) break;
            ctx.drawImage(canvas, 0, sy, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
            const sliceImgH = (sliceH / pxPerPt);
            if (!firstPage || sy > 0) {
              pdf.addPage();
              cursorY = margin;
            }
            pdf.addImage(slice.toDataURL("image/png"), "PNG", margin, cursorY, imgW, sliceImgH);
            cursorY = margin + sliceImgH + 16;
            sy += sliceH;
            firstPage = false;
          }
        }
        firstPage = false;
      };

      for (const group of groups) {
        // Wrap the group in a temporary container so headers stay with their content
        const wrapper = document.createElement("div");
        wrapper.style.background = "#ffffff";
        wrapper.style.padding = "12px";
        wrapper.style.width = `${root.clientWidth}px`;
        wrapper.style.position = "fixed";
        wrapper.style.left = "-99999px";
        wrapper.style.top = "0";
        for (const el of group) {
          wrapper.appendChild(el.cloneNode(true));
        }
        document.body.appendChild(wrapper);
        try {
          await renderEl(wrapper);
        } finally {
          document.body.removeChild(wrapper);
        }
      }

      const name = fileName || `relatorio-cm-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`;
      pdf.save(name);
    } catch (err) {
      console.error("Erro ao exportar PDF:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      className="gap-2 text-xs"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
      {loading ? "Gerando PDF..." : "Exportar Relatório"}
    </Button>
  );
}
