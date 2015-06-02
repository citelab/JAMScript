require('../../deps/ometa');

var parser     = require('./grammars/c_parser.ojs');

C = module.exports = {

    parse:      parser.parse,
    translate:  translator.translate,
    compile: function(input) {
        return C.translate(
            C.parse(input));
  },

    parser:     parser,
    translator: translator,
    nodes:      require('./nodes.js')
}
