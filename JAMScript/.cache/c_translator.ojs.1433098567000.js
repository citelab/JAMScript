{{var JsonMLWalker=require("../../jsonml/grammars/jsonml_walker.ojs");var join=require("../../utils.js")["join"];var escape=require("../../utils.js")["escape_string"]}var CPretty=JsonMLWalker.inherit({_grammarName: "CPretty",

/*

    // Literals
    //
    Id              :n                                                                  -> n.value()
*/
"Id":function(){var n;return this._or((function(){return (function(){n=this._apply("anything");return n.value()}).call(this)}))},

/*

    Number          :n  = ?n.is('kind', 'hex')                                          -> join('0x', n.value().toString(16))
                        | ?n.is('kind', 'oct')                                          -> join('0', n.value().toString(8))
                        | ?n.is('value', parseFloat(n.original()))                      -> n.original()           // if something changed then don't
                        | empty                                                         -> n.value().toString()
*/
"Number":function(){var n;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return this._or((function(){return (function(){this._pred(n.is("kind","hex"));return join("0x",n.value().toString((16)))}).call(this)}),(function(){return (function(){this._pred(n.is("kind","oct"));return join("0",n.value().toString((8)))}).call(this)}),(function(){return (function(){this._pred(n.is("value",parseFloat(n.original())));return n.original()}).call(this)}),(function(){return (function(){this._apply("empty");return n.value().toString()}).call(this)}))}).call(this)}))},

/*  // use the original string representation

    String          :n                                                                  -> join('"', escape(n.value()), '"')
*/
"String":function(){var n;return this._or((function(){return (function(){n=this._apply("anything");return join("\"",escape(n.value()),"\"")}).call(this)}))},

/*

    // Expressions
    //
    SequenceExpr    :n  = walk*:es                                                      -> es.join(', ')
*/
"SequenceExpr":function(){var n,es;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){es=this._many((function(){return this._apply("walk")}));return es.join(", ")}).call(this)}).call(this)}))},

/*

    AssignExpr      :n  = walk:lhs walk:rhs                                             -> join(lhs, ' ', n.operator(), ' ', rhs)
*/
"AssignExpr":function(){var n,lhs,rhs;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){lhs=this._apply("walk");rhs=this._apply("walk");return join(lhs," ",n.operator()," ",rhs)}).call(this)}).call(this)}))},

/*

    CondExpr        :n  = walk:ce walk:t walk:f                                         -> join(ce, ' ? ', t, ' : ', f)
*/
"CondExpr":function(){var n,ce,t,f;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){ce=this._apply("walk");t=this._apply("walk");f=this._apply("walk");return join(ce," ? ",t," : ",f)}).call(this)}).call(this)}))},

/*

    BinaryExpr      :n  = walk:lhs walk:rhs                                             -> join(lhs, ' ', n.operator(), ' ', rhs)
*/
"BinaryExpr":function(){var n,lhs,rhs;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){lhs=this._apply("walk");rhs=this._apply("walk");return join(lhs," ",n.operator()," ",rhs)}).call(this)}).call(this)}))},

/*

    UpdateExpr      :n = walk:e ( ?n.is('prefix')                                       -> join(n.operator(), e)
                                | empty                                                 -> join(e, n.operator())
                                )
*/
"UpdateExpr":function(){var n,e;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){e=this._apply("walk");return this._or((function(){return (function(){this._pred(n.is("prefix"));return join(n.operator(),e)}).call(this)}),(function(){return (function(){this._apply("empty");return join(e,n.operator())}).call(this)}))}).call(this)}).call(this)}))},

/*

    UnaryExpr       :n = walk:e ( ?n.operator().match(/^[+-~!*&]$/)                     -> join(n.operator(), e)
                                | empty                                                 -> join(n.operator(), ' ', e)
                                )
*/
"UnaryExpr":function(){var n,e;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){e=this._apply("walk");return this._or((function(){return (function(){this._pred(n.operator().match(/^[+-~!*&]$/));return join(n.operator(),e)}).call(this)}),(function(){return (function(){this._apply("empty");return join(n.operator()," ",e)}).call(this)}))}).call(this)}).call(this)}))},

