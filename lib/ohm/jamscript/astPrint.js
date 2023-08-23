/* eslint-env node */
"use strict";
const fs = require("fs");

var nodeCount;

function printNode(label, pn, pl) {
    let toret = "node_" + nodeCount + "[label=\"" + label + "\"];\n";
    if (pn > 0)
        toret += printEdge(pn, nodeCount, pl);
    nodeCount++;
    return toret;
}

function printEdge(pn, cn, label) {
    return "node_" + pn + " -> " + "node_" + cn + (label === "" ? ";\n": "[label=\"" + label + "\"];\n");
}

function sanitizeString(c) {
    switch(c) {
    case "\\":
        return "\\\\";
    case "\n":
        return "\\\\n";
    case "\0":
        return "\\\\0";
    case "\t":
        return "\\\\t";
    case "\"":
        return "\\\"";
    }
}

function printAst(ast, file) {
    nodeCount = 1;
    let res = printAstR(0, "", "digraph {\n", ast) + "}\n";
    fs.writeFile(file, res, (err) => {
        if (err) console.error(err);
    });
}

function printAstR(parent, pl, acc, node) {
    if (node == null || typeof(node) === "number" || typeof(node) === "bigint" || typeof(node) === "boolean")
        return acc + printNode(node + "\" color=\"red", parent, pl);
    else if (typeof(node) === "string")
        return acc + printNode(node.replaceAll(/["\n\0\t\\]/g, sanitizeString)+"\" color=\"green", parent, pl);
    else if (node instanceof Array) {
        let me = nodeCount;
        acc += printNode("[...]\" color=\"blue", parent, pl);
        return node.reduce(printAstR.bind(undefined, me, ""), acc);
    } else if (node instanceof Object) {
        let me = nodeCount;
        acc += printNode(node.type, parent, pl);
        return Object.entries(node).reduce((acc, [k, v]) => k === "type" ? acc : printAstR(me, k, acc, v), acc);
    }
    console.error("does not work: ");
    console.error(node);
    return acc;
}

module.exports = {
    printAst: printAst,
};
