import _ from "lodash";
import trans from "../transaction";
import WVF from "../indicators/wvf";

import debugpkg from "debug";
import utils from "../utils";
const debug = debugpkg("rules:vixfix");

const OPTIONS_NAME = "vixfix";
const RULE_NAME = "vixfix";
const WVF_DATA = Symbol("WVF_DATA");
// const MA_DATA = Symbol("MA_DATA");

/**
 * VIX Fix中需要计算WVF，对应的布林带，对应的
 * @param {*} stockData
 * @param {*} options 配置参数
 */
function calculateData(stockData, options) {
    if (_.isNil(stockData)) return;

    if (_.isNil(stockData[WVF_DATA])) {
        let wvf = WVF.calculate(stockData, {
            n: options.vixfix.n,
            digits: options.vixfix.digits,
        });

        let boll = utils.boll(
            wvf,
            options.vixfix.bn,
            options.vixfix.multi,
            null,
            options.vixfix.digits
        );

        stockData[WVF_DATA] = [wvf, boll];
    }
}

function check(index, stockData, options, tsCode) {
    calculateData(stockData, options);

    if (
        stockData &&
        _.isArray(stockData) &&
        index < stockData.length &&
        index >= 0
    ) {
        let tradeDate = stockData[index].trade_date;
        let [wvfData, bollData] = stockData[WVF_DATA];

        if (checkBuyCondition(index, stockData, options)) {
            // 买入信号
            return {
                tsCode,
                dataIndex: index,
                date: tradeDate,
                tradeType: "buy",
                hasSignals: true,
                signal: "BUY",
                type: "WVF",
                memo: `WVF恐慌买入 [${stockData[index].trade_date}] ${wvfData[
                    index
                ].toFixed(2)}`,
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
                type: "WVF",
                memo: `WVF恐慌卖出 [${stockData[index].trade_date}] ${wvfData[
                    index
                ].toFixed(2)}`,
            };
        }
    }
}

function checkBuyCondition(index, stockData, options) {
    let wvfoptions = options && options[OPTIONS_NAME];
    // 检查WVF最大值的回看天数
    let lbn = (wvfoptions && wvfoptions.lbn) || 50;
    let ph = (wvfoptions && wvfoptions.ph) || 0.9; // 默认90%

    if (lbn < 1 || lbn > index) return false;
    let [wvfData, bollData] = stockData[WVF_DATA];

    // let currentData = stockData[index];

    // 买入条件主要是 wvf 超过 boll上限；或者wvf超过最近一段时间最高wvf的ph倍
    if (wvfData[index] >= bollData[index][1]) return true;
    let rangeHigh = utils.highest(wvfData, index, lbn + 1, null) * ph;
    if (wvfData[index] >= rangeHigh) return true;

    return false;
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

    // let wvfoptions = options && options[OPTIONS_NAME];
    let currentData = stockData[index];
    let targetPrice = currentData.close;
    let tradeDate = stockData[index].trade_date;
    let [wvfData, bollData] = stockData[WVF_DATA];
    if (checkBuyCondition(index, stockData, options)) {
        debug(
            `买入条件检查${tradeDate}: ${targetPrice.toFixed(
                2
            )} [WVF: ${wvfData[index].toFixed(2)}, boll上限 ${bollData[
                index
            ][1].toFixed(2)}]`
        );
        return trans.createBuyTransaction(
            stockInfo,
            tradeDate,
            index,
            balance,
            targetPrice,
            "WVF",
            `WVF恐慌买入 ${targetPrice.toFixed(2)}, ${wvfData[index].toFixed(
                2
            )}`
        );
    }
}

function checkSellCondition(index, stockData, options) {
    return false;
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
    // if (_.isEmpty(stock) || stock.count <= 0) return;
    // if (checkSellCondition(index, stockData, options)) {
    //     debug(
    //         `卖出条件检查${tradeDate}: ${targetPrice.toFixed(2)}[昨日 rsi: ${
    //             rsiData[index - 1]
    //         }, 今日rsi : ${rsiData[index]}, 上穿 ${short.toFixed(2)}
    //         }]`
    //     );
    //     return trans.createSellTransaction(
    //         stockInfo,
    //         tradeDate,
    //         index,
    //         stock.count,
    //         targetPrice,
    //         "WVF",
    //         `WVF恐慌卖出 ${targetPrice.toFixed(2)}, ${rsiData[index].toFixed(
    //             2
    //         )}`
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

    return reports;
}

/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */
function showOptions(options) {
    return `
模型 ${WVF_PANIC.name}[${WVF_PANIC.label}] 参数：
WVF计算周期 [${options.vixfix.n}]

WVF布林带参数 [天数: ${options.vixfix.bn}, 倍数: ${options.vixfix.multi} ]

WVF交易值检查 [周期: ${options.vixfix.lbn}, 最大值倍数: ${
        options.vixfix.ph * 100
    }%]
`;
}

const WVF_PANIC = {
    name: "WVF恐慌",
    label: RULE_NAME,

    description: "WVF恐慌买卖",
    methodTypes: {},
    checkBuyTransaction,
    checkSellTransaction,
    check,
    showOptions,
    createReports,
};

export default WVF_PANIC;
