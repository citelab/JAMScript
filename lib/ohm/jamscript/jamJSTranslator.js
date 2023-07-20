/* eslint-env node */

"use strict";

var fs = require("fs");
var path = require("path");

var ohm = require("ohm-js");
var es5Translator = {};
var es5 = require("../ecmascript/es5");
var es6 = require("../ecmascript/es6");

var jCondTranslator = require("./jCondTranslator");
var symbolTable = require("./symbolTable");
var callGraph = require("./callGraph");
var jdata = require("./jdata");
var tasks = require("./tasks");
var milestone = require("./milestone");

var currentFunction = "";
var memberFunc = undefined;
var flowDecls = new Map();
var maxLevel = 1;
var exportLibs = [];
var importLibs = [];
var allFunc = [];
const jCondMap = new Map();

var jamJSTranslator = {
	Program: function (directives, elements) {
		var jsout = "";
		var annotated_JS = "";
		var hasJdata = false;

		callGraph.addFunction("js", "root");
		currentFunction = "root";
		for (var i = 0; i < elements.children.length; i++) {
			if (elements.child(i).child(0).child(0).ctorName === "Task_def") {
				jsout += elements.child(i).child(0).child(0).jamJSTranslator;
			} else if (
				elements.child(i).child(0).child(0).ctorName === "Jconditional"
			) {
				jsout += elements.child(i).child(0).child(0).jamJSTranslator;
			} else if (
				elements.child(i).child(0).child(0).ctorName === "Jdata_decl"
			) {
				hasJdata = true;
				jsout += elements.child(i).child(0).child(0).jamJSTranslator;
			} else if (elements.child(i).child(0).child(0).ctorName === "Jexport") {
				jsout += elements.child(i).child(0).child(0).child(0).jamJSTranslator;
			} else if (elements.child(i).child(0).child(0).ctorName === "Jrequire") {
				jsout += elements.child(i).child(0).child(0).jamJSTranslator;
			} else {
				currentFunction = "root";
				jsout += elements.child(i).child(0).child(0).es5Translator + "\n";
			}
		}

		for (var lib of exportLibs) {
			if (lib.side === "J" && allFunc.indexOf(lib.function_name) < 0) {
				throw (
					"Function " +
					lib.function_name +
					" cannot be exported because it does not exist on JS side."
				);
			}
		}

		let requires = '';
		if (hasJdata) {
			requires = `
        const __worklib = require('modules/jworklib');
        const __datalib = require('modules/jdatalib');
        let jsys;
        let __redserv;
		let __myid;
		let __appid;
      `;
		} else {
			requires = `
        const __worklib = require('modules/jworklib');
        let jsys;
      `;

		}


		const programInitiator = `
    async function main_program() {
      await __worklib.init((x)=>{ __datalib.updateUServers(x, jsys.id, jsys.app); });
      jsys = __worklib.getjsys();
      await last_init();
      await user_program();
    }

    main_program().then(()=> {
      console.log("Program completed.");
    }).catch((e)=> {
      console.log("Program error! ", e)
    })
    `;

		const jamoutConditionAndMBoxRegistration = `
    __worklib.registerFuncs(mbox);
    __worklib.registerConds(conds);
    `;

		const mbox = tasks.generateMbox(symbolTable.tasks.js, false);
		const jstartMbox = tasks.generateMbox(symbolTable.tasks.js, true);

		const jcond = generateJcondMap();

		annotated_JS = requires + programInitiator + annotated_JS;

		let jdata_configR = hasJdata ? '__redserv = __datalib.createRedis(jsys.redis.host, jsys.redis.port); \n' : ''
		let jdata_getid = hasJdata ? '__myid = await __datalib.getId(__redserv, jsys.id); \n' : ''
		let jdata_getappid = hasJdata ? '__appid = await __datalib.getAppId(__redserv, jsys.app); \n' : ''
		let jdata_creatR = hasJdata ? 'await __datalib.configureMainRedis(__redserv, jsys.redis.host, jsys.redis.port, __appid, ()=> { __worklib.notifyRedis(jsys.redis.host, jsys.redis.port); }); \n' : ''

		const jsOut =
			requires +
			programInitiator +
			'async function user_program(){ \n' +
			jdata_configR +
			jdata_getid +
			jdata_getappid +
			jdata_creatR +
			mbox +
			jcond +
			jamoutConditionAndMBoxRegistration +
			jsout +
			'}\n' +
			'async function last_init() { \n' +
			'  jsys.setMilestoneCount(' + milestone.getMilestoneCount() + '); \n' +
			'}\n';

		return {
			JS: {
				jsout: jsOut,
				jstart: generateJStart(jstartMbox, jcond),
			},
			jconds: jCondMap,
			annotated_JS: annotated_JS,
			maxLevel: maxLevel,
			hasJdata: hasJdata,
		};
	},
	Jexport_specified: function (jexport, id, _, level, __) {
		exportLibs.push({
			function_name: id.sourceString,
			level: level.sourceString,
			side: "J",
		});
		return "";
	},
	Jexport_default: function (jexport, id, _) {
		exportLibs.push({
			function_name: id.sourceString,
			level: "None",
			side: "J",
		});
		return "";
	},
	Jrequire: function (jrequire, func, _, namespace, __, level, ___) {
		importLibs.push(namespace.sourceString);
		// Uncomment this when jload is implemented!
		// jload(func.sourceString, namespace.sourceString, level.sourceString);
		return "";
	},
	Task_def: function (node) {
		return node.jamJSTranslator;
	},
	jdata_type: function (type) {
		return type.sourceString;
	},
	Jdata_spec_specified: function (type_spec, id, _1, jdata_type, _2, level, _3, _4) {
		symbolTable.set(id.sourceString, {
			type: "jdata",
			type_spec: type_spec.jamJSTranslator,
			jdata_type: jdata_type.jamJSTranslator,
		});
		if (jdata_type.jamJSTranslator === "uflow") {
			return `let ${id.sourceString} = await __datalib.createUFlow(__redserv, "${id.sourceString}", __myid, __appid);`;
		} else if (jdata_type.jamJSTranslator === "dflow") {
			return `let ${id.sourceString} = await __datalib.createDFlow(__redserv, '${id.sourceString}', __myid, __appid);`;
		} else {
			return;
		}
	},
	Jdata_spec_default: function (type_spec, id, _1, jdata_type, _2) {
		symbolTable.set(id.sourceString, {
			type: "jdata",
			type_spec: type_spec.jamJSTranslator,
			jdata_type: jdata_type.jamJSTranslator,
		});

		if (jdata_type.jamJSTranslator === "uflow") {
			return `let ${id.sourceString} = await __datalib.createUFlow(__redserv, "${id.sourceString}", __myid, __appid);`;
		} else if (jdata_type.jamJSTranslator === "dflow") {
			return `let ${id.sourceString} = await __datalib.createDFlow(__redserv, '${id.sourceString}', __myid, __appid);`;
		} else {
			return;
		}
	},
	Jdata_spec_flow: function (node, _) {
		return node.jamJSTranslator;
	},
	Jdata_spec: function (node) {
		return node.jamJSTranslator;
	},
	Flow_flow: function (id, _1, _2, _3, func, _4, input) {
		return `var ${id.sourceString} = ${func.sourceString}(Flow.from(${input.sourceString}));`;
	},
	Flow_outflow: function (id, _1, _2, _3, input) {
		return `var ${id.sourceString} = new OutFlow(${input.sourceString});`;
	},
	Flow_inflow: function (id, _1, _2) {
		return `var ${id.sourceString} = new InFlow();`;
	},
	Flow: function (node) {
		return node.jamJSTranslator;
	},
	Struct_entry: function (type, id, _) {
		return {
			name: id.sourceString,
			type: type.jamJSTranslator,
		};
	},
	C_type_struct: function (_1, id, _2, entries, _3) {
		return {
			name: id.sourceString,
			entries: entries.jamJSTranslator,
		};
	},
	C_type_pointer: function (id, pointer) {
		return id.sourceString + "*";
	},
	C_type: function (node) {
		return node.jamJSTranslator;
	},
	Jdata_decl: function (_1, _2, jdata_spec, _3) {
		var output = "";
		var specs = jdata_spec.jamJSTranslator;
		for (var i = 0; i < specs.length; i++) {
			if (specs[i] !== undefined) {
				output += specs[i] + "\n";
			}
		}
		return output;
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

		if (left.sourceString === "jsys") {
			return {
				string: left.sourceString + "." + right.sourceString,
				func: funcname,
				bcasts: bcaster,
			};
		} else if (left.child(0).ctorName === "identifier") {
			var sentry = symbolTable.get(left.sourceString);
			console.log(sentry);
			if (sentry === undefined)
				throw left.sourceString + " is not defined in jdata";
			if (sentry.jdata_type === "dflow" && memberFunc !== undefined)
				throw (
					"function reduction cannot be applied on dflows (broadcasters) " +
					left.child(0).ctorName
				);
			if (sentry.jdata_type === "uflow" || sentry.jdata_type === "shuffler") {
				if (sentry.type_spec === "char*") {
					str = "lgg." + left.sourceString + ".lastValue()";
				} else {
					flowname = "__" + left.sourceString + "Flow";
					funcname += generateFlowDecl(
						left.sourceString,
						flowname,
						right.sourceString
					);
					if (memberFunc === undefined)
						str = writeMemFunc(flowname, right.sourceString, "avg");
					else str = writeMemFunc(flowname, right.sourceString, memberFunc);
				}
			} else {
				str =
					"bc." + left.sourceString + ".getLastValue()." + right.sourceString;
				bcaster.push(left.sourceString);
			}
			return {
				string: str,
				func: funcname,
				bcasts: bcaster,
			};
		} else {
			throw (
				"Only first level attributes allowed in jcond: " +
				left.sourceString +
				"." +
				right.sourceString
			);
		}
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
				throw (
					"function reduction cannot be applied on dflows (broadcasters) " +
					node.sourceString
				);


			if (sentry.jdata_type === "uflow" || sentry.jdata_type === "shuffler") {
				if (sentry.type_spec === "char*") {
					str = "lgg." + node.sourceString + ".lastValue()";
				} else {
					flowname = "__" + node.sourceString + "Flow";
					funcname += generateFlowDecl(node.sourceString, flowname, null);
					if (memberFunc === undefined)
						str = writeMemFunc(flowname, null, "avg");
					else str = writeMemFunc(flowname, null, memberFunc);
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
			if (left.sourceString === "jsys.type") {
				throw "Cannot have jsys.type as both sides of expression";
			} else {
				var temp = right;
				right = left;
				left = temp;
			}
		}
		if (left.sourceString === "jsys.type") {
			if (op.sourceString === "==") {
				if (right.sourceString === '"device"') {
					code = 1;
				} else if (right.sourceString === '"fog"') {
					code = 2;
					maxLevel = Math.max(maxLevel, 2);
				} else if (right.sourceString === '"cloud"') {
					code = 4;
					maxLevel = Math.max(maxLevel, 3);
				}
			} else if (op.sourceString === "!=") {
				if (right.sourceString === '"device"') {
					code = 6;
				} else if (right.sourceString === '"fog"') {
					code = 5;
					maxLevel = Math.max(maxLevel, 2);
				} else if (right.sourceString === '"cloud"') {
					code = 3;
					maxLevel = Math.max(maxLevel, 3);
				}
			} else {
				throw "Operator " + op.sourceString + " not compatible with jsys.type";
			}
		} else if (left.sourceString === "jsys.sync") {
			if (op.sourceString === ">=" || op.sourceString === "==") {
				if (
					right.child(0).ctorName === "literal" &&
					Number(right.sourceString) > 0
				) {
					code = code | 8;
				}
			}
		} else if (
			left.child(0).ctorName !== "literal" ||
			right.child(0).ctorName !== "literal"
		) {
			code = code | 16;
		}

		return {
			string: 'jcondContext("' +
				left.jamJSTranslator.string +
				'") ' +
				op.sourceString +
				" " +
				right.jamJSTranslator.string,
			code: code,
			cback: cback,
			func: left.jamJSTranslator.func + right.jamJSTranslator.func,
			bcasts: mergeElements(
				left.jamJSTranslator.bcasts,
				right.jamJSTranslator.bcasts
			),
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
			if (restval.cback !== "") cback.push(restval.cback);
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
		if (id.numChildren > 0) {
			namespace = id.sourceString + ".";
		}
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
		if (jCond_spec.numChildren > 0) {
			jCond = jCond_spec.jCondTranslator[0];
		}
		const code = functionDeclaration.es5Translator;
		var specs = functionDeclaration.jamJSTranslator;

		callGraph.addTask("js", specs.fname, "sync");
		symbolTable.addTask(specs.fname, {
			language: "js",
			taskType: "sync",
			jsParams: specs.params,
			jCond: jCond,
			block: specs.block.es5Translator,
			signature: Array(specs.params.length).fill("x"),
		});
		return code;
	},
	Async_task: function (_1, jcond_spec, _2, functionDeclaration) {
		var jCond = {
			source: "true",
			code: 0,
			cback: "",
			bcasts: JSON.stringify([]),
		};
		if (jcond_spec.numChildren > 0) {
			jCond = jcond_spec.jCondTranslator[0];
		}
		const code = functionDeclaration.es5Translator;
		var specs = functionDeclaration.jamJSTranslator;
		callGraph.addTask("js", specs.fname, "async");
		symbolTable.addTask(specs.fname, {
			language: "js",
			taskType: "async",
			name: specs.fname,
			jsParams: specs.params,
			jCond: jCond,
			block: specs.block.es5Translator,
			signature: Array(specs.params.length).fill("x"),
		});
		return code;
	},
	FunctionDeclaration: function (_1, id, _2, params, _3, _4, block, _5) {
		currentFunction = id.es5Translator;
		allFunc.push(id.es5Translator);
		return {
			fname: id.es5Translator,
			params: params.jamJSTranslator,
			block: block,
		};
	},
	FormalParameterList: function (params) {
		var paramArray = [];
		if (params.child(0).ctorName === "NonemptyListOf") {
			var list = params.child(0);
			paramArray.push(list.child(0).es5Translator);
			var rest = list.child(2);
			for (var i = 0; i < rest.numChildren; i++) {
				paramArray.push(rest.child(i).es5Translator);
			}
		}
		return paramArray;
	},
	_nonterminal: function (...children) {
		var flatChildren = flattenIterNodes(children).sort(compareByInterval);
		var childResults = flatChildren.map(function (n) {
			return n.jamJSTranslator;
		});
		if (flatChildren.length === 0 || childResults.every(isUndefined)) {
			return undefined;
		}
		var code = "";
		for (var i = 0; i < flatChildren.length; ++i) {
			if (childResults[i] != null) {
				code += childResults[i];
			}
		}
		return code;
	},
	_iter: function (...children) {
		return children.map((c) => c.jamJSTranslator);
	},
	_terminal: function () {
		return this.sourceString;
	},
	NonemptyListOf: function (first, sep, rest) {
		var code = first.jamJSTranslator;
		for (var i = 0; i < rest.numChildren; i++) {
			code +=
				" " + sep.child(i).sourceString + " " + rest.child(i).jamJSTranslator;
		}
		return code;
	},

	EmptyListOf: function () {
		return "";
	},
};

es5Translator.AssignmentStatement_expression = function (left, _2, right, _4) {
	var symbol = symbolTable.get(left.es5Translator);
	if (symbol !== undefined) {
		if (symbol.jdata_type === "dflow") {
			var value;
			// Convert value to a string
			if (symbol.type_spec === "char*") {
				value = `String(${right.es5Translator})`;
			} else {
				value = `String(Number(${right.es5Translator}))`;
			}
			return `jman.broadcastMessage("${left.es5Translator}", ${value});`;
		} else if (
			symbol.jdata_type === "uflow" ||
			symbol.jdata_type === "shuffler"
		) {
			throw `Cannot write to ${symbol.jdata_type} var ${left.es5Translator} from javascript`;
		}
	}

	let rightString = right.es5Translator;
	if (isFunctionCall(right)) {
		const functionName = rightString.slice(0, rightString.indexOf("(")).trim();
		if (symbolTable.getTask(functionName) !== undefined) {
			const functionParams = rightString
				.slice(rightString.indexOf("(") + 1, rightString.indexOf(")"))
				.trim();
			const functionInfo = symbolTable.getTask(functionName);
			if (functionInfo.language === "c") {
				rightString = rightString.replace(
					/[a-zA-Z0-9]+\(.*\)/g,
					`${
            functionInfo.taskType === "async"
              ? "__worklib.remoteExecNoRV"
              : "__worklib.remoteExecRV"
          }("${functionName}", "x" ${
            functionParams.length > 0 ? ", " + functionParams : ""
          })`
				);
			} else if (functionInfo.language === "j") {
				rightString = rightString.replace(
					/[a-zA-Z0-9]+\(.*\)/g,
					`${
            functionInfo.taskType === "async"
              ? "local_jtask_nv"
              : "local_jtask"
          }(cnode, "${functionName}${
            functionParams.length > 0 ? ", " + functionParams : ""
          }")`
				);
			}
		}
	}

	return left.es5Translator + " = " + rightString + ";";
};

es5Translator.CallExpression_memberExpExp = function (exp, args) {
	let res = exp.es5Translator + args.es5Translator;

	if (exp.sourceString === "require") {
		var moduleName = args.child(1).sourceString.slice(1, -1);
		try {
			require.resolve(moduleName, {
				paths: ["~/.jamruns"]
			});
		} catch (e) {
			if (e instanceof Error && e.code === "MODULE_NOT_FOUND") {
				var child_process = require("child_process");
				child_process.execSync(`npm install ${moduleName}`, {
					stdio: [0, 1, 2],
				});
			} else {
				throw e;
			}
		}
	} else if (exp.child(0).ctorName === "MemberExpression_propRefExp") {
		var namespace = exp.child(0).child(0).es5Translator;
		if (importLibs.indexOf(namespace) > -1) {
			var opr = exp.child(0).child(2).sourceString;
			var par = args.es5Translator;
			par = par.substring(par.indexOf("(") + 1, par.lastIndexOf(")"));
			var result =
				"CreateLibExec(" +
				'"' +
				namespace +
				'", "' +
				opr +
				'" , "' +
				par +
				'")';
			// uncomment this when CreateLibExec is implemented
			// return result;
			return;
		}
	}

	if (symbolTable.getTask(exp.es5Translator) !== undefined) {
		const functionParams = args.es5Translator.slice(1, -1);
		const functionName = exp.es5Translator;
		const functionInfo = symbolTable.getTask(functionName);
		if (functionInfo.language === "c") {
			res = `${
        functionInfo.taskType === "async"
          ? "__worklib.remoteExecNoRV"
          : "__worklib.remoteExecRV"
      }("${functionName}", "x" ${
        functionParams.length > 0 ? ", " + functionParams : ""
      })`;
		} else if (functionInfo.language === "js") {
			res = `${
        functionInfo.taskType === "async"
          ? "__worklib.machExecNoRV"
          : "__worklib.machExecRV"
      }("${functionName}", ${
        functionParams.length > 0 ? functionParams : ""
      })`;
		}
	}

	callGraph.addCall(
		"js",
		currentFunction,
		exp.es5Translator,
		args.es5Translator
	);
	return res;
};

es5Translator.CallExpression_callExpExp = function (exp, args) {
	if (exp.sourceString === "require") {
		var moduleName = args.child(1).sourceString.slice(1, -1);
		try {
			require.resolve(moduleName, {
				paths: ["~/.jamruns"]
			});
		} catch (e) {
			if (e instanceof Error && e.code === "MODULE_NOT_FOUND") {
				var child_process = require("child_process");
				child_process.execSync(`npm install ${moduleName}`, {
					stdio: [0, 1, 2],
				});
			} else {
				throw e;
			}
		}
	}
	callGraph.addCall(
		"js",
		currentFunction,
		exp.es5Translator,
		args.es5Translator
	);
	return exp.es5Translator + args.es5Translator;
};

function isSelectiveStatement(node) {
	return (
		node.child(0).ctorName === "Statement" &&
		node.child(0).child(0).ctorName === "IfStatement"
	);
}

function isIterativeStatement(node) {
	return (
		node.child(0).ctorName === "Statement" &&
		node.child(0).child(0).ctorName === "IterationStatement"
	);
}

function isFunctionCall(node) {
	var code = node.sourceString;
	var declarationPattern = /(.+) = ([a-zA-Z0-9]+\(.*\))/g;
	var statementPattern = /^([a-zA-Z0-9]+\(.*\));/g;

	return (
		code.match(declarationPattern) != null ||
		code.match(statementPattern) != null
	);
}

function isFunctionCall(n) {
	var code = n.sourceString;
	var declarationPattern = /(.+) = ([a-zA-Z0-9]+\(.*\))/g;
	var statementPattern = /^([a-zA-Z0-9]+\(.*\))(;?)/g;

	return (
		code.match(declarationPattern) != null ||
		code.match(statementPattern) != null
	);
}

function getFunctionNames(n) {
	var code = n.sourceString;
	var functionCallExtractionPattern = /[a-zA-Z0-9]+\(.*\)/g;

	var matches = code.match(functionCallExtractionPattern);
	return matches.map((match) => match.substring(0, match.indexOf("(")));
}

function generateJStart(mBoxDefinitions = "", conditionDefinitions = "") {
	return `
  const minicore = require('core/minicore');
  const jaminit = require('core/jaminit');
  const JAMCore = require('core/jamcore');

  ${mBoxDefinitions}
  ${conditionDefinitions}

  async function launch()
  {
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
  });
  `;
}

function generateJcondMap() {
	return `
  const conds = new Map();

  ${Array.from(jCondMap.keys())
    .map(
      (jCondTag) =>
        `conds.set("${jCondTag}", {source: \`${jCondMap.get(jCondTag)}\`});`
    )
    .join("\n")}
  `;
}

es5Translator.FunctionDeclaration = function (
	_1,
	id,
	_2,
	params,
	_3,
	_4,
	body,
	_5
) {
	var currentFunction = id.es5Translator;
	allFunc.push(id.es5Translator);
	if (params.jamJSTranslator.length === 1) {
		symbolTable.addTask(currentFunction, {
			language: "js",
			taskType: "async",
			type: "callback",
			signature: ["x"],
			jsParams: params.jamJSTranslator,
			block: body.es5Translator,
		});
	}
	symbolTable.addFunction(currentFunction, "js");
	callGraph.addFunction("js", currentFunction);

	var functionBodyResults = [];
	var currMilestone = milestone.getAMilestoneNumber();
	functionBodyResults.push(milestone.getJCodeToEmitMilestone(currMilestone));

	// Push all the directives to the results.
	functionBodyResults.push(body.child(0).es5Translator.join("\n"));

	// Tranlsate all the source elements, i.e., statements and expressions.
	for (var node of body.child(1).children) {
		var currResult = node.es5Translator;
		functionBodyResults.push(currResult);

		if (isIterativeStatement(node) || isSelectiveStatement(node)) {
			currMilestone = milestone.getAMilestoneNumber();
			functionBodyResults.push(
				milestone.getJCodeToEmitMilestone(currMilestone)
			);
		} else if (isFunctionCall(node)) {
			var functionNames = getFunctionNames(node);
			milestone.registerFunctionsForMilestone(currMilestone, functionNames);
		}
	}

	var result = `function ${id.es5Translator}(${
    params.es5Translator
  }) {\n${functionBodyResults.join("\n")}}`;
	return result;
};

es5Translator.FunctionExpression_named = function (
    _1,
	id,
	_2,
	params,
	_3,
	_4,
	body,
	_5
) {
	currentFunction = id.es5Translator;
	allFunc.push(id.es5Translator);
	symbolTable.addFunction(currentFunction, "js");
	callGraph.addFunction("js", currentFunction);

	var functionBodyResults = [];
	var currMilestone = milestone.getAMilestoneNumber();
	functionBodyResults.push(milestone.getJCodeToEmitMilestone(currMilestone));

	// Push all the directives to the results.
	functionBodyResults.push(body.child(0).es5Translator.join("\n"));

	// Tranlsate all the source elements, i.e., statements and expressions.
	for (var node of body.child(1).children) {
		var currResult = node.es5Translator;
		functionBodyResults.push(currResult);

		if (isIterativeStatement(node) || isSelectiveStatement(node)) {
			currMilestone = milestone.getAMilestoneNumber();
			functionBodyResults.push(
				milestone.getJCodeToEmitMilestone(currMilestone)
			);
		} else if (isFunctionCall(node)) {
			var functionNames = getFunctionNames(node);
			milestone.registerFunctionsForMilestone(currMilestone, functionNames);
		}
	}

	var result = `function ${id.es5Translator}(${
    params.es5Translator
  }) {\n${functionBodyResults.join("\n")}}`;
	return result;
};

es5Translator.FunctionExpression_anonymous = function (
	_1,
	_2,
	params,
	_3,
	_4,
	body,
	_5
) {
	currentFunction = "anonymous";
	symbolTable.addFunction(currentFunction, "js");
	callGraph.addFunction("js", currentFunction);

	var functionBodyResults = [];
	var currMilestone = milestone.getAMilestoneNumber();
	functionBodyResults.push(milestone.getJCodeToEmitMilestone(currMilestone));

	// Push all the directives to the results.
	functionBodyResults.push(body.child(0).es5Translator.join("\n"));

	// Tranlsate all the source elements, i.e., statements and expressions.
	for (var node of body.child(1).children) {
		var currResult = node.es5Translator;
		functionBodyResults.push(currResult);

		if (isIterativeStatement(node) || isSelectiveStatement(node)) {
			currMilestone = milestone.getAMilestoneNumber();
			functionBodyResults.push(
				milestone.getJCodeToEmitMilestone(currMilestone)
			);
		} else if (isFunctionCall(node)) {
			var functionNames = getFunctionNames(node);
			milestone.registerFunctionsForMilestone(currMilestone, functionNames);
		}
	}

	var result = `function (${
    params.es5Translator
  }) {\n${functionBodyResults.join("\n")}}`;
	return result;
};

es5Translator.VariableDeclaration = function (id, initialiser) {
	id = id.es5Translator;
	if (initialiser.child(0) !== undefined) {
		var init = initialiser.child(0).child(1);

		if (
			init.ctorName === "ConditionalExpression" &&
			isAnonymousFuncExpr(init)
		) {
			allFunc.push(id);
		}
	}
	return id + initialiser.es5Translator;
};

function isAnonymousFuncExpr(condExpr) {
	var node = condExpr;
	while (node.ctorName !== undefined) {
		if (node.ctorName === "FunctionExpression") {
			if (node.child(0).ctorName === "FunctionExpression_anonymous") {
				return true;
			}
			return false;
		}
		node = node.child(0);
	}
	return false;
}

function isUndefined(x) {
	return x === void 0;
}

// Take an Array of nodes, and whenever an _iter node is encountered, splice in its
// recursively-flattened children instead.
function flattenIterNodes(nodes) {
	var result = [];
	for (var i = 0; i < nodes.length; ++i) {
		if (nodes[i]._node.ctorName === "_iter") {
			result.push.apply(result, flattenIterNodes(nodes[i].children));
		} else {
			result.push(nodes[i]);
		}
	}
	return result;
}

// Comparison function for sorting nodes based on their source's start index.
function compareByInterval(node, otherNode) {
	return node.source.startIdx - otherNode.source.startIdx;
}
var jamjs = fs.readFileSync(path.join(__dirname, "jamjs.ohm"));
var ns = {
	ES5: ohm.grammar(
		fs.readFileSync(path.join(__dirname, "../ecmascript/es5.ohm"))
	),
};
ns.ES6 = ohm.grammar(
	fs.readFileSync(path.join(__dirname, "../ecmascript/es6.ohm")),
	ns
);

var jamJSGrammar = ohm.grammar(jamjs, ns);
var semantics = jamJSGrammar.extendSemantics(es6.semantics);

semantics.addAttribute("jamJSTranslator", jamJSTranslator);
semantics.extendAttribute("es5Translator", es5Translator);
semantics.addAttribute("jCondTranslator", jCondTranslator.jCondTranslator);

function translate(tree) {
	return semantics(tree).jamJSTranslator;
}

// Additional support functions added by Mahesh (Nov 2017)

function writeMemFunc(lsrc, rsrc, mfn) {
	var str;
	var endstr = "";
	if (rsrc !== null) endstr = "." + rsrc;

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

function mergeElements(x, y) {
	if (y !== undefined) {
		y.forEach(function (el) {
			if (!x.includes(el)) x.push(el);
		});
	}

	return x;
}

// This function prints the parse tree of the JS program
// To call this, add "printTree(jsTree._cst);" into the compile function in this file
function printTree(tree) {
	var children = tree.children;
	if (children !== undefined) {
		Object.keys(children).forEach((key) => {
			printTree(children[key]);
		});
	}
}

// End Additional support functions

module.exports = {
	compile: function (input, yieldPoint, libs) {;
		exportLibs = libs;
		if (yieldPoint) {
			es5.enableYieldPoint();
		}
		console.log("Parsing JS Files...");
		var jsTree = jamJSGrammar.match(input, "Program");
		if (jsTree.failed()) {
			throw jsTree.message;
		}
		console.log("Generating JavaScript Code...");
		return translate(jsTree);
	},
};
