require('../ometa');

var parser     = require('./grammars/es5_parser.ojs'),
    translator = require('./grammars/es5_translator.ojs');

es5 = module.exports = {  
  
  parse:      parser.parse,
  translate:  translator.translate,
  compile: function(input) {
    return es5.translate(
            es5.parse(input));
  },

  parser:     parser,
  translator: translator,
  nodes:      require('./nodes.js')
}