/*

    CallExpr        :n = walk:e walk*:args                                              -> join(e, '(', args.join(', '), ')')
*/
"CallExpr":function(){var n,e,args;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){e=this._apply("walk");args=this._many((function(){return this._apply("walk")}));return join(e,"(",args.join(", "),")")}).call(this)}).call(this)}))},

/*

    MemberExpr      :n = ?n.is('access', 'name') walk:e                                 -> join(e, '.', n.name())
                       | walk:e walk:ae                                                 -> join(e, '[', ae, ']')
*/
"MemberExpr":function(){var n,e,ae;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return this._or((function(){return (function(){this._pred(n.is("access","name"));e=this._apply("walk");return join(e,".",n.name())}).call(this)}),(function(){return (function(){e=this._apply("walk");ae=this._apply("walk");return join(e,"[",ae,"]")}).call(this)}))}).call(this)}))},

/*

    PointerExpr     :n = ?n.is('access', 'pointer') walk:e                              -> join(e, '->',  n.name())
*/
"PointerExpr":function(){var n,e;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){this._pred(n.is("access","pointer"));e=this._apply("walk");return join(e,"->",n.name())}).call(this)}).call(this)}))},

/*

    GroupExpr       :n = walk:e                                                         -> join('(', e, ')')
*/
"GroupExpr":function(){var n,e;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){e=this._apply("walk");return join("(",e,")")}).call(this)}).call(this)}))},

/*

    // Declarations
    //

    VarDeclStmt     :n = walk+:vs                                                       -> join(this.print_sc(n), vs,join(','), ';')
*/
"VarDeclStmt":function(){var n,vs;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){vs=this._many1((function(){return this._apply("walk")}));return join(this.print_sc(n),vs,join(","),";")}).call(this)}).call(this)}))},

/*

    VarBinding      :n = walk:d walk:i                                                  -> {i != undefined ? join(d, ' = ', i) : d}
*/
"VarBinding":function(){var n,d,i;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){d=this._apply("walk");i=this._apply("walk");return ((i != undefined)?join(d," = ",i):d)}).call(this)}).call(this)}))},

/*

    Declarator      :n = ?n.is('type', 'member') walk:e                                 -> {join(this.print_ptr(n), n.name(), '[', e, ']')}
                       | ?n.is('type', 'call') walk+:e                                  -> {join(this.print_ptr(n), n.name(), '(', e.join(', '), ')')}
                       | ?n.is('type', 'func')                                          -> join(this.print_ptr(n), '(', n.name(), ')')
                       | empty                                                          -> {
                                                                                            if (n.is('type', 'member'))
                                                                                                join(this.print_ptr(n), n.name(), '[]');
                                                                                            else if (n.is('type', 'call'))
                                                                                                join(this.print_ptr(n), n.name(), '()');
                                                                                            else
                                                                                                join(this.print_ptr(n), n.name());
                                                                                          }
*/
"Declarator":function(){var n,e;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return this._or((function(){return (function(){this._pred(n.is("type","member"));e=this._apply("walk");return join(this.print_ptr(n),n.name(),"[",e,"]")}).call(this)}),(function(){return (function(){this._pred(n.is("type","call"));e=this._many1((function(){return this._apply("walk")}));return join(this.print_ptr(n),n.name(),"(",e.join(", "),")")}).call(this)}),(function(){return (function(){this._pred(n.is("type","func"));return join(this.print_ptr(n),"(",n.name(),")")}).call(this)}),(function(){return (function(){this._apply("empty");return (function (){if(n.is("type","member")){join(this.print_ptr(n),n.name(),"[]")}else{if(n.is("type","call")){join(this.print_ptr(n),n.name(),"()")}else{join(this.print_ptr(n),n.name())}}}).call(this)}).call(this)}))}).call(this)}))},

