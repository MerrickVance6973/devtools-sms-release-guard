export type ReleaseMessage = {
  recipient: string;
  payload: unknown;
};

export type ReleaseDecision = {
  approved: ReleaseMessage[];
  suppressed: Array<{ recipient: string; reason: "opt_out" }>;
};

export function selectReleaseMessages(
  messages: ReleaseMessage[],
  optedOutRecipients: ReadonlySet<string>,
): ReleaseDecision {
  const approved: ReleaseMessage[] = [];
  const suppressed: ReleaseDecision["suppressed"] = [];

  for (const message of messages) {
    if (optedOutRecipients.has(message.recipient)) {
      suppressed.push({ recipient: message.recipient, reason: "opt_out" });
    } else {
      approved.push(message);
    }
  }
  return { approved, suppressed };
}
