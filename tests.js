
describe("[Scope]", function(){


	describe("[Destroying A Watch]", function(){
		it("allows destroying a $watch with a removal function", function() {
			var scope = new Scope();
			scope.aValue = 'abc';
			scope.counter = 0;
			var destroyWatch = scope.$watch(
				function(scope) { return scope.aValue; },
				function(newValue, oldValue, scope) {
					scope.counter++;
				}
			);
			scope.$digest();
			expect(scope.counter).toBe(1);
			scope.aValue = 'def';
			scope.$digest();
			expect(scope.counter).toBe(2);
			scope.aValue = 'ghi';
			destroyWatch();
			scope.$digest();
			expect(scope.counter).toBe(2);
		});

		it("allows destroying a $watch during digest", function() {
			var scope = new Scope();
			scope.aValue = 'abc';
			var watchCalls = [];
			scope.$watch(
				function(scope) {
					watchCalls.push('first');
					return scope.aValue;
				}
			);
			var destroyWatch = scope.$watch(
				function(scope) {
					watchCalls.push('second');
					destroyWatch();
				}
			);
			scope.$watch(
				function(scope) {
					watchCalls.push('third');
					return scope.aValue;
				}
			);
			scope.$digest();
			expect(watchCalls).toEqual(['first', 'second', 'third', 'first', 'third']);
		});

	});

	describe("[Short-Circuiting The Digest When The Last Watch Is Clean]", function(){
		// лечится добавлением $$lastDirtyWatch
		it("ends the digest when the last watch is clean", function() {
			var scope = new Scope();
			scope.array = _.range(100);
			var watchExecutions = 0;
			_.times(100, function(i) {
				scope.$watch(
					function(scope) {
						watchExecutions++;
						return scope.array[i];
					},
					function(newValue, oldValue, scope) {
					}
				);
			});
			scope.$digest();
			expect(watchExecutions).toBe(200);
			scope.array[0] = 420;
			scope.$digest();
			expect(watchExecutions).toBe(301);
		});
	});

});


describe("[Inheritance]", function() {

	it("inherits the parent's properties", function() {
		var parent = new Scope();
		parent.aValue = [1, 2, 3];
		var child = parent.$new();
		expect(child.aValue).toEqual([1, 2, 3]);
	});

	it("does not cause a parent to inherit its properties", function() {
		var parent = new Scope();
		var child = parent.$new();
		child.aValue = [1, 2, 3];
		expect(parent.aValue).toBeUndefined();
	});

	it("inherits the parent's properties whenever they are defined", function() {
		var parent = new Scope();
		var child = parent.$new();
		parent.aValue = [1, 2, 3];
		expect(child.aValue).toEqual([1, 2, 3]);
	});

	it("can manipulate a parent scope's property", function() {
		var parent = new Scope();
		var child = parent.$new();
		parent.aValue = [1, 2, 3];
		child.aValue.push(4);
		expect(child.aValue).toEqual([1, 2, 3, 4]);
		expect(parent.aValue).toEqual([1, 2, 3, 4]);
	});

	it("can watch a property in the parent", function() {
		var parent = new Scope();
		var child = parent.$new();
		parent.aValue = [1, 2, 3];
		child.counter = 0;
		child.$watch(
			function(scope) { return scope.aValue; },
			function(newValue, oldValue, scope) {
				scope.counter++;
			},
			true
		);
		child.$digest();
		expect(child.counter).toBe(1);
		parent.aValue.push(4);
		child.$digest();
		expect(child.counter).toBe(2);
	});

	it("can be nested at any depth", function() {
		var a = new Scope();
		var aa = a.$new();
		var aaa = aa.$new();
		var aab = aa.$new();
		var ab = a.$new();
		var abb = ab.$new();
		a.value = 1;
		expect(aa.value).toBe(1);
		expect(aaa.value).toBe(1);
		expect(aab.value).toBe(1);
		expect(ab.value).toBe(1);
		expect(abb.value).toBe(1);
		ab.anotherValue = 2;
		expect(abb.anotherValue).toBe(2);
		expect(aa.anotherValue).toBeUndefined();
		expect(aaa.anotherValue).toBeUndefined();
	});


	it("shadows a parent's property with the same name", function() {
		var parent = new Scope();
		var child = parent.$new();
		parent.name = 'Joe';
		child.name = 'Jill';
		expect(child.name).toBe('Jill');
		expect(parent.name).toBe('Joe');
	});

	it("does not shadow members of parent scope's attributes", function() {
		var parent = new Scope();
		var child = parent.$new();
		parent.user = {name: 'Joe'};
		child.user.name = 'Jill';
		expect(child.user.name).toBe('Jill');
		expect(parent.user.name).toBe('Jill');
	});


	it("does not shadow members of parent scope's attributes", function() {
		var parent = new Scope();
		var child = parent.$new();
		parent.user = {name: 'Joe'};
		child.user.name = 'Jill';
		expect(child.user.name).toBe('Jill');
		expect(parent.user.name).toBe('Jill');
	});


	// лечится добавлением child.$$watchers = []; в $new
	it("does not digest its parent(s)", function() {
		var parent = new Scope();
		var child = parent.$new();
		parent.aValue = 'abc';
		parent.$watch(
			function(scope) { return scope.aValue; },
			function(newValue, oldValue, scope) {
				scope.aValueWas = newValue;
			}
		);
		child.$digest();
		expect(child.aValueWas).toBeUndefined();
	});

	// добавляется this.$$children = []; в Scope
	// и this.$$children.push(child); child.$$children = []; в $new
	it("keeps a record of its children", function() {
		var parent = new Scope();
		var child1 = parent.$new();
		var child2 = parent.$new();
		var child2_1 = child2.$new();
		expect(parent.$$children.length).toBe(2);
		expect(parent.$$children[0]).toBe(child1);
		expect(parent.$$children[1]).toBe(child2);
		expect(child1.$$children.length).toBe(0);
		expect(child2.$$children.length).toBe(1);
		expect(child2.$$children[0]).toBe(child2_1);
	});


	it("digests its children", function() {
		var parent = new Scope();
		var child = parent.$new();
		parent.aValue = 'abc';
		child.$watch(
			function(scope) { return scope.aValue; },
			function(newValue, oldValue, scope) {
				scope.aValueWas = newValue;
			}
		);
		parent.$digest();
		expect(child.aValueWas).toBe('abc');
	});

	// this.$root = this; в Scope
	// this.$root.$digest() в $apply

	it("digests from root on $apply", function() {
		var parent = new Scope();
		var child = parent.$new();
		var child2 = child.$new();
		parent.aValue = 'abc';
		parent.counter = 0;
		parent.$watch(
			function(scope) { return scope.aValue; },
			function(newValue, oldValue, scope) {
				scope.counter++;
			}
		);
		child2.$apply(function(scope) { });
		expect(parent.counter).toBe(1);
	});

	describe("[Isolated Scopes]", function() {
		it("does not have access to parent attributes when isolated", function() {
			var parent = new Scope();
			var child = parent.$new(true);
			parent.aValue = 'abc';
			expect(child.aValue).toBeUndefined();
		});

		it("cannot watch parent attributes when isolated", function() {
			var parent = new Scope();
			var child = parent.$new(true);
			parent.aValue = 'abc';
			child.$watch(
				function(scope) { return scope.aValue; },
				function(newValue, oldValue, scope) {
					scope.aValueWas = newValue;
				}
			);
			child.$digest();
			expect(child.aValueWas).toBeUndefined();
		});

	});
});


