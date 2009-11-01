// The identity function. A is A, baby.
// (x => x)
var I = function (x) {
  return x;
};

// Function composition.
// All men are mortal. Socrates is a man. Therefore, Socrates is mortal.
// (a => b) => (c => a) => c => b
var C = function (f, g) {
  return function (x) {
    return f(g(x));
  };
};

// This lets us compose functions like f.o(g)
Function.prototype.o = function (g) {
  return C(this, g);
};

// Currying / Schonfinkelization
// If A and B imply C, then A implies that B implies C.
// ((a, b) => c) => a => b => c
var curry = function (f) {
  return function (a) {
    return f.curry(a);
  };
};
;

// TODO: Write a single function that curries functions of any arity
var curry2 = function (f) {
  return function (a) {
    return function (b) {
      return function (c) {
        return f(a, b, c);
      };
    };
  };
};

// Uncurrying / Unschonfinkelization
// (a => b => c) => (a, b) => c
var uncurry = function(f) {
  return function (a, b) {
    return f(a)(b);
  };
};
Function.prototype.uncurry = function () {
  return uncurry(this);
};

// Flips the arguments of a curried function
// (a => b => c) => b => a => c
var flip = function(f) {
  return curry(function(a, b) {
    return f(b)(a);
  });
};
Function.prototype.flip = function() {
  return flip(this);
};

// Applicative functor (S-Combinator)
// All mortal creatures die. Therefore, if all creatures are mortal, then all creatures die.
// (a => b => c) => (a => b) => a => c
var S = function (f, g) {
  return function (k) {
    return f(k)(g(k));
  };
};
Function.prototype.ap = function(g) {
  return S(this, g);
};

// Constant function (K-Combinator).
// All mortal men are mortal.
// (a => b => a)
var K = curry(function(x, y) { return x; });

// Promotes a function to a function over Enumerable.
var map = curry(function (f, a) {
  return a.map(f);
});

// The identity monad. Provides lazy semantics. Id x is a nullary function resulting in x.
var Id = {
  // a => Id a
  unit: function(x) { return function() { return x; };},

  counit: function(x) { return x(); },

  // (a => Id b) => Id b => Id b
  flatMap: curry(function(i, f) { return function() { return f(i())(); };}),

  // Id (Id a) => Id a
  mu: function(i) { return Id.flatMap(i)(I); },

  // Id a => (a => b) => Id b
  fmap: curry(function(i, f) { return Id.flatMap(i)(Id.unit.o(f)); }),

  // Id (a => b) => Id a => Id b
  ap: curry(function(f, i) { return Id.flatMap(f)(Id.fmap(i)); }),

  // (a => b => c) => Id a => Id b => Id c
  liftM2: curry2(function(f, a, b) {
      return Id.ap(Id.fmap(a)(f))(b);
  })
};
Id.liftM = flip(Id.fmap);


