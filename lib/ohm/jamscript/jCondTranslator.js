var jConditions = new Map();

var jCondTranslator = {
  Jcond_expr_paran: function(_1, expr, _2) {
    return {
      source: "(" + expr.jCondTranslator.source + ")",
      code: expr.jCondTranslator.code
    };
  },
  Jcond_expr_not: function(_, expr) {
    return {
      source: "!" + expr.jCondTranslator.source,
      code: expr.jCondTranslator.code ^ 31
    };
  },
  Jcond_expr_bin_op: function(expr1, op, expr2) {
    return {
      source: expr1.jCondTranslator.source + " " + op.sourceString + " " + expr2.jCondTranslator.source,
      code: expr1.jCondTranslator.code | expr2.jCondTranslator.code
    };
  },
  Jcond_expr_structure: function(firstId, restIds) {
    // console.log(firstId.sourceString + restIds.sourceString);
    // console.log(jConditions);
    // return {
    //   source: `jcondition.get('${id.sourceString}').source`,
    //   code: jConditions.get(id.sourceString).code
    // }
    return '';

  },
  Jcond_expr: function(node) {
    return node.jCondTranslator;
  },
  Jcond_expr_id: function(id) {
    return {
      source: `jcond.get('${id.sourceString}').source`,
      code: jConditions.get(id.sourceString).code
    };
  },
  Jcond_specifier: function(_1, jconds, _2) {
    return jconds.jCondTranslator;
  }
};

module.exports = {
  set: function(key, value) {
    jConditions.set(key, value);
  },
  jCondTranslator: jCondTranslator
};
