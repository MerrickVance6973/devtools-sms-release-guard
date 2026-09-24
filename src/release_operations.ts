import { infrai, type BatchReply } from "./infrai_sms.js";
import { selectReleaseMessages, type ReleaseMessage } from "./suppression_policy.js";

export type Diagnostic = {
  level: "info";
  event: "build_recorded" | "release_sent" | "release_suppressed";
  operationId: string;
  detail: Record<string, unknown>;
};

export class ReleaseOperations {
  private readonly optedOut = new Set<string>();
  private readonly builds = new Set<string>();

  recordBuild(buildId: string): Diagnostic {
    this.builds.add(buildId);
    return {
      level: "info",
      event: "build_recorded",
      operationId: buildId,
      detail: { state: "completed" },
    };
  }

  optOut(recipient: string, operationId: string): Diagnostic {
    this.optedOut.add(recipient);
    return {
      level: "info",
      event: "release_suppressed",
      operationId,
      detail: { recipient, reason: "opt_out" },
    };
  }

  async release(input: {
    operationId: string;
    buildId: string;
    messages: ReleaseMessage[];
  }): Promise<{ diagnostics: Diagnostic[]; delivery?: BatchReply }> {
    if (!this.builds.has(input.buildId)) {
      throw new OperationError("build_not_recorded", 409);
    }

    const decision = selectReleaseMessages(input.messages, this.optedOut);
    const diagnostics: Diagnostic[] = decision.suppressed.map((item) => ({
      level: "info",
      event: "release_suppressed",
      operationId: input.operationId,
      detail: item,
    }));

    if (decision.approved.length === 0) return { diagnostics };
    const delivery = await infrai.sms.batch.send({
      messages: decision.approved.map((message) => message.payload),
      idempotency_key: input.operationId,
    });
    diagnostics.push({
      level: "info",
      event: "release_sent",
      operationId: input.operationId,
      detail: { approved: decision.approved.length },
    });
    return { diagnostics, delivery };
  }
}

export class OperationError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
