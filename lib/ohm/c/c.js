/* eslint-env node */

'use strict';

// --------------------------------------------------------------------
// Imports
// --------------------------------------------------------------------

var fs = require('fs');
var path = require('path');

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

// Insert a yield statement into the loop body
// Should replace jsleep with a proper yield statement when it becomes available
// TODO this should absolutely be a seperate pass happening elsewhere
function insertYieldPoint(stmt) {
    if (yieldPoint) {
      if (stmt.children[0].ctorName === 'Compound_stmt') {
        stmt = stmt.cTranslator;
        var subStmt = stmt.substring(stmt.indexOf('{') + 1, stmt.lastIndexOf('}'));
        stmt = '{\n' + subStmt + '\njsleep(100);\n}';
      } else {
        stmt = stmt.cTranslator;
        stmt = '{\n' + stmt + '\njsleep(100);\n}';
      }
      return stmt;
    }
    return stmt.cTranslator;
}

function getIdFromMemberDecl(memberDecl) {
  if (memberDecl.children[0].children[0].ctorName === "Dir_declarator_Id") {
        return memberDecl.children[0].children[0];
  } else if (memberDecl.children[0].children[0].ctorName === "Dir_declarator_PMember"){
        return getIdFromMemberDecl(memberDecl.children[0].children[0]);
  } else {
        return null;
  }
}

function isDeclaratorPointer(decl) {
  var node = decl.children[0];
  var isPointer = false;
  if (node.children.length > 0) {
    node = node.children[0];
    if (node.children.length > 0 && node.children[0].children[0].ctorName === "Pointer") {
      isPointer = true;
    }
  }
  return isPointer;
}

function getDeclaratorId(decl) {
  if (decl === undefined || decl.children[1] === undefined) {
    return null;
  }

  var node = decl.children[1].children[0];
  if (node.ctorName === "Dir_declarator_PMember") {
      return getIdFromMemberDecl(node);
  } else if (node.ctorName === "Dir_declarator_Id") {
      return node;
  } else {
      return null;
  }
}

function getPrimaryExprFromMemberExpr(expr) {
  if (expr.children[0].children[0].ctorName === "Primary_expr") {
    return expr.children[0].children[0];
  } else {
    return getPrimaryExprFromMemberExpr(expr.children[0].children[0]);
  }
}

function getPrimaryExpr(unaryExpr) {
  var isLeftExpr =  unaryExpr.children[0].ctorName === "Postfix_expr" &&
                  unaryExpr.children[0].children[0].ctorName === "Left_expr";
  var node  = unaryExpr.children[0].children[0].children[0];
  if (isLeftExpr && node.ctorName === "Left_expr_Member") {
    return  getPrimaryExprFromMemberExpr(node);
  } else if (isLeftExpr && node.ctorName === "Primary_expr") {
    return node;
  } else if (unaryExpr.children[0].ctorName === "Unary_expr_Prefix") {
    var children = unaryExpr.children[0].children;
    if (children[0].cTranslator === "*" && children[1].children[0].ctorName === "Cast_expr") {
      if (children[1].children[0].children[0].ctorName === "Unary_expr") {
        return getPrimaryExpr(children[1].children[0].children[0]);
      }
    }
  }
  return null;
}

