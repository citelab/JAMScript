/**
 * Add missing methods to Object & Array
 */
if(typeof Object.create !== 'function') {
  Object.create = function(proto) {
    var F = function() {};
    F.prototype = proto;
    return new F();
  }
}

if(typeof Object.getOwnPropertyNames !== 'function') {
  Object.getOwnPropertyNames = function(x) {
    var r = [];
    for(name in x) {
      if(x.hasOwnProperty(name)) {
        r.push(name)
      }
    }
    return r
  };
}

if(typeof Array.prototype.map !== 'function') {
  Array.prototype.map = function(f) {
    var r = [];
    for(var i=0,len=this.length; i<len ; i++) {
      r[i] = f(this[i])
    }
    return r
  };
}

if(typeof Array.prototype.reduce !== 'function') {
  Array.prototype.reduce = function(f, z) {
    var r = z;
    for(var i=0,len=this.length; i<len; i++) {
      r = f(r, this[i])
    }
    return r
  };
}

/**
 * Local helper methods
 */
function extend(obj) {
  for(var i=1,len=arguments.length;i<len;i++) {
    var props = arguments[i];
   
    for(var p in props) {
      if(props.hasOwnProperty(p)) {
        obj[p] = props[p];
      }
    }
  }
  return obj;
};

// A simplified Version of Object.create
function inherit(x, props) {
  var r = Object.create(x);
  return extend(r, props);
};


/**
 * The implementation of OMeta is split into two parts
 *
 * I. Backtracker implementation
 * II. OMeta rules and PEG-implementation
 */
