
var xlsx = require('node-xlsx');
var fs = require('fs')
const _ = require('lodash')
var store = {};
var tasks = [];

module.exports = class {
    constructor(path) {
        this.path = path;

        if (store[this.path]) {
            console.log('store 缓存list')
            this.list = store[this.path].list;
        } else {
            this.init()
            this.list = this.getList();
            store[this.path] = {
                list: this.list
            };
        }

        this.generate = _.debounce(function () {
            var header = this.getMaxListHeader()
            let xlsxData = [
                header
            ];
            this.list.map(it => {
                xlsxData.push(Object.values(it))
            })

            const options = { '!cols': [{ wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 60 }, { wch: 60 }] };

            var buffer = xlsx.build([{ name: "mySheetName", data: xlsxData }], options);
            fs.writeFileSync(this.path, buffer)
            this.update()
        }, 0)
    }
    init() {
        this.sheets = xlsx.parse(this.path)
        this.defaultSheet = this.sheets[0].data;
        this.headers = this.defaultSheet.find((data, idx) => {
            if (data.indexOf('username') >= 0) {
                this.headerIdx = idx;
                return true;
            }
        })
    }
    update() {
        this.init()
    }
    getList() {
        var list = this.defaultSheet.reduce((pre, currentValue, idx) => {
            if (idx > this.headerIdx) {
                var temp = {};
                this.headers.map((key, index) => temp[key] = currentValue[index])
                if (temp.username) {
                    pre.push(temp)
                }
            }
            return pre;
        }, [])

        return list;
    }
    /**
     * 更新一条数据
     * @param {Object} query 
     * @param {Object} data 
     */
    updateOne(query, data) {
        tasks.push({
            arguments: Array.prototype.slice.call(arguments, 0),
            method: this._updateOne
        })
        this.executeTask()
    }
    /**
     * 执行任务队列
     */
    executeTask() {
        console.log(`当前xlsx 任务数:${tasks.length}`);

        if (!this.updateRun && tasks.length > 0) {
            this.updateRun = true;
            let task = tasks[0];
            task.method.apply(this, task.arguments)
            console.log('删除 xlsx task')
            tasks.splice(0, 1)
            this.executeTask()
        } else {
            this.updateRun = false;
        }
    }
    _updateOne(query, data) {
        var that = this.list.find(it => {
            return Object.keys(query).every(key => query[key] === it[key])
        })
        Object.keys(data).map(key => {
            that[key] = data[key];
        })
        this.generate()
    }
    find(query) {
        var out = this.list.filter(it => {
            return Object.keys(query).every(key => query[key] === it[key])
        })

        return out;
    }
    findOne(query) {
        var that = this.list.find(it => {
            return Object.keys(query).every(key => query[key] === it[key])
        })

        return that;
    }
    getMaxListHeader() {
        var max = this.list.reduce((pre, cur, idx) => {
            let len = Object.keys(cur).length;
            if (len > pre.len) {
                pre.idx = idx;
                pre.len = len;
            }
            return pre;
        }, { idx: 0, len: 0 })
        return Object.keys(this.list[max.idx])
    }
}