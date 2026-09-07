export {
  aliasesForRoster,
  buildNameTokenMap,
  redact,
  rehydrate,
  sanitizeForAi,
  tokenForStudentId,
} from "./redact";
export {
  matchStudentFromDocument,
  normalizeMatchHaystack,
} from "./match";
export {
  fullNameOrderVariants,
  haystackHasNameVariant,
  normalizePersonName,
} from "./names";
export {
  prepareTextForAi,
  rehydratePreparedAiText,
} from "./prepareAiText";
export type { PreparedAiText } from "./prepareAiText";
export {
  assertSanitizedForAi,
  findRemainingRosterAliases,
  SanitizerVerificationError,
} from "./verify";
export type {
  NameTokenEntry,
  NameTokenMap,
  RosterStudent,
  StudentMatchResult,
  StudentMatchStatus,
} from "./types";
