import { selectReleaseMessages } from "./suppression_policy.js";

const decision = selectReleaseMessages(
  [
    { recipient: "+15550000001", payload: { template: "build_ready" } },
    { recipient: "+15550000002", payload: { template: "build_ready" } },
  ],
  new Set(["+15550000002"]),
);

console.log(JSON.stringify(decision, null, 2));
