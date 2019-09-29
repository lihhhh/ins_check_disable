var path = require('path')
var config = global.CONF;
var log4js = require('log4js');
var _logger = log4js.getLogger();

log4js.configure({
    appenders: {
        cheese: {
            type: "dateFile",
            pattern: "yyyy-MM-dd.log",
            alwaysIncludePattern: true,
            filename: path.join(config.absolutePath, config.logPath)
        },
        console: {
            type: "console"
        }
    },
    categories: {
        default: {
            appenders: ['cheese','console'],
            level: 'info'
        }
    },
    pm2: true,
});


// logger.trace('Entering cheese testing');
// logger.debug('Got cheese.');
// logger.info('Cheese is Comté.');
// logger.warn('Cheese is quite smelly.');
// logger.error('Cheese is too ripe!');
// logger.fatal('Cheese was breeding ground for listeria.');

global.logger = _logger;
global.getLogger = function(index){
    return function(){
        var message = Array.prototype.slice.call(arguments,1);
        message.unshift(`process:[${index}]>>>>>>>`)
        _logger[arguments[0]].apply(_logger,message)
    }
}