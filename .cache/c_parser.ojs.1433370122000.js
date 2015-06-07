{var __=require("../nodes.js");var declattr=(function (){return ({"storage_class": undefined,"type_qual": undefined,"type_spec": undefined})});var CParser=OMeta.inherit({_grammarName: "CParser",

/*

    // Helper Rules
    //
    isKeyword :x    = ?this.spec.isKeyword(x)
*/
"isKeyword":function(){var x;return this._or((function(){return (function(){(function(){return x=this._apply("anything")}).call(this);return (function(){return this._pred(this["spec"].isKeyword(x))}).call(this)}).call(this)}))},

/*
    nameFirst       = ^letter | '_'
*/
"nameFirst":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return OMeta._superApplyWithArgs(this,'letter')}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","_")}).call(this)}))}).call(this)}))},

/*
    nameRest        = nameFirst | ^digit
*/
"nameRest":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("nameFirst")}).call(this)}),(function(){return (function(){return OMeta._superApplyWithArgs(this,'digit')}).call(this)}))}).call(this)}))},

/*
    linebreak       = '\n'
*/
"linebreak":function(){return this._or((function(){return (function(){undefined;return (function(){return this._applyWithArgs("exactly","\n")}).call(this)}).call(this)}))},

/*


    // Comments
    //
    comment         = ``//'' (~linebreak char)* &linebreak
                    | fromTo('/*', '*\/')
*/
"comment":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("seq","//");this._many((function(){return (function(){this._not((function(){return this._apply("linebreak")}));return this._apply("char")}).call(this)}));return this._lookahead((function(){return this._apply("linebreak")}))}).call(this)}),(function(){return (function(){return this._applyWithArgs("fromTo","/*","*/")}).call(this)}))}).call(this)}))},

/*

    space           = ^space | comment | linebreak
*/
"space":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return OMeta._superApplyWithArgs(this,'space')}).call(this)}),(function(){return (function(){return this._apply("comment")}).call(this)}),(function(){return (function(){return this._apply("linebreak")}).call(this)}))}).call(this)}))},

/*
    spacesNoNl      = (~linebreak space)*
*/
"spacesNoNl":function(){return this._or((function(){return (function(){undefined;return (function(){return this._many((function(){return (function(){this._not((function(){return this._apply("linebreak")}));return this._apply("space")}).call(this)}))}).call(this)}).call(this)}))},

/*

    // Identifiers and Names
    //
    iName           = <nameFirst nameRest*>
*/
"iName":function(){return this._or((function(){return (function(){undefined;return (function(){return this._consumedBy((function(){return (function(){this._apply("nameFirst");return this._many((function(){return this._apply("nameRest")}))}).call(this)}))}).call(this)}).call(this)}))},

/*
    id              = iName:name ~isKeyword(name)                   -> __.Id(name)
*/
"id":function(){var name;return this._or((function(){return (function(){undefined;return (function(){name=this._apply("iName");this._not((function(){return this._applyWithArgs("isKeyword",name)}));return __.Id(name)}).call(this)}).call(this)}))},

/*
    keyword         = iName:kwd isKeyword(kwd)                      -> __.Keyword(kwd)
*/
"keyword":function(){var kwd;return this._or((function(){return (function(){undefined;return (function(){kwd=this._apply("iName");this._applyWithArgs("isKeyword",kwd);return __.Keyword(kwd)}).call(this)}).call(this)}))},

/*

    // Numeric Literals
    //
    hexDigit        = ^digit | range('a', 'f') | range('A', 'F')
*/
"hexDigit":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return OMeta._superApplyWithArgs(this,'digit')}).call(this)}),(function(){return (function(){return this._applyWithArgs("range","a","f")}).call(this)}),(function(){return (function(){return this._applyWithArgs("range","A","F")}).call(this)}))}).call(this)}))},

/*
    hex             = <``0x''|``0X'' hexDigit+>:d                   -> __.Number(parseInt(d)).kind('hex')
*/
"hex":function(){var d;return this._or((function(){return (function(){undefined;return (function(){d=this._consumedBy((function(){return this._or((function(){return (function(){return this._applyWithArgs("seq","0x")}).call(this)}),(function(){return (function(){this._applyWithArgs("seq","0X");return this._many1((function(){return this._apply("hexDigit")}))}).call(this)}))}));return __.Number(parseInt(d)).kind("hex")}).call(this)}).call(this)}))},

/*

    decimalInt      = '0' | (~'0' digit) digit*
*/
"decimalInt":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._applyWithArgs("exactly","0")}).call(this)}),(function(){return (function(){(function(){this._not((function(){return this._applyWithArgs("exactly","0")}));return this._apply("digit")}).call(this);return this._many((function(){return this._apply("digit")}))}).call(this)}))}).call(this)}))},

/*
    expPart         = ('e' | 'E') ('+' | '-')? digit+
*/
"expPart":function(){return this._or((function(){return (function(){undefined;return (function(){this._or((function(){return (function(){return this._applyWithArgs("exactly","e")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","E")}).call(this)}));this._opt((function(){return this._or((function(){return (function(){return this._applyWithArgs("exactly","+")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","-")}).call(this)}))}));return this._many1((function(){return this._apply("digit")}))}).call(this)}).call(this)}))},

