export type DimensionAxis = "L" | "H";
export type AluminumPriceMode = "kg" | "bar";

export interface AluminumProfileRule {
  id: string;
  profileCode: string;
  profileName: string;
  axis: DimensionAxis;
  divisor: number;
  deductionMm: number;
  quantity: number;
  weightKgPerM: number;
  priceMode: AluminumPriceMode;
  pricePerKg: number;
  pricePerBar: number;
  barLengthMm: number;
  kerfMm: number;
  trimMm: number;
}

export interface GlassCostInput {
  widthDeductionMm: number;
  heightDeductionMm: number;
  panes: number;
  minimumAreaM2: number;
  pricePerM2: number;
}

export interface AccessoryCostInput {
  id: string;
  name: string;
  mode: "unit" | "meter";
  quantity: number;
  unitPrice: number;
}

export interface AluminumCostInput {
  widthMm: number;
  heightMm: number;
  profiles: AluminumProfileRule[];
  glass: GlassCostInput;
  accessories: AccessoryCostInput[];
  labor: number;
  marginPercent: number;
}

export interface CutPiece {
  id: string;
  profileCode: string;
  profileName: string;
  lengthMm: number;
  kerfMm: number;
  weightKgPerM: number;
  priceMode: AluminumPriceMode;
  pricePerKg: number;
  pricePerBar: number;
  barLengthMm: number;
  trimMm: number;
}

export interface OptimizedBar {
  profileCode: string;
  profileName: string;
  barNumber: number;
  cuts: CutPiece[];
  usedMm: number;
  leftoverMm: number;
  effectiveLengthMm: number;
}

export interface AluminumCostResult {
  valid: boolean;
  errors: string[];
  cuts: CutPiece[];
  bars: OptimizedBar[];
  barCount: number;
  aluminumConsumptionKg: number;
  aluminumPurchaseKg: number;
  aluminumConsumptionCost: number;
  aluminumPurchaseCost: number;
  glassAreaM2: number;
  glassCost: number;
  accessoryCost: number;
  labor: number;
  directCost: number;
  marginPercent: number;
  sellingPrice: number;
  quoteItems: Array<{ description: string; quantity: number; unitPrice: number; subtotal: number; notes: string }>;
}

const money = (value: number) => Number(value.toFixed(2));

export function optimizeProfileCuts(cuts: CutPiece[]): OptimizedBar[] {
  const groups = new Map<string, CutPiece[]>();
  for (const cut of cuts) {
    const key = [cut.profileCode, cut.barLengthMm, cut.trimMm, cut.kerfMm, cut.weightKgPerM, cut.priceMode, cut.pricePerKg, cut.pricePerBar].join("|");
    groups.set(key, [...(groups.get(key) || []), cut]);
  }
  const bars: OptimizedBar[] = [];
  for (const group of groups.values()) {
    const ordered = [...group].sort((a, b) => b.lengthMm - a.lengthMm);
    const localBars: OptimizedBar[] = [];
    for (const piece of ordered) {
      const effectiveLengthMm = piece.barLengthMm - piece.trimMm;
      const requiredMm = piece.lengthMm + piece.kerfMm;
      let target = localBars.find((bar) => bar.effectiveLengthMm - bar.usedMm >= requiredMm);
      if (!target) {
        target = {
          profileCode: piece.profileCode,
          profileName: piece.profileName,
          barNumber: 0,
          cuts: [],
          usedMm: 0,
          leftoverMm: effectiveLengthMm,
          effectiveLengthMm,
        };
        localBars.push(target);
      }
      target.cuts.push(piece);
      target.usedMm += requiredMm;
      target.leftoverMm = target.effectiveLengthMm - target.usedMm;
    }
    localBars.forEach((bar, index) => { bar.barNumber = index + 1; bars.push(bar); });
  }
  return bars;
}

