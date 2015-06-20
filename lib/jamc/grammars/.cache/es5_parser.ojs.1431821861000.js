{{var unicode=require("../unicode.js");var _=require("../nodes.js")}var ES5Parser=OMeta.inherit({_grammarName: "ES5Parser",

/*
  
  // Helper Rules
  //
  isKeyword     :x = ?this.spec.keyword(x)
*/
"isKeyword":function(){var x;return this._or((function(){return (function(){(function(){return x=this._apply("anything")}).call(this);return (function(){return this._pred(this["spec"].keyword(x))}).call(this)}).call(this)}))},

/*
  //
  idFirst          = char:x ?this.spec.idFirst(x)
*/
"idFirst":function(){var x;return this._or((function(){return (function(){undefined;return (function(){x=this._apply("char");return this._pred(this["spec"].idFirst(x))}).call(this)}).call(this)}))},

/* 
  idPart           = char:x ?this.spec.idPart(x)
*/
"idPart":function(){var x;return this._or((function(){return (function(){undefined;return (function(){x=this._apply("char");return this._pred(this["spec"].idPart(x))}).call(this)}).call(this)}))},

/*
  whitespace       = char:x ?this.spec.whitespaces(x)
*/
"whitespace":function(){var x;return this._or((function(){return (function(){undefined;return (function(){x=this._apply("char");return this._pred(this["spec"].whitespaces(x))}).call(this)}).call(this)}))},

/*
  linebreak        = char:x ?this.spec.linebreaks(x)
*/
"linebreak":function(){var x;return this._or((function(){return (function(){undefined;return (function(){x=this._apply("char");return this._pred(this["spec"].linebreaks(x))}).call(this)}).call(this)}))},

/*
  //
  // punctuator and keyword both won't occure in the AST
  token :tt        = spaces ( (punctuator | keyword):t ?(t.value() == tt)                -> t
                            | (name | number | string):t ?(t[0] == tt)                   -> t
                            )
*/
"token":function(){var tt,t;return this._or((function(){return (function(){(function(){return tt=this._apply("anything")}).call(this);return (function(){this._apply("spaces");return this._or((function(){return (function(){t=this._or((function(){return (function(){return this._apply("punctuator")}).call(this)}),(function(){return (function(){return this._apply("keyword")}).call(this)}));this._pred((t.value() == tt));return t}).call(this)}),(function(){return (function(){t=this._or((function(){return (function(){return this._apply("name")}).call(this)}),(function(){return (function(){return this._apply("number")}).call(this)}),(function(){return (function(){return this._apply("string")}).call(this)}));this._pred((t[(0)] == tt));return t}).call(this)}))}).call(this)}).call(this)}))},

/*

  // 7.4 Comments
  //
  comment          = ``//'' (~linebreak char)* &linebreak 
                   | fromTo('/*', '*\/')
*/
"comment":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("seq","//");this._many((function(){return (function(){this._not((function(){return this._apply("linebreak")}));return this._apply("char")}).call(this)}));return this._lookahead((function(){return this._apply("linebreak")}))}).call(this)}),(function(){return (function(){return this._applyWithArgs("fromTo","/*","*/")}).call(this)}))}).call(this)}))},

/*
  space            = whitespace | comment | linebreak
*/
"space":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("whitespace")}).call(this)}),(function(){return (function(){return this._apply("comment")}).call(this)}),(function(){return (function(){return this._apply("linebreak")}).call(this)}))}).call(this)}))},

/*
  spacesNoNl       = (~linebreak space)*
*/
"spacesNoNl":function(){return this._or((function(){return (function(){undefined;return (function(){return this._many((function(){return (function(){this._not((function(){return this._apply("linebreak")}));return this._apply("space")}).call(this)}))}).call(this)}).call(this)}))},

/*
  // 
  // mimics automatic semicolon insertion
  // a semicolon is assumed when
  // - there is a line break
  // - it's at the end of a block
  // - it's at the end of stream
  // - actually a semicolon can be found  
  sc               = spacesNoNl (linebreak | &'}' | end)
                   | ";"
*/
"sc":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._apply("spacesNoNl");return this._or((function(){return (function(){return this._apply("linebreak")}).call(this)}),(function(){return (function(){return this._lookahead((function(){return this._applyWithArgs("exactly","}")}))}).call(this)}),(function(){return (function(){return this._apply("end")}).call(this)}))}).call(this)}),(function(){return (function(){return this._applyWithArgs("token",";")}).call(this)}))}).call(this)}))},

/*
  
  
  // 7.6 Identifier Names and Identifiers
  //
  nameFirst        = idFirst | '$' | '_' | escapeSeq
*/
"nameFirst":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("idFirst")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","$")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","_")}).call(this)}),(function(){return (function(){return this._apply("escapeSeq")}).call(this)}))}).call(this)}))},

/*
  namePart         = nameFirst | idPart  | digit
*/
"namePart":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("nameFirst")}).call(this)}),(function(){return (function(){return this._apply("idPart")}).call(this)}),(function(){return (function(){return this._apply("digit")}).call(this)}))}).call(this)}))},

/*
  identifier       = <nameFirst namePart*>
*/
"identifier":function(){return this._or((function(){return (function(){undefined;return (function(){return this._consumedBy((function(){return (function(){this._apply("nameFirst");return this._many((function(){return this._apply("namePart")}))}).call(this)}))}).call(this)}).call(this)}))},