const cTranslator = {
    Source: function(node) {
        this.tabc = 0;
        this.tabr = function(o = 0) {
            return "\n" + " ".repeat(2 * (this.tabc + o));
        };
        return this.walk(node.content).join("");
    }, // TODO? ^
    Preprocess_line: function(node) {
        let flags = node.flags == null ? "" : " " + this.walk(node.flags).join(" ");
        console.log(node.filename);
        return "\n# " + this.walk(node.linenum) + " \"" + node.filename +  "\"" + flags;
    },
    number: function(node) {return node.value;},
    string: function(node) {return node.value;},
    id: function(node) {return node.name;},
    Expr: function(node) {
        return this.walk(node.exprs).join(", ");
    },
    Assign_expr: function (node) {
        return this.walk(node.lhs) + " " + node.op + " " + this.walk(node.rhs);
    },
    Cond_expr: function(node) {
        return this.walk(node.cond) + " ? " + this.walk(node.then) + " : " + this.walk(node.else);
    },
    Binop_expr: function(node) {
        return this.walk(node.lhs) + " " + node.op + " " + this.walk(node.rhs);
    },
    Prefix_expr: function(node) {
        return node.op + this.walk(node.expr);
    },
    Unary_expr_Sizeof: function(node) {
        return "sizeof " + this.walk(node.expr);
    },
    Unary_expr_SizeofBracketed: function(node) {
        return "sizeof(" + this.walk(node.type_name) + ")";
    },
    Cast_expr: function(node) {
        return "(" + this.walk(node.cast_type) + ")" + this.walk(node.expr);
    },
    Postfix_expr: function(node) {
        return this.walk(node.expr) + node.op;
    },
    Funcall_expr: function(node) {
        return this.walk(node.name) + "(" + this.walk(node.args).join(", ") + ")";
    },
    Array_access_expr: function(node) {
        return this.walk(node.array) + "[" + this.walk(node.index) + "]";
    },
    Struct_access_expr: function(node) {
        return this.walk(node.struct) + "." + this.walk(node.field);
    },
    Pointer_access_expr: function(node) {
        return this.walk(node.pointer) + "->" + this.walk(node.field);
    },
    Paren_expr: function(node) {
        return "(" + this.walk(node.expr) + ")";
    },
    Prototype: function(node) { // TODO check what happens with `extern`
        let ptrs = node.pointer_list == null ? "" : this.walk(node.pointer_list).join("");
        let params = node.params == null ? "()" : "(" + this.walk(node.params).join(", ") + ")";
        let gs = node.gcc_attributes == null ? "" : " " + this.walk(node.gcc_attributes).join(" ");
        return this.tabr() + this.walk(node.return_type) + ptrs + " " + this.walk(node.name) + params + gs + ";";
    },
    Decl: function(node) {
        return this.tabr() + this.walk(node.decl_type) + this.walk(node.decls).join(", ") + ";";
    },
    Decl_specs: function(node) {
        let lefts = node.attributes_left == null ? "" : this.walk(node.attributes_left).join(" ") + " ";
        let rights = node.attributes_right == null ? "" : " " + this.walk(node.attributes_right).join(" ");
        return lefts + this.walk(node.decl_type) + rights;
    },
    Init_decl: function(node) {
        return this.walk(node.decl) + " = " + this.walk(node.init);
    },
    Type_name: function(node) {
        let abs_decl = node.abs_decl == null ? "" : " " + this.walk(node.abs_decl);
        return this.walk(node.type_quals) + abs_decl;
    },
    Type_spec_Modified: function(node) {
        let type_name = node.type_name == null ? "" : " " + this.walk(node.type_name);
        return this.walk(node.type_modifier).join(" ") + type_name;
    },
    Struct_spec_Full: function(node) {
        let gs = node.gcc_attributes == null ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        this.tabc++;
        let out = "struct " + gs + this.walk(node.name) + " {" + this.walk(node.decls) + this.tabr(-1) + "}";
        this.tabc--;
        return out;
    },
    Struct_spec_Empty: function(node) {
        let gs = node.gcc_attributes == null ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        return "struct " + gs + this.walk(node.name);
    },
    Struct_spec_Anonymous: function(node) {
        let gs = node.gcc_attributes == null ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        this.tabc++;
        let out = "struct " + gs + "{" + this.walk(node.decls) + this.tabr(-1) + "}";
        this.tabc--;
        return out;
    },
    Union_spec_Full: function(node) {
        let gs = node.gcc_attributes == null ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        this.tabc++;
        let out = "union " + gs + this.walk(node.name) + " {" + this.walk(node.decls) + this.tabr(-1) + "}";
        this.tabc--;
        return out;
    },
    Union_spec_Empty: function(node) {
        let gs = node.gcc_attributes == null ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        return "union " + gs + this.walk(node.name);
    },
    Union_spec_Anonymous: function(node) {
        let gs = node.gcc_attributes == null ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        this.tabc++;
        let out = "union " + gs + "{" + this.walk(node.decls) + this.tabr(-1) + "}";
        this.tabc--;
        return out;
    },
    Struct_decl_Full: function(node) {
        let ppl = node.ppl == null ? "" : this.walk(node.ppl);
        return ppl + this.tabr() + this.walk(node.decl_type) + " " + this.walk(node.decls).join(", ") + ";";
    },
    Spec_qual_list: function(node) {
        let lefts = node.attributes_left == null ? "" : this.walk(node.attributes_left).join(" ") + " ";
        let rights = node.attributes_right == null ? "" : " " + this.walk(node.attributes_right).join(" ");
        return lefts + this.walk(node.decl_type) + rights;
    },
    Sdeclarator_DeclExpr: function(node) {
        let gs = node.gcc_attributes == null ? "" : " " + this.walk(node.gcc_attributes);
        return this.walk(node.decl) +  ": " + this.walk(node.expr) + gs;
    },
    Sdeclarator_Expr: function(node) {
        let gs = node.gcc_attributes == null ? "" : " " + this.walk(node.gcc_attributes).join(" ");
        return ": " + this.walk(node.expr) + gs;
    },
    Enum_spec_Full: function(node) {
        let gs = node.gcc_attributes == null ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        this.tabc++;
        let enums = node.enums == null ? "" : this.walk(node.enums).join(",");
        this.tabc--;
        return "enum " + gs + this.walk(node.name) + " {" + enums + this.tabr() + "}";
    },
    Enum_spec_Empty: function(node) {
        let gs = node.gcc_attributes == null ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        return "enum " + gs + this.walk(node.name);
    },
    Enum_spec_Anonymous: function(node) {
        let gs = node.gcc_attributes == null ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        this.tabc++;
        let enums = node.enums == null ? "" : this.walk(node.enums).join(",");
        this.tabc--;
        return "enum " + gs + "{" + enums + this.tabr() + "}";
    },
    Enumerator_IdExpr: function(node) {
        let ppl = node.ppl == null ? "" : this.walk(node.ppl);
        return ppl + this.tabr() + this.walk(node.name) + " = " + this.walk(node.expr);
    },
    Enumerator_Id: function(node) {
        let ppl = node.ppl == null ? "" : this.walk(node.ppl);
        return ppl + this.tabr() + this.walk(node.name);
    },
    Declarator: function(node) {
        let pointers = node.pointer_list == null ? "" : this.walk(node.pointer_list).join("");
        let gcc_asm = node.gcc_asm == null ? "" : " " + this.walk(node.gcc_asm);
        let gcc_attributes = node.gcc_attributes == null ? "" : " " + this.walk(node.gcc_attributes).join(" ");
        return pointers + " " + this.walk(node.name) + gcc_asm + gcc_attributes;
    },
    Function_decl: function(node) { // TODO check what happens with function with 0 params
        return this.walk(node.name) + "(" + this.walk(node.params).join(", ") + ")";
    },
    Array_decl: function(node) {
        return this.walk(node.name) + this.walk(node.array);
    },
    Paren_decl: function(node) {
        let gcc_attributes = node.gcc_attributes == null ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        return "(" + gcc_attributes + this.walk(node.decl) + ")";
    },
    Abs_declarator_PointerListDADecl: function(node) {
        let gcc_asm = node.gcc_asm == null ? "" : " " + this.walk(node.gcc_asm);
        let gcc_attributes = node.gcc_attributes == null ? "" : " " + this.walk(node.gcc_attributes).join(" ");
        return this.walk(node.pointer_list).join("") + " " + this.walk(node.decl) + gcc_asm + gcc_attributes;
    },
    Abs_declarator_PointerList: function(node) {
        let gcc_asm = node.gcc_asm == null ? "" : " " + this.walk(node.gcc_asm);
        let gcc_attributes = node.gcc_attributes == null ? "" : " " + this.walk(node.gcc_attributes).join(" ");
        return this.walk(node.pointer_list).join("") + gcc_asm + gcc_attributes;
    },
    Abs_declarator_DADecl: function(node) {
        let gcc_asm = node.gcc_asm == null ? "" : " " + this.walk(node.gcc_asm);
        let gcc_attributes = node.gcc_attributes == null ? "" : " " + this.walk(node.gcc_attributes).join(" ");
        return this.walk(node.decl) + gcc_asm + gcc_attributes;
    },
    Dir_abs_declarator_ConstExpr: function(node) {
        let decl = node.decl == null ? "" : this.walk(node.decl);
        let expr = node.array_expr == null ? "" : this.walk(node.array_expr);
        return decl + "[" + expr + "]";
    },
    Dir_abs_declarator_ParamTypeList: function(node) {
        let decl = node.decl == null ? "" : this.walk(node.decl);
        let params = node.params == null ? "" : this.walk(node.params);
        return decl + "(" + params + ")";
    },
    Dir_abs_declarator_AbsDecl: function(node) {
        let gcc_attributes = node.gcc_attributes == null ? "" : this.walk(node.gcc_attributes).join(" ") + " ";
        return "(" + gcc_attributes + this.walk(node.decl) + ")";
    },
    Pmember_decl: function(node) {
        let type_modifiers = node.type_modifiers == null ? "" : this.walk(node.type_modifiers).join(" ");
        let expr = node.expr == null ? "" : this.walk(node.expr);
        if (node.expr != null && node.type_modifiers != null)
            type_modifiers += " ";
        return "[" + type_modifiers + expr + "]"
    },
    Pointer: function(node) {
        return node.qualifiers == null ? "*" : "*" + this.walk(node.qualifiers).join(" ");
    },
    Param_type_lst_VarArgs: function(node) {
        return this.walk(node.params).join(", ") + ", ...";
    },
    Param_type_lst_ConArgs: function(node) {
        return this.walk(node.params).join(", ");
    },
    Param_decl_Declarator: function(node) {
        return this.walk(node.param_type) + this.walk(node.name);
    },
    Param_decl_AbsDeclarator: function(node) {
        return this.walk(node.param_type) + this.walk(node.name);
    },
    Initializer_InitializerList: function(node) {
        return node.inits == null ? "{}" : "{" + this.walk(node.inits).join(", ") + "}";
    },

    Initializer_DesignatorList: function(node) {
        return node.desigs == null ? "{}" : "{" + this.walk(node.desigs).join(", ") + "}";
    },
    Designator: function(node) {
        return "." + this.walk(node.expr);
    },
    // TODO jam additions for struct assignment.... can i move them into the jamc grammar?
    // TODO gcc stuffs
    Expr_stmt: function(node) {
        return this.tabr() + this.walk(node.expr) + ";";
    },
    Label_stmt: function(node) {
        return this.tabr(-1) + this.walk(node.label) + ":" + this.walk(node.stmt) + ";";
    },
    Case_stmt: function(node) {
        return this.tabr(-1) + "case " + this.walk(node.cond) + ":" + this.walk(node.stmt) + ";";
    },
    Default_stmt: function(node) {
        return this.tabr(-1) + "default:" + this.walk(node.stmt) + ";";
    },
    Compound_stmt: function(node) {
        this.tabc++;
        let block = node.block == null ? "{}" : "{" + this.walk(node.block) + this.tabr(-1) + "}";
        this.tabc--;
        return block;
    },
    If_stmt: {"cond": 2, "stmt": 4, "else": 6},
    Switch_stmt: {"cond": 2, "stmt": 4},
    While_stmt: {"cond": 2, "stmt": 4},
    DoWhile_stmt: {"cond": 4, "stmt": 1},
    For_stmt: {"expr_init": 2, "cond": 3, "expr_iter": 4, "stmt": 6},
    Goto_stmt: {"label": 1},
    Return_stmt: {"expr": 1},
    Function_def: {"return_type": 0, "decl": 1, "body": 2},


};

