/* eslint-env node */

"use strict";
const milestone = require("./milestone");
const symbolTable = require("./symbolTable");
const defaultTreeWalk = require("./cAstMatcher").defaultTreeWalk;
const astTreeWalker = require("./astTreeWalker");
const types = require("./types");
const callGraph = require("./callGraph")
let cTranslator = require("../c/c").cTranslator;
const namespace = require("./namespace");

const VERBOSE = true;

// Converts all single-expression control flow statements into blocks, allowing code insertion without disrupting control flow
const blockifyFn = function(node) {
    this.walk(node.stmt);
    if (node.stmt.type !== "Compound_stmt")
        node.stmt = {
            type: "Compound_stmt",
            block: [node.stmt],
            sc: null,
        };
    if (node.type === "If_stmt" && node.else != null) {
        this.walk(node.else);
        if (node.else.type !== "Compount_stmt")
            node.else = {
                type: "Compound_stmt",
                block: [node.else],
                sc: null,
            };
    }
    return node;
};
const blockifyStatements = {
    Prototype: null,
    Expr: null,
    Decl_specs: null,
    Declarator: null,
    Label_stmt: blockifyFn,
    Case_stmt: blockifyFn,
    Default_stmt: blockifyFn,
    If_stmt: blockifyFn,
    Switch_stmt: blockifyFn,
    While_stmt: blockifyFn,
    DoWhile_stmt: blockifyFn,
    For_stmt: blockifyFn,
    _default: defaultTreeWalk,
};

// Finds the namespace spec for a file, and removes them from the AST
const getNamespace = {
    Source: function(node) {
        this.hasNamespace = false;
        this.namespace = "japp";
        node.content = this.walk(node.content);
        namespace.currentNamespace = this.namespace;
        return this.namespace;
    },
    Namespace_spec: function(node) {
        if (this.hasNamespace)
            throw "ERROR: Cannot have multiple namespace declarations in a file.";
        this.hasNamespace = true;
        this.namespace = node.name.name;
        return null;
    },
    _default: null,
};

// Registers activity, and checks that function argument and return types are legal.
function registerActivity(activityType, node) {
    if (node.namespace == null)
        node.namespace = namespace.currentNamespace;
    else
        node.namespace = node.namespace.name;
    node.name = registerName(node.name.name, node.namespace);
    this.funcname = node.name;
    let jCond = {
		source: "true",
		code: 0,
		cback: "",
		bcasts: JSON.stringify([]),
	};
	if (node.jcond != null) {
        console.error("TODO: jconds have not been implemented yet, sorry");
		//jCond = node.jcond.jCondTranslator[0]; // TODO
    }
    if (node.jtask_attr != null) {
        console.error("TODO: jtask_attrs have not been implemented yet, sorry");
        // TODO
    }
    console.log(node.params);
    let func_info = {
		activityType: activityType,
		language: "c",
		codes: node.params.map(p => types.getCCode(p.jamtype.name)),
		params: node.params,
        jCond: jCond,
	};
    if (activityType === "sync")
        func_info.returnType = node.return_type;

    milestone.registerFunction(this.funcname, activityType);
    callGraph.addActivity("c", this.funcname, activityType);
	symbolTable.addActivity(this.funcname, func_info);

    if (VERBOSE)
		console.log(`${activityType.toUpperCase()} FUNCTION [C] --> NAME: ${this.funcname} PARAMS: ${node.params.map(p => p.jamtype.name + " " + p.name.name + (p.array ? "[" + p.array + "]" : ""))}${func_info.returnType == undefined ? "" : " --> " + func_info.returnType.name}`);
}

var registerFunctions = {
    Source: function(node) {
        this.walk(node.content);
    },
	Sync_activity: function(node) {
        registerActivity.call(this, "sync", node);
    },
	Async_activity: function(node) {
        registerActivity.call(this, "async", node);
    },
    Function_def: function (node) {
        let name = registerName(node.decl.name.name.name, namespace.currentName);
        node.decl.name.name.name = name;
        if (VERBOSE)
		    console.log(`REGULAR FUNCTION [C] --> NAME: ${name}`);
	    milestone.registerFunction(name, "batch");
    },
    Prototype: null,
};

module.exports = {
    blockifyStatements: blockifyStatements,
    registerFunctions: registerFunctions,
};
