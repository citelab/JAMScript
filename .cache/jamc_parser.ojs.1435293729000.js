{{var CParser=require("../../c/grammars/c_parser.ojs");var ES5Parser=require("../../../deps/es5/grammars/es5_parser.ojs");var __=require("../nodes.js")}var JAMCParser=CParser.inherit({_grammarName: "JAMCParser",

/*

    namespace_spec  = "in" "Id":s                                       -> __.NamespaceSpec().name(s.value())
*/
"namespace_spec":function(){var s;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","in");s=this._applyWithArgs("token","Id");return __.NamespaceSpec().name(s.value())}).call(this)}).call(this)}))},

/*

    type_spec       = "jcallback":s                                     -> __.TypeSpec().type(s.value())
                    | ^type_spec
*/
"type_spec":function(){var s;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){s=this._applyWithArgs("token","jcallback");return __.TypeSpec().type(s.value())}).call(this)}),(function(){return (function(){return CParser._superApplyWithArgs(this,'type_spec')}).call(this)}))}).call(this)}))},

/*

    jamd_async_decl = "jamdef" decl_specs?:s declarator:d
                                    namespace_spec?:n                   -> __.JDeclaration(s, d, n).sync(false)
*/
"jamd_async_decl":function(){var s,d,n;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","jamdef");s=this._opt((function(){return this._apply("decl_specs")}));d=this._apply("declarator");n=this._opt((function(){return this._apply("namespace_spec")}));return __.JDeclaration(s,d,n).sync(false)}).call(this)}).call(this)}))},

/*

    jamd_sync_decl  = "jamdef" "sync" decl_specs?:s declarator:d
                                    namespace_spec?:n                   -> __.JDeclaration(s, d, n).sync(true)
*/
"jamd_sync_decl":function(){var s,d,n;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","jamdef");this._applyWithArgs("token","sync");s=this._opt((function(){return this._apply("decl_specs")}));d=this._apply("declarator");n=this._opt((function(){return this._apply("namespace_spec")}));return __.JDeclaration(s,d,n).sync(true)}).call(this)}).call(this)}))},

/*

    oncomp_decl     = "oncomplete" declarator:d                         -> __.ODeclaration(d).type("complete")
*/
"oncomp_decl":function(){var d;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","oncomplete");d=this._apply("declarator");return __.ODeclaration(d).type("complete")}).call(this)}).call(this)}))},

/*

    onerror_decl    = "onerror" declarator:d                            -> __.ODeclaration(d).type("error")
*/
"onerror_decl":function(){var d;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","onerror");d=this._apply("declarator");return __.ODeclaration(d).type("error")}).call(this)}).call(this)}))},

/*

    oncancel_decl   = "oncancel" declarator:d                           -> __.ODeclaration(d).type("cancel")
*/
"oncancel_decl":function(){var d;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","oncancel");d=this._apply("declarator");return __.ODeclaration(d).type("cancel")}).call(this)}).call(this)}))},

/*

    onverify_decl   = "onverify" declarator:d                           -> __.ODeclaration(d).type("verify")
*/
"onverify_decl":function(){var d;return this._or((function(){return (function(){undefined;return (function(){this._applyWithArgs("token","onverify");d=this._apply("declarator");return __.ODeclaration(d).type("verify")}).call(this)}).call(this)}))},

/*

    complete_block  = oncomp_decl:d ES5Parser.block:b                   -> __.CompleteBlock(d, b)
*/
"complete_block":function(){var d,b;return this._or((function(){return (function(){undefined;return (function(){d=this._apply("oncomp_decl");b=this._applyWithArgs("foreign",ES5Parser,'block');return __.CompleteBlock(d,b)}).call(this)}).call(this)}))},

/*

    error_block     = onerror_decl:d ES5Parser.block:b                  -> __.ErrorBlock(d, b)
*/
"error_block":function(){var d,b;return this._or((function(){return (function(){undefined;return (function(){d=this._apply("onerror_decl");b=this._applyWithArgs("foreign",ES5Parser,'block');return __.ErrorBlock(d,b)}).call(this)}).call(this)}))},

/*

    complete_stmt   = oncomp_decl:d compound_stmt:s                     -> __.CompleteStmt(d, s)
*/
"complete_stmt":function(){var d,s;return this._or((function(){return (function(){undefined;return (function(){d=this._apply("oncomp_decl");s=this._apply("compound_stmt");return __.CompleteStmt(d,s)}).call(this)}).call(this)}))},

/*

    error_stmt      = onerror_decl:d compound_stmt:s                    -> __.ErrorStmt(d, s)
*/
"error_stmt":function(){var d,s;return this._or((function(){return (function(){undefined;return (function(){d=this._apply("onerror_decl");s=this._apply("compound_stmt");return __.ErrorStmt(d,s)}).call(this)}).call(this)}))},

/*

    cancel_stmt     = oncancel_decl:d compound_stmt:s                   -> __.CancelStmt(d, s)
*/
"cancel_stmt":function(){var d,s;return this._or((function(){return (function(){undefined;return (function(){d=this._apply("oncancel_decl");s=this._apply("compound_stmt");return __.CancelStmt(d,s)}).call(this)}).call(this)}))},

/*

    verify_stmt     = onverify_decl:d compound_stmt:s                   -> __.VerifyStmt(d, s)
*/
"verify_stmt":function(){var d,s;return this._or((function(){return (function(){undefined;return (function(){d=this._apply("onverify_decl");s=this._apply("compound_stmt");return __.VerifyStmt(d,s)}).call(this)}).call(this)}))},

/*

    c_as_activity   = jamd_async_decl:j compound_stmt:s
                      complete_block:cb
                      error_block:eb
                      (cancel_stmt)?:cs
                      (verify_stmt)?:vs                                 -> __.ActivityDef(j, s, cb, eb, cs, vs).type("c")
*/
"c_as_activity":function(){var j,s,cb,eb,cs,vs;return this._or((function(){return (function(){undefined;return (function(){j=this._apply("jamd_async_decl");s=this._apply("compound_stmt");cb=this._apply("complete_block");eb=this._apply("error_block");cs=this._opt((function(){return (function(){return this._apply("cancel_stmt")}).call(this)}));vs=this._opt((function(){return (function(){return this._apply("verify_stmt")}).call(this)}));return __.ActivityDef(j,s,cb,eb,cs,vs).type("c")}).call(this)}).call(this)}))},

/*

    js_as_activity  = jamd_async_decl:j ES5Parser.block:b
                      complete_stmt:cs
                      error_stmt:es                                     -> __.ActivityDef(j, b, cs, es).type("js")
*/
"js_as_activity":function(){var j,b,cs,es;return this._or((function(){return (function(){undefined;return (function(){j=this._apply("jamd_async_decl");b=this._applyWithArgs("foreign",ES5Parser,'block');cs=this._apply("complete_stmt");es=this._apply("error_stmt");return __.ActivityDef(j,b,cs,es).type("js")}).call(this)}).call(this)}))},

/*

    c_s_activity    = jamd_sync_decl:d compound_stmt:c                  -> __.ActivityDef(d, c).type("c")
*/
"c_s_activity":function(){var d,c;return this._or((function(){return (function(){undefined;return (function(){d=this._apply("jamd_sync_decl");c=this._apply("compound_stmt");return __.ActivityDef(d,c).type("c")}).call(this)}).call(this)}))},

/*

    js_s_activity   = jamd_sync_decl:d ES5Parser.block:b                -> __.ActivityDef(d, b).type("js")
*/
"js_s_activity":function(){var d,b;return this._or((function(){return (function(){undefined;return (function(){d=this._apply("jamd_sync_decl");b=this._applyWithArgs("foreign",ES5Parser,'block');return __.ActivityDef(d,b).type("js")}).call(this)}).call(this)}))},

/*

    async_activity  = c_as_activity
                    | js_as_activity
*/
"async_activity":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("c_as_activity")}).call(this)}),(function(){return (function(){return this._apply("js_as_activity")}).call(this)}))}).call(this)}))},

/*

    sync_activity   = c_s_activity
                    | js_s_activity
*/
"sync_activity":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("c_s_activity")}).call(this)}),(function(){return (function(){return this._apply("js_s_activity")}).call(this)}))}).call(this)}))},

/*

    activity_def    = sync_activity
                    | async_activity
*/
"activity_def":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("sync_activity")}).call(this)}),(function(){return (function(){return this._apply("async_activity")}).call(this)}))}).call(this)}))},

/*

    function_def    = activity_def
                    | ^function_def
*/
"function_def":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._apply("activity_def")}).call(this)}),(function(){return (function(){return CParser._superApplyWithArgs(this,'function_def')}).call(this)}))}).call(this)}))}});(JAMCParser["parse"]=(function (input){this["spec"].addKeywords(["jamdef","sync","in","oncomplete","onerror","oncancel","onverify","live","jcallback"]);return JAMCParser.matchAll(input,"topLevel")}));(module["exports"]=JAMCParser)}