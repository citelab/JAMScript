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
const jsTranslator = astTreeWalker(require("../ecmascript/es5").jsTranslator);
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
            newContent.push(astify(`let __redserv = __datalib.createRedis(jsys.redis.host, jsys.redis.port);`, "Statement"));
            newContent.push(astify(`let __myid = await __datalib.getId(__redserv, jsys.id);`, "Statement"));
            newContent.push(astify(`let __appid = await __datalib.getAppId(__redserv, jsys.app);`, "Statement"));
            newContent.push(astify(`await __datalib.configureMainRedis(__redserv, jsys.redis.host, jsys.redis.port, __appid, () => { __worklib.notifyRedis(jsys.redis.host, jsys.redis.port); });`, "Statement"));
        }

        progInit = [];
        progInit.push(astify(`const conds = new Map();`, "Statement"));
        for (var {jCondTag, jcsrc} of jCondMap)
            progInit.push(astify(`conds.set("${jCondTag}", {source: \`${jcsrc}\`});`, "Statement"));
        progInit.push(astify(`__worklib.registerConds(conds);`, "Statement"));

        const jstartJconds = jsTranslator.translate({type: "Source", directives: [], content: proginit});

        progInit = progInit.concat(tasks.generateMbox(symbolTable.tasks.js, false));
        progInit.push(astify(`__worklib.registerFuncs(mbox);`, "Statement"));

        // TODO jsys.setMilestoneCount(...) in program initiator

        userFunc.body.content = progInit.concat(userFunc.body.content);

        newContent.push(userFunc);
        newContent.push(astify(`user_program().then(()=>{console.log("Program completed.");}).catch((e)=> {console.error("Program error! ", e);});`, "Statement"));

        node.content = newContent;

        const jstartMbox = jsTranslator.translate(tasks.generateMbox(symbolTable.tasks.js, true));
		return {
			JS: {jsout: node, jstart: generateJStart(jstartMbox, jstartJconds)},
			jconds: jCondMap,
			hasJdata: hasJdata,
		};
	},
    Jamnifest: function(node) {
        return [];
    },
    Async_task: function(node) { // TODO attributes
        return {
            type: "AsyncFunctionDeclaration",
            name: node.name,
            params: node.params.map((p) => p.name),
            body: this.walk(node.body),
        };
    },
    Sync_task: function(node) {
        return {
            type: "FunctionDeclaration",
            name: node.name,
            params: node.params.map((p) => p.name),
            body: this.walk(node.body),
        };
    },
    Jcond_decl: function(node) {
        throw "TODO jconds";
        return [];
    },
    Jdata_decl: function(node) {
        this.hasJData = true;
        var decls = [];
        for (var jdata of node.decls)
            decls.push(astify(`let ${jdata.name.name} = await __datalib.create${jdata.jflow}(__redserv, "${jdata.namespace_name}", __myid, __appid);`, "Statement"));
        return decls;
    },
};
var __es5Translator = {};

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
    launch().then(() => console.log("Starting App.."));`;
}

function generateMbox(jsTasks, inJStart=false) {
    var body = [astify(`const mbox = new Map()`, "Statement")];
    for (var key, {jCond, signature, taskType} of jsTasks) {
        const resultsDescriptor = taskType === 'sync';
        const encodedName = inJStart ? `"${functionName}"` : functionName;
        body.push(astify(`mbox.set("${functionName}", {func: ${encodedName}, arg_sig: "${signature}", side_eff: true, results: ${resultsDescriptor}, reuse: false, cond: "${jCond.tag ? jCond.tag : ''}"});`, "Statement"));
    }
    return body;
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
