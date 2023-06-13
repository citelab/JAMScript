/* eslint-env node */

"use strict";

const fs = require("fs");
const path = require("path");
const ohm = require("ohm-js");
const es5Translator = {};
const es6 = require("../ecmascript/es6");
const jCondTranslator = require("./jCondTranslator");
const milestone = require("./milestone");
const es5 = require("../ecmascript/es5");

const VERBOSE = true;

var jamJSTranslator = {
	Program: function (directives, elements) {
		for (var i = 0; i < elements.children.length; i++) {
			const currentChild = elements.child(i);
			currentChild.jamJSTranslator;
		}
	},
	Declaration: function (node) {
		return node.jamJSTranslator + "\n";
	},
	Activity_def: function (node) {
		return node.jamJSTranslator;
	},
	Sync_activity: function (_1, jCond_spec, _2, functionDeclaration) {
		var specs = functionDeclaration.jamJSTranslator;
		if (VERBOSE) {
			console.log(`SYNC FUNCTION [JS] --> NAME: ${specs.fname}`);
		}
		milestone.registerFunction(specs.fname, "SYNC");
	},
	Async_activity: function (_1, jcond_spec, _2, functionDeclaration) {
		var specs = functionDeclaration.jamJSTranslator;
		if (VERBOSE) {
			console.log(`ASYNC FUNCTION [JS] --> NAME: ${specs.fname}`);
		}
		milestone.registerFunction(specs.fname, "ASYNC");
	},
	FunctionDeclaration: function (_1, id, _2, params, _3, _4, block, _5) {
		const functionName = id.es5Translator;
		milestone.registerFunction(functionName, "BATCH");
		if (VERBOSE) {
			console.log(`REGULAR FUNCTION [JS] --> NAME: ${functionName}`);
		}

		return {
			fname: functionName,
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

module.exports = {
	compile: function (input, manager) {
		es5.updateTableManager(manager);
		const jsTree = jamJSGrammar.match(input, "Program");
		if (VERBOSE) {
			console.log(`${"#".repeat(40)}\n[JS] RUNNING PRE COMPILATION CHECK`);
		}
		semantics(jsTree).jamJSTranslator;
	},
};