/*  
  //                                                                 
  name             = identifier:n ~isKeyword(n)                                          -> _.Id(n)
*/
"name":function(){var n;return this._or((function(){return (function(){undefined;return (function(){n=this._apply("identifier");this._not((function(){return this._applyWithArgs("isKeyword",n)}));return _.Id(n)}).call(this)}).call(this)}))},

/*
  keyword          = identifier:k isKeyword(k)                                           -> _.Keyword(k)
*/
"keyword":function(){var k;return this._or((function(){return (function(){undefined;return (function(){k=this._apply("identifier");this._applyWithArgs("isKeyword",k);return _.Keyword(k)}).call(this)}).call(this)}))},

/*  
  

  // 7.8.3 Numeric Literals  
  //
  // [0-9a-fA-F]
  hexDigit         = digit | range('a','f') | range('A','F')
*/
"hexDigit":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("digit")}).call(this)}),(function(){return (function(){return this._applyWithArgs("range","a","f")}).call(this)}),(function(){return (function(){return this._applyWithArgs("range","A","F")}).call(this)}))}).call(this)}))},

/*
  hex              = <``0x'' hexDigit+>:d                                                 -> _.Number(parseInt(d)).kind('hex')
*/
"hex":function(){var d;return this._or((function(){return (function(){undefined;return (function(){d=this._consumedBy((function(){return (function(){this._applyWithArgs("seq","0x");return this._many1((function(){return this._apply("hexDigit")}))}).call(this)}));return _.Number(parseInt(d)).kind("hex")}).call(this)}).call(this)}))},

/*
  //
  decimalInt       = '0' | (~'0' digit) digit*
*/
"decimalInt":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._applyWithArgs("exactly","0")}).call(this)}),(function(){return (function(){(function(){this._not((function(){return this._applyWithArgs("exactly","0")}));return this._apply("digit")}).call(this);return this._many((function(){return this._apply("digit")}))}).call(this)}))}).call(this)}))},

/*
  expPart          = ('e' | 'E') ('+' | '-')? digit+
*/
"expPart":function(){return this._or((function(){return (function(){undefined;return (function(){this._or((function(){return (function(){return this._applyWithArgs("exactly","e")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","E")}).call(this)}));this._opt((function(){return this._or((function(){return (function(){return this._applyWithArgs("exactly","+")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","-")}).call(this)}))}));return this._many1((function(){return this._apply("digit")}))}).call(this)}).call(this)}))},

/*
  // At this point I have to break ECMA compatibility (normally 1. is an allowed literal,
  // but this makes it unnecessary difficult to allow slicing foo[1..3]
  decimal          = <'-'? decimalInt ('.' digit+)? expPart?>:f                          -> _.Number(f)
                   | <'-'? ('.' digit+) expPart?>:f                                      -> _.Number(f)
*/
"decimal":function(){var f;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){f=this._consumedBy((function(){return (function(){this._opt((function(){return this._applyWithArgs("exactly","-")}));this._apply("decimalInt");this._opt((function(){return (function(){this._applyWithArgs("exactly",".");return this._many1((function(){return this._apply("digit")}))}).call(this)}));return this._opt((function(){return this._apply("expPart")}))}).call(this)}));return _.Number(f)}).call(this)}),(function(){return (function(){f=this._consumedBy((function(){return (function(){this._opt((function(){return this._applyWithArgs("exactly","-")}));(function(){this._applyWithArgs("exactly",".");return this._many1((function(){return this._apply("digit")}))}).call(this);return this._opt((function(){return this._apply("expPart")}))}).call(this)}));return _.Number(f)}).call(this)}))}).call(this)}))},

/*
  //  
  number           = hex | decimal
*/
"number":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("hex")}).call(this)}),(function(){return (function(){return this._apply("decimal")}).call(this)}))}).call(this)}))},

/*
                   

  // 7.8.4 String Literals
  //
  // possibly we need a line-escape sequence (backslash followed by "\r\n")
  escapeSeq        = <'\\' ( 'u' hexDigit hexDigit hexDigit hexDigit
                           | 'x' hexDigit hexDigit
                           | char                                    
                           )>:s                                                          -> unescape(s)
*/
"escapeSeq":function(){var s;return this._or((function(){return (function(){undefined;return (function(){s=this._consumedBy((function(){return (function(){this._applyWithArgs("exactly","\\");return this._or((function(){return (function(){this._applyWithArgs("exactly","u");this._apply("hexDigit");this._apply("hexDigit");this._apply("hexDigit");return this._apply("hexDigit")}).call(this)}),(function(){return (function(){this._applyWithArgs("exactly","x");this._apply("hexDigit");return this._apply("hexDigit")}).call(this)}),(function(){return (function(){return this._apply("char")}).call(this)}))}).call(this)}));return unescape(s)}).call(this)}).call(this)}))},

/*
  //
  string           = '\'' (escapeSeq | ~'\'' char)*:cs '\''                              -> _.String(cs.join(''))
                   | '"'  (escapeSeq | ~'"'  char)*:cs '"'                               -> _.String(cs.join(''))
*/
"string":function(){var cs;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("exactly","\'");cs=this._many((function(){return this._or((function(){return (function(){return this._apply("escapeSeq")}).call(this)}),(function(){return (function(){this._not((function(){return this._applyWithArgs("exactly","\'")}));return this._apply("char")}).call(this)}))}));this._applyWithArgs("exactly","\'");return _.String(cs.join(""))}).call(this)}),(function(){return (function(){this._applyWithArgs("exactly","\"");cs=this._many((function(){return this._or((function(){return (function(){return this._apply("escapeSeq")}).call(this)}),(function(){return (function(){this._not((function(){return this._applyWithArgs("exactly","\"")}));return this._apply("char")}).call(this)}))}));this._applyWithArgs("exactly","\"");return _.String(cs.join(""))}).call(this)}))}).call(this)}))},

