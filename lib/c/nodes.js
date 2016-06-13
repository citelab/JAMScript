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
var Factory  = require('../../deps/jsonml').factory;
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
 * Typename
 * --------
 *
 * Representation:
 *     [#Typename, { value: string }]
 */
register("Typename", { value: undefined }, function(value) {
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
 * JCallbackStatement
 * --------------
 *
 * Representation:
 *     [#JCallbackStmt, {}, id, ...AssignExpr]
 * 
 * Call like:
 *     CBuilder.JCallbackStmt(id, ...args);
 */
register("JCallbackStmt", {name: ""}, function(name, args) {
  this.name(name)
      .appendAll(args);
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
 * Declarations or Type Specifiers
 * ===============================
 */

/**
 * Storage Class Specifier
 *
 * Representation:
 *      [#StorageClassSpec, {class: undefined}]
 *
 */
 register("StorageClassSpec", {class: undefined});


/**
 * Type Specifier
 * --------------
 *
 * Representation:
 *      [#TypeSpec, {type: undefined}]
 *
 */
 register("TypeSpec", {type: undefined});

/**
 * Function Specifier
 * --------------
 *
 * Representation:
 *      [#FuncSpec, {type: undefined}]
 *
 */
 register("FuncSpec", {type: undefined});

/**
 * Type Qualifier
 * --------------
 *
 * Representation:
 *      [#TypeQual, {type: undefined}]
 *
 */
 register("TypeQual", {type: undefined});


/**
 * Declaration Specifier
 * ---------------------
 *
 * Representation:
 *      [#DeclSpec, {}, specifier_list]
 *
 */
 register("DeclSpec", {}, function (speclst) {
     this.appendAll(speclst);
 });



/**
 * Declaration
 * -------------------
 *
 * Representation:
 *     [#Declaration {}, declspec, init_decl_list]
 */
 register("Declaration", {}, function(dspec, ilist) {
     this.append(dspec);
     this.appendAll(ilist);
 });


/**
 * Var Args
 * --------------
 *
 * Representation:
 *      [#VarArgs]
 *
 */
 register("VarArgs");



/**
 * Initialized Declarator
 * ----------------------
 *
 * Representation:
 *      [#InitDecl, {}, declarator, initializer]
 *
 */
 register("InitDecl");


/**
 * Type Name Declarator
 * ----------------------
 *
 * Representation:
 *      [#TypeName, {}, spec_qual_list, abs_declarator]
 *
 */
 register("TypeName");

/**
 * Declarator
 * ----------
 *
 * Representation
 *      [#Declarator {name: string, pointer:pointer_list, type: (member| call| func | undefined), expr or list]
 */
register("Declarator", {
    name: undefined,
    pointer: undefined,
    type: undefined
});

/**
 * Abstract Declarator
 * ----------
 *
 * Representation
 *      [#AbsDeclarator {pointer_level:0, pointer_type: .. type: (member| call| func | undefined), expr or list]
 */
register("AbsDeclarator", {
      pointer: undefined,
      type: undefined
});


/**
 * ParamDeclaration
 * ----------------
 *
 * Representation
 *      [#ParamDeclaration, {}, decl_spec declarator]
 */
register("ParamDeclaration");


/**
 * GroupInitializer
 * ----------------
 *
 * Representation:
 *      [#GroupInitializer, {}, initializer list..]
 */
 register("GroupInitializer");


/**
 * Type Specifiers Supported by C
 * ==============================
 */

/**
 * Enum Declaration
 * ----------------
 *
 * Representation:
 *      [#EnumDeclaration, {name: undefined}, Enumerationlist]
 */
 register("EnumDeclaration", {name: undefined}, function(elist) {
    this.appendAll(elist);
 });


/**
 * Enumerator
 * ----------
 *
 * Representation:
 *      [#Enumerator, {name: undefined}, constant-expr]
 *
 */
 register("Enumerator", {name: undefined});

/**
 * Struct Specification
 * --------------------
 *
 * Representation:
 *      [#StrucSpec, {name: undefined}, struct_decl_lst]
 */
 register("StrucSpec", {name: undefined}, function(slst) {
     this.appendAll(slst);
 });


/**
 * Union Specification
 * -------------------
 *
 *      [#UnionSpec, {name: undefined}, struct_decl_lst]
 *
 */
 register("UnionSpec", {name: undefined}, function(slst) {
     this.appendAll(slst);
 });


/**
 * Struct Declarators
 * ------------------
 *
 *      [#StrucDecl, {}, specqlst, sdecllst]
 *
 */
 register("StrucDecl", {}, function(s, l) {
    this.append(s);
    this.appendAll(l);
});


/**
 * Specifier Qualifier list
 * ------------------------
 *
 *      [#SpecQList, {}, sqlist]
 *
 */
 register("SpecQList", {}, function(l) {
     this.appendAll(l);
 });


/**
 * Structure Declarator
 * --------------------
 *
 * Representation:
 *     [#SDeclarator, {}, declarator, expr]
 *
 */
 register("SDeclarator");


/**
 * Pointer
 * ----------
 *
 * Representation:
 *      [#Pointer, {}, TypeQual]
 *
 */
 register("Pointer");


/**
 * Pointer List
 * ----------
 *
 * Representation:
 *      [#PointerList, {}, Pointer]
 *
 */
 register("PointerList");

/**
 * Attribute Tag
 * --------------------
 *
 * Representation:
 *     [#Attribute]
 *
 */
 register("Attribute");


/**
 * asm Tag
 * --------------------
 *
 * Representation:
 *     [#Asm]
 *
 */
 register("Asm");


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
 * Cast Expression
 * --------------------
 *
 * Representation:
 *     [#CastExpr]
 *
 */
 register("CastExpr");


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
register("SequenceExpr", {const: false, type: undefined }, function(exprs) {
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
 *      [#FuncDefinition, {}, dspec, decl, stmt]
 *
 */
 register("FuncDefinition");
