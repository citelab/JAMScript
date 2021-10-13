/* eslint-env node */

'use strict';

// --------------------------------------------------------------------
// Imports
// --------------------------------------------------------------------

var fs = require('fs');
var path = require('path');

var ohm = require('ohm-js');
var tableManager;
var yieldPoint = false;

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
  if(node.children.length === 3) {
    if (node.ctorName === "AssignmentExpression_assignment") {
        var id = getIdFromLeftExpr(node.child(0));
        if (id !== null) {
          tableManager.setHasSideEffect(id);
      }
    }
    return node.child(0).es5Translator + ' ' + node.child(1).sourceString + ' ' + node.child(2).es5Translator;
  } else {
    return node.es5Translator;
  }
}

function unaryExprPrint(node) {
  if(node.children.length === 2) {
    return node.child(0).sourceString + ' ' + node.child(1).es5Translator;
  } else {
    return node.es5Translator;
  }
}


//Do I want to take Statement or Statement.child(0)?
function assureBlock(stmt) {
  tableManager.enterScope();
  var result;
  if(stmt.child(0).ctorName === "Block") {
    result = "{\n" + stmt.child(0).child(1).es5Translator + "}";
  } else {
    result = "{\n" + stmt.es5Translator + "}";
  }
  tableManager.exitScope();
  return result;
}

// Insert a yield statement into the loop body
// TODO: Should replace jsleep with a proper yield statement when it becomes available
  function insertYieldPoint(stmt) {
    if (yieldPoint) {
      tableManager.enterScope();
      if(stmt.child(0).ctorName === "Block") {
        stmt = "{\n" + stmt.child(0).child(1).es5Translator + "\njsleep();\n}";
      } else {
        stmt = "{\n" + stmt.es5Translator + "\njsleep();\n}";
      }
      tableManager.exitScope();
      return stmt;
    } else {
      return assureBlock(stmt);
    } 
  }

function getIdFromMemberExpr(memberExpr) {
  var arr = ["MemberExpression_arrayRefExp", "MemberExpression_propRefExp"];
  if (arr.includes(memberExpr.children[0].ctorName)) {
    return getIdFromMemberExpr(memberExpr.children[0].children[0]);
  } else if (memberExpr.children[0].ctorName === "PrimaryExpression") {
    if (memberExpr.children[0].children[0].ctorName === "identifier") {
      return memberExpr.children[0].children[0].es5Translator;
    } 
  } 
  return null;
}

function getIdFromLeftExpr(leftExpr) {
  if (leftExpr.children[0].ctorName === "NewExpression") {
    var node =  leftExpr.children[0].children[0];
    if (node.ctorName === "MemberExpression") {
      return getIdFromMemberExpr(node);
    }
  }
  return null;
}

