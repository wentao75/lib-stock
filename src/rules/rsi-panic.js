import _ from "lodash";
import engine from "../transaction-engine";
import trans from "../transaction";
import RSI from "../indicators/rsi";
import MA from "../indicators/ma";

import debugpkg from "debug";
const debug = debugpkg("rules:rsi");

const OPTIONS_NAME = "rsi";
const RULE_NAME = "rsi";
const RSI_DATA = Symbol("RSI_DATA");
const MA_DATA = Symbol("MA_DATA");

function calculateData(stockData, options) {
    if (_.isNil(stockData)) return;

    if (_.isNil(stockData[RSI_DATA])) {
        stockData[RSI_DATA] = RSI.calculate(stockData, {
            n: options.rsi.n,
            digits: options.rsi.digits,
        });
    }
    if (_.isNil(stockData[MA_DATA])) {
        stockData[MA_DATA] = MA.calculate(stockData, {
            n: options.rsi.ma,
            source: "close",
            digits: options.rsi.digits,
            type: "ma",
        });
    }
}

function check(index, stockData, options, tsCode) {
    // let sdata = RSI.calculate(stockData, options.rsi);
    calculateData(stockData, options);

    if (
        stockData &&
        _.isArray(stockData) &&
        index < stockData.length &&
        index >= 0
    ) {
        let tradeDate = stockData[index].trade_date;
        let rsiData = stockData[RSI_DATA];

        if (checkBuyCondition(index, stockData, options)) {
            // 买入信号
            return {
                tsCode,
                dataIndex: index,
                date: tradeDate,
                tradeType: "buy",
                hasSignals: true,
                signal: "BUY",
                type: "rsi",
                memo: `RSI恐慌突破，买入 [${
                    stockData[index].trade_date
                }] ${rsiData[index].toFixed(2)}`,
            };
        }

        if (checkSellCondition(index, stockData, options)) {
            // 卖出信号
            return {
                tsCode,
                dataIndex: index,
                date: tradeDate,
                hasSignals: true,
                tradeType: "sell",
                signal: "SELL",
                type: "rsi",
                memo: `RSI恐慌上穿，卖出 [${
                    stockData[index].trade_date
                }] ${rsiData[index].toFixed(2)}`,
            };
        }
    }
}

function checkBuyCondition(index, stockData, options) {
    let rsioptions = options && options[OPTIONS_NAME];
    // 平均的计算日数
    let n = rsioptions && rsioptions.n;

    if (n < 1 || n - 1 > index) return false;
    let rsiData = stockData[RSI_DATA];
    let maData = stockData[MA_DATA];
    let currentData = stockData[index];

    // 首先需要ma日均线低于当前价格，说明走势趋向正确
    if (maData && maData[index] && maData[index] > currentData.close)
        return false;

    // 判断rsi下穿
    let long = rsioptions && rsioptions.long;
    return (
        rsiData &&
        rsiData[index - 1] &&
        rsiData[index] &&
        rsiData[index - 1] >= long &&
        rsiData[index] < long
    );
}

/**
 * 检查买入条件
 * @param {*} stockInfo 股票信息
 * @param {double} balance 账户余额
 * @param {*} tradeDate 交易日期
 * @param {int} index 交易日数据索引位置
 * @param {*} stockData 数据
 * @param {*} options 算法参数
 */
function checkBuyTransaction(stockInfo, balance, index, stockData, options) {
    if (balance <= 0) return;
    calculateData(stockData, options);
    // debug(`买入检查: ${balance}, ${tradeDate}, %o, ${index}`, stockData);

    let rsioptions = options && options[OPTIONS_NAME];
    let long = rsioptions && rsioptions.long;
    let currentData = stockData[index];
    let targetPrice = currentData.close;
    let tradeDate = stockData[index].trade_date;
    let rsiData = stockData[RSI_DATA];
    if (checkBuyCondition(index, stockData, options)) {
        debug(
            `买入条件检查${tradeDate}: ${targetPrice.toFixed(2)}[昨日 rsi: ${
                rsiData[index - 1]
            }, 今日rsi : ${rsiData[index]}, 穿越 ${long.toFixed(2)}
            }]`
        );
        return trans.createBuyTransaction(
            stockInfo,
            tradeDate,
            index,
            balance,
            targetPrice,
            "rsi",
            `RSI恐慌突破买入 ${targetPrice.toFixed(2)}, ${rsiData[
                index
            ].toFixed(2)}`
        );
    }

    // let rsioptions = options && options[OPTIONS_NAME];
    // // 平均的计算日数
    // let n = rsioptions && rsioptions.n;

    // if (n < 1 || n - 1 > index) return;
    // let rsiData = stockData[RSI_DATA];
    // let maData = stockData[MA_DATA];
    // let currentData = stockData[index];
    // let tradeDate = stockData[index].trade_date;

    // // 首先需要ma日均线低于当前价格，说明走势趋向正确
    // if (maData && maData[index] && maData[index] > currentData.close) return;

    // // 判断rsi下穿
    // let long = rsioptions && rsioptions.long;
    // let targetPrice = currentData.close;
    // if (
    //     rsiData &&
    //     rsiData[index - 1] &&
    //     rsiData[index] &&
    //     rsiData[index - 1] >= long &&
    //     rsiData[index] < long
    // ) {
    // }
}

