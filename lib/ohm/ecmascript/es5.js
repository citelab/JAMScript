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
  return node.source.startIdx - otherNode.source.startIdx;
}


function binaryExprPrint(node) {
  if(node.children.length == 3) {
    return node.child(0).prettyish + ' ' + node.child(1).sourceString + ' ' + node.child(2).prettyish;
  } else {
    return node.prettyish;
  }
}

function unaryExprPrint(node) {
  if(node.children.length == 2) {
    return node.child(0).sourceString + ' ' + node.child(1).prettyish;
  } else {
    return node.prettyish;
  }
}


//Do I want to take Statement or Statement.child(0)?
function assureBlock(stmt) {
  if(stmt.child(0).ctorName == "Block") {
    return "{\n" + stmt.child(0).child(1).prettyish + "}";
  } else {
    return "{\n" + stmt.prettyish + "}";
  }
};

var prettyish = {
  Block: function(_1, block, _2) {
    return "{\n" + block.prettyish + "}";
  },
  // CallExpression_memberExpExp: function(a, b) {
  //   return a.sourceString + b.sourceString;
  // },
  ObjectLiteral: function(node) {
    var nonEmptyList;
    if(node.child(1).ctorName == "ListOf") {
      if(node.child(1).child(0).ctorName == "EmptyListOf") {
        return "{}"
      } else {
        nonEmptyList = node.child(1).child(0);
      }
    } else {
      nonEmptyList = node.child(1);
    }
    var code = "{\n" + nonEmptyList.child(0).prettyish;

    var rest = nonEmptyList.child(2);
    for (var i = 0; i < rest.numChildren; i++) {
      code += ',\n' + rest.child(i).prettyish;
    }
    code += "\n}";

    return code;
  },
  //TODO line breaks are off for Object Literal PropertyAssignments
  PropertyAssignment_getter: function(_1, name, _2, _3, _4, body, _5) {
    return "get " + name.prettyish + "() {\n" + body.prettyish + "}";
  },
  PropertyAssignment_setter: function(_1, name, _2, param, _3, _4, body, _5) {
    return "set " + name.prettyish + "("  + param.prettyish + ") {\n" + body.prettyish + "}";
  },
  PropertyAssignment_simple: function(name, _, assignExp) {
    return name.prettyish + ": " + assignExp.prettyish;
  },
  AssignmentExpressionOrElision_elision: function() {
    return "";
  },
  MemberExpression_newExp: function(_, exp, args) {
    return "new " + exp.prettyish + args.prettyish;
  },
  PostfixExpression: function(node) {
    if(node.numChildren == 3) {
      return node.child(0).prettyish + node.child(2).primitiveValue;
    } else {
      return node.prettyish;
    }
  },

  // UnaryExpression_deleteExp: function(_, exp) {
  //   return "delete " + exp.prettyish;
  // },
  // UnaryExpression_voidExp: function(_, exp) {
  //   return "void " + exp.prettyish;
  // },
  // UnaryExpression_typeofExp: function(_, exp) {
  //   return "typeof " + exp.prettyish;
  // },
  UnaryExpression: function(node) {
    if(node.children.length == 2) {
      if(node.child(0).ctorName == "_terminal") {
        return node.child(0).primitiveValue + node.child(1).prettyish;
      } else {
        return node.child(0).sourceString + " " + node.child(1).prettyish;
      }
    } else {
      return node.prettyish;
    }
  },
  MultiplicativeExpression: binaryExprPrint,
  AdditiveExpression : binaryExprPrint,
  ShiftExpression: binaryExprPrint,
  RelationalExpression: binaryExprPrint,
  RelationalExpression_inExp: function(relExp, _1, _2, shiftExp) {
    return relExp.prettyish + " in " + shiftExp.prettyish;
  },
  EqualityExpression: binaryExprPrint,
  BitwiseANDExpression: binaryExprPrint,
  BitwiseXORExpression: binaryExprPrint,
  BitwiseORExpression: binaryExprPrint,
  LogicalANDExpression: binaryExprPrint,
  LogicalORExpression: binaryExprPrint,
  ConditionalExpression_conditional: function(orExp, _1, exp1, _2, exp2) {
    return orExp.prettyish + " ? " + exp1.prettyish + " : " + exp2.prettyish;
  },
  AssignmentExpression: binaryExprPrint,
  Expression_commaExp: function(exp, _, assignExp) {
    return exp.prettyish +  ", " + assignExp.prettyish;
  },
  // StatementList: function(stmts) {
  //   var code = "";
  //   for (var i = 0; i < stmts.numChildren; i++) {
  //     code += stmts.child(i).prettyish;
  //   }
  //   return code;
  // },
  VariableStatement: function(_1, decList, _2) {
    return "var " + decList.prettyish + ";";
  },
  // VariableDeclarationList: function(decList) {
  //   return decList.prettyish;
  // },
  // VariableDeclaration: function(id, init) {
  //   return id.sourceString + init.prettyish;
  // },
  Initialiser: function(_, exp) {
    return " = " + exp.prettyish;
  },
  // EmptyStatement: function(_) {
  //   //TODO keep this?
  //   return ";"
  // },
  ExpressionStatement: function(exp, _) {
    return exp.prettyish + ";";
  },
  IfStatement: function(_1, _2, exp, _3, ifStmt, _4, elseStmt) {
    //TODO fixed double {} on block else
    var code = "if (" + exp.prettyish + ") " + assureBlock(ifStmt);
    if(elseStmt.numChildren > 0) {
      code += " else " + assureBlock(elseStmt.child(0));
    }
    return code
  },
  IterationStatement_doWhile: function(_1, stmt, _2, _3, exp, _4, _5) {
    return "do " + assureBlock(stmt) + " while (" + exp.prettyish + ");"
  },
  IterationStatement_whileDo: function(_1, _2, exp, _3, stmt) {
    return "while (" + exp.prettyish + ") " + assureBlock(stmt);
  },
  IterationStatement_for3: function(_1, _2, exp1, _3, exp2, _4, exp3, _5, stmt) {
    return "for (" + exp1.prettyish + "; " + exp2.prettyish + "; " + exp3.prettyish + ") " +  assureBlock(stmt);
  },
  IterationStatement_for3var: function(_1, _2, _3, vars, _4, exp1, _5, exp2, _6, stmt) {
    return "for (var " + vars.prettyish + "; " + exp1.prettyish + "; " + exp2.prettyish + ") " +  assureBlock(stmt);
  },
  IterationStatement_forIn: function(_1, _2, lhs_exp, _4, exp, _6, stmt) {
    return "for (" + lhs_exp.prettyish + " in " + exp.prettyish + ") " +  assureBlock(stmt);
  },
  IterationStatement_forInVar: function(_1, _2, _3, vars, _4, exp, _6, stmt) {
    return "for (var " + vars.prettyish + " in " + exp.prettyish + ") " +  assureBlock(stmt);
  },
  ContinueStatement: function(_1, _2, id, _4) {
    //TODO why are spaces coming in id? / kinda fixed
    if(id.numChildren == 1) {
      return "continue " + id.child(0).sourceString + ";";
    } else {
      return "continue;";
    }
  },
  BreakStatement: function(_1, _2, id, _4) {
    //TODO why no space after break? / kinda fixed
    if(id.numChildren == 1) {
      return "break " + id.child(0).sourceString + ";";
    } else {
      return "break;";
    }
  },
  ReturnStatement: function(_1, _2, exp, _4) {
    if(exp.numChildren == 1) {
      return "return " + exp.prettyish + ";";
    } else {
      return "return;";
    }
  },
  WithStatement: function(_1, _2, exp, _3, stmt) {
    return "with (" + exp.prettyish + ") " + assureBlock(stmt);
  },
  SwitchStatement: function(_1, _2, exp, _3, caseBlock) {
    return "switch(" + exp.prettyish + ") " + caseBlock.prettyish;
  },
  CaseBlock_withDefault: function(_1, beforeCases, defaultClause, afterCases, _2) {
    var code = "";
    for (var i = 0; i < beforeCases.numChildren; i++) {
      code += beforeCases.child(i).prettyish;
    }
    code += defaultClause.prettyish;
    for (var i = 0; i < afterCases.numChildren; i++) {
      code += afterCases.child(i).prettyish;
    }
    return "{\n" + code + "}\n";
  },
  CaseBlock_withoutDefault: function(_1, cases, _2) {
    var code = "";
    for (var i = 0; i < cases.numChildren; i++) {
      code += cases.child(i).prettyish;
    }
    return "{\n" + code + "}\n";
  },
  CaseClause: function(_1, exp, _2, stmts) {
    var stmt_code = "";
    for (var i = 0; i < stmts.numChildren; i++) {
      stmt_code += stmts.child(i).prettyish;
    }
    return "case " + exp.prettyish + ":\n" + stmt_code;
  },
  DefaultClause: function(_1, _2, stmts) {
    var stmt_code = "";
    for (var i = 0; i < stmts.numChildren; i++) {
      stmt_code += stmts.child(i).prettyish;
    }
    return "default:\n" + stmt_code;
  },
  LabelledStatement: function(id, _1, stmt) {
    return id.sourceString + ":\n" + stmt.prettyish;
  },
  ThrowStatement_throwExpr: function(_1, exp, _2) {
    return "throw " + exp.prettyish + ";";
  },
  TryStatement_tryCatchFinally: function(_1, block, cat, fin) {
    return "try " + block.prettyish + cat.prettyish + fin.prettyish;
  },
  TryStatement_tryFinally: function(_1, block, fin) {
    return "try " + block.prettyish + fin.prettyish;
  },
  TryStatement_tryCatch: function(_1, block, cat) {
    return "try " + block.prettyish + cat.prettyish;
  },
  Catch: function(_1, _2, params, _3, block) {
    return " catch(" + params.prettyish + ")" + block.prettyish;
  },
  Finally: function(_1, block) {
    return " finally " + block.prettyish;
  },
  FunctionDeclaration: function(_1, id , _2, params, _3, _4, body, _5) {
    return `function ${id.prettyish}(${params.prettyish}) {\n${body.prettyish}}`;
  },
  FunctionExpression_named: function(_1, id , _2, params, _3, _4, body, _5) {
    return `function ${id.prettyish}(${params.prettyish}) {\n${body.prettyish}}`;
  },
  FunctionExpression_anonymous: function(_1, _2, params, _3, _4, body, _5) {
    return `function (${params.prettyish}) {\n${body.prettyish}}`;
  },
  FormalParameterList: function(nodes) {
    return nodes.prettyish;
  },
  Statement: function(node) {
    return node.prettyish + "\n";
  },
  Declaration: function(node) {
    return node.prettyish + "\n";
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
  // ListOf: function(a) {
  //   console.log(a);
  // },
  // _iter: function(nodes) {
  //   console.log(nodes);
  //   var code = "";
  //   console.log(nodes);
  //   for (var i = 0; i < nodes.numChildren; i++) {
  //     code += nodes.child(i).prettyish;
  //     console.log(code.child(i));
  //   }
  //   return code;
  // },
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
};

// Instantiate the ES5 grammar.
var contents = fs.readFileSync(path.join(__dirname, 'es5.ohm'));
var g = ohm.grammars(contents).ES5;
var semantics = g.semantics();

semantics.addAttribute('prettyish', prettyish);


module.exports = {
  grammar: g,
  semantics: semantics
};
