/* eslint-env node */
"use strict";
const fs = require("fs");
const path = require("path");
const ohm = require("ohm-js");
const toAST = require('ohm-js/extras').toAST;
const cstPrint = require("./cstPrint");

const jamjs = fs.readFileSync(path.join(__dirname, "jamjs.ohm"));
const ns = {
	ES5: ohm.grammar(fs.readFileSync(path.join(__dirname, "../ecmascript/es5.ohm"))),
};
ns.ES6 = ohm.grammar(fs.readFileSync(path.join(__dirname, "../ecmascript/es6.ohm")), ns);

const jamJsGrammar = ohm.grammar(jamjs, ns);
var semantics = jamJsGrammar.createSemantics();
semantics.addOperation("cstPrint", cstPrint);

const astMatcher = {
    Program: {type: "Source", directives: 0, content: 1},
    identifier: {name: 0},
    stringLiteral: {value: 0},
    numericLiteral: {value: 0},
    PrimaryExpression_parenExpr: {type: "ParenExpr", value: 1},
    ArrayLiteral: {contents: 1},
    AssignmentExpressionOrElision_elision: {type: "elision"},
    ObjectLiteral: {props: 1},
    PropertyAssignment_getter: {name: 1, body: 5},
    PropertyAssignment_setter: {name: 1, param: 3, body: 6},
    PropertyAssignment_simple: {name: 0, value: 2},
    MemberExpression_arrayRefExp: {type: "ArrayAccessExpr", arr: 0, index: 2},
    MemberExpression_propRefExp: {type: "ArrayAccessExpr", obj: 0, prop: 2},
    MemberExpression_newExp: {expr: 1, args: 2},
    NewExpression_newExp: {type: "NewExpression", expr: 1},


    Jexport: {name: 1},
    Jmanifest: {app_type: 0, namespace: 1, files: 3},
    Jfile_list: {file_type: 0, files: 2},
    Async_task: {jcond: 1, jtask_attr: 2, name: 3, params: 5, body: 8},
    Sync_task: {return_type: 1, jcond: 2, jtask_attr: 3, name: 4, params: 6, body: 9},
    Jtask_attr: {key: 0, val: 2},
    Jamtype_return_Void: {type: "Jamtype", name: "void"},
    Jamtype_return_Array: {jamtype: 0, array: 2},
    Jamtype_Int: {type: "Jamtype", name: "int", unsigned: 0},
    Jamtype_IntUnsigned: {type: "Jamtype", name: "int", unsigned: 0},
    Jamtype_LongLongInt: {type: "Jamtype", name: "long long int", unsigned: 0},
    Jamtype_LongUnsignedLongInt: {type: "Jamtype", name: "long long int", unsigned: 1},
    Jamtype_LongLongUnsignedInt: {type: "Jamtype", name: "long long int", unsigned: 2},
    Jamtype_Char: {type: "Jamtype", name: "char", unsigned: 0},
    Jamtype_Float: {type: "Jamtype", name: "float"},
    Jamtype_Double: {type: "Jamtype", name: "double"},
    Jamparam_decl: {jamtype: 2, name: 0, array: 3},
    Struct_entry: {jamtype: 0, name: 1, array: 3},
    Jdata_spec_Basic: {jamtype: 0, name: 1, jflow: 3},
    Jdata_spec_Struct: {struct_name: 1, struct_entries: 3, name: 5, jflow: 7},
    Jdata_spec_Array: {jamtype: 0, name: 1, array: 3, jflow: 6},
    Jdata_decl: {namespace: 1, decls: 3},
    Jcond_decl: {namespace: 1, decls: 3},
    Jcond_entry: {name: 0, jcond: 2},
    Jcond_decl_expr_paran: {type: "Jcond_expr_paran", expr: 1},
    Jcond_decl_expr_not: {type: "Jcond_expr_not", expr: 1},
    Jcond_decl_expr_bin_op: {type: "Jcond_expr_bin_op", lhs: 0, op: 1, rhs: 2},
    Jcond_decl_expr_namespace: {type: "Jcond_expr_namespace", namespace: 0, name: 1},
    Jcond_expr_paran: {expr: 1},
    Jcond_expr_not: {expr: 1},
    Jcond_expr_bin_op: {lhs: 0, op: 1, rhs: 2},
    Jcond_expr_namespace: {namespace: 0, name: 1},
    Jtask_attr: {key: 0, val: 1},
};

function fromUserInput(input, cstDotFile = "") {
    var jsTree = jamJsGrammar.match(input, "Source");
    console.log(`${"#".repeat(40)}\n[JS] RUNNING PRE COMPILATION CHECK`);
    if (jsTree.failed())
		throw jsTree.message;
    if (cstDotFile)
        fs.writeFile(cstDotFile, semantics(jsTree).cstPrint(), (err) => {if (err) console.error(err);});
    return toAST(jsTree, astMatcher);
}

module.exports = {
    fromUserInput: fromUserInput,
};
