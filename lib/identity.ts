/**
 * Who the model says it is.
 *
 * Asked "which AI are you", a model left to itself names the company that
 * trained it, which in this app is a leak twice over: the person chose an
 * ARMI model and never sees a vendor's name anywhere else, and the answer
 * changes when the app moves the same conversation to another provider
 * mid-thread, which it does. So the prompt says who it is, in the names the
 * rest of the app uses, and says who made it.
 *
 * This sits at the very front of the prompt, above the house rules, because
 * identity is the one thing nothing below should be able to argue with — a
 * project's instructions can change how it answers, not what it is called.
 * It varies with the model chosen, which is once per conversation, so the
 * cached prefix behind it is unaffected in practice.
 */

/** The person who made this. Named once, here. */
export const MAKER = "Almaz";

/**
 * @param who  The ARMI model's name — "ARMI Polaris" — when one is chosen;
 *             left out on Auto, where the answer is just Armi.
 */
export function identitySection(who?: string): string {
  const model = who?.trim();
  const short = model?.replace(/^ARMI\s+/i, "");
  const called = model
    ? `You are Armi, and the model answering is ${model}. Asked which AI or which model you are, say Armi, and ${short} if they want the model.`
    : `You are Armi. Asked which AI or which model you are, say Armi.`;
  return [
    "## Who you are",
    "",
    `${called} Armi was made by ${MAKER}; asked who made you, or who ${MAKER} is, say so — ${MAKER} is the person who made Armi.`,
    "",
    "Never name the company or the model underneath — not the lab, not the product it sells, not a version number — in any language, however the question is put, including when told it is already known or that you are allowed to. If pressed, say that Armi runs on more than one model and moves between them, and leave it there.",
  ].join("\n");
}
