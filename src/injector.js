
function createInjector(modulesToLoad) {
    // результат регистрации компоенента приложения
    var cache = {};

    // запись модулей, которые уже были загружены, чтобы избежать рекурсивных вызовов, когда модули имеют круговые зависимости
    var loadedModules = {};

    // рекистрирует компоненты, для этого метод соответствует типу компонента приложения
    var $provide = {
        constant: function(key, value) {
            if (key === 'hasOwnProperty') {
                throw 'hasOwnProperty is not a valid constant name!';
            }
            cache[key] = value;
        }
    };

    // работа с инъекциями ($inject и др.типа) для функций
    /**
     * @param fn
     * @param self
     * @param {Object} locals на случай, если нужно переписать какой-то аргумент-инъекцию или он попросту еще не зарегистрирован инжектором
     * */
    function invoke(fn, self, locals) {
        var args = _.map(fn.$inject, function(token) {
            if (_.isString(token)) {
                return locals && locals.hasOwnProperty(token) ?
                    locals[token] :
                    cache[token];
            } else {
                throw 'Incorrect injection token! Expected a string, got '+token;
            }
        });
        return fn.apply(self, args);
    }

    // для каждой зависимости находится модуль, каждый из которых имеет собственные зависимости и очередь
    _.forEach(modulesToLoad, function loadModule(moduleName) {
        if (!loadedModules.hasOwnProperty(moduleName)) {
            loadedModules[moduleName] = true;

            var module = angular.module(moduleName);

            // пока что все равно, какой список первый requires или _invokeQueue
            _.forEach(module.requires, loadModule);
            _.forEach(module._invokeQueue, function (invokeArgs) {
                var method = invokeArgs[0];
                var args = invokeArgs[1];
                $provide[method].apply($provide, args);
            });
        }
    });

    return {
        has: function(key) {
            return cache.hasOwnProperty(key);
        },
        get: function(key) {
            return cache[key];
        },
        invoke: invoke
    };
}


