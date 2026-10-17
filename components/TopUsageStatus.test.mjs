import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const { compactAmount, findRemainingBalanceMetric, usageProviderForModel } = await jiti.import("./TopUsageStatus.tsx");

test("DeepSeek amounts default to CNY while explicit currencies take precedence", () => {
  assert.equal(compactAmount(0.04, undefined, "CNY"), "¥0.04");
  assert.equal(compactAmount(0.04, "USD", "CNY"), "$0.04");
});

test("DeepSeek model aliases use the official DeepSeek usage account", () => {
  assert.equal(usageProviderForModel({ provider: "opencode", modelId: "deepseek-v4-pro" }), "deepseek");
  assert.equal(usageProviderForModel({ provider: "deepseek", modelId: "deepseek-chat" }), "deepseek");
  assert.equal(usageProviderForModel({ provider: "opencode", modelId: "gpt-5" }), "opencode");
});

test("remaining balance prefers CNY and falls back to total balance", () => {
  const usdRemaining = { id: "usd-remaining", label: "Remaining balance", value: 80, unit: "currency", currency: "USD" };
  const cnyRemaining = { id: "cny-remaining", label: "Remaining balance", value: 8, unit: "currency", currency: "CNY" };
  const cnyTotal = { id: "cny-total", label: "Total balance", value: 12, unit: "currency", currency: "CNY" };
  assert.equal(findRemainingBalanceMetric([usdRemaining, cnyRemaining], "CNY"), cnyRemaining);
  assert.equal(findRemainingBalanceMetric([cnyTotal], "CNY"), cnyTotal);
});
