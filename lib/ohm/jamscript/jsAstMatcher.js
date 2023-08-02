/* eslint-env node */
"use strict";
const fs = require("fs");
const path = require("path");
const ohm = require("ohm-js");
const toAST = require('ohm-js/extras').toAST;
const cstPrint = require("./cstPrint");

const jamjs = fs.readFileSync(path.join(__dirname, "jamjs.ohm"));
const ns = {
	ES5: ohm.grammar(fs.readFileSync(path.join(__dirname, "../ecmascript/es5.ohm"))),
};
ns.ES6 = ohm.grammar(fs.readFileSync(path.join(__dirname, "../ecmascript/es6.ohm")), ns);

const jamJsGrammar = ohm.grammar(jamjs, ns);
var semantics = jamJsGrammar.createSemantics();
semantics.addOperation("cstPrint", cstPrint);

const astMatcher = {};

function fromUserInput(input, cstDotFile = "") {
    var jsTree = jamJsGrammar.match(input, "Program");
    console.log(`${"#".repeat(40)}\n[JS] RUNNING PRE COMPILATION CHECK`);
    if (jsTree.failed())
		throw jsTree.message;
    if (cstDotFile)
        fs.writeFile(cstDotFile, semantics(jsTree).cstPrint(), (err) => {if (err) console.error(err);});
    return toAST(jsTree, astMatcher);
}

module.exports = {
    fromUserInput: fromUserInput,
};
