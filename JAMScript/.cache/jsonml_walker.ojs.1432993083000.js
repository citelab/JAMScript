{var JsonMLWalker=OMeta.inherit({_grammarName: "JsonMLWalker",

/*

  walk          = undefined:t                                                            -> this.handle_undefined()
                | &anything:n [undefined:u]                                              -> this.handle_undefined(n)
                | &anything:n [:t :prop walk(t, n):ans]                                  -> ans
                | ?(!this.force_rules) &anything:n [:t :prop walk*:cs]                   -> this.replace_children(n, cs),

  walk string:t = ?(typeof this[t] === 'function') apply(t)
*/
"walk":function(){var t,n,u,prop,ans,cs;return this._or((function(){return (function(){undefined;return this._or((function(){return (function(){t=this._apply("undefined");return this.handle_undefined()}).call(this)}),(function(){return (function(){n=this._lookahead((function(){return this._apply("anything")}));this._form((function(){return (function(){return u=this._apply("undefined")}).call(this)}));return this.handle_undefined(n)}).call(this)}),(function(){return (function(){n=this._lookahead((function(){return this._apply("anything")}));this._form((function(){return (function(){t=this._apply("anything");prop=this._apply("anything");return ans=this._applyWithArgs("walk",t,n)}).call(this)}));return ans}).call(this)}),(function(){return (function(){this._pred((! this["force_rules"]));n=this._lookahead((function(){return this._apply("anything")}));this._form((function(){return (function(){t=this._apply("anything");prop=this._apply("anything");return cs=this._many((function(){return this._apply("walk")}))}).call(this)}));return this.replace_children(n,cs)}).call(this)}))}).call(this)}),(function(){return (function(){(function(){return t=this._apply("string")}).call(this);return (function(){this._pred(((typeof this[t]) === "function"));return this._applyWithArgs("apply",t)}).call(this)}).call(this)}))},

/*

  // walk a child and at the same time assure that it has correct type
  walkType   :t = &hasType(t) walk
*/
"walkType":function(){var t;return this._or((function(){return (function(){(function(){return t=this._apply("anything")}).call(this);return (function(){this._lookahead((function(){return this._applyWithArgs("hasType",t)}));return this._apply("walk")}).call(this)}).call(this)}))},

/*

  hasType    :t = :n ?n.hasType(t)                                                       -> n

*/
"hasType":function(){var t,n;return this._or((function(){return (function(){(function(){return t=this._apply("anything")}).call(this);return (function(){n=this._apply("anything");this._pred(n.hasType(t));return n}).call(this)}).call(this)}))}});(JsonMLWalker["replace_children"]=(function (obj,children){console.log("Call to replace_children with",obj,children);obj.splice((2),obj["length"]);obj["push"].apply(obj,children);return obj}));(JsonMLWalker["handle_undefined"]=(function (){console.log("Handle undefined");if((arguments["length"] === (1))){return [undefined]}else{return undefined}}));(JsonMLWalker["force_rules"]=false);(module["exports"]=JsonMLWalker)}