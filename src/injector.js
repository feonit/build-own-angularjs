/**
 *
 * @param modulesToLoad
 * @param strictDi
 */
function createInjector(modulesToLoad, strictDi) {
    /**
     * Место хранения результатов регистрации компонента приложения
     * */
    var instanceCache = {};
    /**
     * Хранение провайдеров (тип компонента приложения) для последующего их инстанцирования
     * */
    var providerCache = {};
    /**
     * Запись модулей, которые уже были загружены, чтобы избежать рекурсивных вызовов, когда модули имеют круговые зависимости
     * */
    var loadedModules = {};
    /**
     * Методы регистрирации компонентов, каждый метод соответствует типу компонента приложения
     * */
    var $provide = {
        constant: function(key, value) {
            if (key === 'hasOwnProperty') {
                throw 'hasOwnProperty is not a valid constant name!';
            }
            instanceCache[key] = value;
        },
        provider: function(key, provider) {
            // чтобы отличать провайдер от его результата регистрации
            providerCache[key + 'Provider'] = provider;
        }
    };
    /** Получить список аргументов функции приведенной к строке */
    var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
    /** Обрезать пробельные символы плюс Underscore stripping */
    var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
    /** Удалить комментарии */
    var STRIP_COMMENTS = /(\/\/.*$)|(\/\*.*?\*\/)/mg;
    /**
     * Вызывает функцию, с поддержкой инжекции
     * @param fn
     * @param self
     * @param {Object} locals на случай, если нужно переписать какой-то аргумент-инъекцию или он попросту еще не зарегистрирован инжектором
     * */
    function invoke(fn, self, locals) {
        var args = _.map(annotate(fn), function(token) {
            if (_.isString(token)) {
                return locals && locals.hasOwnProperty(token) ?
                    locals[token] :
                    getService(token);
            } else {
                throw 'Incorrect injection token! Expected a string, got '+token;
            }
        });
        if (_.isArray(fn)) {
            fn = _.last(fn);
        }
        return fn.apply(self, args);
    }
    /**
     * Аннотирование функции, экспортировать имена зависимостей используя три разных метода
     * */
    function annotate(fn) {
        if (_.isArray(fn)) {
            return fn.slice(0, fn.length - 1);
        } else if (fn.$inject) {
            return fn.$inject;
        } else if (!fn.length) {
            return [];
        } else {
            // специальный режим, при котором не допускаются к обработке аргументы без явной аннотации
            if (strictDi) {
                throw 'fn is not using explicit annotation and '+
                'cannot be invoked in strict mode';
            }
            var source = fn.toString().replace(STRIP_COMMENTS, '');
            var argDeclaration = source.match(FN_ARGS);
            return _.map(argDeclaration[1].split(','), function(argName) {
                return argName.match(FN_ARG)[2];
            });
        }
    }
    /**
     * Т.к. конструкторы ничего не возвращают, invoke ничего не вернет, а должен вернуть
     * новый экземляр, для этих целей создан это метод
     * */
    function instantiate(Type, locals) {
        var UnwrappedType = _.isArray(Type) ? _.last(Type) : Type;
        // главное не потерять прототип
        var instance = Object.create(UnwrappedType.prototype);

        // и имя конструктора (добавлю позже)
        // return new (Function.prototype.bind.apply(ctor, args))();
        invoke(Type, instance, locals);
        return instance;
    }
    /**
     * Спобос получения компонента приложения из хранилища
     * */
    function getService(name) {
        if (instanceCache.hasOwnProperty(name)) {
            return instanceCache[name];
        } else if (providerCache.hasOwnProperty(name + 'Provider')) {
            var provider = providerCache[name + 'Provider'];
            return invoke(provider.$get, provider);
        }
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
            return instanceCache.hasOwnProperty(key) ||
                providerCache.hasOwnProperty(key + 'Provider');
        },
        get: getService,
        annotate: annotate,
        invoke: invoke,
        instantiate: instantiate
    };
}


