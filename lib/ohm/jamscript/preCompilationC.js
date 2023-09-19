/* eslint-env node */

"use strict";
const symbolTable = require("./symbolTable");
const defaultTreeWalk = require("./cAstMatcher").defaultTreeWalk;
const astTreeWalker = require("./astTreeWalker");
const types = require("./types");
const cTranslator = require("../c/c").cTranslator;
const namespace = require("./namespace");
const callGraph = require("./callGraph");

let VERBOSE = true;

// Converts all single-expression control flow statements into blocks, allowing code insertion without disrupting control flow
const blockifyStatements = {
    Prototype: null,
    Sync_prototype: null,
    Async_prototype: null,
    Expr: null,
    Decl_specs: null,
    Declarator: null,
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

// Registers tasks to relevant symbol tables
// Also does necessary namespace translation
const registerGlobals = {
    Source: function(node) {
        symbolTable.set(namespace.currentNamespace, {type: "namespace"});
        this.walk(node.content);
    },
    Async_task: registerTask,
    Sync_task: registerTask,
    Function_def: function (node) {
        let name = namespace.registerName(node.decl.name.name.name, namespace.currentNamespace);
        node.decl.name.name.name = name;
        callGraph.addFunction(node, "c", name);
        if (VERBOSE)
            console.log(`REGULAR FUNCTION [C] --> NAME: ${name}`);
    },
    Async_prototype: function(node) {
        let namesp = node.namespace || namespace.currentNamespace;
        let name = namespace.registerName(node.name.name, namesp, true);
        node.name = name;
        if (VERBOSE)
            console.log(`ASYNC PROTOTYPE [C] --> NAME: ${name}`);
    },
    Sync_prototype: function(node) {
        let namesp = node.namespace || namespace.currentNamespace;
        let name = namespace.registerName(node.name.name, namesp, true);
        node.name = name;
        if (VERBOSE)
            console.log(`SYNC PROTOTYPE [C] --> NAME: ${name}`);
    },
    Prototype: function(node) {
        let name = namespace.registerName(node.name.name,namespace.currentNamespace,true);
        node.name.name = name;
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
        node.name.name = name;
        if (VERBOSE)
            console.log(`DECLARATION [C] --> NAME: ${name}`);
    },
    Jamarray_decl: function(node) {
        this.walk(node.decls);
    },
    Jamarray_init: function(node) {
        let name = namespace.registerName(node.name.name, namespace.currentNamespace);
        node.name.name = name;
        if (VERBOSE)
            console.log(`JAMARRAY DECLARATION [C] --> NAME: ${name}`);
    },
    Preprocess_line: null
};
function registerTask(node) {
    let taskType = node.return_type ? "SYNC" : "ASYNC";
    node.name = namespace.registerName(node.name.name, namespace.currentNamespace);
    callGraph.addTask(node, "c");

    if (node.jcond != null) {
        console.error("TODO: jconds have not been implemented yet, sorry");
    }
    if (node.jtask_attr != null) {
        let jattr_dict = {};
        for (var attr of node.jtask_attr) {
            if (jattr_dict[attr.key])
                throw `ERROR: task ${node.name} duplicate jattribute for ${attr.key}`;
            jattr_dict[attr.key] = attr.entry;
        }
        node.jtask_attr = jattr_dict;
    }
    node.language = "c";
    node.codes = node.params.map(p => types.get(p).c_code).join("");
    symbolTable.addTask(node.name, node);

    if (VERBOSE) {
        let returnType = node.return_type ? " --> " + types.stringifyType(node.return_type) : "";
        console.log(`${taskType} TASK [C] --> NAME: ${node.name} PARAMS: ${node.params.map(p => types.stringifyType(p))}${returnType}`);
    }
}

function setVerbosity(v) {
    VERBOSE = v;
}

module.exports = {
    setVerbosity: setVerbosity,
    blockifyStatements: blockifyStatements,
    registerGlobals: registerGlobals,
};
