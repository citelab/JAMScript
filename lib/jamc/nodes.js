// extend C nodes
var nodes = module.exports = Object.create(require('../c').nodes);

// prepare node-registry
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


NamespaceSpec(s.value())

TypeSpec().type(s.value())

JDeclaration(s, d, n)

ODeclaration(d).type("complete")

CompleteBlock(d, b)

ErrorBlock(d, b)

CompleteStmt(d, s)

ErrorStmt(d, s)

CancelStmt(d, s)

VerifyStmt(d, s)

ActivityDef(j, s, cb, eb, cs, vs).sync(false).type("c")





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
 * Initialized Declarator
 * ----------------------
 *
 * Representation:
 *      [#InitDecl, {}, declarator, initializer]
 *
 */
 register("InitDecl");


/**
 * Declarator
 * ----------
 *
 * Representation
 *      [#Declarator {name: string, pointer_level:0, pointer_type: .. type: (member| call| func | undefined), expr or list]
 */
register("Declarator", {
    name: undefined,
    pointer_level: 0,
    pointer_type: undefined,
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
 * Abstract Declarator
 * -------------------
 *
 * Representation:
 *      [#ADeclarator {pointer_level:0, pointer_type: .. type: (member| call| func | undefined)}, expr or list]
 *
 */
 register("ADeclarator", {
     pointer_level: 0,
     pointer_type: undefined,
     type: undefined
 });




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
 *      [#FuncDefinition, {}, dspec, decl, stmt]
 *
 */
 register("FuncDefinition");
