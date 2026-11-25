import { createAuthClient } from "better-auth/react";

import type { MessageKey } from "@/i18n/messages";
import { MESSAGES } from "@/i18n/messages";

export const authClient = createAuthClient({});

// Better Auth answers in English: its error code picks our own message, in the player's language.
export function authError(t: (key: MessageKey) => string, code: string | undefined) {
  const key = `auth.error.${code}`;
  return t(key in MESSAGES.en ? (key as MessageKey) : "auth.error.generic");
}
