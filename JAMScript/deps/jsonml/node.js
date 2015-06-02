function method(impl) {
  return {
    value: impl,
    enumerable: false,
    writeable: false
  }
}

function addAccessors(obj, attr) {

  Object.defineProperty(obj, attr, method(function(val) {

    if(arguments.length == 1) { 
      this[1][attr] = val;
      return this;
    } else {
      return this[1][attr];
    }
  }))
}

// JsonML Format - ['Function', {} ]
function Node() {};
// that's the prototype of all nodes
Node.prototype = Object.create(Array.prototype, {

  // querying
  is: method(function(attr, val) {

    if(arguments.length == 1)
      return !!this[1][attr]

    return this[1][attr] === val;
  }),

  not: method(function(attr, val) {

    if(arguments.length == 1)
      return !this[1][attr]

    return this[1][attr] !== val;
  }),

  has: method(function(attr) {
    return this[1][attr] !== undefined;
  }),

  type: method(function() {
    return this[0];
  }),

  hasType: method(function(type) {
    return this[0] === type;
  }),

  // primitive selector engine
  // matches selectors like #Function.expr
  match: method(function(selector) {
    var parts   = /^(?:#(\w+))?((?:\.\w+)*)/.exec(selector),
        id      = parts[1],
        classes = parts[2].split('.').slice(1);

    // wrong id
    if(id !== undefined && !this.hasType(id)) 
      return false;

    // wrong class
    for(var i=0,len = classes.length;i<len;i++) {
      if(!this.is(classes[i])) 
        return false;
    }

    return true;
  }),

  //
  // manipulation  
  set: method(function(attr, val) {
    
    // if attr is an object like { key1: 2, key2: false }
    if(!val && typeof attr == 'object') {            
      for(var key in attr) {
        if(attr.hasOwnProperty(key)) 
          this[1][key] = attr[key];
      }
      
    } else {
      this[1][key] = val;
    }
    
    return this;     
  }),

  appendAll: method(function(children) {
    this.push.apply(this, children);
    return this;
  }),

  append: method(function() {
    this.push.apply(this, arguments);
    return this;
  }),

  //
  // traversal - only experimental
  children: method(function() {
    return this.slice(2);
  }),

  find: method(function(selector) {
    var collected = [];
    var children = this.children();

    for(var i=0,len=children.length; i<len;i++) {
      var child = children[i];

      if(child.match(selector))
        collected.push(child);

      // recursive call
      [].push.apply(collected, this.find.apply(child, arguments))
    }
    return collected;
  })
  
});

// Factory('Function', { id: undefined, generator: false, expr: false }, function() {...})
var Factory = module.exports = function(node_type, attrs, callback) {
  
  var klass = new Node();

  function NodeSubclass() {
    this[0] = node_type;
    this[1] = {};
    this.length = 2;

     // add create getters and setters for attributes
    for(var attr in attrs) {

      // add getters and setters 
      if(attrs.hasOwnProperty(attr)) {      
        // this[1] is the property-object of JsonML
        this[1][attr] = attrs[attr];
        addAccessors(this, attr);
      }
    }

  }
  NodeSubclass.prototype = klass;

 // factory function
 return function() {
    var instance = new NodeSubclass();

    // apply callback
    if(!!callback && typeof callback == 'function') {
      var ret = callback.apply(instance, arguments);
      if(typeof ret === 'object')
        return ret;
    }

    // append arguments to node
    else
      Array.prototype.push.apply(instance, arguments);

    return instance;
  }
}
