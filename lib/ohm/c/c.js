/* eslint-env node */

'use strict';

// --------------------------------------------------------------------
// Imports
// --------------------------------------------------------------------

var fs = require('fs');
var path = require('path');

var ohm = require('../../../ohm');

// --------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------

function isUndefined(x) { return x === void 0; }

// Take an Array of nodes, and whenever an _iter node is encountered, splice in its
// recursively-flattened children instead.
function flattenIterNodes(nodes) {
  var result = [];
  for (var i = 0; i < nodes.length; ++i) {
    if (nodes[i]._node.ctorName === '_iter') {
      result.push.apply(result, flattenIterNodes(nodes[i].children));
    } else {
      result.push(nodes[i]);
    }
  }
  return result;
}

// Comparison function for sorting nodes based on their interval's start index.
function compareByInterval(node, otherNode) {
  return node.interval.startIdx - otherNode.interval.startIdx;
}

function parseList(list, sep) {
  if(list.child(0).ctorName == "NonemptyListOf") {
    return parseNonEmptyList(list.child(0), sep);
  } else {
    return "";
  }
}

function parseNonEmptyList(list, sep) {
  var code = list.child(0).prettyish;
  var rest = list.child(2);
  for (var i = 0; i < rest.numChildren; i++) {
    code += sep + rest.child(i).prettyish
  }
  return code;
}

function parseArrayList(list, sep) {
  var code = '';
  for (var i = 0; i < list.numChildren; i++) {
    code += list.child(i).prettyish + sep;
  }
  return code;
}

function binaryExprPrint(left, op, right) {
  return left.prettyish + ' ' + op.interval.contents + ' ' + right.prettyish;
}

