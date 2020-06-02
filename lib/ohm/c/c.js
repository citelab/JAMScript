/* eslint-env node */

'use strict';

// --------------------------------------------------------------------
// Imports
// --------------------------------------------------------------------

var fs = require('fs');
var path = require('path');

var ohm = require('ohm-js');

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
  return node.source.startIdx - otherNode.source.startIdx;
}

function parseList(list, sep) {
  if(list.child(0).ctorName === "NonemptyListOf") {
    return parseNonEmptyList(list.child(0), sep);
  } else {
    return "";
  }
}

function parseNonEmptyList(list, sep) {
  var code = list.child(0).cTranslator;
  var rest = list.child(2);
  for (var i = 0; i < rest.numChildren; i++) {
    code += sep + rest.child(i).cTranslator;
  }
  return code;
}

function parseArrayList(list, sep) {
  var code = '';
  for (var i = 0; i < list.numChildren; i++) {
    code += list.child(i).cTranslator + sep;
  }
  return code;
}

function binaryExprPrint(left, op, right) {
  return left.cTranslator + ' ' + op.sourceString + ' ' + right.cTranslator;
}

var cTranslator = {
  hex: function(_, digits, u, l1, l2) {
    var hexCode = '';
    for (var i = 0; i < digits.numChildren; i++) {
      hexCode += digits.child(i).cTranslator.toUpperCase();
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
    return lor_expr.cTranslator + ' ? ' + expr.cTranslator + ' : ' + cond_expr.cTranslator;
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
  Prototype: function(specs, pointer, id, _1, params, _2, gcc, _3) {
    return specs.cTranslator + ' ' + pointer.cTranslator + '  ' + id.cTranslator + '(' + params.cTranslator + ')'  + gcc.cTranslator + ';';
  },
  // Abs_declarator_PointerListDirAbsDeclarator: function(pointer, decl, gcc1, gcc2) {
  //   return pointer.cTranslator + ' ' + decl.cTranslator;
  // },
  Decl: function(specs, decl, _) {
    return specs.cTranslator + ' ' + decl.cTranslator + ';';
  },
  Init_decl_Init:function(decl, _, init) {
    return `${decl.cTranslator} = ${init.cTranslator}`;
  },
  Struct_spec_Full: function(_1, _2, id, _3, decls, _4) {
    return `struct ${id.cTranslator} {\n${parseArrayList(decls, '')}}`;
  },
  Struct_spec_Empty: function(_1, _2, id) {
    return `struct ${id.cTranslator}`;
  },
  Struct_spec_Anonymous: function(_1, _2, _3, decls, _4) {
    return `struct {\n${parseArrayList(decls, '')}}`;
  },
  Struct_decl_Full: function(preprocess, spec, decls, _) {
    return spec.cTranslator + ' ' + decls.cTranslator + ';\n';
  },
  Struct_decl_Preprocess: function(preprocess) {
    return "";
  },
  Spec_qual_list: function(qualifiers, type, qualifier2) {
    var suffix = "";
    if(qualifier2.numChildren > 0) {
      suffix = " " + qualifier2.cTranslator;
    }
    return parseArrayList(qualifiers, ' ') + type.cTranslator + suffix;
  },
  Param_decl_Declarator: function(specs, declarator) {
    return specs.cTranslator + ' ' + declarator.cTranslator;
  },
  Initializer_DesignatorList: function(_1, designatorList, _2, _3) {
    return "{\n" + parseList(designatorList, ',\n') + "\n}";
  },
  Union_spec_Full: function(_1, _2, id, _3, decls, _4) {
    return `union ${id.cTranslator} {\n${parseArrayList(decls, '')}}`;
  },
  Union_spec_Empty: function(_1, _2, id) {
    return `union ${id.cTranslator}`;
  },
  Union_spec_Anonymous: function(_1, _2, _3, decls, _4) {
    return `union {\n${parseArrayList(decls, '')}}`;
  },
  Enum_spec_Full: function(_1, _2, id, _3, enumerators, _4, _5) {
    return `enum ${id.cTranslator} {\n${parseList(enumerators, ',\n')}\n}`;
  },
  Enum_spec_Empty: function(_1, _2, id) {
    return `enum ${id.cTranslator}`;
  },
  Enum_spec_Anonymous: function(_1, _2, _3, enumerators, _4, _5) {
    return `enum {\n${parseList(enumerators, ',\n')}\n}`;
  },
  Struct_access: function(id, _, expr) {
    return id.sourceString + ": " + expr.cTranslator;
  },
  Assign_stmt_Struct: function(left, _1, _2, right, _3, _4) {
    return left.cTranslator + ' = {' + right.cTranslator + '};';
  },
  Assign_stmt_Expr: function(left, _1, right, _2) {
    return left.cTranslator + ' = ' + right.cTranslator + ';';
  },
  Type_modifier: function(mods) {
    var code = [];
    for (var i = 0; i < mods.numChildren; i++) {
      code.push(mods.child(i).cTranslator);
    }
    return code.join(' ');
  },
  Decl_specs: function(before, type, after) {
    var code = '';
    if(before.numChildren > 0) {
      code += parseArrayList(before, ' ') + ' ';
    }

    code += type.cTranslator;

    if(after.numChildren > 0) {
      code += ' ' + after.cTranslator;
    }
    return code;
  },
  Type_spec_Modified: function(modifier, type) {
    if(type.numChildren === 0) {
      return modifier.cTranslator;
    } else {
      return modifier.cTranslator + ' ' + type.cTranslator;
    }
  },
  Labeled_stmt_LabeledStmt: function(id, _, stmt) {
    return `${id.cTranslator}:\n${stmt.cTranslator}`;
  },
  Labeled_stmt_CaseStmt: function(_1, expr, _2, stmt) {
    return `case ${expr.cTranslator}:\n${stmt.cTranslator}`;
  },
  Labeled_stmt_DefaultStmt: function(_1, _2, stmt) {
    return `default:\n${stmt.cTranslator}`;
  },
  Compound_stmt: function(_1, stmts, _2) {
    var code = [];
    for (var i = 0; i < stmts.numChildren; i++) {
      code.push(stmts.child(i).cTranslator);
    }
    return "{\n" + code.join('\n') + "\n}";
  },
  Selection_stmt_IfStmt: function(_1, _2, expr, _3, ifStmt, _4, elseStmt) {
    //TODO: Need assure compound for statements
    if(elseStmt.numChildren > 0) {
      return `if(${expr.cTranslator}) ${ifStmt.cTranslator} else ${elseStmt.cTranslator}`;
    } else {
      return `if(${expr.cTranslator}) ${ifStmt.cTranslator}`;
    }
  },
  Selection_stmt_SwitchStmt: function(_1, _2, expr, _4, stmt) {
    return `switch(${expr.cTranslator}) ${stmt.cTranslator}`;
  },
  Iteration_stmt_WhileStmt: function(_1, _2, expr, _3, stmt) {
    return `while(${expr.cTranslator}) ${stmt.cTranslator}`;
  },
  Iteration_stmt_DoWhileStmt: function(_1, stmt, _2, _3, expr, _4, _5) {
    return `do ${stmt.cTranslator} while(${expr.cTranslator});`;
  },
  Iteration_stmt_ForStmt: function(_1, _2, first, second, third, _3, stmt) {
    return `for (${first.cTranslator} ${second.cTranslator} ${third.cTranslator}) ${stmt.cTranslator}`;
  },
  Jump_stmt_ReturnStmt: function(_1, expr, _2) {
    if(expr.numChildren === 0) {
      return 'return;';
    } else {
      return `return ${expr.cTranslator};`;
    }
  },
  Jump_stmt_GotoStmt: function(_1, id, _2) {
    return `goto ${id.cTranslator};`;
  },
  Gcc_asm_expr: function(_1, type_qual, _2, strings, _3) {
    return ' ' + _1.sourceString + type_qual.cTranslator + '(' + strings.sourceString + _3.sourceString;
  },
  Gcc_asm_expr_string: function(_1, string, _2) {
    return '"' + string.sourceString + '"';
  },
  Preprocess_line: function(_1, int1, _2, chars, _3, int2) {
    return "";
  },
  Function_def: function(specs, decl, stmts) {
    return specs.cTranslator + " " + decl.cTranslator + " " + stmts.cTranslator;
  },
  _nonterminal: function(children) {
    var flatChildren = flattenIterNodes(children).sort(compareByInterval);
    var childResults = flatChildren.map(function(n) { return n.cTranslator; });
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
    var code = first.cTranslator;
    for (var i = 0; i < rest.numChildren; i++) {
      code += sep.child(i).primitiveValue + ' ' + rest.child(i).cTranslator;
    }
    return code;
  },

  EmptyListOf: function() {
    return "";
  }
};


// Instantiate the C grammar.
var contents = fs.readFileSync(path.join(__dirname, 'c.ohm'));
var g = ohm.grammar(contents);
var semantics = g.createSemantics();


// An attribute whose value is either a string representing the modified source code for the
// node, or undefined (which means that the original source code should be used).

semantics.addAttribute('cTranslator', cTranslator);

module.exports = {
  grammar: g,
  semantics: semantics,
  cTranslator: cTranslator
};
