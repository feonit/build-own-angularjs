(function (window, describe, beforeEach, it, expect) {

    describe('[The Injector]', function() {
        beforeEach(function () {
            delete window.angular;
            setupModuleLoader(window);
        });

        describe('[Registering A Constant]', function () {
            it('can be created', function () {
                var injector = createInjector([]);
                expect(injector).toBeDefined();
            });

            it('has a constant that has been registered to a module', function () {
                var module = angular.module('myModule', []);
                module.constant('aConstant', 42);
                var injector = createInjector(['myModule']);
                expect(injector.has('aConstant')).toBe(true);
            });

            it('does not have a non-registered constant', function () {
                var module = angular.module('myModule', []);
                var injector = createInjector(['myModule']);
                expect(injector.has('aConstant')).toBe(false);
            });

            it('does not allow a constant called hasOwnProperty', function () {
                var module = angular.module('myModule', []);
                module.constant('hasOwnProperty', _.constant(false));
                expect(function () {
                    createInjector(['myModule']);
                }).toThrow();
            });

            it('can return a registered constant', function () {
                var module = angular.module('myModule', []);
                module.constant('aConstant', 42);
                var injector = createInjector(['myModule']);
                expect(injector.get('aConstant')).toBe(42);
            });
        });

        describe('[Requiring Other Modules]', function () {

            it('loads multiple modules', function () {
                var module1 = angular.module('myModule', []);
                var module2 = angular.module('myOtherModule', []);
                module1.constant('aConstant', 42);
                module2.constant('anotherConstant', 43);
                var injector = createInjector(['myModule', 'myOtherModule']);
                expect(injector.has('aConstant')).toBe(true);
                expect(injector.has('anotherConstant')).toBe(true);
            });

            it('loads the required modules of a module', function () {
                var module1 = angular.module('myModule', []);
                var module2 = angular.module('myOtherModule', ['myModule']);
                module1.constant('aConstant', 42);
                module2.constant('anotherConstant', 43);
                var injector = createInjector(['myOtherModule']);
                expect(injector.has('aConstant')).toBe(true);
                expect(injector.has('anotherConstant')).toBe(true);

            });

            it('loads each module only once', function() {
                angular.module('myModule', ['myOtherModule']);
                angular.module('myOtherModule', ['myModule']);
                createInjector(['myModule']);
                // тут просто stack maximum error будет если что
            });

        });

        describe('[Dependency Injection]', function () {

            it('invokes an annotated function with dependency injection', function() {
                var module = angular.module('myModule', []);
                module.constant('a', 1);
                module.constant('b', 2);
                var injector = createInjector(['myModule']);
                var fn = function(one, two) { return one + two; };
                fn.$inject = ['a', 'b'];
                expect(injector.invoke(fn)).toBe(3);
            });


        })

        describe('[Rejecting Non-String DI Tokens]', function () {

            it('does not accept non-strings as injection tokens', function() {
                var module = angular.module('myModule', []);
                module.constant('a', 1);
                var injector = createInjector(['myModule']);
                var fn = function(one, two) { return one + two; };
                fn.$inject = ['a', 2];
                expect(function() {
                    injector.invoke(fn);
                }).toThrow();
            });

        })

        describe('[Binding this in Injected Functions]', function () {
            it('invokes a function with the given this context', function() {
                var module = angular.module('myModule', []);
                module.constant('a', 1);
                var injector = createInjector(['myModule']);
                var fn = function(one, two) { return one + two; };
                fn.$inject = ['a', 2];
                expect(function() {
                    injector.invoke(fn);
                }).toThrow();
            });
        })

        describe('[Providing Locals to Injected Functions]', function () {
            it('overrides dependencies with locals when invoking', function() {
                var module = angular.module('myModule', []);
                module.constant('a', 1);
                module.constant('b', 2);
                var injector = createInjector(['myModule']);
                var fn = function(one, two) { return one + two; };
                fn.$inject = ['a', 'b'];
                expect(injector.invoke(fn, undefined, {b: 3})).toBe(4);
            });
        })


        describe('annotate', function () {
            describe('[Array-Style Dependency Annotation]', function () {
                it('returns the $inject annotation of a function when it has one', function() {
                    var injector = createInjector([]);
                    var fn = function() { };
                    fn.$inject = ['a', 'b'];
                    expect(injector.annotate(fn)).toEqual(['a', 'b']);
                });
            })

            describe('[Dependency Annotation from Function Arguments]', function () {
                it('returns an empty array for a non-annotated 0-arg function', function() {
                    var injector = createInjector([]);
                    var fn = function() { };
                    fn.$inject = ['a', 'b'];
                    expect(injector.annotate(fn)).toEqual(['a', 'b']);
                });
                it('returns annotations parsed from function args when not annotated', function() {
                    var injector = createInjector([]);
                    var fn = function(a, b) { };
                    expect(injector.annotate(fn)).toEqual(['a', 'b']);
                });
                it('strips comments from argument lists when parsing', function() {
                    var injector = createInjector([]);
                    var fn = function(a, /*b,*/ c) { };
                    expect(injector.annotate(fn)).toEqual(['a', 'c']);
                });
                it('strips several comments from argument lists when parsing', function() {
                    var injector = createInjector([]);
                    var fn = function(a, /*b,*/ c/*, d*/ ) { };
                    expect(injector.annotate(fn)).toEqual(['a', 'c']);
                });
                it('strips // comments from argument lists when parsing', function() {
                    var injector = createInjector([]);
                    var fn = function(a, //b,
                                      c) { };
                    expect(injector.annotate(fn)).toEqual(['a', 'c']);
                });
                it('strips surrounding underscores from argument names when parsing', function() {
                    var injector = createInjector([]);
                    var fn = function(a, _b_, c_, _d, an_argument) { };
                    expect(injector.annotate(fn)).toEqual(['a', 'b', 'c_', '_d', 'an_argument']);
                });

            });

            describe('[Strict Mode]', function () {
                it('throws when using a non-annotated fn in strict mode', function() {
                    var injector = createInjector([], true);
                    var fn = function(a, b, c) { };
                    expect(function() {
                        injector.annotate(fn);
                    }).toThrow();
                });
            });
            describe('[Integrating Annotation with Invocation]', function () {
                it('invokes an array-annotated function with dependency injection', function() {
                    var module = angular.module('myModule', []);
                    module.constant('a', 1);
                    module.constant('b', 2);
                    var injector = createInjector(['myModule']);
                    var fn = ['a', 'b', function(one, two) { return one + two; }];
                    expect(injector.invoke(fn)).toBe(3);
                });
                it('invokes a non-annotated function with dependency injection', function() {
                    var module = angular.module('myModule', []);
                    module.constant('a', 1);
                    module.constant('b', 2);
                    var injector = createInjector(['myModule']);
                    var fn = function(a, b) { return a + b; };
                    expect(injector.invoke(fn)).toBe(3);
                });
            });

            describe('[ Instantiating Objects with Dependency Injection]', function () {
                it('instantiates an annotated constructor function', function() {
                    var module = angular.module('myModule', []);
                    module.constant('a', 1);
                    module.constant('b', 2);
                    var injector = createInjector(['myModule']);
                    function Type(one, two) {
                        this.result = one + two;
                    }
                    Type.$inject = ['a', 'b'];
                    var instance = injector.instantiate(Type);
                    expect(instance.result).toBe(3);
                });
                it('instantiates an array-annotated constructor function', function() {
                    var module = angular.module('myModule', []);
                    module.constant('a', 1);
                    module.constant('b', 2);
                    var injector = createInjector(['myModule']);
                    function Type(one, two) {
                        this.result = one + two;
                    }
                    var instance = injector.instantiate(['a', 'b', Type]);
                    expect(instance.result).toBe(3);
                });
                it('instantiates a non-annotated constructor function', function() {
                    var module = angular.module('myModule', []);
                    module.constant('a', 1);
                    module.constant('b', 2);
                    var injector = createInjector(['myModule']);
                    function Type(a, b) {
                        this.result = a + b;
                    }
                    var instance = injector.instantiate(Type);
                    expect(instance.result).toBe(3);
                });
                it('uses the prototype of the constructor when instantiating', function() {
                    function BaseType() { }
                    BaseType.prototype.getValue = _.constant(42);
                    function Type() { this.v = this.getValue(); }
                    Type.prototype = BaseType.prototype;
                    var module = angular.module('myModule', []);
                    var injector = createInjector(['myModule']);
                    var instance = injector.instantiate(Type);
                    expect(instance.v).toBe(42);
                });
                it('supports locals when instantiating', function() {
                    var module = angular.module('myModule', []);
                    module.constant('a', 1);
                    module.constant('b', 2);
                    var injector = createInjector(['myModule']);
                    function Type(a, b) {
                        this.result = a + b;
                    }
                    var instance = injector.instantiate(Type, {b: 3});
                    expect(instance.result).toBe(4);
                });
            });
        })
    })

    describe('[Providers]', function() {


        describe('[The Simplest Possible Provider: An Object with A $get Method]', function() {
            it('allows registering a provider and uses its $get', function() {
                var module = angular.module('myModule', []);
                module.provider('a', {
                    $get: function() {
                        return 42;
                    }
                });
                var injector = createInjector(['myModule']);
                expect(injector.has('a')).toBe(true);
                expect(injector.get('a')).toBe(42);
            });
        })


        describe('[Injecting Dependencies To The $get Method]', function() {
            it('injects the $get method of a provider', function() {
                var module = angular.module('myModule', []);
                module.constant('a', 1);
                module.provider('b', {
                    $get: function(a) {
                        return a + 2;
                    }
                });
                var injector = createInjector(['myModule']);
                expect(injector.get('b')).toBe(3);
            });
        })

        describe('[Lazy Instantiation of Dependencies]', function() {
            it('injects the $get method of a provider lazily', function() {
                var module = angular.module('myModule', []);
                module.provider('b', {
                    $get: function(a) {
                        return a + 2;
                    }
                });
                module.provider('a', {$get: _.constant(1)});
                var injector = createInjector(['myModule']);
                expect(injector.get('b')).toBe(3);
            });

        })
    })
})(window, describe = window.describe, beforeEach = window.beforeEach, it = window.it, expect = window.expect);

