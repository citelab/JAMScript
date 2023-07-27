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
const jdata = require("./jdata");
const tasks = require("./tasks");
const milestone = require("./milestone");
const astTreeWalker = require("./astTreeWalker");
const namespace = require("./namespace");

const astify = cAstMatcher.astify;
const cTranslator = cTranslatorFile.cTranslator; // TODO why though

var currentFunction = "";
var prototypes = new Map();
var jCondMap;
var mainparams = false;

const translateNamespaceAccess = {
    Source: function(node) {
        this.inDecl = 0;
        this.walk(node.content);
    },
    Prototype: null,
    Async_prototype: null,
    Sync_prototype: null,
    Type_spec: null,
    Decl_specs: null,
    Abs_declarator: null,
    Declarator: function(node) {
        this.inDecl++;
        this.walk(node.name);
        this.inDecl--;
    },
    Jamparam_decl: function(node) {
        this.inDecl++;
        this.walk(node.name);
        this.inDecl--;
    },
    Function_def: function(node) {
        symbolTable.enterScope();
        this.walk(node.decl);
        this.walk(node.body.block);
        symbolTable.exitScope();
    },
    Async_task: function(node) {
        symbolTable.enterScope();
        this.walk(node.params);
        this.walk(node.body.block);
        symbolTable.exitScope();
    },
    Sync_task: function(node) {
        symbolTable.enterScope();
        this.walk(node.params);
        this.walk(node.body.block);
        symbolTable.exitScope();
    },
    For_stmt: function(node) {
        symbolTable.enterScope();
        this.walk(node.init);
        this.walk(node.cond);
        this.walk(node.iter);
        this.walk(node.stmt);
        symbolTable.exitScope();
    },
    Compound_stmt: function(node) {
        symbolTable.enterScope();
        this.walk(node.block);
        symbolTable.exitScope();
    },
    Struct_access_expr: function(node) {
        if (node.struct.type === "id") { // Potentially namespace access
            let res = symbolTable.get(node.struct.name);
            if ((res == undefined || res.type != "local_variable") && namespace.hasNamespace(node.struct.name))
                return {type: "id", name: namespace.translateAccess(node.field.name, node.struct.name)};
        }
        this.walk(node.struct);
    },
    id: function(node) {
        if (this.inDecl == 0) {
            let res = symbolTable.get(node.name);
            if (res == undefined)
                node.name = namespace.translateAccess(node.name);
            else if (res.type == "namespace")
                throw `ERROR: cannot access namespace ${node.name} as value`;
        } else if (symbolTable.isScoped())
            symbolTable.set(node.name, {type: "local_variable"});
    },
    _default: cAstMatcher.defaultTreeWalk,
};

const insertYieldPoints = {
    Source: function(node) {
        this.yieldFunctions = new Set(["jsleep", "jyield", "task_yield", "sleep_task_create"]);
        this.loopStack = [{hasYield: true}];
        this.outerHas = [];
        this.walk(node.content);
    },
    Prototype: null,
    Async_prototype: null,
    Sync_prototype: null,
    Function_def: null, // TODO... how do we want to deal with non-jtask loops? because they could be called from user's main function &c..
    Type_spec: null,
    Decl_specs: null,
    Abs_declarator: null,
    While_stmt: yieldLoop,
    DoWhile_stmt: yieldLoop,
    For_stmt: yieldLoop,
    Expr_stmt: function(node) {
        if (this.loopStack.length > 1)
            this.walk(node.expr);
    },
    Cond_expr_cond: function(node) {
        this.walk(node.cond);
    },
    Binop_expr: function(node) {
        this.walk(node.lhs);
        if (!["&&", "||"].includes(node.op))
            this.walk(node.rhs);
    },
    Funcall_expr: function(node) {
        if (node.name.type === "id" && this.yieldFunctions.has(node.name.name)) {
            this.loopStack.at(-1).hasYield = true;
        }
    },
    If_stmt: function(node) {
        this.walk(node.cond);
        this.outerHas.push(this.loopStack.at(-1).hasYield);
        this.walk(node.stmt);
        if (node.else) {
            this.loopStack.at(-1).hasYield &= this.outerHas.at(-1);
            this.walk(node.else);
        }
        this.loopStack.at(-1).hasYield &= this.outerHas.pop();
    },
    Switch_stmt: function(node) {
        this.walk(node.cond);
        this.outerHas.push(this.loopStack.at(-1).hasYield);
        this.walk(node.stmt);
        this.loopStack.at(-1).hasYield &= this.outerHas.pop();
    },
    Case_stmt: function(node) { // this deals with branching into switch statements
        if (this.outerHas.length > 0)
            this.loopStack.at(-1).hasYield &= this.outerHas.at(-1);
        this.walk(node.cond);
        this.walk(node.stmt);
    },
    Default_stmt: function(node) { // this deals with branching into switch statements
        if (this.outerHas.length > 0)
            this.loopStack.at(-1).hasYield &= this.outerHas.at(-1);
        this.walk(node.stmt);
    },
    Label_stmt: function(node) { // who knows where we got here from
        this.loopStack.at(-1).hasYield = false;
        this.walk(node.stmt);
    },
    Goto_stmt: function(node) {
        if (!this.loopStack.at(-1).hasYield)
            return [astify("task_yield();", "Expr_stmt"), node];
    },
    Continue_stmt: function(node) {
        console.log("found continue statement");
        if (!this.loopStack.at(-1).hasYield) {
            console.log("inserting yield in continue");
            return [astify("task_yield();", "Expr_stmt"), node];
        }
    },
    _default: cAstMatcher.defaultTreeWalk,
};
function yieldLoop(node) {
    this.loopStack.push({hasYield: false});
    if(node.type === "For_stmt") {
        this.walk(node.init);
        this.walk(node.iter);
    }
    this.walk(node.cond);
    this.walk(node.stmt);
    if (!this.loopStack.pop().hasYield)
        node.stmt.block.push(astify("task_yield();", "Expr_stmt")); // TODO do we have a yield
}

