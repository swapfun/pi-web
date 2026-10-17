import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { recordDeepSeekBalance } = await jiti.import("./deepseek-balance-history.ts");

test("DeepSeek daily spend tracks the funded CNY wallet before USD", async () => {
  const directory = await mkdtemp(join(tmpdir(), "deepseek-usage-test-"));
  const previousDirectory = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = directory;
  try {
    const result = await recordDeepSeekBalance({
      balance_infos: [
        { currency: "USD", total_balance: "20", topped_up_balance: "20" },
        { currency: "CNY", total_balance: "100", topped_up_balance: "100" },
      ],
    }, "test-key", Date.UTC(2026, 9, 13, 12));
    assert.deepEqual(result, { currency: "CNY", todaySpend: 0 });
  } finally {
    if (previousDirectory === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousDirectory;
    await rm(directory, { recursive: true, force: true });
  }
});