/*
  

  // 7.7 Punctuators
  //
  // since PEG always uses first match the longest prefix has to be the first alternative
  // ('a' | 'a' 'a' problem) 
  punctuator       = ( ',' | '.' | ':' | ';' | '(' | ')' | '{' | '}' | '[' | ']' | '?' | '~'
                     | ``>>>='' | ``>>>'' | ``>>='' | ``>>''  | ``>=''  | '>'
                     | ``<<=''  | ``<<''  | ``<=''  | '<'     
                     | ``||=''  | ``||''  | ``|=''  | '|'
                     | ``&&=''  | ``&&''  | ``&=''  | '&'
                     | ``!==''  | ``!=''  | '!'
                     | ``===''  | ``==''  | '='
                     | ``++''   | ``+=''  | '+'     
                     | ``--''   | ``-=''  | '-'     
                     | ``*=''   | '*'     
                     | ``/=''   | '/'
                     | ``%=''   | '%'      
                     | ``^=''   | '^'     
                     ):s                                                                 -> _.Punctuator(s)
*/
"punctuator":function(){var s;return this._or((function(){return (function(){undefined;return (function(){s=this._or((function(){return (function(){return this._applyWithArgs("exactly",",")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly",".")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly",":")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly",";")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","(")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly",")")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","{")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","}")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","[")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","]")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","?")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","~")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq",">>>=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq",">>>")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq",">>=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq",">>")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq",">=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly",">")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","<<=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","<<")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","<=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","<")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","||=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","||")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","|=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","|")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","&&=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","&&")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","&=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","&")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","!==")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","!=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","!")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","===")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","==")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","++")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","+=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","+")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","--")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","-=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","-")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","*=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","*")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","/=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","/")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","%=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","%")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","^=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","^")}).call(this)}));return _.Punctuator(s)}).call(this)}).call(this)}))},

/*


  // 11. Expressions
  //
  // All expressions can fall through to leftExpr
  expr             = listOf(#assignExpr, ','):le                                         -> (le.length > 1? _.SequenceExpr(le) : le[0])
*/
"expr":function(){var le;return this._or((function(){return (function(){undefined;return (function(){le=this._applyWithArgs("listOf","assignExpr",",");return ((le["length"] > (1))?_.SequenceExpr(le):le[(0)])}).call(this)}).call(this)}))},

/* 
  //
  assignExpr       = leftExpr:lhs ( "="  | "+="  | "-=" | "*="  | "/=" | "%="   | "<<=" 
                                  | "^=" | "&&=" | "&=" | "||=" | "|=" | ">>>=" | ">>="
                                  ):op assignExpr:rhs                                    -> _.AssignExpr(lhs, rhs).operator(op.value())
                   | condExpr
*/
"assignExpr":function(){var lhs,op,rhs;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){lhs=this._apply("leftExpr");op=this._or((function(){return (function(){return this._applyWithArgs("token","=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","+=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","-=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","*=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","/=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","%=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","<<=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","^=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","&&=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","&=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","||=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","|=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token",">>>=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token",">>=")}).call(this)}));rhs=this._apply("assignExpr");return _.AssignExpr(lhs,rhs).operator(op.value())}).call(this)}),(function(){return (function(){return this._apply("condExpr")}).call(this)}))}).call(this)}))},

/*
  //
  // tertiary operators
  condExpr         = orExpr:e ( "?" assignExpr:t ":" assignExpr:f                        -> _.CondExpr(e, t, f)
                              | empty                                                    -> e
                              )
*/
"condExpr":function(){var e,t,f;return this._or((function(){return (function(){undefined;return (function(){e=this._apply("orExpr");return this._or((function(){return (function(){this._applyWithArgs("token","?");t=this._apply("assignExpr");this._applyWithArgs("token",":");f=this._apply("assignExpr");return _.CondExpr(e,t,f)}).call(this)}),(function(){return (function(){this._apply("empty");return e}).call(this)}))}).call(this)}).call(this)}))},

/*
  //
  // binary operators
  orExpr           = orExpr:x      "||" andExpr:y                                        -> _.BinaryExpr(x, y).operator("||")
                   | andExpr
*/
"orExpr":function(){var x,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("orExpr");this._applyWithArgs("token","||");y=this._apply("andExpr");return _.BinaryExpr(x,y).operator("||")}).call(this)}),(function(){return (function(){return this._apply("andExpr")}).call(this)}))}).call(this)}))},

/*
  andExpr          = andExpr:x     "&&" bitOrExpr:y                                      -> _.BinaryExpr(x, y).operator("&&")
                   | bitOrExpr
*/
"andExpr":function(){var x,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("andExpr");this._applyWithArgs("token","&&");y=this._apply("bitOrExpr");return _.BinaryExpr(x,y).operator("&&")}).call(this)}),(function(){return (function(){return this._apply("bitOrExpr")}).call(this)}))}).call(this)}))},

