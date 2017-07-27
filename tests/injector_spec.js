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
    })
})(window, describe = window.describe, beforeEach = window.beforeEach, it = window.it, expect = window.expect);

