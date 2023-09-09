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
    // rules for es5.ohm
    Program: {type: "Source", directives: 0, content: 1},
    identifier: {name: 0},
    stringLiteral: {value: 0},
    numericLiteral: {value: 0},
    nullLiteral: {value: 0},
    booleanLiteral: {value: 0},
    regex: {value: 0},
    // TODO regexes?

    PrimaryExpression_parenExpr: {type: "ParenExpr", expr: 1},
    ArrayLiteral: {contents: 1},
    AssignmentExpressionOrElision_elision: {type: "elision"},
    ObjectLiteral: {props: 1},
    PropertyAssignment_getter: {name: 1, body: 5},
    PropertyAssignment_setter: {name: 1, param: 3, body: 6},
    PropertyAssignment_simple: {name: 0, value: 2},
    MemberExpression_arrayRefExp: {type: "ArrayAccessExpr", arr: 0, index: 2},
    MemberExpression_propRefExp: {type: "PropAccessExpr", obj: 0, prop: 2},
    MemberExpression_newExp: {type: "NewFuncallExpr", name: 1, args: 3},
    NewExpression_newExp: {type: "NewExpr", expr: 1},
    CallExpression_arrayRefExp: {type: "ArrayAccessExpr", arr:0, index: 2},
    CallExpression_propRefExp: {type: "PropAccessExpr", obj: 0, prop: 2},
    CallExpression_callExpExp: {type: "FuncallExpr", name: 0, args: 2},
    CallExpression_memberExpExp: {type: "FuncallExpr", name: 0, args: 2},
    PostfixExpression_postIncrement: {type: "PostfixExpr", expr: 0, op: "++"},
    PostfixExpression_postDecrement: {type: "PostfixExpr", expr: 0, op: "--"},
    UnaryExpression_deleteExp: {type: "PrefixExpr", op: "delete", expr: 1},
    UnaryExpression_voidExp: {type: "PrefixExpr", op: "void", expr: 1},
    UnaryExpression_typeofExp: {type: "PrefixExpr", op: "typeof", expr: 1},
    UnaryExpression_preIncrement: {type: "PrefixExpr", op: "++", expr: 1},
    UnaryExpression_preDecrement: {type: "PrefixExpr", op: "--", expr: 1},
    UnaryExpression_unaryPlus: {type: "PrefixExpr", op: "+", expr: 1},
    UnaryExpression_unaryMinus: {type: "PrefixExpr", op: "-", expr: 1},
    UnaryExpression_bnot: {type: "PrefixExpr", op: "~", expr: 1},
    UnaryExpression_lnot: {type: "PrefixExpr", op: "!", expr: 1},
    MultiplicativeExpression_mul: {type: "BinopExpr", lhs: 0, op: "*", rhs: 2},
    MultiplicativeExpression_div: {type: "BinopExpr", lhs: 0, op: "/", rhs: 2},
    MultiplicativeExpression_mod: {type: "BinopExpr", lhs: 0, op: "%", rhs: 2},
    AdditiveExpression_add: {type: "BinopExpr", lhs: 0, op: "+", rhs: 2},
    AdditiveExpression_sub: {type: "BinopExpr", lhs: 0, op: "-", rhs: 2},
    ShiftExpression_lsl: {type: "BinopExpr", lhs: 0, op: "<<", rhs: 2},
    ShiftExpression_lsr: {type: "BinopExpr", lhs: 0, op: ">>>", rhs: 2},
    ShiftExpression_asr: {type: "BinopExpr", lhs: 0, op: ">>", rhs: 2},
    RelationalExpression_lt: {type: "BinopExpr", lhs: 0, op: "<", rhs: 2},
    RelationalExpression_gt: {type: "BinopExpr", lhs: 0, op: ">", rhs: 2},
    RelationalExpression_le: {type: "BinopExpr", lhs: 0, op: "<=", rhs: 2},
    RelationalExpression_ge: {type: "BinopExpr", lhs: 0, op: ">=", rhs: 2},
    RelationalExpression_instanceof: {type: "BinopExpr", lhs: 0, op: "instanceof", rhs: 2},
    RelationalExpression_inExp: {type: "BinopExpr", lhs: 0, op: "in", rhs: 3}, // TODO check this
    EqualityExpression_equal: {type: "BinopExpr", lhs: 0, op: "==", rhs: 2},
    EqualityExpression_notEqual: {type: "BinopExpr", lhs: 0, op: "!=", rhs: 2},
    EqualityExpression_eq: {type: "BinopExpr", lhs: 0, op: "===", rhs: 2},
    EqualityExpression_notEq: {type: "BinopExpr", lhs: 0, op: "!==", rhs: 2},
    BitwiseANDExpression_band: {type: "BinopExpr", lhs: 0, op: "&", rhs: 2},
    BitwiseXORExpression_bxor: {type: "BinopExpr", lhs: 0, op: "^", rhs: 2},
    BitwiseORExpression_bor: {type: "BinopExpr", lhs: 0, op: "|", rhs: 2},
    LogicalANDExpression_band: {type: "BinopExpr", lhs: 0, op: "&&", rhs: 2},
    LogicalORExpression_bor: {type: "BinopExpr", lhs: 0, op: "||", rhs: 2},
    ConditionalExpression_conditional: {type: "CondExpr", cond: 0, then: 2, else: 4},
    AssignmentExpression_assignment: {type: "AssignExpr", lhs: 0, op: 1, rhs: 2},
    Expression_commaExp: {type: "CommaExpr", exprs: 0, expr: 2},

    Block: {content: 1},
    VariableStatement: {scope: 0, decls: 1},
    VariableDeclaration: {name: 0, init: 1},
    Initialiser: {value: 1},
    AssignmentStatement: {name: 0, value: 2},
    ExpressionStatement: {expr: 0},
    IfStatement: {cond: 2, stmt: 4, else: 6},
    DoWhileStatement: {stmt: 1, cond: 4},
    WhileStatement: {cond: 2, stmt: 4},
    ForStatement: {init: 2, cond: 4, iter: 6, stmt: 8},
    ForDeclStatement: {scope: 2, init: 3, cond: 5, iter: 7, stmt: 9},
    ForInStatement: {elem: 2, iter_type: 3, iter: 4, stmt: 6},
    ForInDeclStatement: {scope: 2, elem: 3, iter_type: 4, iter: 5, stmt: 7},
    ContinueStatement: {name: 2}, // TODO check this
    BreakStatement: {name: 2}, // TODO checkk this
    ReturnStatement: {value: 2},
    WithStatement: {withOn: 2, stmt: 4},
    SwitchStatement: {switchOn: 2, cases: 4},
    CaseBlock_withDefault: {pre_clauses: 1, default_clause: 2, post_clauses: 3},
    CaseBlock_withoutDefault: {pre_clauses: 1},
    CaseClause: {cond: 1, stmts: 3},
    DefaultClause: {stmts: 2},
    LabelledStatement: {label: 0, stmt: 2},
    ThrowStatement: {message: 1},
    TryStatement_catchFinally: {type: "TryStatement", tryBlock: 1, catchParam: 4, catchBlock: 6, finallyBlock: 8},
    TryStatement_finally: {type: "TryStatement", tryBlock: 1, catchParam: null, catchBlock: null, finallyBlock: 8},
    TryStatement_catch: {type: "TryStatement", tryBlock: 1, catchParam: 4, catchBlock: 6, finallyBlock: null},
    DebuggerStatement: {},

    FunctionDeclaration: {name: 1, params: 3, body: 5},
    FunctionExpression: {name: 1, params: 3, body: 5},
    FunctionBody: {directives: 1, content: 2},
    Directive: {string: 0},

    // rules for es6.ohm
    ArrowFunction: {params: 0, body: 3},
    ConciseBody_noBraces: {type: "ConciseBody", expr: 0},
    ArrowParamsParen: {params: 1},
    AsyncFunctionDeclaration: {name: 2, params: 4, body: 6},
    CallExpression_awaitCall: {type: "AwaitFuncallExpr", expr: 1},
    ForAwaitOfStatement: {elem: 3, iter: 5, stmt: 7},
    ForAwaitOfDeclStatement: {scope: 3, elem: 4, iter: 6, stmt: 8},

    // rules for jamjs.ohm
    Jexport: {name: 1},
    Jamnifest: {app_type: 0, namespace: 1, files: 3},
    Jfile_list: {file_type: 0, files: 2},
    Async_task: {jcond: 1, jtask_attr: 2, name: 3, params: 5, body: 7},
    Sync_task: {return_type: 1, jcond: 2, jtask_attr: 3, name: 4, params: 6, body: 8},
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
    Jamparam_decl_Param: {type: "Jamparam_decl", jamtype: 2, name: 0, array: 3},
    Jamparam_decl_String: {name: 0},
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
// Default treewalker dictionary for iterating through all children in the jside
const defaultTreeWalk = new Map(Object.entries({
    identifier: null,
    stringLiteral: null,
    numericLiteral: null,
    nullLiteral: null,
    booleanLiteral: null,
    regex: null,
    elision: null,
    _default: function(n) {
        if (n != null && typeof n === "object" && n.type != undefined)
            for (let [key, entry] of Object.entries(n))
                if (key !== "type") {
                    let res = this.walk(entry);
                    if (res != undefined)
                        n[key] = res;
                }
        return n;
    },
}));

function astify(input, rule) {
    let cst = jamJsGrammar.match(input, rule);
    if (cst.failed())
        throw cst.message;
    return toAST(cst, astMatcher);
}

function fromUserInput(input, cstDotFile = "", verbosity) {
    var jsTree = jamJsGrammar.match(input, "Source");
    if (verbosity > 0) console.log(`${"#".repeat(40)}\n[JS] RUNNING PRE COMPILATION CHECK`);
    if (jsTree.failed())
		throw jsTree.message;
    if (cstDotFile)
        fs.writeFile(cstDotFile, semantics(jsTree).cstPrint(), (err) => {if (err) console.error(err);});
    return toAST(jsTree, astMatcher);
}

module.exports = {
    fromUserInput: fromUserInput,
    astify: astify,
    defaultTreeWalk: defaultTreeWalk,
};
