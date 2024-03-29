// This file parses and translates the input C program 
// Then it prints out the translated result
// To use this file, type in the command "node pretty.js filename.c"

/* eslint-env node */

'use strict';

// --------------------------------------------------------------------
// Imports
// --------------------------------------------------------------------

var fs = require('fs');
var path = require('path');

var c = require('./c');
var ohm = require('ohm-js');

// --------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------

function removeShebang(source) {
  return source.slice(0, 2) === '#!' ? source.replace('#!', '//') : source;
}

function loadModule(name) {
  var ns = {C: c.grammar};
  if (fs.exists(name)) {
    return require(name)(ohm, ns, c.semantics);
  }
  var relPath = path.join(__dirname, name);
  var modulePath = require.resolve(relPath);
  if (modulePath) {
    return require(modulePath)(ohm, ns, c.semantics);
  }
  throw new Error("Error: Cannot find grammar module '" + name + "'");
}

// --------------------------------------------------------------------
// Main
// --------------------------------------------------------------------

function compile(args) {
  var filenames = [];
  var opts = {
    grammar: null,
    b: false,  // Benchmark (print matching times).
    v: false   // Verbose
  };

  // Super basic command line option parsing.
  for (var i = 0; i < args.length; ++i) {
    if (args[i] === '-g') {
      opts.grammar = args[++i];
    } else if (args[i][0] === '-' && opts.hasOwnProperty(args[i][1])) {
      opts[args[i][1]] = true;
    } else {
      filenames.push(args[i]);
    }
  }

  var lang = opts.grammar ? loadModule(opts.grammar) : c;

  var files = filenames.map(function(name) {
    // If benchmarking, read in all the files at once, so that we can just time the matching.
    return [name, opts.b ? removeShebang(fs.readFileSync(name).toString()) : null];
  });

  var matchStartTime = Date.now();

  // Parsing -- bails out when the first error is encountered.
  var results = [];
  var succeeded = files.every(function(arr) {
    var source = arr[1] || removeShebang(fs.readFileSync(arr[0]).toString());
    if (opts.v) { console.error(arr[0]); }
    var result = lang.grammar.match(source, 'Source');
    if (result.succeeded()) {
      results.push(result);
      return true;
    }
    console.error(arr[0] + ':\n' + result.message);
  });

  if (succeeded) {
    if (opts.b) { console.error('Matching:', (Date.now() - matchStartTime) + 'ms'); }

    // Codegen
    var code = '';
    var codegenStartTime = Date.now();
    results.forEach(function(r) { code += lang.semantics(r).cTranslator; });
    if (opts.b) {
      console.error('Codegen:', (Date.now() - codegenStartTime) + 'ms');
    }
    return code;
  }
  return null;
}

module.exports = compile;

if (require.main === module) {
  console.log(compile(process.argv.slice(2)));
}
