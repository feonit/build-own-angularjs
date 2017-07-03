function Scope() {
	this.$$watchers = [];
	this.$$asyncQueue = [];
	this.$$postDigestQueue = [];
	this.$$phase = null;
	this.$$lastDirtyWatch = null;
	this.$$children = [];
	this.$root = this;
}

Scope.prototype.$beginPhase = function(phase) {
	if (this.$$phase) {
		throw this.$$phase + ' already in progress.';
	}
	this.$$phase = phase;
};

Scope.prototype.$clearPhase = function() {
	this.$$phase = null;
};

Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
	var self = this;
	var watcher = {
		watchFn: watchFn,
		listenerFn: listenerFn || function() { },
		valueEq: !!valueEq
	};
	this.$$watchers.unshift(watcher);
	this.$$lastDirtyWatch = null;

	return function() {
		var index = self.$$watchers.indexOf(watcher);
		if (index >= 0) {
			self.$$watchers.splice(index, 1);
		}
	};
};

Scope.prototype.$$areEqual = function(newValue, oldValue, valueEq) {
	if (valueEq) {
		return _.isEqual(newValue, oldValue);
	} else {
		return newValue === oldValue ||
			(typeof newValue === 'number' && typeof oldValue === 'number' &&
			isNaN(newValue) && isNaN(oldValue));
	}
};

Scope.prototype.$$digestOnce = function() {
	var self = this;
	var continueLoop = true;
	var dirty;
	this.$$everyScope(function(scope) {
		var newValue, oldValue;
		_.forEachRight(scope.$$watchers, function(watcher) {
			try {
				if (watcher) {
					newValue = watcher.watchFn(scope);
					oldValue = watcher.last;
					if (!scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
						self.$$lastDirtyWatch = watcher;
						watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
						watcher.listenerFn(newValue, oldValue, scope);
						dirty = true;
					} else if (self.$$lastDirtyWatch === watcher) {
						continueLoop = false;
						return false;
					}
				}
			} catch (e) {
				console.error(e);
			}
		});
		return continueLoop;
	});
	return dirty;
};

Scope.prototype.$digest = function() {
	var ttl = 10;
	var dirty;
	this.$beginPhase("$digest");
	this.$$lastDirtyWatch = null;
	do {
		while (this.$$asyncQueue.length) {
			try {
				var asyncTask = this.$$asyncQueue.shift();
				this.$eval(asyncTask.expression);
			} catch (e) {
				(console.error || console.log)(e);
			}
		}
		dirty = this.$$digestOnce();
		if (dirty && !(ttl--)) {
			this.$clearPhase();
			throw "10 digest iterations reached";
		}
	} while (dirty);
	this.$clearPhase();

	while (this.$$postDigestQueue.length) {
		try {
			this.$$postDigestQueue.shift()();
		} catch (e) {
			(console.error || console.log)(e);
		}
	}
};

Scope.prototype.$eval = function(expr, locals) {
	return expr(this, locals);
};

Scope.prototype.$apply = function(expr) {
	try {
		this.$beginPhase("$apply");
		return this.$eval(expr);
	} finally {
		this.$clearPhase();
		this.$root.$digest();
	}
};

Scope.prototype.$evalAsync = function(expr) {
	var self = this;
	if (!self.$$phase && !self.$$asyncQueue.length) {
		setTimeout(function() {
			if (self.$$asyncQueue.length) {
				self.$digest();
			}
		}, 0);
	}
	self.$$asyncQueue.push({scope: self, expression: expr});
};

Scope.prototype.$$postDigest = function(fn) {
	this.$$postDigestQueue.push(fn);
};

Scope.prototype.$new = function(isolated) {
	var child;
	if (isolated) {
		child = new Scope();
	} else {
		var ChildScope = function() { };
		ChildScope.prototype = this;
		child = new ChildScope();
	}
	this.$$children.push(child);
	child.$$watchers = [];
	child.$$children = [];
	return child;
};

Scope.prototype.$$everyScope = function(fn) {
	if (fn(this)) {
		return this.$$children.every(function(child) {
			return child.$$everyScope(fn);
		});
	} else {
		return false;
	}
};