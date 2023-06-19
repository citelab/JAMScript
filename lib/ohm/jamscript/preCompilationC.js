/* eslint-env node */

"use strict";
const milestone = require("./milestone");
const symbolTable = require("./symbolTable");

const VERBOSE = true;

var registerFunctions = {
    Source: function(decls) {
        decls.children.forEach(d => d.registerFunctions);
    },
	Sync_activity: function (_1, specs, jCond_spec, _2, declarator, namespace, stmt) {
		var func = declarator.registerFunctions;
		if (VERBOSE)
			console.log(`SYNC FUNCTION [C] --> NAME: ${func.name} PARAMS: ${func.params.map(p => p.type + " " + p.name)}`);
		milestone.registerFunction(func.name, "SYNC");

		symbolTable.addActivity(func.name, {
			activityType: "sync",
			language: "c",
			codes: [],
			params: func.params,
		});
	},
	Async_activity: function (_1, jCond_spec, _2, decl, namespace, stmt) {
		var func = decl.registerFunctions;
		if (VERBOSE)
			console.log(`ASYNC FUNCTION [C] --> NAME: ${func.name} PARAMS: ${func.params.map(p => p.type + " " + p.name)}`);
		milestone.registerFunction(func.name, "ASYNC");

		symbolTable.addActivity(func.name, {
			activityType: "async",
			language: "c",
			codes: [],
			params: func.params,
		});
	},
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
}