// The Maybe monad. An optional value that may be Nothing or Just(a).
// Church encoded into a function: b => (a => b) => b
var Nothing = K;
var Just = K.o(flip(I));
// Functions on optional values
var Maybe = {
  // (Maybe a) -> Either {} {just: a}
  toObject: function(o) {
    return o({})(function(x) {
      return {just: x};
    });
  },

  // Turns undefined, null, and the unit object into Nothing, otherwise Just(o)
  fromObject: function(o) {
    if (o === undefined || o === null || Object.keys(o).length == 0) {
      return Nothing;
    }
    return Just(o);
  },

  // Turns the empty string into Nothing, otherwise Just(s).
  fromString: function(s) {
    return Maybe.fromObject(s)(Nothing)(function(t) {
      return t == '' ? Nothing : Just(t);
    });
  },

  // If we might have cake, then we either have cake or we don't.
  // Maybe a => Bool
  isNothing: function(o) {
    return o(true)(K(false));
  },

  // Maybe a => Bool
  isJust: function(o) {
    return o(false)(K(true));
  },

  // If there might be cake, and we have a cake in case there's no cake, then there definitely will be cake.
  // a => Maybe a => a
  fromMaybe: curry(function(a, o) {
    return o(a)(I);
  }),

  // If we might have cake, then we have cake. Don't count on cake, though.
  // Maybe a => a. Not a total function.
  fromJust: function(j) {
    return j(function () { throw "fromJust: Nothing"; })(Id.unit)();
  },

  // If we have a set of cakes, then we might have cake.
  // [a] => Maybe a
  fromEnumerable: function(xs) {
              return xs.size() > 0 ? Just(xs.find(K(true))) : Nothing;
            },

  // If we might have cake, then we have a set of cakes.
  // Maybe a => [a]
  toEnumerable: function(o) {
                  return o([])(function (x) { return [x]; });
                },

  // If we have a set of things that might be cake, then we have a set of cakes.
  // [Maybe a] => [a]
  catMaybes: function(ms) {
               return ms.inject($A(), function(a, x) {
                 return x(a)(function(v) {
                   return $A([a, v]);
                 });
               }).flatten();
             },

  // Baking might result in a cake. We might bake. Therefore, we might have cake.
  // (a => Maybe b) => Maybe a => Maybe b
  // Implements the Monad interface
  flatMap: function(o) { return o(Nothing); },

  // Maybe having maybe cake is the same as maybe having cake.
  // Maybe (Maybe a) => Maybe a
  // Implements the Monad interface
  mu: function(o) { return o(Nothing)(I); },

  // All cakes are tasty. It might be cake. Therefore, it might be tasty.
  // (a => b) => Maybe a => Maybe b
  // Implements the Covariant Functor interface.
  fmap: curry(function(o, f) {
          return Maybe.flatMap(o)(Just.o(f));
        }),

  // Maybe all cakes are tasty. It might be cake. Therefore, it might be tasty.
  // Maybe (a => b) => Maybe a => Maybe b
  // Implements the Applicative Functor interface.
  ap: curry(function(mf, ma) {
        return Maybe.flatMap(mf)(Maybe.fmap(ma));
      }),

  // If we have sugar and flour, we make cake. We might have eggs. We might have flour. Therefore, we might make cake.
  // (a => b => c) => Maybe a => Maybe b => Maybe c
  liftM2: curry(function(f, a) { 
            return Maybe.ap(Maybe.fmap(a)(f));
          })
};

// Church pairs
var pair = curry2(function(x, y, z) { return z(x)(y); });
var fst = function(p) { return p(K); };
var snd = function(p) { return p(K(I)); };

// Singly-linked list by tagged union
var Nil = pair(true)(true);
var Cons = curry(function (h, t) { return pair(false)(pair(h)(t)); });
var isNil = fst;
var head = function (xs) { try { return fst(snd(xs)); } catch (e) {throw "Head on empty list";}};
var tail = function (xs) { try { return snd(snd(xs)); } catch (e) {throw "Tail on empty list";}};

var List = {
  foldr: curry2(function(f, z, xs) { return isNil(xs) ? z : f(head(xs))(List.foldr(f)(z)(tail(xs))); }),
  fromEnumerable: function(e) { return e.toArray().reverse().inject(Nil, uncurry(flip(Cons))); },
  toArray: function(xs) {
             var a = $A();
             var f = curry(function(h, t) { a.push(h); });
             List.foldr(f)(null)(xs);
             return a.reverse();
           }
};

// Traversal in a monad
// [m a] => m [a]
Id.sequence = function(xs) { return List.foldr(Id.liftM2(Cons))(Id.unit(Nil))(xs); };
Maybe.sequence = function(xs) { return List.foldr(Maybe.liftM2(Cons))(Just(Nil))(xs); };

// Get a value from an object or a hash
var get = curry(function (a, o) {
  if (Object.isHash(o)) {
    return o.get(a);
  } else {
    return o[a];
  }
});

// Set a value on an object or a hash
var set = curry2(function (h, k, v) {
  h.set(k, v);
});

// Merges two hashes
var merge = curry(function (a, b) {
  return a.merge(b);
});

// Returns a new hash with just the specified fields.
var select = curry(function (a, o) {
  var h = $H();
  a.map(set(h).ap(flip(get)(o)));
  return h;
});

// Renames a field in a hash
var rename = curry2(function(a, b, x) {
  var o = Object.isHash(x) ? x : $H(x);
  var h = $H();
  o.keys().each(function(k) {
    var v = o.get(k);
    h.set((k == a ? b : k), v);
  });
  return h;
});

// Join two lists on the given attributes. Assumes that there are no duplicates.
var join = function(a, b, hs1, hs2) {
  var h2 = $H();
  hs2.each(function(h) {
    var i = Object.isHash(h) ? h : $H(h);
    h2.set(i.get(b), i);
  });
  return hs1.map(function(x) {
    var h = Object.isHash(x) ? x : $H(x);
    return h.merge(h2.get(h.get(a)));
  });
};


