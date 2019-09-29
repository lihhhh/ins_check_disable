
var fs = require('fs')
var path = require('path')
const _ = require('lodash')


/**
* 设置全局变量
*/
exports.setGlobalConf = function (config) {
    console.log('INS_CONFIG_PATH', config)
    if (process.platform == 'linux') {
        if (!config) throw '请指定 ins.run.config.json 文件路径!';

    } else {
        config = config || path.join(__dirname, '../ins.run.config.json');
    }



    global.INS_CONFIG_PATH = config;

    global.INS_CONFIG = JSON.parse(fs.readFileSync(config, 'utf-8'))

    setInsConfig(global.INS_CONFIG)
}

// 获取配置文件
function setInsConfig(_config) {
    var out = {
        "goto_timeout": 1000 * 10,//默认值
        "inputXlsxPath": path.join(__dirname, '../output.xlsx'),
        ..._config//覆盖默认值
    };

    let _deep = function (_data) {
        let _out = _.transform(_data, function (result, curr, key) {
            if (typeof curr === 'string' && /^\d+~\d+$/.test(curr)) {
                let _arr = curr.split('~')
                let _c = _arr[1] * 1 - _arr[0] * 1;
                curr = Math.floor(Math.random() * _c + _arr[0] * 1);
            } else if (typeof curr === 'string' && /^\!\d+~\d+$/.test(curr)) {
                curr = curr.replace('!', '')
                let _arr = curr.split('~')
                let _c = _arr[1] * 1 - _arr[0] * 1;
                Object.defineProperty(result, key, {
                    get() {
                        return Math.floor(Math.random() * _c + _arr[0] * 1);
                    }
                })
            }
            if (typeof curr == 'object') {
                curr = _deep(curr)
            }
            result[key] = curr;
        })

        return _out;
    }

    if (process.platform == 'darwin') {
        out.absolutePath = out.absolutePath['mac'];
    } else if (process.platform == 'linux') {
        out.absolutePath = out.absolutePath['linux'];
    } else {
        out.absolutePath = out.absolutePath['win'];
    }

    out = _deep(out)


    global.CONF = out;

    return out;
}