function checkSellCondition(index, stockData, options) {
    let rsioptions = options && options[OPTIONS_NAME];
    // 平均的计算日数
    let n = rsioptions && rsioptions.n;

    if (n < 1 || n - 1 > index) return false;
    let rsiData = stockData[RSI_DATA];
    let maData = stockData[MA_DATA];
    let currentData = stockData[index];

    // 首先需要ma日均线低于当前价格，说明走势趋向正确
    if (maData && maData[index] && maData[index] > currentData.close)
        return false;

    // 判断rsi下穿
    let short = rsioptions && rsioptions.short;
    return (
        rsiData &&
        rsiData[index - 1] &&
        rsiData[index] &&
        rsiData[index - 1] <= short &&
        rsiData[index] > short
    );
}

/**
 * 检查是否可以生成卖出交易，如果可以卖出，产生卖出交易记录
 *
 * @param {*} info 股票信息
 * @param {*} stock 持仓信息
 * @param {*} index 今日数据索引位置
 * @param {*} stockData 日线数据
 * @param {*} options 算法参数
 */
function checkSellTransaction(stockInfo, stock, index, stockData, options) {
    if (_.isEmpty(stock) || stock.count <= 0) return;

    let rsioptions = options && options[OPTIONS_NAME];
    let short = rsioptions && rsioptions.short;
    let currentData = stockData[index];
    let tradeDate = currentData.trade_date;
    let targetPrice = currentData.close;
    let rsiData = stockData[RSI_DATA];

    if (checkSellCondition(index, stockData, options)) {
        debug(
            `卖出条件检查${tradeDate}: ${targetPrice.toFixed(2)}[昨日 rsi: ${
                rsiData[index - 1]
            }, 今日rsi : ${rsiData[index]}, 上穿 ${short.toFixed(2)}
            }]`
        );
        return trans.createSellTransaction(
            stockInfo,
            tradeDate,
            index,
            stock.count,
            targetPrice,
            "rsi",
            `RSI恐慌卖出 ${targetPrice.toFixed(2)}, ${rsiData[index].toFixed(
                2
            )}`
        );
    }

    // let rsioptions = options && options[OPTIONS_NAME];
    // // 平均的计算日数
    // let n = rsioptions && rsioptions.n;

    // // 判断rsi下穿
    // let short = rsioptions && rsioptions.short;
    // let targetPrice = currentData.close;
    // if (
    //     rsiData &&
    //     rsiData[index - 1] &&
    //     rsiData[index] &&
    //     rsiData[index - 1] <= short &&
    //     rsiData[index] > short
    // ) {
    //     debug(
    //         `卖出条件检查${tradeDate}: ${targetPrice.toFixed(2)}[昨日 rsi: ${
    //             rsiData[index - 1]
    //         }, 今日rsi : ${rsiData[index]}, 上穿 ${short.toFixed(2)}
    //         }]`
    //     );
    //     return engine.createSellTransaction(
    //         stockInfo,
    //         tradeDate,
    //         index,
    //         stock.count,
    //         targetPrice,
    //         "rsi",
    //         `RSI恐慌卖出 ${targetPrice.toFixed(2)}`
    //     );
    // }
}

/**
 * 将搜索得到的列表生成分析报表
 *
 * @param {*} results 搜索的匹配列表
 * @param {*} options 匹配使用的参数
 */
async function createReports(results, options) {
    if (_.isNil(results)) return;

    let reports = [];

    let buyList = results && results["BUY"];
    let bdays = [{ label: "全部", data: [] }];
    if (!_.isEmpty(buyList)) {
        for (let item of buyList) {
            bdays[0].data.push(item.tsCode);
        }
        reports.push({ label: "买入", data: bdays });
    }

    let sellList = results && results["SELL"];
    let sdays = [{ label: "全部", data: [] }];
    if (!_.isEmpty(sellList)) {
        for (let item of sellList) {
            sdays[0].data.push(item.tsCode);
        }
        reports.push({ label: "卖出", data: sdays });
    }

    return reports;
}

/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */
function showOptions(options) {
    return `
模型 ${RSI_PANIC.name}[${RSI_PANIC.label}] 参数：
RSI平均周期 [${options.rsi.n}]
价格上涨均线天数 [${options.rsi.ma}]

RSI突破买入下限: ${options.rsi.long}%
RSI突破卖出上限: ${options.rsi.short}%
`;
}

const RSI_PANIC = {
    name: "RSI恐慌",
    label: RULE_NAME,

    description: "RSI恐慌买卖",
    methodTypes: {},
    checkBuyTransaction,
    checkSellTransaction,
    check,
    showOptions,
    createReports,
};

export default RSI_PANIC;
