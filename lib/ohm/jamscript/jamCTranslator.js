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
var tasks = require("./tasks");
const milestone = require("./milestone");
const astTreeWalker = require("./astTreeWalker");

var astify = cAstMatcher.astify;
var cTranslator = cTranslatorFile.cTranslator;

var currentFunction = "";
var prototypes = new Map();
var tableManager;
var jCondMap;
var mainparams = false;

var jamCTranslator = {
    Source: function (node) {
        this.prototypes = [];
        let bodies = this.walk(node.content);
        node.content = bodies.concat(this.prototypes);
        return node;
    },
	Sync_task: function (node) {


		// tableManager.enterScope();
		// currentFunction = funcname;
		// tableManager.setInTask(true, funcname);
		// allFunc.push(funcname);
		// symbolTable.enterScope();
		let params = node.params;
		//for (let param in params) symbolTable.set(param.name, param.type);

        let funcname = node.name;

		const cWrapper = tasks.createCTaskWrapperInC(rtype, funcname, params);
        // We create the function itself before the wrapper... because the wrapper calls the function... we also need to have a prototype, in case there are recursive calls of the function to itself... which would look like function calling wrapper which calls function after translation
        // We need to translate the funciton body to convert function calls to call the appropriate function...
        // The local_sync_call for synchronous tasks
        // Also we need to do our type translation...


		//symbolTable.exitScope();
		//tableManager.exitScope();
		//tableManager.setInTask(false, funcname);

		return {
			C: functionCodes + "\n" + cWrapper,
		};
	},
	Async_task: function (node) {
        // let func = symbolTable.get(funcname);

		// tableManager.enterScope();

		// tableManager.setInTask(true, funcname);
		// currentFunction = funcname;
		// allFunc.push(funcname);

		let params = func.params;
        //symbolTable.enterScope();
        //params.forEach((param) => symbolTable.set(param.name, param.type));

		const cWrapper = tasks.createCTaskWrapperInC("void", funcname, params);

        //symbolTable.exitScope();
		//tableManager.exitScope();
		//tableManager.setInTask(false, funcname);

		return {
			C: functionCodes + "\n" + cWrapper,
		};
	},
	Source: function (node) { // TODO this check should be seperate...
		for (let lib of exportLibs)
			if (lib.side === "C" && allFunc.indexOf(lib.function_name) < 0)
				throw `Function ${lib.function_name} cannot be exported because it does not exist on C side`;
	},
	Prototype: function (node) {
        // TODO we are doing our jam prototypes for this now
		if (taskInfo && taskInfo.language === 'js') {
			let jsTaskWrapper = tasks.createJsTaskWrapperInC(rtype, idTranslated, parameters);
		}

		return this.cTranslator + (jsTaskWrapper ? "\n" + jsTaskWrapper : '');
	},
	Pcall_decl_ParamTypeList: function (_1, node, _2) {
        // TODO check decl names do not conflict with namespace
        // TODO add to table manager (?)
	},

};

let __cTranslator = {};

// TODO check not redeclaring DFLOW data on Cside
__cTranslator.Dir_declarator_Id = function (id) {
	var symbol = symbolTable.get(id.sourceString);
	if (symbol !== undefined) {
		if (symbol.jdata_type === "dflow") {
			throw ("Variable " + id.sourceString + " is conflicting with a prior declaration");
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
    // TODO milestones
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
					`${functionInfo.taskType === "async" ? "local_async_call" : "local_sync_call"}(cnode->tboard, "${functionName}"${functionParams.length > 0 ? ", " + functionParams : ""})`
				);
			} else if (functionInfo.language === "j") {
				currResult = currResult.replace(
					/[a-zA-Z0-9]+\(.*\)/g, // TODO
					`${functionInfo.taskType === "async" ? "remote_async_call" : "remote_sync_call"}(cnode->tboard, "${functionName}${functionParams.length > 0 ? ", " + functionParams : ""}")`
				);
			}
		}

		code.push(currResult);
        // TODO milestones
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

function generate_setup() {
    let func = astify("void user_setup(){}", "Function_def");
    for (let [key, val] of jCondMap) // generate jconds
        func.body.block.push(astify(`jcond_define("${key}","${val}")`));
    for (const [name, values] of symbolTable.tasks.c) {
        let ts = `"${values.codes.join("")}"`;
        let jt = `"${values.jCond.tag || ""}"`;
        func.body.block.push(astify(`tboard_register_func(cnode->tboard,TBOARD_FUNC("${name}",call_${name},${ts},${jt},PRI_BATCH_TASK));`, "Expr_stmt"));
    }
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

        console.log("printing dot");
        // TODO compiler option for printing trees
        printAst(ast, "ast.dot");

        console.log("blockifying");
        astTreeWalker(preCompilationC.blockifyStatements).walk(ast);
        console.log("namespace check");
		astTreeWalker(preCompilationC.getNamespace).walk(ast);
        console.log("function reg");
		astTreeWalker(preCompilationC.registerGlobals).walk(ast);
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

        console.log("printing code");
        console.log(astTreeWalker(cTranslator).walk(ast));
	},
    jamCTranslator: jamCTranslator,
};
