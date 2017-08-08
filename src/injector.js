


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
     * Запись модулей, которые уже были загружены (в текущем экземпляре инжектора),
     * чтобы избежать рекурсивных вызовов, когда модули имеют циркулярные зависимости
     * */
    var loadedModules = {};

    /**
     * Путь по зависимостям, используется для вывода информативной ошибки циркулярных зависимостей
     * */
    var path = [];
    /**
     * Методы регистрирации компонентов, каждый метод соответствует типу компонента приложения
     * */
    var $provide = {
        constant: function(key, value) {
            if (key === 'hasOwnProperty') {
                throw 'hasOwnProperty is not a valid constant name!';
            }
            // Constants are a special case in that we put a reference to them to both the provider and instance caches. Constants are available everywhere:
            providerCache[key] = value;
            instanceCache[key] = value;
        },
        provider: function(key, provider) {
            // чтобы отличать функцию конструктор от объекта {$get: function(){}}
            if (_.isFunction(provider)) {
                // таким разграничением достигается идеологическое условие, что только провайдеры имеют доступ к другим провайдерам
                provider = providerInjector.instantiate(provider);
            }
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
    /** Маркер, чтобы прдупредить циркулярные зависимости*/
    var INSTANTIATING = { };

    // provider injector works with the provider cache
    var providerInjector = createInternalInjector(providerCache, function() {
        //  Its fallback function will throw an exception letting the user know the dependency they’re looking for doesn’t exist
        throw 'Unknown provider: '+path.join(' <- ');
    });

    // The instance injector works with the instance cache
    // It falls back to a function that looks for a provider and uses it to construct the dependency
    var instanceInjector = createInternalInjector(instanceCache, function(name) {
        var provider = providerInjector.get(name + 'Provider');
        return instanceInjector.invoke(provider.$get, provider);
    });

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
     *
     * @param cache - Кеш для поиска зависимостей
     * @param factoryFn - Коллбек, когда нет ничего в кеше
     */
    function createInternalInjector(cache, factoryFn) {

        /**
         * Спобос получения компонента приложения из хранилища
         * */
        function getService(name) {
            if (cache.hasOwnProperty(name)) {
                if (cache[name] === INSTANTIATING) {
                    throw new Error('Circular dependency found: ' +
                        name + ' <- ' + path.join(' <- '));
                }
                return cache[name];
            } else {
                path.unshift(name);
                cache[name] = INSTANTIATING;
                try {
                    return (cache[name] = factoryFn(name));
                } finally {
                    path.shift();
                    if (cache[name] === INSTANTIATING) {
                        delete cache[name];
                    }
                }
            }
        }
        /**
         * Вызывает функцию, с поддержкой инжекции
         * @param {Function} fn - вызываемая функция
         * @param {Object} self? - опциональный контекст
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
         * Т.к. конструкторы без ключевого слова new ничего не возвращают, invoke так же ничего не вернет.
         * Метод возвращает экземпляр провайдера
         * */
        function instantiate(Type, locals) {
            // если объявленно ввиде массива, то сам конструктор будет именно последним
            var UnwrappedType = _.isArray(Type) ? _.last(Type) : Type;
            // главное не потерять прототип
            var instance = Object.create(UnwrappedType.prototype);

            // и имя конструктора (добавлю позже)
            // return new (Function.prototype.bind.apply(ctor, args))();
            invoke(Type, instance, locals);
            return instance;
        }

        return {
            has: function(name) {
                return cache.hasOwnProperty(name) ||
                    providerCache.hasOwnProperty(name + 'Provider');
            },
            get: getService,
            annotate: annotate,
            invoke: invoke,
            instantiate: instantiate
        }
    }

    // для каждой зависимости находится модуль, каждый из которых имеет собственные зависимости и очередь
    _.forEach(modulesToLoad, function loadModule(moduleName) {
        // модули, которые уже прошли процесс загрузки не нуждаются в этом повторно
        if (!loadedModules.hasOwnProperty(moduleName)) {
            loadedModules[moduleName] = true;

            // подули хранятся внутри angular
            var module = angular.module(moduleName);

            // пока что все равно, какой список первый requires или _invokeQueue
            _.forEach(module.requires, loadModule);
            // регистрация компонент текущего модуля
            _.forEach(module._invokeQueue, function (invokeArgs) {
                var method = invokeArgs[0];
                var args = invokeArgs[1];
                $provide[method].apply($provide, args);
            });
        }
    });

    // в итоге, инжектор с которым можно работать по API:
    return instanceInjector;
}


