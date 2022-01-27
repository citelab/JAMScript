/* eslint-env node */

'use strict';

var fs = require('fs');
var path = require('path');
var ohm = require('ohm-js');
var es5 = require('./es5.js');

// Semantic actions for the `mentionsThis` attribute, which returns true for a node
// if the `this` keyword appears anywhere in the node's subtree, and otherwise false.
var mentionsThisActions = {
  this: function(_) { return true; },
  _terminal: function() { return false; },
  _nonterminal: anyNodesMentionThis,
  _iter: anyNodesMentionThis
};

function anyNodesMentionThis(...nodes) {
  return nodes.some(function(n) { return n.mentionsThis; });
}

var modifiedSourceActions = {
  ArrowFunction: function(params, _, arrow, body) {
    var source = 'function ' + params.es5Translator + ' ' + body.es5Translator;
    // Only use `bind` if necessary.
    return body.mentionsThis ? source + '.bind(this)' : source;
  },
  ArrowParameters_unparenthesized: function(id) {
    return '(' + id.es5Translator + ')';
  },
  ConciseBody_noBraces: function(exp) {
    return '{ return ' + exp.es5Translator + ' }';
  },
  AsyncFunctionDeclaration: function(_1, id , _2, params, _3, _4, body, _5) {
    return `async function ${id.es5Translator}(${params.es5Translator}) {\n${body.es5Translator}}`
  }
};

var ns = { 
  ES5: ohm.grammar(fs.readFileSync(path.join(__dirname, 'es5.ohm')))
};
var g = ohm.grammar(fs.readFileSync(path.join(__dirname, 'es6.ohm')), ns);

var semantics = g.extendSemantics(es5.semantics);
semantics.extendAttribute('es5Translator', modifiedSourceActions);
semantics.addAttribute('mentionsThis', mentionsThisActions);

module.exports = {
  grammar: g,
  semantics: semantics
};
