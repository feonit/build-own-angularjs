function Scope() {
	this.$$watchers = [];
	this.$$asyncQueue = [];
    this.$$applyAsyncQueue = [];
    this.$$applyAsyncId = null;
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
    this.$root.$$lastDirtyWatch = null;
    this.$beginPhase("$digest");

    if (this.$root.$$applyAsyncId) {
        clearTimeout(this.$root.$$applyAsyncId);
        this.$$flushApplyAsync();
    }

    do {
		while (this.$$asyncQueue.length) {
			try {
				var asyncTask = this.$$asyncQueue.shift();
                asyncTask.scope.$eval(asyncTask.expression);
			} catch (e) {
                console.error(e);
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
				self.$root.$digest();
			}
		}, 0);
	}
	self.$$asyncQueue.push({scope: self, expression: expr});
};

Scope.prototype.$$postDigest = function(fn) {
	this.$$postDigestQueue.push(fn);
};

/**
 * @param {Boolean} isolated - изолированная область или нет
 * @param {Scope?} parent - Иногда бывает полезно (когда?) прокинуть в новую область другой parent, сохраняя при этом обычную прототипную цепочку наследования
 * */
Scope.prototype.$new = function(isolated, parent) {
	var child;
    parent = parent || this;

    if (isolated) {
		child = new Scope();
        child.$root = parent.$root;
        child.$$asyncQueue = parent.$$asyncQueue;
        child.$$postDigestQueue = parent.$$postDigestQueue;
        child.$$applyAsyncQueue = parent.$$applyAsyncQueue;
    } else {
		var ChildScope = function() { };
		ChildScope.prototype = this;
		child = new ChildScope();
	}
    parent.$$children.push(child);
	child.$$watchers = [];
	child.$$children = [];
    child.$parent = parent; // когда уничтожается, сам удаляет себя из списка дочерних элементов родителя
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

Scope.prototype.$applyAsync = function(expr) {
    var self = this;
    self.$$applyAsyncQueue.push(function() {
        self.$eval(expr);
    });
    if (self.$root.$$applyAsyncId === null) {
        self.$root.$$applyAsyncId = setTimeout(function() {
            self.$apply(_.bind(self.$$flushApplyAsync, self));
        }, 0);
    }
};


Scope.prototype.$$flushApplyAsync = function() {
    while (this.$$applyAsyncQueue.length) {
        try {
            this.$$applyAsyncQueue.shift()();
        } catch (e) {
            console.error(e);
        }
    }
    this.$root.$$applyAsyncId = null;
};


Scope.prototype.$destroy = function() {
    if (this.$parent) {
        var siblings = this.$parent.$$children;
        var indexOfThis = siblings.indexOf(this);
        if (indexOfThis >= 0) {
            siblings.splice(indexOfThis, 1);
        }
    }
    this.$$watchers = null;
};