const jamArrayTranslator = { // TODO we want to make the expressions for accessing array nicer
    Source: function(node) {
        this.inJamarray = false;
        this.stringArray = false;
        console.log(node.content);
        var content = this.walk(node.content);
        var arrayDefs = types.generateArrayDefs();
        node.content = arrayDefs.concat(content);
    },
    Jamtype_return_Array: function(node) {
        var jamtype = types.stringifyType(node.jamtype);
        var atype = types.registerArrayType(jamtype, node.array);
        // TODO... this actually returns void and we copy into array in funciton body? or what?
    },
    Jamarray_decl: function(node) {
        this.inJamarray = true;
        var inits = [];
        var jamtype = types.stringifyType(node.jamtype);
        if (jamtype === "char" || jamtype == "unsigned char")
            this.stringArray = true;
        for (var decl of node.decls) {
            var init = this.walk(decl);
            var atype = types.registerArrayType(jamtype, init.size);
            var e;
            if (init.initlen > 0) {
                if (init.initlen > init.size)
                    throw `ERROR: cannot initialize jarray ${init.name} as initializer is larger than array`
                e = astify(`NVOID_STATIC_INIT(${[init.name, atype, 0, init.size, init.initlen]});`, "Expr_stmt");
                e.expr.args.push(init.init);
            } else
                e = astify(`NVOID_STATIC_INIT_EMPTY(${[init.name, atype, 0, init.size]});`, "Expr_stmt");
            e.expr.args[2] = jamtype;
            inits.push(e);
        }
        this.inJamarray = false;
        this.stringArray = false;
        return inits;
    },
    Jamarray_init: function(node) {
        if (node.init != null) {
            node.initlen = this.walk(node.init).initlen;
        } else
            node.initlen = 0;
        return node;
    },
    Initializer_list: function(node) {
        if (this.inJamarray) {
            node.initlen = 0;
            var cur = 0;
            if (node.inits[0].type !== "Init_field_Designated") // Guarantee non-full size designators allowed
                node.inits[0] = {
                    type: "Init_field_Designated",
                    desigs: [{
                        type: "Desig_field_Array",
                        start: {type: "number", value: 0},
                        end: null,
                    }],
                    init: node.inits[0],
                };
            for (var init of node.inits) {
                if (init.type === "Init_field_Designated") {
                    if (init.desigs[0].type === "Desig_field_Array") {
                        var arr = init.desigs[0];
                        var end = arr.end || arr.start;
                        if (end.type !== "number") // TODO we should allow for constant-value expressions
                            throw "ERROR: could not recognize designated init with non-constant-integer value";
                        cur = BigInt(end.value) + BigInt(1); // TODO things can break this: char literals, floats
                    } else
                        throw "ERROR: cannot use struct fields to initialize jamarray"
                    this.walk(init.init);
                } else {
                    cur++;
                    this.walk(init);
                }
                if (cur > node.initlen)
                    node.initlen = cur;
            }
            if (this.stringArray)
                node.inits.push({type: "number", value: "'\\0'"});
        } else
            this.walk(node.inits);
        return node;
    },
    string: function(node) {
        if (this.inJamarray) {
            var inString = false;
            node.initlen = 0;
            for (var i = 0; i < node.value.length; i++) {
                if (inString && node.value[i] !== '"')
                    node.initlen++;
                if (node.value[i] == '"')
                    inString = !inString;
                else if (node.value[i] == '\\') {
                    var j = 0;
                    do {
                        i++;
                    } while("01234567".includes(node.value[i]) && ++j < 3);
                    if (j == 0 && !"\'\"?\\abfnrtv".includes(node.value[i]))
                        throw `ERROR: unrecognized escape code in jarray allocation '\\${node.value[i]}'`;
                }
            }
        }
        return node;
    },
    _default: cAstMatcher.defaultTreeWalk,
};


