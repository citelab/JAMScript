/* eslint-env node */
"use strict";
const fs = require("fs");

const callGraph = {c: new Map(), j: new Map()};
const tasks = new Map();
var dotNodeIndex = 0;
var anonCount = 0;
var blockCount = 0;
const blockNodes = new Map();

function printCallGraph(file) {
    let out="digraph callGraph {\n";
    for (var lang of ["c", "j"]) {
        out += ` subgraph cluster_lang_${lang} {\n  label="${lang} side"\n`;
        for (var [name, func] of callGraph[lang]) {
            out += `  subgraph cluster_${func.dotNode} {\n   label="${name}"\n`;
            var printed = new Set();
            console.log(func);
            var toprint = [func.body];
            while (toprint.length > 0) {
                var child = toprint.pop();
                console.log("child", child);
                out += `   node_${child.dotNode}[label="${child.type}"];\n`;
                for (var c of child.children) {
                    out += `   node_${child.dotNode} -> node_${c.dotNode};\n`;
                    if (!printed.has(c.dotNode)) {
                        printed.add(c.dotNode);
                        toprint.push(c);
                    }
                }
            }
            out += "  }\n";
        }
        out += " }\n";
    }
    out += "}\n";

    fs.writeFile(file, out, (err) => {
        if (err) console.error(err);
    });
}

function addFunction(node, language, name = null) {
    let callNode = {
        body: emptyChild("body", node.body),
        type: "func",
        dotNode: dotNodeIndex++,
    };
    callNode.name = name || `Anonymous function ${anonCount++}`;
    callGraph[language].set(callNode.name, callNode);
    return callNode.body;
}

function addTask(node, language) {
    let type = node.type === "Sync_task" ? "sync" : "async";
    let callNode = {
        body: emptyChild("body", node.body),
        type: type,
        dotNode: dotNodeIndex++,
    };
    callNode.name = language === "c" ? node.name : node.namespace_name;
    tasks.set(callNode.name, language);
    callGraph[language].set(callNode.name, callNode);
    return callNode.body;
}

const virtualTypes = new Set(["if", "for", "while", "dowhile", "switch", "label", "case", "default"]);
function emptyChild(type, block, index = 0) {
    if (!block.callGraphBlockId)
        block.callGraphBlockId = blockCount++;
    const virtual = virtualTypes.has(type);
    let child = {
        type: type,
        virtual: virtual,
        block: virtual ? {content: block} : block,
        index: index, // line in block marking start of this child
        calls: [],
        children: [],
        dotNode: dotNodeIndex++,
    };

    if (blockNodes.has(block.callGraphBlockId))
        blockNodes.get(block.callGraphBlockId).push(child);
    else
        blockNodes.set(block.callGraphBlockId, [child]);
    return child;
}

function regFuncs(callSet, child) {}