/*

    ParamDeclaration  :n = walk:d                                                       -> join(this.print_sc(n), ' ', d)
*/
"ParamDeclaration":function(){var n,d;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){d=this._apply("walk");return join(this.print_sc(n)," ",d)}).call(this)}).call(this)}))},

/*

    GroupInitializer  :n = walk+:p                                                      -> join('{', p.join(','), '}')
*/
"GroupInitializer":function(){var n,p;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){p=this._many1((function(){return this._apply("walk")}));return join("{",p.join(","),"}")}).call(this)}).call(this)}))},

/*


    // Statements
    //

    ExprStmt        :n = walk*:s                                                        -> join(s, ";")
*/
"ExprStmt":function(){var n,s;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){s=this._many((function(){return this._apply("walk")}));return join(s,";")}).call(this)}).call(this)}))},

/*

    LabeledStmt     :n = walk:s                                                         -> join(n.label(), ': ', s)
*/
"LabeledStmt":function(){var n,s;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){s=this._apply("walk");return join(n.label(),": ",s)}).call(this)}).call(this)}))},

/*

    CaseStmt        :n = walk:ex walk:st                                                -> join('case', ex, ':', st, ';')
*/
"CaseStmt":function(){var n,ex,st;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){ex=this._apply("walk");st=this._apply("walk");return join("case",ex,":",st,";")}).call(this)}).call(this)}))},

/*

    DefaultStmt     :n = walk:s                                                         -> join('default:', s, ';')
*/
"DefaultStmt":function(){var n,s;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){s=this._apply("walk");return join("default:",s,";")}).call(this)}).call(this)}))},

/*

    CompoundStmt    :n = walk*:d walk*:s                                                 -> join('{\n', this.indent(this.join_sc(d)), this.indent(this.join_sc(s)), '}\n')
*/
"CompoundStmt":function(){var n,d,s;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){d=this._many((function(){return this._apply("walk")}));s=this._many((function(){return this._apply("walk")}));return join("{\n",this.indent(this.join_sc(d)),this.indent(this.join_sc(s)),"}\n")}).call(this)}).call(this)}))},

/*

    IfStmt          :n = walk:c walk:t ( walk:f                                         -> join('if(', c, ') ', t, ' else ', f, ';')
                                               | (undefined | empty)                    -> join('if(', c, ') ', t, ';')
                                               )
*/
"IfStmt":function(){var n,c,t,f;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){c=this._apply("walk");t=this._apply("walk");return this._or((function(){return (function(){f=this._apply("walk");return join("if(",c,") ",t," else ",f,";")}).call(this)}),(function(){return (function(){this._or((function(){return (function(){return this._apply("undefined")}).call(this)}),(function(){return (function(){return this._apply("empty")}).call(this)}));return join("if(",c,") ",t,";")}).call(this)}))}).call(this)}).call(this)}))},

/*

    SwitchStmt      :n = walk:se walk:st                                                -> join('switch', '(', se, ')', st, ';')
*/
"SwitchStmt":function(){var n,se,st;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){se=this._apply("walk");st=this._apply("walk");return join("switch","(",se,")",st,";")}).call(this)}).call(this)}))},

/*

    WhileStmt       :n = walk:ce walk:s                                                 -> join('while(', ce, ') ', s, ';')
*/
"WhileStmt":function(){var n,ce,s;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){ce=this._apply("walk");s=this._apply("walk");return join("while(",ce,") ",s,";")}).call(this)}).call(this)}))},

/*

    DoWhileStmt     :n = walk:s walk:ce                                                 -> join('do ', s, ' while(', ce, ')', ';')
*/
"DoWhileStmt":function(){var n,s,ce;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){s=this._apply("walk");ce=this._apply("walk");return join("do ",s," while(",ce,")",";")}).call(this)}).call(this)}))},

