/* eslint-env node */
"use strict";

const jCondTranslator = require("./jCondTranslator");
const symbolTable = require("./symbolTable");
const callGraph = require("./callGraph");
const jdata = require("./jdata");
const tasks = require("./tasks");
const milestone = require("./milestone");

const jsAstMatcher = require("./jsAstMatcher");
const preCompilationJs = require("./preCompilationJs");
const astTreeWalker = require("./astTreeWalker");
const printAst = require("./astPrint").printAst;
const jsTranslator = require("../ecmascript/es5").jsTranslator;
const astify = jAstMatcher.astify;

const jCondMap = new Map();

const jamJsTranslator = {
	Program: function (node) {
		this.hasJdata = false;
        let userFunc = astify('async function user_program(){}', "Declaration");
        userFunc.body.content = this.walk(node.content);

        let newContent = [
            astify(`const __worklib = require('modules/jworklib');`, "Statement"),
            astify(`const __datalib = require('modules/jdatalib');`, "Statement"),
            astify(`const jsys = __worklib.getjsys();`, "Statement"),
            astify(`await __worklib.init((x)=>{ __datalib.updateUServers(x, jsys.id, jsys.app); });`, "Statement") // TODO idk what this is doing
        ];

		if (this.hasJdata) {
            newContent.append(astify(`let __redserv = __datalib.createRedis(jsys.redis.host, jsys.redis.port);`, "Statement"));
            newContent.append(astify(`let __myid = await __datalib.getId(__redserv, jsys.id);`, "Statement"));
            newContent.append(astify(`let __appid = await __datalib.getAppId(__redserv, jsys.app);`, "Statement"));
            newContent.append(astify(`await __datalib.configureMainRedis(__redserv, jsys.redis.host, jsys.redis.port, __appid, () => { __worklib.notifyRedis(jsys.redis.host, jsys.redis.port); });`, "Statement"));
        }

        newContent.append(astify(`const conds = new Map();`, "Statement"));
        for (var {jCondTag, jcsrc} of jCondMap)
            newContent.append(astify(`conds.set("${jCondTag}", {source: \`${jcsrc}\`});`, "Statement"));
        newContent.append(astify(`__worklib.registerConds(conds);`, "Statement"));

        newContent = newContent.concat(tasks.generateMbox(symbolTable.tasks.js, false));
        newContent.append(astify(`__worklib.registerFuncs(mbox);`, "Statement"));

        // TODO jsys.setMilestoneCount(...) in program initiator

        newContent.append(userFunc);
        newContent.append(astify(`user_program().then(()=>{console.log("Program completed.");}).catch((e)=> {console.error("Program error! ", e);});`, "Statement"));

        node.content = newContent;

        const jstartMbox = tasks.generateMbox(symbolTable.tasks.js, true);
		return {
			JS: {jsout: jsOut, jstart: generateJStart(jstartMbox, jcond)},
			jconds: jCondMap,
			hasJdata: hasJdata,
		};
	},
    Jdata_decl: function(node) {
        this.hasJData = true;
        var decls = [];
        for (var jdata of node.decls)
            decls.append(astify(`let ${jdata.name.name} = await __datalib.create${jdata.jflow}(__redserv, "${jdata.namespace_name}", __myid, __appid);`, "Statement"));
        return decls;
    },
	MemberExpr_funcExpr: function (fname, _1, node, _2) {
		memberFunc = fname.sourceString;
		var val = node.jamJSTranslator;
		memberFunc = undefined;
		return val;
	},
	MemberExpr_propRefExp: function (left, op, right) {
		var str;
		var funcname = "";
		var flowname;
		var bcaster = [];

		if (left.sourceString === "jsys")
			return {
				string: left.sourceString + "." + right.sourceString,
				func: funcname,
				bcasts: bcaster,
			};
	    else if (left.child(0).ctorName === "identifier") {
			var sentry = symbolTable.get(left.sourceString);
			console.log(sentry);
			if (sentry === undefined)
				throw left.sourceString + " is not defined in jdata";
			if (sentry.jdata_type === "dflow" && memberFunc !== undefined)
				throw ("function reduction cannot be applied on dflows (broadcasters) " + left.child(0).ctorName);
			if (sentry.jdata_type === "uflow") {
				if (sentry.type_spec === "char*") {
					str = "lgg." + left.sourceString + ".lastValue()";
				} else {
					flowname = "__" + left.sourceString + "Flow";
					funcname += generateFlowDecl(left.sourceString, flowname, right.sourceString);
					str = writeMemFunc(flowname, right.sourceString, memberFunc || "avg");
				}
			} else {
				str = "bc." + left.sourceString + ".getLastValue()." + right.sourceString;
				bcaster.push(left.sourceString);
			}
			return {
				string: str,
				func: funcname,
				bcasts: bcaster,
			};
		} else
			throw("Only first level attributes allowed in jcond: " + left.sourceString + "." + right.sourceString);
	},
	MemberExpr: function (node) {
		var str;
		var funcname = "";
		var flowname;
		var bcaster = [];

		if (node.ctorName === "identifier") {
			var sentry = symbolTable.get(node.sourceString);
			if (sentry === undefined)
				throw node.sourceString + " is not defined in jdata";

			if (sentry.jdata_type === "dflow" && memberFunc !== undefined)
				throw("function reduction cannot be applied on dflows (broadcasters) " + node.sourceString);


			if (sentry.jdata_type === "uflow") {
				if (sentry.type_spec === "char*") {
					str = "lgg." + node.sourceString + ".lastValue()";
				} else {
					flowname = "__" + node.sourceString + "Flow";
					funcname += generateFlowDecl(node.sourceString, flowname, null);
					if (memberFunc === undefined)
						str = writeMemFunc(flowname, null, "avg");
					else
                        str = writeMemFunc(flowname, null, memberFunc);
				}
			} else {
				str = "bc." + node.sourceString + ".getLastValue()";
				bcaster.push(node.sourceString);
			}
			return {
				string: str,
				func: funcname,
				bcasts: bcaster,
			};
		} else if (node.ctorName === "literal") {
			return {
				string: node.jamJSTranslator,
				func: "",
				bcasts: bcaster,
			};
		} else {
			return {
				string: node.jamJSTranslator.string,
				func: node.jamJSTranslator.func,
				bcasts: node.jamJSTranslator.bcasts,
			};
		}
	},
	Jcond_rule: function (left, op, right, _1, cb) {
		var code = 0;
		var cback = "";

		// Set the callback..
		if (cb.numChildren > 0) cback = cb.sourceString;

		// Put jsys.type on left hand side, so we don't have to check everything twice
		if (right.sourceString === "jsys.type") {
			if (left.sourceString === "jsys.type")
				throw "Cannot have jsys.type as both sides of expression";
			var temp = right;
			right = left;
			left = temp;
		}
		if (left.sourceString === "jsys.type") {
            if (right.sourceString === '"device"')
				code = 1;
			else if (right.sourceString === '"fog"')
				code = 2;
			else if (right.sourceString === '"cloud"')
				code = 4;

			if (op.sourceString === "!=")
                code = code ^ 7;
            else if (op.sourceString !== "==")
				throw "Operator " + op.sourceString + " not compatible with jsys.type";
		} else if (left.sourceString === "jsys.sync") {
			if ((op.sourceString === ">=" || op.sourceString === "==") && right.child(0).ctorName === "literal" && Number(right.sourceString) > 0)
				code = code | 8;
		} else if (left.child(0).ctorName !== "literal" || right.child(0).ctorName !== "literal")
			code = code | 16;

		return {
			string: 'jcondContext("' + left.jamJSTranslator.string + '") ' + op.sourceString + " " + right.jamJSTranslator.string,
			code: code,
			cback: cback,
			func: left.jamJSTranslator.func + right.jamJSTranslator.func,
			bcasts: mergeElements(left.jamJSTranslator.bcasts, right.jamJSTranslator.bcasts),
		};
	},
	Jcond_entry: function (id, _1, rules, _2) {
		jCondMap.set(id.sourceString, rules.sourceString.replace(/"/g, "'"));

		var first = rules.child(0).jamJSTranslator;
		var seperators = rules.child(1);
		var rest = rules.child(2);
		var code = first.code;
		var string = first.string;
		var funcstr = first.func;
		var cback = [];
		if (first.cback !== "") cback = [first.cback];
		var bcasts = first.bcasts;
		for (var i = 0; i < rest.numChildren; i++) {
			var restval = rest.child(i).jamJSTranslator;
			string += " " + seperators.child(i).sourceString + " " + restval.string;
			code = code | restval.code;
			funcstr += restval.func;
			if (restval.cback !== "")
                cback.push(restval.cback);
			bcasts = mergeElements(bcasts, restval.bcasts);
		}

		return {
			name: id.sourceString,
			string: string,
			code: code,
			func: funcstr,
			cback: cback,
			bcasts: bcasts,
		};
	},
	Jconditional: function (_1, id, _2, entries, _3) {
		var output = "";
		var foutput = "\n";
		var namespace = "";
		if (id.numChildren > 0)
			namespace = id.sourceString + ".";
		for (var i = 0; i < entries.numChildren; i++) {
			var entry = entries.child(i).jamJSTranslator;
			jCondTranslator.set(namespace + entry.name, {
				source: entry.string,
				code: entry.code,
			});
		}
		return output + foutput;
	},
	Sync_task: function (_1, jCond_spec, _2, functionDeclaration) {
		var jCond = {
			source: "true",
			code: 0,
			cback: "",
			bcasts: [],
		};
		if (jCond_spec.numChildren > 0)
			jCond = jCond_spec.jCondTranslator[0];
	},
	Async_task: function (_1, jcond_spec, _2, functionDeclaration) {
		var jCond = {
			source: "true",
			code: 0,
			cback: "",
			bcasts: JSON.stringify([]),
		};
		if (jcond_spec.numChildren > 0)
			jCond = jcond_spec.jCondTranslator[0];
	},
};
var __es5Translator = {};

__es5Translator.AssignmentStatement_expression = function (left, _2, right, _4) {
	var symbol = symbolTable.get(left.es5Translator);
	if (symbol !== undefined) {
		if (symbol.jdata_type === "dflow") {
			var value;
			// Convert value to a string
			if (symbol.type_spec === "char*")
				value = `String(${right.es5Translator})`;
			else
				value = `String(Number(${right.es5Translator}))`;
			return `jman.broadcastMessage("${left.es5Translator}", ${value});`;
		} else if (symbol.jdata_type === "uflow" || symbol.jdata_type === "shuffler") {
			throw `Cannot write to ${symbol.jdata_type} var ${left.es5Translator} from javascript`;
		}
	}

	return left.es5Translator + " = " + rightString + ";";
};

__es5Translator.CallExpression_memberExpExp = function (exp, args) {
    if (exp.sourceString === "require") {
		var moduleName = args.child(1).sourceString.slice(1, -1);
		try {
			require.resolve(moduleName, {paths: ["~/.jamruns"]});
		} catch (e) {
			throw `ERROR: Module ${moduleName} not found`;
		}
	}

	if (symbolTable.getTask(exp.es5Translator) !== undefined) {
		const functionParams = args.es5Translator.slice(1, -1);
		const functionName = exp.es5Translator;
		const functionInfo = symbolTable.getTask(functionName);
		if (functionInfo.language === "c")
			res = `${functionInfo.taskType === "async" ? "__worklib.remoteExecNoRV" : "__worklib.remoteExecRV"}("${functionName}", "x" ${functionParams.length > 0 ? ", " + functionParams : ""})`;
		else if (functionInfo.language === "js")
			res = `${functionInfo.taskType === "async" ? "__worklib.machExecNoRV" : "__worklib.machExecRV" }("${functionName}", ${functionParams.length > 0 ? functionParams : ""})`;
	}
	return res;
};

function generateJStart(mBoxDefinitions = "", conditionDefinitions = "") {
	return `const minicore = require('core/minicore');
  const jaminit = require('core/jaminit');
  const JAMCore = require('core/jamcore');
  ${mBoxDefinitions}
  ${conditionDefinitions}
  async function launch() {
      console.log("------");
      minicore.init('./jamout.js', []);
      var ports = await minicore.run();
      var jsys = await jaminit.run();
      var jcore = new JAMCore(jsys, jaminit.reggie);
      jcore.registerFuncs(mbox);
      await jcore.run();
      jcore.addWorker(ports.app);
  }
  launch().then(()=> {
      console.log("Starting App..");
  });`;
}

function writeMemFunc(lsrc, rsrc, mfn) {
	var str;
	var endstr = "";
	if (rsrc !== null)
        endstr = "." + rsrc;

	switch (mfn) {
	case "max":
		str = "fl." + lsrc + ".getMax()" + endstr;
		break;
	case "min":
		str = "fl." + lsrc + ".getMin()" + endstr;
		break;
	case "avg":
		str = "fl." + lsrc + ".getAverage()" + endstr;
		break;
	case "sum":
		str = "fl." + lsrc + ".getSum()" + endstr;
		break;
	default:
		throw "Unsupported aggregation function in JCond: " + mfn;
	}

	return str;
}

function generateMbox(jsTasks, inJStart=false) {
    var body = [astify(`const mbox = new Map()`, "Statement")];
    for (var key, {jCond, signature, taskType} of jsTasks) {
        const resultsDescriptor = taskType === 'sync';
        const encodedName = inJStart ? `"${functionName}"` : functionName;
        body.append(astify(`mbox.set("${functionName}", {func: ${encodedName}, arg_sig: "${signature}", side_eff: true, results: ${resultsDescriptor}, reuse: false, cond: "${jCond.tag ? jCond.tag : ''}"});`, "Statement"));
    }
    return body;
},


function generateFlowDecl(lsrc, flname, rsrc) {
	var src;
	var ename;
	if (rsrc !== null) {
		ename = rsrc;
		rsrc = '"' + rsrc + '"';
	} else ename = "";

	var funcname = flname + "Func" + ename;
	if (flowDecls.get(funcname) !== undefined) return "";
	flowDecls.set(funcname, funcname);

	src = "var " + flname + " =  " + funcname + "(Flow.from(" + lsrc + "));";
	src += "\n";
	src += "__jworklib.addFlow('" + flname + "', " + flname + ");\n";
	src += "function " + funcname + "(inputFlow) { \n";
	src += 'return inputFlow.select("data").runningReduce({ \n';
	src += "min: " + rsrc + ",\n";
	src += "max: " + rsrc + ",\n";
	src += "sum: " + rsrc + "\n";
	src += "});\n";
	src += "};\n";

	src += "(function poll(){ if (" + lsrc + ".size() < 1) {\n";
	src += 'console.log("Waiting for uflow data ");\n';
	src += "setTimeout(poll, 1000);\n}\nelse {\n";
	src += flname + ".startPush();\n}\n";
	src += "})();\n";

	return src;
}


module.exports = {
    semanticAnalyze: function(input) {
        let ast = jsAstMatcher.fromUserInput(input, "cst_js.dot");
        console.log("processing jamnifest");
        astTreeWalker(preCompilationJs.processManifest).walk(ast);
        console.log("registering globals");
        astTreeWalker(preCompilationJs.registerGlobals).walk(ast);
        console.log("printing ast (js)");
        printAst(ast, "ast_js.dot");
        return ast;
    },
	compile: function (ast) {
		//exportLibs = libs;

		console.log("Generating JavaScript Code...");
		//translate(ast);
        console.log("(js) Converting ast to string");
        console.log(astTreeWalker(jsTranslator).walk(ast));
	},
};
