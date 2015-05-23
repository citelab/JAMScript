//var ometa   = require('../../../code/lib/ometa/base.js'),

var start = new Date();

//var ometa =  require('./bootstrapper.js'),
var ometa =  require('../compiler.js'),
    fs      = require('fs');


function load(grammar_file) {
	var grammar = fs.readFileSync(grammar_file, 'utf8')	
	return compile(grammar)
}

// parses and compiles the given OMeta-grammar-string and returns a JavaScript-string
// which may be evaled to retreive the parser.
function compile(grammar) {
  var tree = ometa.parser.matchAll(grammar, 'topLevel', undefined) //, error_handler("Error while parsing OMeta grammar"));
	var parserString = ometa.translator.match(tree, 'trans', undefined)//, error_handler("Error while translating grammar"));
  return parserString;
}

// for { name: "foo" } replaces all occurances of %name% with "foo"
function render(templateFile, replacements) {

  var template = fs.readFileSync(templateFile, "utf8");

  for(var name in replacements) {
    if(!replacements.hasOwnProperty(name)) continue;
    template = template.replace(new RegExp("%"+name+"%", "g"), replacements[name].toString())
  }

  return template;
}

var grammars = [];
grammars.push(load('../grammars/bs-js-compiler.ojs'));
grammars.push(load('../grammars/bs-ometa-compiler.ojs'));
grammars.push(load('../grammars/bs-ometa-optimizer.ojs'));
grammars.push(load('../grammars/bs-ometa-js-compiler.ojs'));

fs.writeFileSync('../compiler.js', render('./template.js', {
  grammars: grammars.join("\n\n"),
}));

console.log(new Date() - start);
