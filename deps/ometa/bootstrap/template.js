var OMeta = require('./base.js');

/**
 * OMeta Compiler
 * ==============
 * Only dependency is the ometa runtime 'OMeta'. This compiler is automatically generated
 * at a great portion from four grammars:
 *
 * 1. bs-js-compiler
 * 2. bs-ometa-compiler
 * 3. bs-ometa-js-compiler
 * 4. bs-ometa-optimizer
 *
 * and offers two OMeta objects as interface:
 *
 * Parser
 * ------
 * The parser is available as property `parser` and can be used like the following
 *    Compiler.parser.matchAll("ometa SampleGrammar { rule = 'a' | 'a' 'a' }", "topLevel")
 * 
 * please note, that the second argument specifies the start rule which has to be
 * 'topLevel' for the parser.
 *
 * Translator
 * ----------
 * The translator is available as property `translator` and can be used to transform the
 * output of a previous parsing-pass to string.
 *     Compiler.translator.match([#SomeProgram, ...], "trans")
 *
 * There are two differences to the parser. Firstly `match` is invoked since not a input-
 * stream but a single object (=AST) is matched. Secondly the start-rule for the 
 * translator is `trans`
 */
var Compiler = module.exports = (function () {

  // String escape funtionality
  // Required by BSOMetaParser and BSJSParser
  function unescape(s) {
    if(s.charAt(0) == "\\") {
      switch(s.charAt(1)) {
        case "'":
          return"'";
        case '"':
          return'"';
        case "\\":
          return"\\";
        case "b":
          return"\u0008";
        case "f":
          return"\u000c";
        case "n":
          return"\n";
        case "r":
          return"\r";
        case "t":
          return"\t";
        case "v":
          return"\u000b";
        case "x":
          return String.fromCharCode(parseInt(s.substring(2, 4), 16));
        case "u":
          return String.fromCharCode(parseInt(s.substring(2, 6), 16));
        default:
          return s.charAt(1)
      }
    } else {
      return s
    }
  }

  function pad(string, char, len) {
    if(string.length >= len)
      return string;

    var to_pad = [];
    to_pad.length = len - string.length;
    to_pad.push(string);
    to_pad.join(char);
    return to_pad;
  }

  var escapeChar = (function() {

    // escape table    
    var table = {};
    for(var char = 0;char < 128;char++) {
      table[char] = String.fromCharCode(char)
    }
    table["'".charCodeAt(0)] = "\\'";
    table['"'.charCodeAt(0)] = '\\"';
    table["\\".charCodeAt(0)] = "\\\\";
    table["\u0008".charCodeAt(0)] = "\\b";
    table["\u000c".charCodeAt(0)] = "\\f";
    table["\n".charCodeAt(0)] = "\\n";
    table["\r".charCodeAt(0)] = "\\r";
    table["\t".charCodeAt(0)] = "\\t";
    table["\u000b".charCodeAt(0)] = "\\v";

    return function(char) {

      var charCode = char.charCodeAt(0);
      return charCode > 255 ? String.fromCharCode(charCode) : table[charCode];
      if(charCode < 128) {
        return table[charCode]
      } else {
        if(128 <= charCode && charCode < 256) {
          return "\\x" + pad(charCode.toString(16), "0", 2)
        }else {
          return "\\u" + pad(charCode.toString(16), "0", 4)
        }
      }
    }
  })();

  function StringBuffer() {
    this.strings = [];
    for(var i=0,len=arguments.length;i<len;i++) {
      this.nextPutAll(arguments[i])
    }
  }
  StringBuffer.prototype = {
    nextPutAll: function(s) {
      this.strings.push(s)
    },
    contents: function() {
      return this.strings.join("")
    }
  };

  function writeStream(el) {
    return new StringBuffer(el);
  }

  function toProgramString(string) {
    var ws = writeStream('"');
    for(var i=0,len=string.length; i<len ;i++) {
      ws.nextPutAll(escapeChar(string.charAt(i)))
    }
    ws.nextPutAll('"');
    return ws.contents()
  }


  // AUTOMATICALLY GENERATED CODE FROM GRAMMARS ---------------------------------------->
  %grammars%
  // <---------------------------------------- AUTOMATICALLY GENERATED CODE FROM GRAMMARS

  return {
    parser: BSOMetaJSParser,
    translator: BSOMetaJSTranslator
  }  
})();
