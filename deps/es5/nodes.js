/**
 * The function `register` can be used like:
 *
 *     register("Function", {}, function(){...})
 *     .translate(function() {...})
 *
 * and desugars to:
 *     nodes["Function"] = NodeType("Function", {}, function() {...});
 */
var nodes = module.exports = {};
var Factory  = require('../jsonml').factory;
var register = function(type) {

  var nodetype = Factory.apply(null, arguments);
  
  // register new nodetype
  nodes[type] = nodetype;
};


/**
 * NODE - DEFINITIONS
 */

/**
 * Program
 * -------
 * 
 * Representation:
 *     [#Program, {},  ...Statement]
 * 
 * Call like:
 *     ES5Builder.Program(...srcEls);
 */
register("Program", {}, function(srcEls) {
  this.appendAll(srcEls);
});

/**
 * Function
 * --------
 * 
 * Representation:
 *     [#Function, { id: Identifier, generator: boolean, expression: boolean }, FunctionArgs, BlockStmt]
 * 
 * Call like:
 *     ES5Builder.Function(args, body).id("name");
 */
register("Function", {  
  id: undefined,
  generator: false,
  expr: false
});

/**
 * FunctionArgs
 * ------------
 * 
 * Representation:
 *     [#FunctionArgs, {}, ...Expression]
 * 
 * Call like:
 *     ES5Builder.FunctionArgs(...args);
 */
register("FunctionArgs", {}, function(args) {
  this.appendAll(args);
});

/**
 * Literals
 * -------------
 * Identifier and Literals, maybe we need just one literal-node, with a type-property
 */

/**
 * Identifier
 * ---------
 * 
 * Representation:
 *     [#Id, { value: string }]
 * 
 * Call like:
 *     ES5Builder.Id("Foo");
 */
register("Id", { value: undefined}, function(value) {
  this.value(value);
});

/**
 * Number
 * ------
 * 
 * Representation:
 *     [#Number, { kind: decimal | hex, value: number }]
 * 
 * Call like:
 *     ES5Builder.Number(12435.50);
 */
register("Number", { kind: 'decimal', original: undefined, value: undefined }, function(value) {
  this.value(parseFloat(value));
  this.original(value);          // save original string-representation
});

/**
 * String
 * ------
 * 
 * Representation:
 *     [#String, { value: string }]
 * 
 * Call like:
 *     ES5Builder.String("Foo Bar");
 */
register("String", { value: undefined }, function(value) {
  this.value(value);
});

/**
 * HelperNodes
 * -------------
 * Punctuator and Keyword won't occure in the AST, they are just used in the grammar
 */

/**
 * Punctuator
 * ----------
 * 
 * Representation:
 *     [#Punctuator, { value: string }]
 * 
 * Call like:
 *     ES5Builder.Punctuator("(");
 */
register("Punctuator", { value: undefined }, function(value) {
  this.value(value);
});

/**
 * Keyword
 * -------
 * 
 * Representation:
 *     [#Keyword, { value: string }]
 * 
 * Call like:
 *     ES5Builder.Keyword("while");
 */
register("Keyword", { value: undefined }, function(value) {
  this.value(value);
});

/** 
 * Statements 
 * ==========
 */

/**
 * EmptyStatement
 * --------------
 * 
 * Representation:
 *     [#EmptyStmt, {}]
 * 
 * Call like:
 *     ES5Builder.EmptyStmt();
 */
register("EmptyStmt");

/**
 * BlockStatement
 * --------------
 * 
 * Representation:
 *     [#BlockStmt, {}, ...Statement]
 * 
 * Call like:
 *     ES5Builder.BlockStmt(...stmts);
 */
register("BlockStmt", {}, function(stmts) {
  this.appendAll(stmts);
});


/**
 * IfStatement
 * -----------
 * 
 * Representation:
 *     [#IfStmt, {}, Expression, Statement, Statement?]
 * 
 * Call like:
 *     ES5Builder.IfStmt(condExpr, trueExpr, falseExpr?);
 */
register("IfStmt");

/**
 * JCallbackStatement
 * --------------
 *
 * Representation:
 *     [#JCallbackStmt, {}, id, ...AssignExpr]
 * 
 * Call like:
 *     ES5Builder.JCallbackStmt(id, ...args);
 */
