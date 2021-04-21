import {formatDate, writeFile} from '../../utils';
import path from 'path';
import fs from 'fs';
import {e2eRecord2js} from './e2eTestCase2js.js';
import {exec, execSync} from 'child_process';
import e2eMockWxMethod from './e2eMockWxMethod';
import {diff as pyDiff} from '../imageSimilarity/index.js';
// -t 跑测试用例
// -s --screenshot 进行截屏比对
// --base 截屏作为expected基准，不对截屏进行比对
export default async function(cmd, wxaConfigs) {

    const sleep = t => new Promise(resolve => setTimeout(resolve, t));
    let testDir = path.join(process.cwd(), cmd.outDir);
    // --test=“xxx”指定用例，或--test默认执行outDir下所有用例
    // 要执行用例的目录名
    let testCaseNameArr = [];
    let stat = fs.lstatSync(testDir);
    // 不存在测试用例目录
    if (!stat.isDirectory()){
        throw new Error(`${testDir}非文件目录，请用--out-dir传入测试用例目录地址`)
    }
    if (typeof cmd.test === 'string') {
        testCaseNameArr = cmd.test.split(',');
    } else {
        let files = fs.readdirSync(testDir);
        files.forEach((item) => {
            if (item[0] === '.') {
                return;
            }
            let stat = fs.lstatSync(path.join(testDir, item));
            if (!stat.isDirectory()){
                return;
            }
            testCaseNameArr.push(item);
        })
    }
    // 开发者工具clipath
    let clipath = {
        darwin: '/Contents/MacOS/cli',
        win32: `/cli.bat`,
    };
    let {cliPath} = cmd;
    let cli = cliPath || path.join(wxaConfigs.wechatwebdevtools, clipath[process.platform]);

    // 截图目录
    let screenshotPath = '';
    if (cmd.base) {
        screenshotPath = 'base_screenshot';
    } else {
        let timeStamp = formatDate(+new Date());
        screenshotPath = timeStamp.replace(' ', '_').replace(/:/g, '.');
    }
    try {

        let screenshotDiff = cmd.screenshotDiff;
        if (typeof screenshotDiff === 'undefined') {
            if (!cmd.base && !cmd.record) {
                screenshotDiff = true;
            } else {
                screenshotDiff = false;
            }
        } else if (screenshotDiff === 'false'){
            screenshotDiff = false;
        }

        let recordString = await e2eRecord2js({
            cliPath: cli.split(path.sep).join('/'),
            testCaseNameArr: JSON.stringify(testCaseNameArr),
            testDir: testDir.split(path.sep).join('/'),
            screenshotPath,
            base: !!cmd.base,
            screenshotDiff: screenshotDiff,
            mockApi: cmd.mock,
            customExpect: !!cmd.customExpect,
            mockWxMethodConfig: e2eMockWxMethod.config
        });
        writeFile(path.join(testDir, '.cache', 'index.test.js'), recordString)
    } catch (err) {
        console.log(err);
        process.exit(-1);
    }


    try {
        execSync(`npx jest ${path.join(testDir, '.cache', 'index.test.js').split(path.sep).join('/')}`, {
            stdio: 'inherit'
        });
        if (cmd.pyDiff && !cmd.base && !cmd.record) {
            pyDiff(screenshotPath, testCaseNameArr)
        }
        process.exit(0);
    } catch(err) {
        process.exit(-1);
    }


}
