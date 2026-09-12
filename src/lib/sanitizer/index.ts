export {
  aliasesForRoster,
  buildNameTokenMap,
  redact,
  rehydrate,
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