register("JCallbackStmt", {name: ""}, function(name, args) {
  this.name(name)
      .appendAll(args);
});

/**
 * LabeledStatement
 * ----------------
 * 
 * Representation:
 *     [#LabeledStmt, { label: string }, Statement]
 * 
 * Call like:
 *     ES5Builder.LabeledStmt(label, stmt);
 */
register("LabeledStmt", { label: ""}, function(label, stmt) {
  this.label(label)
      .append(stmt);
});

/**
 * BreakStatement
 * --------------
 * 
 * Representation:
 *     [#BreakStmt, { label: string }]
 * 
 * Call like:
 *     ES5Builder.BreakStmt().label(string);
 */
register("BreakStmt", {
    label: undefined
});

/**
 * ContinueStatement
 * -----------------
 * 
 * Representation:
 *     [#ContinueStmt, { label: string }]
 * 
 * Call like:
 *     ES5Builder.ContinueStmt().label(string);
 */
register("ContinueStmt", {
    label: undefined
});

/**
 * WithStatement
 * -------------
 * 
 * Representation:
 *     [#WithStmt, {}, Expression, Statement]
 * 
 * Call like:
 *     ES5Builder.WithStmt(expr, stmt);
 */
register("WithStmt");

/**
 * SwitchStatement
 * ---------------
 * 
 * Representation:
 *     [#SwitchStmt, {}, Expression, ...Cases]
 * 
 * Call like:
 *     ES5Builder.SwitchStmt(switchExpr, ...cases);
 */
register("SwitchStmt", {}, function(switchExpr, cases) {
  this.append(switchExpr)
      .appendAll(cases);
});

/**
 * SwitchCase
 * ----------
 * Because `default` is a keyword, we use `default_case` 
 *
 * Representation:
 *     [#SwitchCase, { def: false }, Expression, ...Statement]
 * 
 * Call like:
 *     ES5Builder.SwitchCase(testExpr, ...stmts);
 *     ES5Builder.SwitchCase(...stmts).default(true);
 */
register("SwitchCase", { default_case: false }, function() {
  // if there is only one argument, it's a default-case
  if(arguments.length == 1) {
    this.default_case(true)
        .appendAll(arguments[0]);
  } else {
    this.append(arguments[0])
        .appendAll(arguments[1]);
  }
});


/**
 * ReturnStatement
 * ---------------
 * 
 * Representation:
 *     [#ReturnStmt, {}, Expression?]
 * 
 * Call like:
 *     ES5Builder.ReturnStmt(expr?);
 */
register("ReturnStmt");

/**
 * ThrowStatement
 * ---------------
 * 
 * Representation:
 *     [#ThrowStmt, {}, Expression?]
 * 
 * Call like:
 *     ES5Builder.ThrowStmt(expr?);
 */
register("ThrowStmt");

/**
 * TryStatement
 * ---------------
 * 
 * Representation:
 *     [#TryStmt, {}, BlockStatement, Expression, BlockStatement, BlockStatement?]
 *     [#TryStmt, {}, BlockStatement, BlockStatement]
 * 
 * Call like:
 *     ES5Builder.TryStmt(tryBlock, catchExpr, catchStmt, finallyStmt?);
 *     ES5Builder.TryStmt(tryBlock, finallyStmt);
 */
register("TryStmt");
/**
 * WhileStatement
 * ---------------
 * 
 * Representation:
 *     [#WhileStmt, {}, Expression, BlockStatement]
 * 
 * Call like:
 *     ES5Builder.WhileStmt(condExpr, stmt);
 */
register("WhileStmt");
  
/**
 * DoWhileStatement
 * ---------------
 * 
 * Representation:
 *     [#DoWhileStmt, {}, BlockStatement, Expression]
 * 
 * Call like:
 *     ES5Builder.DoWhileStmt(stmt, condExpr);
 */
register("DoWhileStmt");

/**
 * ForStatement
 * ------------
 * 
 * Representation:
 *     [#ForStmt, {}, Expression | Binding, Expression, Expression, Statement]
 * 
 * Call like:
 *     ES5Builder.ForStmt(initExpr, condExpr, updExpr, stmt);
 */
