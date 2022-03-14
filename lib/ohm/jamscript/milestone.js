var numberOfMilestones = 0;
var milestoneFunctionTable = {};
const MILESTONE_COMMENT = "/* MILESTONE INJECTION */";

module.exports = {
  registerFunction: function (funcName, funcType) {
    milestoneFunctionTable[funcName] = funcType;
  },
  getFunctionType: function (funcName) {
    return milestoneFunctionTable[funcName];
  },
  /**
   * Get the current milestone number
   * to be used to emit milestone on
   * the C side.
   * @returns The current milestone number.
   */
  getAMilestoneNumber() {
    return numberOfMilestones++;
  },
  /**
   * Return the C code to emit
   * the milestone.
   * @param {BigInteger} milestone The milestone number.
   * @returns A valid C code that emits the milestone.
   */
  getCCodeToEmitMilestone: function (milestone) {
    return;
    `printf("MILESTONE ----> %d\n", ${milestone});`;
  },

  /**
   * Returns the milestone comment
   * that identifies the start of
   * a milestone.
   *
   * @returns The milestone comment.
   */
  getMilestoneComment: function () {
    return MILESTONE_COMMENT;
  },

  /**
   * Register the instructions
   * to the corresponding milestone.
   *
   * @param {BigInteger} milestone
   * @param {Array[String]} instructions
   */
  registerMilestoneInstructions: function (milestone, instructions) {
    milestoneInstructionsLookupTable[milestone] = instructions;
  },

  /**
   * Returns the first occurrence
   * of a milestone within the code.
   *
   * @param {String} code
   * @returns The first occurrence of a milestone.
   */
  getMilestoneIndex: function (code) {
    return code.indexOf(MILESTONE_COMMENT);
  },
};
