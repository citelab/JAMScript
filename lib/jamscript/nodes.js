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
 * jamdef Synchronous Declaration
 * -------------------
 *
 * Representation:
 *      [#SDeclaration, declspec, decl, namespc?]
 *
 * Notes:
 *      declspec and namespc are optional.
 */
register("SyncDeclaration");


/**
 * jamdef Asynchronous Declaration
 * -------------------
 *
 * Representation:
 *      [#JDeclaration, decl, namespc?]
 *
 * Notes:
 *      namespc is optional.
 */
register("ASyncDeclaration");


/**
 * Activity Definition
 * -------------------
 *
 * Representation:
 *      [#ActivityDef, {type: c/js}, decl]
 *
 */
register("ASyncActivityDef", {type: undefined});

/**
 * Sync Activity Definition
 * -------------------
 *
 * Representation:
 *      [#SyncActivityDef, {type: c/js}, stmts]
 *
 */
register("SyncActivityDef", {type: undefined});
