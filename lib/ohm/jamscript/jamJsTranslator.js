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
        this.jreuse = [];
        this.jreusefunctions = [];
        let userFunc = astify('async function user_program(){}', "Declaration");
        userFunc.body.content = this.walk(node.content);

        let newContent = [
            astify(`const __worklib = require('modules/jworklib');`, "Statement"),
            astify(`const __datalib = require('modules/jdatalib');`, "Statement"),
            astify(`const jsys = __worklib.getjsys();`, "Statement"),
        ];
        let progInit = [
            astify(`await __worklib.init(x => __datalib.updateUServers(x, jsys.id, jsys.app));`, "Statement"),
            astify(`jsys.jreusefunctions = {${this.jreusefunctions}};`, "Statement"),
            astify(`jsys.jreuse = {${this.jreuse}};`, "Statement"),
        ];


        if (this.hasJdata) {
            progInit.push(astify(`let __redserv = __datalib.createRedis(jsys.redis.host, jsys.redis.port);`, "Statement"));
            progInit.push(astify(`let __myid = await __datalib.getId(__redserv, jsys.id);`, "Statement"));
            progInit.push(astify(`let __appid = await __datalib.getAppId(__redserv, jsys.app);`, "Statement"));
            progInit.push(astify(`await __datalib.configureMainRedis(__redserv, jsys.redis.host, jsys.redis.port, __appid, () => { __worklib.notifyRedis(jsys.redis.host, jsys.redis.port); });`, "Statement"));
        }


        progInit.push(astify(`const conds = new Map();`, "Statement"));
        for (var [jCondTag, jcsrc] of this.jconds)
            progInit.push(astify(`conds.set("${jCondTag}", ${jcsrc});`, "Statement"));

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
    Async_task: generateTask,
    Sync_task: generateTask,
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
                        prop: null,
                    };
                    var args = [{type: "stringLiteral", value: `"${namespacedName}"`}];
                    if (functionInfo.language === "c") {
                        worklibName.prop = functionInfo.type === "Async_task" ? "remoteExecNoRV" : "remoteExecRV";
                        args.push({type: "stringLiteral", value: `"${functionInfo.codes}"`});
                    } else if (functionInfo.language === "js")
                        worklibName.prop = functionInfo.type === "Async_task" ? "machExecNoRV" : "machExecRV";
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
    Jcond_decl: function(node) {
        let nds = [];
        for (var decl of node.decls) {
            if (node.jtype === "jreuse") {
                nds.push(astify(`jsys.jreusefunctions.${decl.name.name} = function(${decl.first.name}, ${decl.second.name}) {};`, "Statement"));
                nds.at(-1).expr.rhs.body = this.walk(decl.body);
            } else {
                nds.push(astify(`function ${decl.namespaced_name}(${decl.first.name}, ${decl.second.name}) {}`, "Declaration"));
                nds.at(-1).body = this.walk(decl.body);
                this.jconds.set(decl.name.name, decl.namespaced_name);
            }
        }
        return nds;
    },
    _default: jsAstMatcher.defaultTreeWalk,
};

function generateTask(node) {
    let body = this.walk(node.body);
    if (node.jtask_attr.reuse || node.jtask_attr.reuse_history) {
        let reusebody = [];
        let reuse = node.jtask_attr.reuse ? node.jtask_attr.reuse.name : "default";
        let reuse_history = node.jtask_attr.reuse_history || 1;
        let func;
        if (reuse === "default") {
            let conds = [];
            for (var [index, param] of node.params.entries()) {
                if (param.array) {
                    conds.push(`news.arg_${index}.length === olds.arg_${index}.length`);
                    conds.push(`news.arg_${index}.every((e, i) => e === olds.arg_${index}[i])`);
                } else
                    conds.push(`news.arg_${index} === olds.arg_${index}`);
            }
            reusebody.push(astify(`let __jsys__reuse_cmp = function(olds, news) {
                                     return ${conds.join("&&")};
                                   };`, "SourceElement"));
            func = `__jsys__reuse_cmp`
        } else
            func = `jsys.jreusefunctions.${reuse}`;
        this.jreuse.push(`${node.name}: {
                            buf: [],
                            res: [],
                            ind: 0,
                            cnt: 0,
                          }`);
        reusebody.push(astify(`let __jsys__jrn = new Map(new Array(arguments).map((e, i) => ["arg_" + i, e[i]]));`, "SourceElement"));
        reusebody.push(astify(`for (let __jsys__jreui = jsys.jreuse.${node.name}.ind; __jsys__jreui < jsys.jreuse.${node.name}.ind + jsys.jreuse.${node.name}.cnt; __jsys__jreui++) {
                                 if (${func}(jsys.jreuse.${node.name}.buf[__jsys__jreui % ${reuse_history}], __jsys__jrn)) {
                                   return jsys.jreuse.${node.name}.res[__jsys__jreui % ${reuse_history}];
                                 }
                               }`, "Statement"));
        let anonfunc = astify(`let __jsys__taskfunc = function(${node.params.map((p) => p.name.name)}) {};`, "SourceElement");
        anonfunc.decls[0].init.value.body = body

        reusebody.push(anonfunc);
        reusebody.push(astify(`let __jsys__retval = await __jsys__taskfunc(${node.params.map((p) => p.name.name)});`, "SourceElement"));
        reusebody.push(astify(`jsys.jreuse.${node.name}.ind = (${reuse_history} + jsys.jreuse.${node.name}.ind - 1) % ${reuse_history};`, "Statement"));
        reusebody.push(astify(`if (jsys.jreuse.${node.name}.cnt < ${reuse_history}) {
                                 jsys.jreuse.${node.name}.cnt++;
                               }`, "Statement"));
        reusebody.push(astify(`jsys.jreuse.${node.name}.buf[jsys.jreuse.${node.name}.ind] = __jsys__jrn;`));
        reusebody.push(astify(`jsys.jreuse.${node.name}.res[jsys.jreuse.${node.name}.ind] = __jsys__retval;`, "Statement"));
        reusebody.push(astify(`return __jsys__retval;`, "Statement"));

        body = {
            type: "FunctionBody",
            directives: [],
            content: reusebody,
        };
    }
    return {
        type: "AsyncFunctionDeclaration",
        name: node.name,
        params: node.params.map((p) => p.name),
        body: body,
    };
}


function generateMbox(jsTasks, inJStart=false) {
    var body = [astify(`const mbox = new Map();`, "Statement")];
    for (var [key, task] of jsTasks) { // TODO jcond
        const hasret = task.type === 'Sync_task';
        const mboxName = inJStart ? `"${task.name}"` : task.name;
        const resultString = hasret ? types.get(task.return_type).c_code : "";
        const cond = task.jcond ? task.jcond.name : "";
        body.push(astify(`mbox.set("${task.namespace_name}", {func: ${mboxName}, arg_sig: "${task.codes}", side_eff: true, results: ${hasret}, res_sig: "${resultString}", reuse: false, cond: "${cond}"});`, "Statement"));
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
    semanticAnalyze: function(input, verbosity) {
        let ast = jsAstMatcher.fromUserInput(input);
        //console.log("blockifying statements");
        preCompilationJs.setVerbosity(verbosity > 0);
        astTreeWalker(preCompilationJs.blockifyStatements).walk(ast);
        //console.log("processing jamnifest");
        astTreeWalker(preCompilationJs.processManifest).walk(ast);
        //console.log("registering globals");
        astTreeWalker(preCompilationJs.registerGlobals).walk(ast);
        return ast;
    },
    compile: function (ast, verbosity) {

        if (verbosity) console.log("[JS] Generating Code...");
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
