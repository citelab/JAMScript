var util = require('util');

module.exports = {
  // makes shure, that the element is an array
  // is needed, as we don't have the ...operator
  assure_array: function(el) {
    if(el instanceof Array) 
      return el;
    else
      return [el];
  },

  join: function() {
    return Array.prototype.join.call(arguments, '');
  },

  force_block: function(input) {
    input = input || '';
    if(input[0] === '{' && input[input.length -1 ] === '}')
      return input;
    else 
      return ['{', input, '}'].join('');
  },

  // Got major trouble with this. Because
  // "\"" is being double escaped...
  escape_string: function(str) {
    
    var str = String(str),
        result = [],
        len = str.length,
        escaped = false;
    
    for(var i=0; i < len; i++) {
      
      var character = str.charAt(i);
      
      if(escaped) {
        escaped = false;
      } else {
        // starting escape sequence
        if(character === "\\")
          escaped = true;
        
        else if(character === '"')
          result.push("\\");
      }
      result.push(character);
    }
    return result.join('');
  },

  /**
   * Recursivly prints the tree with intendation
   * To print a tree, it needs to be in the JsonML-Format
   * i.e. `['nodename', { properties }, ...children]`
   *
   * @return [String] the formatted tree
   */
  print_tree: function(tree, opts) {
  
    opts = opts || {};

    var in_level = [''],
        indent   = opts.indent || "  ",
        result   = [];
    
    function print_node(node) {
      
      result.push(in_level.join(indent));

      if(node === undefined) {        
        result.push('undefined');
        return;
      }

      var node_name = node[0],
          props     = util.inspect(node[1], false, null);

      result.push(node_name, " ", props)

      // there are childnodes
      if(node.length > 2) {
        in_level.push('');
        for(var i=2,len=node.length; i<len; i++) {
          result.push("\n");
          print_node(node[i]);      
        }
        in_level.pop();
      }
    }

    print_node(tree);

    return result.join("");
  },

  to_string: function(tree) {

    var result = [];

    function print_node(node) {
      
      // don't transform undefined-values
      if(node === undefined) {        
        results.push('undefined');
        return;
      }

      var node_name = node[0],
          props     = util.inspect(node[1], false, null);

      result.push('["', node_name, '", ', props)

      // there are childnodes
      if(node.length > 2) {
        for(var i=2,len=node.length; i<len; i++) {
          result.push(',');
          print_node(node[i]);      
        }
      }
      result.push(']');
    }

    print_node(tree);

    return result.join("");
  }
}