/*

    octal           = <'0' digit+>:d                                -> __.Number(parseInt(d,8)).kind('oct')
*/
"octal":function(){var d;return this._or((function(){return (function(){undefined;return (function(){d=this._consumedBy((function(){return (function(){this._applyWithArgs("exactly","0");return this._many1((function(){return this._apply("digit")}))}).call(this)}));return __.Number(parseInt(d,(8))).kind("oct")}).call(this)}).call(this)}))},

/*

    decimal         = <'-'? decimalInt ('.' digit+)? expPart?>:f    -> __.Number(f).kind('float')
                    | <'-'? ('.' digit+) expPart?>:f                -> __.Number(f).kind('float')
*/
"decimal":function(){var f;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){f=this._consumedBy((function(){return (function(){this._opt((function(){return this._applyWithArgs("exactly","-")}));this._apply("decimalInt");this._opt((function(){return (function(){this._applyWithArgs("exactly",".");return this._many1((function(){return this._apply("digit")}))}).call(this)}));return this._opt((function(){return this._apply("expPart")}))}).call(this)}));return __.Number(f).kind("float")}).call(this)}),(function(){return (function(){f=this._consumedBy((function(){return (function(){this._opt((function(){return this._applyWithArgs("exactly","-")}));(function(){this._applyWithArgs("exactly",".");return this._many1((function(){return this._apply("digit")}))}).call(this);return this._opt((function(){return this._apply("expPart")}))}).call(this)}));return __.Number(f).kind("float")}).call(this)}))}).call(this)}))},

/*

    integer         = <'-'? decimalInt>:d                           -> __.Number(parseInt(d)).kind('int')
*/
"integer":function(){var d;return this._or((function(){return (function(){undefined;return (function(){d=this._consumedBy((function(){return (function(){this._opt((function(){return this._applyWithArgs("exactly","-")}));return this._apply("decimalInt")}).call(this)}));return __.Number(parseInt(d)).kind("int")}).call(this)}).call(this)}))},

/*

    number          = hex | octal | decimal | integer
*/
"number":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("hex")}).call(this)}),(function(){return (function(){return this._apply("octal")}).call(this)}),(function(){return (function(){return this._apply("decimal")}).call(this)}),(function(){return (function(){return this._apply("integer")}).call(this)}))}).call(this)}))},

/*

    // String Literals
    //
    escapeChar      = <'\\' char>:c                                 -> unescape(c)
*/
"escapeChar":function(){var c;return this._or((function(){return (function(){undefined;return (function(){c=this._consumedBy((function(){return (function(){this._applyWithArgs("exactly","\\");return this._apply("char")}).call(this)}));return unescape(c)}).call(this)}).call(this)}))},

