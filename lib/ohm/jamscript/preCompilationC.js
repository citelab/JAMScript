/* eslint-env node */

"use strict";

const fs = require("fs");
const path = require("path");

const ohm = require("ohm-js");
const jCondTranslator = require("./jCondTranslator");
const milestone = require("./milestone");
const cTranslator = require("../c/c").cTranslator;

const VERBOSE = false;

var jamCTranslator = {
  Sync_activity: function (_, specs, jCond_spec, declarator, namespace, stmt) {
    var functionName = declarator.jamCTranslator.name;
    if (VERBOSE) {
      console.log(`SYNC FUNCTION [C] --> NAME: ${functionName}`);
    }
    milestone.registerFunction(functionName, "SYNC");
  },
  Async_activity: function (_, jCond_spec, decl, namespace, stmt) {
    var functionName = decl.jamCTranslator.name;
    if (VERBOSE) {
      console.log(`ASYNC FUNCTION [C] --> NAME: ${functionName}`);
    }
    milestone.registerFunction(functionName, "ASYNC");
  },
  Activity_def: function (node) {
    return node.jamCTranslator;
  },
  External_decl: function (node) {
    return node.jamCTranslator;
  },
  Source: function (decls) {
    for (var i = 0; i < decls.numChildren; i++) {
      const currentChild = decls.child(i);
      currentChild.jamCTranslator;
    }
  },
  Pcall_decl: function (node) {
    return node.jamCTranslator;
  },
  Pcall_decl_ParamTypeList: function (_1, node, _2) {
    return node.jamCTranslator;
  },
  Pcall_decl_IdentList: function (_1, idents, _2) {
    return idents.jamCTranslator;
  },
  Pcall_decl_Empty: function (_1, _2) {
    return [];
  },
  Param_type_lst: function (param_list) {
    var params = [];
    params.push(param_list.child(0).jamCTranslator);
    var rest = param_list.child(2);
    for (var i = 0; i < rest.numChildren; i++) {
      params.push(rest.child(i).jamCTranslator);
    }
    return params;
  },
  Declarator: function (pointer, dir_declarator, _1, _2) {
    var dir_decl = dir_declarator.jamCTranslator;
    return {
      pointer: pointer.cTranslator,
      name: dir_decl.name,
      params: dir_decl.params,
    };
  },
  // params
  Dir_declarator_PCall: function (name, params) {
    return {
      name: name.cTranslator,
      params: params.jamCTranslator,
    };
  },
  Dir_declarator_Id: function (id) {
    return {
      name: id.cTranslator,
    };
  },
  Dir_declarator: function (node) {
    return node.jamCTranslator;
  },
  Param_decl: function (node) {
    return node.jamCTranslator;
  },
  Param_decl_Declarator: function (decl_specs, decl) {
    var varType = decl_specs.cTranslator;
    if (decl.jamCTranslator.pointer !== "") {
      varType += decl.jamCTranslator.pointer;
    }
    return {
      type: varType,
      name: decl.jamCTranslator.name,
    };
  },
  _nonterminal: function (...children) {
    var flatChildren = flattenIterNodes(children).sort(compareByInterval);
    var childResults = flatChildren.map(function (n) {
      return n.jamCTranslator;
    });
    if (flatChildren.length === 0 || childResults.every(isUndefined)) {
      return undefined;
    }
    var code = "";
    for (var i = 0; i < flatChildren.length; ++i) {
      if (childResults[i] !== null) {
        code += childResults[i];
      }
    }
    return code;
  },
  _iter: function (...children) {
    return children.map((c) => c.jamCTranslator);
  },
  _terminal: function () {
    return this.primitiveValue;
  },
  NonemptyListOf: function (first, sep, rest) {
    var code = first.jamCTranslator;
    for (var i = 0; i < rest.numChildren; i++) {
      code += sep.child(i).primitiveValue + " " + rest.child(i).jamCTranslator;
    }
    return code;
  },
  EmptyListOf: function () {
    return "";
  },
};

cTranslator.Function_def = function (specs, decl, stmts) {
  const functionName = decl.child(1).child(0).child(0).cTranslator;
  if (VERBOSE) {
    console.log(`REGULAR FUNCTION [C] --> NAME: ${functionName}`);
  }
  milestone.registerFunction(functionName, "BATCH");

  return "";
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

var jamc = fs.readFileSync(path.join(__dirname, "jamc.ohm"));
var ns = {
  C: ohm.grammar(fs.readFileSync(path.join(__dirname, "../c/c.ohm"))),
};
var jamCGrammar = ohm.grammar(jamc, ns);
var semantics = jamCGrammar.createSemantics();

semantics.addAttribute("jamCTranslator", jamCTranslator);
semantics.addAttribute("cTranslator", cTranslator);
semantics.addAttribute("jCondTranslator", jCondTranslator.jCondTranslator);

module.exports = {
  compile: function (input) {
    var cTree = jamCGrammar.match(input, "Source");
    if (VERBOSE) {
      console.log(`${"#".repeat(40)}\n[C] RUNNING PRE COMPILATION CHECK`);
    }
    semantics(cTree).jamCTranslator;
  },
};
