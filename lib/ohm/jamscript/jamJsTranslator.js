/* eslint-env node */
"use strict";

const symbolTable = require("./symbolTable");
const tasks = require("./tasks");
const namespace = require("./namespace");

const jsAstMatcher = require("./jsAstMatcher");
const preCompilationJs = require("./preCompilationJs");
const astTreeWalker = require("./astTreeWalker");
const printAst = require("./astPrint").printAst;
const jsTranslator = astTreeWalker(require("../ecmascript/es5").jsTranslator);
const astify = jsAstMatcher.astify;

const jamJsTranslator = {
	Source: function (node) {
		this.hasJdata = false;
        this.jCondMap = new Map();
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

        let progInit = [];
        progInit.push(astify(`const conds = new Map();`, "Statement"));
        // for (var [jCondTag, jcsrc] of this.jCondMap)
        //     progInit.push(astify(`conds.set("${jCondTag}", {source: \`${jcsrc}\`});`, "Statement"));
        progInit.push(astify(`__worklib.registerConds(conds);`, "Statement"));

        const jstartJconds = jsTranslator.walk({type: "Source", directives: [], content: progInit});

        progInit = progInit.concat(generateMbox(symbolTable.tasks.js, false));
        progInit.push(astify(`__worklib.registerFuncs(mbox);`, "Statement"));

        // TODO jsys.setMilestoneCount(...) in program initiator

        userFunc.body.content = progInit.concat(userFunc.body.content);

        newContent.push(userFunc);
        newContent.push(astify(`user_program().then(()=>{console.log("Program completed.");}).catch((e)=> {console.error("Program error! ", e);});`, "Statement"));

        node.content = newContent;

        const jstartMbox = jsTranslator.walk(generateMbox(symbolTable.tasks.js, true));
        this.jstart = generateJStart(jstartMbox, jstartJconds);
		return node;
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
    FuncallExpr: function(node) {
        node.args = this.walk(node.args);
        if (node.name.type === "identifier") {
            var funcName = node.name.name;
            if (funcName === "require") {
                if (node.args[0].type !== "stringLiteral")
                    throw "ERROR: Expected string argument in require function"
                var moduleName = node.args[0].value.slice(1, -1);
                try {
			        require.resolve(moduleName, {paths: ["~/.jamruns"]});
		        } catch (e) {
			        throw `ERROR: Module ${moduleName} not found`;
		        }
            } else {
                var namespacedName = namespace.translateAccess(funcName);
                var functionInfo = symbolTable.getTask(namespacedName);
                if (functionInfo) {
                    var worklibName = {
                        type: "PropAccessExpr",
                        obj: {type: "identifier", name: "__worklib"},
                        prop: {type: "identifier", name: null},
                    };
                    var args = [{type: "stringLiteral", value: `"${namespacedName}"`}];
                    if (functionInfo.language === "c") {
                        worklibName.prop.name = functionInfo.type === "Async_task" ? "remoteExecNoRV" : "remoteExecRV";
                        args.push({type: "stringLiteral", value: `"${funcInfo.codes}"`});
		            } else if (functionInfo.language === "js")
                        worklibName.prop.name = functionInfo.type === "Async_task" ? "machExecNoRV" : "machExecRV";
                    return {
                        type: "FuncallExpr",
                        name: worklibName,
                        args: args.concat(node.args),
                    };
                }
            }
        } else
            node.name = this.walk(node.name);
        return node;
    },
    _default: jsAstMatcher.defaultTreeWalk,
};

function generateJStart(mBoxDefinitions, conditionDefinitions) {
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
    var body = [astify(`const mbox = new Map();`, "Statement")];
    for (var [key, task] of jsTasks) { // TODO jcond
        console.log(task);
        const resultsDescriptor = task.type === 'Sync_task';
        const mboxName = inJStart ? `"${task.name}"` : task.name;
        body.push(astify(`mbox.set("${task.namespace_name}", {func: ${task.name}, arg_sig: "${task.codes}", side_eff: true, results: ${resultsDescriptor}, reuse: false, cond: ""});`, "Statement"));
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
        return ast;
    },
    compile: function (ast) {
        console.log("Generating JavaScript Code...");
        const jamTranslate = astTreeWalker(jamJsTranslator)
        ast = jamTranslate.walk(ast);
        console.log("printing ast (js)");
        printAst(ast, "ast_js.dot");
        console.log("(js) Converting ast to string");
        let jsout = jsTranslator.walk(ast);
        console.log(jsout);
        return {
            JS: {
                jsout: jsout,
                jstart: jamTranslate.jstart,
            },
            jconds: jamTranslate.jCondMap,
            hasJdata: jamTranslate.hasJdata,
        };
    },
};
