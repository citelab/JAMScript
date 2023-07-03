/* eslint-env node */

"use strict";
const milestone = require("./milestone");
const symbolTable = require("./symbolTable");
const defaultTreeWalk = require("./cAstMatcher").defaultTreeWalk;
const astTreeWalker = require("./astTreeWalker");
const types = require("./types");
const callGraph = require("./callGraph")
var cTranslator = require("../c/c").cTranslator;

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
    _default: defaultTreeWalk,
    Prototype: false,
    Expr: false,
    Decl_specs: false,
    Declarator: false,
    Label_stmt: blockifyFn,
    Case_stmt: blockifyFn,
    Default_stmt: blockifyFn,
    If_stmt: blockifyFn,
    Switch_stmt: blockifyFn,
    While_stmt: blockifyFn,
    DoWhile_stmt: blockifyFn,
    For_stmt: blockifyFn,
};

// Registers activity, and checks that function argument and return types are legal.
function registerActivity(activityType, node) {
    let funcname = node.name.name;
    let jCond = {
		source: "true",
		code: 0,
		cback: "",
		bcasts: JSON.stringify([]),
	};
	if (node.jcond != null)
		jCond = node.jcond.jCondTranslator[0]; // TODO
    if (node.namespace != null) {
		// TODO: Determine the expected behavior when there is at least one namespace
		// funcname = namespc + "_func_" + namespace_funcs[namespc].indexOf(funcname);
	}
    let funcparams = this.walk(node.params);
    console.log(funcparams);
    let func_info = {
		activityType: activityType,
		language: "c",
		codes: funcparams.map(p => types.getCCode(p.type)),
		params: funcparams,
        jCond: jCond,
	};
    if (activityType === "sync")
        func_info.returnType = this.getTypes.walk(node.return_type) +
        "*".repeat(node.pointer_list == null ? 0 : node.pointer_list.length);
    milestone.registerFunction(funcname, activityType);
    callGraph.addActivity("c", funcname, activityType);
	symbolTable.addActivity(funcname, func_info);
    node.function_name = funcname;
    if (VERBOSE)
		console.log(`${activityType.toUpperCase()} FUNCTION [C] --> NAME: ${funcname} PARAMS: ${funcparams.map(p => p.type + " " + p.name)}${func_info.returnType == undefined ? "" : " --> " + func_info.returnType}`);
}

var registerFunctions = {
    Source: function(node) {
        this.getTypes = astTreeWalker(cTranslator);
        this.walk(node.content);
    },
	Sync_activity: function(node) {
        registerActivity.call(this, "sync", node);
    },
	Async_activity: function(node) {
        registerActivity.call(this, "async", node);
    },
    Function_def: function (node) {
        let name = this.walk(node.decl.name.name).name;
        if (VERBOSE)
		    console.log(`REGULAR FUNCTION [C] --> NAME: ${name}`);
	    milestone.registerFunction(name, "batch");
    },
    // params
    Param_type_lst_ConArgs: function(node) {
        return this.walk(node.params);
    },
    Param_type_lst_VarArgs: function(node) {
        let params = this.walk(node.params);
        params.push({name: "...", type: "var_args"});
    },
	Param_decl_Declarator: function (node) {
		let varType = this.getTypes.walk(node.param_type); //TODO has a bunch of type attributes idk if we want
        let res = this.walk(node.name);
		return {
			type: varType + res.point,
			name: res.name,
		};
	},
	Declarator: function (node) {
        let points = "*".repeat(node.pointer_list == null ? 0 : node.pointer_list.length);
		var res = this.walk(node.name);
        res.point = res.point == undefined ? points : res.point + points;
    	return res;
	},
	Function_decl: function (node) {
        let res = this.walk(node.name);
        res.params = res.params==undefined ? this.walk(node.params) : res.params.concat(this.walk(node.params));
		return res;
	},
    Array_decl: function (node) {
        let res = this.walk(node.name);
        res.point = res.point == undefined ? "*" : res.point + "*";
		return res;
	},
    id: function(id) {
        return {name: id.name};
    },
    Prototype: false,
};

module.exports = {
    blockifyStatements: blockifyStatements,
    registerFunctions: registerFunctions,
};
