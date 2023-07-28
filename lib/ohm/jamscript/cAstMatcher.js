/* eslint-env node */
"use strict";
const fs = require("fs");
const path = require("path");
const ohm = require("ohm-js");
const toAST = require('ohm-js/extras').toAST;
const cstPrint = require("./cstPrint");

const jamc = fs.readFileSync(path.join(__dirname, "jamc.ohm"));
const ns = {
	C: ohm.grammar(fs.readFileSync(path.join(__dirname, "../c/c.ohm"))),
};
const jamCGrammar = ohm.grammar(jamc, ns);
var semantics = jamCGrammar.createSemantics();
semantics.addOperation("cstPrint", cstPrint);

// Rules for converting CST into more usable AST
const astMatcher = {
    Source: {"content": 0},
    Preprocess_line: {"linenum": 1, "filename": 3, "flags": 5},
    id: {"name": 0},
    string: {"value": 0},
    number: {"value": 0},
    Expr_list: {"exprs": 0},
    Assign_expr_assign: {type: "Assign_expr", "lhs": 0, "op": 1, "rhs": 2},
    Cond_expr_cond: {type: "Cond_expr", "cond": 0, "then": 2, "else": 4},
    Lor_expr_lor: {type: "Binop_expr", "lhs": 0, "op": 1, "rhs": 2},
    Lar_expr_lar: {type: "Binop_expr", "lhs": 0, "op": 1, "rhs": 2},
    Ior_expr_ior: {type: "Binop_expr", "lhs": 0, "op": 1, "rhs": 2},
    Xor_expr_xor: {type: "Binop_expr", "lhs": 0, "op": 1, "rhs": 2},
    And_expr_and: {type: "Binop_expr", "lhs": 0, "op": 1, "rhs": 2},
    Eq_expr_eq: {type: "Binop_expr", "lhs": 0, "op": 1, "rhs": 2},
    Rel_expr_rel: {type: "Binop_expr", "lhs": 0, "op": 1, "rhs": 2},
    Shift_expr_shift: {type: "Binop_expr", "lhs": 0, "op": 1, "rhs": 2},
    Add_expr_add: {type: "Binop_expr", "lhs": 0, "op": 1, "rhs": 2},
    Mult_expr_mult: {type: "Binop_expr", "lhs": 0, "op": 1, "rhs": 2},
    Prefix_expr_Unary: {type: "Prefix_expr", "op": 0, "expr": 2},
    Unary_expr_Prefix: {type: "Prefix_expr", "op": 0, "expr": 1},
    Unary_expr_Sizeof: {"expr": 1},
    Unary_expr_SizeofBracketed: {"type_name": 2},
    Cast_expr_Cast: {type: "Cast_expr", "cast_type": 1, "expr": 3},
    Postfix_expr_Postfix: {type: "Postfix_expr", "expr": 0, "op": 2},
    Left_expr_Call: {type: "Funcall_expr", "name": 0, "args": 1},
    Left_expr_Array: {type: "Array_access_expr", "array": 0, "index": 2},
    Left_expr_Struct: {type: "Struct_access_expr", "struct": 0, "field": 2},
    Left_expr_Pointer: {type: "Pointer_access_expr", "pointer": 0, "field": 2},
    Primary_expr_GroupExpr: {type: "Paren_expr", "expr": 1}, // not technically needed in ast but easier codegen
    Prototype: {"return_type": 0, "pointer_list": 1, "name": 2, "params": 4, "gcc_attributes": 6},
    Decl_Decl: {type: "Decl", "decl_type": 0, "decls": 1},
    Decl_specs: {"attributes_left": 0, "decl_type": 1, "attributes_right": 2},
    Init_decl_Init: {type: "Init_decl", "decl": 0, "init": 2},
    Type_name: {"type_quals": 0, "abs_decl": 1},
    Type_spec_Modified: {"modifier": 0, "type_name" : 1},
    Struct_spec_Full: {"gcc_attributes": 1, "name": 2, "decls": 4},
    Struct_spec_Empty: {"gcc_attributes": 1, "name": 2},
    Struct_spec_Anonymous: {"gcc_attributes": 1, "decls": 3},
    Union_spec_Full: {"gcc_attributes": 1, "name": 2, "decls": 4},
    Union_spec_Empty: {"gcc_attributes": 1, "name": 2},
    Union_spec_Anonymous: {"gcc_attributes": 1, "decls": 3},
    Struct_decl_Full: {"ppl": 0, "decl_type": 1, "decls": 2},
    Spec_qual_list: {"attributes_left": 0, "decl_type": 1, "attributes_right": 2},
    Sdeclarator_DeclExpr: {"decl": 0, "expr": 2, "gcc_attributes": 3},
    Sdeclarator_Expr: {"expr": 1, "gcc_attributes": 2},
    Enum_spec_Full: {"gcc_attributes": 1, "name": 2, "enums": 4},
    Enum_spec_Empty: {"gcc_attributes": 1, "name": 2},
    Enum_spec_Anonymous: {"gcc_attributes": 1, "enums": 3},
    Enumerator_IdExpr: {"ppl": 0, "name": 1, "expr": 3},
    Enumerator_Id: {"ppl": 0, "name": 1},
    Declarator: {"pointer_list": 0, "name": 1, "gcc_asm": 2, "gcc_attributes": 3},
    Dir_declarator_PCall: {type: "Function_decl", "name": 0, "params": 1},
    Dir_declarator_PMember: {type: "Array_decl", "name": 0, "array": 1},
    Dir_declarator_Declarator: {type: "Paren_decl", "gcc_attributes": 1, "decl": 2},
    Abs_declarator_PointerListDADecl: {"pointer_list": 0, "decl": 1, "gcc_asm": 2, "gcc_attributes": 3},
    Abs_declarator_PointerList: {"pointer_list": 0, "gcc_asm": 1, "gcc_attributes": 2},
    Abs_declarator_DADecl: {"decl": 0, "gcc_asm": 1, "gcc_attributes": 2},
    Dir_abs_declarator_ConstExpr: {"decl": 0, "array_expr": 2},
    Dir_abs_declarator_ParamTypeList: {"decl": 0, "params": 2},
    Dir_abs_declarator_AbsDecl: {"gcc_attributes": 1, "decl": 2},
    Pmember_decl: {"type_modifiers": 1, "expr": 2},
    Pointer: {"qualifiers": 1},
    // TODO? -- ..& Ident_list
    Param_type_lst_VarArgs: {"params": 0, "var_args": 2},
    Param_type_lst_ConArgs: {"params": 0},
    Param_decl_Declarator: {"param_type": 0, "name": 1},
    Param_decl_AbsDeclarator: {"param_type": 0, "name": 1},
    Initializer_list: {"inits": 1},
    Init_field_Designated: {"desigs": 0, "init": 2},
    Desig_field_Struct: {"field": 1},
    Desig_field_Array: {"start": 1, "end": 3},

    // TODO gcc stuffs
    Expr_stmt: {"expr": 0},
    Label_stmt: {"label": 0, "stmt": 2},
    Case_stmt: {"cond": 1, "stmt": 3},
    Default_stmt: {"stmt": 2},
    Compound_stmt: {"block": 1},
    If_stmt: {"cond": 2, "stmt": 4, "else": 6},
    Switch_stmt: {"cond": 2, "stmt": 4},
    While_stmt: {"cond": 2, "stmt": 4},
    DoWhile_stmt: {"cond": 4, "stmt": 1},
    For_stmt: {"init": 2, "cond": 3, "iter": 4, "stmt": 6},
    Goto_stmt: {"label": 1},
    Continue_stmt: {},
    Break_stmt: {},
    Return_stmt: {"expr": 1},
    Function_def: {"return_type": 0, "decl": 1, "body": 2},

    Async_prototype: {"namespace": 1, "name": 3, "params": 5},
    Sync_prototype: {"return_type": 1, "namespace": 2, "name": 4, "params": 6},
    Async_task: {"jcond": 1, "jtask_attr": 2, "name": 3, "params": 5, "body": 7},
    Sync_task: {"return_type": 1, "jcond": 2, "jtask_attr": 3, "name": 4, "params": 6, "body": 8},
    Jtask_attr: {"key": 0, "val": 2},
    Jamtype_return_Void: {type: "Jamtype", name: "void"},
    Jamtype_return_Array: {jamtype: 0, "array": 2},
    Jamtype_Int: {type: "Jamtype", name: "int", "unsigned": 0},
    Jamtype_IntUnsigned: {type: "Jamtype", name: "int", "unsigned": 0},
    Jamtype_LongLongInt: {type: "Jamtype", name: "long long int", "unsigned": 0},
    Jamtype_LongUnsignedLongInt: {type: "Jamtype", name: "long long int", "unsigned": 1},
    Jamtype_LongLongUnsignedInt: {type: "Jamtype", name: "long long int", "unsigned": 2},
    Jamtype_Char: {type: "Jamtype", name: "char", "unsigned": 0},
    Jamtype_String: {type: "Jamtype", name: "string", "size": 2},
    Jamtype_Float: {type: "Jamtype", name: "float"},
    Jamtype_Double: {type: "Jamtype", name: "double"},
    Jamparam_decl: {"jamtype": 0, "name": 1, "array": 2},
    Decl_JamArray: {type: "Jamarray_decl", "jamtype": 1, "decls": 2},
    Jamarray_init: {"name": 0, "size": 2, "init": 5},
    // TODO more jam stuffs
};
// Default treewalker dictionary for iterating through all children in the cside
const defaultTreeWalk = new Map(Object.entries({
    id: null,
    string: null,
    number: null,
    Label_stmt: function(n) {
        let res = this.walk(n.stmt);
        if (res != undefined)
            n.stmt = res;
        return n;
    },
    Struct_access_expr: function(n) {
        let res = this.walk(n.struct);
        if (res != undefined)
            n.struct = res;
        return n;
    },
    Pointer_access_expr: function(n) {
        let res = this.walk(n.pointer);
        if (res != undefined)
            n.pointer = res;
        return n;
    },
    Desig_field_Struct: null,
    Goto_stmt: null,
    _default: function(n) {
        if (n != null && typeof n === "object" && n.type != undefined)
            for (let [key, entry] of Object.entries(n))
                if (key !== "type") {
                    let res = this.walk(entry);
                    if (res != undefined) {
                        n[key] = res;
                    }
                }
        return n;
    },
}));


