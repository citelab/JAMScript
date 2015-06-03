var ometa      = require('./base.js'),
    cache_path = './.cache';

/**
 * Internal function to cache grammars. Creates a `.cache` directory in the current 
 * working path.
 */
function cached(grammar_file) {
  var fs      = require('fs'),
      path    = require('path'),
      change  = fs.statSync(grammar_file).mtime.valueOf(),
      cache   = [cache_path,'/', path.basename(grammar_file), '.', change, '.js'].join('');

  if(!fs.existsSync(cache_path))
    fs.mkdirSync(cache_path);

  if(fs.existsSync(cache))
    return fs.readFileSync(cache, 'utf8');

  var result = load(grammar_file);
  fs.writeFileSync(cache, result);
  return result;
}

/**
 * Loads the specified grammar file and returns the generated grammar JavaScript
 * code for it. Evaling this code in your module will create the grammar objects
 * in the global module namespace.
 */
function load(grammar_file) {
  var fs      = require('fs'),
	    grammar = fs.readFileSync(grammar_file, 'utf-8');
	return compile(grammar)
}

 /**
  * parses and compiles the given OMeta-grammar-string and returns a JavaScript-string
  * which may be evaled to retreive the parser.
  */
function compile(grammar) {
  var compiler     = require('./compiler.js'),
      tree         = compiler.parser.matchAll(grammar, 'topLevel'),
	    parserString = compiler.translator.match(tree, 'trans');
  return parserString;
}

/**
 * Evaluates the grammar-module and returns the exports of that module
 */
function run(grammar, module, filename) {

  // this is used to bind OMeta to runtime. It can be used also (lateron) to dynamically
  // inject other environment-variables.  
  //   {a:1,b:2,c:3,d:4} -> function(a,b,c,d) {...}.call(1,2,3,4)
  // this is better than `with`, since it offers full control
  var source = [
    "module.grammar = (function(OMeta) {",
      grammar,
    "});"
  ].join('');

  module._compile(source, filename);
  module.grammar.call(module, ometa);
  return module.exports;
}

// register `ojs`-extension
require.extensions['.ojs'] = function(module, filename) {
  var start = new Date;
  var result = run(cached(filename), module, filename);
  // console.log("Compiled", filename, "in",new Date - start,"ms");
  return result;
};

module.exports = {
  load:    load,
  compile: compile,
  base:    ometa,
  run: function(grammar, filename) {
    var Module = require('module');
    return run(grammar, new Module(), filename)
  }
};
