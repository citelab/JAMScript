/* eslint-env node */
"use strict";
var cTranslatorFile = require("../c/c");
const cAstMatcher = require("./cAstMatcher");
var jCondTranslator = require("./jCondTranslator");
const printAst = require("./astPrint").printAst;
const preCompilationC = require("./preCompilationC");
var symbolTable = require("./symbolTable");
var types = require("./types");
var callGraph = require("./callGraph");
var jdata = require("./jdata");
var activities = require("./activities");
const milestone = require("./milestone");
const astTreeWalker = require("./astTreeWalker");

var astify = cAstMatcher.astify;
var cTranslator = cTranslatorFile.cTranslator;

var currentFunction = "";
var prototypes = new Map();
var cCallbackActivities = new Set();
var exportLibs = [];
var importLibs = [];
var allFunc = [];
var tableManager;
var jCondMap;
var mainparams = false;

var jamCTranslator = {
	Namespace_spec: function (_, namespace) {
		return namespace.sourceString;
	},
	Sync_activity: function (_1, specs, jCond_spec, _2, declarator, namespace, stmt) {

		tableManager.enterScope();
		var decl = declarator.jamCTranslator;
		var funcname = decl.name;
		currentFunction = funcname;

		tableManager.setInActivity(true, funcname);

		allFunc.push(funcname);

		symbolTable.enterScope();
		var params = decl.params;
		for (let param : params) {
			symbolTable.set(param.name, param.type);
		}

		var namespc;
		if (namespace.numChildren > 0) {
			namespc = namespace.jamCTranslator;
		}

		const cWrapper = activities.createCTaskWrapperInC(rtype, funcname, params);
		const functionCodes = `${rtype} ${funcname}(${decl.params
			.map((param) => `${param["type"]} ${param["name"]}`)
      		.join(", ")})${stmt.cTranslator}`;

		symbolTable.exitScope();
		tableManager.exitScope();
		tableManager.setInActivity(false, funcname);

		return {
			C: functionCodes + "\n" + cWrapper,
		};
	},
	Async_activity: function (_1, jCond_spec, _2, decl, namespace, stmt) {
        let func = symbolTable.get(funcname);

		tableManager.enterScope();

		tableManager.setInActivity(true, funcname);
		currentFunction = funcname;
		allFunc.push(funcname);

		var params = func.params;
        //symbolTable.enterScope();
        //params.forEach((param) => symbolTable.set(param.name, param.type));

		const cWrapper = activities.createCTaskWrapperInC("void", funcname, params);
		const functionCodes = `void ${funcname}(${params.map(({type, name}) => `${type} ${name}`).join(', ')})${stmt.cTranslator}`;

        //symbolTable.exitScope();
		tableManager.exitScope();
		tableManager.setInActivity(false, funcname);

		return {
			C: functionCodes + "\n" + cWrapper,
		};
	},
	Source: function (decls) {
		for (var lib of exportLibs)
			if (lib.side === "C" && allFunc.indexOf(lib.function_name) < 0)
				throw `Function ${lib.function_name} cannot be exported because it does not exist on C side`;
	},
	Prototype: function (specs, pointer, id, _1, params, _2, gcc, _3) {
		const idTranslated = id.cTranslator;
		var rtype = specs.cTranslator;
		if (pointer.numChildren > 0) {
			rtype += pointer.cTranslator;
		}

		var parameters = [];
		if (params.numChildren > 0) {
			var tempParams = params.jamCTranslator[0];
			for (var i = 0; i < tempParams.length; i++) {
				if (tempParams[i].hasOwnProperty("type")) {
					parameters.push(tempParams[i].type);
				} else {
					parameters.push(tempParams[i]);
				}
			}
		}

		prototypes.set(idTranslated, {
			return_type: rtype,
			params: parameters,
		});

		const taskInfo = symbolTable.getTask(idTranslated);
		let jsTaskWrapper;
		if (taskInfo && taskInfo.language === 'js') {
			jsTaskWrapper = activities.createJsTaskWrapperInC(rtype, idTranslated, parameters);
		}

		return this.cTranslator + (jsTaskWrapper ? "\n" + jsTaskWrapper : '');
	},
	Pcall_decl_ParamTypeList: function (_1, node, _2) {
		var first = node.children[0].children[0].children[0].children[1]; //TODO
		var rest = node.children[0].children[2]; //TODO
		var first_id = cTranslatorFile.getDeclaratorId(first);
		if (first_id !== null) {
			tableManager.getCurrentTable().addVar(first_id.jamCTranslator.name);
		}

		if (rest.children.length > 0) {
			var children = rest.children;
			for (var child of children) {
				var child_decl = child.children[0].children[1];
				var child_decl_id = cTranslatorFile.getDeclaratorId(child_decl);
				if (child_decl_id != null) {
					tableManager
						.getCurrentTable()
						.addVar(child_decl_id.jamCTranslator.name);
				}
			}
		}
		return node.jamCTranslator;
	},
	Pcall_decl_IdentList: function (_1, idents, _2) {
		return idents.jamCTranslator;
	},
	Pcall_decl_Empty: function (_1, _2) {
		return [];
	},
	Param_type_lst: function (param_list) {
		var params = [];
		params.push(param_list.child(0).jamCTranslator);
		var rest = param_list.child(2);
		for (var i = 0; i < rest.numChildren; i++) {
			params.push(rest.child(i).jamCTranslator);
		}
		return params;
	},
	Declarator: function (pointer, dir_declarator, _1, _2) {
		var dir_decl = dir_declarator.jamCTranslator;
		return {
			pointer: pointer.cTranslator,
			name: dir_decl.name,
			params: dir_decl.params,
		};
	},
	// params
	Dir_declarator_PCall: function (name, params) {
		return {
			name: name.cTranslator,
			params: params.jamCTranslator,
		};
	},
    id: function (id) {
        return {name: id.sourceString};
    },
	Param_decl: function (node) {
		return node.jamCTranslator;
	},
	Param_decl_Declarator: function (decl_specs, decl) {
		var varType = decl_specs.cTranslator;
		if (decl.jamCTranslator.pointer !== "") {
			varType += decl.jamCTranslator.pointer;
		}
		return {
			type: varType,
			name: decl.jamCTranslator.name,
		};
	},
	Struct_access: function (id, _, expr) {
		// Remove first character from id (the dot)
		return {
			name: id.sourceString.substr(1),
			value: expr.jamCTranslator,
		};
	},
};

