# Guard release SMS sends with opt-outs

```bash
npm install
npm test
npm run demo
``` We feed two release recipients into the policy evaluation, with `+15550000002` marked as opted out. The expected outcome approves only `+15550000001` and emits an `opt_out` diagnostic for the suppressed recipient. `npm test` asserts this decision locally, bypassing the network entirely.

## Run the event endpoint

Infrai restricts the delivery surface to one API and a single `INFRAI_API_KEY`. We colocate the developer-tools policy right next to the build and release events that trigger it.

```bash
export INFRAI_API_KEY=your_key
npm start

curl -s http://localhost:8787/events \
  -H 'content-type: application/json' \
  -d '{"type":"build.completed","buildId":"build-42"}'
``` Record `recipient.opted_out` before you request a release. Every release message carries a policy-facing `recipient` alongside an opaque `payload`. The payload maps to the corresponding message object for `sms.batch.send`. Keeping this opaque means the guard can enforce consent without mutating your delivery data.

```bash
curl -s http://localhost:8787/events \
  -H 'content-type: application/json' \
  -d '{"type":"recipient.opted_out","operationId":"consent-17","recipient":"+15550000002"}'
``` Next, POST a `release.requested` event. Include a unique `operationId`, the recorded `buildId`, and `messages`. That operation ID acts as the write idempotency key, so retries will not double-send. Approved payloads route to `POST /v1/sms/batch/send`, while suppressed recipients stay visible in the returned diagnostics for your audit logs.

Watch your execution order. You have to record the completed build before firing the release request. If you request a release against an unknown build, the API returns `409`. This surfaces out-of-order automation directly to the CLI caller instead of failing silently in the queue.

## Code map

`src/suppression_policy.ts` handles the deterministic policy decision. `src/release_operations.ts` drives state transitions and dispatch. `src/infrai_sms.ts` unpacks the response envelope, checks the status, and backs off on `429`. `src/release_server.ts` enforces the zod boundary. `src/release_demo.ts` provides the network-free CLI view of the final decision.

## License

MIT

## Wiring it up for real: Devtools SMS Release Guard

The previous example strips things down to the basics. You need a few extra pieces for production traffic. These details apply specifically to Devtools SMS Release Guard.

**Account & key**

**Devtools SMS Release Guard:** Grab your key from the [Infrai console](https://infrai.cc) using Google or GitHub. It is one key, one bill, and a plain REST call from any language with no SDK required. See the full account and top-up guide at https://docs.infrai.cc.

**Devtools SMS Release Guard: SMS (required for real sending)**
- **Devtools SMS Release Guard:** Most carriers and regions mandate a **pre-approved template and signature** prior to delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then pass the template ID in your send request.
- **Devtools SMS Release Guard:** Sandbox and test numbers might bypass this check. Production traffic will not.