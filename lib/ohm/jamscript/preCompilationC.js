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

function getTypeSigned(type) {
    let res = type.replaceAll("unsigned ", "");
    let unsigned = res !== type;
    let res2 = res.replaceAll("signed ", "");
    if (res2 !== res && unsigned)
        throw `Type "${type}" specifies both signed and unsigned.`;
    return {type: res2, unsigned: unsigned};
}

// Registers activity, and checks that function argument and return types are legal.
function registerActivity(activityType, node) {
    this.funcname = node.name = node.name.name;
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
    if (node.namespace != null) {
        console.error("TODO: namespaces have not been implemented yet, sorry");
		// TODO: Determine the expected behavior when there is at least one namespace
		// this.funcname = namespc + "_func_" + namespace_funcs[namespc].indexOf(this.funcname);
	}
    if (node.jtask_attr != null) {
        console.error("TODO: jtask_attrs have not been implemented yet, sorry");
        // TODO
    }
    let funcparams = this.walk(node.params);
    console.log(funcparams);
    let func_info = {
		activityType: activityType,
		language: "c",
		codes: funcparams.map(p => types.getCCode(p.type.type)),
		params: funcparams,
        jCond: jCond,
	};
    if (activityType === "sync") {
        func_info.returnType = this.walk(node.return_type);
        let point = "*".repeat(node.pointer_list == null ? 0 : node.pointer_list.length);
        if (point) {
            if (point !== "*" || func_info.returnType.type !== "char")
                throw `Unsupported type ${func_info.returnType.type + point} in jtask ${this.funcname} return`;
            func_info.returnType.type += point;
        }
        node.return_type = func_info.returnType;
        delete node.pointer_list;
    }
    milestone.registerFunction(this.funcname, activityType);
    callGraph.addActivity("c", this.funcname, activityType);
	symbolTable.addActivity(this.funcname, func_info);
    if (VERBOSE)
		console.log(`${activityType.toUpperCase()} FUNCTION [C] --> NAME: ${this.funcname} PARAMS: ${funcparams.map(p => p.type + " " + p.name)}${func_info.returnType == undefined ? "" : " --> " + func_info.returnType.type}`);
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
		let type = this.walk(node.param_type); //TODO has a bunch of type attributes idk if we want
        let res = this.walk(node.name);
        if (res.point) {
            if (res.point !== "*" || type.type !== "char")
                throw `Unsupported type ${type.type + res.point} in jtask ${this.funcname}`;
            type.type += res.point;
        }
        node.param_type = type;
        node.name = res.name;
		return {
			type: type,
			name: res.name,
		};
	},
	Declarator: function (node) {
        let points = "*".repeat(node.pointer_list == null ? 0 : node.pointer_list.length);
		var res = this.walk(node.name);
        res.point = res.point == undefined ? points : res.point + points;
        if (node.gcc_asm || node.gcc_attributes.length > 0)
            console.error(`WARN: gcc attributes are not supported and will be ignored in ${this.funcname}`);
    	return res;
	},
	Function_decl: function (node) {
        let res = this.walk(node.name);
        res.params = res.params==undefined ? this.walk(node.params) : res.params.concat(this.walk(node.params));
		return res;
	},
    Array_decl: function (node) {
        let res = this.walk(node.name);
        if (res.array != undefined)
            throw `Cannot have multiple array types in ${this.funcname}`;
        res.array = this.walk(node.array);
		return res;
	},
    Pmember_decl: function(node) {
        if (node.gcc_attributes != null && node.gcc_attributes.length > 0)
            console.error(`WARN: Array modifiers are not supported and will be ignored in ${this.funcname}`);
        if (node.expr == null)
            throw `Array must be specified with a fixed size in ${this.funcname}`;
        if (node.expr.type !== "number")
            throw `Array size should be a constant integer in ${this.funcname}`;
        let res = parseInt(node.expr.value);
        if (isNAN(res))
            throw `Could not convert number "${node.expr.value}" into positive integer value`;
        return res;
    },
    Decl_specs: function (node) {
        let type = this.walk(node.decl_type);
        if (typeof type === "string")
            type = {type: type, unsigned: false};
        switch (type.type) {
        case "char":
        case "int":
        case "long long int":
            break;
        case "void":
        case "float":
        case "double":
            if (type.unsigned)
                throw `Type ${type.type} cannot be unsigned in jtask ${this.funcname}`;
            break;
        default:
            throw `Unsupported type ${type.type} in jtask ${this.funcname}`;
        }
        type.attributes_left = node.attributes_left;
        type.attributes_right = node.attributes_right;
        return type;
    },
    Type_spec_Modified: function(node) {
        let name = node.type_name || "int";
        let unsigned = false;
        let signed = false;
        let modifiers = "";
        for (let mod in node.modifier) {
            switch (mod) {
            case "unsigned":
                unsigned = true;
                if (signed)
                    throw `Type in ${this.funcname} for ${name} cannot be both unsigned and signed`;
                break;
            case "signed":
                signed = true;
                if (unsigned)
                    throw `Type in ${this.funcname} for ${name} cannot be both signed and unsigned`;
                break;
            default:
                modifiers += mod + " ";
            }
        }
        return {type: modifiers + name, unsigned: unsigned};
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