/*

    string          = '"' (escapeChar | ~'"' char)*:cs '"'          -> __.String(cs.join(''))
                    | ('#' | '`') iName:n                           -> __.String(cs.join(''))
*/
"string":function(){var cs,n;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("exactly","\"");cs=this._many((function(){return this._or((function(){return (function(){return this._apply("escapeChar")}).call(this)}),(function(){return (function(){this._not((function(){return this._applyWithArgs("exactly","\"")}));return this._apply("char")}).call(this)}))}));this._applyWithArgs("exactly","\"");return __.String(cs.join(""))}).call(this)}),(function(){return (function(){this._or((function(){return (function(){return this._applyWithArgs("exactly","#")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","`")}).call(this)}));n=this._apply("iName");return __.String(cs.join(""))}).call(this)}))}).call(this)}))},

/*

    // Punctuator symbols
    //
    punctuator         = ( ``...'' | ``>>='' | ``<<='' | ``+='' | ``-=''
                  | ``*='' | ``/='' | ``%='' | ``&='' | ``^=''
                  | ``|='' | ``>>'' | ``<<'' | ``++'' | ``--''
                  | ``->'' | ``&&'' | ``||'' | ``<='' | ``>=''
                  | ``=='' | ``!='' | ';' | '{' | '}' | ','
                  | ':' | '=' | '(' | ')' | '[' | ']' | '.'
                  | '&' | '!' | '~' | '-' | '+' | '*' | '/'
                  | '%' | '<' | '>' | '^' | '|' | '?' ):s           -> __.Punctuator(s)
*/
"punctuator":function(){var s;return this._or((function(){return (function(){undefined;return (function(){s=this._or((function(){return (function(){return this._applyWithArgs("seq","...")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq",">>=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","<<=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","+=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","-=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","*=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","/=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","%=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","&=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","^=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","|=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq",">>")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","<<")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","++")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","--")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","->")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","&&")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","||")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","<=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq",">=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","==")}).call(this)}),(function(){return (function(){return this._applyWithArgs("seq","!=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly",";")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","{")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","}")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly",",")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly",":")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","(")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly",")")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","[")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","]")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly",".")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","&")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","!")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","~")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","-")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","+")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","*")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","/")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","%")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","<")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly",">")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","^")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","|")}).call(this)}),(function(){return (function(){return this._applyWithArgs("exactly","?")}).call(this)}));return __.Punctuator(s)}).call(this)}).call(this)}))},

/*


    token :tt       = spaces ( ( punctuator | keyword ):t ?(t.value() == tt)        -> t
                    | (id | number | string):t ?(t[0] == tt)                        -> t
                    )
*/
"token":function(){var tt,t;return this._or((function(){return (function(){(function(){return tt=this._apply("anything")}).call(this);return (function(){this._apply("spaces");return this._or((function(){return (function(){t=this._or((function(){return (function(){return this._apply("punctuator")}).call(this)}),(function(){return (function(){return this._apply("keyword")}).call(this)}));this._pred((t.value() == tt));return t}).call(this)}),(function(){return (function(){t=this._or((function(){return (function(){return this._apply("id")}).call(this)}),(function(){return (function(){return this._apply("number")}).call(this)}),(function(){return (function(){return this._apply("string")}).call(this)}));this._pred((t[(0)] == tt));return t}).call(this)}))}).call(this)}).call(this)}))},

/*


    // Expressions
    //
    // TODO: arg_expr_list .. is it just an alias to expression?
    // FIXME: There could be a difference due to semantics..

    listof :p       = apply(p):x ("," apply(p))*:y                  -> {y.unshift(x); y}
*/
"listof":function(){var p,x,y;return this._or((function(){return (function(){(function(){return p=this._apply("anything")}).call(this);return (function(){x=this._applyWithArgs("apply",p);y=this._many((function(){return (function(){this._applyWithArgs("token",",");return this._applyWithArgs("apply",p)}).call(this)}));return (function (){y.unshift(x);return y}).call(this)}).call(this)}).call(this)}))},

/*

    expr            =  listof(#assign_expr):le                      -> (le.length > 1? __.SequenceExpr(le) : le[0])
*/
"expr":function(){var le;return this._or((function(){return (function(){undefined;return (function(){le=this._applyWithArgs("listof","assign_expr");return ((le["length"] > (1))?__.SequenceExpr(le):le[(0)])}).call(this)}).call(this)}))},

/*


    assign_expr     = unary_expr:lhs assign_op:op assign_expr:rhs   -> __.AssignExpr(lhs, rhs).operator(op.value())
                    | cond_expr
*/
"assign_expr":function(){var lhs,op,rhs;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){lhs=this._apply("unary_expr");op=this._apply("assign_op");rhs=this._apply("assign_expr");return __.AssignExpr(lhs,rhs).operator(op.value())}).call(this)}),(function(){return (function(){return this._apply("cond_expr")}).call(this)}))}).call(this)}))},

/*

    cond_expr       = lor_expr:e "?" expr:t ":" cond_expr:f         -> __.CondExpr(e, t, f)
                    | lor_expr
*/
"cond_expr":function(){var e,t,f;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){e=this._apply("lor_expr");this._applyWithArgs("token","?");t=this._apply("expr");this._applyWithArgs("token",":");f=this._apply("cond_expr");return __.CondExpr(e,t,f)}).call(this)}),(function(){return (function(){return this._apply("lor_expr")}).call(this)}))}).call(this)}))},

/*


    // Binary operations
    //
    lor_expr        = lor_expr:x "||" lar_expr:y                    -> __.BinaryExpr(x, y).operator("||")
                    | lar_expr
*/
"lor_expr":function(){var x,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("lor_expr");this._applyWithArgs("token","||");y=this._apply("lar_expr");return __.BinaryExpr(x,y).operator("||")}).call(this)}),(function(){return (function(){return this._apply("lar_expr")}).call(this)}))}).call(this)}))},

/*
    lar_expr        = lar_expr:x "&&" ior_expr:y                    -> __.BinaryExpr(x, y).operator("&&")
                    | ior_expr
*/
"lar_expr":function(){var x,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("lar_expr");this._applyWithArgs("token","&&");y=this._apply("ior_expr");return __.BinaryExpr(x,y).operator("&&")}).call(this)}),(function(){return (function(){return this._apply("ior_expr")}).call(this)}))}).call(this)}))},

/*
    ior_expr        = ior_expr:x "|" xor_expr:y                     -> __.BinaryExpr(x, y).operator("|")
                    | xor_expr
*/
"ior_expr":function(){var x,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("ior_expr");this._applyWithArgs("token","|");y=this._apply("xor_expr");return __.BinaryExpr(x,y).operator("|")}).call(this)}),(function(){return (function(){return this._apply("xor_expr")}).call(this)}))}).call(this)}))},

/*
    xor_expr        = xor_expr:x "^" and_expr:y                     -> __.BinaryExpr(x, y).operator("^")
                    | and_expr
*/
"xor_expr":function(){var x,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("xor_expr");this._applyWithArgs("token","^");y=this._apply("and_expr");return __.BinaryExpr(x,y).operator("^")}).call(this)}),(function(){return (function(){return this._apply("and_expr")}).call(this)}))}).call(this)}))},

/*
    and_expr        = and_expr:x "&" eq_expr:y                      -> __.BinaryExpr(x, y).operator("&")
                    | eq_expr
*/
"and_expr":function(){var x,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("and_expr");this._applyWithArgs("token","&");y=this._apply("eq_expr");return __.BinaryExpr(x,y).operator("&")}).call(this)}),(function(){return (function(){return this._apply("eq_expr")}).call(this)}))}).call(this)}))},

/*
    eq_expr         = eq_expr:x ( "==" | "!=" ):op rel_expr:y       -> __.BinaryExpr(x, y).operator(op.value())
                    | rel_expr
*/
"eq_expr":function(){var x,op,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("eq_expr");op=this._or((function(){return (function(){return this._applyWithArgs("token","==")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","!=")}).call(this)}));y=this._apply("rel_expr");return __.BinaryExpr(x,y).operator(op.value())}).call(this)}),(function(){return (function(){return this._apply("rel_expr")}).call(this)}))}).call(this)}))},

/*
    rel_expr        = rel_expr:x ( "<=" | "<"
                                    | ">=" | ">"):op shift_expr:y   -> __.BinaryExpr(x, y).operator(op.value())
                    | shift_expr
*/
"rel_expr":function(){var x,op,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("rel_expr");op=this._or((function(){return (function(){return this._applyWithArgs("token","<=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","<")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token",">=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token",">")}).call(this)}));y=this._apply("shift_expr");return __.BinaryExpr(x,y).operator(op.value())}).call(this)}),(function(){return (function(){return this._apply("shift_expr")}).call(this)}))}).call(this)}))},

/*
    shift_expr      = shift_expr:x ( "<<" | ">>" ):op add_expr:y    -> __.BinaryExpr(x, y).operator(op.value())
                    | add_expr
*/
"shift_expr":function(){var x,op,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("shift_expr");op=this._or((function(){return (function(){return this._applyWithArgs("token","<<")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token",">>")}).call(this)}));y=this._apply("add_expr");return __.BinaryExpr(x,y).operator(op.value())}).call(this)}),(function(){return (function(){return this._apply("add_expr")}).call(this)}))}).call(this)}))},

/*
    add_expr        = add_expr:x ( "+" | "-" ):op mult_expr:y          -> __.BinaryExpr(x, y).operator(op.value())
                    | mult_expr
*/
"add_expr":function(){var x,op,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("add_expr");op=this._or((function(){return (function(){return this._applyWithArgs("token","+")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","-")}).call(this)}));y=this._apply("mult_expr");return __.BinaryExpr(x,y).operator(op.value())}).call(this)}),(function(){return (function(){return this._apply("mult_expr")}).call(this)}))}).call(this)}))},

/*
    mult_expr       = mult_expr:x ( "*" | "/" | "%" ):op prefix_expr:y -> __.BinaryExpr(x, y).operator(op.value())
                    | prefix_expr
*/
"mult_expr":function(){var x,op,y;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){x=this._apply("mult_expr");op=this._or((function(){return (function(){return this._applyWithArgs("token","*")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","/")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","%")}).call(this)}));y=this._apply("prefix_expr");return __.BinaryExpr(x,y).operator(op.value())}).call(this)}),(function(){return (function(){return this._apply("prefix_expr")}).call(this)}))}).call(this)}))},

/*

    assign_op       = "=" | "*=" | "/=" | ">>=" | "<<=" | "+=" | "-="
                    | "%=" | "&=" | "|=" | "^="
*/
"assign_op":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._applyWithArgs("token","=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","*=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","/=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token",">>=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","<<=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","+=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","-=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","%=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","&=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","|=")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","^=")}).call(this)}))}).call(this)}))},

/*


    // Unary operators
    //

    //
    prefix_expr     = ( "++" | "--" ):op spacesNoNl unary_expr:e    -> __.UpdateExpr(e).operator(op.value())
                    | unary_expr
*/
"prefix_expr":function(){var op,e;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){op=this._or((function(){return (function(){return this._applyWithArgs("token","++")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","--")}).call(this)}));this._apply("spacesNoNl");e=this._apply("unary_expr");return __.UpdateExpr(e).operator(op.value())}).call(this)}),(function(){return (function(){return this._apply("unary_expr")}).call(this)}))}).call(this)}))},

/*

    //
    unary_expr      = ( "&" | "*" | "+" | "-"
                            | "~" | "!" ):op prefix_expr:e          -> __.UnaryExpr(e).operator(op.value())
                    | "sizeof" unary_expr:e
                    | postfix_expr
*/
"unary_expr":function(){var op,e;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){op=this._or((function(){return (function(){return this._applyWithArgs("token","&")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","*")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","+")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","-")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","~")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","!")}).call(this)}));e=this._apply("prefix_expr");return __.UnaryExpr(e).operator(op.value())}).call(this)}),(function(){return (function(){this._applyWithArgs("token","sizeof");return e=this._apply("unary_expr")}).call(this)}),(function(){return (function(){return this._apply("postfix_expr")}).call(this)}))}).call(this)}))},

/*

    postfix_expr    = left_expr:e spacesNoNl ( "++" | "--" ):op     -> __.UpdateExpr(e).operator(op.value()).prefix(false)
                    | left_expr
*/
"postfix_expr":function(){var e,op;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){e=this._apply("left_expr");this._apply("spacesNoNl");op=this._or((function(){return (function(){return this._applyWithArgs("token","++")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","--")}).call(this)}));return __.UpdateExpr(e).operator(op.value()).prefix(false)}).call(this)}),(function(){return (function(){return this._apply("left_expr")}).call(this)}))}).call(this)}))},

/*

    left_expr       = left_expr:p call_expr(p)
                    | left_expr:p member_expr(p)
                    | primary_expr
*/
"left_expr":function(){var p;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){p=this._apply("left_expr");return this._applyWithArgs("call_expr",p)}).call(this)}),(function(){return (function(){p=this._apply("left_expr");return this._applyWithArgs("member_expr",p)}).call(this)}),(function(){return (function(){return this._apply("primary_expr")}).call(this)}))}).call(this)}))},

/*

    call_expr :p    = "(" listOf(#assign_expr, ","):as ")"          -> __.CallExpr(p, as)
*/
"call_expr":function(){var p,as;return this._or((function(){return (function(){(function(){return p=this._apply("anything")}).call(this);return (function(){this._applyWithArgs("token","(");as=this._applyWithArgs("listOf","assign_expr",",");this._applyWithArgs("token",")");return __.CallExpr(p,as)}).call(this)}).call(this)}))},

/*

    member_expr :p  = ( "[" expr:e "]"                              -> __.MemberExpr(p, e)
                        |   "." "Id":i                              -> __.MemberExpr(p).name(i.value())
                        |   "->" "Id":i                             -> __.PointerExpr(p).name(i.value())
                      )
*/
"member_expr":function(){var p,e,i;return this._or((function(){return (function(){(function(){return p=this._apply("anything")}).call(this);return (function(){return this._or((function(){return (function(){this._applyWithArgs("token","[");e=this._apply("expr");this._applyWithArgs("token","]");return __.MemberExpr(p,e)}).call(this)}),(function(){return (function(){this._applyWithArgs("token",".");i=this._applyWithArgs("token","Id");return __.MemberExpr(p).name(i.value())}).call(this)}),(function(){return (function(){this._applyWithArgs("token","->");i=this._applyWithArgs("token","Id");return __.PointerExpr(p).name(i.value())}).call(this)}))}).call(this)}).call(this)}))},

/*

    primary_expr    = "Id"
                    | "Number"
                    | "String"
                    | "(" expr:e ")"                                -> __.GroupExpr(e)
*/
"primary_expr":function(){var e;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._applyWithArgs("token","Id")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","Number")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","String")}).call(this)}),(function(){return (function(){this._applyWithArgs("token","(");e=this._apply("expr");this._applyWithArgs("token",")");return __.GroupExpr(e)}).call(this)}))}).call(this)}))},

/*

    const_expr      = cond_expr:e                                   -> e
*/
"const_expr":function(){var e;return this._or((function(){return (function(){undefined;return (function(){e=this._apply("cond_expr");return e}).call(this)}).call(this)}))},

/*

    // Declaration statements
    // Statements that do "type" specification
    //

    declaration     = decl_specs:ds init_decl_lst:idec ";"             -> __.VarDeclStmt(ds, idec)
*/
"declaration":function(){var ds,idec;return this._or((function(){return (function(){undefined;return (function(){ds=this._apply("decl_specs");idec=this._apply("init_decl_lst");this._applyWithArgs("token",";");return __.VarDeclStmt(ds,idec)}).call(this)}).call(this)}))},

/*

    decl_specs      = store_cl_spec:s decl_specs*:ds                -> { res = declattr();
                                                                         if (ds.length === 0) {
                                                                            res.storage_class=s.value()
                                                                         } else {
                                                                            res = ds[0];
                                                                            res.storage_class=s.value()
                                                                         };
                                                                         res
                                                                        }
                    | type_spec:t decl_specs*:ds                    -> { res = declattr();
                                                                         if (ds.length == 0) {
                                                                            res.type_spec=t.value()
                                                                         } else {
                                                                            res = ds[0];
                                                                            res.type_spec=t.value()
                                                                         };
                                                                         res
                                                                        }
                    | type_qualifier:t decl_specs*:ds               -> { res = declattr();
                                                                         if (ds.length === 0) {
                                                                            res.type_qual=t.value()
                                                                         } else {
                                                                            res = ds[0];
                                                                            res.type_qual=t.value()
                                                                         };
                                                                         res
                                                                        }
*/
"decl_specs":function(){var s,ds,t;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){s=this._apply("store_cl_spec");ds=this._many((function(){return this._apply("decl_specs")}));return (function (){(res=declattr());if((ds["length"] === (0))){(res["storage_class"]=s.value())}else{(res=ds[(0)]);(res["storage_class"]=s.value())};undefined;return res}).call(this)}).call(this)}),(function(){return (function(){t=this._apply("type_spec");ds=this._many((function(){return this._apply("decl_specs")}));return (function (){(res=declattr());if((ds["length"] == (0))){(res["type_spec"]=t.value())}else{(res=ds[(0)]);(res["type_spec"]=t.value())};undefined;return res}).call(this)}).call(this)}),(function(){return (function(){t=this._apply("type_qualifier");ds=this._many((function(){return this._apply("decl_specs")}));return (function (){(res=declattr());if((ds["length"] === (0))){(res["type_qual"]=t.value())}else{(res=ds[(0)]);(res["type_qual"]=t.value())};undefined;return res}).call(this)}).call(this)}))}).call(this)}))},

/*

    init_decl_lst   = listOf(#init_decl, ',')
*/
"init_decl_lst":function(){return this._or((function(){return (function(){undefined;return (function(){return this._applyWithArgs("listOf","init_decl",",")}).call(this)}).call(this)}))},

/*

    init_decl       = declarator:d "=" initializer:i                -> __.VarBinding(d, i)
                    | declarator:d                                  -> __.VarBinding(d)
*/
"init_decl":function(){var d,i;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){d=this._apply("declarator");this._applyWithArgs("token","=");i=this._apply("initializer");return __.VarBinding(d,i)}).call(this)}),(function(){return (function(){d=this._apply("declarator");return __.VarBinding(d)}).call(this)}))}).call(this)}))},

/*

    store_cl_spec   = "extern" | "static" | "auto" | "register"
*/
"store_cl_spec":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._applyWithArgs("token","extern")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","static")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","auto")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","register")}).call(this)}))}).call(this)}))},

/*

    type_spec       = "void" | "char" | "short" | "int" | "long"
                    | "float" | "double" | "signed" | "unsigned"
                    | enum_spec
*/
"type_spec":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._applyWithArgs("token","void")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","char")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","short")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","int")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","long")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","float")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","double")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","signed")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","unsigned")}).call(this)}),(function(){return (function(){return this._apply("enum_spec")}).call(this)}))}).call(this)}))},

/*

    enum_spec       = "enum" "Id":s                                 -> __.EnumDeclartion().name(s)
                    | "enum" "Id":s "{" listOf(#enumerator, ","):e "}"  -> __.EnumDeclaration(e).name(s)
                    | "enum" "{" listOf(#enumerator, ","): e "}"    -> __.EnumDeclaration(e)
*/
"enum_spec":function(){var s,e;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("token","enum");s=this._applyWithArgs("token","Id");return __.EnumDeclartion().name(s)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","enum");s=this._applyWithArgs("token","Id");this._applyWithArgs("token","{");e=this._applyWithArgs("listOf","enumerator",",");this._applyWithArgs("token","}");return __.EnumDeclaration(e).name(s)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","enum");this._applyWithArgs("token","{");e=this._applyWithArgs("listOf","enumerator",",");this._applyWithArgs("token","}");return __.EnumDeclaration(e)}).call(this)}))}).call(this)}))},

/*

    enumerator      = "Id":s                                        -> __.Enumerator().name(s)
                    | "Id":s const_expr:e                           -> __.Enumerator(e).name(s)
*/
"enumerator":function(){var s,e;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){s=this._applyWithArgs("token","Id");return __.Enumerator().name(s)}).call(this)}),(function(){return (function(){s=this._applyWithArgs("token","Id");e=this._apply("const_expr");return __.Enumerator(e).name(s)}).call(this)}))}).call(this)}))},

/*


    type_qualifier  = "const"
                    | "volatile"
*/
"type_qualifier":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._applyWithArgs("token","const")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","volatile")}).call(this)}))}).call(this)}))},

/*

    declarator      = pointer:p dir_declarator:d                    -> {
                                                                         if (p.pointer_level > 0)
                                                                            d.pointer_level(p.pointer_level);
                                                                         if (p.pointer_type !== undefined)
                                                                            d.pointer_type(p.pointer_type);
                                                                         d;
                                                                        }
                    | dir_declarator
*/
"declarator":function(){var p,d;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){p=this._apply("pointer");d=this._apply("dir_declarator");return (function (){if((p["pointer_level"] > (0))){d.pointer_level(p["pointer_level"])}else{undefined};if((p["pointer_type"] !== undefined)){d.pointer_type(p["pointer_type"])}else{undefined};return d}).call(this)}).call(this)}),(function(){return (function(){return this._apply("dir_declarator")}).call(this)}))}).call(this)}))},

/*

    dir_declarator  = dir_declarator:d pmember_decl(d)
                    | dir_declarator:d pcall_decl(d)
                    | "(" declarator:d ")"                          -> {d.type('func'); d}
                    | "Id":s                                        -> __.Declarator().name(s.value())
*/
"dir_declarator":function(){var d,s;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){d=this._apply("dir_declarator");return this._applyWithArgs("pmember_decl",d)}).call(this)}),(function(){return (function(){d=this._apply("dir_declarator");return this._applyWithArgs("pcall_decl",d)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","(");d=this._apply("declarator");this._applyWithArgs("token",")");return (function (){d.type("func");return d}).call(this)}).call(this)}),(function(){return (function(){s=this._applyWithArgs("token","Id");return __.Declarator().name(s.value())}).call(this)}))}).call(this)}))},

/*

    pmember_decl :p = "[" const_expr:e "]"                            -> {
                                                                         p.type('member');
                                                                         p.append(e);
                                                                         p;
                                                                        }
                    | "[" empty "]"                                   -> {
                                                                         p.type('member');
                                                                         p;
                                                                        }
*/
"pmember_decl":function(){var p,e;return this._or((function(){return (function(){(function(){return p=this._apply("anything")}).call(this);return this._or((function(){return (function(){this._applyWithArgs("token","[");e=this._apply("const_expr");this._applyWithArgs("token","]");return (function (){p.type("member");p.append(e);return p}).call(this)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","[");this._apply("empty");this._applyWithArgs("token","]");return (function (){p.type("member");return p}).call(this)}).call(this)}))}).call(this)}))},

/*

    pcall_decl :p   = "(" ( &keyword param_type_lst:pl                -> {
                                                                         p.type('call');
                                                                         p.appendAll(pl);
                                                                         p;
                                                                        }
                            | ident_list:ll                         -> {
                                                                         p.type('call');
                                                                         p.appendAll(ll);
                                                                         p;
                                                                        }
                            | empty ) ")"                   -> {
                                                                         p.type('call');
                                                                         p;
                                                                        }
*/
"pcall_decl":function(){var p,pl,ll;return this._or((function(){return (function(){(function(){return p=this._apply("anything")}).call(this);return (function(){this._applyWithArgs("token","(");this._or((function(){return (function(){this._lookahead((function(){return this._apply("keyword")}));pl=this._apply("param_type_lst");return (function (){p.type("call");p.appendAll(pl);return p}).call(this)}).call(this)}),(function(){return (function(){ll=this._apply("ident_list");return (function (){p.type("call");p.appendAll(ll);return p}).call(this)}).call(this)}),(function(){return (function(){return this._apply("empty")}).call(this)}));this._applyWithArgs("token",")");return (function (){p.type("call");return p}).call(this)}).call(this)}).call(this)}))},

/*

    pointer         = "*"+:pn ( "const" | "volatile" )?:pt          -> {pointer_level:pn.length, pointer_type:pt === undefined? pt : pt.value()}
*/
"pointer":function(){var pn,pt;return this._or((function(){return (function(){undefined;return (function(){pn=this._many1((function(){return this._applyWithArgs("token","*")}));pt=this._opt((function(){return this._or((function(){return (function(){return this._applyWithArgs("token","const")}).call(this)}),(function(){return (function(){return this._applyWithArgs("token","volatile")}).call(this)}))}));return ({"pointer_level": pn["length"],"pointer_type": ((pt === undefined)?pt:pt.value())})}).call(this)}).call(this)}))},

/*


    ident_list      = listOf(#id, ',')
*/
"ident_list":function(){return this._or((function(){return (function(){undefined;return (function(){return this._applyWithArgs("listOf","id",",")}).call(this)}).call(this)}))},

/*

    param_type_lst  = listOf(#param_decl, ",")
*/
"param_type_lst":function(){return this._or((function(){return (function(){undefined;return (function(){return this._applyWithArgs("listOf","param_decl",",")}).call(this)}).call(this)}))},

/*

    param_decl      = decl_specs:ds declarator?:dl                  -> __.ParamDeclaration(ds, dl)
*/
"param_decl":function(){var ds,dl;return this._or((function(){return (function(){undefined;return (function(){ds=this._apply("decl_specs");dl=this._opt((function(){return this._apply("declarator")}));return __.ParamDeclaration(ds,dl)}).call(this)}).call(this)}))},

/*

    initializer     = "{" listOf(#initializer_lst, ","):p "}"       -> __.GroupInitializer(p)
                    | assign_expr
*/
"initializer":function(){var p;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("token","{");p=this._applyWithArgs("listOf","initializer_lst",",");this._applyWithArgs("token","}");return __.GroupInitializer(p)}).call(this)}),(function(){return (function(){return this._apply("assign_expr")}).call(this)}))}).call(this)}))},

/*

    initializer_lst = listOf(#initializer, ",")
*/
"initializer_lst":function(){return this._or((function(){return (function(){undefined;return (function(){return this._applyWithArgs("listOf","initializer",",")}).call(this)}).call(this)}))},

/*


    // C Statements
    //

    stmt            = labeled_stmt
                    | compound_stmt
                    | selection_stmt
                    | iteration_stmt
                    | jump_stmt
                    | expr_stmt
*/
"stmt":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("labeled_stmt")}).call(this)}),(function(){return (function(){return this._apply("compound_stmt")}).call(this)}),(function(){return (function(){return this._apply("selection_stmt")}).call(this)}),(function(){return (function(){return this._apply("iteration_stmt")}).call(this)}),(function(){return (function(){return this._apply("jump_stmt")}).call(this)}),(function(){return (function(){return this._apply("expr_stmt")}).call(this)}))}).call(this)}))},

/*

    expr_stmt       = expr?:e ";"                                           -> __.ExprStmt(e)
*/
"expr_stmt":function(){var e;return this._or((function(){return (function(){undefined;return (function(){e=this._opt((function(){return this._apply("expr")}));this._applyWithArgs("token",";");return __.ExprStmt(e)}).call(this)}).call(this)}))},

/*

    labeled_stmt    = "Id":l ":" stmt:s                                     -> __.LabeledStmt(l.value(), s)
                    | "case" const_expr:e ":" stmt:s                        -> __.CaseStmt(e, s)
                    | "default" ":" stmt:s                                  -> __.DefaultStmt(s)
*/
"labeled_stmt":function(){var l,s,e;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){l=this._applyWithArgs("token","Id");this._applyWithArgs("token",":");s=this._apply("stmt");return __.LabeledStmt(l.value(),s)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","case");e=this._apply("const_expr");this._applyWithArgs("token",":");s=this._apply("stmt");return __.CaseStmt(e,s)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","default");this._applyWithArgs("token",":");s=this._apply("stmt");return __.DefaultStmt(s)}).call(this)}))}).call(this)}))},

/*

    compound_stmt   = "{" declaration*:d stmt*:s "}"                        -> __.CompoundStmt(d, s)
*/
"compound_stmt":function(){var d,s;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","{");d=this._many((function(){return this._apply("declaration")}));s=this._many((function(){return this._apply("stmt")}));this._applyWithArgs("token","}");return __.CompoundStmt(d,s)}).call(this)}).call(this)}))},

/*

    selection_stmt  = "if" "(" expr:e ")" stmt:s ( "else" stmt:f            -> __.IfStmt(e, s, f)
                                                    | empty                 -> __.IfStmt(e, s)
                                                 )
                    | "switch" "(" expr:e ")" stmt:s                        -> __.SwitchStmt(e, s)
*/
"selection_stmt":function(){var e,s,f;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("token","if");this._applyWithArgs("token","(");e=this._apply("expr");this._applyWithArgs("token",")");s=this._apply("stmt");return this._or((function(){return (function(){this._applyWithArgs("token","else");f=this._apply("stmt");return __.IfStmt(e,s,f)}).call(this)}),(function(){return (function(){this._apply("empty");return __.IfStmt(e,s)}).call(this)}))}).call(this)}),(function(){return (function(){this._applyWithArgs("token","switch");this._applyWithArgs("token","(");e=this._apply("expr");this._applyWithArgs("token",")");s=this._apply("stmt");return __.SwitchStmt(e,s)}).call(this)}))}).call(this)}))},

/*

    iteration_stmt  = "while" "(" expr:e ")" stmt:s                         -> __.WhileStmt(e, s)
                    | "do" stmt:s "while" "(" expr:e ")" ";"                -> __.DoWhileStmt(e, s)
                    | "for" "(" expr?:se ";" expr?:ee ";" expr?:ie ")" stmt:s   -> __.ForStmt(se, ee, ie, s)
*/
"iteration_stmt":function(){var e,s,se,ee,ie;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("token","while");this._applyWithArgs("token","(");e=this._apply("expr");this._applyWithArgs("token",")");s=this._apply("stmt");return __.WhileStmt(e,s)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","do");s=this._apply("stmt");this._applyWithArgs("token","while");this._applyWithArgs("token","(");e=this._apply("expr");this._applyWithArgs("token",")");this._applyWithArgs("token",";");return __.DoWhileStmt(e,s)}).call(this)}),(function(){return (function(){this._applyWithArgs("token","for");this._applyWithArgs("token","(");se=this._opt((function(){return this._apply("expr")}));this._applyWithArgs("token",";");ee=this._opt((function(){return this._apply("expr")}));this._applyWithArgs("token",";");ie=this._opt((function(){return this._apply("expr")}));this._applyWithArgs("token",")");s=this._apply("stmt");return __.ForStmt(se,ee,ie,s)}).call(this)}))}).call(this)}))},

/*

    jump_stmt       = "goto" "Id":l ";"                         -> __.GotoStmt(l.value())
                    | "continue" ";"                            -> __.ContinueStmt()
                    | "break" ";"                               -> __.BreakStmt()
                    | "return" expr?:e ";"                      -> __.ReturnStmt(e)
*/
"jump_stmt":function(){var l,e;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){this._applyWithArgs("token","goto");l=this._applyWithArgs("token","Id");this._applyWithArgs("token",";");return __.GotoStmt(l.value())}).call(this)}),(function(){return (function(){this._applyWithArgs("token","continue");this._applyWithArgs("token",";");return __.ContinueStmt()}).call(this)}),(function(){return (function(){this._applyWithArgs("token","break");this._applyWithArgs("token",";");return __.BreakStmt()}).call(this)}),(function(){return (function(){this._applyWithArgs("token","return");e=this._opt((function(){return this._apply("expr")}));this._applyWithArgs("token",";");return __.ReturnStmt(e)}).call(this)}))}).call(this)}))},

/*

    external_decl   = function_def
                    | declaration
*/
"external_decl":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("function_def")}).call(this)}),(function(){return (function(){return this._apply("declaration")}).call(this)}))}).call(this)}))},

/*

    function_def    = decl_specs?:ds declarator:dc compound_stmt:s      -> __.FuncDefinition(ds, dc, s)
*/
"function_def":function(){var ds,dc,s;return this._or((function(){return (function(){undefined;return (function(){ds=this._opt((function(){return this._apply("decl_specs")}));dc=this._apply("declarator");s=this._apply("compound_stmt");return __.FuncDefinition(ds,dc,s)}).call(this)}).call(this)}))},

/*


    translation_u   = external_decl+:s                            -> __.Program(s)
*/
"translation_u":function(){var s;return this._or((function(){return (function(){undefined;return (function(){s=this._many1((function(){return this._apply("external_decl")}));return __.Program(s)}).call(this)}).call(this)}))},

/*


    topLevel     = translation_u:u spaces end    -> u


*/
"topLevel":function(){var u;return this._or((function(){return (function(){undefined;return (function(){u=this._apply("translation_u");this._apply("spaces");this._apply("end");return u}).call(this)}).call(this)}))}});(CParser["position_info"]=(function (input,from,to){var position=(function (pos){{var line=(1);var column=undefined};for(var i=pos;(i >= (0));i--){if((input[i] === "\n")){if(((typeof column) == "undefined")){(column=(pos - i))}else{undefined};line++}else{undefined}};if((line === (1))){(column=pos)}else{undefined};return ({"line": line,"column": column})});return ({"source": input.slice(from,to),"start": position(from),"end": position(to)})}));(CParser["spec"]=({"keywords": ["auto","break","case","char","const","continue","default","do","double","else","enum","extern","float","for","goto","if","int","long","register","return","short","signed","sizeof","static","struct","switch","typedef","union","unsigned","void","volatile","while"],"isKeyword": (function (k){return (this["keywords"].indexOf(k) != (- (1)))})}));(CParser["parse"]=(function (input){return CParser.matchAll(input,"topLevel")}));(module["exports"]=CParser)}