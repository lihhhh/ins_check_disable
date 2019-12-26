var path = require('path')
var Xlsx = require('./utils/xlsx.util')
var xl = new Xlsx(path.join(__dirname, './200k-user/ins.xlsx'))

const { IgApiClient } = require('instagram-private-api')
const Agent = require('socks5-https-client/lib/Agent');
const fs = require('fs')

const lodash = require('lodash')
const users = require('./users.json')
const async = require('async')
const request = require('request-promise')

xl.list.map(it => {
    if (it.runStatus == "2") {
        it.runStatus = '';
    }
})


var defaultHeaders = {
    "x-instagram-ajax": "14d008e2bc7b",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36"
};

function fakeSave(username, data) {
    if (typeof data != 'object') return;
    fs.writeFileSync(path.join(__dirname, './ins_state', username), JSON.stringify(data), 'utf-8')
    return data;
}

function fakeExists(username) {
    if (fs.existsSync(path.join(__dirname, './ins_state', username))) {
        let str = fakeLoad(username)
        try {
            JSON.parse(str)
        } catch (err) {
            return false;
        }
        return true;
    } else {
        return false;
    }
}

function fakeLoad(username) {
    console.log('-----<< get cookie')
    // here you would load the data
    return fs.readFileSync(path.join(__dirname, './ins_state', username), 'utf-8')
}

async function login(ig, user, update) {
    let _j = request.jar()

    let proxy;
    try {
        proxy = await request({
            url: "http://127.0.0.1:1088/v1/proxy?region=ap-southeast-2",
            json: true,
            timeout: 120 * 1000
        })
    } catch (err) {
        proxy = await request({
            url: "http://127.0.0.1:1088/v1/proxy?region=ap-southeast-2",
            json: true,
            timeout: 120 * 1000
        })
    }

    let agentOptions = {
        socksHost: proxy.result[0].ss_ip,
        socksPort: proxy.result[0].ss_port,
        username: user.username
    };
    let req = request.defaults({
        jar: _j,
        rejectUnauthorized: false,//忽略证书验证
        agentClass: Agent,
        strictSSL: true,
        pool: {},
        agentOptions: agentOptions,
        headers: defaultHeaders
    })

    ig.request.defaults.agentClass = Agent; // apply agent class to request library defaults
    ig.request.defaults.agentOptions = agentOptions;

    ig.request.defaults.pool = {};
    console.log(`当前操作用户:${user.username}`)
    ig.state.generateDevice(user.username);
    ig.request.end$.subscribe(async () => {
        console.log('----->> save cookie')
        const serialized = await ig.state.serialize();
        delete serialized.constants; // this deletes the version info, so you'll always use the version provided by the library
        fakeSave(user.username, serialized);
    });
    if (fakeExists(user.username) && !update) {//
        console.log("读取到上次登陆状态")

        await ig.state.deserialize(fakeLoad(user.username));

        await ig.user.searchExact("Jamestechnical")
    } else {
        console.log("开始登陆")
        if (!update) {
            await req({
                url: 'https://www.instagram.com/accounts/login/?source=auth_switcher'
            })
            let cookies = _j._jar.toJSON().cookies;
            let csrftoken = cookies.find(it => it.key == 'csrftoken')


            let json = await req({
                url: 'https://www.instagram.com/accounts/login/ajax/',
                method: 'post',
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    "x-csrftoken": csrftoken.value
                },
                json: true,
                form: {
                    username: user.username,
                    password: user.password,
                    enc_password: '',
                    queryParams: { "source": "auth_switcher" },
                    optIntoOneTap: false
                }
            })
            console.log('web登陆:', json)
            cookies = _j._jar.toJSON().cookies;
            let mid = cookies.find(it => it.key == 'mid')
            ig.state.cookieJar.setCookie(`mid=${mid.value}`, "https://i.instagram.com/")
        }


        await ig.simulate.preLoginFlow();
        let loginUser = await ig.account.login(user.username, user.password);
        // The same as preLoginFlow()
        // Optionally wrap it to process.nextTick so we dont need to wait ending of this bunch of requests
        process.nextTick(async () => await ig.simulate.postLoginFlow());
    }
}

function getTasks(num = 60) {
    let out = [];
    for (let i = 0; i < xl.list.length; i++) {
        if (out.length == num) {
            return out;
        }
        if (!xl.list[i].runStatus) {
            xl.list[i].runStatus = "2";
            xl.list[i].idx = i;
            out.push(xl.list[i])
        }
    }
    return out;
}



async function start(user) {
    const ig = new IgApiClient();
    try {
        await login(ig, user)
    } catch (e) {
        await login(ig, user, true)
    }

    let q = async.queue(async (it) => {
        console.log(`正在查询 ${it.idx}----总 ${xl.list.length}`)
        delete it.idx;
        let userData = await ig.user.searchExact(it.username)
        let info = await ig.user.info(userData.pk)

        xl.updateOne({ username: it.username }, {
            follower_count: info.follower_count,
            following_count: info.following_count,
            contact_phone_number: info.contact_phone_number,
            city_name: info.city_name,
            category: info.category,
            public_phone_country_code: info.public_phone_country_code,
            public_phone_number: info.public_phone_number,
            public_email: info.public_email,
            runStatus: 1
        })
    }, 5)

    q.push(getTasks())
    q.drain(async () => {
        await login(ig, user)
        let tasks = getTasks();
        if (tasks.length == 0) return;
        q.push(getTasks())
    })
}

users.map(user => {
    start(user)
})

