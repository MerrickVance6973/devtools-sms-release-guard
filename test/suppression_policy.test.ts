import assert from "node:assert/strict";
import test from "node:test";
import { selectReleaseMessages } from "../src/suppression_policy.js";

test("an opted-out maintainer is excluded from a release batch", () => {
  const decision = selectReleaseMessages(
    [
      { recipient: "+15550000001", payload: { template: "release_ready" } },
      { recipient: "+15550000002", payload: { template: "release_ready" } },
    ],
    new Set(["+15550000002"]),
  );

  assert.deepEqual(decision.approved.map((item) => item.recipient), ["+15550000001"]);
  assert.deepEqual(decision.suppressed, [
    { recipient: "+15550000002", reason: "opt_out" },
  ]);
});