/*  
  bitOrExpr        = bitOrExpr:x   "|" bitXorExpr:y                                      -> _.BinaryExpr(x, y).operator("|")
                   | bitXorExpr
*/
"bitOrExpr":function(){var x,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("bitOrExpr");this._applyWithArgs("token","|");y=this._apply("bitXorExpr");return _.BinaryExpr(x,y).operator("|")}).call(this)}),(function(){return (function(){return this._apply("bitXorExpr")}).call(this)}))}).call(this)}))},

/*
  bitXorExpr       = bitXorExpr:x  "^" bitAndExpr:y                                      -> _.BinaryExpr(x, y).operator("^")
                   | bitAndExpr
*/
"bitXorExpr":function(){var x,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("bitXorExpr");this._applyWithArgs("token","^");y=this._apply("bitAndExpr");return _.BinaryExpr(x,y).operator("^")}).call(this)}),(function(){return (function(){return this._apply("bitAndExpr")}).call(this)}))}).call(this)}))},

/*
  bitAndExpr       = bitAndExpr:x  "&" eqExpr:y                                          -> _.BinaryExpr(x, y).operator("&")
                   | eqExpr
*/
"bitAndExpr":function(){var x,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("bitAndExpr");this._applyWithArgs("token","&");y=this._apply("eqExpr");return _.BinaryExpr(x,y).operator("&")}).call(this)}),(function(){return (function(){return this._apply("eqExpr")}).call(this)}))}).call(this)}))},

/*
  eqExpr           = eqExpr:x    ( "==" | "!=" | "===" | "!=="):op relExpr:y             -> _.BinaryExpr(x, y).operator(op.value())
                   | relExpr
*/
"eqExpr":function(){var x,op,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("eqExpr");op=this._or((function(){return (function(){return this._applyWithArgs("token","==")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","!=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","===")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","!==")}).call(this)}));y=this._apply("relExpr");return _.BinaryExpr(x,y).operator(op.value())}).call(this)}),(function(){return (function(){return this._apply("relExpr")}).call(this)}))}).call(this)}))},

/*
  relExpr          = relExpr:x   ( ">=" | ">" | "<=" | "<" 
                                 | "instanceof" | "in" 
                                 ):op shiftExpr:y                                        -> _.BinaryExpr(x, y).operator(op.value())
                   | shiftExpr
*/
"relExpr":function(){var x,op,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("relExpr");op=this._or((function(){return (function(){return this._applyWithArgs("token",">=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token",">")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","<=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","<")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","instanceof")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","in")}).call(this)}));y=this._apply("shiftExpr");return _.BinaryExpr(x,y).operator(op.value())}).call(this)}),(function(){return (function(){return this._apply("shiftExpr")}).call(this)}))}).call(this)}))},

/* 
  shiftExpr        = shiftExpr:x ( ">>>" | ">>" | "<<" ):op addExpr:y                    -> _.BinaryExpr(x, y).operator(op.value())
                   | addExpr
*/
"shiftExpr":function(){var x,op,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("shiftExpr");op=this._or((function(){return (function(){return this._applyWithArgs("token",">>>")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token",">>")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","<<")}).call(this)}));y=this._apply("addExpr");return _.BinaryExpr(x,y).operator(op.value())}).call(this)}),(function(){return (function(){return this._apply("addExpr")}).call(this)}))}).call(this)}))},

/*  
  addExpr          = addExpr:x   ( "+" | "-" ):op mulExpr:y                              -> _.BinaryExpr(x, y).operator(op.value())
                   | mulExpr
*/
"addExpr":function(){var x,op,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("addExpr");op=this._or((function(){return (function(){return this._applyWithArgs("token","+")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","-")}).call(this)}));y=this._apply("mulExpr");return _.BinaryExpr(x,y).operator(op.value())}).call(this)}),(function(){return (function(){return this._apply("mulExpr")}).call(this)}))}).call(this)}))},

/*
  mulExpr          = mulExpr:x   ( "*" | "/" | "%" ):op prefixExpr:y                     -> _.BinaryExpr(x, y).operator(op.value())
                   | prefixExpr
*/
"mulExpr":function(){var x,op,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("mulExpr");op=this._or((function(){return (function(){return this._applyWithArgs("token","*")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","/")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","%")}).call(this)}));y=this._apply("prefixExpr");return _.BinaryExpr(x,y).operator(op.value())}).call(this)}),(function(){return (function(){return this._apply("prefixExpr")}).call(this)}))}).call(this)}))},

/*  

  //
  // unary operators
  prefixExpr       = ("++" | "--" ):op spacesNoNl unaryExpr:e                            -> _.UpdateExpr(e).operator(op.value())
                   | unaryExpr
*/
"prefixExpr":function(){var op,e;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){op=this._or((function(){return (function(){return this._applyWithArgs("token","++")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","--")}).call(this)}));this._apply("spacesNoNl");e=this._apply("unaryExpr");return _.UpdateExpr(e).operator(op.value())}).call(this)}),(function(){return (function(){return this._apply("unaryExpr")}).call(this)}))}).call(this)}))},

/*
  unaryExpr        = ( "!" | "~" | "+" | "-" 
                     | "void" | "delete" | "typeof" 
                     ):op prefixExpr:e                                                   -> _.UnaryExpr(e).operator(op.value())
                   | postfixExpr
*/
"unaryExpr":function(){var op,e;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){op=this._or((function(){return (function(){return this._applyWithArgs("token","!")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","~")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","+")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","-")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","void")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","delete")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","typeof")}).call(this)}));e=this._apply("prefixExpr");return _.UnaryExpr(e).operator(op.value())}).call(this)}),(function(){return (function(){return this._apply("postfixExpr")}).call(this)}))}).call(this)}))},

