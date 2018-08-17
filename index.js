const puppeteer=require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const iPad = devices['iPad landscape'];//https://github.com/GoogleChrome/puppeteer/blob/master/DeviceDescriptors.js

const program = require('commander');

//定义一些命令
program
    .version('0.0.1')
    .option('-t, --top_10','show top 10')
    .parse(process.argv);

//记录结果，如果想写到数据库，自行对接即可
const log4js = require('log4js');
log4js.configure({
    appenders: { log: { type: 'file', filename: './log/log.log' } },
    categories: { default: { appenders: ['log'], level: 'info' } }
});
const logger = log4js.getLogger('log');

const ifOpenBrowser=false;
const lanchConf={
    headless:!ifOpenBrowser,
    // executablePath: 'C:/Users/xxx/Downloads/chromium/chrome-win32/chrome.exe',//mac用户自行查看文档更改
};

const sleep=(time)=>{
    return new Promise(resolve=>setTimeout(resolve,time))
};
async function repeat(time,fn,gapTime=500){
    if(time>0){
        // console.log('do fn',time);
        await fn();
        await sleep(gapTime);
        return repeat(--time,fn,gapTime)
    }
    // console.log('final');
    return {msg:'done'}
}

puppeteer.launch(lanchConf).then(async browser => {
    //打开一个新的页面
    const page = await browser.newPage();
    //更改浏览器外观,宽高等
    await page.emulate(iPad);
    //启用请求拦截
    await page.setRequestInterception(true);
    //拦截无用请求
    page.on('request', interceptedRequest => {
        //屏蔽后缀为.png或.jpg的请求；减少资源消耗
        if (interceptedRequest.url().match('.png') || interceptedRequest.url().match('.jpg')){
            interceptedRequest.continue();
        } else{
            interceptedRequest.continue();
        }
    });
    //跳转到我们的目标页面
    await page.goto('https://www.bilibili.com/ranking/all/0/0/3',{
        waitUntil:'networkidle0'//页面完全加载
    });

    // 图片实现了懒加载，页面需要滚动到底部,连续点击翻页键一定次数，否则图片地址可能不能拿到
    await repeat(20,async ()=>{
        await page.keyboard.press('PageDown',200);
    },200);

    //通过选择器找到目标
    const listHandle = await page.$('.rank-list');
    //处理子节点内容，难点在选择器的处理，部分反爬虫的页面不会提供一直不变的选择器
    const titles=await listHandle.$$eval('.info .title', nodes => nodes.map(n => n.innerText));
    const authors=await listHandle.$$eval('.detail>a>.data-box', nodes => nodes.map(n => n.innerText));
    const pts=await listHandle.$$eval('.pts div', nodes => nodes.map(n => n.innerText));
    const links=await listHandle.$$eval('.title', nodes => nodes.map(n => n.getAttribute('href')));
    const views=await listHandle.$$eval('.detail>.data-box', nodes => nodes.map(n => n.innerText));
    const images=await listHandle.$$eval('img', nodes => nodes.map(n => n.getAttribute('src')));

    //序列化结果
    const res=[];
    for(let i=0;i<100;i++){
        res[i]={
            rank:i+1,
            title:titles[i],
            author:authors[i],
            pts:pts[i],
            link:links[i],
            view:views[i],
            image:images[i]
        }
    }

    //根据命令行输出数据
    if (program.top_10) console.log(res.slice(0,10));
    //写入数据
    logger.info(res);
    //关闭浏览器
    await browser.close();
});