let __cTranslator = {};

// TODO check not redeclaring DFLOW data on Cside
__cTranslator.Dir_declarator_Id = function (id) {
	var symbol = symbolTable.get(id.sourceString);
	if (symbol !== undefined) {
		if (symbol.jdata_type === "dflow") {
			throw (
				"Variable " +
				id.sourceString +
				" is conflicting with a prior declaration"
			);
		}
	}
	return id.sourceString;
};

// TODO translate uflow writes and dflow reads
__cTranslator.Left_expr_Call = function (left, call) {
	let pobj, psrc;
	let flowfn;
	let param;
	if (left.child(0).ctorName === "Left_expr_Member") { // TODO
		if (left.child(0).child(0).child(0).ctorName === "Primary_expr") { // TODO
			psrc = left.child(0).child(0).child(0).sourceString; // TODO
			pobj = symbolTable.get(psrc);
			if (pobj === undefined || pobj.type !== 'jdata')
				return left.cTranslator + call.cTranslator;
		}
		flowfn = left.child(0).child(1).child(0).child(1).sourceString; // TODO
		param = call.child(1).cTranslator;
		if (typeof(pobj.type_spec) === 'string') {
			console.log("Primary type");
			switch (pobj.type_spec) {
			case 'int':
				return (flowfn === 'write' ? `ufwrite_int(${psrc}, ${param})` : `dfread_int(${psrc}, ${param})`);
			case 'char*':
				return flowfn==='write' ? `ufwrite_str(${psrc}, ${param})` : `dfread_string(${psrc}, ${param})`;
			case 'float':
			case 'double':
				return flowfn==='write'?`ufwrite_double(${psrc}, ${param})` : `dfread_double(${psrc}, ${param})`;
			}
		} else if (typeof(pobj.type_spec) === 'object') {
			if (flowfn === 'write') {
				let structCall = jdata.createFormatAndArray(param, pobj.type_spec.entries);
				return `ufwrite_struct(${psrc},"${structCall.formatString}",${structCall.valueArray.join(",")})`;
			}
			let structCall = jdata.createFormatAndArrayForRead(param, pobj.type_spec.entries);
			return `dfread_struct(${psrc}, "${structCall.formatString}", ${structCall.valueArray.join(", ")})`;
		}
	}
	return left.cTranslator + call.cTranslator;
};