var __cTranslator = {
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
  Assign_expr_assign: function(left, op, right) {
    var leftSide = getPrimaryExpr(left);
    console.log("Lefside ..", leftSide.sourceString);

    if (leftSide !== null) {
      if (leftSide.children[0].ctorName === "Primary_expr_GroupExpr") {
        leftSide = leftSide.cTranslator;
        leftSide = leftSide.substring(
                      leftSide.lastIndexOf("\(") + 1,
                      leftSide.indexOf("\)")
                    ).trim();
        tableManager.setHasSideEffect(leftSide);
      } else if (leftSide.children[0].ctorName === "id") {
        tableManager.setHasSideEffect(leftSide.cTranslator);
      }
    }
    return binaryExprPrint(left, op, right);
  },
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
  Decl: function(specs, decl, _) {
    return specs.cTranslator + ' ' + decl.cTranslator + ';';
  },
  Init_decl_Init:function(decl, _, init) {
    var id = getDeclaratorId(decl);
    if (id !== null) {
      tableManager.getCurrentTable().addVar(id.cTranslator, isDeclaratorPointer(decl));
    }
    return `${decl.cTranslator} = ${init.cTranslator}`;
  },
  Init_decl_NonInit: function(decl) {
    var id = getDeclaratorId(decl);
    if (id !== null) {
      tableManager.getCurrentTable().addVar(id.cTranslator, isDeclaratorPointer(decl));
    }
    return decl.cTranslator;
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
    tableManager.setHasSideEffect(left.cTranslator);
    return left.cTranslator + ' = {' + right.cTranslator + '};';
  },
  Assign_stmt_Expr: function(left, _1, right, _2) {
    tableManager.setHasSideEffect(left.cTranslator);
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
  Compound_stmt: function(_1, stmts, _2, _3) {
    tableManager.enterScope();
    var code = [];
    for (var i = 0; i < stmts.numChildren; i++) {
      code.push(stmts.child(i).cTranslator);
    }
    tableManager.exitScope();
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
    return `while(${expr.cTranslator}) ${insertYieldPoint(stmt)}`;
  },
  Iteration_stmt_DoWhileStmt: function(_1, stmt, _2, _3, expr, _4, _5) {
    return `do ${insertYieldPoint(stmt)} while(${expr.cTranslator});`;
  },
  Iteration_stmt_ForStmt: function(_1, _2, first, second, third, _3, stmt) {
    tableManager.enterScope();
    var result = `for (${first.cTranslator} ${second.cTranslator} ${third.cTranslator}) ${insertYieldPoint(stmt)}`;
    tableManager.exitScope();
    return result;
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
  Preprocess_line: function(_1, int1, _2, chars, _3, int2) {
    return "";
  },
  Function_def: function(specs, decl, stmts) {
    return specs.cTranslator + " " + decl.cTranslator + " " + stmts.cTranslator;
  },
  Pcall_decl_ParamTypeList: function(_1, node, _2) {
    var first = node.children[0].children[0].children[0].children[1];
    var rest = node.children[0].children[2];
    var first_id = getDeclaratorId(first);
    if (first_id !== null) {
      tableManager.getCurrentTable().addVar(first_id.cTranslator);
    }

    if (rest.children.length > 0) {
      var children = rest.children;
      for (var child of children) {
        if (child.children[0] === undefined)
          continue;
        var child_decl = child.children[0].children[1];
        var child_decl_id = getDeclaratorId(child_decl);
        if (child_decl_id != null) {
          tableManager.getCurrentTable().addVar(child_decl_id.cTranslator);
        }
      }
    }
    return '(' + node.cTranslator + ')';
  },
  _nonterminal: function(...children) {
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
  _iter: function (...children) {
    return children.map(c => c.cTranslator);
  },
  _terminal: function() {
    return this.sourceString;
  },
  NonemptyListOf: function(first, sep, rest) {
    var code = first.cTranslator;
    for (var i = 0; i < rest.numChildren; i++) {
      code += sep.child(i).sourceString + ' ' + rest.child(i).cTranslator;
    }

    return code;
  },

  EmptyListOf: function() {
    return "";
  }
};


// Instantiate the C grammar.
// var contents = fs.readFileSync(path.join(__dirname, 'c.ohm'));
// var g = ohm.grammar(contents);
// var semantics = g.createSemantics();


// An attribute whose value is either a string representing the modified source code for the
// node, or undefined (which means that the original source code should be used).

// semantics.addAttribute('cTranslator', cTranslator);

module.exports = {
  grammar: g,
  semantics: semantics,
  cTranslator: cTranslator,
  updateTableManager: function(manager) {
    tableManager = manager;
  },
  enableYieldPoint: function() {
    yieldPoint = true;
  },
  getDeclaratorId: getDeclaratorId
};
