/* eslint-env node */

"use strict";
const milestone = require("./milestone");
const symbolTable = require("./symbolTable");

const VERBOSE = true;

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
        func_info.returnType = specs.jamC
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

var pruneAst = {
    _nonterminal: function(...children) {
        let i = 0;
        while (i < children.length) {
            switch(children[i].ctorName) {
            case "Assign_expr":
            case "Cond_expr":
            case "Lor_expr":
            case "Lar_expr":
            case "Ior_expr":
            case "Xor_expr":
            case "And_expr":
            case "Eq_expr":
            case "Rel_expr":
            case "Shift_expr":
            case "Add_expr":
            case "Mult_expr":
            case "Prefix_expr":
            case "Cast_expr":
            case "Unary_expr":
            case "Postfix_expr":
            case "Left_expr":
            case "Dir_declarator":
            case "Dir_declarator_Id":
                if(children[i].numChildren ==1 && children[i].sourceString == children[i].child(0).sourceString){
                    children[i] = children[i].child(0);
                    continue;
                }
            }
            children[i].pruneAst();
            this._node.children[i] = children[i]._node; // because semantic operations only give us node wrappers
            i++;
        }
    },
    _iter: function(...children) {
        children.forEach(c => c.pruneAst());
    },
    _terminal: function() {}
};

module.exports = {
    pruneAst: pruneAst,
    registerFunctions: registerFunctions,
};
