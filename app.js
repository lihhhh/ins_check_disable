var request = require('request-promise');
var users = require('./users')
var path = require('path')
var Agent = require('socks5-https-client/lib/Agent');
var Xlsx = require('./utils/xlsx.util')
var xl = new Xlsx(path.join(__dirname, './output1226.xlsx'))

var j;


xl.find({ disable: 2 }).map(it => {
    xl.updateOne({ disable: 2 }, { disable: '' })
})
var defaultHeaders = {
    "x-instagram-ajax": "14d008e2bc7b",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36"
};

var ins = [
    ["mortalconscientiousOivauc", "trtomuvesiOincicauosnocal"],
    ["runereformistIanehucux", "recotexhunurrsInfaeumi"],
    ["summarysmokelessUkomashu", "yaUkeloasemomrmmsuukshss"],
    ["leavingconspicuousRoki", "vaisokicipseluguoonncR"],
    ["welterweightsharpOjob", "ewprjeotghsitrlawheOb"],
    ["thermostatkindlyIssaapu", "ydataplnoutItisrmashesk"],
    ["prognosisraisedEtrakiup", "ppooiisnksrgutiEraaersd"],
    ["footingmanipulativePrukeskemi", "opltveiiakiseonftnmugmrPiaeuk"],
    ["hospitaltediousJelig", "puiislogotsihaJldeet"],
    ["snowshoedwindlingOasceduvo", "iwssuovOohdncnenlddgeiaswo"],
    ["reincarnationricketyGratiusuwi", "receiaitnrttGuyncsnikriiraaouw"]
];



function setCsrf() {
    var cookies = j._jar.toJSON().cookies;
    var csrftoken = cookies.find(it => it.key == 'csrftoken')
    defaultHeaders['x-csrftoken'] = csrftoken.value;
}


function start() {
    let i = 0;
    let userNum = 0;

    let _deep = function () {
        if (i >= ins.length) {
            console.log('账号登陆完毕')
            return;
        };
        j = request.jar()

        let req = request.defaults({
            jar: j,
            rejectUnauthorized: false,//忽略证书验证
            // proxy: "http://127.0.0.1:8808",
            agentClass: Agent,
            strictSSL: true,
            agentOptions: {
                socksHost: '35.158.221.84',
                socksPort: 8808
            },
            headers: defaultHeaders
        })


        req({
            url: 'https://www.instagram.com/accounts/login/?source=auth_switcher',
            // url:'https://baidu.com'
        }, (err,res,body) => {
            setCsrf()
            if (!ins[i]) return;
            let username = ins[i][0];
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
                    userNum++
                    console.log(`当前登陆账号数:${userNum}个`)
                    searchStart(req)
                    _deep()
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


/**
 * 
 * @param {数组} arr 
 * @param {Function} cb 
 * @param {Function} done 完成回调
 */
function forNext(arr, cb, done) {
    let i = 0;
    let _deep = function () {
        if (i >= arr.length) return done();
        cb(arr[i], i, function () {
            i++;
            Promise.resolve().then(() => {
                _deep()
            })
        })
    }
    _deep()
}

function searchStart(req) {
    forNext(xl.list, function (it, idx, next) {
        if (it.disable == 0 || it.disable == 1 || it.disable == 2) {
            next()
            return;
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

