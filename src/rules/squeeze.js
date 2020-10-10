import SQUEEZE from "../indicators/squeeze";
import TTMWave from "../indicators/ttmwave";
import _ from "lodash";
import moment from "moment";
import trans from "../transaction";
import debugpkg from "debug";
import { getDataRoot } from "@wt/lib-wtda-query";

const debug = debugpkg("rules:squeeze");

const RULE_NAME = "squeeze";
const SQUEEZE_DATA = Symbol("SQUEEZE_DATA");
const TTMWAVE_DATA = Symbol("TTMWAVE_DATA");

function checkTTM(index, ttmwave) {
    // 检查TTM Wave ABC的趋势
    let upTrend = 0;
    let downTrend = 0;
    let ups = 0;
    let downs = 0;
    if (index - 2 >= 0) {
        for (let i = 0; i < 6; i++) {
            if (ttmwave[i][index] >= 0) {
                ups++;
            } else {
                downs++;
            }
            if (
                ttmwave[i][index] > ttmwave[i][index - 1] &&
                ttmwave[i][index - 1] > ttmwave[i][index - 2]
            ) {
                upTrend++;
            } else {
                downTrend++;
            }
        }
    }
    return [ups, downs, upTrend, downTrend];
}

function check(index, stockData, options, tsCode) {
    let sdata = SQUEEZE.calculate(stockData, options.squeeze);

    // 使用TTMWave同步进行检查
    let ttmwave = TTMWave.calculate(stockData, options.ttmwave);
    // 2020.10.10 增加一个针对Wave波浪趋势数量的参数，默认6个波浪至少有3个是对应的趋势发展，否则过滤掉
    let need_condition_days = (options && options.needCond) || false;
    let condition_days = (options && options.cond) || 3;

    if (
        stockData &&
        _.isArray(stockData) &&
        index < stockData.length &&
        index >= 0
    ) {
        let tradeDate = stockData[index].trade_date;
        let days = checkDays(index, sdata[6]);
        let trends = checkTTM(index, ttmwave);
        if (sdata[6][index] === SQUEEZE.states.READY) {
            // 有信号
            if (
                !need_condition_days ||
                (trends[0] >= condition_days && trends[2] >= condition_days)
            ) {
                return {
                    tsCode,
                    dataIndex: index,
                    date: tradeDate,
                    tradeType: "signal",
                    hasSignals: true,
                    signal: "READY",
                    type: "squeeze",
                    squeeze: {
                        days,
                        trends,
                    },
                    // targetPrice: stockData[index].close,
                    memo: `挤牌信号，可考虑挤入 [${stockData[index].trade_date} ${sdata[6][index]}]`,
                };
            }
        } else if (sdata[6][index] === SQUEEZE.states.BUY) {
            // 检查Wave ABC的趋势变化
            if (
                !need_condition_days ||
                (trends[0] >= condition_days && trends[2] >= condition_days)
            ) {
                return {
                    tsCode,
                    dataIndex: index,
                    date: tradeDate,
                    tradeType: "buy",
                    hasSignals: true,
                    signal: "BUY",
                    type: "squeeze",
                    squeeze: {
                        days,
                        trends,
                    },
                    // targetPrice: stockData[index].close,
                    memo: `挤牌信号明确，买入 [${stockData[index].trade_date} ${sdata[6][index]}]`,
                };
            }
        } else if (
            sdata[6][index] === SQUEEZE.states.SELL &&
            options.squeeze.needSell
        ) {
            if (
                !need_condition_days ||
                (trends[1] <= condition_days && trends[3] <= condition_days)
            ) {
                return {
                    tsCode,
                    dataIndex: index,
                    date: tradeDate,
                    hasSignals: true,
                    tradeType: "sell",
                    signal: "SELL",
                    type: "squeeze",
                    squeeze: {
                        days,
                        trends,
                    },
                    // targetPrice: stockData[index].close,
                    memo: `挤牌信号明确，卖出 [${stockData[index].trade_date} ${sdata[6][index]}]`,
                };
            }
        }
    }
}

function checkDays(index, states) {
    if (states[index] === SQUEEZE.states.REST) return [0, 0];
    let trade_days = 0;
    let state = states[index];
    if (state === SQUEEZE.states.BUY || state === SQUEEZE.states.SELL) {
        while (
            index - trade_days >= 0 &&
            states[index - trade_days] === state
        ) {
            trade_days++;
        }
    }
    let ready_days = 0;
    if (states[index - trade_days] === SQUEEZE.states.READY) {
        while (
            index - trade_days - ready_days >= 0 &&
            states[index - trade_days - ready_days] === SQUEEZE.states.READY
        ) {
            ready_days++;
        }
    }
    return [ready_days, trade_days];
}

function calculateSqueeze(stockData, options) {
    if (_.isNil(stockData)) return;
    // debug(
    //     `squeeze? ${_.isNil(stockData[SQUEEZE_DATA])} ${_.isNil(
    //         stockData[TTMWAVE_DATA]
    //     )}`
    // );
    if (_.isNil(stockData[SQUEEZE_DATA])) {
        stockData[SQUEEZE_DATA] = SQUEEZE.calculate(stockData, options.squeeze);
    }
    if (_.isNil(stockData[TTMWAVE_DATA])) {
        stockData[TTMWAVE_DATA] = TTMWave.calculate(stockData, options.ttmwave);
    }
}

