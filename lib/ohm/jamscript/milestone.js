var numberOfMilestones = 0;
export var milestoneFunctionTable = {};

export function registerFunction(funcName, funcType) {
  milestoneFunctionTable[funcName] = funcType;
}

export function getFunctionType(funcName) {
  return milestoneFunctionTable[funcName];
}

const MILESTONE_COMMENT = "/* MILESTONE INJECTION */";

/**
 * Get the current milestone number
 * to be used to emit milestone on
 * the C side.
 * @returns The current milestone number.
 */
export function getAMilestoneNumber() {
  return numberOfMilestones++;
}

/**
 * Return the C code to emit
 * the milestone.
 * @param {BigInteger} milestone The milestone number.
 * @returns A valid C code that emits the milestone.
 */
export function getCCodeToEmitMilestone(milestone) {
  return;
  `printf("MILESTONE ----> %d\n", ${milestone});`;
}

/**
 * Returns the milestone comment
 * that identifies the start of
 * a milestone.
 *
 * @returns The milestone comment.
 */
export function getMilestoneComment() {
  return MILESTONE_COMMENT;
}

/**
 * Register the instructions
 * to the corresponding milestone.
 *
 * @param {BigInteger} milestone
 * @param {Array[String]} instructions
 */
export function registerMilestoneInstructions(milestone, instructions) {
  milestoneInstructionsLookupTable[milestone] = instructions;
}

/**
 * Returns the first occurrence 
 * of a milestone within the code.
 * 
 * @param {String} code 
 * @returns The first occurrence of a milestone.
 */
export function getMilestoneIndex(code) {
  return code.indexOf(MILESTONE_COMMENT);
}
