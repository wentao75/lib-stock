import {
    getDataRoot,
    readStockList,
    readStockData,
    stockDataNames,
} from "@wt/lib-wtda-query";

import moment from "moment";
import _ from "lodash";
import debugpkg from "debug";

import utils from "./indicators/utils";

import { formatFxstr } from "./util";

import engine from "./transaction-engine";
import trans from "./transaction";

const path = require("path");
const fs = require("fs");
const fp = fs.promises;

const log = console.log;
const debug = debugpkg("search");

function showOptionsInfo(options) {
    console.log(
        `测试数据周期: ${options.startDate}

模型：${options.match.rule}

${options.match.rule.showOptions(options)}
`
    );
}

async function search(options) {
    // 显示目前的配置模拟信息
    showOptionsInfo(options);

    // 首先根据设置获得列表，列表内容为需要进行算法计算的各个股票
    let stockListData = await readStockList();
    if (!stockListData || !stockListData.data) {
        log(`没有读取到股票列表，无法处理日线数据`);
        return;
    }
    let stockList = stockListData.data;
    // 重新过滤可用的
    stockList = await filterStockList(stockList, options);
    log(`算法执行 ${stockList && stockList.length} 条数据`);

    log("");

    let foundSignals = {};
    // 下一步开始按照给出的数据循环进行处理
    for (let stockItem of stockList) {
        // this.log(`处理数据：%o`, stockItem);
        if (stockItem.name.match("ST")) {
            continue;
        }

        // 首先读取日线信息
        let stockData = await readStockData(
            stockDataNames.daily,
            stockItem.ts_code
        );

        if (stockData) {
            debug(
                `[${stockItem.ts_code}]${
                    stockItem.name
                } 【数据更新时间：${moment(stockData.updateTime).format(
                    "YYYY-MM-DD HH:mm"
                )}】`
            );

            // 首先过滤历史数据，这里将日线数据调整为正常日期从历史到现在
            stockData = await prepareStockData(stockData, options);

            // 全部数据调整为前复权后再执行计算
            calculatePrevAdjPrice(stockData);

            let rule = options && options.match && options.match.rule;
            debug(`执行算法！${stockData.data.length - 1}`);
            let matched = rule.check(
                stockData.data.length - 1,
                stockData.data,
                options,
                stockItem.ts_code
            );
            if (matched && matched.hasSignals) {
                log(
                    `**  [${stockItem.ts_code}]${stockItem.name} 信号:${matched.tradeType} ${matched.memo}, ${matched.days}`
                );
                let signal = matched.signal;
                if (signal) {
                    if (signal in foundSignals) {
                        foundSignals[signal].push(matched);
                    } else {
                        foundSignals[signal] = [matched];
                    }
                }
            }
        }
    }

    let report = options && options.match && options.match.report;
    let reports = await report.createReports(foundSignals, options);
    await saveReports(reports);

    for (let item in foundSignals) {
        let list = foundSignals[item];
        log(`*** 信号类型：${item}，共发现${list && list.length} ***`);
        // for (let code of list) {
        //     log(`  "${code}",`);
        // }
    }

    let buyList = reports && reports.squeeze && reports.squeeze.buyList;
    let readyList = reports && reports.squeeze && reports.squeeze.readyList;
    let boundaries = [
        "1天",
        "2天",
        "3天",
        "6天内",
        "12天内",
        "21天内",
        "34天内",
        "超过34天",
    ];
    for (let i = 0; i < boundaries.length; i++) {
        log(
            `** 买入信号【${boundaries[i]}】： ${buyList && buyList[i].length}`
        );
    }
    for (let i = 0; i < boundaries.length; i++) {
        log(
            `** 准备信号【${boundaries[i]}】： ${
                readyList && readyList[i].length
            }`
        );
    }
}

function getReportsFile() {
    return path.join(getDataRoot(), "reports.json");
}

async function saveReports(data) {
    try {
        let jsonStr = JSON.stringify(data);
        let filePath = getReportsFile();

        await fp.writeFile(filePath, jsonStr, { encoding: "utf-8" });
    } catch (error) {
        throw new Error("保存报告数据时出现错误，请检查后重新执行：" + error);
    }
}

async function readReports() {
    let retData = {
        updateTime: null,
    };

    try {
        let dataFile = getReportsFile();
        try {
            retData = JSON.parse(await fp.readFile(dataFile, "utf-8"));
        } catch (error) {
            // 文件不存在，不考虑其它错误
            if (!(error && error.code === "ENOENT")) {
                console.error(
                    `读取报告文件${dataFile}时发生错误：${error}, %o`,
                    error
                );
            } else {
                console.error(`读取报告文件${dataFile}不存在，%o`, error);
            }
        }
    } catch (error) {
        console.error(`从本地读取报告数据发生错误 ${error}`);
    }
    return retData;
}

/**
 * 将日线数据中的历史价位根据复权因子全部处理为前复权结果，方便后续计算
 *
 * @param {*} dailyData 日线数据
 * @param {int} digits 保留位数
 */
function calculatePrevAdjPrice(dailyData, digits = 2) {
    if (dailyData && dailyData.data && dailyData.data.length > 0) {
        dailyData.data.forEach((item) => {
            if (item.prevadj_factor) {
                item.open = Number(
                    (item.open * item.prevadj_factor).toFixed(digits)
                );
                item.close = Number(
                    (item.close * item.prevadj_factor).toFixed(digits)
                );
                item.high = Number(
                    (item.high * item.prevadj_factor).toFixed(digits)
                );
                item.low = Number(
                    (item.low * item.prevadj_factor).toFixed(digits)
                );
                item.pre_close = Number(
                    (item.pre_close * item.prevadj_factor).toFixed(digits)
                );
                item.change = Number(
                    (item.change * item.prevadj_factor).toFixed(digits)
                );
            }
        });
    }
}

/**
 * 这里定义一个过滤列表的接口方法，利用options来过滤后续使用的股票
 * 返回为一个符合条件的列表
 * 这里后续考虑调整一下接口定义，目前暂时简化处理
 */
async function filterStockList(stockList, options) {
    if (options.all) return stockList;
    // let retStockList = [];
    return options.selectedStocks.map((tsCode) => {
        let tmp = stockList.filter((item) => {
            return item.ts_code === tsCode;
        });
        // console.log(`${tmp && tmp.length}, %o`, tmp[0]);
        return tmp[0];
    });
}

/**
 * 这里提供对单个数据的调整，主要应当是一些额外的数据计算添加，周期过滤等
 *
 * @param {*} stockData 股票日线数据对象
 * @param {*} options 数据过滤条件
 */
async function prepareStockData(stockData, options) {
    utils.checkTradeData(stockData.data);

    if (stockData && stockData.data && stockData.data.length > 0) {
        if (stockData.data[0].trade_date < options.startDate) {
            let index = stockData.data.findIndex((data, i) => {
                return data.trade_date >= options.startDate;
            });

            if (index) {
                stockData.data = stockData.data.slice(index);
            } else {
                stockData.data = [];
            }
        }
    }
    // stockData.data.reverse();
    return stockData;
}

export default { search, readReports };
