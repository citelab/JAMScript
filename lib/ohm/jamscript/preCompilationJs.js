/* eslint-env node */

"use strict";

const jCondTranslator = require("./jCondTranslator");
const milestone = require("./milestone");
const namespace = require("./namespace");
const types = require("./types");
const symbolTable = require("./symbolTable");

const VERBOSE = true;

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
    Jdata_decl: registerJdecl,
    Jdata_spec_Basic: function(node) {
        node.namespace_name = namespace.registerName(node.name.name, this.using_name);
        if (VERBOSE)
            console.log(`${node.jflow.toUpperCase()} --> ${node.namespace_name}: ${types.stringifyType(node.jamtype)}`);
    },
    Jdata_spec_Struct: function(node) {
        node.namespace_name = namespace.registerName(node.name.name, this.using_name);
        if (VERBOSE)
            console.log(`${node.jflow.toUpperCase()} --> ${node.namespace_name}: struct %{node.struct_name}`);
    },
    Jdata_spec_Array: function(node) {
        node.namespace_name = namespace.registerName(node.name.name, this.using_name);
        if (VERBOSE)
            console.log(`${node.jflow.toUpperCase()} --> ${node.namespace_name}: ${types.stringifyType(node.jamtype)}[${node.array}]`);
    },
    Jcond_decl: registerJdecl,
    Jcond_entry: function(node) {
        node.namespace_name = namespace.registerName(node.name.name, this.using_name);
        if (VERBOSE)
            console.log(`$JCOND --> ${node.namespace_name}`);
    },
    _default: null,
};
function registerTask(node) {
    let taskType = node.return_type ? "SYNC" : "ASYNC";

    node.name = node.name.name;
    node.namespace_name = namespace.registerName(node.name, this.using_name);

    node.language = "js";
    node.codes = node.params.map(p => types.get(p.jamtype.name).c_code);
    symbolTable.addTask(node.namespace_name, node);

    if (VERBOSE) {
        let returnType = node.return_type ? " --> " + types.stringifyType(node.return_type) : "";
		console.log(`${taskType} TASK [JS] --> NAME: ${node.namespace_name} PARAMS: ${node.params.map(p => types.stringifyType(p))}${returnType}`);
    }
}
function registerJdecl(node) {
    let old_using_name = this.using_name;
    if (node.namespace)
        this.using_name = namespace.registerSubNamespace(node.namespace.name, this.using_name);
    this.walk(node.decls);
    this.using_name = old_using_name;
}

module.exports = {
    processManifest: processManifest,
    registerGlobals: registerGlobals,
};
