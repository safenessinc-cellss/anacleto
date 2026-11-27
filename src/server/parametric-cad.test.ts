import test from "node:test";
import assert from "node:assert/strict";
import { buildParametricDrawing, localParametricSpec } from "../utils/parametricCad.js";

test("local parametric extraction never invents dimensions, leaves or glass thickness", () => {
  const spec = localParametricSpec("janela de alumínio");
  assert.equal(spec.largura_mm, 0);
  assert.equal(spec.altura_mm, 0);
  assert.equal(spec.folhas, 0);
  assert.equal(spec.espessura_mm, 0);
  assert.ok((spec.pendencias || []).some((item) => item.includes("largura e altura")));
  assert.ok((spec.pendencias || []).some((item) => item.includes("folhas")));
});

test("unlabelled dimensions use altura × largura and require an explicit unit", () => {
  const spec = localParametricSpec("janela 1500 x 1200 mm 2 folhas de correr");
  assert.equal(spec.altura_mm, 1500);
  assert.equal(spec.largura_mm, 1200);
  const noUnit = localParametricSpec("janela 1500 x 1200 2 folhas");
  assert.equal(noUnit.altura_mm, 0);
  assert.equal(noUnit.largura_mm, 0);
});

test("explicitly labelled dimensions and glass details are extracted without defaults", () => {
  const spec = localParametricSpec("janela de correr altura 1200 mm largura 1500 mm 2 folhas linha suprema branco vidro temperado 8 mm direita sem módulo fixo");
  assert.equal(spec.altura_mm, 1200);
  assert.equal(spec.largura_mm, 1500);
  assert.equal(spec.folhas, 2);
  assert.equal(spec.espessura_mm, 8);
  assert.equal(spec.abertura, "direita");
  assert.equal(spec.modulo_fixo, false);
  assert.equal(spec.linha_aluminio, "Linha Suprema");
});

test("parametric drawing with missing data has no fabricated geometry, BOM or cutting plan", () => {
  const spec = localParametricSpec("janela de alumínio");
  const drawing = buildParametricDrawing(spec, "janela de alumínio");
  assert.equal(drawing.isDraft, true);
  assert.equal(drawing.pieces.length, 0);
  assert.equal(drawing.cuttingPlan?.length, 0);
  assert.equal(drawing.budget?.items.length, 0);
  assert.ok((drawing.assumptions || []).length > 0);
  assert.ok(drawing.visualElements?.some((element: any) => String(element.text || "").includes("Geometria pendente")));
});

test("does not route wood doors or wood windows into the aluminum parametric CAD", async () => {
  const { isAluminumPrompt } = await import("../utils/parametricCad.js");
  assert.equal(isAluminumPrompt("porta de madeira maciça"), false);
  assert.equal(isAluminumPrompt("janela de madeira"), false);
  assert.equal(isAluminumPrompt("porta de alumínio"), true);
  assert.equal(isAluminumPrompt("janela de alumínio 1500 x 1200 mm"), true);
  assert.equal(isAluminumPrompt("box de banho em vidro temperado"), true);
});