function astify(input, rule) {
    let cst = jamCGrammar.match(input, rule);
    if (cst.failed())
        throw cst.message;
    return toAST(cst, astMatcher);
}

// Because C preprocessor may insert headers at top of input, reindex line numbers for accurate errors
function offsetNumber(numMatch, offset) {
	return parseInt(numMatch) - offset;
}
function formatErrorMessage(err, offset) {
	var num = new RegExp("[0-9]+");
	var linePat = new RegExp("^Line [0-9]+", "i");
	var linePat2 = new RegExp("^(>)?[ \t]*[0-9]+ |", "g");
	err = err.replace(linePat, function (match) {
		return match.replace(num, function (numMatch) {
			return offsetNumber(numMatch, offset);
		});
	});
	err = err.replace(linePat2, function (match) {
		return match.replace(num, function (numMatch) {
			return offsetNumber(numMatch, offset);
		});
	});
	return err;
}

function fromUserInput(input, offset, cstDotFile = "") {
    var cTree = jamCGrammar.match(input, "Source");
    console.log(`${"#".repeat(40)}\n[C] RUNNING PRE COMPILATION CHECK`);
    if (cTree.failed())
		throw formatErrorMessage(cTree.message, offset);
    if (cstDotFile)
        fs.writeFile(cstDotFile, semantics(cTree).cstPrint(), (err) => {if (err) console.error(err);});
    return toAST(cTree, astMatcher);
}

module.exports = {
    defaultTreeWalk: defaultTreeWalk,
    astify: astify,
    fromUserInput: fromUserInput
}