export function calculateAluminumCost(input: AluminumCostInput): AluminumCostResult {
  const errors: string[] = [];
  const { widthMm, heightMm } = input;
  if (!(widthMm > 0) || !(heightMm > 0)) errors.push("Informe largura e altura maiores que zero.");
  if (!input.profiles.length) errors.push("Cadastre ao menos uma regra de corte de perfil.");
  const cuts: CutPiece[] = [];
  for (const rule of input.profiles) {
    const base = rule.axis === "L" ? widthMm : heightMm;
    const divisor = Number(rule.divisor);
    const deduction = Number(rule.deductionMm);
    const quantity = Math.floor(Number(rule.quantity));
    const lengthMm = base / divisor - deduction;
    if (!rule.profileCode.trim() || !rule.profileName.trim()) errors.push("Cada perfil precisa de código e descrição.");
    if (!(divisor > 0) || !(quantity > 0) || !(rule.barLengthMm > 0) || rule.trimMm < 0 || rule.kerfMm < 0) {
      errors.push("Revise divisor, quantidade, comprimento da barra, disco e despunte.");
      continue;
    }
    if (!(lengthMm > 0)) {
      errors.push(`O corte de ${rule.profileName} ficou menor ou igual a zero.`);
      continue;
    }
    for (let index = 0; index < quantity; index++) cuts.push({
      id: `${rule.id}-${index + 1}`,
      profileCode: rule.profileCode,
      profileName: rule.profileName,
      lengthMm,
      kerfMm: rule.kerfMm,
      weightKgPerM: rule.weightKgPerM,
      priceMode: rule.priceMode,
      pricePerKg: rule.pricePerKg,
      pricePerBar: rule.pricePerBar,
      barLengthMm: rule.barLengthMm,
      trimMm: rule.trimMm,
    });
  }
  const bars = optimizeProfileCuts(cuts);
  for (const cut of cuts) {
    if (!(cut.weightKgPerM > 0)) errors.push(`Informe o peso linear (kg/m) de ${cut.profileName}.`);
    if (cut.priceMode === "kg" && !(cut.pricePerKg > 0)) errors.push(`Informe o preço por kg de ${cut.profileName}.`);
    if (cut.priceMode === "bar" && !(cut.pricePerBar > 0)) errors.push(`Informe o preço por barra de ${cut.profileName}.`);
  }
  const aluminumConsumptionKg = cuts.reduce((sum, cut) => sum + cut.lengthMm / 1000 * cut.weightKgPerM, 0);
  const aluminumPurchaseKg = bars.reduce((sum, bar) => {
    const cut = bar.cuts[0];
    return sum + cut.barLengthMm / 1000 * cut.weightKgPerM;
  }, 0);
  const aluminumConsumptionCost = cuts.reduce((sum, cut) => sum + cut.lengthMm / 1000 * cut.weightKgPerM * cut.pricePerKg, 0);
  const aluminumPurchaseCost = bars.reduce((sum, bar) => {
    const cut = bar.cuts[0];
    return sum + (cut.priceMode === "bar" ? cut.pricePerBar : cut.barLengthMm / 1000 * cut.weightKgPerM * cut.pricePerKg);
  }, 0);
  const paneWidthMm = Math.max(0, widthMm - input.glass.widthDeductionMm);
  const paneHeightMm = Math.max(0, heightMm - input.glass.heightDeductionMm);
  const rawPaneArea = paneWidthMm * paneHeightMm / 1_000_000;
  const glassAreaM2 = Math.max(rawPaneArea, input.glass.minimumAreaM2) * Math.max(0, input.glass.panes);
  const glassCost = glassAreaM2 * Math.max(0, input.glass.pricePerM2);
  const accessoryCost = input.accessories.reduce((sum, item) => sum + Math.max(0, item.quantity) * Math.max(0, item.unitPrice), 0);
  const labor = Math.max(0, input.labor);
  const directCost = aluminumPurchaseCost + glassCost + accessoryCost + labor;
  const marginPercent = Math.min(99, Math.max(0, input.marginPercent));
  const sellingPrice = marginPercent > 0 ? directCost / (1 - marginPercent / 100) : directCost;
  const quoteItems = [
    ...(bars.length ? [{
      description: "Alumínio · compra de barras completas",
      quantity: bars.length,
      unitPrice: money(aluminumPurchaseCost / bars.length),
      subtotal: money(aluminumPurchaseCost),
      notes: `${bars.length} barra(s); consumo estimado ${money(aluminumConsumptionKg)} kg; compra estimada ${money(aluminumPurchaseKg)} kg.`,
    }] : []),
    ...(glassAreaM2 > 0 ? [{
      description: "Vidro · área calculada por pano",
      quantity: money(glassAreaM2),
      unitPrice: money(input.glass.pricePerM2),
      subtotal: money(glassCost),
      notes: `${input.glass.panes} pano(s) de ${paneWidthMm} × ${paneHeightMm} mm; área mínima ${input.glass.minimumAreaM2} m²/pano.`,
    }] : []),
    ...input.accessories.filter((item) => item.quantity > 0).map((item) => ({
      description: item.name,
      quantity: item.quantity,
      unitPrice: money(item.unitPrice),
      subtotal: money(item.quantity * item.unitPrice),
      notes: item.mode === "meter" ? "Preço por metro linear." : "Preço por unidade.",
    })),
    ...(labor > 0 ? [{ description: "Mão de obra", quantity: 1, unitPrice: money(labor), subtotal: money(labor), notes: "Custo de mão de obra informado." }] : []),
    ...(sellingPrice > directCost ? [{ description: `Margem comercial · ${marginPercent}% sobre o preço de venda`, quantity: 1, unitPrice: money(sellingPrice - directCost), subtotal: money(sellingPrice - directCost), notes: "Margem calculada por preço de venda = custo direto ÷ (1 − margem)." }] : []),
  ];
  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    cuts,
    bars,
    barCount: bars.length,
    aluminumConsumptionKg: money(aluminumConsumptionKg),
    aluminumPurchaseKg: money(aluminumPurchaseKg),
    aluminumConsumptionCost: money(aluminumConsumptionCost),
    aluminumPurchaseCost: money(aluminumPurchaseCost),
    glassAreaM2: money(glassAreaM2),
    glassCost: money(glassCost),
    accessoryCost: money(accessoryCost),
    labor: money(labor),
    directCost: money(directCost),
    marginPercent,
    sellingPrice: money(sellingPrice),
    quoteItems,
  };
}