__cTranslator.Function_def = function (specs, decl, stmts) {
	var declaration = "";
	var fname = "";
	var params = [];

	tableManager.enterScope();
	tableManager.enterScope();

	fname = decl.child(1).child(0).child(0).cTranslator; // TODO
	allFunc.push(fname);

	if (decl.child(1).child(0).ctorName === "Dir_declarator_PCall") // TODO
		params = decl.child(1).child(0).child(1).child(0).child(1).cTranslator.split(", ");
	declaration = decl.cTranslator;
    // TODO this should happen with namespaces... japp_main or whatever
	if (fname === "main") {
		fname = "user_main";
		declaration = "user_" + declaration;
		if (params.length > 1)
            mainparams = true;
	}

	symbolTable.addFunction(fname, "c");
	currentFunction = fname;
	callGraph.addFunction("c", fname);
	symbolTable.enterScope();
	params.forEach(function (param) { // TODO this is gross
		var index = param.lastIndexOf(" ");
		symbolTable.set(param.substring(index + 1), param.substring(0, index));
	}, this);
	var cout = specs.cTranslator + " " + declaration + " " + stmts.cTranslator;
	symbolTable.exitScope();

	tableManager.exitScope();
	tableManager.exitScope();

	return cout;
};

__cTranslator.Compound_stmt = function (_1, stmts, _2, _3) {
	// Decide whether this node is an iteration statement.
	var isIterationStatement = function (n) {
		return n.children[0].ctorName == "Iteration_stmt";
	};

	// Decide whether this node is a selection statement.
	var isSelectiveStatement = function (n) {
		return n.children[0].ctorName == "Selection_stmt";
	};

	// Decide whether this node is a function call.
	var isFunctionCall = function (n) {
		var code = n.sourceString;
		var declarationPattern = /(.+) = ([a-zA-Z0-9]+\(.*\))/g; // TODO
		var statementPattern = /^([a-zA-Z0-9]+\(.*\));/g; // TODO

		return (
			code.match(declarationPattern) != null ||
			code.match(statementPattern) != null
		);
	};

	var getFunctionNames = function (n) {
		var code = n.sourceString;
		var functionCallExtractionPattern = /[a-zA-Z0-9]+\(.*\)/g; // TODO

		var matches = code.match(functionCallExtractionPattern);
		return matches.map((match) => match.substring(0, match.indexOf("(")));
	};

	tableManager.enterScope();
	var code = [];
	var currMilestone = milestone.getAMilestoneNumber();
	code.push(milestone.getCCodeToEmitMilestone(currMilestone));
	for (var i = 0; i < stmts.numChildren; i++) {
		var currChild = stmts.child(i);
		var currResult = currChild.cTranslator;

		// Add task_yield in the case of iteration statement.
		if (isIterationStatement(currChild)) {
			let endBracketLocation = currResult.lastIndexOf("}");
			currResult =
				currResult.slice(0, endBracketLocation) +
				"\ntask_yield();\n" +
				currResult.slice(endBracketLocation);
		}

		// Rename jtask calls.
		if (
			isFunctionCall(currChild) &&
			symbolTable.getTask(currResult.slice(0, currResult.indexOf("("))) !==
			undefined
		) {
			const functionParams = currResult
				.slice(currResult.indexOf("(") + 1, currResult.indexOf(")"))
				.trim();

			const functionName = currResult.slice(0, currResult.indexOf("(")).trim();
			const functionInfo = symbolTable.getTask(functionName);
			if (functionInfo.language === "c") {
				currResult = currResult.replace(
					/[a-zA-Z0-9]+\(.*\)/g, // TODO
					`${functionInfo.activityType === "async" ? "local_async_call" : "local_sync_call"}(cnode->tboard, "${functionName}"${functionParams.length > 0 ? ", " + functionParams : ""})`
				);
			} else if (functionInfo.language === "j") {
				currResult = currResult.replace(
					/[a-zA-Z0-9]+\(.*\)/g, // TODO
					`${functionInfo.activityType === "async" ? "remote_async_call" : "remote_sync_call"}(cnode->tboard, "${functionName}${functionParams.length > 0 ? ", " + functionParams : ""}")`
				);
			}
		}

		code.push(currResult);

		if (isIterationStatement(currChild) || isSelectiveStatement(currChild)) {
			currMilestone = milestone.getAMilestoneNumber();
			code.push(milestone.getCCodeToEmitMilestone(currMilestone));
		} else if (isFunctionCall(currChild)) {
			var functionNames = getFunctionNames(currChild);
			milestone.registerFunctionsForMilestone(currMilestone, functionNames);
		}
	}
	tableManager.exitScope();
	return "{\n" + code.join("\n") + "\n}";
}

