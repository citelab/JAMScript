/* eslint-env node */
"use strict";
const cTranslator = require("../c/c").cTranslator;
const cAstMatcher = require("./cAstMatcher");
const printAst = require("./astPrint").printAst;
const preCompilationC = require("./preCompilationC");
const symbolTable = require("./symbolTable");
const types = require("./types");
const jdata = require("./jdata");
const tasks = require("./tasks");
const astTreeWalker = require("./astTreeWalker");
const namespace = require("./namespace");
const callGraph = require("./callGraph");

const astify = cAstMatcher.astify;

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
        return node;
    },
    Jamparam_decl: function(node) {
        this.inDecl++;
        this.walk(node.name);
        this.inDecl--;
        return node;
    },
    Jamarray_init: function(node) {
        this.inDecl++;
        this.walk(node.name);
        this.inDecl--;
        this.walk(node.init);
        return node;
    },
    Function_def: function(node) {
        symbolTable.enterScope();
        this.walk(node.decl);
        this.walk(node.body.block);
        symbolTable.exitScope();
        return node;
    },
    Function_decl: function(node) {
        this.walk(node.params);
        return node;
    },
    Async_task: function(node) {
        symbolTable.enterScope();
        this.walk(node.params);
        this.walk(node.body.block);
        symbolTable.exitScope();
        return node;
    },
    Sync_task: function(node) {
        symbolTable.enterScope();
        this.walk(node.params);
        this.walk(node.body.block);
        symbolTable.exitScope();
        return node;
    },
    For_stmt: function(node) {
        symbolTable.enterScope();
        this.walk(node.init);
        this.walk(node.cond);
        this.walk(node.iter);
        this.walk(node.stmt);
        symbolTable.exitScope();
        return node;
    },
    Compound_stmt: function(node) {
        symbolTable.enterScope();
        this.walk(node.block);
        symbolTable.exitScope();
        return node;
    },
    Struct_access_expr: function(node) {
        let walked = false;
        if (node.struct.type === "Struct_access_expr") { // Nested namespace access
            node.struct = this.walk(node.struct);
            if (node.struct.type === "identifier" && namespace.hasNamespace(node.struct.name))
                return {type: "identifier", name: namespace.translateAccess(node.field.name, node.struct.name)};
            return node;
        } else if (node.struct.type === "identifier") { // Access to single namespace, or last namespace access in namespace access chain
            let res = symbolTable.get(node.struct.name);
            if ((res == undefined || res.type != "local_variable") && namespace.hasNamespace(node.struct.name))
                return {type: "identifier", name: namespace.translateAccess(node.field.name, node.struct.name)};
        }
        node.struct = this.walk(node.struct);
        return node;
    },
    identifier: function(node) {
        if (this.inDecl == 0) {
            let res = symbolTable.get(node.name);
            if (res == undefined)
                node.name = namespace.translateAccess(node.name);
            else if (res.type == "namespace")
                throw `ERROR: cannot access namespace ${node.name} as value`;
        } else if (symbolTable.isScoped())
            symbolTable.set(node.name, {type: "local_variable"});
        return node;
    },
    _default: cAstMatcher.defaultTreeWalk,
};