/*
  postfixExpr      = leftExpr:e spacesNoNl ("++" | "--"):op                              -> _.UpdateExpr(e).operator(op.value()).prefix(false)
                   | leftExpr
*/
"postfixExpr":function(){var e,op;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){e=this._apply("leftExpr");this._apply("spacesNoNl");op=this._or((function(){return (function(){return this._applyWithArgs("token","++")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","--")}).call(this)}));return _.UpdateExpr(e).operator(op.value()).prefix(false)}).call(this)}),(function(){return (function(){return this._apply("leftExpr")}).call(this)}))}).call(this)}))},

/*
            
  //
  // different combinations of member-expressions, call expressions and new-expressions
  leftExpr         = "new" leftExpr:n                                                     -> _.NewExpr(n)
                   | accessExpr
*/
"leftExpr":function(){var n;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("token","new");n=this._apply("leftExpr");return _.NewExpr(n)}).call(this)}),(function(){return (function(){return this._apply("accessExpr")}).call(this)}))}).call(this)}))},

/* 
  //
  // this "property" trick is needed to dynamically combine access-expressions with postfix
  // expressions like ...() or ...[] while staying left-associative
  // this also allows an easy extension with a new operator like ...<> etc.
  accessExpr       = accessExpr:p callExpr(p)
                   | accessExpr:p memberExpr(p)
                   | funcExpr
                   | primExpr
*/
"accessExpr":function(){var p;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){p=this._apply("accessExpr");return this._applyWithArgs("callExpr",p)}).call(this)}),(function(){return (function(){p=this._apply("accessExpr");return this._applyWithArgs("memberExpr",p)}).call(this)}),(function(){return (function(){return this._apply("funcExpr")}).call(this)}),(function(){return (function(){return this._apply("primExpr")}).call(this)}))}).call(this)}))},

/*
  //
  callExpr      :p = "(" listOf(#assignExpr, ','):as ")"                                 -> _.CallExpr(p, as)
*/
"callExpr":function(){var p,as;return this._or((function(){return (function(){(function(){return p=this._apply("anything")}).call(this);return (function(){this._applyWithArgs("token","(");as=this._applyWithArgs("listOf","assignExpr",",");this._applyWithArgs("token",")");return _.CallExpr(p,as)}).call(this)}).call(this)}))},

/*
  //
  memberExpr    :p = ( "[" expr:i "]"                                                    -> _.MemberExpr(p, i)
                     | "." "Id":f                                                        -> _.MemberExpr(p).name(f.value())
                     )
*/
"memberExpr":function(){var p,i,f;return this._or((function(){return (function(){(function(){return p=this._apply("anything")}).call(this);return (function(){return this._or((function(){return (function(){this._applyWithArgs("token","[");i=this._apply("expr");this._applyWithArgs("token","]");return _.MemberExpr(p,i)}).call(this)}),(function(){return (function(){this._applyWithArgs("token",".");f=this._applyWithArgs("token","Id");return _.MemberExpr(p).name(f.value())}).call(this)}))}).call(this)}).call(this)}))},

/*


  // 11.1 Primary Expressions   
  //
  primExpr         = "this"                                                              -> _.ThisExpr()
                   | "Id"
                   | "Number"
                   | "String"
                   | objectLiteral
                   | arrayLiteral
                   | "(" expr:e ")"                                                      -> _.GroupExpr(e)
                   | reLiteral
*/
"primExpr":function(){var e;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("token","this");return _.ThisExpr()}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","Id")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","Number")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","String")}).call(this)}),(function(){return (function(){return this._apply("objectLiteral")}).call(this)}),(function(){return (function(){return this._apply("arrayLiteral")}).call(this)}),(function(){return (function(){this._applyWithArgs("token","(");e=this._apply("expr");this._applyWithArgs("token",")");return _.GroupExpr(e)}).call(this)}),(function(){return (function(){return this._apply("reLiteral")}).call(this)}))}).call(this)}))},

/*
  

  // 11.1.4 Array Literals
  //
  // can't use listOf here in order to allow elision as first element [,,,]
  arrayLiteral     =  "[" ( arrayEl:f ("," arrayEl)*:cs -> [f].concat(cs)
                          | empty                       -> []
                          ):es "]"                                                       -> _.ArrayExpr(es)
*/
"arrayLiteral":function(){var f,cs,es;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","[");es=this._or((function(){return (function(){f=this._apply("arrayEl");cs=this._many((function(){return (function(){this._applyWithArgs("token",",");return this._apply("arrayEl")}).call(this)}));return [f].concat(cs)}).call(this)}),(function(){return (function(){this._apply("empty");return []}).call(this)}));this._applyWithArgs("token","]");return _.ArrayExpr(es)}).call(this)}).call(this)}))},

/*
  //
  arrayEl          = assignExpr 
                   | empty -> undefined
*/
"arrayEl":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("assignExpr")}).call(this)}),(function(){return (function(){this._apply("empty");return undefined}).call(this)}))}).call(this)}))},

