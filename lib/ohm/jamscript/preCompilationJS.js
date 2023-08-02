/* eslint-env node */

"use strict";

const jCondTranslator = require("./jCondTranslator");
const milestone = require("./milestone");

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
	Task_def: function (node) {
		return node.jamJSTranslator;
	},
	Sync_task: function (_1, jCond_spec, _2, functionDeclaration) {
		var specs = functionDeclaration.jamJSTranslator;
		if (VERBOSE) {
			console.log(`SYNC FUNCTION [JS] --> NAME: ${specs.fname}`);
		}
		milestone.registerFunction(specs.fname, "SYNC");
	},
	Async_task: function (_1, jcond_spec, _2, functionDeclaration) {
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
};

module.exports = {};