function generateCActivities(block) {
    for (const [name, values] of symbolTable.activities.c) {
        let ts = `"${values.codes.join("")}"`;
        let jt = `"${values.jCond.tag || ""}"`;
        block.block.push(astify(`tboard_register_func(cnode->tboard,TBOARD_FUNC("${name}",call_${name},${ts},${jt},PRI_BATCH_TASK));`, "Expr_stmt"));
    }
}

function generateCConditions(block) {
    for (let [key, val] of jCondMap)
        block.block.push(astify(`jcond_define("${key}","${val}")`));
}

function generate_setup() {
    let func = astify("void user_setup(){}", "Function_def");
    generateCConditions(func.body);
    generateCActivities(func.body);
	return func;
}

function generate_taskmain(hasJ) {
    let func = astify("int main(int argc,char**argv){}", "Function_def");
    let block = [];
    block.push(astify("cnode=cnode_init(argc,argv);", "Expr_stmt"));
    if (hasJ) {
        block.push(astify("dp=dpanel_create(cnode->args->redhost,cnode->args->redport,cnode->core->device_id);", "Expr_stmt"));
        block.push(astify("dp_flow_defs();", "Expr_stmt"));
        block.push(astify("dpanel_setcnode(dp,cnode);", "Expr_stmt"));
        block.push(astify("dpanel_start(dp);", "Expr_stmt"));
        block.push(astify("dpanel_settboard(dp,cnode->tboard);", "Expr_stmt"));
    }
    block.push(astify("user_setup();", "Expr_stmt"));
    block.push(astify("user_main(argc,argv);", "Expr_stmt"));
    block.push(astify("cnode_stop(cnode);", "Expr_stmt"));
    block.push(astify("cnode_destroy(cnode);", "Expr_stmt"));

    func.body.block = block;
    return func;
}

function translate(ast, hasJ) {
    // TODO translate jamc to c

	let jvars = hasJ ? jdata.createCVariables(symbolTable.getGlobals()) : [];
    jvars.push(astify("cnode_t *cnode;", "Decl"));
    ast.content = jvars.concat(ast.content);

    ast.content.push(generate_setup());
    ast.content.push(generate_taskmain(hasJ));
}

module.exports = {
	semanticAnalyze: function (input, offset) {
        let ast = cAstMatcher.fromUserInput(input, offset, "cst.dot");
        console.log("blockifying");
        astTreeWalker(preCompilationC.blockifyStatements).walk(ast);
        console.log("function reg");
		astTreeWalker(preCompilationC.registerFunctions).walk(ast);
        console.log("--------------------------------ok--------------------------------------------");
        return ast;
	},
	compile: function (ast, offset, manager, yieldPoint, libs, jCond, hasJdata) {
		tableManager = manager;
		jCondMap = jCond;
		exportLibs = libs;
		if (yieldPoint)
			cTranslatorFile.enableYieldPoint();
		cTranslatorFile.updateTableManager(manager);
		console.log("Generating C code...");

        translate(ast, hasJdata);

        console.log("printing dot");
        // TODO compiler option for printing trees
        printAst(ast, "ast.dot");
        console.log("printing code");
        console.log(astTreeWalker(cTranslator).walk(ast));
	},
    jamCTranslator: jamCTranslator,
};