/* // elision
  

  // 11.1.5 Object Literals
  //
  objectLiteral    = "{" listOf(#objBinding, ','):bs "}"                                 -> _.ObjectExpr(bs)
*/
"objectLiteral":function(){var bs;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","{");bs=this._applyWithArgs("listOf","objBinding",",");this._applyWithArgs("token","}");return _.ObjectExpr(bs)}).call(this)}).call(this)}))},

/*
  //
  objBinding       = spaces <``get'' | ``set''>:t spaces objPropName:n funcRest:f        -> _.PropertyBinding(n, f.args, f.body).kind(t)
                   | objPropName:n ":" assignExpr:v                                      -> _.PropertyBinding(n, v)
*/
"objBinding":function(){var t,n,f,v;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._apply("spaces");t=this._consumedBy((function(){return this._or((function(){return (function(){return this._applyWithArgs("seq","get")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","set")}).call(this)}))}));this._apply("spaces");n=this._apply("objPropName");f=this._apply("funcRest");return _.PropertyBinding(n,f["args"],f["body"]).kind(t)}).call(this)}),(function(){return (function(){n=this._apply("objPropName");this._applyWithArgs("token",":");v=this._apply("assignExpr");return _.PropertyBinding(n,v)}).call(this)}))}).call(this)}))},

/*                   
  objPropName      = "Id" | "String" | "Number"
*/
"objPropName":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._applyWithArgs("token","Id")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","String")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","Number")}).call(this)}))}).call(this)}))},

/*
  
  
  // 15.10 Regular Expressions
  //
  // Had to fix regexp to match /([-.*+?^${}()|[\]\/\\])/g
  // /\\\\]/g
  reLiteral        = spaces '/' <reBody>:b '/' <reFlag*>:f                               -> _.RegExpr(b).flags(f)
*/
"reLiteral":function(){var b,f;return this._or((function(){return (function(){undefined;return (function(){this._apply("spaces");this._applyWithArgs("exactly","/");b=this._consumedBy((function(){return (function(){return this._apply("reBody")}).call(this)}));this._applyWithArgs("exactly","/");f=this._consumedBy((function(){return (function(){return this._many((function(){return this._apply("reFlag")}))}).call(this)}));return _.RegExpr(b).flags(f)}).call(this)}).call(this)}))},

/*
  //
  reBody           = reFirst reChar*
*/
"reBody":function(){return this._or((function(){return (function(){undefined;return (function(){this._apply("reFirst");return this._many((function(){return this._apply("reChar")}))}).call(this)}).call(this)}))},

/*  
  reChar           = reFirst | '*'
*/
"reChar":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("reFirst")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","*")}).call(this)}))}).call(this)}))},

/*
  reFirst          = ~('*' | '/' | '[') reClassChar
                   | reClass
                   | ']'
*/
"reFirst":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._not((function(){return this._or((function(){return (function(){return this._applyWithArgs("exactly","*")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","/")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","[")}).call(this)}))}));return this._apply("reClassChar")}).call(this)}),(function(){return (function(){return this._apply("reClass")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","]")}).call(this)}))}).call(this)}))},

/*  
  reClass          = '[' reClassChar* ']'
*/
"reClass":function(){return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("exactly","[");this._many((function(){return this._apply("reClassChar")}));return this._applyWithArgs("exactly","]")}).call(this)}).call(this)}))},

