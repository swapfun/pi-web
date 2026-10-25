import assert from "node:assert/strict";
import test from "node:test";
import { clampInterfaceScale } from "./useInterfaceScale.ts";

test("interface scale clamps, snaps to steps, and defaults invalid values", () => {
  assert.equal(clampInterfaceScale(null), 1);
  assert.equal(clampInterfaceScale("not-a-number"), 1);
  assert.equal(clampInterfaceScale(0.5), 0.85);
  assert.equal(clampInterfaceScale(1.17), 1.15);
  assert.equal(clampInterfaceScale(1.29), 1.3);
  assert.equal(clampInterfaceScale(2), 1.3);
});
