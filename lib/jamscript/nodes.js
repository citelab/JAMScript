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
 * NamespaceSpec
 * -------------
 *
 * Representation:
 *     [#NamespaceSpec, {name: string}]
 *
 */
register("NamespaceSpec", {name: undefined});


/**
 * Declaration Specifications
 */

/**
 * jamdef Declarartion
 * -------------------
 *
 * Representation:
 *      [#JDeclaration, {sync: false}, declspec?, decl, namespc?]
 *
 * Notes:
 *      declspec and namespc are optional.
 */
register("JDeclaration", {sync: false});


/**
 * onclause Declaration
 * --------------------
 *
 * Representation:
 *      [#ODeclaration, {type: undefined}, declarator]
 *
 */
register("ODeclaration", {type: undefined});


/**
 * JavaScript Complete Block
 * -------------------------
 *
 * Representation:
 *      [#CompleteBlock, {}, declaration, block]
 *
 */

register("CompleteBlock");


/**
 * JavaScript Error Block
 * ----------------------
 *
 * Representation:
 *      [#ErrorBlock, {}, declaration, block]
 *
 */

register("ErrorBlock");


/**
 * JavaScript Load Block
 * ----------------------
 *
 * Representation:
 *      [#LoadBlock, {}, declaration, block]
 *
 */

register("LoadBlock");


/**
 * C Complete Compound Statement
 * -----------------------------
 *
 * Representation:
 *      [#CompleteStmt, {}, declaration, stmt]
 *
 */
register("CompleteStmt");



/**
 * C Error Compound Statement
 * --------------------------
 *
 * Representation:
 *      [#ErrorStmt, {}, declaration, stmt]
 *
 */
register("ErrorStmt");


/**
 * C Cancel Compound Statement
 * ---------------------------
 *
 * Representation:
 *      [#CancelStmt, {}, declaration, stmt]
 *
 */
register("CancelStmt");

/**
 * C Watch Compound Statement
 * --------------------------
 *
 * Representation:
 *      [#WatchStmt, {}, declaration, stmt]
 *
 */
register("WatchStmt");

/**
 * C Load Compound Statement
 * --------------------------
 *
 * Representation:
 *      [#Loadstmt, {}, declaration, stmt]
 *
 */
register("LoadStmt");


/**
 * Activity Definition
 * -------------------
 *
 * Representation:
 *      [#ActivityDef, {type: c/js}, decl, stmt, compblock/stmt?, errorblock/stmt?, cancel-stmt?]
 *
 */
register("ActivityDef", {type: undefined});

/**
 * Sync Activity Definition
 * -------------------
 *
 * Representation:
 *      [#SyncActivityDef, {type: c/js}, stmts]
 *
 */
register("SyncActivityDef", {type: undefined});