/*
  reClassChar      = escapeSeq
                   | ~(']' | '\\' | '\n' | '\r') char
*/
"reClassChar":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("escapeSeq")}).call(this)}),(function(){return (function(){this._not((function(){return this._or((function(){return (function(){return this._applyWithArgs("exactly","]")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","\\")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","\n")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","\r")}).call(this)}))}));return this._apply("char")}).call(this)}))}).call(this)}))},

/*
  reFlag           = letter
*/
"reFlag":function(){return this._or((function(){return (function(){undefined;return (function(){return this._apply("letter")}).call(this)}).call(this)}))},

/*   
  
  
  // Functions
  //
  funcDecl         = "function" "Id":n funcRest:f                                        -> _.Function(f.args, f.body).id(n.value())
*/
"funcDecl":function(){var n,f;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","function");n=this._applyWithArgs("token","Id");f=this._apply("funcRest");return _.Function(f["args"],f["body"]).id(n.value())}).call(this)}).call(this)}))},

/*
  funcExpr         = "function" funcRest:f                                               -> _.Function(f.args, f.body).expr(true)
                   | funcDecl:f                                                          -> f.expr(true)
*/
"funcExpr":function(){var f;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("token","function");f=this._apply("funcRest");return _.Function(f["args"],f["body"]).expr(true)}).call(this)}),(function(){return (function(){f=this._apply("funcDecl");return f.expr(true)}).call(this)}))}).call(this)}))},

/*
  //
  funcRest         = "(" funcArgs:args ")" block:block                                   -> { args: args, body: block }
*/
"funcRest":function(){var args,block;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","(");args=this._apply("funcArgs");this._applyWithArgs("token",")");block=this._apply("block");return ({"args": args,"body": block})}).call(this)}).call(this)}))},

/*
  funcArgs         = listOf(#formal, ','):a                                              -> _.FunctionArgs(a)
*/
"funcArgs":function(){var a;return this._or((function(){return (function(){undefined;return (function(){a=this._applyWithArgs("listOf","formal",",");return _.FunctionArgs(a)}).call(this)}).call(this)}))},

/*
  formal           = "Id"
*/
"formal":function(){return this._or((function(){return (function(){undefined;return (function(){return this._applyWithArgs("token","Id")}).call(this)}).call(this)}))},

/*
  

  // Variable Declarations
  //
  bindings         = "var" listOf(#binding, ','):bs                                      -> _.VarDeclStmt(bs)
*/
"bindings":function(){var bs;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","var");bs=this._applyWithArgs("listOf","binding",",");return _.VarDeclStmt(bs)}).call(this)}).call(this)}))},

/*
  binding          = "Id":n ( "=" assignExpr
                            | empty          -> _.Id('undefined')
                            )?:v                                                         -> _.VarBinding(n.value(), v)
*/
"binding":function(){var n,v;return this._or((function(){return (function(){undefined;return (function(){n=this._applyWithArgs("token","Id");v=this._opt((function(){return this._or((function(){return (function(){this._applyWithArgs("token","=");return this._apply("assignExpr")}).call(this)}),(function(){return (function(){this._apply("empty");return _.Id("undefined")}).call(this)}))}));return _.VarBinding(n.value(),v)}).call(this)}).call(this)}))},

/*
   

  // Block Statement
  //
  block            = "{" srcElem*:ss "}"                                                 -> _.BlockStmt(ss)
*/
"block":function(){var ss;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","{");ss=this._many((function(){return this._apply("srcElem")}));this._applyWithArgs("token","}");return _.BlockStmt(ss)}).call(this)}).call(this)}))},

/*


  // 12. Statements
  //
  stmt             = bindings:bs sc                                                      -> bs
                   | "if" "(" expr:c ")" stmt:t ( "else" stmt:f                          -> _.IfStmt(c, t, f)
                                                | empty                                  -> _.IfStmt(c, t)
                                                )
                   | "while" "(" expr:c ")" stmt:s                                       -> _.WhileStmt(c, s)
                   | "do" stmt:s "while" "(" expr:c ")" sc                               -> _.DoWhileStmt(s, c)
                   | "for" "(" ( bindings
                               | expr 
                               )?:i
                           ";" expr?:c
                           ";" expr?:u                                                   
                           ")" stmt:s                                                    -> _.ForStmt(i, c, u, s)
                   | "for" "(" ( bindings
                               | leftExpr     
                               ):v
                           "in" expr:e
                           ")" stmt:s                                                    -> _.ForInStmt(v, e, s)
                   | "switch" "(" expr:e ")" "{"
                       ( "case" expr:c ":" srcElem*:cs                                   -> _.SwitchCase(c, cs)  // fallthrough now possible
                       | "default"     ":" srcElem*:cs                                   -> _.SwitchCase(cs)
                       )*:cs
                     "}"                                                                 -> _.SwitchStmt(e, cs)
                   | "break" spacesNoNl name:n sc                                        -> _.BreakStmt().label(n.value())
                   | "break" sc                                                          -> _.BreakStmt()
                   | "continue" spacesNoNl name:n sc                                     -> _.ContinueStmt().label(n.value())
                   | "continue" sc                                                       -> _.ContinueStmt()
                   | "throw" spacesNoNl expr:e sc                                        -> _.ThrowStmt(e)
                   | "try" block:t "catch" "(" "Id":n ")" block:c                        // catch is optional, if finally is provided
                                 ( "finally" block)?:f                                   -> _.TryStmt(t, n, c, f)
                   | "try" block:t "finally" block:f                                     -> _.TryStmt(t, f)
                   | "return" ( expr ):e sc                                              -> _.ReturnStmt(e)
                   | "with" "(" expr:x ")" stmt:s                                        -> _.WithStmt(x, s)
                   | "Id":l ":" stmt:s                                                   -> _.LabeledStmt(l.value(), s)
                   | ";"                                                                 -> _.EmptyStmt()                
                   | spaces (~("{" | "function" | sc) expr:e) sc                         -> e        // 12.4 Comma Operator
                   | block
*/
"stmt":function(){var bs,c,t,f,s,i,u,v,e,cs,n,x,l;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){bs=this._apply("bindings");this._apply("sc");return bs}).call(this)}),(function(){return (function(){this._applyWithArgs("token","if");this._applyWithArgs("token","(");c=this._apply("expr");this._applyWithArgs("token",")");t=this._apply("stmt");return this._or((function(){return (function(){this._applyWithArgs("token","else");f=this._apply("stmt");return _.IfStmt(c,t,f)}).call(this)}),(function(){return (function(){this._apply("empty");return _.IfStmt(c,t)}).call(this)}))}).call(this)}),(function(){return (function(){this._applyWithArgs("token","while");this._applyWithArgs("token","(");c=this._apply("expr");this._applyWithArgs("token",")");s=this._apply("stmt");return _.WhileStmt(c,s)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","do");s=this._apply("stmt");this._applyWithArgs("token","while");this._applyWithArgs("token","(");c=this._apply("expr");this._applyWithArgs("token",")");this._apply("sc");return _.DoWhileStmt(s,c)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","for");this._applyWithArgs("token","(");i=this._opt((function(){return this._or((function(){return (function(){return this._apply("bindings")}).call(this)}),(function(){return (function(){return this._apply("expr")}).call(this)}))}));this._applyWithArgs("token",";");c=this._opt((function(){return this._apply("expr")}));this._applyWithArgs("token",";");u=this._opt((function(){return this._apply("expr")}));this._applyWithArgs("token",")");s=this._apply("stmt");return _.ForStmt(i,c,u,s)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","for");this._applyWithArgs("token","(");v=this._or((function(){return (function(){return this._apply("bindings")}).call(this)}),(function(){return (function(){return this._apply("leftExpr")}).call(this)}));this._applyWithArgs("token","in");e=this._apply("expr");this._applyWithArgs("token",")");s=this._apply("stmt");return _.ForInStmt(v,e,s)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","switch");this._applyWithArgs("token","(");e=this._apply("expr");this._applyWithArgs("token",")");this._applyWithArgs("token","{");cs=this._many((function(){return this._or((function(){return (function(){this._applyWithArgs("token","case");c=this._apply("expr");this._applyWithArgs("token",":");cs=this._many((function(){return this._apply("srcElem")}));return _.SwitchCase(c,cs)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","default");this._applyWithArgs("token",":");cs=this._many((function(){return this._apply("srcElem")}));return _.SwitchCase(cs)}).call(this)}))}));this._applyWithArgs("token","}");return _.SwitchStmt(e,cs)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","break");this._apply("spacesNoNl");n=this._apply("name");this._apply("sc");return _.BreakStmt().label(n.value())}).call(this)}),(function(){return (function(){this._applyWithArgs("token","break");this._apply("sc");return _.BreakStmt()}).call(this)}),(function(){return (function(){this._applyWithArgs("token","continue");this._apply("spacesNoNl");n=this._apply("name");this._apply("sc");return _.ContinueStmt().label(n.value())}).call(this)}),(function(){return (function(){this._applyWithArgs("token","continue");this._apply("sc");return _.ContinueStmt()}).call(this)}),(function(){return (function(){this._applyWithArgs("token","throw");this._apply("spacesNoNl");e=this._apply("expr");this._apply("sc");return _.ThrowStmt(e)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","try");t=this._apply("block");this._applyWithArgs("token","catch");this._applyWithArgs("token","(");n=this._applyWithArgs("token","Id");this._applyWithArgs("token",")");c=this._apply("block");f=this._opt((function(){return (function(){this._applyWithArgs("token","finally");return this._apply("block")}).call(this)}));return _.TryStmt(t,n,c,f)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","try");t=this._apply("block");this._applyWithArgs("token","finally");f=this._apply("block");return _.TryStmt(t,f)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","return");e=(function(){return this._apply("expr")}).call(this);this._apply("sc");return _.ReturnStmt(e)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","with");this._applyWithArgs("token","(");x=this._apply("expr");this._applyWithArgs("token",")");s=this._apply("stmt");return _.WithStmt(x,s)}).call(this)}),(function(){return (function(){l=this._applyWithArgs("token","Id");this._applyWithArgs("token",":");s=this._apply("stmt");return _.LabeledStmt(l.value(),s)}).call(this)}),(function(){return (function(){this._applyWithArgs("token",";");return _.EmptyStmt()}).call(this)}),(function(){return (function(){this._apply("spaces");(function(){this._not((function(){return this._or((function(){return (function(){return this._applyWithArgs("token","{")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","function")}).call(this)}),(function(){return (function(){return this._apply("sc")}).call(this)}))}));return e=this._apply("expr")}).call(this);this._apply("sc");return e}).call(this)}),(function(){return (function(){return this._apply("block")}).call(this)}))}).call(this)}))},

/*                                                                          //
                                                                                                     // This allows the use of the comma-operator
                                                                                                     // (Or to be more precise, `expr` does this)
                                                                                                     //
                                                                                                     //     result += source, source = '';
                                                                                                     //
                                                                                                     // I had big trouble to prevent an endless
                                                                                                     // loop at this point. The solution was
                                                                                                     // to firstly consume all whitespaces and
                                                                                                     // then match `not sc`
                                                                                                     //
                                                                                                     // This seems to magically work, i still
                                                                                                     // have to think about why...
  
  // Source Elements
  //
  srcElem          = funcDecl | stmt
*/
"srcElem":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("funcDecl")}).call(this)}),(function(){return (function(){return this._apply("stmt")}).call(this)}))}).call(this)}))},

/*


  // Program
  //
  topLevel         = srcElem*:el spaces end                                              -> _.Program(el)


*/
"topLevel":function(){var el;return this._or((function(){return (function(){undefined;return (function(){el=this._many((function(){return this._apply("srcElem")}));this._apply("spaces");this._apply("end");return _.Program(el)}).call(this)}).call(this)}))}});(ES5Parser["position_info"]=(function (input,from,to){var position=(function (pos){{var line=(1);var column=undefined};for(var i=pos;(i >= (0));i--){if((input[i] === "\n")){if(((typeof column) == "undefined")){(column=(pos - i))}else{undefined};line++}else{undefined}};if((line === (1))){(column=pos)}else{undefined};return ({"line": line,"column": column})});return ({"source": input.slice(from,to),"start": position(from),"end": position(to)})}));(ES5Parser["spec"]=({"whitespaces": unicode.matcher(["TAB","VT","FF","SP","NBSP","BOM","Zs"]),"linebreaks": unicode.matcher(["LF","CR","LS","PS"]),"idFirst": unicode.matcher(["L","Nl"]),"idPart": unicode.matcher(["Mn","Mc","Nd","Pc","ZWNJ","ZWJ"]),"keywords": ["break","case","catch","class","const","continue","debugger","default","delete","do","else","enum","export","extends","for","finally","function","if","import","in","instanceof","new","return","super","switch","this","throw","try","typeof","var","void","while","with"],"future_keywords": ["implements","interface","let","package","private","protected","public","yield"],"keyword": (function (k){return (this["keywords"].indexOf(k) != (- (1)))})}));(ES5Parser["parse"]=(function (input){return ES5Parser.matchAll(input,"topLevel")}));(module["exports"]=ES5Parser)}