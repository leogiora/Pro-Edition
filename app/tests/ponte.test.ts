import assert from "node:assert/strict";
import { test } from "node:test";

import { Ponte, SEM_PREMIERE } from "../src/ponte.ts";

test("ponte: sem o plugin passando, o pedido espera pouco e falha com o motivo", async () => {
  const ponte = new Ponte(() => 10_000, 20);
  await assert.rejects(ponte.pedir("lerEstado", [], 60_000), { message: SEM_PREMIERE });
  assert.deepEqual(ponte.sinal(), []); // saiu da fila
});

test("ponte: programa recem-aberto - o pedido espera a primeira passada do plugin", async () => {
  const ponte = new Ponte(() => 0, 1000);
  const pedido = ponte.pedir("lerEstado", [], 60_000); // ninguem passou ainda
  assert.equal(ponte.sinal().length, 1); // o plugin chegou e levou
  ponte.responder({ id: 1, ok: true, valor: "Reels" });
  assert.equal(await pedido, "Reels");
});

test("ponte: o pedido vai no proximo sinal e volta pela resposta com o mesmo id", async () => {
  let agora = 0;
  const ponte = new Ponte(() => agora);
  ponte.sinal(); // o plugin passou
  const pedido = ponte.pedir("editar", [{ pausas: true }], 60_000);
  const levados = ponte.sinal();
  assert.deepEqual(levados, [{ id: 1, nome: "editar", args: [{ pausas: true }] }]);
  assert.deepEqual(ponte.sinal(), []); // nao vai duas vezes
  assert.equal(ponte.responder({ id: 99, ok: true }), false); // de ninguem
  assert.equal(ponte.responder({ id: 1, ok: true, valor: true }), true);
  assert.equal(await pedido, true);

  const falha = ponte.pedir("lerEstado", [], 60_000);
  ponte.responder({ id: 2, ok: false, erro: "sem sequência aberta" });
  await assert.rejects(falha, { message: "sem sequência aberta" });

  agora = 5000; // plugin sumiu (painel fechado)
  assert.equal(ponte.vivo(), false);
});

test("ponte: o prazo vence e o pedido sai da fila", async () => {
  const ponte = new Ponte(() => 0);
  ponte.sinal();
  const pedido = ponte.pedir("lerEstado", [], 20);
  await assert.rejects(pedido, /não respondeu a "lerEstado"/);
  assert.deepEqual(ponte.sinal(), []);
});
