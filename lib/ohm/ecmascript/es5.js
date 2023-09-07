/* eslint-env node */
"use strict";

const jsTranslator = {
    Source: function(node) {
        this.tabc = 0;
        this.tabr = function(o = 0) {
            return "\n" + " ".repeat(4 * (this.tabc + o));
        };
        return this.walk(node.directives).join("") + this.walk(node.content).join("");
    },
    identifier: function(node) {
        return node.name;
    },
    stringLiteral: function(node) {
        return node.value;
    },
    numericLiteral: function(node) {
        return node.value;
    },
    nullLiteral: function(node) {
        return node.value;
    },
    booleanLiteral: function(node) {
        return node.value;
    },
    regex: function(node) {
        return node.value;
    },
    ParenExpr: function(node) {
        return "(" + this.walk(node.expr) + ")";
    },
    ArrayLiteral: function(node) {
        return "[" + this.walk(node.contents).join(", ") + "]";
    },
    elision: function(node) {
        return "";
    },
    ObjectLiteral: function(node) {
        return "{" + this.walk(node.props).join(", ") + "}"
    },
    PropertyAssignment_getter: function(node) {
        return "get " + this.walk(node.name) + "() " + this.walk(node.body);
    },
    PropertyAssignment_setter: function(node) {
        return "set " + this.walk(node.name) + "(" + this.walk(node.params) + ") " + this.walk(node.body);
    },
    PropertyAssignment_simple: function(node) {
        return this.walk(node.name) + ": " + this.walk(node.value);
    },
    ArrayAccessExpr: function(node) {
        return this.walk(node.arr) + "[" + this.walk(node.index) + "]";
    },
    PropAccessExpr: function(node) {
        return this.walk(node.obj) + "." + node.prop;
    },
    NewFuncallExpr: function(node) {
        return "new " + this.walk(node.name) + "(" + this.walk(node.args).join(", ") + ")";
    },
    newExpr: function(node) {
        return "new " + this.walk(node.expr);
    },
    FuncallExpr: function(node) {
        return this.walk(node.name) + "(" + this.walk(node.args).join(", ") + ")";
    },
    PostfixExpr: function(node) {
        return this.walk(node.expr) + node.op;
    },
    PrefixExpr: function(node) {
        let space = ["delete", "void", "typeof"].includes(node.op) ? " " : "";
        return node.op + space + this.walk(node.expr);
    },
    BinopExpr: function(node) {
        return this.walk(node.lhs) + " " + node.op + " " + this.walk(node.rhs);
    },
    CondExpr: function(node) {
        return this.walk(node.cond) + " ? " + this.walk(node.then) + " : " + this.walk(node.else);
    },
    AssignExpr: function(node) {
        return this.walk(node.lhs) + " " + node.op + " " + this.walk(node.rhs);
    },
    CommaExpr: function(node) {
        return this.walk(node.exprs) + ", " + this.walk(node.expr);
    },
    Block: function(node) {
        this.tabe = 0;
        this.tabc++;
        let res = "{" + this.walk(node.content).join("");
        this.tabc--;
        return res + this.tabr() + "}";
    },
    VariableStatement: function(node) {
        return this.tabr() + node.scope + " " + this.walk(node.decls).join(", ") + ";";
    },
    VariableDeclaration: function(node) {
        return this.walk(node.name) + (node.init ? this.walk(node.init) : "");
    },
    Initialiser: function(node) {
        return " = " + this.walk(node.value);
    },
    AssignmentStatement: function(node) {
        return this.tabr() + this.walk(node.name) + " = " + this.walk(node.value) + ";"
    },
    ExpressionStatement: function(node) {
        return this.tabr() + this.walk(node.expr) + ";"
    },
    IfStatement: function(node) {
        let elseStr = node.else ? " else " + this.walk(node.else) : "";
        return this.tabr() + "if (" + this.walk(node.cond) + ") " + this.walk(node.stmt) + elseStr;
    },
    DoWhileStatement: function(node) {
        return this.tabr() + "do " + this.walk(node.stmt) + " while (" + this.walk(node.cond) + ");"
    },
    WhileStatement: function(node) {
        return this.tabr() + "while (" + this.walk(node.cond) + ") " + this.walk(node.stmt);
    },
    ForStatement: function(node) {
        let cond = node.cond ? "; " + this.walk(node.cond) : ";";
        let iter = node.iter ? "; " + this.walk(node.iter) : ";";
        return this.tabr() + "for (" + this.walk(node.init) + cond + iter + ") " + this.walk(node.stmt);
    },
    ForDeclStatement: function(node) {
        let cond = node.cond ? "; " + this.walk(node.cond) : ";";
        let iter = node.iter ? "; " + this.walk(node.iter) : ";";
        return this.tabr() + "for (" + node.scope + " " + this.walk(node.init) + cond + iter + ") " + this.walk(node.stmt);
    },
    ForInStatement: function(node) {
        return this.tabr() + "for (" + this.walk(node.elem) + " " + node.iter_type + " " + this.walk(node.iter) + ") " + this.walk(node.stmt);
    },
    ForInDeclStatement: function(node) {
        return this.tabr() + "for (" + node.scope + " " + this.walk(node.elem) + " " + node.iter_type + " " + this.walk(node.iter) + ") " + this.walk(node.stmt);
    },
    ForAwaitOfStatement: function(node) {
        return this.tabr() + "for await (" + this.walk(node.elem) + " of " + this.walk(node.iter) + ") " + this.walk(node.stmt);
    },
    ForAwaitOfDeclStatement: function(node) {
        return this.tabr() + "for await (" + this.walk(node.scope) + " " + this.walk(node.elem) + " of " + this.walk(node.iter) + ") " + this.walk(node.stmt);
    },
    ContinueStatement: function(node) {
        return this.tabr() + (node.name ? "continue " + this.walk(node.name) + ";" : "continue;");
    },
    BreakStatement: function(node) {
        return this.tabr() + (node.name ? "break " + this.walk(node.name) + ";" : "break;");
    },
    ReturnStatement: function(node) {
        return this.tabr() + (node.value ? "return " + this.walk(node.value) + ";" : "return;");
    },
    WithStatement: function(node) {
        return this.tabr() + "with (" + this.walk(node.withOn) + ") " + this.walk(node.stmt);
    },
    SwitchStatement: function(node) {
        return this.tabr() + "switch (" + this.walk(node.switchOn) + ") " + this.walk(node.cases);
    },
    CaseBlock_withDefault: function(node) {
        this.tabc++;
        let res = "{" + this.walk(node.pre_clauses).join("") + this.walk(node.default_clause) + this.walk(node.pre_clauses).join("");
        this.tabc--;
        return res + this.tabr() + "}";
    },
    CaseBlock_withoutDefault: function(node) {
        this.tabc++;
        let res = "{" + this.walk(node.pre_clauses).join("");
        this.tabc--;
        return res + this.tabr() + "}";
    },
    CaseClause: function(node) {
        return this.tabr(-1) + "case " + this.walk(node.cond) + ":" + this.walk(node.stmts).join("");
    },
    DefaultClause: function(node) {
        return this.tabr(-1) + "default:" + this.walk(node.stmts).join("");
    },
    LabelledStatement: function(node) {
        return this.tabr(-1) + this.walk(node.label) + ":" + this.walk(node.stmt);
    },
    ThrowStatement: function(node) {
        return this.tabr() + "throw " + this.walk(node.message) + ";";
    },
    TryStatement: function(node) {
        let catchStr = node.catchParam ? " catch (" + this.walk(node.catchParam) + ") " + this.walk(node.catchBlock) : "";
        let finallyStr = node.finallyBlock ? " finally " + this.walk(node.finallyBlock) : "";
        return this.tabr() + "try " + this.walk(node.tryBlock) + catchStr + finallyStr;
    },
    DebuggerStatement: function(node) {
        return "debugger;";
    },
    FunctionDeclaration: function(node) {
        return this.tabr() + "function " + this.walk(node.name) + "(" + this.walk(node.params).join(", ") + ") " + this.walk(node.body);
    },
    FunctionExpression: function(node) {
        let name = node.name ? " " + this.walk(node.name) : "";
        return "function" + name + "(" + this.walk(node.params).join(", ") + ") " + this.walk(node.body);
    },
    FunctionBody: function(node) {
        this.tabc++;
        let res = "{" + this.walk(node.directives).join("") + this.walk(node.content).join("");
        this.tabc--;
        return res + this.tabr() + "}";
    },
    Directive: function(node) {
        return "\n" + this.walk(node.string) + ";"
    },
    ArrowFunction: function(node) {
        return this.walk(node.params) + " => " + this.walk(node.body);
    },
    ConciseBody: function(node) {
        return this.walk(node.expr);
    },
    ArrowParamsParen: function(node) {
        return "(" + this.walk(node.params).join(", ") + ")";
    },
    AsyncFunctionDeclaration: function(node) {
        return this.tabr() + "async function " + this.walk(node.name) + "(" + this.walk(node.params).join(", ") + ") " + this.walk(node.body);
    },
    AwaitFuncallExpr: function(node) {
        return "await " + this.walk(node.expr);
    },
    _default: function(node) {
        // TODO eventually this should throw an error... for now debugging is nice
        console.log("Unrecognized node:");
        console.log(node);
        return "";
    },
};

module.exports = {
    jsTranslator: jsTranslator,
};