/*

    ForStmt         :n = walk:ie walk:ce walk:ue walk:s                                 -> join('for(', ie, '; ', ce, '; ', ue, ') ', s, ';')
*/
"ForStmt":function(){var n,ie,ce,ue,s;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){ie=this._apply("walk");ce=this._apply("walk");ue=this._apply("walk");s=this._apply("walk");return join("for(",ie,"; ",ce,"; ",ue,") ",s,";")}).call(this)}).call(this)}))},

/*

    GotoStmt        :n = empty                                                          -> join('goto ', n.label(), ';')
*/
"GotoStmt":function(){var n;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){this._apply("empty");return join("goto ",n.label(),";")}).call(this)}).call(this)}))},

/*

    ContinueStmt    :n = empty                                                          -> 'continue;'
*/
"ContinueStmt":function(){var n;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){this._apply("empty");return "continue;"}).call(this)}).call(this)}))},

/*

    BreakStmt       :n = empty                                                          -> 'break;'
*/
"BreakStmt":function(){var n;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){this._apply("empty");return "break;"}).call(this)}).call(this)}))},

/*

    ReturnStmt      :n = walk:e ( ?(e !== undefined)                                    -> join('return ', e, ';')
                                | empty                                                 -> 'return;'
                                )
*/
"ReturnStmt":function(){var n,e;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){e=this._apply("walk");return this._or((function(){return (function(){this._pred((e !== undefined));return join("return ",e,";")}).call(this)}),(function(){return (function(){this._apply("empty");return "return;"}).call(this)}))}).call(this)}).call(this)}))},

/*

    // Function or Program Statements
    //

    FuncDefinition  :n = walk:de walk:st                                                ->join(this.print_sc(n), de, '{', st, '}')
*/
"FuncDefinition":function(){var n,de,st;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){de=this._apply("walk");st=this._apply("walk");return join(this.print_sc(n),de,"{",st,"}")}).call(this)}).call(this)}))},

/*

    Program         :n = walk*:cs                                                       -> cs.join(';\n')


*/
"Program":function(){var n,cs;return this._or((function(){return (function(){(function(){return n=this._apply("anything")}).call(this);return (function(){cs=this._many((function(){return this._apply("walk")}));return cs.join(";\n")}).call(this)}).call(this)}))}});(CPretty["print_ptr"]=(function (n){var pointtype="";if((n.pointer_level() == (0))){return ""}else{undefined};if((n.pointer_type() !== undefined)){(pointtype=join(n.pointer_type()," "))}else{undefined};if((n.pointer_level() == (1))){return join("*",pointtype)}else{return join("**",pointtype)}}));(CPretty["print_sc"]=(function (n){var scarr=[];if((n.storage_class() !== undefined)){scarr.push(n.storage_class())}else{undefined};if((n.type_qual() !== undefined)){scarr.push(n.type_qual())}else{undefined};if((n.type_spec() !== undefined)){scarr.push(n.type_spec())}else{undefined};return scarr.join(" ")}));(CPretty["join_sc"]=(function (cs){var output=[];for(var i=(0);(i < cs["length"]);i++){output.push(cs[i])};return output.join("\n")}));(CPretty["indent"]=(function (source,opts){(opts=(opts || ({})));var defaults=(function (key,value){if(((typeof opts[key]) == "undefined")){(opts[key]=value)}else{undefined}});defaults("width",this["tab_width"]);defaults("first_line",true);var space=Array((opts["width"] + (1))).join(" ");return ((opts["first_line"]?space:"") + source.split("\n").join(("\n" + space)))}));(CPretty["tab_width"]=(4));(CPretty["force_rules"]=true);(CPretty["translate"]=(function (input){return CPretty.match(input,"walk")}));(module["exports"]=CPretty)}