const jamCTranslator = {
    Source: function (node) {
        this.prototypes = [];
        let bodies = this.walk(node.content);
        node.content = bodies.concat(this.prototypes);
        return node;
    },
		const cWrapper = tasks.createCTaskWrapperInC(rtype, funcname, params);
        // We create the function itself before the wrapper... because the wrapper calls the function... we also need to have a prototype, in case there are recursive calls of the function to itself... which would look like function calling wrapper which calls function after translation
        // We need to translate the funciton body to convert function calls to call the appropriate function...
        // The local_sync_call for synchronous tasks
        // Also we need to do our type translation...
	},
	Async_task: function (node) {
		const cWrapper = tasks.createCTaskWrapperInC("void", funcname, params);
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
};

let __cTranslator = {};

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

__cTranslator.Compound_stmt = function (_1, stmts, _2, _3) {
	var currMilestone = milestone.getAMilestoneNumber();
	code.push(milestone.getCCodeToEmitMilestone(currMilestone));
	for (var i = 0; i < stmts.numChildren; i++) {
		var currChild = stmts.child(i);

		// Rename jtask calls.
		if (isFunctionCall(currChild) && symbolTable.getTask(currResult.slice(0, currResult.indexOf("("))) !== undefined) {
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
    for (let [key, val] of jCondMap) // generate jconds
        block.push(astify(`jcond_define("${key}","${val}")`));
    for (const [name, values] of symbolTable.tasks.c) { // register functions
        let ts = `"${values.codes.join("")}"`;
        let jt = `"${values.jCond.tag || ""}"`;
        block.push(astify(`tboard_register_func(cnode->tboard,TBOARD_FUNC("${name}",call_${name},${ts},${jt},PRI_BATCH_TASK));`, "Expr_stmt"));
    }
    let mainfunc = namespace.translateAccess("main", namespace.currentName);
    block.push(astify("${mainfunc}(argc,argv);", "Expr_stmt"));
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

    ast.content.push(generate_taskmain(hasJ));
}

module.exports = {
	semanticAnalyze: function (input, offset) {
        let ast = cAstMatcher.fromUserInput(input, offset, "cst.dot");


        console.log("blockifying");
        astTreeWalker(preCompilationC.blockifyStatements).walk(ast);

        // TODO once we have namespace from the jside
        namespace.currentNamespace = "japp";
        symbolTable.set("japp", {type: "namespace"});

        console.log("function reg");
		astTreeWalker(preCompilationC.registerGlobals).walk(ast);
        console.log("--------------------------------ok--------------------------------------------");
        return ast;
	},
	compile: function (ast, offset, yieldPoint, libs, jCond, hasJdata) {
		jCondMap = jCond;
		//exportLibs = libs;
		console.log("Generating C code...");

        console.log("translating namespaces");
        astTreeWalker(translateNamespaceAccess).walk(ast);

        if (yieldPoint) {
            console.log("inserting yield points");
            astTreeWalker(insertYieldPoints).walk(ast);
        }

        console.log("expanding arrays");
        astTreeWalker(jamArrayTranslator).walk(ast);

        //translate(ast, hasJdata);

        console.log("printing dot");
        // TODO compiler option for printing trees
        printAst(ast, "ast.dot");

        console.log("printing code");
        console.log(astTreeWalker(cTranslator).walk(ast));
	},
    jamCTranslator: jamCTranslator,
};
