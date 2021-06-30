/**
 * 推进器交易，波段
 *
 */
import _ from "lodash";
import moment from "moment";
import utils from "../utils";
import trans from "../transaction";
import debugpkg from "debug";
import { getDataRoot } from "@wt/lib-wtda-query";

import MA from "../indicators/ma";
import ATR from "../indicators/atr";

const debug = debugpkg("rules:trend");

const RULE_NAME = "trend";
const TREND_DATA = Symbol("TREND_DATA");
const TREND_CONTEXT = Symbol("TREND_CONTEXT");

function calculateTrend(
    stockData,
    {
        n = 8,
        m = 21,
        l = 50,
        // earn1 = 0.04,
        // earn2 = 0.08,
        // loss = 0.04,
        digits = 3,
        atrlen = 20,
    } = {}
) {
    if (_.isNil(stockData)) return;
    let type = "ema";
    let source = "close";
    debug(`trend options: n=${n} m=${m} l=${l}`);
    if (_.isNil(stockData[TREND_DATA])) {
        let ma1 = MA.calculate(stockData, {
            n,
            source,
            type,
            digits,
        });
        debug(`%o`, ma1);
        let ma2 = MA.calculate(stockData, {
            n: m,
            source,
            type,
            digits,
        });
        debug(`%o`, ma2);
        let ma3 = MA.calculate(stockData, {
            n: l,
            source,
            type,
            digits,
        });
        let atr = ATR.calculate(stockData, {
            n: atrlen,
            type,
        });
        let atrdev = utils.stdev(stockData, atrlen, utils.tr, digits);

        stockData[TREND_DATA] = [ma1, ma2, ma3, atr, atrdev];
    }
}

function check(index, stockData, options, tsCode) {
    let opt = options && options.trend;
    calculateTrend(stockData, opt);

    let ma1 = stockData[TREND_DATA][0];
    let ma2 = stockData[TREND_DATA][1];
    let atr = stockData[TREND_DATA][3];
    let atrdev = stockData[TREND_DATA][4];
    if (
        ma1 &&
        ma2 &&
        atr &&
        atrdev &&
        _.isArray(ma1) &&
        _.isArray(ma2) &&
        _.isArray(atr) &&
        _.isArray(atrdev) &&
        index < ma1.length &&
        index < ma2.length &&
        index < atr.length &&
        index < atrdev.length &&
        index >= 0
    ) {
        //let data = trendData[index];
        let currentData = stockData[index];
        let close = currentData.close;
        if (ma1[index] < ma2[index]) {
            // 未开始
            let nextClose =
                ((opt.n + 1) * (opt.m - 1) * ma2[index] -
                    (opt.n - 1) * (opt.m + 1) * ma1[index]) /
                (2 * (opt.m - opt.n));
            if (nextClose < 0.0) {
                nextClose = 0.0;
            }

            if (nextClose - close <= atr[index] + atrdev[index]) {
                // 有可能突破，展示
                return {
                    tsCode,
                    dataIndex: index,
                    date: stockData[index].trade_date,
                    tradeType: "signal",
                    hasSignals: true,
                    signal: "PREBREAK",
                    type: "trend",
                    trend: {
                        ma1: ma1[index],
                        ma2: ma2[index],
                        atr: atr[index],
                        atrdev: atrdev[index],
                        close: close,
                        target: nextClose,
                    },
                    memo: `趋势：等待突破，目标 ¥${utils.toFixed(
                        nextClose,
                        2
                    )}，需${utils.toFixed(
                        (100 * (nextClose - close)) / close,
                        2
                    )}%上涨`,
                };
            }
        } else {
            let nextBackPrice =
                ((opt.n - 1) * ma1[index] + 2 * close) / (opt.n + 1);
            if (
                close >= ma1[index] &&
                close - nextBackPrice <= atr[index] + atrdev[index]
            ) {
                // 今日处于可回调范围，并且今日收盘距离预计回调价格在平均变动范围内
                return {
                    tsCode,
                    dataIndex: index,
                    date: stockData[index].trade_date,
                    tradeType: "signal",
                    hasSignals: true,
                    signal: "PULLBACK",
                    type: "trend",
                    trend: {
                        ma1: ma1[index],
                        ma2: ma2[index],
                        atr: atr[index],
                        atrdev: atrdev[index],
                        close: close,
                        target: nextBackPrice,
                    },
                    memo: `趋势：等待回调，目标 ¥${utils.toFixed(
                        nextBackPrice,
                        2
                    )}，需${utils.toFixed(
                        (100 * (close - nextBackPrice)) / close,
                        2
                    )}%回调`,
                };
            }
        }
    }
}

// function readContext(index, stockData) {
//     if (!stockData || !_.isArray(stockData)) return;
//     if (index < stockData.length && index >= 0) {
//         let contexts = stockData[SWING_CONTEXT];
//         if (contexts && _.isArray(contexts)) {
//             return contexts[index];
//         }
//     }
// }

// function saveContext(index, context, stockData) {
//     if (!stockData && !_.isArray(stockData)) {
//         return;
//     }
//     if (index < stockData.length && index >= 0) {
//         let contexts = stockData[SWING_CONTEXT];
//         if (!contexts) {
//             stockData[SWING_CONTEXT] = [];
//             contexts = stockData[SWING_CONTEXT];
//         }
//         contexts[index] = context;
//     }
// }

function checkBuyTransaction(stockInfo, balance, index, stockData, options) {
    debug(`检查趋势买入：${index}, ${balance} -- 未实现`);
}

function checkSellTransaction(stockInfo, stock, index, stockData, options) {
    debug(`检查趋势卖出：${index}, ${stock.count} -- 未实现`);
}

/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */
function showOptions(options) {
    let opt = options && options.trend;
    return `
模型 ${trend.name}[${trend.label}] 参数：
均线1: ${opt.n},  均线2: ${opt.m},  均线3: ${opt.l}
波幅均值天数: ${opt.atrlen}
`;
}

async function createReports(results, options) {
    if (_.isNil(results)) return;

    let reports = [];

    let readyList = results && results["PREBREAK"];
    let days = [{ label: "全部", data: [] }];
    if (!_.isEmpty(readyList)) {
        for (let item of readyList) {
            days[0].data.push(item.tsCode);
        }
        reports.push({ label: "PREBREAK", data: days });
    }

    let buyList = results && results["PULLBACK"];
    let bdays = [{ label: "全部", data: [] }];
    if (!_.isEmpty(buyList)) {
        for (let item of buyList) {
            bdays[0].data.push(item.tsCode);
        }
        reports.push({ label: "PULLBACK", data: bdays });
    }

    return reports;
}

const trend = {
    name: "趋势交易",
    label: RULE_NAME,

    description: "趋势选择",
    methodTypes: {},
    checkBuyTransaction,
    checkSellTransaction,
    check,
    showOptions,
    createReports,
};

export default trend;
