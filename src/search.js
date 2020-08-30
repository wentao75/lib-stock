import {
    readStockList,
    readStockData,
    stockDataNames,
} from "@wt/lib-wtda-query";

import moment from "moment";
import _ from "lodash";
import debugpkg from "debug";

import { formatFxstr } from "./util";

import engine from "./transaction-engine";
import trans from "./transaction";

const log = console.log;
const debug = debugpkg("search");

function showOptionsInfo(options) {
    console.log(
        `测试数据周期: ${options.startDate}

模型：${options.rule}

${options.rule.showOptions(options)}
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
    // 下一步开始按照给出的数据循环进行处理
    for (let stockItem of stockList) {
        // this.log(`处理数据：%o`, stockItem);

        // 首先读取日线信息
        let stockData = await readStockData(
            stockDataNames.daily,
            stockItem.ts_code
        );

        if (stockData) {
            log(
                `[${stockItem.ts_code}]${
                    stockItem.name
                } 【数据更新时间：${moment(stockData.updateTime).format(
                    "YYYY-MM-DD HH:mm"
                )}】`
            );

            // 首先过滤历史数据，这里将日线数据调整为正常日期从历史到现在
            stockData = await filterStockData(stockData);

            // 全部数据调整为前复权后再执行计算
            calculatePrevAdjPrice(stockData);

            // 开始按照日期执行交易算法
            let startDate = moment(options.startDate, "YYYYMMDD");
            let currentDate = null;
            for (let index = 0; index < stockData.data.length; index++) {
                let daily = stockData.data[index];
                let tradeDate = moment(daily.trade_date, "YYYYMMDD");
                if (_.isEmpty(currentDate)) {
                    if (startDate.isAfter(tradeDate)) {
                        continue;
                    }
                    debug(
                        `找到开始日期，开始查找匹配模型数据！${index}, ${daily.trade_date}`
                    );
                } else {
                    debug(`执行算法！${index}, ${daily.trade_date}`);
                }
                currentDate = tradeDate;

                let matched = options.rule.check(
                    index,
                    stockData.data,
                    options
                );
                if (matched) {
                    log(`${matched.memo}`);
                }

                // await engine.executeTransaction(
                //     index,
                //     stockData.data,
                //     capitalData,
                //     options
                // );
            }

            // engine.showCapitalReports(log, capitalData);
            // if (options.showTrans) {
            //     engine.showTransactions(log, capitalData);
            // }
            // if (options.showWorkdays) {
            //     reports.showWorkdayReports(log, capitalData.transactions);
            // }
        } else {
            log(
                `[${stockItem.ts_code}]${stockItem.name} 没有日线数据，请检查！`
            );
        }
    }
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
async function filterStockData(stockData, options) {
    stockData.data.reverse();
    return stockData;
}

export default search;
