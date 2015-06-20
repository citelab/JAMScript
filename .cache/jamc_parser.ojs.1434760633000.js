{{var CParser=require("../../c/grammars/c_parser.ojs");var __=require("../nodes.js")}var JAMCParser=CParser.inherit({_grammarName: "JAMCParser",

/*


    function_def    = "jamdef" | ^function_def
*/
"function_def":function(){return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){return this._applyWithArgs("token","jamdef")}).call(this)}),(function(){return (function(){return CParser._superApplyWithArgs(this,'function_def')}).call(this)}))}).call(this)}))}});(JAMCParser["spec"]=({"keywords": ["jamdef","sync","in","oncomplete","onerror","oncancel","onverify","live","jcallback"],"isKeyword": (function (k){return (this["keywords"].indexOf(k) != (- (1)))})}));(JAMCParser["parse"]=(function (input){return JAMCParser.matchAll(input,"topLevel")}));(module["exports"]=JAMCParser)}