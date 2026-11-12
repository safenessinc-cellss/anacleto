import { jsPDF } from "jspdf";

export interface PayrollReceiptDeduction {
  date: string;
  kind: string;
  amount: number;
  description?: string;
}

export interface EmployeePayrollReceipt {
  employeeName: string;
  employeeRole?: string;
  competence: string;
  paymentDate: string;
  method?: string;
  pixKey?: string;
  baseSalary: number;
  bonus: number;
  deductions: PayrollReceiptDeduction[];
  netPaid: number;
}

const brl = (value: number) => Number(value || 0).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function exportEmployeePayrollReceipt(receipt: EmployeePayrollReceipt) {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const left = 18;
  const right = pageWidth - left;
  let y = 20;

  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pageWidth, 34, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text("ANACLETO ESQUADRIAS", left, 15);
  pdf.setFontSize(10);
  pdf.text("COMPROVANTE DE PAGAMENTO / HOLERITE", left, 25);
  pdf.setTextColor(15, 23, 42);
  y = 46;

  const write = (label: string, value: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(10);
    pdf.text(label, left, y);
    pdf.text(value, right, y, { align: "right" });
    y += 7;
  };
  write("Funcionário", receipt.employeeName, true);
  write("Cargo / função", receipt.employeeRole || "Não informado");
  write("Competência", receipt.competence);
  write("Data do pagamento", receipt.paymentDate);
  write("Forma de pagamento", receipt.method || "Não informada");
  if (receipt.pixKey) write("Chave PIX", receipt.pixKey);

  y += 3;
  pdf.setDrawColor(203, 213, 225);
  pdf.line(left, y, right, y);
  y += 9;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Resumo do pagamento", left, y);
  y += 9;
  write("Salário base", brl(receipt.baseSalary));
  write("Horas extras / bônus", brl(receipt.bonus));
  const deductionsTotal = receipt.deductions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  write("Total de descontos", `- ${brl(deductionsTotal)}`, true);

  y += 3;
  pdf.setDrawColor(203, 213, 225);
  pdf.line(left, y, right, y);
  y += 10;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Descontos aplicados na folha", left, y);
  y += 8;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("Data", left, y);
  pdf.text("Descrição", left + 27, y);
  pdf.text("Valor", right, y, { align: "right" });
  y += 6;
  pdf.setFont("helvetica", "normal");
  if (receipt.deductions.length === 0) {
    pdf.text("Nenhum desconto registrado nesta competência.", left, y);
    y += 7;
  } else {
    for (const item of receipt.deductions) {
      const description = `${item.kind}${item.description ? ` · ${item.description}` : ""}`;
      const lines = pdf.splitTextToSize(description, right - left - 65);
      const rowHeight = Math.max(6, lines.length * 5);
      if (y + rowHeight > pageHeight - 55) {
        pdf.addPage();
        y = 20;
      }
      pdf.setFontSize(9);
      pdf.text(item.date || "—", left, y);
      pdf.text(lines, left + 27, y);
      pdf.text(`- ${brl(item.amount)}`, right, y, { align: "right" });
      y += rowHeight + 2;
    }
  }

  if (y + 60 > pageHeight - 10) {
    pdf.addPage();
    y = 24;
  }
  y += 5;
  pdf.setFillColor(239, 246, 255);
  pdf.roundedRect(left, y, right - left, 18, 2, 2, "F");
  pdf.setTextColor(30, 64, 175);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("VALOR LÍQUIDO PAGO", left + 5, y + 11);
  pdf.text(brl(receipt.netPaid), right - 5, y + 11, { align: "right" });
  pdf.setTextColor(15, 23, 42);

  y += 48;
  pdf.setDrawColor(100, 116, 139);
  pdf.line(left, y, pageWidth / 2 - 8, y);
  pdf.line(pageWidth / 2 + 8, y, right, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(receipt.employeeName, (left + pageWidth / 2 - 8) / 2, y + 5, { align: "center" });
  pdf.text("Responsável pelo pagamento", (pageWidth / 2 + 8 + right) / 2, y + 5, { align: "center" });

  const slug = receipt.employeeName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
  pdf.save(`holerite-${slug}-${receipt.competence}.pdf`);
}
