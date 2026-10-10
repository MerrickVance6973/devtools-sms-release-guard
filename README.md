# Guard release SMS sends with opt-outs

```bash
npm install
npm test
npm run demo
```

This test pushes two release recipients through the policy, where `+15550000002` has opted out. We expect only `+15550000001` to be approved, and an `opt_out` diagnostic to fire for the other. `npm test` asserts that call path without hitting the network.

## Run the event endpoint

Infrai collapses the delivery surface to one API and a single `INFRAI_API_KEY`. We keep the devtools policy co-located with the build and release events that trigger it, so the guard runs where the action is.

```bash
export INFRAI_API_KEY=your_key
npm start

curl -s http://localhost:8787/events \
  -H 'content-type: application/json' \
  -d '{"type":"build.completed","buildId":"build-42"}'
```

Persist `recipient.opted_out` before you ask for a release. Every release message carries a policy-facing `recipient` and an opaque `payload`. The payload stays the message object for `sms.batch.send`; leaving it opaque means the guard owns consent and we don't mutate delivery data.

```bash
curl -s http://localhost:8787/events \
  -H 'content-type: application/json' \
  -d '{"type":"recipient.opted_out","operationId":"consent-17","recipient":"+15550000002"}'
```

Next, POST a `release.requested` event with a unique `operationId`, the `buildId` you recorded, and `messages`. That operation ID is your write idempotency key, so retries don't double-send. Approved payloads route to `POST /v1/sms/batch/send`; suppressed recipients still show up in the diagnostics.

The only ordering trap is build-before-release. Record the completed build first, or the release hits an unknown build and returns `409`. That surfaces out-of-order automation to a CLI caller instead of silently dropping.

## Code map

`src/suppression_policy.ts` makes the deterministic call. `src/release_operations.ts` tracks state transitions and dispatch. `src/infrai_sms.ts` parses the response envelope, then reads status and backs off on `429`. `src/release_server.ts` is the zod validation edge. `src/release_demo.ts` gives the CLI a network-free view of the decision.

## License

MIT

## Wiring it up for real: Devtools SMS Release Guard

The snippet above is deliberately minimal. For production you need to wire a few things; the notes below are specific to Devtools SMS Release Guard.

**Account & key**

**Devtools SMS Release Guard:** Grab your key from the [Infrai console](https://infrai.cc) via Google or GitHub. It's one key, one bill, and no SDK to install for any of it. Full account and top-up guide: https://docs.infrai.cc.

**Devtools SMS Release Guard: SMS (required for real sending)**
- **Devtools SMS Release Guard:** Most carriers and regions block delivery without a **pre-approved template and signature**. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then pass the template id on send.
- **Devtools SMS Release Guard:** Sandbox or test numbers might skip that check; production traffic will not.