function walkCFunction(node, callNode) {
    this.gotoStack = [];
    this.labelMap = new Map();
    this.walk(node.body, [callNode.body]);
    for (var [label, children] of this.gotoStack) {
        var togo = this.labelMap.get(label);
        if (togo == undefined)
            throw `ERROR: goto to undefined or nonlocal label "${label}"`;
        for (var c of children)
            c.children.push(togo);
    }
}
const createCallGraphC = {
    Source: function(node) {
        this.contStack = [];
        this.breakStack = [];
        this.caseStack = [];
        this.blockLabel = ["body"];
        this.indexStack = [];

        this.walk(node.content);
    },
    Prototype: null,
    Async_prototype: null,
    Sync_prototype: null,
    Type_spec: null,
    Decl_specs: null,
    Abs_declarator: null,

    Async_task: function(node) {
        let callNode = callGraph.c.get(node.name);
        walkCFunction.call(this, node, callNode);
    },
    Sync_task: function(node) {
        let callNode = callGraph.c.get(node.name);
        walkCFunction.call(this, node, callNode);
    },
    Function_def: function(node) {
        let callNode = callGraph.c.get(node.decl.name.name.name);
        walkCFunction.call(this, node, callNode);
    },
    Compound_stmt: function(node, inChildren) {
        let name = this.blockLabel.at(-1);
        let block = emptyChild(name, node);
        for (var c of inChildren)
            c.children.push(block);
        let blockHead = [block];
        let index = 0;
        for (var stmt of node.block) {
            console.log("blockhead", blockHead);
            if (stmt.type === "Return_stmt") {
                var blockPart = emptyChild("return", node, index);
                for (var c of blockHead)
                    c.children.push(blockPart);
                blockHead = [blockPart];
            } else if (stmt.type === "Expr_stmt" && blockHead.length > 1) {
                var blockPart = emptyChild("exprs", node, index);
                for (var c of blockHead)
                    c.children.push(blockPart);
                blockHead = [blockPart];
            }
            if (this.dict.has(stmt.type))
                blockHead = this.walk(stmt, blockHead);
            else
                this.walk(stmt, blockHead);
            if (stmt.type === "Continue_stmt" || stmt.type === "Break_stmt" || stmt.type === "Goto_stmt" || stmt.type === "Return_stmt")
                blockHead = [];
            index++;
        }
        return blockHead;
    },
    Expr_stmt: function(node, inChildren) {
        if (inChildren.length == 1) // Avoids walking through unreachable exprs
            regFuncs(this.walk(node.expr, inChildren), inChildren[0]);
        return inChildren;
    },
    Label_stmt: function(node, inChildren) {
        let lbl = emptyChild("label", []);
        for (var c of inChildren)
            c.children.push(lbl);
        this.labelMap.set(node.label.name, lbl);
        return this.walk(node.stmt, [lbl]);
    },
    Case_stmt: function(node, inChildren) {
        let lbl = emptyChild("case", []);
        for (var c of inChildren)
            c.children.push(lbl);
        this.caseStack.at(-1).push(lbl);
        return this.walk(node.stmt, [lbl]);
    },
    Default_stmt: function(node, inChildren) {
        let lbl = emptyChild("default", []);
        for (var c of inChildren)
            c.children.push(lbl);
        this.caseStack.at(-1).push(lbl);
        return this.walk(node.stmt, [lbl]);
    },
    If_stmt: function(node, inChildren) {
        let cond = emptyChild("if", [node.cond]);
        for (var c of inChildren)
            c.children.push(cond);
        regFuncs(this.walk(node.cond, [cond]), cond);
        this.blockLabel.push("then");
        let thenChildren = this.walk(node.stmt, [cond]);
        this.blockLabel.pop();
        this.blockLabel.push("else");
        let elseChildren = node.else ? this.walk(node.else, [cond]) : [cond];
        this.blockLabel.pop();
        return thenChildren.concat(elseChildren);
    },
    Switch_stmt: function(node, inChildren) {
        let cond = emptyChild("switch", [node.cond]);
        for (var c of inChildren)
            c.children.push(cond);
        regFuncs(this.walk(node.cond, [cond]), cond);
        this.breakStack.push([]);
        this.caseStack.push([]);
        let ends = this.walk(node.stmt, []);
        let hasDefault = false;
        for (var caseNode of this.caseStack.pop()) {
            cond.children.push(caseNode);
            hasDefault ||= caseNode.type === "default";
        }
        ends = ends.concat(this.breakStack.pop());
        if (!hasDefault)
            ends.push(cond);
        return ends;
    },
    While_stmt: function(node, inChildren) {
        let cond = emptyChild("while", [node.cond]);
        console.log(inChildren);
        for (var c of inChildren)
            c.children.push(cond);
        regFuncs(this.walk(node.cond, [cond]), cond);
        this.breakStack.push([]);
        this.contStack.push([]);
        this.blockLabel.push("do");
        let ends = this.walk(node.stmt, [cond]);
        this.blockLabel.pop();
        for (var c of ends)
            c.children.push(cond);
        for (var c of this.contStack.pop())
            c.children.push(cond);
        return this.breakStack.pop().concat([cond]);
    },
    DoWhile_stmt: function(node, inChildren) {
        let cond = emptyChild("while", [node.cond]);
        regFuncs(this.walk(node.cond, [cond]), cond);
        this.breakStack.push([]);
        this.contStack.push([]);
        this.blockLabel.push("do");
        let ends = this.walk(node.stmt, inChildren.concat([cond]));
        this.blockLabel.pop();
        for (var c of ends)
            c.children.push(cond);
        for (var c of this.contStack.pop())
            c.children.push(cond);
        return this.breakStack.pop().concat([cond]);
    },
    For_stmt: function(node, inChildren) {
        let init = emptyChild("for", [node.init]);
        let cond = emptyChild("for", [node.cond, node.iter]);
        for (var c of inChildren)
            c.children.push(init);
        init.children.push(cond);
        this.walk(node.init, [init]);
        this.walk(node.cond, [cond]);
        regFuncs(this.walk(node.iter, [cond]), cond);

        this.breakStack.push([]);
        this.contStack.push([]);
        this.blockLabel.push("do");
        let ends = this.walk(node.stmt, [cond]);
        this.blockLabel.pop();
        for (var c of ends)
            c.children.push(cond);
        for (var c of this.contStack.pop())
            c.children.push(cond);
        return this.breakStack.pop().concat([cond]);
    },
    Goto_stmt: function(node, inChildren) {
        this.gotoStack.push([node.label.name, inChildren]);
        return [];
    },
    Continue_stmt: function(node, inChildren) {
        this.contStack.push(this.contStack.pop().concat(inChildren));
        return [];
    },
    Break_stmt: function(node, inChildren) {
        this.breakStack.push(this.breakStack.pop().concat(inChildren));
        return [];
    },
    Return_stmt: function(node, inChildren) {
        if (inChildren.length == 1) // Avoids walking through unreachable exprs
            regFuncs(this.walk(node.expr, inChildren), inChildren[0]);
        return [];
    },
    _default: function(n, inChildren) {
        if (n != null && typeof n === "object" && n.type != undefined)
            for (let [key, entry] of Object.entries(n))
                if (key !== "type") {
                    let res = this.walk(entry, inChildren);
                }
        return n;
    },
};


module.exports = {
    printCallGraph: printCallGraph,
    createCallGraphC: createCallGraphC,
    addFunction: addFunction,
    addTask: addTask,
};
