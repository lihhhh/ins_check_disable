var request = require('request-promise');
var users = require('./users')
var path = require('path')
var Agent = require('socks5-https-client/lib/Agent');
var Xlsx = require('./utils/xlsx.util')
var xl = new Xlsx(path.join(__dirname, './output_ca_0906_bak.xlsx'))

var j;


xl.find({ disable: 2 }).map(it => {
    xl.updateOne({ disable: 2 }, { disable: '' })
})
var defaultHeaders = {
    "x-instagram-ajax": "14d008e2bc7b",
};

var ins = [
    ["airmanicuredVunouf", "aicruVmouranfuedni"],
    ["quincetop", "ecniuotqp448303"],
    ["shiversomber", "esemhbirvros588300"],
    ["moverragged", "moverragged547235"],
    ["showamused", "shmadswoeu525977"],
    ["remakedigestive", "eimeiedkregtvsa457689"],
    ["advocateporous", "oraapedusctoov488297"],
    ["coonbeloved", "clebeodvnoo553420"],
    ["tequilacovered", "rcdtleqvaueieo054218"],
    ["dimefeudal", "fdeimadleu157100"],
    ["oafpackaged", "pfakacgaode187257"],
    ["yawnadoptive", "ovpidyawnate017103"],
    ["radicalwarped", "idpalrarwceda932269"],
    ["windpaved", "pwnidveda364539"],
    ["scabouter", "ecaubtsor848052"],
    ["salaryovert", "aorvelsatyr044925"],
    ["sewerleveraged", "sewgeevrleerad105473"],
    ["fatigueshaken", "sugitaekfhean939549"],
    ["duoreputed", "uporetdued170874"],
    ["hikerfrozen", "fhreoernzik742782"],
    ["tutorhumorous", "ruuouoromtths494388"],
    ["chimerabroke", "achbirmoekre285395"]
];

/**
 * 
 * @param {数组} arr 
 * @param {*} cb 
 */
function forNext(arr, cb, done) {
    let i = 0;
    let _deep = function () {
        if (i >= arr.length) return done();
        cb(arr[i], i, function () {
            i++;
            _deep()
        })
    }
    _deep()
}

function setCsrf() {
    var cookies = j._jar.toJSON().cookies;
    var csrftoken = cookies.find(it => it.key == 'csrftoken')
    defaultHeaders['x-csrftoken'] = csrftoken.value;
}


function start() {
    let i = 0;

    let _deep = function () {
        if (i >= ins.length) {
            console.log('账号登陆完毕')
            return ;
        };
        j = request.jar()

        let req = request.defaults({
            jar: j,
            rejectUnauthorized: false,//忽略证书验证
            // proxy: "http://127.0.0.1:8808",
            agentClass: Agent,
            strictSSL: true,
            agentOptions: {
                socksHost: '54.153.74.157',
                socksPort: 8808
            },
            headers: defaultHeaders
        })


        req({
            url: 'https://www.instagram.com/accounts/login/?source=auth_switcher',
            // url:'https://ip.cn'
        }, () => {
            setCsrf()
            if(!ins[i]) return ;
            let username  = ins[i][0];
            let password = ins[i][1];
            
            req({
                url: 'https://www.instagram.com/accounts/login/ajax/',
                method: 'post',
                headers: {
                    "content-type": "application/x-www-form-urlencoded"
                },
                form: {
                    username: username,
                    password: password,
                    // username: '632598678@qq.com',
                    // password: 'a18655556615',
                    enc_password: '',
                    queryParams: { "source": "auth_switcher" },
                    optIntoOneTap: false
                }
            }).then((body) => {
                body = JSON.parse(body)
                if (body.authenticated) {
                    console.log(`${username}登陆成功!`)
                    console.log(`当前登陆账号数:${i + 1}个`)
                    _deep()
                    searchStart(req)
                } else {
                    console.log(`${username}登陆失败!`)
                    _deep()
                }
                i++;
            }).catch(err => {
                console.log('登陆失败')
                i++;
                _deep()
            })
        })
    }

    _deep()
}

start()

function searchStart(req) {
    forNext(xl.list, function (it, idx, next) {
        if (it.disable == 0 || it.disable == 1 || it.disable == 2) {
            return next();
        }
        xl.updateOne({ username: it.username }, { disable: 2 })
        req({
            url: `https://www.instagram.com/web/search/topsearch/`,
            qs: {
                context: "blended",
                query: it.username,
                rank_token: Math.random() * 1,
                include_reel: true
            },
            json: true
        }).then(result => {
            console.log(`正在查询第${idx + 1}个...`)

            let reg = new RegExp(it.username, 'i')
            if (typeof result != 'object') throw '查询信息为空,程序可能异常!';
            if (result.users.some(it => reg.test(it.user.username))) {
                console.log(`${it.username}:================账号正常=============`)
                xl.updateOne({ username: it.username }, { disable: 0 })
            } else {
                xl.updateOne({ username: it.username }, { disable: 1 })
                console.log(`${it.username}:账号异常!!!`)
            }
            next()
        })
    }, function () {
        console.log('排查完毕!')
    })

}