register("ForStmt");
  
/**
 * ForInStatement
 * --------------
 * 
 * Representation:
 *     [#ForInStmt, {}, Binding, Expression, Statement]
 * 
 * Call like:
 *     ES5Builder.ForInStmt(bindings, expr, stmt);
 */
register("ForInStmt");

/**
 * DebuggerStatement
 * -----------------
 * SampleCode:
 *     debugger;
 *
 * Representation:
 *     [#DebuggerStmt, {}]
 * 
 * Call like:
 *     ES5Builder.DebuggerStmt();
 */
register("DebuggerStmt");

/** 
 * Declaration <: Statement 
 * ========================
 */
 
/**
 * VariableDeclaration
 * -------------------
 * SampleCode:
 *     var foo = 14, bar;
 *
 * Representation:
 *     [#VarDeclStmt, {}, ...VarBinding]
 * 
 * Call like:
 *     ES5Builder.VarDeclStmt(...bindings).kind("var");
 */
register("VarDeclStmt", { kind: "var" }, function(bindings) {
  this.appendAll(bindings);
});

/**
 * VariableDeclarator
 * ------------------
 * Keep in mind, that next Version of JavaScript will allow declarationpatterns. Necessary
 * for VariableDeclaration (see above).
 * 
 * SampleCode:
 *     foo = 14
 *     bar
 * 
 * Representation:
 *     [#VarBinding, {}, Identifier, Expr]
 * 
 * Call like:
 *     ES5Builder.VarBinding(name, init);
 */
register("VarBinding", { name: undefined }, function(name, init) {
  this.name(name)
      .append(init);
});

/** 
 * Expressions
 * ===========
 */

/**
 * ThisExpression
 * --------------
 * SampleCode:
 *     this.foo();
 *
 * Representation:
 *     [#ThisExpr, {}]
 *
 * Call like:
 *     ES5Builder.ThisExpr();
 */
register("ThisExpr");

/**
 * AssignmentExpression
 * --------------------
 * SampleCode:
 *     foo = 5
 *     foo += 5
 *
 * Representation:
 *     [#AssignExpr, { operator: ( += | -= | *= | /= | … ) }, Identifier, Expr]
 * 
 * Call like:
 *     ES5Builder.AssignExpr(lhsExpr, rhsExpr).operator('+=');
 */
register("AssignExpr", { operator: "=" });

/**
 * ConditionalExpression
 * ---------------------
 * SampleCode:
 *     (is.this.true)?"yes":"no" 
 *
 * Representation:
 *     [#CondExpr, {}, Expression, Expression, Expression]
 * 
 * Call like:
 *     ES5Builder.CondExpr(condExpr, trueExpr, falseExpr);
 */
register("CondExpr");

/**
 * UnaryExpression
 * ---------------
 * SampleCode:
 *     !true
 *     delete foo.bar
 *
 * Representation:
 *     [#UnaryExpr, { operator: ( ! | + | - | ~ | void | delete | typeof) }, Expression]
 * 
 * Call like:
 *     ES5Builder.UnaryExpr(expr).operator('!');
 */
register("UnaryExpr", {
  operator: undefined
});

/**
 * UpdateExpression
 * ----------------
 * SampleCode:
 *     ++foo
 *     --bar
 *     foo++
 *     bar--
 *
 * Representation:
 *     [#UpdateExpr, { operator: ( ++ | -- ), prefix: true }, Expression]
 * 
 * Call like:
 *     ES5Builder.UpdateExpr(expr).operator('!').prefix(false);
 */
register("UpdateExpr", {
  operator: undefined,
  prefix: true
});

/**
 * BinaryExpression
 * ----------------
 * SampleCode:
 *     ++foo
 *     --bar
 *     foo++
 *     bar--
 *
 * Representation:
 *     [#BinaryExpr, { operator: ( || | && | ^ | … )}, Expression, Expression]
 * 
 * Call like:
 *     ES5Builder.BinaryExpr(lhsExpr, rhsExpr).operator('||');
 */
register("BinaryExpr", {
  operator: undefined
});