function checkBuyTransaction(stockInfo, balance, index, stockData, options) {
    debug(`检查挤牌买入：${index}, ${balance}`);
    if (balance <= 0) return;
    calculateSqueeze(stockData, options);

    if (index < 1) return;
    // 检查今天index的条件
    let squeeze = stockData[SQUEEZE_DATA];
    // debug(`%o`, squeeze);
    let squeeze_today = squeeze && squeeze[6] && squeeze[6][index];
    let squeeze_lday = squeeze && squeeze[6] && squeeze[6][index - 1];
    // if (_.isNil(squeeze_today)) {
    //     debug(`意外退出...`);
    //     return;
    // }
    debug(`检查买入规则：${squeeze_today}, ${squeeze_lday}`);
    if (
        squeeze_today === SQUEEZE.states.BUY &&
        squeeze_lday === SQUEEZE.states.READY
    ) {
        let currentData = stockData[index];
        let tradeDate = currentData.trade_date;
        let targetPrice = currentData.close;
        return trans.createBuyTransaction(
            stockInfo,
            tradeDate,
            index,
            balance,
            targetPrice,
            RULE_NAME,
            `挤牌买入 ${targetPrice.toFixed(2)}`
        );
    }
}

function checkSellTransaction(stockInfo, stock, index, stockData, options) {
    if (_.isNil(stock) || stock.count <= 0) return;
    calculateSqueeze(stockData, options);

    if (index < 1) return;
    // 检查今天index的条件
    let squeeze = stockData[SQUEEZE_DATA];
    let squeeze_today = squeeze && squeeze[6] && squeeze[6][index];
    let squeeze_lday = squeeze && squeeze[6] && squeeze[6][index - 1];
    // if (_.isNil(squeeze_today)) {
    //     return;
    // }
    if (
        squeeze_today === SQUEEZE.states.REST &&
        squeeze_lday === SQUEEZE.states.BUY
    ) {
        let currentData = stockData[index];
        let tradeDate = currentData.trade_date;
        let targetPrice = currentData.close;
        return trans.createSellTransaction(
            stockInfo,
            tradeDate,
            index,
            stock.count,
            targetPrice,
            RULE_NAME,
            `挤牌卖出 ${targetPrice.toFixed(2)}`
        );
    }
}

/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */
function showOptions(options) {
    let opt = options && options.squeeze;
    // let buy = opt && options.squeeze.buy;
    // let sell = opt && options.squeeze.sell;
    return `
模型 ${squeeze.name}[${squeeze.label}] 参数：
source: ${opt.source}
均值类型: ${opt.ma},    平均天数: ${opt.n}
布林线倍率: ${opt.bm}   Keltner通道倍率: ${opt.km}
动量类型:  ${opt.mt}
动量平均天数：  ${opt.mn},     动量天数：${opt.mm}
价格类型: ${opt.source}

`;
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
    // results 当中按照signal进行了分组
    // 下面主要分析signal==="READY"情况下，时间的分布
    let readyList = results && results[SQUEEZE.states.READY];
    // 1, 2, 3, 5, 8, 13
    // let boundaries = [1, 2, 3, 5, 8, 13, _];
    let days = [
        { label: "1天", data: [] },
        { label: "2天", data: [] },
        { label: "3天", data: [] },
        { label: "4~5天", data: [] },
        { label: "6~8天", data: [] },
        { label: "8~13天", data: [] },
        { label: "多于13天", data: [] },
    ];
    if (!_.isEmpty(readyList)) {
        for (let item of readyList) {
            let ready_days =
                item.squeeze && item.squeeze.days && item.squeeze.days[0];
            let i = 0;
            if (ready_days === 1) i = 0;
            else if (ready_days === 2) i = 1;
            else if (ready_days === 3) i = 2;
            else if (ready_days > 3 && ready_days <= 5) i = 3;
            else if (ready_days > 5 && ready_days <= 8) i = 4;
            else if (ready_days > 8 && ready_days <= 13) i = 5;
            else i = 6;

            days[i].data.push(item.tsCode);
        }
        let i = 0;
        while (i < days.length) {
            if (days[i] && days[i].data && days[i].data.length > 0) {
                i++;
            } else {
                days.splice(i, 1);
            }
        }
        reports.push({ label: SQUEEZE.states.READY, data: days });
    }

    let buyList = results && results[SQUEEZE.states.BUY];
    let bdays = [
        { label: "1天", data: [] },
        { label: "2天", data: [] },
        { label: "3天", data: [] },
        { label: "4~5天", data: [] },
        { label: "6~8天", data: [] },
        { label: "8~13天", data: [] },
        { label: "多于13天", data: [] },
    ];
    if (!_.isEmpty(buyList)) {
        for (let item of buyList) {
            let buy_days =
                item.squeeze && item.squeeze.days && item.squeeze.days[1];
            let i = 0;
            if (buy_days === 1) i = 0;
            else if (buy_days === 2) i = 1;
            else if (buy_days === 3) i = 2;
            else if (buy_days > 3 && buy_days <= 5) i = 3;
            else if (buy_days > 5 && buy_days <= 8) i = 4;
            else if (buy_days > 8 && buy_days <= 13) i = 5;
            else i = 7;

            bdays[i].data.push(item.tsCode);
            // if (bdays[i]) {
            // } else {
            //     bdays[i] = [item.tsCode];
            // }
        }
        let i = 0;
        while (i < bdays.length) {
            if (bdays[i] && bdays[i].data && bdays[i].data.length > 0) {
                i++;
            } else {
                bdays.splice(i, 1);
            }
        }
        reports.push({ label: SQUEEZE.states.BUY, data: bdays });
    }

    // let reports = {
    //     // updateTime: moment().toISOString(),
    //     // squeeze: {
    //     [SQUEEZE.states.READY]: days,
    //     [SQUEEZE.states.BUY]: bdays,
    //     // },
    // };

    return reports;
}

const squeeze = {
    name: "挤牌",
    label: RULE_NAME,

    description: "挤牌模型",
    methodTypes: {},
    checkBuyTransaction,
    checkSellTransaction,
    check,
    showOptions,
    createReports,
};

export default squeeze;
