const q = require('q')
const fs = require('fs')
const request = require('request')
const UserAgent = require('user-agents');
const Xlsx = require('./xlsx.util')
const _ = require('lodash')
const path = require('path')
const { parse } = require('useragent');
const devices = require('../libs/DeviceDescriptors');
const prettier = require("prettier");

const moment = require("moment");
const aws = require('../aws_libs/index')

global.INSTANCES_ERR = {};

module.exports = class {
    constructor(parentThis) {
        this.xlsx = new Xlsx(global.CONF.inputXlsxPath);
        this.loginState = null;
        let langs = JSON.parse(parentThis.data.langs);

        parentThis.data.language = langs.splice(0, 1).join('');

        var endStr = langs.reduce((pre, currt, idx) => {
            pre.push(currt + ';q=' + (10 - idx - 1) / 10);
            return pre;
        }, [])


        parentThis.data.acceptLanguage = parentThis.data.language + ',' + endStr.join(',');

        Object.keys(parentThis).map(k => {
            let data = parentThis[k]
            Object.defineProperty(this, k, {
                get: function () {
                    return data;
                }
            })
        })
        let owns = Object.getOwnPropertyNames(this.page).concat(Object.getOwnPropertyNames(this.page.__proto__))
        try {
            owns.map(it => {
                if (!(it in this)) {
                    Object.defineProperty(this, it, {
                        get() {
                            return this.page[it];
                        }
                    })
                }
            })
        } catch (err) {
            debugger
        }
    }
    findDevice() {
        return devices.find(it => it.name == this.data.device)
    }
    /**
     * 
     * 滚动到底部
     */
    async autoScroll() {
        await this.page.mouse.move(100, 400);
        await this.page.mouse.down();

        await this.page.mouse.move(100, 100, { steps: 25 });
        await this.page.mouse.up();
    }
    getUserAgent() {
        let _ua = new UserAgent({ deviceCategory: 'mobile' })

        return _ua.toString();
    }
    async init() {
        // 设置资源拦截
        await this.requestAbortResources()
        // await this.responseResources()
        // // 设置视窗大小
        // await this.page.setViewport({
        //     width: 375,
        //     height: 667,
        //     isMobile: true,
        //     hasTouch: true,
        //     deviceScaleFactor: 2
        // });

        await this.page.setUserAgent(this.data.userAgent)
        this.logger('info',`${this.data.username}[ua]==> ${this.data.userAgent}`)

        // 设置header 语言请求头
        await this.page.setExtraHTTPHeaders({
            'Accept-Language': `${this.data.acceptLanguage}`,
            // "accept-encoding": "gzip, deflate, br",
            // "origin": "https://www.instagram.com"
        });

        // 页面domcontentloaded事件 监听验证手机号页面
        this.page.on('domcontentloaded', async () => {
            var now_url = await this.page.url()

            if (/challenge/.test(now_url)) {
                if (global.INSTANCES_ERR[this.data.INSTANCE_ID]) {
                    let insErrList = global.INSTANCES_ERR[this.data.INSTANCE_ID];

                    if (!(insErrList.some(it => it.username == this.data.username))) {
                        insErrList.push({
                            username: this.data.username,
                            challengeTime: moment()
                        })


                        insErrList = insErrList.filter(it => it.challengeTime.isAfter(moment().add(-5, 'm')))

                        this.logger('info',`当前错误个数 ${insErrList.length}个`)
                        if (insErrList.length > 2) {
                            this.logger('info','停止实例')
                            this.xlsx.find({ INSTANCE_ID: this.data.INSTANCE_ID }).forEach(it => {
                                this.xlsx.updateOne({ username: this.data.username }, {
                                    INSTANCE_ID: '',//清空实例绑定
                                    wakeUpTime: moment().add(global.CONF.verify_sleep_time, 'minute').format('YYYY-MM-DD HH:mm:ss')
                                })
                            })
                            new aws.Aws(this.data.INSTANCE_ID).stopInstance()
                        }
                    }
                } else {
                    global.INSTANCES_ERR[this.data.INSTANCE_ID] = [];
                    global.INSTANCES_ERR[this.data.INSTANCE_ID].push({
                        username: this.data.username,
                        challengeTime: moment()
                    })
                }


                let err = '';
                var idEmail = await this.page.$('#id_email')

                this.xlsx.updateOne({
                    username: this.data.username
                }, {
                    active: 0
                })

                if (idEmail) {
                    err = `${this.data.username}:检测需要验证邮箱`;
                } else {
                    err = `${this.data.username}:检测需要验证手机号`;
                }
                this.logger('error',err)
                this.data.lockTask = true;

                throw err
            }
        })

        const ua = parse(this.data.userAgent);
        // 页面注入js 修改navigator信息
        await this.page.evaluateOnNewDocument(function ({ userAgent, language, platform, languages, vendor, gpu, hardwareConcurrency }) {
            var rts = [
                'top',
                'location',
                'window',
                'document',
                'chrome',
                'webkitStorageInfo'
            ];
            var udf = {
                WebSocket: undefined,
                credentials: undefined,
                pageXOffset: Math.floor(Math.random() * 20),
                pageYOffset: Math.floor(Math.random() * 20),
                IntersectionObserver: undefined,//提供了一种异步观察目标元素与其祖先元素或顶级文档视窗(viewport)交叉状态的方法
                getSelection: undefined,//
            };

            for (let k in udf) {
                Object.defineProperty(window, k, {
                    get() {
                        console.log('get:', k)
                        return udf[k];
                    }
                })
            }
            // Object.keys(window).map(key => {
            //     if (rts.indexOf(key) >= 0) return;
            //     var vl = window[key];

            //     Object.defineProperty(window, key, {
            //         get() {
            //             console.log(key)
            //             if (key == 'requestIdleCallback') return undefined;
            //             return vl;
            //         }
            //     })
            // })


            window.navigator.chrome = {
                runtime: {}
            };
            console.log('languages', languages)
            // Date.prototype.getTimezoneOffset = function () {
            //     return -Math.floor(Math.random() * 100 + 300);
            // }
            delete navigator.__proto__.webdriver;


            console.log('hahahahh')
            // Object.defineProperty(window,'navigator',{
            //     get(){
            //         return {};
            //     }
            // })

            for (let k in navigator) {
                let value = navigator[k];
                Object.defineProperty(navigator, k, {
                    get: function () {
                        console.log(k)
                        if (k == 'userAgent') {
                            return userAgent;
                        } else if (k == 'language') {
                            return language;
                        } else if (k == 'languages') {
                            return languages;
                        } else if (k == 'plugins') {
                            return [{
                                description: "Portable Document Format",
                                filename: "internal-pdf-viewer",
                                length: 1,
                                name: "Chrome PDF Plugin"
                            }, {
                                description: "",
                                filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
                                length: 1,
                                name: "Chrome PDF Viewer"
                            }, {
                                description: "",
                                filename: "internal-nacl-plugin",
                                length: 2,
                                name: "Native Client"
                            }];
                        } else if (k == 'platform') {
                            return platform;
                        } else if (k == 'hardwareConcurrency') {
                            return hardwareConcurrency;
                        }

                        return value;
                    }
                })
            }

            console.log('navigator修改完毕')

            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
            WebGLRenderingContext.prototype.getParameter = function (num) {
                if (num == 37446) {
                    return gpu;
                } else if (num == 37445) {
                    return vendor;
                }
            }
        }, {
            userAgent: this.data.userAgent,
            language: this.data.language,
            platform: ua.os.family,
            languages: this.data.acceptLanguage.split(/;|,/).filter(it => !/q\=\d\.\d/.test(it)),
            vendor: this.findDevice().viewport.vendor,
            gpu: this.findDevice().viewport.gpu,
            hardwareConcurrency: this.data.hardwareConcurrency
        })

        return '';
    }
    /**
     * 检测登陆状态
     */
    checkLogin() {
        return this.page.evaluate(() => {
            let loginState = true;
            document.querySelectorAll('a').forEach(el => {
                if (el.href.indexOf('accounts/login') >= 0) {
                    loginState = false
                }
            })
            return loginState;
        })
    }
    async responseResources() {
        // 监听请求返回
        this.page.on('response', async (res) => {
            // 注册结果检测
            if (/graphql\/query/.test(res._url)) {
                var json = await res.json();
            }
        })
        return;
    }
    async requestAbortResources() {
        await this.page.setRequestInterception(true);
        this.page.on('request', (req) => {
            // if (req._url.indexOf('batch_fetch_web') >= 0) {
            //     req.abort();
            // } else if (req._url.indexOf('logging') >= 0) {
            //     req.abort();
            // } else if (req._url.indexOf('ajax/bz') >= 0) {
            //     req.abort();
            // } else 
            // req.resourceType() === 'image' || 
            if (req.resourceType() === 'font') {
                req.abort();
            } else if (req._url.indexOf('facebook') >= 0) {
                req.abort();
            } else {
                req.continue();
            }
        });

        return '';
    }
    /**
     * 页面随机点
     * @param {Array} range 随机范围  [[矩形x,矩形y],[width,height]]
     * 
     */
    randomClick(range = [[420, 0], [250, 800]]) {
        var _width = range[1][0];
        var _height = range[1][1];

        var _clickX = Math.random() * _width + range[0][0];
        var _clickY = Math.random() * _height + range[0][1];

        this.logger('info',`鼠标点击:[${_clickX},${_clickY}]`)

        return this.page.mouse.click(_clickX, _clickY)
    }
    /**
     * 定时点击
     */
    intervalRandomClick() {
        let _deep = () => {
            this.clickIntervalTimer = setTimeout(async () => {
                this.logger('info','随机点击')
                await this.randomClick()
                _deep()
            }, Math.random() * 1000 * 15)
        }
        _deep()

        setTimeout(() => {
            // 为了预防 程序错误 没有清除定时器造成内存泄露, 30s后自动清除定时
            this.clearIntervalRandomClick()
        }, 1000 * 30)
    }
    clearIntervalRandomClick() {
        this.logger('warn','清除click定时器')
        clearTimeout(this.clickIntervalTimer)
    }
    async login() {
        let ranTime = this.getRanTime();
        this.logger('warn',`账号[${this.data.username}],程序将在${ranTime}ms后进行自动登陆`)
        await this.page.waitFor(ranTime)
        await this.page.goto(`https://www.instagram.com/accounts/login/`)
        let attr = await this.findInnerText('Remove Account', 'button')
        if (attr) {
            this.logger('info','发现历史记录有登陆信息,删除')
            await this.page.tap(attr)
            let rm = await this.findInnerText('Remove')
            await this.page.waitFor(1000)
            await this.page.tap(rm)
        }
        await this.page.waitForSelector('input[name=username]')
        this.logger('info','输入用户名...')
        await this.randomType('input[name=username]', this.data.username)
        this.logger('info','输入密码...')
        await this.randomType('input[name=password]', this.data.password)
        await this.page.waitFor(this.getRanTime())
        this.logger('info','点击登陆按钮...')

        try {
            await Promise.all([
                // The promise resolves after navigation has finished
                this.page.tap('button[type=submit]'), // 点击该链接将间接导致导航(跳转)
                this.page.waitForNavigation({
                    timeout: 1000 * 30
                })
            ]);
        } catch (err) {
            await this.page.goto(`https://www.instagram.com/${this.data.username}`)
        }

        await this.page.waitFor(1000 * 5)

        var tapTg = await this.findInnerText('Not Now')

        let section = await this.page.$(tapTg)
        if (section) {
            this.logger('warn','发现询问是否报错登陆信息弹框,点击确认')
            await this.page.tap('section [type=button]')
        }


        this.logger('warn','自动登陆成功!!')
    }
    getRanTime(ran = 3000, add = 2000) {
        return Math.random() * ran + add;
    }
    async randomType(selector, value) {

        await this.page.click(selector, { clickCount: 3 })

        await this.page.waitFor(this.getRanTime())

        for (let i = 0; i < value.length; i++) {
            await this.page.type(selector, value[i], {
                delay: Math.random() * 100 + 20
            })
        }

        await this.randomClick()

        return '';
    }
    async findHrefClick(href, eq) {
        let tg = await this.page.evaluate((href, eq) => {
            document.querySelectorAll('a').forEach(el => {
                if (eq) {
                    if (el.getAttribute('href') == href) {
                        el.setAttribute('a-target', '')
                    }
                } else {
                    if (el.getAttribute('href').indexOf(href) >= 0) {
                        el.setAttribute('a-target', '')
                    }
                }

            })
            return 'a-target';
        }, href, eq)

        await this.page.tap(`[${tg}]`)

        return;
    }
    browserClose() {
        setTimeout(() => {
            this.browser.close();
        }, 1000 * 60 * 2)
    }
    async tapAfterBlocked(selector) {
        await this.page.tap(selector)
        let dialog = await this.page.$('[role="dialog"]')
        return !!dialog;
    }
    async findInnerText(text, selector = "*") {
        let tg = await this.page.evaluate((selector, text) => {
            let attr = "attr-" + new Date().getTime();
            let out = '';
            document.querySelectorAll(selector).forEach(el => {
                if (el.innerText == text) {
                    el.setAttribute(attr, '')
                    out = attr;
                }
            })
            return out;
        }, selector, text)

        return tg ? `[${tg}]` : '';
    }
    async findAttrAll(selector, attr) {
        var out = await this.page.evaluate((selector, attr) => {
            var list = [];
            document.querySelectorAll(selector).forEach(el => {
                let temp = el.getAttribute(attr);
                if (temp) list.push(temp)
            })
            return list
        }, selector, attr)

        out = out.filter(it => /^\//.test(it))
        return out;
    }
    goto(url, max = 5) {
        var defer = q.defer()

        let i = 0;
        let _deep = async () => {
            try {
                let timeout = global.CONF.goto_timeout + Math.random() * 5000;
                this.logger('info',`goto 超时时间: ${timeout}`)
                await this.page.goto(url, {
                    timeout
                })
                if (url.indexOf('accounts/login') == -1) {
                    // 非登陆页一律检测登陆状态
                    var state = await this.checkLogin()

                    if (state === false) {
                        await this.login()
                    }
                }

            } catch (err) {
                if (err.message.indexOf('Session closed') >= 0) {
                    this.logger('error','浏览器已关闭')
                    return defer.reject('浏览器已关闭')
                }
                this.logger('error', `进入${url}页面超时,正在进行第${i + 1}次重连`)
                i++
                if (i < max) {
                    return _deep()
                } else {
                    return defer.reject('重连次数过多,跳过')
                }
            }
            defer.resolve()
        }
        _deep()

        return defer.promise;
    }
}