var OMeta = (function() {

  /**
   * I. Backtracker
   * 
   * Methods
   * -------
   *
   * Stream handling:
   * - consume()
   * - current_state()
   * - restore(state)
   * - pos()
   * - prepend()
   * - inject()
   * - capture()
   * - captureIndex()
   *
   * Foreign Streams:
   * - borrow()
   * - take_back()
   *
   * Memoization:
   * - memoized(ruleName, grammar)
   * 
   * Error Handling:
   * - mismatch(msg, reason)
   * - catch_mismatch(error)
   * - report_errors(error)
   * 
   *
   * Utilized Classes and Mixins
   * ---------------------------
   * - Stream(streamable, pos?)
   * - Stream(obj, restStream)
   * - Proxied(stream)
   * - Memoizing(stream)
   */
  function Backtracker(input) {

    /**
     * Private Variables
     */
    var stream;

    /**
     * Streaming Handling
     * ==================
     *
     * Stream - object 
     * ---------------
     * behaves similar to LISP-Pairs
     *
     * notes:
     * - original Input has to be stored separatly in Parser (Backtracker) itself
     *
     * @overload Stream(obj, restStream)
     *   This overload commonly is used to prepend an input to an existing stream
     *   [Object] obj                  any object, that will be used as `first`
     *   [Stream] restStream           the rest of the stream.
     *
     * @overload Stream(streamable, pos?)
     *   Stream is constructed from string or array with optional position
     *   [String, Array] streamable    the object, which should be converted into a stream
     *   [Number] pos                  position of the first element within the streamable 
     *                                 object
     *
     * @return Stream
     */
    function Stream(streamable, rest_or_pos) {

      var pos;

      // First overload:
      //   Stream(obj, restStream)
      if(rest_or_pos instanceof Stream) {

        var restStream = rest_or_pos;
            pos = restStream.pos;

        this.first = function() { return streamable; }
        this.rest  = function() { return restStream; }
        this.eos   = function() { return restStream === undefined; }

      // Second overload:
      //   Stream(streamable, pos?)
      } else {

        var length = streamable.length;
            pos = rest_or_pos || 0;

        this.first = function() {
          if(pos >= length)
            throw "End of stream";
          
           return streamable[pos]; 
        }
        this.rest = function() {
          var rest = new Stream(streamable, pos+1);
          // patch rest() to only calculate it once
          this.rest = function() { return rest; }
          return rest;
        }
        this.eos = function() { return pos >= length }
      }

      this.pos = function() { return pos; }

       // required by capture operator < ... >
      this.upTo = function(other) {

        if(typeof streamable === 'string')
          return streamable.slice(pos, other.pos());

        var consumed = [],
            current = this;

        while(current.pos() < after.pos()) {
          consumed.push(current.first());
          current = current.rest();
        }
        return consumed;
      }
      
      this.input = function() { return streamable; }
    }

    stream = new Stream(input);

    // only for debug
    //this.stream = function() { return stream }

    // Only used by rule anything
    this.consume = function() {
      try {
        var el = stream.first();
        stream = stream.rest();
        return el;
      } catch(e) {
        this.mismatch("End of Stream");
      }      
    }

    this.current_state = function() { return stream; }
    this.restore = function(state) { stream = state; }
    this.pos = function() { return stream.pos(); }    
    this.prepend = function(el) { stream = new Stream(el, stream); }

    // temporarily replace input by a streamable object (mostly arrays or strings)
    // in order to allow pattern matching on arrays (i.e. rule = [char char foo])
    this.inject = function(streamable) { stream = new Stream(streamable); }
  
    // problem: proxied captures won't work well, because they wont find the end
    this.capture = function(action, context) {

      var before = stream,
          after;          

      action.call(context);
      after = stream;   

      return before.upTo(after); // array of consumed items
    }

    this.captureIndex = function(action, context) {

      var before = stream,
          after;

      action.call(context);
      after = stream;

      return context.position_info(input, before.pos(), after.pos());
    }

    /**
     * Foreign Rule Invocation
     * =======================
     * Allow to borrow the input stream for foreign rule invocation
     * the stream is proxied to not fall back on old memoization entires
     */
    function Proxied(stream) {
      var rest;

      return inherit(stream, {
        original: function() { return stream; },
        rest: function() { 
          return rest ? rest : Proxied(stream.rest()) }
      });
    }

    this.borrow = function() {
      stream = Proxied(stream);
      return this;
    }

    this.take_back = function() {
      stream = stream.original();
      return this;
    }
    
    /**
     * Memoization
     * ===========
     */
    // Mixin to allow a stream to memoize rules
    function Memoizing(stream) {

      var memo = {};

      stream.memoize = function(ruleName, result) {
        return memo[ruleName] = result;
      }

      stream.remember = function(ruleName) {
        return memo[ruleName];
      }

      return stream;
    }

    // Is used by memoizer to flag the occurance of recursion
    function Flag() { this.detected = false };

    this.memoized = function(ruleName, grammar) {

      var memo;

      // the stream has not yet been enabled for memoization -> apply Mixin Memoizing
      // hasOwnProperty is needed to recognize proxied streams
      if(!stream.hasOwnProperty('remember') || !typeof stream.remember == 'function') {
        Memoizing(stream);

      } else {
        memo = stream.remember(ruleName);
      }

      // no memo entry for this rule
      if(memo === undefined) {

        var state = this.current_state();

        var recursion = new Flag(),
            rule = grammar[ruleName];
        
        if(rule === undefined)
          throw 'Tried to apply undefined rule "' + ruleName + '"';

        // Do the seed-pass. Store the flag as memoRecord and apply `rule`
        // for the first time. If rule calls itself recursivly the flag will be used
        // and the recursion will be detected.
        stream.memoize(ruleName, recursion);
        memo = stream.memoize(ruleName, {
          ans:   rule.call(grammar),
          state: this.current_state()
        });

        // the recursion flag has been set for this rule -> Recursion detected!
        if(recursion.detected) {

          var sentinel = this.current_state(),
              ans;

          while(true) {
            // restore-position and reuse the original input
            this.restore(state);

            try { ans = rule.call(grammar); } 
            catch (f) { 
              this.catch_mismatch(f);
              break;
            }

            // Same point as before
            if(this.current_state() === sentinel) {
              break;
            }
            // update memoRecord            
            memo.state = this.current_state();
            memo.ans   = ans;
          }
        }

      // The previous pass has been the seed-pass. Now flag it as recursive
      } else if(memo instanceof Flag) {
        memo.detected = true;
        this.mismatch("Recursion detected applying " + ruleName)
      }
    
      // There is a memo record - than use it
      // return the previous calculated ans and continue where the memoRecord left off
      this.restore(memo.state);
      return memo.ans;
    } 


    /**
     * Error Reporting
     * ===============
     * Error Reporting is inspired a little bit by PEG.js. It can be improved in future
     * work. For example the position calculating is still buggy and error reporting
     * is not generic enough to work fine with translations.
     */ 
    var latest_mismatch = 0,
        errors = {};
    
    function line_of(string, pos) {

      var lines  = 1,
          latest = 0,
          col    = 0;

      for(var i=0; i<pos; i++) {

        if(string[i] === "\n") {
          lines++;
          col = 0;
          latest = i;
        } else {
          col++;
        }
      }
      return {
        line_no: lines,
        col: col-1,
        line: string.slice(latest, pos+10)
      }
    }

    function Mismatch(msg) {
      this.msg = msg;
      this.pos = stream.pos();
    }
    Mismatch.prototype = {
      toString: function(indent) { 
        indent = indent || "";
        return [indent, this.msg, " at position: ", this.pos].join("");
      }
    }

    function RuleMismatch(ruleName, beforeState, reason) {
      this.rule = ruleName;
      this.pos = stream.pos();
      this.before = beforeState.pos();
      this.state = beforeState;
    }
    RuleMismatch.prototype = inherit(new Mismatch(), {
      toString: function(indent) {
        var line = line_of(input, this.pos);
        return [indent, "Tried to apply rule '",this.rule,"' at line ",line.line_no," at col ",line.col,"\n",
                indent, "  ", line.line, "\n",
                indent, "  ", Array(line.col).join(" "), "^"
               ].join("")
      }
    });
    

    this.mismatch = function(msg, reason) {
      var mismatch = new Mismatch(msg, reason);
      throw mismatch;
    }

    this.mismatchRule = function(rule, state, reason) {

      var mismatch = new RuleMismatch(rule, state, reason);

      if(mismatch.pos > latest_mismatch) {
        errors = {};
        errors[mismatch.rule] = true;
        latest_mismatch = mismatch.pos;
      } else if (mismatch.pos == latest_mismatch) {
        errors[mismatch.rule] = true;
      }

      throw mismatch
    }

    this.catch_mismatch = function(error) {
      if(!error instanceof Mismatch) 
        throw error;
    }

    this.report_errors = function(e) {
  
      if(typeof input === 'string') {

        var line = line_of(input, latest_mismatch);
        return ["Could not continue to match at line ",line.line_no," at col ",line.col,"\n",
                line.line_no,': ', line.line, "\n",
                Array(line.line_no.toString().length + 2 + line.col+1).join(" "), "^\n\n",
                "  ", "expected: ", Object.getOwnPropertyNames(errors).sort().join(', ')].join('');

      } else {
        return ["Could not continue to match, expected: ", 
                Object.getOwnPropertyNames(errors).sort().join(', ')].join('');
      }
    }  
  }

  /**
   * II. OMeta base implementation
   * ----------------------------
   * All grammars inherit from this OMeta-base class
   * The method-implementations can be grouped into three categories:
   * 
   * 1. Public interface
   * 2. Rules
   * 3. Extended PEG-implementation
   * 4. Internal Rules
   */

  //
  //
  // 1. Public interface
  var public_interface = {
    
    match: function(obj, rule, args, matchFailed) {
      return this._genericMatch([obj], rule, args, matchFailed)
    },
    matchAll: function(listyObj, rule, args, matchFailed) {
      return this._genericMatch(listyObj, rule, args, matchFailed)
    },

    inherit: function(rules) {
      return inherit(this, rules);
    },

    // initialization hook
    initialize: function() {},

    // configurations
    disableXORs: false,
    
    position_info: function(input, from, to) {
      return {
        from: from,
        to: to
      }
    }

    // memoizeParametrizedRules
  };

  //
  //
  // 2. Basic Rules
  var rules = {

    // Those three rules have dependencies to `this.bt`
    anything: function() {
      return this.bt.consume();
    },
    exactly: function(wanted) {
      wanted = this._apply("anything");
      var got = this._apply("anything");

      if(got === wanted)
        return got;
      
      this.bt.mismatch(["Expected '", wanted, "' got '", got, "'"].join(''));
    },
    pos: function() {
      return this.bt.pos();
    },

    end: function() {
      return this._not(function() {
        return this._apply("anything");
      })
    },    
    empty: function() {
      return true;
    },
    apply: function(rule) {
      rule = this._apply("anything");
      return this._apply(rule)
    },

    // some useful "derived" rules
    "true": function() {
      var r = this._apply("anything");
      this._pred(r === true);
      return r
    },
    "false": function() {
      var r = this._apply("anything");
      this._pred(r === false);
      return r
    },
    "undefined": function() {
      var r = this._apply("anything");
      this._pred(r === undefined);
      return r
    },
    number: function() {
      var r = this._apply("anything");
      this._pred(typeof r === "number");
      return r
    },
    string: function() {
      var r = this._apply("anything");
      this._pred(typeof r === "string");
      return r
    },
    "char": function() {
      var r = this._apply("anything");
      this._pred(typeof r === "string" && r.length == 1);
      return r
    },
    space: function() {
      var r = this._apply("char");
      this._pred(r.charCodeAt(0) <= 32);
      return r
    },
    range: function(from, to ) {
      from = this._apply("anything");
      to   = this._apply("anything");
      var r = this._apply("char");
      this._pred(from <= r && r <= to);
      return r;
    },
    spaces: function() {
      return this._many(function() {
        return this._apply("space")
      })
    },
    digit: function() {
      var r = this._apply("char");
      this._pred(r >= "0" && r <= "9");
      return r
    },
    lower: function() {
      var r = this._apply("char");
      this._pred(r >= "a" && r <= "z");
      return r
    },
    upper: function() {
      var r = this._apply("char");
      this._pred(r >= "A" && r <= "Z");
      return r
    },
    letter: function() {
      return this._or(
        function() { return this._apply("lower") }, 
        function() { return this._apply("upper") })
    },
    letterOrDigit: function() {
      return this._or(
        function() { return this._apply("letter") }, 
        function() { return this._apply("digit") })
    },
    listOf: function(rule, delim) {
      rule = this._apply("anything");
      delim = this._apply("anything");
      return this._or(
        function() { var r = this._apply(rule); 
          return this._many(
            function() { this._applyWithArgs("token", delim);
              return this._apply(rule)}, 
            r)
        }, 
        function() { return [] })
    },   
    fromTo: function(x, y) {
      x = this._apply("anything");
      y = this._apply("anything");

      return this._consumedBy(function() {
        this._applyWithArgs("seq", x);
        this._many(function() {
          this._not(function() {
            this._applyWithArgs("seq", y)
          });
          this._apply("char")
        });
        this._applyWithArgs("seq", y)
      })
    },
    firstAndRest: function(first, rest) {
      first = this._apply("anything");
      rest  = this._apply("anything");
      return this._many(
        function() { return this._apply(rest)}, 
        this._apply(first))
    },
    notLast: function(rule) {
      rule = this._apply("anything");
      var r = this._apply(rule);
      this._lookahead(function() {
        return this._apply(rule)
      });
      return r
    }   
  };

  //
  // 
  // 3. Extended PEG Implementation
  // These are the rules, that have representing syntax elements
  var peg_implementation = {

    // ``foo''
    seq: function(xs) {
      xs = this._apply("anything");
      for(var i=0,len=xs.length; i < len; i++) {
        this._applyWithArgs("exactly", xs[i])
      }
      return xs
    },
    
    // otherGrammar.rule
    foreign: function(grammar, ruleName) {
      grammar  = this._apply("anything");
      ruleName = this._apply("anything");

      var foreign = inherit(grammar, {
        bt: this.bt.borrow()
      });

      var ans = foreign._apply(ruleName);
      this.bt.take_back(); // return the borrowed input stream
      return ans;
    },

    // "tok" === token("tok")
    token: function(cs) {
      cs = this._apply("anything");
      this._apply("spaces");
      return this._applyWithArgs("seq", cs)
    },

 
    // Semantic Predicate
    // !( ... )
    _pred: function(b) {
      if(b) { return true }
      this.bt.mismatch("Semantic predicate failed");
    },

    // negative lookahead
    // ~rule
    _not: function _not(expr) {
      var state = this.bt.current_state();
      try { var r = expr.call(this) } 
      catch (f) {
        this.bt.catch_mismatch(f);
        this.bt.restore(state);
        return true
      }
      this.bt.mismatch("Negative lookahead didn't match got " + r);
    },
    
    // positive lookahead
    // &rule
    _lookahead: function _lookahead(expr) {
      var state = this.bt.current_state(),
          ans = expr.call(this);
      this.bt.restore(state);
      return ans
    },

    // ordered alternatives
    // rule_a | rule_b
    // tries all alternatives until the first match
    _or: function() {
      var state = this.bt.current_state();

      for(var i=0,len=arguments.length; i<len; i++) {        
        try { 
          return arguments[i].call(this)
        } catch (f) { 
          this.bt.catch_mismatch(f);
          this.bt.restore(state);
        }
      }
      this.bt.mismatch("All alternatives failed");
    },

    // exclusive Or
    // rule_a || rule_b
    // tries all alternatives and raises an error if there are two matching alternatives
    // TODO check if matched state can be retreived from `ans`
    _xor: function() {

      if(this.disableXORs)
        return this._or.apply(this, arguments);
  
      var state = this.bt.current_state(),
          matched = 0,
          mismatches = [];
          ans;

      for(var i=1,len=arguments.length; i<len; i++) {
        try {
          ans = arguments[i].call(this);
          if(matched >= 1) break;
    
          matched++;
        } catch (f) {
          this.bt.catch_mismatch(f);
          this.bt.restore(state);
          mismatches.push(f);
        }
      }
      if(matched == 1) 
        return ans;

      if(matched > 1)
        this.bt.mismatch("More than one option matched by XOR")

      this.bt.mismatch("All alternatives failed");
    },

    // Optional occurance of rule
    // rule?
    _opt: function(rule) {
      var state = this.bt.current_state();
      try { return rule.call(this); } 
      catch(f) {
        this.bt.catch_mismatch(f);
        this.bt.restore(state);
      }
    },

    // multiple occurances of rule
    // rule*
    _many: function(rule) {
      var ans = arguments[1] !== undefined ? [arguments[1]] : [],
          state;
      while (true) {
        state = this.bt.current_state();
        try { ans.push(rule.call(this)) } 
        catch (f) {
          this.bt.catch_mismatch(f);
          this.bt.restore(state);
          break;
        }
      }
      return ans
    },

    // mutliple occurances of rule, at least one
    // rule+
    _many1: function(rule) {
      return this._many(rule, rule.call(this))
    },

    // Pattern matching of Arrays
    // [rule1 rule2 rule3*]
    _form: function(expr) {
      var obj = this._apply("anything"),
          state = this.bt.current_state();

      this.bt.inject(obj);
      expr.call(this);
      this._apply("end");

      this.bt.restore(state);
      return obj;
    },

    // captures the input consumed by `rule`
    // < ... >
    _consumedBy: function(rule) {
      return this.bt.capture(function() {
        rule.call(this);
      }, this);
    },

    // captures the indices of the input consumed by `rule`
    // @< ... >
    _idxConsumedBy: function(rule) {
      return this.bt.captureIndex(function() {
        rule.call(this);
      }, this);
    }
  };


  //
  // 
  // 4. Internal Rules and Properties
  var internal_rules = {

    _grammarName: 'OMeta',

    _genericMatch: function(input, rule, args, infos) {
      args = args && args.slice() || []
      args.unshift(rule);

      // this is done to create an instance of the parser with a new backtracker
      var m = inherit(this, {
        bt: new Backtracker(input, this)
      });

      m.initialize();

      try {
        return args.length == 1 ? 
          m._apply(rule) :
          m._applyWithArgs.apply(m, args)

      } catch (f) {
        console.log(f);
        m.bt.catch_mismatch(f);
        var error = ["(",m._grammarName,") Error occured while matching \n", 
                     m.bt.report_errors(f)].join('')
        throw error;
      }
    },

    _apply: function(ruleName) {
    
      var rule = this[ruleName],
          state = this.bt.current_state();

      if (rule === undefined) {
        throw 'Tried to apply undefined rule "' + ruleName + '"';
      }
     
      try { return this.bt.memoized(ruleName, this); }// rule.call(this); } 
      catch(e) {
        this.bt.catch_mismatch(e);
        this.bt.mismatchRule(ruleName, state, e);
      }
    },

    _applyWithArgs: function(ruleName) {
  
      var rule = this[ruleName];
      if (rule === undefined) {
        throw 'Tried to apply undefined rule "' + ruleName + '"';
      }

      for(var i = arguments.length - 1; i > 0; i--) {
        this.bt.prepend(arguments[i])
      }
      // by default those rules are not memoized and not reported
      return rule.call(this);
    },

    _superApplyWithArgs: function(recv, ruleName) {

      for(var i = arguments.length - 1; i > 1; i--) {
        recv.bt.prepend(arguments[i])
      }
      // by default those calls are not memoized
      return this[ruleName].call(recv)
    }
  };

  return extend({}, 
    public_interface,
    rules,
    peg_implementation,
    internal_rules
  );
})();

// common.js modules
if(typeof module !== 'undefined')
  module.exports = OMeta
