import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesKeyword, detectLang, fillTemplate, parseKeywords } from "../lib/text.ts";

test("palavra-chave: variações de acento, caixa e pontuação", () => {
  assert.equal(matchesKeyword("MAPA", ["mapa"], "exact"), "mapa");
  assert.equal(matchesKeyword("mapa!!", ["MAPA"], "exact"), "MAPA");
  assert.equal(matchesKeyword("Mapa 🙏", ["MAPA"], "exact"), "MAPA");
  assert.equal(matchesKeyword("residencia", ["RESIDÊNCIA"], "exact"), "RESIDÊNCIA");
  assert.equal(matchesKeyword("Quero o mapa, por favor", ["MAPA"], "contains"), "MAPA");
  assert.equal(matchesKeyword("mapas do brasil", ["MAPA"], "contains"), null);
  assert.equal(matchesKeyword("Quero o mapa", ["MAPA"], "exact"), null);
  assert.equal(matchesKeyword("", ["MAPA"], "contains"), null);
});

test("palavras-chave: limpeza e deduplicação", () => {
  assert.deepEqual(parseKeywords("mapa, Mapa ; mápa\nlogística"), ["MAPA", "LOGÍSTICA"]);
});

test("idioma: português", () => {
  assert.equal(detectLang("Quero o mapa, obrigado!", "es"), "pt");
  assert.equal(detectLang("mapa por favor, sou de São Paulo", "es"), "pt");
  assert.equal(detectLang("Gostaria de receber as informações", "es"), "pt");
});

test("idioma: espanhol", () => {
  assert.equal(detectLang("Quiero el mapa, gracias", "pt"), "es");
  assert.equal(detectLang("Hola! mapa por favor", "pt"), "es");
  assert.equal(detectLang("¿Me pueden enviar la información?", "pt"), "es");
});

test("idioma: sem sinal usa o padrão", () => {
  assert.equal(detectLang("MAPA", "pt"), "pt");
  assert.equal(detectLang("MAPA", "es"), "es");
  assert.equal(detectLang("mapa 🔥", "pt"), "pt");
});

test("modelo: nome, usuário e link", () => {
  assert.equal(fillTemplate("Olá, {nome}. Segue: {link}", { nome: "Carlos Mendes", link: "https://x/m/mapa" }), "Olá, Carlos. Segue: https://x/m/mapa");
  assert.equal(fillTemplate("Olá, {nome}.", { usuario: "carlos.m" }), "Olá, @carlos.m.");
  assert.equal(fillTemplate("Olá, {nome}. Tudo certo.", {}), "Olá. Tudo certo.");
});

test("modelo: texto sem nome em espanhol", () => {
  assert.equal(fillTemplate("Hola, {nome}. Gracias.", {}), "Hola. Gracias.");
});
