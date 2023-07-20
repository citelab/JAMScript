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
const blockifyStatements = {
    Prototype: null,
    Sync_prototype: null,
    Async_prototype: null,
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
function blockifyFn(node) {
    this.walk(node.stmt);
    if (node.stmt.type !== "Compound_stmt")
        node.stmt = {
            type: "Compound_stmt",
            block: [node.stmt],
        };
    if (node.type === "If_stmt" && node.else != null) {
        this.walk(node.else);
        if (node.else.type !== "Compount_stmt")
            node.else = {
                type: "Compound_stmt",
                block: [node.else],
            };
    }
    return node;
};

// Finds the namespace spec for a file, and removes them from the AST
const getNamespace = {
    Source: function(node) {
        this.hasNamespace = false;
        this.namespace = null;
        node.content = this.walk(node.content);
        if (this.namespace)
            namespace.registerNamespace(this.namespace);
        else
            this.namespace = "japp";
        namespace.currentNamespace = this.namespace;
        symbolTable.set(this.namespace, {type: "namespace"});
        return this.namespace; // TODO probably need a per-file map of these
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

// Registers tasks to relevant symbol tables
// Also does necessary namespace translation
var registerGlobals = {
    Source: function(node) {
        this.walk(node.content);
    },
	Async_task: function(node) {
        registerTask.call(this, "async", node);
    },
	Sync_task: function(node) {
        registerTask.call(this, "sync", node);
    },
    Function_def: function (node) {
        let name = namespace.registerName(node.decl.name.name.name, namespace.currentNamespace);
        node.decl.name.name.name = name;
        if (VERBOSE)
		    console.log(`REGULAR FUNCTION [C] --> NAME: ${name}`);
	    milestone.registerFunction(name, "batch");
    },
    Async_prototype: function(node) { // TODO register types &c. for checking
        let namesp = node.namespace || namespace.currentNamespace;
        let name = namespace.registerName(node.name.name, namesp, true);
        node.name = name;
        if (VERBOSE)
		    console.log(`ASYNC PROTOTYPE [C] --> NAME: ${name}`);
    },
    Sync_prototype: function(node) { // TODO register types &c. for checking
        let namesp = node.namespace || namespace.currentNamespace;
        let name = namespace.registerName(node.name.name, namesp, true);
        node.name = name;
        if (VERBOSE)
		    console.log(`SYNC PROTOTYPE [C] --> NAME: ${name}`);
    },
    Prototype: function(node) {
        let name = namespace.registerName(node.name.name,namespace.currentNamespace,true);
        node.name = name;
        if (VERBOSE)
		    console.log(`REGULAR PROTOTYPE [C] --> NAME: ${name}`);
    },
    Decl: function(node) {
        this.walk(node.decls);
    },
    Init_decl: function(node) {
        this.walk(node.decl);
    },
    Declarator: function(node) {
        let name = namespace.registerName(node.name.name, namespace.currentNamespace);
        node.name = name;
        if (VERBOSE)
            console.log(`DECLARATION [C] --> NAME: ${name}`);
    },
    Preprocess_line: null
};
function registerTask(taskType, node) {
    node.namespace = namespace.currentNamespace;
    node.name = namespace.registerName(node.name.name, node.namespace);
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
    //console.log(node.params);
    let func_info = {
		taskType: taskType,
		language: "c",
		codes: node.params.map(p => types.getCCode(p.jamtype.name)),
		params: node.params,
        jCond: jCond,
	};
    if (taskType === "sync")
        func_info.returnType = node.return_type;

    milestone.registerFunction(this.funcname, taskType);
    callGraph.addTask("c", this.funcname, taskType);
	symbolTable.addTask(this.funcname, func_info);

    if (VERBOSE)
		console.log(`${taskType.toUpperCase()} FUNCTION [C] --> NAME: ${this.funcname} PARAMS: ${node.params.map(p => p.jamtype.name + " " + p.name.name + (p.array ? "[" + p.array + "]" : ""))}${func_info.returnType == undefined ? "" : " --> " + func_info.returnType.name}`);
}


module.exports = {
    blockifyStatements: blockifyStatements,
    registerGlobals: registerGlobals,
    getNamespace: getNamespace,
};
