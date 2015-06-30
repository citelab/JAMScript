require('../../deps/ometa');

var parser     = require('./grammars/jamc_parser.ojs');
var translator = require('./grammars/jamc_translator.ojs');

JAMC = module.exports = {

    parse:      parser.parse,
    translate:  translator.translate,
    compile: function(input) {
        return JAMC.translate(
            JAMC.parse(input));
  },

    parser:     parser,
    translator: translator,
    nodes:      require('./nodes.js')
}