const insertYieldPoints = {
    Source: function(node) {
        this.yieldFunctions = new Set(["__jname__jsys__sleep", "jname__jsys__yield", "task_yield", "sleep_task_create"]);
        this.loopStack = [{hasYield: true}];
        this.outerHas = [];
        this.walk(node.content);
    },
    Prototype: null,
    Async_prototype: null,
    Sync_prototype: null,
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
        if (node.name.type === "identifier" && this.yieldFunctions.has(node.name.name)) {
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
            return [astify("__jname__jsys__yield();", "Expr_stmt"), node];
    },
    Continue_stmt: function(node) {
        console.log("found continue statement");
        if (!this.loopStack.at(-1).hasYield) {
            console.log("inserting yield in continue");
            return [astify("__jname__jsys__yield();", "Expr_stmt"), node];
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
        node.stmt.block.push(astify("__jname__jsys__yield();", "Expr_stmt"));
}

const jamArrayTranslator = { // TODO we want to make the expressions for accessing array nicer
    Source: function(node) {
        this.inJamarray = false;
        this.stringArray = false;
        node.content = this.walk(node.content);
    },
    Jamtype_return_Array: function(node) {
        var jamtype = types.stringifyType(node.jamtype);
        var atype = types.registerArrayType(jamtype, node.array);
        node.c_type = astify("struct ${atype}", "Decl_specs");
        return node;
    },
    Jamtype_return_Void: function(node) {
        node.c_type = astify("void", "Decl_specs");
        return node;
    },
    Jamtype: function(node) {
        node.c_type = astify(types.stringifyType(node), "Decl_specs");
        return node;
    },
    Jamparam_decl: function(node) {
        var jamtype = types.stringifyType(node.jamtype);
        if (node.array) {
            var atype = types.registerArrayType(jamtype, 1);
            node.c_decl = astify(`struct ${atype}* ${node.name.name}`, "Param_decl");
        } else
            node.c_decl = astify(`${jamtype} ${node.name.name}`, "Param_decl");
        return node;
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
                e = astify(`NVOID_STATIC_INIT(${[init.name.name, atype, 0, `'${types.get(node.jamtype).c_code}'`, init.size, init.initlen]});`, "Expr_stmt");
                e.expr.args.push(init.init);
            } else
                e = astify(`NVOID_STATIC_INIT_EMPTY(${[init.name.name, atype, 0, `'${types.get(node.jamtype).c_code}'`,init.size]});`, "Expr_stmt");
            e.expr.args[2] = jamtype; // Because we can't have the AST directly parse a type in the macro as a function here
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
                        start: {type: "numericLiteral", value: 0},
                        end: null,
                    }],
                    init: node.inits[0],
                };
            for (var init of node.inits) {
                if (init.type === "Init_field_Designated") {
                    if (init.desigs[0].type === "Desig_field_Array") {
                        var arr = init.desigs[0];
                        var end = arr.end || arr.start;
                        if (end.type !== "numericLiteral") // TODO we should allow for constant-value expressions
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
                node.inits.push({type: "numericLiteral", value: "'\\0'"});
        } else
            this.walk(node.inits);
        return node;
    },
    stringLiteral: function(node) {
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
        node.content = this.walk(node.content);
        return node;
    },
    Async_prototype: function(node) {
        return {
            type: "Prototype",
            return_type: astify("void", "Decl_specs"),
            pointer_list: null,
            name: {type: "identifier", name: node.name},
            params: node.params.map(p => p.c_decl),
        };
    },
    Sync_prototype: function(node) {
        return {
            type: "Prototype",
            return_type: node.return_type.c_type,
            pointer_list: null,
            name: {type: "identifier", name: node.name},
            params: node.params.map(p => p.c_decl),
        };
    },
    Async_task: function(node) {
        return {
            type: "Function_def",
            return_type: astify("void", "Decl_specs"),
            decl: {
                type: "Declarator",
                pointer_list: null,
                name: {
                    type: "Function_decl",
                    name: {type: "identifier", name: node.name},
                    params: node.params.map(p => p.c_decl),
                },
            },
            body: this.walk(node.body),
        };
    },
    Sync_task: function(node) {
        return {
            type: "Function_def",
            return_type: node.return_type.c_type,
            decl: {
                type: "Declarator",
                pointer_list: null,
                name: {
                    type: "Function_decl",
                    name: {type: "identifier", name: node.name},
                    params: node.params.map(p => p.c_decl),
                },
            },
            body: this.walk(node.body),
        };
    },
    Funcall_expr: function(node) {
        node.args = this.walk(node.args);
        if (node.name.type === "identifier") {
            let task = symbolTable.getTask(node.name.name);
            if (task != undefined ) {
                if (task.language === "c") {
                    if (task.type === "Async_task") {
                        let newNode = astify(`local_async_call(cnode->tboard, "${task.name}")`, "Expr");
                        newNode.args = newNode.args.concat(types.castRemoteArgs(node.args, task.params));
                        node = newNode;
                    } else
                        node.args = types.castLocalArgs(node.args, task.params);
                } else
                    node.args = types.castRemoteArgs(node.args, task.params);
            }
        }
        return node;
    },
    _default: cAstMatcher.defaultTreeWalk,
};

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
    // for (const [key, val] of jCondMap) // generate jconds
    //     block.push(astify(`jcond_define("${key}","${val}")`));
    for (const [name, values] of symbolTable.tasks.c) { // register functions
        let ts = `"${values.codes}"`;
        let jt = `""`; // TODO jcond
        block.push(astify(`tboard_register_func(cnode->tboard,TBOARD_FUNC("${name}",wrapper_${name},${ts},${jt},PRI_BATCH_TASK));`, "Expr_stmt"));
    }
    let mainfunc = namespace.translateAccess("main", namespace.currentName);
    block.push(astify(`${mainfunc}(argc,argv);`, "Expr_stmt"));
    block.push(astify("cnode_stop(cnode);", "Expr_stmt"));
    block.push(astify("cnode_destroy(cnode);", "Expr_stmt"));

    func.body.block = block;
    return func;
}

function translate(ast, hasJ) {
    let decls = types.generateDefs();
    decls = hasJ ? jdata.createCVariables(symbolTable.jdata, decls) : decls;
    decls.push(astify("cnode_t* cnode;", "Decl"));
    for (const jTask of symbolTable.tasks.js.values())
        decls.push(tasks.createJsTaskWrapperInC(jTask));
    astTreeWalker(jamCTranslator).walk(ast);

    ast.content = decls.concat(ast.content);
    for (const cTask of symbolTable.tasks.c.values())
        ast.content.push(tasks.createCTaskWrapperInC(cTask));
    ast.content.push(generate_taskmain(hasJ));
}

module.exports = {
	semanticAnalyze: function (input, offset) {
        let ast = cAstMatcher.fromUserInput(input, offset, "cst_c.dot");

        //console.log("blockifying");
        astTreeWalker(preCompilationC.blockifyStatements).walk(ast);

        //console.log("function reg");
		astTreeWalker(preCompilationC.registerGlobals).walk(ast);

        return ast;
	},
	compile: function (ast, jCond, hasJdata) {
		console.log("Generating C code...");



        //console.log("translating namespaces");
        astTreeWalker(translateNamespaceAccess).walk(ast);

        //console.log("inserting yield points");
        astTreeWalker(insertYieldPoints).walk(ast);

        //console.log("expanding arrays");
        astTreeWalker(jamArrayTranslator).walk(ast);

        translate(ast, hasJdata);

        printAst(ast, "ast_c.dot");

        return astTreeWalker(cTranslator).walk(ast);
	},
    jamCTranslator: jamCTranslator,
};
