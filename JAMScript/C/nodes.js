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
  this.value(value);
});

/**
 * Statements
 * ==========
 */

/**
 * CompoundStatement
 * --------------
 *
 * Representation:
 *     [#CompoundStmt, {}, Decls?, Statements?]
 *
 * Call like:
 *     CBuilder.CompoundStmt(...decls?, stmts?);
 */
register("CompoundStmt", {}, function(decls, stmts) {
    this.appendAll(decls);
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
 * BreakStatement
 * --------------
 *
 * Representation:
 *     [#BreakStmt, {}]
 *
 * Call like:
 *     CBuilder.BreakStmt();
 */
register("BreakStmt");

/**
 * ContinueStatement
 * -----------------
 *
 * Representation:
 *     [#ContinueStmt, {}]
 *
 * Call like:
 *     CBuilder.ContinueStmt();
 */
register("ContinueStmt");

/**
 * GotoStatement
 * -------------
 *
 * Representation:
 *     [#GotoStmt, {label: string}]
 *
 * Call like:
 *     CBuilder.GotoStmt().label(string);
 */
register("GotoStmt", {
    label: undefined
});

/**
 * SwitchStatement
 * ---------------
 *
 * Representation:
 *     [#SwitchStmt, {}, Expression, Statement]
 *
 * Call like:
 *     CBuilder.SwitchStmt(switchExpr, Statement);
 */
register("SwitchStmt", {}, function(switchExpr, stmt) {
  this.append(switchExpr)
      .appendAll(stmt);
});

/**
 * CaseStatement
 * ----------
 *
 * Representation:
 *     [#CaseStmt, {}, Expression, Statement]
 *
 * Call like:
 *     CBuilder.CaseStmt(testExpr, stmt);
 */
register("CaseStmt", {}, function(testExpr,stmt) {
    this.append(testExpr)
        .appendAll(stmt);
});


/**
 * DefaultStatement
 * ----------
 *
 * Representation:
 *     [#DefaultStmt, {}, Statement]
 *
 * Call like:
 *     CBuilder.DefaultStmt(stmt);
 */
register("DefaultStmt", {}, function(stmt) {
    this.appendAll(stmt);
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
 * ExpressionStatement
 * ---------------
 *
 * Representation:
 *     [#ExprStmt, {}, Expression?]
 *
 * Call like:
 *     CBuilder.ExprStmt(expr?);
 */
register("ExprStmt");



/**
 * WhileStatement
 * ---------------
 *
 * Representation:
 *     [#WhileStmt, {}, Expression, CompoundStatement]
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
 *     [#DoWhileStmt, {}, CompoundStatement, Expression]
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
 * Declaration <: Statement
 * ========================
 */

/**
 * MakeDeclaration
 * -------------------
 * SampleCode:
 *     register int a = 10;
 *
 * Representation:
 *     [#VarDeclStmt, {storage_class: .. type_spec: .. type_qual: ..}, ...VarBinding]
 *
 * Call like:
 *     CBuilder.VarDeclStmt(attr, bindings);
 */
register("VarDeclStmt", {}, function(attr, bindings) {
  this[1] = attr;
  this.appendAll(bindings);
});

/**
 * VariableBinding
 * ------------------
 * SampleCode:
 *     int a = 15;
 *     float q;
 *
 * Representation:
 *     [#VarBinding, {}, declarator, initializer]
 * Note:
 *      Declarator could be quite complex - pointer, group, member, etc
 *
 * Call like:
 *     CBuilder.VarBinding(decl, init);
 *     CBuilder.VarBinding(decl);
 */
register("VarBinding");

/**
 * MakeDeclarator
 * --------------
 *
 * Representation
 *      [#Declarator {name: string, pointer_level:0, pointer_type: .. member: false, call: false, func: false}]
 */
register("Declarator", {
    name: undefined,
    pointer_level: 0,
    pointer_type: undefined,
    member: false,
    call: false,
    func: false
});

/**
 * ParamDeclaration
 * ----------------
 *
 * Representation
 *      [#ParamDeclaration, {storage_class: .. type_spec: .. type_qual: ..}, ... Declarator]
 */
register("ParamDeclaration", function(ds, decl) {
    this[1] = ds;
    this.append(decl);
});

/**
 * GroupInitializer
 * ----------------
 *
 * Representation:
 *      [#GroupInitializer, {}, initializer list..]
 */
 register("GroupInitializer");


/**
 * Expressions
 * ===========
 */

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
 *     [#SequenceExpr, {const: 'false'}, ...Expression]
 *
 * Call like:
 *     CBuilder.SequenceExpr(...expr).const(true);
 */
register("SequenceExpr", {const: false}, function(exprs) {
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
