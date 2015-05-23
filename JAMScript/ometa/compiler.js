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
  {var BSJSParser=OMeta.inherit({_grammarName: "BSJSParser",

/*
  space        = ^space | fromTo('//', '\n') | fromTo('/*', '*\/')
*/
"space":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return OMeta._superApplyWithArgs(this,'space')}).call(this)}),(function(){return (function(){return this._applyWithArgs("fromTo","//","\n")}).call(this)}),(function(){return (function(){return this._applyWithArgs("fromTo","/*","*/")}).call(this)}))}).call(this)}))},

/*
  nameFirst    = letter | '
  // <---------------------------------------- AUTOMATICALLY GENERATED CODE FROM GRAMMARS

  return {
    parser: BSOMetaJSParser,
    translator: BSOMetaJSTranslator
  }  
})();
 | '_'
*/
"nameFirst":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("letter")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","$")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","_")}).call(this)}))}).call(this)}))},

/*
  nameRest     = nameFirst | digit
*/
"nameRest":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("nameFirst")}).call(this)}),(function(){return (function(){return this._apply("digit")}).call(this)}))}).call(this)}))},

/*
  iName        = <nameFirst nameRest*>
*/
"iName":function(){return this._or((function(){return (function(){undefined;return (function(){return this._consumedBy((function(){return (function(){this._apply("nameFirst");return this._many((function(){return this._apply("nameRest")}))}).call(this)}))}).call(this)}).call(this)}))},

/*
  isKeyword :x = ?BSJSParser._isKeyword(x)
*/
"isKeyword":function(){var x;return this._or((function(){return (function(){(function(){return x=this._apply("anything")}).call(this);return (function(){return this._pred(BSJSParser._isKeyword(x))}).call(this)}).call(this)}))},

/*
  name         = iName:n ~isKeyword(n)                                               -> [#name, n=='self' ? '$elf' : n]
*/
"name":function(){var n;return this._or((function(){return (function(){undefined;return (function(){n=this._apply("iName");this._not((function(){return this._applyWithArgs("isKeyword",n)}));return ["name",((n == "self")?"$elf":n)]}).call(this)}).call(this)}))},

/*
  keyword      = iName:k isKeyword(k)                                                -> [k, k]
*/
"keyword":function(){var k;return this._or((function(){return (function(){undefined;return (function(){k=this._apply("iName");this._applyWithArgs("isKeyword",k);return [k,k]}).call(this)}).call(this)}))},

/*
  hexDigit     = char:x {this.hexDigits.indexOf(x.toLowerCase())}:v ?(v >= 0)        -> v
*/
"hexDigit":function(){var v,x;return this._or((function(){return (function(){undefined;return (function(){x=this._apply("char");v=this["hexDigits"].indexOf(x.toLowerCase());this._pred((v >= (0)));return v}).call(this)}).call(this)}))},

/*
  hexLit       = hexLit:n hexDigit:d                                                 -> (n * 16 + d)
               | hexDigit
*/
"hexLit":function(){var d,n;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){n=this._apply("hexLit");d=this._apply("hexDigit");return ((n * (16)) + d)}).call(this)}),(function(){return (function(){return this._apply("hexDigit")}).call(this)}))}).call(this)}))},

/*
  number       = ``0x'' hexLit:n                                                     -> [#number, n]
               | <digit+ ('.' digit+)?>:f                                            -> [#number, parseFloat(f)]
*/
"number":function(){var f,n;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("seq","0x");n=this._apply("hexLit");return ["number",n]}).call(this)}),(function(){return (function(){f=this._consumedBy((function(){return (function(){this._many1((function(){return this._apply("digit")}));return this._opt((function(){return (function(){this._applyWithArgs("exactly",".");return this._many1((function(){return this._apply("digit")}))}).call(this)}))}).call(this)}));return ["number",parseFloat(f)]}).call(this)}))}).call(this)}))},

/*
  escapeChar   = <'\\' ( 'u' hexDigit hexDigit hexDigit hexDigit
                       | 'x' hexDigit hexDigit
                       | char                                    )>:s                -> unescape(s)
*/
"escapeChar":function(){var s;return this._or((function(){return (function(){undefined;return (function(){s=this._consumedBy((function(){return (function(){this._applyWithArgs("exactly","\\");return this._or((function(){return (function(){this._applyWithArgs("exactly","u");this._apply("hexDigit");this._apply("hexDigit");this._apply("hexDigit");return this._apply("hexDigit")}).call(this)}),(function(){return (function(){this._applyWithArgs("exactly","x");this._apply("hexDigit");return this._apply("hexDigit")}).call(this)}),(function(){return (function(){return this._apply("char")}).call(this)}))}).call(this)}));return unescape(s)}).call(this)}).call(this)}))},

