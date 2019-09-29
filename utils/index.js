const moment = require('moment')
const q = require('q')


// 获取时间段设置数据
exports.getTimeSetting = function (max) {
    var keys = Object.keys(max)
    var day = moment().format('HH') * 1

    var key = keys.find(k => {
        var arr = k.split('-')
        if (arr[0] <= day && day <= arr[1]) {
            return true
        } else {
            return false
        }
    })

    var keySplit = key.split('-');

    return {
        value: max[key],
        minTime: keySplit[0],
        maxTime: keySplit[1],
        diff: keySplit[1] - keySplit[0] + 1
    };
}

exports.sleep = function(time){
    let defer = q.defer()

    setTimeout(()=>{
        defer.resolve()
    },time)

    return defer.promise;
}