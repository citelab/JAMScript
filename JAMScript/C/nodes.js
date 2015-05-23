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
 *     CBuilder.Program(...srcEls);
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
 *     CBuilder.Function(args, body).id("name");
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
 *     CBuilder.FunctionArgs(...args);
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
 *     CBuilder.Id("Foo");
 */
register("Id", { value: undefined}, function(value) {
	console.log("Id = ", value);
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
 *     CBuilder.Number(12435.50);
 */
register("Number", { kind: 'decimal', original: undefined, value: undefined }, function(value) {
	console.log("Value = ", value);
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
 *     CBuilder.String("Foo Bar");
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
 *     CBuilder.Punctuator("(");
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
 *     CBuilder.Keyword("while");
 */
register("Keyword", { value: undefined }, function(value) {
	console.log("Registering keyword.. ", value);
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
 *     CBuilder.EmptyStmt();
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
 *     CBuilder.BlockStmt(...stmts);
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
 *     CBuilder.IfStmt(condExpr, trueExpr, falseExpr?);
 */
register("IfStmt");

/**
 * LabeledStatement
 * ----------------
 *
 * Representation:
 *     [#LabeledStmt, { label: string }, Statement]
 *
 * Call like:
 *     CBuilder.LabeledStmt(label, stmt);
 */
register("LabeledStmt", { label: ""}, function(label, stmt) {
  this.label(label)
      .append(stmt);
});


/**
 * GotoStatement
 * -------------
 *
 * Representation:
 *      [#GotoStmt, {label: string}]
 *
 * Call like:
 *      CBuilder.GotoStmt(label);
 */
 register("GotoStmt", {label: ""}, function(label) {
     this.label(label);
 });





/**
 * BreakStatement
 * --------------
 *
 * Representation:
 *     [#BreakStmt, { label: string }]
 *
 * Call like:
 *     CBuilder.BreakStmt().label(string);
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
 *     CBuilder.ContinueStmt().label(string);
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
 *     CBuilder.WithStmt(expr, stmt);
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
 *     CBuilder.SwitchStmt(switchExpr, ...cases);
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
 *     CBuilder.SwitchCase(testExpr, ...stmts);
 *     CBuilder.SwitchCase(...stmts).default(true);
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
 *     CBuilder.ReturnStmt(expr?);
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
 *     CBuilder.ThrowStmt(expr?);
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
 *     CBuilder.TryStmt(tryBlock, catchExpr, catchStmt, finallyStmt?);
 *     CBuilder.TryStmt(tryBlock, finallyStmt);
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
 *     CBuilder.WhileStmt(condExpr, stmt);
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
 *     CBuilder.DoWhileStmt(stmt, condExpr);
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
 *     CBuilder.ForStmt(initExpr, condExpr, updExpr, stmt);
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
 *     CBuilder.ForInStmt(bindings, expr, stmt);
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
 *     CBuilder.DebuggerStmt();
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
 *     CBuilder.VarDeclStmt(...bindings).kind("var");
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
 *     CBuilder.VarBinding(name, init);
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
 *     CBuilder.ThisExpr();
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
 *     CBuilder.AssignExpr(lhsExpr, rhsExpr).operator('+=');
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
 *     CBuilder.CondExpr(condExpr, trueExpr, falseExpr);
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
 *     CBuilder.UnaryExpr(expr).operator('!');
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
 *     CBuilder.UpdateExpr(expr).operator('!').prefix(false);
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
 *     CBuilder.BinaryExpr(lhsExpr, rhsExpr).operator('||');
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
 *     CBuilder.SequenceExpr(...expr);
 */
register("SequenceExpr", {}, function(exprs) {
  this.appendAll(exprs)
});

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
 *     CBuilder.CallExpr(expr, ...args);
 */
register("CallExpr", {}, function(expr, args) {
  this.append(expr)
      .appendAll(args);
});

/**
 * MemberExpression or PointerExpression
 * -------------------------------------
 * SampleCode:
 *     foo.by_name[calculated]
 *     foo->by_pointer
 *
 * Representation:
 *     [#MemberExpr, { access: ('name' | 'calculated' ) }, Expression, Expression?]
 *
 * Call like:
 *     CBuilder.MemberExpr(expr, accessExpr).access('calculated');
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

register("PointerExpr", {access: 'pointer', name: undefined}, function(expr) {
    this.appendAll(arguments);
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
 *     CBuilder.GroupExpr(expr);
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
 *     CBuilder.ArrayExpr(...expr);
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
 * FuncDefinition
 * --------------
 *
 * Representation
 *      [#FuncDefinition, {storage_class: .. type_spec:.. type_qual:..}, decl, stmt]
 *
 */
 register("FuncDefinition", function(dspec, decl, stmt) {
     this[1] = dspec;
     this.append(decl);
     this.append(stmt);
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
 *     CBuilder.ObjectExpr(...bindings);
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
 *     CBuilder.PropertyBinding("name", initExpr);
 *     CBuilder.PropertyBinding("name", args, block).kind('set')
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
 *     CBuilder.RegExpr('[a-z]{3}').flags('gi');
 */
register("RegExpr", { body: undefined, flags: '' }, function(body) {
  this.body(body);
});
