import { createServer } from "node:http";
import { z } from "zod";
import { InfraiError } from "./infrai_sms.js";
import { OperationError, ReleaseOperations } from "./release_operations.js";

const EventBody = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("build.completed"),
    buildId: z.string().min(1),
  }).strict(),
  z.object({
    type: z.literal("recipient.opted_out"),
    operationId: z.string().min(1),
    recipient: z.string().min(1),
  }).strict(),
  z.object({
    type: z.literal("release.requested"),
    operationId: z.string().min(1),
    buildId: z.string().min(1),
    messages: z.array(z.object({
      recipient: z.string().min(1),
      payload: z.custom<{} | null>((value) => value !== undefined),
    }).strict()).min(1),
  }).strict(),
]);

const operations = new ReleaseOperations();

const server = createServer(async (request, response) => {
  response.setHeader("content-type", "application/json");
  if (request.method !== "POST" || request.url !== "/events") {
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "route_not_found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const event = EventBody.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));

    if (event.type === "build.completed") {
      response.end(JSON.stringify({ diagnostics: [operations.recordBuild(event.buildId)] }));
    } else if (event.type === "recipient.opted_out") {
      response.end(JSON.stringify({ diagnostics: [operations.optOut(event.recipient, event.operationId)] }));
    } else {
      response.end(JSON.stringify(await operations.release(event)));
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: "invalid_event", issues: error.issues }));
    } else if (error instanceof InfraiError || error instanceof OperationError) {
      response.statusCode = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.end(JSON.stringify({ error: error.code, message: error.message }));
    } else {
      response.statusCode = 500;
      response.end(JSON.stringify({ error: "internal_error" }));
    }
  }
});

const port = Number(process.env.PORT ?? "8787");
server.listen(port, () => console.log(`release guard listening on :${port}`));