var es5Translator = {
  Block: function(_1, block, _2) {
    tableManager.enterScope();
    var result = "{\n" + block.es5Translator + "}";
    tableManager.exitScope();
    return result;
  },
  ObjectLiteral: function(node) {
    var nonEmptyList;
    if(node.child(1).ctorName === "ListOf") {
      if(node.child(1).child(0).ctorName === "EmptyListOf") {
        return "{}";
      } else {
        nonEmptyList = node.child(1).child(0);
      }
    } else {
      nonEmptyList = node.child(1);
    }
    var code = "{\n" + nonEmptyList.child(0).es5Translator;

    var rest = nonEmptyList.child(2);
    for (var i = 0; i < rest.numChildren; i++) {
      code += ',\n' + rest.child(i).es5Translator;
    }
    code += "\n}";

    return code;
  },
  //TODO line breaks are off for Object Literal PropertyAssignments
  PropertyAssignment_getter: function(_1, name, _2, _3, _4, body, _5) {
    return "get " + name.es5Translator + "() {\n" + body.es5Translator + "}";
  },
  PropertyAssignment_setter: function(_1, name, _2, param, _3, _4, body, _5) {
    return "set " + name.es5Translator + "("  + param.es5Translator + ") {\n" + body.es5Translator + "}";
  },
  PropertyAssignment_simple: function(name, _, assignExp) {
    return name.es5Translator + ": " + assignExp.es5Translator;
  },
  AssignmentExpressionOrElision_elision: function() {
    return "";
  },
  MemberExpression_newExp: function(_, exp, args) {
    return "new " + exp.es5Translator + args.es5Translator;
  },
  PostfixExpression: function(node) {
    if(node.numChildren === 3) {
      return node.child(0).es5Translator + node.child(2).primitiveValue;
    } else {
      return node.es5Translator;
    }
  },
  UnaryExpression: function(node) {
    if(node.children.length === 2) {
      if(node.child(0).ctorName === "_terminal") {
        return node.child(0).primitiveValue + node.child(1).es5Translator;
      } else {
        return node.child(0).sourceString + " " + node.child(1).es5Translator;
      }
    } else {
      return node.es5Translator;
    }
  },
  MultiplicativeExpression: binaryExprPrint,
  AdditiveExpression : binaryExprPrint,
  ShiftExpression: binaryExprPrint,
  RelationalExpression: binaryExprPrint,
  RelationalExpression_inExp: function(relExp, _1, _2, shiftExp) {
    return relExp.es5Translator + " in " + shiftExp.es5Translator;
  },
  EqualityExpression: binaryExprPrint,
  BitwiseANDExpression: binaryExprPrint,
  BitwiseXORExpression: binaryExprPrint,
  BitwiseORExpression: binaryExprPrint,
  LogicalANDExpression: binaryExprPrint,
  LogicalORExpression: binaryExprPrint,
  ConditionalExpression_conditional: function(orExp, _1, exp1, _2, exp2) {
    return orExp.es5Translator + " ? " + exp1.es5Translator + " : " + exp2.es5Translator;
  },
  AssignmentExpression: binaryExprPrint,
  Expression_commaExp: function(exp, _, assignExp) {
    return exp.es5Translator +  ", " + assignExp.es5Translator;
  },
  AssignmentStatement_object: function(left, _2, right, _3) {
      tableManager.setHasSideEffect(left.es5Translator);
      return left.es5Translator + ' = ' + right.es5Translator + ';';
  },
  AssignmentStatement_expression: function(left, _2, right, _3) {
      tableManager.setHasSideEffect(left.es5Translator);
      return left.es5Translator + ' = ' + right.es5Translator + ';';
  },
  VariableStatement: function(_1, decList, _2) {
    var temp = "var " + decList.es5Translator + ";";
    return temp;
  },

  VariableDeclarationList: function(decList) {
    return decList.es5Translator;
  },

  VariableDeclaration: function(id, initialiser) {
    id = id.es5Translator
    tableManager.getCurrentTable().addVar(id);
    return id + initialiser.es5Translator;
  },
  Initialiser: function(_, exp) {
    return " = " + exp.es5Translator;
  },
  ExpressionStatement: function(exp, _) {
    return exp.es5Translator + ";";
  },
  IfStatement: function(_1, _2, exp, _3, ifStmt, _4, elseStmt) {
    //TODO fixed double {} on block else
    var code = "if (" + exp.es5Translator + ") " + assureBlock(ifStmt);
    if(elseStmt.numChildren > 0) {
      code += " else " + assureBlock(elseStmt.child(0));
    }
    return code;
  },
  IterationStatement_doWhile: function(_1, stmt, _2, _3, exp, _4, _5) {
    return "do " + insertYieldPoint(stmt) + " while (" + exp.es5Translator + ");";
  },
  IterationStatement_whileDo: function(_1, _2, exp, _3, stmt) {
    return "while (" + exp.es5Translator + ") " + insertYieldPoint(stmt);
  },
  IterationStatement_for3: function(_1, _2, exp1, _3, exp2, _4, exp3, _5, stmt) {
    return "for (" + exp1.es5Translator + "; " + exp2.es5Translator + "; " + exp3.es5Translator + ") " +  insertYieldPoint(stmt);
  },
  IterationStatement_for3var: function(_1, _2, _3, vars, _4, exp1, _5, exp2, _6, stmt) {
    tableManager.enterScope();
    var result = "for (var " + vars.es5Translator + "; " + exp1.es5Translator + "; " + exp2.es5Translator + ") " +  insertYieldPoint(stmt);
    tableManager.exitScope();
    return result;
  },
  IterationStatement_forIn: function(_1, _2, lhs_exp, _4, exp, _6, stmt) {
    return "for (" + lhs_exp.es5Translator + " in " + exp.es5Translator + ") " +  insertYieldPoint(stmt);
  },
  IterationStatement_forInVar: function(_1, _2, _3, vars, _4, exp, _6, stmt) {
    tableManager.enterScope();
    var result = "for (var " + vars.es5Translator + " in " + exp.es5Translator + ") " +  insertYieldPoint(stmt);
    tableManager.exitScope();
    return result;
  },
  ContinueStatement: function(_1, _2, id, _4) {
    //TODO why are spaces coming in id? / kinda fixed
    if(id.numChildren === 1) {
      return "continue " + id.child(0).sourceString + ";";
    } else {
      return "continue;";
    }
  },
  BreakStatement: function(_1, _2, id, _4) {
    //TODO why no space after break? / kinda fixed
    if(id.numChildren === 1) {
      return "break " + id.child(0).sourceString + ";";
    } else {
      return "break;";
    }
  },
  ReturnStatement: function(_1, _2, exp, _4) {
    if(exp.numChildren === 1) {
      return "return " + exp.es5Translator + ";";
    } else {
      return "return;";
    }
  },
  WithStatement: function(_1, _2, exp, _3, stmt) {
    return "with (" + exp.es5Translator + ") " + assureBlock(stmt);
  },
  SwitchStatement: function(_1, _2, exp, _3, caseBlock) {
    return "switch(" + exp.es5Translator + ") " + caseBlock.es5Translator;
  },
  CaseBlock_withDefault: function(_1, beforeCases, defaultClause, afterCases, _2) {
    var code = "";
    var i;
  
    for (i = 0; i < beforeCases.numChildren; i++) {
      code += beforeCases.child(i).es5Translator;
    }
    code += defaultClause.es5Translator;
    for (i = 0; i < afterCases.numChildren; i++) {
      code += afterCases.child(i).es5Translator;
    }
    return "{\n" + code + "}\n";
  },
  CaseBlock_withoutDefault: function(_1, cases, _2) {
    var code = "";
    for (var i = 0; i < cases.numChildren; i++) {
      code += cases.child(i).es5Translator;
    }
    return "{\n" + code + "}\n";
  },
  CaseClause: function(_1, exp, _2, stmts) {
    var stmt_code = "";
    for (var i = 0; i < stmts.numChildren; i++) {
      stmt_code += stmts.child(i).es5Translator;
    }
    return "case " + exp.es5Translator + ":\n" + stmt_code;
  },
  DefaultClause: function(_1, _2, stmts) {
    var stmt_code = "";
    for (var i = 0; i < stmts.numChildren; i++) {
      stmt_code += stmts.child(i).es5Translator;
    }
    return "default:\n" + stmt_code;
  },
  LabelledStatement: function(id, _1, stmt) {
    return id.sourceString + ":\n" + stmt.es5Translator;
  },
  ThrowStatement_throwExpr: function(_1, exp, _2) {
    return "throw " + exp.es5Translator + ";";
  },
  TryStatement_tryCatchFinally: function(_1, block, cat, fin) {
    return "try " + block.es5Translator + cat.es5Translator + fin.es5Translator;
  },
  TryStatement_tryFinally: function(_1, block, fin) {
    return "try " + block.es5Translator + fin.es5Translator;
  },
  TryStatement_tryCatch: function(_1, block, cat) {
    return "try " + block.es5Translator + cat.es5Translator;
  },
  Catch: function(_1, _2, params, _3, block) {
    return " catch(" + params.es5Translator + ")" + block.es5Translator;
  },
  Finally: function(_1, block) {
    return " finally " + block.es5Translator;
  },
  FunctionDeclaration: function(_1, id , _2, params, _3, _4, body, _5) {
    return `function ${id.es5Translator}(${params.es5Translator}) {\n${body.es5Translator}}`;;
  },
  FunctionExpression_named: function(_1, id , _2, params, _3, _4, body, _5) {
    return `function ${id.es5Translator}(${params.es5Translator}) {\n${body.es5Translator}}`;
  },
  FunctionExpression_anonymous: function(_1, _2, params, _3, _4, body, _5) {
    return `function (${params.es5Translator}) {\n${body.es5Translator}}`;
  },
  FormalParameterList: function(nodes) {
    return nodes.es5Translator;
  },
  FormalParameter: function(id) {
    id = id.es5Translator;
    tableManager.getCurrentTable().addVar(id);
    return id;
  },
  Statement: function(node) {
    return node.es5Translator + "\n";
  },
  Declaration: function(node) {
    return node.es5Translator + "\n";
  },
  _nonterminal: function(children) {
    var flatChildren = flattenIterNodes(children).sort(compareByInterval);
    var childResults = flatChildren.map(function(n) { return n.es5Translator; });
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
    var code = first.es5Translator;
    for (var i = 0; i < rest.numChildren; i++) {
      code += sep.child(i).primitiveValue + ' ' + rest.child(i).es5Translator;
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
var semantics = g.createSemantics();
semantics.addAttribute('es5Translator', es5Translator);

module.exports = {
  grammar: g,
  semantics: semantics,
  es5Translator: es5Translator,
  updateTableManager: function(manager) {
    tableManager = manager;
  },
  enableYieldPoint: function() {
    yieldPoint = true;
  }
};
