/* eslint-env node */

"use strict";
const milestone = require("./milestone");
const symbolTable = require("./symbolTable");
const defaultTreeWalk = require("./cAstMatcher").defaultTreeWalk;

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
    Prototype: null,
    Expr: null,
    Label_stmt: blockifyFn,
    Case_stmt: blockifyFn,
    Default_stmt: blockifyFn,
    If_stmt: blockifyFn,
    Switch_stmt: blockifyFn,
    While_stmt: blockifyFn,
    DoWhile_stmt: blockifyFn,
    For_stmt: blockifyFn,
};

function register_activity(node) {
    let func = decl.registerFunctions;
    let jCond = {
		source: "true",
		code: 0,
		cback: "",
		bcasts: JSON.stringify([]),
	};
	if (jCond_spec.numChildren > 0)
		jCond = jCond_spec.jCondTranslator[0];
    if (namespace.numChildren > 0) {
		// TODO: Determine the expected behavior when there is at least one namespace
		// funcname = namespc + "_func_" + namespace_funcs[namespc].indexOf(funcname);
	}
    let func_info = {
		activityType: activityType,
		language: "c",
		codes: func.params.map((param) => types.getCCode(param.type)),
		params: func.params,
        jCond: jCond,
	};
    if (activityType === "sync") {
        func_info.returnType = specs.jamC;
    }
    milestone.registerFunction(func.name, activityType);
    callGraph.addActivity("c", func.name, activityType);
	symbolTable.addActivity(func.name, func_info);
    this._node.function_name = func.name;
    if (VERBOSE)
		console.log(`%{activityType.toUpperCase()} FUNCTION [C] --> NAME: ${func.name} PARAMS: ${func.params.map(p => p.type + " " + p.name)}`);
}

var registerFunctions = {
	Sync_activity: register_activity.bind(this, "sync"),
	Async_activity: register_activity.bind(this, "async"),
    Function_def: function (specs, decl, stmts) {
	    const func = decl.registerFunctions;
	    if (VERBOSE)
		    console.log(`REGULAR FUNCTION [C] --> NAME: ${func.name} PARAMS: ${func.params.map(p => p.type + " " + p.name)}`);
	    milestone.registerFunction(func.name, "BATCH");
    },
	Activity_def: function (node) {
		return node.registerFunctions;
	},
	External_decl: function (node) {
		return node.registerFunctions;
	},
	Pcall_decl: function (node) {
		return node.registerFunctions;
	},
	Pcall_decl_ParamTypeList: function (_1, node, _2) {
		return node.registerFunctions;
	},
	Pcall_decl_IdentList: function (_1, idents, _2) {
		return idents.registerFunctions;
	},
	Pcall_decl_Empty: function (_1, _2) {
		return [];
	},
	Param_type_lst: function (param_list) {
		var params = [param_list.child(0).registerFunctions];
		var rest = param_list.child(2);
		for (var i = 0; i < rest.numChildren; i++) {
			params.push(rest.child(i).registerFunctions);
		}
		return params;
	},
	Declarator: function (pointer, dir_declarator, _1, _2) {
		var dir_decl = dir_declarator.registerFunctions;
    	return {
			pointer: pointer.cTranslator,
			name: dir_decl.name,
			params: dir_decl.params,
            array: dir_decl.array
		};
	},
	// params
	Dir_declarator_PCall: function (name, params) {
		return {
			name: name.registerFunctions.name,
			params: params.registerFunctions,
		};
	},
    Dir_declarator_PMember: function (name, array) {
		return {
			name: name.registerFunctions.name,
			array: array.cTranslator,
		};
	},
	Param_decl: function (node) {
		return node.registerFunctions;
	},
	Param_decl_Declarator: function (decl_specs, decl) {
		let varType = decl_specs.cTranslator;
        let ident = decl.registerFunctions;
		if (ident.pointer !== "")
			varType += ident.pointer;
        if (ident.array !== "" && ident.array !== undefined)
            varType += ident.array.replaceAll(/\[[0-9]*\]/g,"*");
		return {
			type: varType,
			name: ident.name,
		};
	},
    id: function(id) {
        return {name: id.sourceString};
    },
	_nonterminal: function (...children) {},
	_iter: function (...children) {},
	_terminal: function () {},
};

module.exports = {
    blockifyStatements: blockifyStatements,
    registerFunctions: registerFunctions,
};