var prettyish = {
  hex: function(_, digits, u, l1, l2) {
    var hexCode = '';
    for (var i = 0; i < digits.numChildren; i++) {
      hexCode += digits.child(i).prettyish.toUpperCase();
    }
    if(u.numChildren > 0) {
      hexCode += "U";
    }
    if(l1.numChildren > 0) {
      hexCode += "L";
    }
    if(l2.numChildren > 0) {
      hexCode += "L";
    }
    return "0x" + hexCode;
  },
  Cond_expr_cond: function(lor_expr, _1, expr, _2, cond_expr) {
    return lor_expr.prettyish + ' ? ' + expr.prettyish + ' : ' + cond_expr.prettyish;
  },
  Assign_expr_assign: binaryExprPrint,
  Lor_expr_lor: binaryExprPrint,
  Lar_expr_lar: binaryExprPrint,
  Ior_expr_ior: binaryExprPrint,
  Xor_expr_xor: binaryExprPrint,
  And_expr_and: binaryExprPrint,
  Eq_expr_eq: binaryExprPrint,
  Rel_expr_rel: binaryExprPrint,
  Shift_expr_shift: binaryExprPrint,
  Add_expr_add: binaryExprPrint,
  Mult_expr_mult: binaryExprPrint,
  Declaration: function(specs, decl, _) {
    return specs.prettyish + ' ' + decl.prettyish + ';';
  },
  Init_decl_Init:function(decl, _, init) {
    return `${decl.prettyish} = ${init.prettyish}`;
  },
  Struct_spec_Full: function(_1, _2, id, _3, decls, _4) {
    return `struct ${id.prettyish} {\n${parseArrayList(decls, ';\n')}}`;
  },
  Struct_spec_Empty: function(_1, _2, id) {
    return `struct ${id.prettyish}`;
  },
  Struct_spec_Anonymous: function(_1, _2, _3, decls, _4) {
    return `struct {\n${decls.prettyish}}}`;
  },
  Struct_decl: function(spec, decls, _) {
    return spec.prettyish + ' ' + decls.prettyish;
  },
  Param_decl_Declarator: function(specs, declarator) {
    return specs.prettyish + ' ' + declarator.prettyish;
  },
  Initializer_DesignatorList: function(_1, designatorList, _2, _3) {
    return "{\n" + parseList(designatorList, ',\n') + "\n}"
  },
  Union_spec_Full: function(_1, _2, id, _3, decls, _4) {
    return `union ${id.prettyish} {\n${decls.prettyish}}`;
  },
  Union_spec_Empty: function(_1, _2, id) {
    return `union ${id.prettyish}`;
  },
  Union_spec_Anonymous: function(_1, _2, _3, decls, _4) {
    return `union {\n${decls.prettyish}}}`;
  },
  Enum_spec_Full: function(_1, _2, id, _3, enumerators, _4, _5) {
    return `enum ${id.prettyish} {\n${parseList(enumerators, ',\n')}\n}`;
  },
  Enum_spec_Empty: function(_1, _2, id) {
    return `enum ${id.prettyish}`;
  },
  Enum_spec_Anonymous: function(_1, _2, _3, enumerators, _4, _5) {
    return `enum {\n${parseList(enumerators, ',\n')}\n}`;
  },
  // Stmt: function(stmt) {
  //   return stmt.prettyish + '\n';
  // },
  Type_modifier: function(mods) {
    var code = [];
    for (var i = 0; i < mods.numChildren; i++) {
      code.push(mods.child(i).prettyish);
    }
    return code.join(' ');;
  },
  Decl_specs: function(first, type) {
    if(first.numChildren > 0) {
      return first.prettyish + ' ' + type.prettyish;
    } else {
      return type.prettyish;
    }
  },
  Type_spec_Modified: function(modifier, type) {
    if(type.numChildren == 0) {
      return modifier.prettyish;
    } else {
      return modifier.prettyish + ' ' + type.prettyish;
    }
  },
  Labeled_stmt_LabeledStmt: function(id, _, stmt) {
    return `${id.prettyish}:\n${stmt.prettyish}`;
  },
  Labeled_stmt_CaseStmt: function(_1, expr, _2, stmt) {
    return `case ${expr.prettyish}:\n${stmt.prettyish}`;
  },
  Labeled_stmt_DefaultStmt: function(_1, _2, stmt) {
    return `default:\n${stmt.prettyish}`;
  },
  Compound_stmt: function(_1, stmts, _2) {
    var code = [];
    for (var i = 0; i < stmts.numChildren; i++) {
      code.push(stmts.child(i).prettyish);
    }
    return "{\n" + code.join('\n') + "\n}";
  },
  Selection_stmt_IfStmt: function(_1, _2, expr, _3, ifStmt, _4, elseStmt) {
    //TODO: Need assure compound for statements
    if(elseStmt.numChildren > 0) {
      return `if(${expr.prettyish}) ${ifStmt.prettyish} else ${elseStmt.prettyish}`;
    } else {
      return `if(${expr.prettyish}) ${ifStmt.prettyish}`;
    }
  },
  Selection_stmt_SwitchStmt: function(_1, _2, expr, _4, stmt) {
    return `switch(${expr.prettyish}) ${stmt.prettyish}`;
  },
  Iteration_stmt_WhileStmt: function(_1, _2, expr, _3, stmt) {
    return `while(${expr.prettyish}) ${stmt.prettyish}`;
  },
  Iteration_stmt_DoWhileStmt: function(_1, stmt, _2, _3, expr, _4, _5) {
    return `do ${stmt.prettyish} while(${expr.prettyish});`;
  },
  Iteration_stmt_ForStmt: function(_1, _2, first, second, third, _3, stmt) {
    return `for (${first.prettyish} ${second.prettyish} ${third.prettyish}) ${stmt.prettyish}`;
  },
  Jump_stmt_ReturnStmt: function(_1, expr, _2) {
    if(expr.numChildren == 0) {
      return 'return;';
    } else {
      return `return ${expr.prettyish};`;
    }
  },
  Jump_stmt_GotoStmt: function(_1, id, _2) {
    return `goto ${id.prettyish};`;
  },
  Function_def: function(specs, decl, stmts) {
    return specs.prettyish + " " + decl.prettyish + " " + stmts.prettyish;
  },
  _nonterminal: function(children) {
    var flatChildren = flattenIterNodes(children).sort(compareByInterval);
    var childResults = flatChildren.map(function(n) { return n.prettyish; });
    if (flatChildren.length === 0 || childResults.every(isUndefined)) {
      return undefined;
    }
    var code = '';
    for (var i = 0; i < flatChildren.length; ++i) {
      if (childResults[i] != null) {
        code += childResults[i];
      }
    }
    return code;
  },
  _terminal: function() {
    return this.primitiveValue;
  },
  NonemptyListOf: function(first, sep, rest) {
    var code = first.prettyish;
    for (var i = 0; i < rest.numChildren; i++) {
      code += sep.child(i).primitiveValue + ' ' + rest.child(i).prettyish;
    }
    return code;
  },

  EmptyListOf: function() {
    return "";
  }
}


// Instantiate the C grammar.
var contents = fs.readFileSync(path.join(__dirname, 'c.ohm'));
var g = ohm.grammars(contents).C;
var semantics = g.semantics();


// An attribute whose value is either a string representing the modified source code for the
// node, or undefined (which means that the original source code should be used).

semantics.addAttribute('prettyish', prettyish);

module.exports = {
  grammar: g,
  semantics: semantics
};
