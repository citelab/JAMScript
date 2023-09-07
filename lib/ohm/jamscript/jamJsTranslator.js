/* eslint-env node */
"use strict";

const symbolTable = require("./symbolTable");
const tasks = require("./tasks");
const namespace = require("./namespace");
const types = require("./types");
const jsAstMatcher = require("./jsAstMatcher");
const preCompilationJs = require("./preCompilationJs");
const astTreeWalker = require("./astTreeWalker");
const printAst = require("./astPrint").printAst;
const jsTranslator = astTreeWalker(require("../ecmascript/es5").jsTranslator);
const astify = jsAstMatcher.astify;

const jamJsTranslator = {
    Source: function (node) {
        this.hasJdata = false;
        this.jconds = new Map();
        let userFunc = astify('async function user_program(){}', "Declaration");
        userFunc.body.content = this.walk(node.content);

        let newContent = [
            astify(`const __worklib = require('modules/jworklib');`, "Statement"),
            astify(`const __datalib = require('modules/jdatalib');`, "Statement"),
            astify(`const jsys = __worklib.getjsys();`, "Statement"),
        ];

        let progInit = [astify(`await __worklib.init((x)=>{ __datalib.updateUServers(x, jsys.id, jsys.app); });`, "Statement")];


        if (this.hasJdata) {
            progInit.push(astify(`let __redserv = __datalib.createRedis(jsys.redis.host, jsys.redis.port);`, "Statement"));
            progInit.push(astify(`let __myid = await __datalib.getId(__redserv, jsys.id);`, "Statement"));
            progInit.push(astify(`let __appid = await __datalib.getAppId(__redserv, jsys.app);`, "Statement"));
            progInit.push(astify(`await __datalib.configureMainRedis(__redserv, jsys.redis.host, jsys.redis.port, __appid, () => { __worklib.notifyRedis(jsys.redis.host, jsys.redis.port); });`, "Statement"));
        }


        progInit.push(astify(`const conds = new Map();`, "Statement"));
        // for (var [jCondTag, jcsrc] of this.jconds)
        //     progInit.push(astify(`conds.set("${jCondTag}", {source: \`${jcsrc}\`});`, "Statement"));

        progInit.push(astify(`__worklib.registerConds(conds);`, "Statement"));

        progInit = progInit.concat(generateMbox(symbolTable.tasks.js, false));
        progInit.push(astify(`__worklib.registerFuncs(mbox);`, "Statement"));

        // TODO jsys.setMilestoneCount(...) in program initiator

        userFunc.body.content = progInit.concat(userFunc.body.content);

        newContent.push(userFunc);
        newContent.push(astify(`user_program().then(()=>{console.log("Program completed.");}).catch((e)=> {console.error("Program error! ", e);});`, "Statement"));

        node.content = newContent;

        const jstartMbox = jsTranslator.walk({type: "Source", content: generateMbox(symbolTable.tasks.js, true), directives: []});
        this.jstart = generateJStart(jstartMbox);
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
            type: "AsyncFunctionDeclaration",
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
        this.hasJdata = true;
        var decls = [];
        if (node.namespace)
            decls.push(astify(`let ${node.namespace.name} = {};`, "Statement"));
        for (var jdata of node.decls) {
            var ident = node.namespace ? `${node.namespace.name}.${jdata.name.name}` : `let ${jdata.name.name}`;
            decls.push(astify(`${ident} = await __datalib.create${jdata.jflow}(__redserv, "${jdata.namespace_name}", __myid, __appid);`, "Statement"));
        }
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


function generateMbox(jsTasks, inJStart=false) {
    var body = [astify(`const mbox = new Map();`, "Statement")];
    for (var [key, task] of jsTasks) { // TODO jcond
        const hasret = task.type === 'Sync_task';
        const mboxName = inJStart ? `"${task.name}"` : task.name;
        const resultString = hasret ? types.get(task.return_type).c_code : "";
        body.push(astify(`mbox.set("${task.namespace_name}", {func: ${mboxName}, arg_sig: "${task.codes}", side_eff: true, results: ${hasret}, res_sig: "${resultString}", reuse: false, cond: ""});`, "Statement"));
    }
    return body;
}

function generateJStart(mBoxDefinitions) {
    return `const minicore = require('core/minicore');
const jaminit = require('core/jaminit');
const JAMCore = require('core/jamcore');
${mBoxDefinitions}
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

module.exports = {
    semanticAnalyze: function(input) {
        let ast = jsAstMatcher.fromUserInput(input);
        //console.log("blockifying statements");
        astTreeWalker(preCompilationJs.blockifyStatements).walk(ast);
        //console.log("processing jamnifest");
        astTreeWalker(preCompilationJs.processManifest).walk(ast);
        //console.log("registering globals");
        astTreeWalker(preCompilationJs.registerGlobals).walk(ast);
        return ast;
    },
    compile: function (ast) {
        console.log("Generating JavaScript Code...");
        const jamTranslate = astTreeWalker(jamJsTranslator)
        ast = jamTranslate.walk(ast);
        //printAst(ast, "ast_js.dot");
        let jsout = jsTranslator.walk(ast);
        // console.log(jsout);
        return {
            JS: jsout,
            jstart: jamTranslate.jstart,
            jconds: jamTranslate.jconds,
            hasJdata: jamTranslate.hasJdata,
        };
    },
};