/*
  str          = seq('"""')  (~seq('"""') char)*:cs seq('"""')                       -> [#string, cs.join('')]
               | '\'' (escapeChar | ~'\'' char)*:cs '\''                             -> [#string, cs.join('')]
               | '"'  (escapeChar | ~'"'  char)*:cs '"'                              -> [#string, cs.join('')]
               | ('#' | '`') iName:n                                                 -> [#string, n]
*/
"str":function(){var cs,n;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("seq","\"\"\"");cs=this._many((function(){return (function(){this._not((function(){return this._applyWithArgs("seq","\"\"\"")}));return this._apply("char")}).call(this)}));this._applyWithArgs("seq","\"\"\"");return ["string",cs.join("")]}).call(this)}),(function(){return (function(){this._applyWithArgs("exactly","\'");cs=this._many((function(){return this._or((function(){return (function(){return this._apply("escapeChar")}).call(this)}),(function(){return (function(){this._not((function(){return this._applyWithArgs("exactly","\'")}));return this._apply("char")}).call(this)}))}));this._applyWithArgs("exactly","\'");return ["string",cs.join("")]}).call(this)}),(function(){return (function(){this._applyWithArgs("exactly","\"");cs=this._many((function(){return this._or((function(){return (function(){return this._apply("escapeChar")}).call(this)}),(function(){return (function(){this._not((function(){return this._applyWithArgs("exactly","\"")}));return this._apply("char")}).call(this)}))}));this._applyWithArgs("exactly","\"");return ["string",cs.join("")]}).call(this)}),(function(){return (function(){this._or((function(){return (function(){return this._applyWithArgs("exactly","#")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","`")}).call(this)}));n=this._apply("iName");return ["string",n]}).call(this)}))}).call(this)}))},

/*
  special      = ( '('   | ')'    | '{'    | '}'     | '['    | ']'     | ','    
                 | ';'   | '?'    | ':'    | ``!=='' | ``!='' | ``==='' | ``==''
                 | ``='' | ``>='' | '>'    | ``<=''  | '<'    | ``++''  | ``+=''
                 | '+'   | ``--'' | ``-='' | '-'     | ``*='' | '*'     | ``/=''
                 | '/'   | ``%='' | '%'    | ``&&='' | ``&&'' | ``||='' | ``||''
                 | '.'   | '!'                                                   ):s -> [s, s]
*/
"special":function(){var s;return this._or((function(){return (function(){undefined;return (function(){s=this._or((function(){return (function(){return this._applyWithArgs("exactly","(")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly",")")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","{")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","}")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","[")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","]")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly",",")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly",";")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","?")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly",":")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","!==")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","!=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","===")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","==")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq",">=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly",">")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","<=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","<")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","++")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","+=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","+")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","--")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","-=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","-")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","*=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","*")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","/=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","/")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","%=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","%")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","&&=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","&&")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","||=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","||")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly",".")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","!")}).call(this)}));return [s,s]}).call(this)}).call(this)}))},

/*
  tok          = spaces (name | keyword | number | str | special)
*/
"tok":function(){return this._or((function(){return (function(){undefined;return (function(){this._apply("spaces");return this._or((function(){return (function(){return this._apply("name")}).call(this)}),(function(){return (function(){return this._apply("keyword")}).call(this)}),(function(){return (function(){return this._apply("number")}).call(this)}),(function(){return (function(){return this._apply("str")}).call(this)}),(function(){return (function(){return this._apply("special")}).call(this)}))}).call(this)}).call(this)}))},

/*
  toks         = token*:ts spaces end                                                -> ts
*/
"toks":function(){var ts;return this._or((function(){return (function(){undefined;return (function(){ts=this._many((function(){return this._apply("token")}));this._apply("spaces");this._apply("end");return ts}).call(this)}).call(this)}))},

/*
  token :tt    = tok:t ?(t[0] == tt)                                                 -> t[1]
*/
"token":function(){var tt,t;return this._or((function(){return (function(){(function(){return tt=this._apply("anything")}).call(this);return (function(){t=this._apply("tok");this._pred((t[(0)] == tt));return t[(1)]}).call(this)}).call(this)}))},

/*
  spacesNoNl   = (~'\n' space)*
*/
"spacesNoNl":function(){return this._or((function(){return (function(){undefined;return (function(){return this._many((function(){return (function(){this._not((function(){return this._applyWithArgs("exactly","\n")}));return this._apply("space")}).call(this)}))}).call(this)}).call(this)}))},

/*
  expr         = orExpr:e ( "?"   expr:t   ":" expr:f                                -> [#condExpr, e, t, f]
                          | "="   expr:rhs                                           -> [#set,  e, rhs]
                          | "+="  expr:rhs                                           -> [#mset, e, "+",  rhs]
                          | "-="  expr:rhs                                           -> [#mset, e, "-",  rhs]
                          | "*="  expr:rhs                                           -> [#mset, e, "*",  rhs]
                          | "/="  expr:rhs                                           -> [#mset, e, "/",  rhs]
                          | "%="  expr:rhs                                           -> [#mset, e, "%",  rhs]
                          | "&&=" expr:rhs                                           -> [#mset, e, "&&", rhs]
                          | "||=" expr:rhs                                           -> [#mset, e, "||", rhs]
                          | empty                                                    -> e
                          )
*/
"expr":function(){var e,rhs,t,f;return this._or((function(){return (function(){undefined;return (function(){e=this._apply("orExpr");return this._or((function(){return (function(){this._applyWithArgs("token","?");t=this._apply("expr");this._applyWithArgs("token",":");f=this._apply("expr");return ["condExpr",e,t,f]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","=");rhs=this._apply("expr");return ["set",e,rhs]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","+=");rhs=this._apply("expr");return ["mset",e,"+",rhs]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","-=");rhs=this._apply("expr");return ["mset",e,"-",rhs]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","*=");rhs=this._apply("expr");return ["mset",e,"*",rhs]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","/=");rhs=this._apply("expr");return ["mset",e,"/",rhs]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","%=");rhs=this._apply("expr");return ["mset",e,"%",rhs]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","&&=");rhs=this._apply("expr");return ["mset",e,"&&",rhs]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","||=");rhs=this._apply("expr");return ["mset",e,"||",rhs]}).call(this)}),(function(){return (function(){this._apply("empty");return e}).call(this)}))}).call(this)}).call(this)}))},

/*
  orExpr       = orExpr:x "||" andExpr:y                                             -> [#binop, "||", x, y]
               | andExpr
*/
"orExpr":function(){var y,x;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("orExpr");this._applyWithArgs("token","||");y=this._apply("andExpr");return ["binop","||",x,y]}).call(this)}),(function(){return (function(){return this._apply("andExpr")}).call(this)}))}).call(this)}))},

/*
  andExpr      = andExpr:x "&&" eqExpr:y                                             -> [#binop, "&&", x, y]
               | eqExpr
*/
"andExpr":function(){var y,x;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("andExpr");this._applyWithArgs("token","&&");y=this._apply("eqExpr");return ["binop","&&",x,y]}).call(this)}),(function(){return (function(){return this._apply("eqExpr")}).call(this)}))}).call(this)}))},

/*
  eqExpr       = eqExpr:x ( "=="  relExpr:y                                          -> [#binop, "==",  x, y]
                          | "!="  relExpr:y                                          -> [#binop, "!=",  x, y]
                          | "===" relExpr:y                                          -> [#binop, "===", x, y]
                          | "!==" relExpr:y                                          -> [#binop, "!==", x, y]
                          )
               | relExpr
*/
"eqExpr":function(){var y,x;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("eqExpr");return this._or((function(){return (function(){this._applyWithArgs("token","==");y=this._apply("relExpr");return ["binop","==",x,y]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","!=");y=this._apply("relExpr");return ["binop","!=",x,y]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","===");y=this._apply("relExpr");return ["binop","===",x,y]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","!==");y=this._apply("relExpr");return ["binop","!==",x,y]}).call(this)}))}).call(this)}),(function(){return (function(){return this._apply("relExpr")}).call(this)}))}).call(this)}))},

/*
  relExpr      = relExpr:x ( ">"          addExpr:y                                  -> [#binop, ">",          x, y]
                           | ">="         addExpr:y                                  -> [#binop, ">=",         x, y]
                           | "<"          addExpr:y                                  -> [#binop, "<",          x, y]
                           | "<="         addExpr:y                                  -> [#binop, "<=",         x, y]
                           | "instanceof" addExpr:y                                  -> [#binop, "instanceof", x, y]
                           )
               | addExpr
*/
"relExpr":function(){var y,x;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("relExpr");return this._or((function(){return (function(){this._applyWithArgs("token",">");y=this._apply("addExpr");return ["binop",">",x,y]}).call(this)}),(function(){return (function(){this._applyWithArgs("token",">=");y=this._apply("addExpr");return ["binop",">=",x,y]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","<");y=this._apply("addExpr");return ["binop","<",x,y]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","<=");y=this._apply("addExpr");return ["binop","<=",x,y]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","instanceof");y=this._apply("addExpr");return ["binop","instanceof",x,y]}).call(this)}))}).call(this)}),(function(){return (function(){return this._apply("addExpr")}).call(this)}))}).call(this)}))},

/*
  addExpr      = addExpr:x "+" mulExpr:y                                             -> [#binop, "+",          x, y]
               | addExpr:x "-" mulExpr:y                                             -> [#binop, "-",          x, y]
               | mulExpr
*/
"addExpr":function(){var y,x;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("addExpr");this._applyWithArgs("token","+");y=this._apply("mulExpr");return ["binop","+",x,y]}).call(this)}),(function(){return (function(){x=this._apply("addExpr");this._applyWithArgs("token","-");y=this._apply("mulExpr");return ["binop","-",x,y]}).call(this)}),(function(){return (function(){return this._apply("mulExpr")}).call(this)}))}).call(this)}))},

/*
  mulExpr      = mulExpr:x "*" unary:y                                               -> [#binop, "*",          x, y]
               | mulExpr:x "/" unary:y                                               -> [#binop, "/",          x, y]
               | mulExpr:x "%" unary:y                                               -> [#binop, "%",          x, y]
               | unary
*/
"mulExpr":function(){var y,x;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("mulExpr");this._applyWithArgs("token","*");y=this._apply("unary");return ["binop","*",x,y]}).call(this)}),(function(){return (function(){x=this._apply("mulExpr");this._applyWithArgs("token","/");y=this._apply("unary");return ["binop","/",x,y]}).call(this)}),(function(){return (function(){x=this._apply("mulExpr");this._applyWithArgs("token","%");y=this._apply("unary");return ["binop","%",x,y]}).call(this)}),(function(){return (function(){return this._apply("unary")}).call(this)}))}).call(this)}))},

/*
  unary        = "-"      postfix:p                                                  -> [#unop,  "-",        p]
               | "+"      postfix:p                                                  -> [#unop,  "+",        p]
               | "++"     postfix:p                                                  -> [#preop, "++",       p]
               | "--"     postfix:p                                                  -> [#preop, "--",       p]
               | "!"      unary:p                                                    -> [#unop,  "!",        p]
               | "void"   unary:p                                                    -> [#unop,  "void",     p]
               | "delete" unary:p                                                    -> [#unop,  "delete",   p]
               | "typeof" unary:p                                                    -> [#unop,  "typeof",   p]
               | postfix
*/
"unary":function(){var p;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("token","-");p=this._apply("postfix");return ["unop","-",p]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","+");p=this._apply("postfix");return ["unop","+",p]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","++");p=this._apply("postfix");return ["preop","++",p]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","--");p=this._apply("postfix");return ["preop","--",p]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","!");p=this._apply("unary");return ["unop","!",p]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","void");p=this._apply("unary");return ["unop","void",p]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","delete");p=this._apply("unary");return ["unop","delete",p]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","typeof");p=this._apply("unary");return ["unop","typeof",p]}).call(this)}),(function(){return (function(){return this._apply("postfix")}).call(this)}))}).call(this)}))},

/*
  postfix      = primExpr:p ( spacesNoNl "++"                                        -> [#postop, "++", p]
                            | spacesNoNl "--"                                        -> [#postop, "--", p]
                            | empty                                                  -> p
                            )
*/
"postfix":function(){var p;return this._or((function(){return (function(){undefined;return (function(){p=this._apply("primExpr");return this._or((function(){return (function(){this._apply("spacesNoNl");this._applyWithArgs("token","++");return ["postop","++",p]}).call(this)}),(function(){return (function(){this._apply("spacesNoNl");this._applyWithArgs("token","--");return ["postop","--",p]}).call(this)}),(function(){return (function(){this._apply("empty");return p}).call(this)}))}).call(this)}).call(this)}))},

/*
  primExpr     = primExpr:p ( "[" expr:i "]"                                         -> [#getp, i, p]
                            | "." "name":m "(" listOf(#expr, ','):as ")"             -> [#send, m, p].concat(as)
                            | "." "name":f                                           -> [#getp, [#string, f], p]
                            | "(" listOf(#expr, ','):as ")"                          -> [#call, p].concat(as)
                            )
               | primExprHd
*/
"primExpr":function(){var m,p,as,f,i;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){p=this._apply("primExpr");return this._or((function(){return (function(){this._applyWithArgs("token","[");i=this._apply("expr");this._applyWithArgs("token","]");return ["getp",i,p]}).call(this)}),(function(){return (function(){this._applyWithArgs("token",".");m=this._applyWithArgs("token","name");this._applyWithArgs("token","(");as=this._applyWithArgs("listOf","expr",",");this._applyWithArgs("token",")");return ["send",m,p].concat(as)}).call(this)}),(function(){return (function(){this._applyWithArgs("token",".");f=this._applyWithArgs("token","name");return ["getp",["string",f],p]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","(");as=this._applyWithArgs("listOf","expr",",");this._applyWithArgs("token",")");return ["call",p].concat(as)}).call(this)}))}).call(this)}),(function(){return (function(){return this._apply("primExprHd")}).call(this)}))}).call(this)}))},

/*
  primExprHd   = "(" expr:e ")"                                                      -> e
               | "this"                                                              -> [#this]
               | "name":n                                                            -> [#get, n]
               | "number":n                                                          -> [#number, n]
               | "string":s                                                          -> [#string, s]
               | "function" funcRest
               | "new" "name":n "(" listOf(#expr, ','):as ")"                        -> [#new, n].concat(as)
               | "[" listOf(#expr, ','):es "]"                                       -> [#arr].concat(es)
               | json
               | re
*/
"primExprHd":function(){var e,s,as,es,n;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("token","(");e=this._apply("expr");this._applyWithArgs("token",")");return e}).call(this)}),(function(){return (function(){this._applyWithArgs("token","this");return ["this"]}).call(this)}),(function(){return (function(){n=this._applyWithArgs("token","name");return ["get",n]}).call(this)}),(function(){return (function(){n=this._applyWithArgs("token","number");return ["number",n]}).call(this)}),(function(){return (function(){s=this._applyWithArgs("token","string");return ["string",s]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","function");return this._apply("funcRest")}).call(this)}),(function(){return (function(){this._applyWithArgs("token","new");n=this._applyWithArgs("token","name");this._applyWithArgs("token","(");as=this._applyWithArgs("listOf","expr",",");this._applyWithArgs("token",")");return ["new",n].concat(as)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","[");es=this._applyWithArgs("listOf","expr",",");this._applyWithArgs("token","]");return ["arr"].concat(es)}).call(this)}),(function(){return (function(){return this._apply("json")}).call(this)}),(function(){return (function(){return this._apply("re")}).call(this)}))}).call(this)}))},

/*
  json         = "{" listOf(#jsonBinding, ','):bs "}"                                -> [#json].concat(bs)
*/
"json":function(){var bs;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","{");bs=this._applyWithArgs("listOf","jsonBinding",",");this._applyWithArgs("token","}");return ["json"].concat(bs)}).call(this)}).call(this)}))},

/*
  jsonBinding  = jsonPropName:n ":" expr:v                                           -> [#binding, n, v]
*/
"jsonBinding":function(){var v,n;return this._or((function(){return (function(){undefined;return (function(){n=this._apply("jsonPropName");this._applyWithArgs("token",":");v=this._apply("expr");return ["binding",n,v]}).call(this)}).call(this)}))},

/*
  jsonPropName = "name" | "number" | "string"
*/
"jsonPropName":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._applyWithArgs("token","name")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","number")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","string")}).call(this)}))}).call(this)}))},

/*
  re           = spaces <'/' reBody '/' reFlag*>:x                                   -> [#regExpr, x]
*/
"re":function(){var x;return this._or((function(){return (function(){undefined;return (function(){this._apply("spaces");x=this._consumedBy((function(){return (function(){this._applyWithArgs("exactly","/");this._apply("reBody");this._applyWithArgs("exactly","/");return this._many((function(){return this._apply("reFlag")}))}).call(this)}));return ["regExpr",x]}).call(this)}).call(this)}))},

/*
  reBody       = re1stChar reChar*
*/
"reBody":function(){return this._or((function(){return (function(){undefined;return (function(){this._apply("re1stChar");return this._many((function(){return this._apply("reChar")}))}).call(this)}).call(this)}))},

/*
  re1stChar    = ~('*' | '\\' | '/' | '[') reNonTerm
               | escapeChar
               | reClass
*/
"re1stChar":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._not((function(){return this._or((function(){return (function(){return this._applyWithArgs("exactly","*")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","\\")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","/")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","[")}).call(this)}))}));return this._apply("reNonTerm")}).call(this)}),(function(){return (function(){return this._apply("escapeChar")}).call(this)}),(function(){return (function(){return this._apply("reClass")}).call(this)}))}).call(this)}))},

/*
  reChar       = re1stChar | '*'
*/
"reChar":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("re1stChar")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","*")}).call(this)}))}).call(this)}))},

/*
  reNonTerm    = ~('\n' | '\r') char
*/
"reNonTerm":function(){return this._or((function(){return (function(){undefined;return (function(){this._not((function(){return this._or((function(){return (function(){return this._applyWithArgs("exactly","\n")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","\r")}).call(this)}))}));return this._apply("char")}).call(this)}).call(this)}))},

/*
  reClass      = '[' reClassChar* ']'
*/
"reClass":function(){return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("exactly","[");this._many((function(){return this._apply("reClassChar")}));return this._applyWithArgs("exactly","]")}).call(this)}).call(this)}))},

/*
  reClassChar  = ~('[' | ']') reChar
*/
"reClassChar":function(){return this._or((function(){return (function(){undefined;return (function(){this._not((function(){return this._or((function(){return (function(){return this._applyWithArgs("exactly","[")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","]")}).call(this)}))}));return this._apply("reChar")}).call(this)}).call(this)}))},

/*
  reFlag       = nameFirst
*/
"reFlag":function(){return this._or((function(){return (function(){undefined;return (function(){return this._apply("nameFirst")}).call(this)}).call(this)}))},

/*
  formal       = spaces "name"
*/
"formal":function(){return this._or((function(){return (function(){undefined;return (function(){this._apply("spaces");return this._applyWithArgs("token","name")}).call(this)}).call(this)}))},

/*
  funcRest     = "(" listOf(#formal, ','):fs ")" "{" srcElems:body "}"               -> [#func, fs, body]
*/
"funcRest":function(){var fs,body;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","(");fs=this._applyWithArgs("listOf","formal",",");this._applyWithArgs("token",")");this._applyWithArgs("token","{");body=this._apply("srcElems");this._applyWithArgs("token","}");return ["func",fs,body]}).call(this)}).call(this)}))},

/*
  sc           = spacesNoNl ('\n' | &'}' | end)
               | ";"
*/
"sc":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._apply("spacesNoNl");return this._or((function(){return (function(){return this._applyWithArgs("exactly","\n")}).call(this)}),(function(){return (function(){return this._lookahead((function(){return this._applyWithArgs("exactly","}")}))}).call(this)}),(function(){return (function(){return this._apply("end")}).call(this)}))}).call(this)}),(function(){return (function(){return this._applyWithArgs("token",";")}).call(this)}))}).call(this)}))},

/*
  binding      = "name":n ( "=" expr
                          | empty -> [#get, 'undefined'] ):v                         -> [#var, n, v]
*/
"binding":function(){var v,n;return this._or((function(){return (function(){undefined;return (function(){n=this._applyWithArgs("token","name");v=this._or((function(){return (function(){this._applyWithArgs("token","=");return this._apply("expr")}).call(this)}),(function(){return (function(){this._apply("empty");return ["get","undefined"]}).call(this)}));return ["var",n,v]}).call(this)}).call(this)}))},

/*
  block        = "{" srcElems:ss "}"                                                 -> ss
*/
"block":function(){var ss;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","{");ss=this._apply("srcElems");this._applyWithArgs("token","}");return ss}).call(this)}).call(this)}))},

/*
  stmt         = block
               | "var" listOf(#binding, ','):bs sc                                   -> [#begin].concat(bs)
               | "if" "(" expr:c ")" stmt:t ( "else" stmt
                                            | empty -> [#get, 'undefined'] ):f       -> [#if, c, t, f]
               | "while" "(" expr:c ")" stmt:s                                       -> [#while,   c, s]
               | "do" stmt:s "while" "(" expr:c ")" sc                               -> [#doWhile, s, c]
               | "for" "(" ( "var" binding
                           | expr
                           | empty -> [#get, 'undefined'] ):i
                       ";" ( expr
                           | empty -> [#get, 'true']      ):c
                       ";" ( expr
                           | empty -> [#get, 'undefined'] ):u
                       ")" stmt:s                                                    -> [#for, i, c, u, s]
               | "for" "(" ( "var" "name":n -> [#var, n, [#get, 'undefined']]
                           | expr                                             ):v
                      "in" expr:e
                       ")" stmt:s                                                    -> [#forIn, v, e, s]
               | "switch" "(" expr:e ")" "{"
                   ( "case" expr:c ":" srcElems:cs -> [#case, c, cs]
                   | "default"     ":" srcElems:cs -> [#default, cs] )*:cs
                 "}"                                                                 -> [#switch, e].concat(cs)
               | "break" sc                                                          -> [#break]
               | "continue" sc                                                       -> [#continue]
               | "throw" spacesNoNl expr:e sc                                        -> [#throw, e]
               | "try" block:t "catch" "(" "name":e ")" block:c
                             ( "finally" block
                             | empty -> [#get, 'undefined'] ):f                      -> [#try, t, e, c, f]
               | "return" ( expr
                          | empty -> [#get, 'undefined'] ):e sc                      -> [#return, e]
               | "with" "(" expr:x ")" stmt:s                                        -> [#with, x, s]
               | expr:e sc                                                           -> e
               | ";"                                                                 -> [#get, "undefined"]
*/
"stmt":function(){var e,c,v,cs,u,x,s,t,bs,f,i,n;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("block")}).call(this)}),(function(){return (function(){this._applyWithArgs("token","var");bs=this._applyWithArgs("listOf","binding",",");this._apply("sc");return ["begin"].concat(bs)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","if");this._applyWithArgs("token","(");c=this._apply("expr");this._applyWithArgs("token",")");t=this._apply("stmt");f=this._or((function(){return (function(){this._applyWithArgs("token","else");return this._apply("stmt")}).call(this)}),(function(){return (function(){this._apply("empty");return ["get","undefined"]}).call(this)}));return ["if",c,t,f]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","while");this._applyWithArgs("token","(");c=this._apply("expr");this._applyWithArgs("token",")");s=this._apply("stmt");return ["while",c,s]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","do");s=this._apply("stmt");this._applyWithArgs("token","while");this._applyWithArgs("token","(");c=this._apply("expr");this._applyWithArgs("token",")");this._apply("sc");return ["doWhile",s,c]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","for");this._applyWithArgs("token","(");i=this._or((function(){return (function(){this._applyWithArgs("token","var");return this._apply("binding")}).call(this)}),(function(){return (function(){return this._apply("expr")}).call(this)}),(function(){return (function(){this._apply("empty");return ["get","undefined"]}).call(this)}));this._applyWithArgs("token",";");c=this._or((function(){return (function(){return this._apply("expr")}).call(this)}),(function(){return (function(){this._apply("empty");return ["get","true"]}).call(this)}));this._applyWithArgs("token",";");u=this._or((function(){return (function(){return this._apply("expr")}).call(this)}),(function(){return (function(){this._apply("empty");return ["get","undefined"]}).call(this)}));this._applyWithArgs("token",")");s=this._apply("stmt");return ["for",i,c,u,s]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","for");this._applyWithArgs("token","(");v=this._or((function(){return (function(){this._applyWithArgs("token","var");n=this._applyWithArgs("token","name");return ["var",n,["get","undefined"]]}).call(this)}),(function(){return (function(){return this._apply("expr")}).call(this)}));this._applyWithArgs("token","in");e=this._apply("expr");this._applyWithArgs("token",")");s=this._apply("stmt");return ["forIn",v,e,s]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","switch");this._applyWithArgs("token","(");e=this._apply("expr");this._applyWithArgs("token",")");this._applyWithArgs("token","{");cs=this._many((function(){return this._or((function(){return (function(){this._applyWithArgs("token","case");c=this._apply("expr");this._applyWithArgs("token",":");cs=this._apply("srcElems");return ["case",c,cs]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","default");this._applyWithArgs("token",":");cs=this._apply("srcElems");return ["default",cs]}).call(this)}))}));this._applyWithArgs("token","}");return ["switch",e].concat(cs)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","break");this._apply("sc");return ["break"]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","continue");this._apply("sc");return ["continue"]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","throw");this._apply("spacesNoNl");e=this._apply("expr");this._apply("sc");return ["throw",e]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","try");t=this._apply("block");this._applyWithArgs("token","catch");this._applyWithArgs("token","(");e=this._applyWithArgs("token","name");this._applyWithArgs("token",")");c=this._apply("block");f=this._or((function(){return (function(){this._applyWithArgs("token","finally");return this._apply("block")}).call(this)}),(function(){return (function(){this._apply("empty");return ["get","undefined"]}).call(this)}));return ["try",t,e,c,f]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","return");e=this._or((function(){return (function(){return this._apply("expr")}).call(this)}),(function(){return (function(){this._apply("empty");return ["get","undefined"]}).call(this)}));this._apply("sc");return ["return",e]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","with");this._applyWithArgs("token","(");x=this._apply("expr");this._applyWithArgs("token",")");s=this._apply("stmt");return ["with",x,s]}).call(this)}),(function(){return (function(){e=this._apply("expr");this._apply("sc");return e}).call(this)}),(function(){return (function(){this._applyWithArgs("token",";");return ["get","undefined"]}).call(this)}))}).call(this)}))},

/*
  srcElem      = "function" "name":n funcRest:f                                      -> [#var, n, f]
               | stmt
*/
"srcElem":function(){var f,n;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("token","function");n=this._applyWithArgs("token","name");f=this._apply("funcRest");return ["var",n,f]}).call(this)}),(function(){return (function(){return this._apply("stmt")}).call(this)}))}).call(this)}))},

/*
  srcElems     = srcElem*:ss                                                         -> [#begin].concat(ss)
*/
"srcElems":function(){var ss;return this._or((function(){return (function(){undefined;return (function(){ss=this._many((function(){return this._apply("srcElem")}));return ["begin"].concat(ss)}).call(this)}).call(this)}))},

/*

  topLevel     = srcElems:r spaces end                                               -> r

*/
"topLevel":function(){var r;return this._or((function(){return (function(){undefined;return (function(){r=this._apply("srcElems");this._apply("spaces");this._apply("end");return r}).call(this)}).call(this)}))}});(BSJSParser["hexDigits"]="0123456789abcdef");(BSJSParser["keywords"]=({}));(keywords=["break","case","catch","continue","default","delete","do","else","finally","for","function","if","in","instanceof","new","return","switch","this","throw","try","typeof","var","void","while","with","ometa"]);for(var idx=(0);(idx < keywords["length"]);idx++){(BSJSParser["keywords"][keywords[idx]]=true)}(BSJSParser["_isKeyword"]=(function (k){return this["keywords"].hasOwnProperty(k)}));var BSSemActionParser=BSJSParser.inherit({_grammarName: "BSSemActionParser",

/*
  curlySemAction = "{" expr:r sc "}" spaces                                  -> r
                 | "{" (srcElem:s &srcElem -> s)*:ss
                       ( expr:r sc -> [#return, r] | srcElem):s {ss.push(s)}
                   "}" spaces                                                -> [#send, #call,
                                                                                        [#func, [], [#begin].concat(ss)],
                                                                                        [#this]]
*/
"curlySemAction":function(){var s,ss,r;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("token","{");r=this._apply("expr");this._apply("sc");this._applyWithArgs("token","}");this._apply("spaces");return r}).call(this)}),(function(){return (function(){this._applyWithArgs("token","{");ss=this._many((function(){return (function(){s=this._apply("srcElem");this._lookahead((function(){return this._apply("srcElem")}));return s}).call(this)}));s=this._or((function(){return (function(){r=this._apply("expr");this._apply("sc");return ["return",r]}).call(this)}),(function(){return (function(){return this._apply("srcElem")}).call(this)}));ss.push(s);this._applyWithArgs("token","}");this._apply("spaces");return ["send","call",["func",[],["begin"].concat(ss)],["this"]]}).call(this)}))}).call(this)}))},

/*
  semAction      = curlySemAction
                 | primExpr:r spaces                                         -> r

*/
"semAction":function(){var r;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("curlySemAction")}).call(this)}),(function(){return (function(){r=this._apply("primExpr");this._apply("spaces");return r}).call(this)}))}).call(this)}))}});var BSJSTranslator=OMeta.inherit({_grammarName: "BSJSTranslator",

/*
  trans      = [:t apply(t):ans]     -> ans
*/
"trans":function(){var t,ans;return this._or((function(){return (function(){undefined;return (function(){this._form((function(){return (function(){t=this._apply("anything");return ans=this._applyWithArgs("apply",t)}).call(this)}));return ans}).call(this)}).call(this)}))},

/*
  curlyTrans = [#begin curlyTrans:r] -> r
             | [#begin trans*:rs]    -> ('{' + rs.join(';') + '}')
             | trans:r               -> ('{' + r + '}')
*/
"curlyTrans":function(){var rs,r;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._form((function(){return (function(){this._applyWithArgs("exactly","begin");return r=this._apply("curlyTrans")}).call(this)}));return r}).call(this)}),(function(){return (function(){this._form((function(){return (function(){this._applyWithArgs("exactly","begin");return rs=this._many((function(){return this._apply("trans")}))}).call(this)}));return (("{" + rs.join(";")) + "}")}).call(this)}),(function(){return (function(){r=this._apply("trans");return (("{" + r) + "}")}).call(this)}))}).call(this)}))},

/*

  this                                                  -> 'this'
*/
"this":function(){return this._or((function(){return (function(){return "this"}).call(this)}))},

/*
  break                                                 -> 'break'
*/
"break":function(){return this._or((function(){return (function(){return "break"}).call(this)}))},

/*
  continue                                              -> 'continue'
*/
"continue":function(){return this._or((function(){return (function(){return "continue"}).call(this)}))},

/*
  number   :n                                           -> ('(' + n + ')')
*/
"number":function(){var n;return this._or((function(){return (function(){n=this._apply("anything");return (("(" + n) + ")")}).call(this)}))},

/*
  string   :s                                           -> toProgramString(s)
*/
"string":function(){var s;return this._or((function(){return (function(){s=this._apply("anything");return toProgramString(s)}).call(this)}))},

/*
  regExpr  :x                                           -> x
*/
"regExpr":function(){var x;return this._or((function(){return (function(){x=this._apply("anything");return x}).call(this)}))},

/*
  arr      trans*:xs                                    -> ('[' + xs.join(',') + ']')
*/
"arr":function(){var xs;return this._or((function(){return (function(){xs=this._many((function(){return this._apply("trans")}));return (("[" + xs.join(",")) + "]")}).call(this)}))},

/*
  unop     :op trans:x                                  -> ('(' + op + ' ' + x + ')')
*/
"unop":function(){var op,x;return this._or((function(){return (function(){op=this._apply("anything");x=this._apply("trans");return (((("(" + op) + " ") + x) + ")")}).call(this)}))},

/*
  getp     trans:fd trans:x                             -> (x + '[' + fd + ']')
*/
"getp":function(){var x,fd;return this._or((function(){return (function(){fd=this._apply("trans");x=this._apply("trans");return (((x + "[") + fd) + "]")}).call(this)}))},

/*
  get      :x                                           -> x
*/
"get":function(){var x;return this._or((function(){return (function(){x=this._apply("anything");return x}).call(this)}))},

/*
  set      trans:lhs trans:rhs                          -> ('(' + lhs + '=' + rhs + ')')
*/
"set":function(){var rhs,lhs;return this._or((function(){return (function(){lhs=this._apply("trans");rhs=this._apply("trans");return (((("(" + lhs) + "=") + rhs) + ")")}).call(this)}))},

/*
  mset     trans:lhs :op trans:rhs                      -> ('(' + lhs + op + '=' + rhs + ')')
*/
"mset":function(){var op,rhs,lhs;return this._or((function(){return (function(){lhs=this._apply("trans");op=this._apply("anything");rhs=this._apply("trans");return ((((("(" + lhs) + op) + "=") + rhs) + ")")}).call(this)}))},

/*
  binop    :op trans:x trans:y                          -> ('(' + x + ' ' + op + ' ' + y + ')')
*/
"binop":function(){var y,op,x;return this._or((function(){return (function(){op=this._apply("anything");x=this._apply("trans");y=this._apply("trans");return (((((("(" + x) + " ") + op) + " ") + y) + ")")}).call(this)}))},

/*
  preop    :op trans:x                                  -> (op + x)
*/
"preop":function(){var op,x;return this._or((function(){return (function(){op=this._apply("anything");x=this._apply("trans");return (op + x)}).call(this)}))},

/*
  postop   :op trans:x                                  -> (x + op)
*/
"postop":function(){var op,x;return this._or((function(){return (function(){op=this._apply("anything");x=this._apply("trans");return (x + op)}).call(this)}))},

/*
  return   trans:x                                      -> ('return ' + x)
*/
"return":function(){var x;return this._or((function(){return (function(){x=this._apply("trans");return ("return " + x)}).call(this)}))},

/*
  with     trans:x curlyTrans:s                         -> ('with(' + x + ')' + s)
*/
"with":function(){var x,s;return this._or((function(){return (function(){x=this._apply("trans");s=this._apply("curlyTrans");return ((("with(" + x) + ")") + s)}).call(this)}))},

/*
  if       trans:cond curlyTrans:t curlyTrans:e         -> ('if(' + cond + ')' + t + 'else' + e)
*/
"if":function(){var e,t,cond;return this._or((function(){return (function(){cond=this._apply("trans");t=this._apply("curlyTrans");e=this._apply("curlyTrans");return ((((("if(" + cond) + ")") + t) + "else") + e)}).call(this)}))},

/*
  condExpr trans:cond trans:t trans:e                   -> ('(' + cond + '?' + t + ':' + e + ')')
*/
"condExpr":function(){var e,t,cond;return this._or((function(){return (function(){cond=this._apply("trans");t=this._apply("trans");e=this._apply("trans");return (((((("(" + cond) + "?") + t) + ":") + e) + ")")}).call(this)}))},

/*
  while    trans:cond curlyTrans:body                   -> ('while(' + cond + ')' + body)
*/
"while":function(){var body,cond;return this._or((function(){return (function(){cond=this._apply("trans");body=this._apply("curlyTrans");return ((("while(" + cond) + ")") + body)}).call(this)}))},

/*
  doWhile  curlyTrans:body trans:cond                   -> ('do' + body + 'while(' + cond + ')')
*/
"doWhile":function(){var body,cond;return this._or((function(){return (function(){body=this._apply("curlyTrans");cond=this._apply("trans");return (((("do" + body) + "while(") + cond) + ")")}).call(this)}))},

/*
  for      trans:init trans:cond trans:upd
           curlyTrans:body                              -> ('for(' + init + ';' + cond + ';' + upd + ')' + body)
*/
"for":function(){var init,body,cond,upd;return this._or((function(){return (function(){init=this._apply("trans");cond=this._apply("trans");upd=this._apply("trans");body=this._apply("curlyTrans");return ((((((("for(" + init) + ";") + cond) + ";") + upd) + ")") + body)}).call(this)}))},

/*
  forIn    trans:x trans:arr curlyTrans:body            -> ('for(' + x + ' in ' + arr + ')' + body)
*/
"forIn":function(){var x,arr,body;return this._or((function(){return (function(){x=this._apply("trans");arr=this._apply("trans");body=this._apply("curlyTrans");return ((((("for(" + x) + " in ") + arr) + ")") + body)}).call(this)}))},

/*
  begin    trans:x end                                  -> x,
  begin    (trans:x
              ( (?(x[x.length - 1] == '}') | end) -> x
              | empty                             -> (x  + ';')
              )
           )*:xs                                        -> ('{' + xs.join('') + '}')
*/
"begin":function(){var xs,x;return this._or((function(){return (function(){x=this._apply("trans");this._apply("end");return x}).call(this)}),(function(){return (function(){xs=this._many((function(){return (function(){x=this._apply("trans");return this._or((function(){return (function(){this._or((function(){return (function(){return this._pred((x[(x["length"] - (1))] == "}"))}).call(this)}),(function(){return (function(){return this._apply("end")}).call(this)}));return x}).call(this)}),(function(){return (function(){this._apply("empty");return (x + ";")}).call(this)}))}).call(this)}));return (("{" + xs.join("")) + "}")}).call(this)}))},

/*
  func     :args curlyTrans:body                        -> ('(function (' + args.join(',') + ')' + body + ')')
*/
"func":function(){var args,body;return this._or((function(){return (function(){args=this._apply("anything");body=this._apply("curlyTrans");return (((("(function (" + args.join(",")) + ")") + body) + ")")}).call(this)}))},

/*
  call     trans:fn trans*:args                         -> (fn + '(' + args.join(',') + ')')
*/
"call":function(){var fn,args;return this._or((function(){return (function(){fn=this._apply("trans");args=this._many((function(){return this._apply("trans")}));return (((fn + "(") + args.join(",")) + ")")}).call(this)}))},

/*
  send     :msg trans:recv trans*:args                  -> (recv + '.' + msg + '(' + args.join(',') + ')')
*/
"send":function(){var args,recv,msg;return this._or((function(){return (function(){msg=this._apply("anything");recv=this._apply("trans");args=this._many((function(){return this._apply("trans")}));return (((((recv + ".") + msg) + "(") + args.join(",")) + ")")}).call(this)}))},

/*
  new      :cls trans*:args                             -> ('new ' + cls + '(' + args.join(',') + ')')
*/
"new":function(){var args,cls;return this._or((function(){return (function(){cls=this._apply("anything");args=this._many((function(){return this._apply("trans")}));return (((("new " + cls) + "(") + args.join(",")) + ")")}).call(this)}))},

/*
  var      :name trans:val                              -> ('var ' + name + '=' + val)
*/
"var":function(){var val,name;return this._or((function(){return (function(){name=this._apply("anything");val=this._apply("trans");return ((("var " + name) + "=") + val)}).call(this)}))},

/*
  throw    trans:x                                      -> ('throw ' + x)
*/
"throw":function(){var x;return this._or((function(){return (function(){x=this._apply("trans");return ("throw " + x)}).call(this)}))},

/*
  try      curlyTrans:x :name curlyTrans:c curlyTrans:f -> ('try ' + x + 'catch(' + name + ')' + c + 'finally' + f)
*/
"try":function(){var c,x,f,name;return this._or((function(){return (function(){x=this._apply("curlyTrans");name=this._apply("anything");c=this._apply("curlyTrans");f=this._apply("curlyTrans");return ((((((("try " + x) + "catch(") + name) + ")") + c) + "finally") + f)}).call(this)}))},

/*
  json     trans*:props                                 -> ('({' + props.join(',') + '})')
*/
"json":function(){var props;return this._or((function(){return (function(){props=this._many((function(){return this._apply("trans")}));return (("({" + props.join(",")) + "})")}).call(this)}))},

/*
  binding  :name trans:val                              -> (toProgramString(name) + ': ' + val)
*/
"binding":function(){var val,name;return this._or((function(){return (function(){name=this._apply("anything");val=this._apply("trans");return ((toProgramString(name) + ": ") + val)}).call(this)}))},

/*
  switch   trans:x trans*:cases                         -> ('switch(' + x + '){' + cases.join(';') + '}')
*/
"switch":function(){var x,cases;return this._or((function(){return (function(){x=this._apply("trans");cases=this._many((function(){return this._apply("trans")}));return (((("switch(" + x) + "){") + cases.join(";")) + "}")}).call(this)}))},

/*
  case     trans:x trans:y                              -> ('case ' + x + ': '+ y)
*/
"case":function(){var y,x;return this._or((function(){return (function(){x=this._apply("trans");y=this._apply("trans");return ((("case " + x) + ": ") + y)}).call(this)}))},

/*
  default          trans:y                              -> ('default: ' + y)

*/
"default":function(){var y;return this._or((function(){return (function(){y=this._apply("trans");return ("default: " + y)}).call(this)}))}})}

{var BSOMetaParser=OMeta.inherit({_grammarName: "BSOMetaParser",

/*
  space          = ^space | fromTo('//', '\n') | fromTo('/*', '*\/')
*/
"space":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return OMeta._superApplyWithArgs(this,'space')}).call(this)}),(function(){return (function(){return this._applyWithArgs("fromTo","//","\n")}).call(this)}),(function(){return (function(){return this._applyWithArgs("fromTo","/*","*/")}).call(this)}))}).call(this)}))},

/*
  nameFirst      = '_' | '
  // <---------------------------------------- AUTOMATICALLY GENERATED CODE FROM GRAMMARS

  return {
    parser: BSOMetaJSParser,
    translator: BSOMetaJSTranslator
  }  
})();
 | letter
*/
"nameFirst":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._applyWithArgs("exactly","_")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","$")}).call(this)}),(function(){return (function(){return this._apply("letter")}).call(this)}))}).call(this)}))},

/*
  nameRest       = nameFirst | digit
*/
"nameRest":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("nameFirst")}).call(this)}),(function(){return (function(){return this._apply("digit")}).call(this)}))}).call(this)}))},

/*
  tsName         = <nameFirst nameRest*>
*/
"tsName":function(){return this._or((function(){return (function(){undefined;return (function(){return this._consumedBy((function(){return (function(){this._apply("nameFirst");return this._many((function(){return this._apply("nameRest")}))}).call(this)}))}).call(this)}).call(this)}))},

/*
  name           = spaces tsName
*/
"name":function(){return this._or((function(){return (function(){undefined;return (function(){this._apply("spaces");return this._apply("tsName")}).call(this)}).call(this)}))},

/*
  hexDigit       = char:x {this.hexDigits.indexOf(x.toLowerCase())}:v
                                                             ?(v >= 0) -> v
*/
"hexDigit":function(){var v,x;return this._or((function(){return (function(){undefined;return (function(){x=this._apply("char");v=this["hexDigits"].indexOf(x.toLowerCase());this._pred((v >= (0)));return v}).call(this)}).call(this)}))},

/*
  eChar          = <'\\' ( 'u' hexDigit hexDigit hexDigit hexDigit
                         | 'x' hexDigit hexDigit
                         | char                                   )>:s -> unescape(s)
                 | char
*/
"eChar":function(){var s;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){s=this._consumedBy((function(){return (function(){this._applyWithArgs("exactly","\\");return this._or((function(){return (function(){this._applyWithArgs("exactly","u");this._apply("hexDigit");this._apply("hexDigit");this._apply("hexDigit");return this._apply("hexDigit")}).call(this)}),(function(){return (function(){this._applyWithArgs("exactly","x");this._apply("hexDigit");return this._apply("hexDigit")}).call(this)}),(function(){return (function(){return this._apply("char")}).call(this)}))}).call(this)}));return unescape(s)}).call(this)}),(function(){return (function(){return this._apply("char")}).call(this)}))}).call(this)}))},

/*
  tsString       = '\'' (~'\'' eChar)*:xs '\''                         -> xs.join('')
*/
"tsString":function(){var xs;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("exactly","\'");xs=this._many((function(){return (function(){this._not((function(){return this._applyWithArgs("exactly","\'")}));return this._apply("eChar")}).call(this)}));this._applyWithArgs("exactly","\'");return xs.join("")}).call(this)}).call(this)}))},

/*
  characters     = '`' '`' (~('\'' '\'') eChar)*:xs '\'' '\''          -> [#App, #seq,     toProgramString(xs.join(''))]
*/
"characters":function(){var xs;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("exactly","`");this._applyWithArgs("exactly","`");xs=this._many((function(){return (function(){this._not((function(){return (function(){this._applyWithArgs("exactly","\'");return this._applyWithArgs("exactly","\'")}).call(this)}));return this._apply("eChar")}).call(this)}));this._applyWithArgs("exactly","\'");this._applyWithArgs("exactly","\'");return ["App","seq",toProgramString(xs.join(""))]}).call(this)}).call(this)}))},

/*
  sCharacters    = '"'     (~'"'         eChar)*:xs '"'                -> [#App, #token,   toProgramString(xs.join(''))]
*/
"sCharacters":function(){var xs;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("exactly","\"");xs=this._many((function(){return (function(){this._not((function(){return this._applyWithArgs("exactly","\"")}));return this._apply("eChar")}).call(this)}));this._applyWithArgs("exactly","\"");return ["App","token",toProgramString(xs.join(""))]}).call(this)}).call(this)}))},

/*
  string         = (('#' | '`') tsName | tsString):xs                  -> [#App, #exactly, toProgramString(xs)]
*/
"string":function(){var xs;return this._or((function(){return (function(){undefined;return (function(){xs=this._or((function(){return (function(){this._or((function(){return (function(){return this._applyWithArgs("exactly","#")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","`")}).call(this)}));return this._apply("tsName")}).call(this)}),(function(){return (function(){return this._apply("tsString")}).call(this)}));return ["App","exactly",toProgramString(xs)]}).call(this)}).call(this)}))},

/*
  number         = <'-'? digit+>:n                                     -> [#App, #exactly, n]
*/
"number":function(){var n;return this._or((function(){return (function(){undefined;return (function(){n=this._consumedBy((function(){return (function(){this._opt((function(){return this._applyWithArgs("exactly","-")}));return this._many1((function(){return this._apply("digit")}))}).call(this)}));return ["App","exactly",n]}).call(this)}).call(this)}))},

/*
  keyword :xs    = token(xs) ~letterOrDigit                            -> xs
*/
"keyword":function(){var xs;return this._or((function(){return (function(){(function(){return xs=this._apply("anything")}).call(this);return (function(){this._applyWithArgs("token",xs);this._not((function(){return this._apply("letterOrDigit")}));return xs}).call(this)}).call(this)}))},

/*
  args           = '(' listOf(#hostExpr, ','):xs ")"                   -> xs
                 | empty                                               -> []
*/
"args":function(){var xs;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("exactly","(");xs=this._applyWithArgs("listOf","hostExpr",",");this._applyWithArgs("token",")");return xs}).call(this)}),(function(){return (function(){this._apply("empty");return []}).call(this)}))}).call(this)}))},

/*
  application    = "^"          name:rule args:as                      -> [#App, "super",        "'" + rule + "'"].concat(as)
                 | name:grm "." name:rule args:as                      -> [#App, "foreign", grm, "'" + rule + "'"].concat(as)
                 |              name:rule args:as                      -> [#App, rule].concat(as)
*/
"application":function(){var grm,rule,as;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("token","^");rule=this._apply("name");as=this._apply("args");return ["App","super",(("\'" + rule) + "\'")].concat(as)}).call(this)}),(function(){return (function(){grm=this._apply("name");this._applyWithArgs("token",".");rule=this._apply("name");as=this._apply("args");return ["App","foreign",grm,(("\'" + rule) + "\'")].concat(as)}).call(this)}),(function(){return (function(){rule=this._apply("name");as=this._apply("args");return ["App",rule].concat(as)}).call(this)}))}).call(this)}))},

/*
  hostExpr       = BSSemActionParser.expr:r                               BSJSTranslator.trans(r)
*/
"hostExpr":function(){var r;return this._or((function(){return (function(){undefined;return (function(){r=this._applyWithArgs("foreign",BSSemActionParser,'expr');return this._applyWithArgs("foreign",BSJSTranslator,'trans',r)}).call(this)}).call(this)}))},

/*
  curlyHostExpr  = BSSemActionParser.curlySemAction:r                     BSJSTranslator.trans(r)
*/
"curlyHostExpr":function(){var r;return this._or((function(){return (function(){undefined;return (function(){r=this._applyWithArgs("foreign",BSSemActionParser,'curlySemAction');return this._applyWithArgs("foreign",BSJSTranslator,'trans',r)}).call(this)}).call(this)}))},

/*
  primHostExpr   = BSSemActionParser.semAction:r                          BSJSTranslator.trans(r)
*/
"primHostExpr":function(){var r;return this._or((function(){return (function(){undefined;return (function(){r=this._applyWithArgs("foreign",BSSemActionParser,'semAction');return this._applyWithArgs("foreign",BSJSTranslator,'trans',r)}).call(this)}).call(this)}))},

/*
  atomicHostExpr = curlyHostExpr | primHostExpr
*/
"atomicHostExpr":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("curlyHostExpr")}).call(this)}),(function(){return (function(){return this._apply("primHostExpr")}).call(this)}))}).call(this)}))},

/*
  semAction      = curlyHostExpr:x                                     -> [#Act, x]
                 | "!"  atomicHostExpr:x                               -> [#Act, x]
*/
"semAction":function(){var x;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("curlyHostExpr");return ["Act",x]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","!");x=this._apply("atomicHostExpr");return ["Act",x]}).call(this)}))}).call(this)}))},

/*
  arrSemAction   = "->" atomicHostExpr:x                               -> [#Act, x]
*/
"arrSemAction":function(){var x;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","->");x=this._apply("atomicHostExpr");return ["Act",x]}).call(this)}).call(this)}))},

/*
  semPred        = "?"  atomicHostExpr:x                               -> [#Pred, x]
*/
"semPred":function(){var x;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","?");x=this._apply("atomicHostExpr");return ["Pred",x]}).call(this)}).call(this)}))},

/*
  expr           = expr5(true):x ("|"  expr5(true))+:xs                -> [#Or,  x].concat(xs)
                 | expr5(true):x ("||" expr5(true))+:xs                -> [#XOr, x].concat(xs)
                 | expr5(false)
*/
"expr":function(){var xs,x;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._applyWithArgs("expr5",true);xs=this._many1((function(){return (function(){this._applyWithArgs("token","|");return this._applyWithArgs("expr5",true)}).call(this)}));return ["Or",x].concat(xs)}).call(this)}),(function(){return (function(){x=this._applyWithArgs("expr5",true);xs=this._many1((function(){return (function(){this._applyWithArgs("token","||");return this._applyWithArgs("expr5",true)}).call(this)}));return ["XOr",x].concat(xs)}).call(this)}),(function(){return (function(){return this._applyWithArgs("expr5",false)}).call(this)}))}).call(this)}))},

/*
  expr5 :ne      = interleavePart:x ("&&" interleavePart)+:xs          -> [#Interleave, x].concat(xs)
                 | expr4(ne)
*/
"expr5":function(){var xs,x,ne;return this._or((function(){return (function(){(function(){return ne=this._apply("anything")}).call(this);return this._or((function(){return (function(){x=this._apply("interleavePart");xs=this._many1((function(){return (function(){this._applyWithArgs("token","&&");return this._apply("interleavePart")}).call(this)}));return ["Interleave",x].concat(xs)}).call(this)}),(function(){return (function(){return this._applyWithArgs("expr4",ne)}).call(this)}))}).call(this)}))},

/*
  interleavePart = "(" expr4(true):part ")"                            -> ["1", part]
                 | expr4(true):part modedIPart(part)
*/
"interleavePart":function(){var part;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("token","(");part=this._applyWithArgs("expr4",true);this._applyWithArgs("token",")");return ["1",part]}).call(this)}),(function(){return (function(){part=this._applyWithArgs("expr4",true);return this._applyWithArgs("modedIPart",part)}).call(this)}))}).call(this)}))},

/*
  modedIPart     = [#And [#Many  :part]]                               -> ["*", part]
                 | [#And [#Many1 :part]]                               -> ["+", part]
                 | [#And [#Opt   :part]]                               -> ["?", part]
                 | :part                                               -> ["1", part]
*/
"modedIPart":function(){var part;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._form((function(){return (function(){this._applyWithArgs("exactly","And");return this._form((function(){return (function(){this._applyWithArgs("exactly","Many");return part=this._apply("anything")}).call(this)}))}).call(this)}));return ["*",part]}).call(this)}),(function(){return (function(){this._form((function(){return (function(){this._applyWithArgs("exactly","And");return this._form((function(){return (function(){this._applyWithArgs("exactly","Many1");return part=this._apply("anything")}).call(this)}))}).call(this)}));return ["+",part]}).call(this)}),(function(){return (function(){this._form((function(){return (function(){this._applyWithArgs("exactly","And");return this._form((function(){return (function(){this._applyWithArgs("exactly","Opt");return part=this._apply("anything")}).call(this)}))}).call(this)}));return ["?",part]}).call(this)}),(function(){return (function(){part=this._apply("anything");return ["1",part]}).call(this)}))}).call(this)}))},

/*
  expr4 :ne      =                expr3*:xs arrSemAction:act           -> [#And].concat(xs).concat([act])
                 | ?ne            expr3+:xs                            -> [#And].concat(xs)
                 | ?(ne == false) expr3*:xs                            -> [#And].concat(xs)
*/
"expr4":function(){var xs,act,ne;return this._or((function(){return (function(){(function(){return ne=this._apply("anything")}).call(this);return this._or((function(){return (function(){xs=this._many((function(){return this._apply("expr3")}));act=this._apply("arrSemAction");return ["And"].concat(xs).concat([act])}).call(this)}),(function(){return (function(){this._pred(ne);xs=this._many1((function(){return this._apply("expr3")}));return ["And"].concat(xs)}).call(this)}),(function(){return (function(){this._pred((ne == false));xs=this._many((function(){return this._apply("expr3")}));return ["And"].concat(xs)}).call(this)}))}).call(this)}))},

/*
  optIter :x     = '*'                                                 -> [#Many,  x]
                 | '+'                                                 -> [#Many1, x]
                 | '?'                                                 -> [#Opt,   x]
                 | empty                                               -> x
*/
"optIter":function(){var x;return this._or((function(){return (function(){(function(){return x=this._apply("anything")}).call(this);return this._or((function(){return (function(){this._applyWithArgs("exactly","*");return ["Many",x]}).call(this)}),(function(){return (function(){this._applyWithArgs("exactly","+");return ["Many1",x]}).call(this)}),(function(){return (function(){this._applyWithArgs("exactly","?");return ["Opt",x]}).call(this)}),(function(){return (function(){this._apply("empty");return x}).call(this)}))}).call(this)}))},

/*
  optBind :x     = ':' name:n                                          -> { this.locals[n] = true; [#Set, n, x] }
                 | empty                                               -> x
*/
"optBind":function(){var x,n;return this._or((function(){return (function(){(function(){return x=this._apply("anything")}).call(this);return this._or((function(){return (function(){this._applyWithArgs("exactly",":");n=this._apply("name");return (function (){(this["locals"][n]=true);return ["Set",n,x]}).call(this)}).call(this)}),(function(){return (function(){this._apply("empty");return x}).call(this)}))}).call(this)}))},

/*
  expr3          = ":" name:n                                          -> { this.locals[n] = true; [#Set, n, [#App, #anything]] }
                 | (expr2:x optIter(x) | semAction):e optBind(e)
                 | semPred
*/
"expr3":function(){var e,x,n;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("token",":");n=this._apply("name");return (function (){(this["locals"][n]=true);return ["Set",n,["App","anything"]]}).call(this)}).call(this)}),(function(){return (function(){e=this._or((function(){return (function(){x=this._apply("expr2");return this._applyWithArgs("optIter",x)}).call(this)}),(function(){return (function(){return this._apply("semAction")}).call(this)}));return this._applyWithArgs("optBind",e)}).call(this)}),(function(){return (function(){return this._apply("semPred")}).call(this)}))}).call(this)}))},

/*
  expr2          = "~" expr2:x                                         -> [#Not,       x]
                 | "&" expr1:x                                         -> [#Lookahead, x]
                 | expr1
*/
"expr2":function(){var x;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("token","~");x=this._apply("expr2");return ["Not",x]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","&");x=this._apply("expr1");return ["Lookahead",x]}).call(this)}),(function(){return (function(){return this._apply("expr1")}).call(this)}))}).call(this)}))},

/*
  expr1          = application 
                 | ( keyword('undefined') | keyword('nil')
                   | keyword('true')      | keyword('false') ):x       -> [#App, #exactly, x]
                 | spaces (characters | sCharacters | string | number)
                 | "["  expr:x "]"                                     -> [#Form,      x]
                 | "<"  expr:x ">"                                     -> [#ConsBy,    x]
                 | "@<" expr:x ">"                                     -> [#IdxConsBy, x]
                 | "("  expr:x ")"                                     -> x
*/
"expr1":function(){var x;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("application")}).call(this)}),(function(){return (function(){x=this._or((function(){return (function(){return this._applyWithArgs("keyword","undefined")}).call(this)}),(function(){return (function(){return this._applyWithArgs("keyword","nil")}).call(this)}),(function(){return (function(){return this._applyWithArgs("keyword","true")}).call(this)}),(function(){return (function(){return this._applyWithArgs("keyword","false")}).call(this)}));return ["App","exactly",x]}).call(this)}),(function(){return (function(){this._apply("spaces");return this._or((function(){return (function(){return this._apply("characters")}).call(this)}),(function(){return (function(){return this._apply("sCharacters")}).call(this)}),(function(){return (function(){return this._apply("string")}).call(this)}),(function(){return (function(){return this._apply("number")}).call(this)}))}).call(this)}),(function(){return (function(){this._applyWithArgs("token","[");x=this._apply("expr");this._applyWithArgs("token","]");return ["Form",x]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","<");x=this._apply("expr");this._applyWithArgs("token",">");return ["ConsBy",x]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","@<");x=this._apply("expr");this._applyWithArgs("token",">");return ["IdxConsBy",x]}).call(this)}),(function(){return (function(){this._applyWithArgs("token","(");x=this._apply("expr");this._applyWithArgs("token",")");return x}).call(this)}))}).call(this)}))},

/*
  ruleName       = name
                 | spaces tsString
*/
"ruleName":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("name")}).call(this)}),(function(){return (function(){this._apply("spaces");return this._apply("tsString")}).call(this)}))}).call(this)}))},

/*
  rule           = < &(ruleName:n) !(this.locals = {})
                     rulePart(n):x ("," rulePart(n))*:xs >:src         -> [#Rule, n, Object.getOwnPropertyNames(this.locals),
                                                                            [#Or, x].concat(xs), src]
*/
"rule":function(){var src,xs,x,n;return this._or((function(){return (function(){undefined;return (function(){src=this._consumedBy((function(){return (function(){this._lookahead((function(){return (function(){return n=this._apply("ruleName")}).call(this)}));(this["locals"]=({}));x=this._applyWithArgs("rulePart",n);return xs=this._many((function(){return (function(){this._applyWithArgs("token",",");return this._applyWithArgs("rulePart",n)}).call(this)}))}).call(this)}));return ["Rule",n,Object.getOwnPropertyNames(this["locals"]),["Or",x].concat(xs),src]}).call(this)}).call(this)}))},

/*
  rulePart :rn   = ruleName:n ?(n == rn) expr4(false):b1 ( "=" expr:b2 -> [#And, b1, b2]
                                                         | empty       -> b1
                                                         )
*/
"rulePart":function(){var b2,b1,n,rn;return this._or((function(){return (function(){(function(){return rn=this._apply("anything")}).call(this);return (function(){n=this._apply("ruleName");this._pred((n == rn));b1=this._applyWithArgs("expr4",false);return this._or((function(){return (function(){this._applyWithArgs("token","=");b2=this._apply("expr");return ["And",b1,b2]}).call(this)}),(function(){return (function(){this._apply("empty");return b1}).call(this)}))}).call(this)}).call(this)}))},

/*
  grammar        = keyword('ometa') name:n
                     ( "<:" name | empty -> 'OMeta' ):sn
                     "{" listOf(#rule, ','):rs "}"                        BSOMetaOptimizer.optimizeGrammar(
                                                                            [#Grammar, n, sn].concat(rs)
                                                                          )
*/
"grammar":function(){var sn,rs,n;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("keyword","ometa");n=this._apply("name");sn=this._or((function(){return (function(){this._applyWithArgs("token","<:");return this._apply("name")}).call(this)}),(function(){return (function(){this._apply("empty");return "OMeta"}).call(this)}));this._applyWithArgs("token","{");rs=this._applyWithArgs("listOf","rule",",");this._applyWithArgs("token","}");return this._applyWithArgs("foreign",BSOMetaOptimizer,'optimizeGrammar',["Grammar",n,sn].concat(rs))}).call(this)}).call(this)}))}});(BSOMetaParser["hexDigits"]="0123456789abcdef");var BSOMetaTranslator=OMeta.inherit({_grammarName: "BSOMetaTranslator",

/*
  App        'super' anything+:args        -> [this.sName, '._superApplyWithArgs(this,', args.join(','), ')']      .join(''),
  App        :rule   anything+:args        -> ['this._applyWithArgs("', rule, '",',      args.join(','), ')']      .join(''),
  App        :rule                         -> ['this._apply("', rule, '")']                                        .join('')
*/
"App":function(){var args,rule;return this._or((function(){return (function(){this._applyWithArgs("exactly","super");args=this._many1((function(){return this._apply("anything")}));return [this["sName"],"._superApplyWithArgs(this,",args.join(","),")"].join("")}).call(this)}),(function(){return (function(){rule=this._apply("anything");args=this._many1((function(){return this._apply("anything")}));return ["this._applyWithArgs(\"",rule,"\",",args.join(","),")"].join("")}).call(this)}),(function(){return (function(){rule=this._apply("anything");return ["this._apply(\"",rule,"\")"].join("")}).call(this)}))},

/*
  Act        :expr                         -> expr
*/
"Act":function(){var expr;return this._or((function(){return (function(){expr=this._apply("anything");return expr}).call(this)}))},

/*
  Pred       :expr                         -> ['this._pred(', expr, ')']                                           .join('')
*/
"Pred":function(){var expr;return this._or((function(){return (function(){expr=this._apply("anything");return ["this._pred(",expr,")"].join("")}).call(this)}))},

/*
  Or         transFn*:xs                   -> ['this._or(',  xs.join(','), ')']                                    .join('')
*/
"Or":function(){var xs;return this._or((function(){return (function(){xs=this._many((function(){return this._apply("transFn")}));return ["this._or(",xs.join(","),")"].join("")}).call(this)}))},

/*
  XOr        transFn*:xs                       {xs.unshift(toProgramString(this.name + "." + this.rName))}
                                           -> ['this._xor(', xs.join(','), ')']                                    .join('')
*/
"XOr":function(){var xs;return this._or((function(){return (function(){xs=this._many((function(){return this._apply("transFn")}));xs.unshift(toProgramString(((this["name"] + ".") + this["rName"])));return ["this._xor(",xs.join(","),")"].join("")}).call(this)}))},

/*
  And        notLast(#trans)*:xs trans:y
             {xs.push('return ' + y)}      -> ['(function(){', xs.join(';'), '}).call(this)']                      .join(''),
  And                                      -> 'undefined'
*/
"And":function(){var xs,y;return this._or((function(){return (function(){xs=this._many((function(){return this._applyWithArgs("notLast","trans")}));y=this._apply("trans");xs.push(("return " + y));return ["(function(){",xs.join(";"),"}).call(this)"].join("")}).call(this)}),(function(){return (function(){return "undefined"}).call(this)}))},

/*
  Opt        transFn:x                     -> ['this._opt(',           x, ')']                                     .join('')
*/
"Opt":function(){var x;return this._or((function(){return (function(){x=this._apply("transFn");return ["this._opt(",x,")"].join("")}).call(this)}))},

/*
  Many       transFn:x                     -> ['this._many(',          x, ')']                                     .join('')
*/
"Many":function(){var x;return this._or((function(){return (function(){x=this._apply("transFn");return ["this._many(",x,")"].join("")}).call(this)}))},

/*
  Many1      transFn:x                     -> ['this._many1(',         x, ')']                                     .join('')
*/
"Many1":function(){var x;return this._or((function(){return (function(){x=this._apply("transFn");return ["this._many1(",x,")"].join("")}).call(this)}))},

/*
  Set        :n trans:v                    -> [n, '=', v]                                                          .join('')
*/
"Set":function(){var v,n;return this._or((function(){return (function(){n=this._apply("anything");v=this._apply("trans");return [n,"=",v].join("")}).call(this)}))},

/*
  Not        transFn:x                     -> ['this._not(',           x, ')']                                     .join('')
*/
"Not":function(){var x;return this._or((function(){return (function(){x=this._apply("transFn");return ["this._not(",x,")"].join("")}).call(this)}))},

/*
  Lookahead  transFn:x                     -> ['this._lookahead(',     x, ')']                                     .join('')
*/
"Lookahead":function(){var x;return this._or((function(){return (function(){x=this._apply("transFn");return ["this._lookahead(",x,")"].join("")}).call(this)}))},

/*
  Form       transFn:x                     -> ['this._form(',          x, ')']                                     .join('')
*/
"Form":function(){var x;return this._or((function(){return (function(){x=this._apply("transFn");return ["this._form(",x,")"].join("")}).call(this)}))},

/*
  ConsBy     transFn:x                     -> ['this._consumedBy(',    x, ')']                                     .join('')
*/
"ConsBy":function(){var x;return this._or((function(){return (function(){x=this._apply("transFn");return ["this._consumedBy(",x,")"].join("")}).call(this)}))},

/*
  IdxConsBy  transFn:x                     -> ['this._idxConsumedBy(', x, ')']                                     .join('')
*/
"IdxConsBy":function(){var x;return this._or((function(){return (function(){x=this._apply("transFn");return ["this._idxConsumedBy(",x,")"].join("")}).call(this)}))},

/*
  JumpTable  jtCase*:cases                 -> this.jumpTableCode(cases)
*/
"JumpTable":function(){var cases;return this._or((function(){return (function(){cases=this._many((function(){return this._apply("jtCase")}));return this.jumpTableCode(cases)}).call(this)}))},

/*
  Interleave intPart*:xs                   -> ['this._interleave(', xs.join(','), ')']                             .join('')
*/
"Interleave":function(){var xs;return this._or((function(){return (function(){xs=this._many((function(){return this._apply("intPart")}));return ["this._interleave(",xs.join(","),")"].join("")}).call(this)}))},

/*
  
  Rule       :name {this.rName = name}
             locals:ls trans:body :src     -> ['\n\n/*', src.replace(/\*\//g,'*\\/'), 
                                               '\n*\/\n"', name, '":function(){', ls, 'return ', body, '}']         .join('')
*/
"Rule":function(){var src,ls,body,name;return this._or((function(){return (function(){name=this._apply("anything");(this["rName"]=name);ls=this._apply("locals");body=this._apply("trans");src=this._apply("anything");return ["\n\n/*",src.replace(/\*\//g,"*\\/"),"\n*/\n\"",name,"\":function(){",ls,"return ",body,"}"].join("")}).call(this)}))},

/*
  Grammar    :name :sName
             {this.name = name}
             {this.sName = sName}
             trans*:rules                  -> ['var ', name, '=', sName,'.inherit({', 
                                                        ['_grammarName: "'+name+'"'].concat(rules).join(','), '})'].join('')
*/
"Grammar":function(){var rules,name,sName;return this._or((function(){return (function(){name=this._apply("anything");sName=this._apply("anything");(this["name"]=name);(this["sName"]=sName);rules=this._many((function(){return this._apply("trans")}));return ["var ",name,"=",sName,".inherit({",[(("_grammarName: \"" + name) + "\"")].concat(rules).join(","),"})"].join("")}).call(this)}))},

/*
  intPart  = [:mode transFn:part]          -> (toProgramString(mode)  + "," + part)
*/
"intPart":function(){var mode,part;return this._or((function(){return (function(){undefined;return (function(){this._form((function(){return (function(){mode=this._apply("anything");return part=this._apply("transFn")}).call(this)}));return ((toProgramString(mode) + ",") + part)}).call(this)}).call(this)}))},

/*
  jtCase   = [:x trans:e]                  -> [toProgramString(x), e]
*/
"jtCase":function(){var e,x;return this._or((function(){return (function(){undefined;return (function(){this._form((function(){return (function(){x=this._apply("anything");return e=this._apply("trans")}).call(this)}));return [toProgramString(x),e]}).call(this)}).call(this)}))},

/*
  locals   = [string+:vs]                  -> ['var ', vs.join(','), ';']                                          .join('')
           | []                            -> ''
*/
"locals":function(){var vs;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._form((function(){return (function(){return vs=this._many1((function(){return this._apply("string")}))}).call(this)}));return ["var ",vs.join(","),";"].join("")}).call(this)}),(function(){return (function(){this._form((function(){return undefined}));return ""}).call(this)}))}).call(this)}))},

/*
  trans    = [:t apply(t):ans]             -> ans
*/
"trans":function(){var t,ans;return this._or((function(){return (function(){undefined;return (function(){this._form((function(){return (function(){t=this._apply("anything");return ans=this._applyWithArgs("apply",t)}).call(this)}));return ans}).call(this)}).call(this)}))},

/*
  transFn  = trans:x                       -> ['(function(){return ', x, '})']                                     .join('')

*/
"transFn":function(){var x;return this._or((function(){return (function(){undefined;return (function(){x=this._apply("trans");return ["(function(){return ",x,"})"].join("")}).call(this)}).call(this)}))}});(BSOMetaTranslator["jumpTableCode"]=(function (cases){var buf=new StringBuffer();buf.nextPutAll("(function(){switch(this._apply(\'anything\')){");for(var i=(0);(i < cases["length"]);(i+=(1))){buf.nextPutAll((((("case " + cases[i][(0)]) + ":return ") + cases[i][(1)]) + ";"))};buf.nextPutAll("default: this.bt.mismatch(\'Jumptable did not match\')}}).call(this)");return buf.contents()}))}

{var BSNullOptimization=OMeta.inherit({_grammarName: "BSNullOptimization",

/*
  setHelped = !(this._didSomething = true)
*/
"setHelped":function(){return this._or((function(){return (function(){undefined;return (function(){return (this["_didSomething"]=true)}).call(this)}).call(this)}))},

/*
  helped    = ?this._didSomething
*/
"helped":function(){return this._or((function(){return (function(){undefined;return (function(){return this._pred(this["_didSomething"])}).call(this)}).call(this)}))},

/*
  trans     = [:t ?(this[t] != undefined) apply(t):ans] -> ans
*/
"trans":function(){var t,ans;return this._or((function(){return (function(){undefined;return (function(){this._form((function(){return (function(){t=this._apply("anything");this._pred((this[t] != undefined));return ans=this._applyWithArgs("apply",t)}).call(this)}));return ans}).call(this)}).call(this)}))},

/*
  optimize  = trans:x helped                         -> x
*/
"optimize":function(){var x;return this._or((function(){return (function(){undefined;return (function(){x=this._apply("trans");this._apply("helped");return x}).call(this)}).call(this)}))},

/*

  App        :rule anything*:args          -> ['App', rule].concat(args)
*/
"App":function(){var args,rule;return this._or((function(){return (function(){rule=this._apply("anything");args=this._many((function(){return this._apply("anything")}));return ["App",rule].concat(args)}).call(this)}))},

/*
  Act        :expr                         -> ['Act', expr]
*/
"Act":function(){var expr;return this._or((function(){return (function(){expr=this._apply("anything");return ["Act",expr]}).call(this)}))},

/*
  Pred       :expr                         -> ['Pred', expr]
*/
"Pred":function(){var expr;return this._or((function(){return (function(){expr=this._apply("anything");return ["Pred",expr]}).call(this)}))},

/*
  Or         trans*:xs                     -> ['Or'].concat(xs)
*/
"Or":function(){var xs;return this._or((function(){return (function(){xs=this._many((function(){return this._apply("trans")}));return ["Or"].concat(xs)}).call(this)}))},

/*
  XOr        trans*:xs                     -> ['XOr'].concat(xs)
*/
"XOr":function(){var xs;return this._or((function(){return (function(){xs=this._many((function(){return this._apply("trans")}));return ["XOr"].concat(xs)}).call(this)}))},

/*
  And        trans*:xs                     -> ['And'].concat(xs)
*/
"And":function(){var xs;return this._or((function(){return (function(){xs=this._many((function(){return this._apply("trans")}));return ["And"].concat(xs)}).call(this)}))},

/*
  Opt        trans:x                       -> ['Opt',  x]
*/
"Opt":function(){var x;return this._or((function(){return (function(){x=this._apply("trans");return ["Opt",x]}).call(this)}))},

/*
  Many       trans:x                       -> ['Many',  x]
*/
"Many":function(){var x;return this._or((function(){return (function(){x=this._apply("trans");return ["Many",x]}).call(this)}))},

/*
  Many1      trans:x                       -> ['Many1', x]
*/
"Many1":function(){var x;return this._or((function(){return (function(){x=this._apply("trans");return ["Many1",x]}).call(this)}))},

/*
  Set        :n trans:v                    -> ['Set', n, v]
*/
"Set":function(){var v,n;return this._or((function(){return (function(){n=this._apply("anything");v=this._apply("trans");return ["Set",n,v]}).call(this)}))},

/*
  Not        trans:x                       -> ['Not',       x]
*/
"Not":function(){var x;return this._or((function(){return (function(){x=this._apply("trans");return ["Not",x]}).call(this)}))},

/*
  Lookahead  trans:x                       -> ['Lookahead', x]
*/
"Lookahead":function(){var x;return this._or((function(){return (function(){x=this._apply("trans");return ["Lookahead",x]}).call(this)}))},

/*
  Form       trans:x                       -> ['Form',      x]
*/
"Form":function(){var x;return this._or((function(){return (function(){x=this._apply("trans");return ["Form",x]}).call(this)}))},

/*
  ConsBy     trans:x                       -> ['ConsBy',    x]
*/
"ConsBy":function(){var x;return this._or((function(){return (function(){x=this._apply("trans");return ["ConsBy",x]}).call(this)}))},

/*
  IdxConsBy  trans:x                       -> ['IdxConsBy', x]
*/
"IdxConsBy":function(){var x;return this._or((function(){return (function(){x=this._apply("trans");return ["IdxConsBy",x]}).call(this)}))},

/*
  JumpTable  ([:c trans:e] -> [c, e])*:ces -> ['JumpTable'].concat(ces)
*/
"JumpTable":function(){var e,c,ces;return this._or((function(){return (function(){ces=this._many((function(){return (function(){this._form((function(){return (function(){c=this._apply("anything");return e=this._apply("trans")}).call(this)}));return [c,e]}).call(this)}));return ["JumpTable"].concat(ces)}).call(this)}))},

/*
  Interleave ([:m trans:p] -> [m, p])*:xs  -> ['Interleave'].concat(xs)
*/
"Interleave":function(){var xs,m,p;return this._or((function(){return (function(){xs=this._many((function(){return (function(){this._form((function(){return (function(){m=this._apply("anything");return p=this._apply("trans")}).call(this)}));return [m,p]}).call(this)}));return ["Interleave"].concat(xs)}).call(this)}))},

/*
  Rule       :name :ls trans:body          -> ['Rule', name, ls, body]

*/
"Rule":function(){var ls,body,name;return this._or((function(){return (function(){name=this._apply("anything");ls=this._apply("anything");body=this._apply("trans");return ["Rule",name,ls,body]}).call(this)}))}});(BSNullOptimization["initialize"]=(function (){(this["_didSomething"]=false)}));var BSAssociativeOptimization=BSNullOptimization.inherit({_grammarName: "BSAssociativeOptimization",

/*
  And trans:x end           setHelped -> x,
  And transInside('And'):xs           -> ['And'].concat(xs)
*/
"And":function(){var xs,x;return this._or((function(){return (function(){x=this._apply("trans");this._apply("end");this._apply("setHelped");return x}).call(this)}),(function(){return (function(){xs=this._applyWithArgs("transInside","And");return ["And"].concat(xs)}).call(this)}))},

/*
  Or  trans:x end           setHelped -> x,
  Or  transInside('Or'):xs            -> ['Or'].concat(xs)
*/
"Or":function(){var xs,x;return this._or((function(){return (function(){x=this._apply("trans");this._apply("end");this._apply("setHelped");return x}).call(this)}),(function(){return (function(){xs=this._applyWithArgs("transInside","Or");return ["Or"].concat(xs)}).call(this)}))},

/*
  XOr trans:x end           setHelped -> x,
  XOr transInside('XOr'):xs           -> ['XOr'].concat(xs)
*/
"XOr":function(){var xs,x;return this._or((function(){return (function(){x=this._apply("trans");this._apply("end");this._apply("setHelped");return x}).call(this)}),(function(){return (function(){xs=this._applyWithArgs("transInside","XOr");return ["XOr"].concat(xs)}).call(this)}))},

/*

  transInside :t = [exactly(t) transInside(t):xs] transInside(t):ys setHelped -> xs.concat(ys)
                 | trans:x                        transInside(t):xs           -> [x].concat(xs)
                 |                                                            -> []

*/
"transInside":function(){var xs,x,t,ys;return this._or((function(){return (function(){(function(){return t=this._apply("anything")}).call(this);return this._or((function(){return (function(){this._form((function(){return (function(){this._applyWithArgs("exactly",t);return xs=this._applyWithArgs("transInside",t)}).call(this)}));ys=this._applyWithArgs("transInside",t);this._apply("setHelped");return xs.concat(ys)}).call(this)}),(function(){return (function(){x=this._apply("trans");xs=this._applyWithArgs("transInside",t);return [x].concat(xs)}).call(this)}),(function(){return (function(){return []}).call(this)}))}).call(this)}))}});var BSSeqInliner=BSNullOptimization.inherit({_grammarName: "BSSeqInliner",

/*
  App        = 'seq' :s end seqString(s):cs setHelped -> ['And'].concat(cs).concat([['Act', s]])
             | :rule anything*:args                   -> ['App', rule].concat(args)
*/
"App":function(){var args,cs,s,rule;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("exactly","seq");s=this._apply("anything");this._apply("end");cs=this._applyWithArgs("seqString",s);this._apply("setHelped");return ["And"].concat(cs).concat([["Act",s]])}).call(this)}),(function(){return (function(){rule=this._apply("anything");args=this._many((function(){return this._apply("anything")}));return ["App",rule].concat(args)}).call(this)}))}).call(this)}))},

/*
  inlineChar = BSOMetaParser.eChar:c ~end             -> ['App', 'exactly', toProgramString(c)]
*/
"inlineChar":function(){var c;return this._or((function(){return (function(){undefined;return (function(){c=this._applyWithArgs("foreign",BSOMetaParser,'eChar');this._not((function(){return this._apply("end")}));return ["App","exactly",toProgramString(c)]}).call(this)}).call(this)}))},

/*
  seqString  = &(:s ?(typeof s === 'string'))
                 ( ['"'  inlineChar*:cs '"' ]         -> cs
                 | ['\'' inlineChar*:cs '\'']         -> cs
                 )
*/
"seqString":function(){var cs,s;return this._or((function(){return (function(){undefined;return (function(){this._lookahead((function(){return (function(){s=this._apply("anything");return this._pred(((typeof s) === "string"))}).call(this)}));return this._or((function(){return (function(){this._form((function(){return (function(){this._applyWithArgs("exactly","\"");cs=this._many((function(){return this._apply("inlineChar")}));return this._applyWithArgs("exactly","\"")}).call(this)}));return cs}).call(this)}),(function(){return (function(){this._form((function(){return (function(){this._applyWithArgs("exactly","\'");cs=this._many((function(){return this._apply("inlineChar")}));return this._applyWithArgs("exactly","\'")}).call(this)}));return cs}).call(this)}))}).call(this)}).call(this)}))}});var JumpTable=(function (choiceOp,choice){(this["choiceOp"]=choiceOp);(this["choices"]=({}));this.add(choice)});(JumpTable["prototype"]["add"]=(function (choice){{var c=choice[(0)];var t=choice[(1)]};if(this["choices"][c]){if((this["choices"][c][(0)] == this["choiceOp"])){this["choices"][c].push(t)}else{(this["choices"][c]=[this["choiceOp"],this["choices"][c],t])}}else{(this["choices"][c]=t)}}));(JumpTable["prototype"]["toTree"]=(function (){{var r=["JumpTable"];var choiceKeys=Object.getOwnPropertyNames(this["choices"])};for(var i=(0);(i < choiceKeys["length"]);(i+=(1))){r.push([choiceKeys[i],this["choices"][choiceKeys[i]]])};return r}));var BSJumpTableOptimization=BSNullOptimization.inherit({_grammarName: "BSJumpTableOptimization",

/*
  Or  (jtChoices('Or')  | trans)*:cs -> ['Or'].concat(cs)
*/
"Or":function(){var cs;return this._or((function(){return (function(){cs=this._many((function(){return this._or((function(){return (function(){return this._applyWithArgs("jtChoices","Or")}).call(this)}),(function(){return (function(){return this._apply("trans")}).call(this)}))}));return ["Or"].concat(cs)}).call(this)}))},

/*
  XOr (jtChoices('XOr') | trans)*:cs -> ['XOr'].concat(cs)
*/
"XOr":function(){var cs;return this._or((function(){return (function(){cs=this._many((function(){return this._or((function(){return (function(){return this._applyWithArgs("jtChoices","XOr")}).call(this)}),(function(){return (function(){return this._apply("trans")}).call(this)}))}));return ["XOr"].concat(cs)}).call(this)}))},

/*
  quotedString  = &string [ '"'  (BSOMetaParser.eChar:c ~end -> c)*:cs '"'
                          | '\'' (BSOMetaParser.eChar:c ~end -> c)*:cs '\'']               -> cs.join('')
*/
"quotedString":function(){var c,cs;return this._or((function(){return (function(){undefined;return (function(){this._lookahead((function(){return this._apply("string")}));this._form((function(){return this._or((function(){return (function(){this._applyWithArgs("exactly","\"");cs=this._many((function(){return (function(){c=this._applyWithArgs("foreign",BSOMetaParser,'eChar');this._not((function(){return this._apply("end")}));return c}).call(this)}));return this._applyWithArgs("exactly","\"")}).call(this)}),(function(){return (function(){this._applyWithArgs("exactly","\'");cs=this._many((function(){return (function(){c=this._applyWithArgs("foreign",BSOMetaParser,'eChar');this._not((function(){return this._apply("end")}));return c}).call(this)}));return this._applyWithArgs("exactly","\'")}).call(this)}))}));return cs.join("")}).call(this)}).call(this)}))},

/*
  jtChoice      = ['And' ['App' 'exactly' quotedString:x] anything*:rest]                  -> [x, ['And'].concat(rest)]
                |        ['App' 'exactly' quotedString:x]                                  -> [x, ['Act', toProgramString(x)]]
*/
"jtChoice":function(){var rest,x;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._form((function(){return (function(){this._applyWithArgs("exactly","And");this._form((function(){return (function(){this._applyWithArgs("exactly","App");this._applyWithArgs("exactly","exactly");return x=this._apply("quotedString")}).call(this)}));return rest=this._many((function(){return this._apply("anything")}))}).call(this)}));return [x,["And"].concat(rest)]}).call(this)}),(function(){return (function(){this._form((function(){return (function(){this._applyWithArgs("exactly","App");this._applyWithArgs("exactly","exactly");return x=this._apply("quotedString")}).call(this)}));return [x,["Act",toProgramString(x)]]}).call(this)}))}).call(this)}))},

/*
  jtChoices :op = jtChoice:c {new JumpTable(op, c)}:jt (jtChoice:c {jt.add(c)})* setHelped -> jt.toTree()

*/
"jtChoices":function(){var jt,c,op;return this._or((function(){return (function(){(function(){return op=this._apply("anything")}).call(this);return (function(){c=this._apply("jtChoice");jt=new JumpTable(op,c);this._many((function(){return (function(){c=this._apply("jtChoice");return jt.add(c)}).call(this)}));this._apply("setHelped");return jt.toTree()}).call(this)}).call(this)}))}});var BSOMetaOptimizer=OMeta.inherit({_grammarName: "BSOMetaOptimizer",

/*
  optimizeGrammar = ['Grammar' :n :sn optimizeRule*:rs]          -> ['Grammar', n, sn].concat(rs)
*/
"optimizeGrammar":function(){var sn,rs,n;return this._or((function(){return (function(){undefined;return (function(){this._form((function(){return (function(){this._applyWithArgs("exactly","Grammar");n=this._apply("anything");sn=this._apply("anything");return rs=this._many((function(){return this._apply("optimizeRule")}))}).call(this)}));return ["Grammar",n,sn].concat(rs)}).call(this)}).call(this)}))},

/*
  optimizeRule    = :r (BSSeqInliner.optimize(r):r | empty)
                       ( BSAssociativeOptimization.optimize(r):r
                       | BSJumpTableOptimization.optimize(r):r
                       )*                                        -> r

*/
"optimizeRule":function(){var r;return this._or((function(){return (function(){undefined;return (function(){r=this._apply("anything");this._or((function(){return (function(){return r=this._applyWithArgs("foreign",BSSeqInliner,'optimize',r)}).call(this)}),(function(){return (function(){return this._apply("empty")}).call(this)}));this._many((function(){return this._or((function(){return (function(){return r=this._applyWithArgs("foreign",BSAssociativeOptimization,'optimize',r)}).call(this)}),(function(){return (function(){return r=this._applyWithArgs("foreign",BSJumpTableOptimization,'optimize',r)}).call(this)}))}));return r}).call(this)}).call(this)}))}})}

{var BSOMetaJSParser=BSJSParser.inherit({_grammarName: "BSOMetaJSParser",

/*
  srcElem = spaces BSOMetaParser.grammar:r sc -> r
          | ^srcElem
*/
"srcElem":function(){var r;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._apply("spaces");r=this._applyWithArgs("foreign",BSOMetaParser,'grammar');this._apply("sc");return r}).call(this)}),(function(){return (function(){return BSJSParser._superApplyWithArgs(this,'srcElem')}).call(this)}))}).call(this)}))}});var BSOMetaJSTranslator=BSJSTranslator.inherit({_grammarName: "BSOMetaJSTranslator",

/*
  Grammar = BSOMetaTranslator.Grammar
*/
"Grammar":function(){return this._or((function(){return (function(){undefined;return (function(){return this._applyWithArgs("foreign",BSOMetaTranslator,'Grammar')}).call(this)}).call(this)}))}})}
  // <---------------------------------------- AUTOMATICALLY GENERATED CODE FROM GRAMMARS

  return {
    parser: BSOMetaJSParser,
    translator: BSOMetaJSTranslator
  }  
})();
