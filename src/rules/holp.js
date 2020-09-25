/**
 * HOLP: High of Low Period
 *
 * 这是一个反转操作方式，需要严格执行规则
 *  1. 首先是启动点为近25天（周期）的价格新低，最少是17天（周期）
 *     这应该是一个下跌趋势，可以考虑通过检查最近20天内的阶段高点和阶段地点，然后看中间的间隔
 *  2. 最近的最低价K线位置确定，记录最高价（突破启动价位）和最低价（初始止损）
 *  3. 进入交易后，如果交易执行超过3天（周期），则初始止损调整为2根K线跟进止损（前面第二根K线最低价止损）
 *  4. 如果过程中发生回调，假如当日没有发生止损，但是2K线跟进止损会触发，则保持止损价位不变，看走势止损或者可以恢复2K线止损继续
 */

import _ from "lodash";
import moment from "moment";
import engine from "../transaction-engine";
import trans from "../transaction";

import debugpkg from "debug";
const debug = debugpkg("rules:holp");

/**
 * 基准参数，用于测量正常买入卖出情况下的基准效果
 * 采用的买入策略为开盘买入，第二天收盘卖出；或者止损平仓
 */
const RULE_NAME = "HOLP";

function check(index, stockData, options, tsCode) {
    // 从index位置查找前面25个数据中的最大和最小位置，确定趋势
    if (
        _.isNil(stockData) ||
        _.isEmpty(stockData) ||
        stockData.length < 20 ||
        index < 20
    ) {
        return;
    }

    let min = stockData[index].low;
    let minIndex = index;
    let max = stockData[index].high;
    let maxIndex = index;
    for (let i = 0; i < 25; i++) {
        if (index - i - 1 < 0) break;
        if (stockData[index - i - 1].low <= min) {
            min = stockData[index].low;
            minIndex = index - i - 1;
        }
        if (stockData[index - i - 1].high >= max) {
            max = stockData[index - i - 1].high;
            maxIndex = index - i - 1;
        }
    }
    debug(`最低 ${min} - ${minIndex}, 最高 ${max} - ${maxIndex}`);

    let tradeDate = stockData[index].trade_date;
    debug(`${tradeDate} 之前新低位置 ${stockData[minIndex].trade_date}`);
    if (index - minIndex <= 3 && minIndex - maxIndex >= 17) {
        // 符合初步条件，下面验证是否已经触发交易
        let readyIndex = minIndex;
        let data = stockData[readyIndex];
        let state = 0;
        let lossState = 0;
        let startPrice = data.high;
        let lossTarget = data.low;
        let startDate;
        let startIndex = -1;
        let tranPrice;

        for (let i = readyIndex + 1; i <= index; i++) {
            let daily = stockData[i];
            if (state === 0 && daily.high >= startPrice) {
                // 记录启动日
                state = 1;
                lossState = 0;
                startDate = daily.trade_date;
                startIndex = i;
                tranPrice = daily.close;
            } else if (state === 1) {
                // 检查是否调整止损状态
            }
        }
        let days = [
            index - readyIndex + 1,
            state === 0 ? 0 : index - startIndex + 1,
        ];

        let stateMemo;
        if (state === 0) {
            stateMemo = `还未突破目标价格${startPrice}，等待交易`;
        } else if (state === 1) {
            stateMemo = `已经进入交易${startDate}，交易持续${days[1]}天`;
        }
        return {
            tsCode,
            dataIndex: index,
            date: tradeDate,
            tradeType: "signal",
            hasSignals: true,
            signal: state === 0 ? "READY" : "BUY",
            type: "holp",
            holp: {
                state,
                lossState,
                days,
                targets: [startPrice, lossTarget],
                tran: [startDate, tranPrice],
            },
            memo: `HOLP信号，[${data.trade_date}最低点，持续${days[0]}天，${stateMemo}]`,
        };
    }
}

function checkBuyTransaction(stockInfo, balance, index, stockData, options) {
    debug(`检查HOLP买入：${index}, ${balance}`);
    if (balance <= 0) return;
}

function checkSellTransaction(stockInfo, stock, index, stockData, options) {
    if (_.isNil(stock) || stock.count <= 0) return;
}

/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */
function showOptions(options) {
    let opt = options && options.holp;
    // let buy = opt && options.squeeze.buy;
    // let sell = opt && options.squeeze.sell;
    return `
模型 ${holp.name}[${holp.label}] 参数：无
`;
}

async function createReports(results, options) {
    if (_.isNil(results)) return;

    let reports = [];
    let readyList = results && results["READY"];
    let days = [{ label: "全部", data: [] }];
    if (!_.isEmpty(readyList)) {
        for (let item of readyList) {
            days[0].data.push(item.tsCode);
        }
        reports.push({ label: "READY", data: days });
    }

    let buyList = results && results["BUY"];
    let bdays = [{ label: "全部", data: [] }];
    if (!_.isEmpty(buyList)) {
        for (let item of buyList) {
            bdays[0].data.push(item.tsCode);
        }
        reports.push({ label: "BUY", data: bdays });
    }

    // let reports = {
    //     READY: days,
    //     BUY: bdays,
    // };

    return reports;
}

const holp = {
    name: "低点反转",
    label: RULE_NAME,

    description: "HOLP低点反转",
    methodTypes: {},
    checkBuyTransaction,
    checkSellTransaction,
    check,
    showOptions,
    createReports,
};

export default holp;
