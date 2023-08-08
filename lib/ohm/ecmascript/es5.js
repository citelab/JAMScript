/* eslint-env node */

"use strict";

var milestone = require("../jamscript/milestone");
var yieldPoint = false;

//Do I want to take Statement or Statement.child(0)?
function assureBlock(stmt) {
	var isSelectiveStatement = function (node) {
		return (
			node.child(0).ctorName === "IfStatement"
		);
	};

	var isIterativeStatement = function (node) {
		return (
			node.child(0).ctorName === "IterationStatement"
		);
	};

	var isFunctionCall = function (node) {
		var code = node.sourceString;
		var declarationPattern = /(.+) = ([a-zA-Z0-9]+\(.*\))/g;
		var statementPattern = /^([a-zA-Z0-9]+\(.*\));/g;

		return (
			code.match(declarationPattern) != null ||
			code.match(statementPattern) != null
		);
	};

	var getFunctionNames = function (node) {
		var code = node.sourceString;
		var functionCallExtractionPattern = /[a-zA-Z0-9]+\(.*\)/g;

		var matches = code.match(functionCallExtractionPattern);
		return matches.map((match) => match.substring(0, match.indexOf("(")));
	};

	var result;
	if (stmt.child(0).ctorName === "Block") {
		var functionBodyResults = [];
		var currMilestone = milestone.getAMilestoneNumber();
		functionBodyResults.push(milestone.getJCodeToEmitMilestone(currMilestone));

		// Tranlsate all the source elements, i.e., statements and expressions.
		for (var node of stmt.child(0).child(1).child(0).children) {
			var currResult = node.es5Translator;
			functionBodyResults.push(currResult);

			if (isIterativeStatement(node) || isSelectiveStatement(node)) {
				currMilestone = milestone.getAMilestoneNumber();
				functionBodyResults.push(
					milestone.getJCodeToEmitMilestone(currMilestone)
				);
			} else if (isFunctionCall(node)) {
				var functionNames = getFunctionNames(node);
				milestone.registerFunctionsForMilestone(currMilestone, functionNames);
			}
		}

		result = `{\n${functionBodyResults.join("\n")}}`;
	} else {
		result = "{\n" + stmt.es5Translator + "}";
	}
	return result;
}

// TODO pass for this (?)
function insertYieldPoint(stmt) {
	if (yieldPoint) {
		if (stmt.child(0).ctorName === "Block") {
			stmt = "{\n" + stmt.child(0).child(1).es5Translator + "\njsleep();\n}";
		} else {
			stmt = "{\n" + stmt.es5Translator + "\njsleep();\n}";
		}
		return stmt;
	} else {
		return assureBlock(stmt);
	}
}

var es5Translator = {
    Source: function(node) {
        this.tabc = 0;
        this.tabd = 0
        this.tabr = function(o = 0) {
            if (this.tabd > 0) {
                this.tabd--;
                return "";
            }
            return "\n" + " ".repeat(2 * (this.tabc + o));
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
        return "{" + this.walk(node.contents).join(", ") + "}"
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
        return "new " + this.walk(node.name) + this.walk(node.args);
    },
    newExpr: function(node) {
        return "new " + this.walk(node.expr);
    },
    FuncallExpr: function(node) {
        return this.walk(node.name) + this.walk(node.args);
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
        this.tabc++;
        let res = "{" + this.walk(node.content).join("");
        this.tabc--;
        return res + this.tabr() + "}";
    },
    VariableStatement: function(node) {
        return this.tabr() + node.scope + this.walk(node.decls).join(", ") + ";";
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
        return this.tabr() + "if (" + this.walk(node.cond) + ") " + this.walk(node.then) + elseStr;
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
        return this.tabr() + "for (" node.scope + " " + this.walk(node.init) + cond + iter + ") " + this.walk(node.stmt);
    },
    ForInStatement: function(node) {
        return this.tabr() + "for (" this.walk(node.elem) + " in " + this.walk(node.iter) + ") " + this.walk(node.stmt);
    },
    ForInDeclStatement: function(node) {
        return this.tabr() + "for (" node.scope + " " + this.walk(node.elem) + " in " + this.walk(node.iter) + ") " + this.walk(node.stmt);
    },
    ContinueStatement: function(node) {
        return this.tabr() + (node.name ? "continue " + this.walk(node.name) + ";" : "continue;");
    },{name: 1},
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
    },{pre_clauses: 1, default_clause: 2, post_clauses: 3},
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
        return "function " + this.walk(node.name) + "(" + this.walk(node.params).join(", ") + ") " + this.walk(node.body);
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
};

module.exports = {
	enableYieldPoint: function () {
		yieldPoint = true;
	},
};
