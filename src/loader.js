function setupModuleLoader(window) {
    var ensure = function(obj, name, factory) {
        return obj[name] || (obj[name] = factory());
    };
    var angular = ensure(window, 'angular', Object);

    var createModule = function(name, requires, modules) {
        if (name === 'hasOwnProperty') {
            throw 'hasOwnProperty is not a valid module name';
        }
        // Данные необходимые для создания очереди вызовов регистраций компонентов
        // Представляют собой массив массивов:
        // первый элемент подмассива - имя типа компонента
        // второй элемент подмассива - аргументы для вызова регистрации компонента
        // [
        //     ['constant', ['aConstant', 42]]
        // ]
        var invokeQueue = [];

        /**
         * Функция предварительно конфигурирует метод создания определенного типа компонента приложения
         * */
        var invokeLater = function(method, arrayMethod) {
            return function() {
                // данные о компоненте отправляются в очередь на регистрацию
                // в очереди константы попадают первыми, чтобы провайдеры могли ими пользоваться
                invokeQueue[arrayMethod || 'push']([method, arguments]);
                // для обеспечения возможности цепочки вызовов
                return moduleInstance;
            };
        };

        var moduleInstance = {
            name: name,
            requires: requires,
            constant: invokeLater('constant', 'unshift'),
            provider: invokeLater('provider'),
            _invokeQueue: invokeQueue
        };
        modules[name] = moduleInstance;
        return moduleInstance;
    };

    var getModule = function(name, modules) {
        if (modules.hasOwnProperty(name)) {
            return modules[name];
        } else {
            throw 'Module '+name+' is not available!';
        }
    };

    // создает метод ангуляра для получения/регистрации модуля в зависимости от отсутствия/присутствия зависимостей
    ensure(angular, 'module', function() {
        // хранит все модули в ангуляре
        var modules = {};
        return function(name, requires) {
            if (requires) {
                return createModule(name, requires, modules);
            } else {
                return getModule(name, modules);
            }
        };
    });
}
