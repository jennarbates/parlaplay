import { describe, expect, test } from "vitest";
import { content } from "../content/index.ts";
import type { Template } from "../content/schemas.ts";
import { formKeyFor, indexContent, parseAdjRef } from "./content.ts";
import { renderAnswer, renderQuestion } from "./render.ts";

const index = indexContent(content);
const template = (id: string) => index.template.get(id) as Template;

describe("renderQuestion", () => {
  test.each([
    [
      "t.have.adj",
      { verb: "v.ha", art: "art.i", noun: "n.capelli", adj: "adj.biondo#mp" },
      "Ha i capelli biondi?",
    ],
    [
      "t.have.adj",
      { verb: "v.ha", art: "art.gli", noun: "n.occhi", adj: "adj.azzurro#mp" },
      "Ha gli occhi azzurri?",
    ],
    [
      "t.have.adj",
      { verb: "v.ha", art: "art.gli", noun: "n.occhi", adj: "adj.castano#mp" },
      "Ha gli occhi castani?",
    ],
    [
      "t.have.adj",
      { verb: "v.ha", art: "art.gli", noun: "n.occhi", adj: "adj.marrone#mp" },
      "Ha gli occhi marroni?",
    ],
    [
      "t.have.adj",
      { verb: "v.ha", art: "art.i", noun: "n.capelli", adj: "adj.lungo#mp" },
      "Ha i capelli lunghi?",
    ],
    ["t.have", { verb: "v.ha", art: "art.la", noun: "n.barba" }, "Ha la barba?"],
    ["t.have", { verb: "v.ha", art: "art.il", noun: "n.cappello" }, "Ha il cappello?"],
    ["t.have", { verb: "v.ha", art: "art.gli", noun: "n.occhiali" }, "Ha gli occhiali?"],
    ["t.be", { verb: "v.e", art: "art.una", noun: "n.donna" }, "È una donna?"],
    ["t.be", { verb: "v.e", art: "art.un", noun: "n.uomo" }, "È un uomo?"],
  ])("%s %o → %s", (id, fill, expected) => {
    expect(renderQuestion(template(id), fill, index)).toBe(expected);
  });

  test("renders the form it is given, even a wrong one (the ASK step corrects it first)", () => {
    const fill = { verb: "v.ha", art: "art.i", noun: "n.capelli", adj: "adj.biondo#fp" };
    expect(renderQuestion(template("t.have.adj"), fill, index)).toBe("Ha i capelli bionde?");
  });

  test("throws on ids it cannot render", () => {
    expect(() =>
      renderQuestion(template("t.have"), { verb: "v.ha", art: "art.x", noun: "n.barba" }, index),
    ).toThrow();
    expect(() =>
      renderQuestion(
        template("t.have.adj"),
        { verb: "v.ha", art: "art.i", noun: "n.capelli" },
        index,
      ),
    ).toThrow();
    expect(() =>
      renderQuestion(
        template("t.have.adj"),
        { verb: "v.ha", art: "art.i", noun: "n.capelli", adj: "adj.biondo" },
        index,
      ),
    ).toThrow();
  });
});

describe("renderAnswer (spec 2)", () => {
  test.each([
    ["Ha i capelli biondi?", true, "Sì, ha i capelli biondi."],
    ["Ha i capelli biondi?", false, "No, non ha i capelli biondi."],
    ["È un uomo?", false, "No, non è un uomo."],
    ["È una donna?", true, "Sì, è una donna."],
    ["Ha gli occhi castani?", true, "Sì, ha gli occhi castani."],
    ["Ha gli occhi marroni?", false, "No, non ha gli occhi marroni."],
  ])("%s %s → %s", (question, answer, expected) => {
    expect(renderAnswer(question, answer)).toBe(expected);
  });
});

describe("helpers", () => {
  test("parseAdjRef", () => {
    expect(parseAdjRef("adj.biondo#mp")).toEqual({ lemmaId: "adj.biondo", formKey: "mp" });
    for (const bad of ["adj.biondo", "adj.biondo#xx", "adj.biondo#mp#fp", "#mp", ""]) {
      expect(parseAdjRef(bad), bad).toBeUndefined();
    }
  });

  test("formKeyFor", () => {
    const fk = (id: string) => formKeyFor(index.noun.get(id) ?? (undefined as never));
    expect([fk("n.capelli"), fk("n.barba"), fk("n.cappello"), fk("n.donna")]).toEqual([
      "mp",
      "fs",
      "ms",
      "fs",
    ]);
  });

  test("indexContent is cached per content object", () => {
    expect(indexContent(content)).toBe(index);
    expect(indexContent({ ...content })).not.toBe(index);
  });
});