/**
 * SequenceExpression
 * ------------------
 * SampleCode:
 *     foo += 4, bar(foo), !baz;
 *
 * Representation:
 *     [#SequenceExpr, {}, ...Expression]
 * 
 * Call like:
 *     ES5Builder.SequenceExpr(...expr);
 */
register("SequenceExpr", {}, function(exprs) {
  this.appendAll(exprs)
});

/**
 * NewExpression
 * -------------
 * SampleCode:
 *     new foo().bar;
 *
 * Representation:
 *     [#NewExpr, {}, MemberExpression]
 * 
 * Call like:
 *     ES5Builder.NewExpr(class);
 */
register("NewExpr");

/**
 * CallExpression
 * --------------
 * SampleCode:
 *     foo().bar(param1, param2)
 *
 * Representation:
 *     [#CallExpr, {}, (CallExpr | MemberExpression), ...AssignExpr]
 * 
 * Call like:
 *     ES5Builder.CallExpr(expr, ...args);
 */
register("CallExpr", {}, function(expr, args) {
  this.append(expr)
      .appendAll(args);
});

/**
 * MemberExpression
 * ----------------
 * SampleCode:
 *     foo.by_name[calculated]
 *
 * Representation:
 *     [#MemberExpr, { access: ('name' | 'calculated') }, Expression, Expression?]
 * 
 * Call like:
 *     ES5Builder.MemberExpr(expr, accessExpr).access('calculated');
 */
register("MemberExpr", { access: 'calculated', name: undefined }, function(expr, accessExpr){
  
  // only one expr is given
  if(arguments.length == 1) {
    this.append(expr)
        .access('name');
  } else {
    this.appendAll(arguments);
  }
});

/**
 * GroupExpression
 * ---------------
 * Please note: the GroupExpression has no equivalent in the SpiderMonkey Parser API
 *
 * SampleCode:
 *     (foo.bar + baz())
 *
 * Representation:
 *     [#GroupExpr, {}, Expr]
 * 
 * Call like:
 *     ES5Builder.GroupExpr(expr);
 */
register("GroupExpr");

/**
 * ArrayExpression
 * ---------------
 * SampleCode:
 *     [1, 3, 5, undefined, "hello", something()]
 *
 * Representation:
 *     [#ArrayExpr, {}, ...Expr]
 * 
 * Call like:
 *     ES5Builder.ArrayExpr(...expr);
 */
register("ArrayExpr", {}, function(exprs) {

  // only append exprs if not undefined
  if(exprs === undefined || exprs[0] === undefined && exprs.length === 1)
    return this;

  // exprs should be an array containing nodes
  else
    this.appendAll(exprs);
});

/**
 * ObjectExpression
 * ----------------
 * SampleCode:
 *     {
 *       foo: 4,     
 *       get name() {…},
 *       set name(new_name) {…}
 *     }
 *
 * Representation:
 *     [#ObjectExpr, {}, ...PropertyBinding)]
 * 
 * Call like:
 *     ES5Builder.ObjectExpr(...bindings);
 */
register("ObjectExpr", {}, function(bindings) {
  this.appendAll(bindings)
});

/**
 * PropertyBinding
 * ---------------
 * SampleCode:
 *    foo: 4
 *    get name() {…}
 *    set name(new_name) {…}
 *
 * Representation:
 *     [#PropertyBinding, { kind: 'init', name: "somename" }, ), id, Expr]
 *     [#PropertyBinding, { kind: ('get' | 'set'), name: "somename" }, ), id, FunctionArgs, BlockStatement]
 * 
 * Call like:
 *     ES5Builder.PropertyBinding("name", initExpr);
 *     ES5Builder.PropertyBinding("name", args, block).kind('set')
 */
register("PropertyBinding", { kind: 'init',  name: undefined}, function(name) {
  
  if(typeof name === 'string')
    name = nodes.Id(name)

  // append rest-args
  this.name(name.value())
      .appendAll(arguments);
});

/**
 * RegularExpression
 * ----------------
 * SampleCode:
 *     /[a-z]{3}/gi
 *
 * Representation:
 *     [#RegExpr, {}, PropertyBinding)]
 * 
 * Call like:
 *     ES5Builder.RegExpr('[a-z]{3}').flags('gi');
 */
register("RegExpr", { body: undefined, flags: '' }, function(body) {
  this.body(body);
});
