/* eslint-env node */

"use strict";

const namespace = require("./namespace");
const types = require("./types");
const symbolTable = require("./symbolTable");
const defaultTreeWalk = require("./jsAstMatcher").defaultTreeWalk;
const callGraph = require("./callGraph");

const VERBOSE = true;

const blockifyStatements = {
    identifier: null,
    stringLiteral: null,
    numericLiteral: null,
    nullLiteral: null,
    booleanLiteral: null,
    regex: null,
    elision: null,
    Jexport: null,
    Jamnifest: null,
    Async_task: function(node) {
        node.body = this.walk(node.body);
        return node;
    },
    Sync_task: function(node) {
        node.body = this.walk(node.body);
        return node;
    },
    Jdata_decl: null,
    Jcond_decl: null,
    IfStatement: blockifyFn,
    DoWhileStatement: blockifyFn,
    WhileStatement: blockifyFn,
    ForStatement: blockifyFn,
    ForDeclStatement: blockifyFn,
    ForInStatement: blockifyFn,
    ForInDeclStatement: blockifyFn,
    WithStatement: blockifyFn,
    ConciseBody: function(node) {
        return {
            type: "FunctionBody",
            directives: [],
            content: [{
                type: "ReturnStatement",
                value: this.walk(node.expr),
            }],
        };
    },
    _default: defaultTreeWalk,
};
function blockifyFn(node) {
    for (let [key, entry] of Object.entries(node))
        if (key !== "type")
            node[key] = this.walk(entry);
    if (node.stmt.type !== "Block")
        node.stmt = {
            type: "Block",
            content: [node.stmt],
        };
    if (node.type === "IfStatement" && node.else != null && node.else.type !== "Block")
        node.else = {
            type: "Block",
            content: [node.else],
        };
    return node;
}

const processManifest = {
    Source: function(node) {
        this.hasManifest = false;
        this.walk(node.content);
        if (!this.hasManifest && VERBOSE)
            console.log("WARN: No Jamnifest found; using default namespace");
    },
    Jamnifest: function(node) {
        if (this.hasManifest)
            throw "ERROR: Cannot declare multiple Jamnifests"
        this.hasManifest = true;
        if (node.namespace) {
            namespace.registerNamespace(node.namespace.name);
            namespace.currentNamespace = node.namespace.name;
        }
        this.walk(node.files);
    },
    Jfile_list: function(node) {
        // TODO
        console.log("TODO Manifest including files...");
        console.log(node);
    },
    _default: null,
};

const registerGlobals = {
    Source: function(node) {
        this.using_name = namespace.currentNamespace;
        this.walk(node.content);
    },
    Async_task: registerTask,
    Sync_task: registerTask,
    Jdata_decl: function(node) {
        let old_using_name = this.using_name;
        if (node.namespace)
            this.using_name = namespace.registerSubNamespace(node.namespace.name, this.using_name);
        this.walk(node.decls);
        this.using_name = old_using_name;
    },
    Jdata_spec_Basic: function(node) {
        node.namespace_name = namespace.registerName(node.name.name, this.using_name);
        symbolTable.addJdata(node.namespace_name, node);
        namespace.registerJdataFunc(node.namespace_name, node.jflow === "dflow" ? "read" : "write");
        if (VERBOSE)
            console.log(`${node.jflow.toUpperCase()} --> ${node.namespace_name}: ${types.stringifyType(node.jamtype)}`);
    },
    Jdata_spec_Struct: function(node) {
        node.namespace_name = namespace.registerName(node.name.name, this.using_name);
        types.registerStructType(node.struct_name, node.struct_entries);
        symbolTable.addJdata(node.namespace_name, node);
        namespace.registerJdataFunc(node.namespace_name, node.jflow === "dflow" ? "read" : "write");
        if (VERBOSE)
            console.log(`${node.jflow.toUpperCase()} --> ${node.namespace_name}: struct %{node.struct_name}`);
    },
    Jdata_spec_Array: function(node) {
        node.namespace_name = namespace.registerName(node.name.name, this.using_name);
        types.registerArrayType(types.stringifyType(node.jamtype), node.array);
        symbolTable.addJdata(node.namespace_name, node);
        namespace.registerJdataFunc(node.namespace_name, node.jflow === "dflow" ? "read" : "write");
        if (VERBOSE)
            console.log(`${node.jflow.toUpperCase()} --> ${node.namespace_name}: ${types.stringifyType(node.jamtype)}[${node.array}]`);
    },
    Jcond_decl: function(node) {
        for (var decl of node.decls) {
            decl.namespaced_name = `__jsys__${node.jtype}__${namespace.currentNamespace}__${decl.name.name}`;
            if (node.jtype === "jreuse") {
                if (!decl.second)
                    throw `ERROR: Jreuse decl ${decl.name.name} missing argument`;
                symbolTable.jreuse.js.set(decl.name.name, decl);
            } else
                symbolTable.jcond.js.set(decl.name.name, decl);
        }
    },
    Jamtype_return_Array: function(node) {
        types.registerArrayType(types.stringifyType(node.jamtype), node.array);
    },
    Jamparam_decl: function(node) {
        if (node.array)
            types.registerArrayType(types.stringifyType(node.jamtype), 1);
    },
    Jamtype_return_Void: null,
    Jamtype: null,
    _default: null,
};
function registerTask(node) {
    let taskType = node.return_type ? "SYNC" : "ASYNC";
    if (node.return_type)
        this.walk(node.return_type);
    this.walk(node.params);
    node.name = node.name.name;
    node.namespace_name = namespace.registerName(node.name, this.using_name);
    callGraph.addTask(node, "j");

    let jattr_dict = {};
    if (node.jtask_attr != null) {
        for (var attr of node.jtask_attr.attrs) {
            if (jattr_dict[attr.key])
                throw `ERROR: task ${node.name} duplicate jattribute for ${attr.key}`;
            jattr_dict[attr.key] = attr.val;
        }
    }
    node.jtask_attr = jattr_dict;

    node.language = "js";
    node.codes = node.params.map(p => types.get(p).c_code).join("");
    symbolTable.addTask(node.namespace_name, node);

    if (VERBOSE) {
        let returnType = node.return_type ? " --> " + types.stringifyType(node.return_type) : "";
        console.log(`${taskType} TASK [JS] --> NAME: ${node.namespace_name} PARAMS: ${node.params.map(p => types.stringifyType(p))}${returnType}`);
    }
}

module.exports = {
    blockifyStatements: blockifyStatements,
    processManifest: processManifest,
    registerGlobals: registerGlobals,
};
