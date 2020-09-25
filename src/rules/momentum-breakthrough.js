import _ from "lodash";
import engine from "../transaction-engine";
import trans from "../transaction";

import debugpkg from "debug";
const debug = debugpkg("rules:mmb");

const OPTIONS_NAME = "mmb";

/**
 * 检查买入条件
 * @param {*} stockInfo 股票信息
 * @param {double} balance 账户余额
 * @param {*} tradeDate 交易日期
 * @param {int} index 交易日数据索引位置
 * @param {*} stockData 数据
 * @param {*} options 算法参数
 */
function checkMMBBuyTransaction(stockInfo, balance, index, stockData, options) {
    if (balance <= 0) return;
    // debug(`买入检查: ${balance}, ${tradeDate}, %o, ${index}`, stockData);

    let mmboptions = options && options[OPTIONS_NAME];
    // 平均波幅的计算日数
    let N = mmboptions.N;
    // 波幅突破的百分比
    let P = mmboptions.P;

    let moment = 0;
    for (let i = 0; i < N; i++) {
        if (index - i - 1 >= 0) {
            let tmp = stockData[index - i - 1];
            if (mmboptions.mmbType === "hl") {
                moment += tmp.high - tmp.low;
            } else {
                moment += tmp.high - tmp.close;
            }
        }
    }
    moment = moment / N;

    let currentData = stockData[index];
    // console.log(`跟踪信息： ${stockData.length}, ${index}`, currentData);
    let targetPrice = currentData.open + moment * P;
    let tradeDate = stockData[index].trade_date;

    debug(
        `买入条件检查${tradeDate}: ${targetPrice.toFixed(2)}=${
            currentData.open
        }+${moment.toFixed(2)}*${P} [o: ${currentData.open}, h: ${
            currentData.high
        }, l: ${currentData.low}, c: ${currentData.close}, d: ${
            currentData.trade_date
        }]`
    );
    if (currentData.high >= targetPrice && currentData.open <= targetPrice) {
        // 执行买入交易
        debug(`符合条件：${tradeDate}`);
        return trans.createBuyTransaction(
            stockInfo,
            tradeDate,
            index,
            balance,
            targetPrice,
            "mmb",
            `动能突破买入 ${targetPrice.toFixed(2)} (=${
                currentData.open
            }+${moment.toFixed(2)}*${(P * 100).toFixed(2)}%)`
        );
    }
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
function checkMMBSellTransaction(stockInfo, stock, index, stockData, options) {
    if (_.isEmpty(stock) || stock.count <= 0) return;

    // 检查是否符合动能突破买入条件
    // if (
    //     !options.nommbsell &&
    //     !_.isEmpty(
    //         checkMMBBuyTransaction(
    //             stockInfo,
    //             options.initBalance,
    //             index,
    //             stockData,
    //             options
    //         )
    //     )
    // ) {
    //     // 可以买入，那么当日保持
    //     return;
    // }

    let currentData = stockData[index];
    let tradeDate = currentData.trade_date;
    let mmboptions = options && options[OPTIONS_NAME];

    // 目前有持仓，检查是否达到盈利卖出条件
    if (!mmboptions.nommb1 && currentData.open > stock.price) {
        // 采用第二天开盘价盈利就卖出的策略
        debug(
            `开盘盈利策略符合：${currentData.open.toFixed(
                2
            )} (> ${stock.price.toFixed(2)})`
        );
        return engine.createSellTransaction(
            stockInfo,
            tradeDate,
            index,
            stock.count,
            currentData.open,
            "mmb1",
            `开盘盈利卖出 ${currentData.open} (> ${stock.price.toFixed(2)})`
        );
    }

    if (!mmboptions.nommb2) {
        // 平均波幅的计算日数
        let N = mmboptions.N;
        // 止损使用的波幅下降百分比
        let L = mmboptions.L;
        // 有持仓，检查是否达到卖出条件
        // 第一个卖出条件是买入后按照买入价格及波动数据的反向百分比设置
        let moment = 0;
        for (let i = 0; i < N; i++) {
            if (index - i - 1 >= 0) {
                let tmp = stockData[index - i - 1];
                if (mmboptions.mmbType === "hl") {
                    moment += tmp.high - tmp.low;
                } else {
                    moment += tmp.high - tmp.close;
                }
            }
        }
        moment = moment / N;

        let targetPrice = currentData.open - moment * L;
        if (targetPrice <= currentData.open && targetPrice >= currentData.low) {
            // 执行波动卖出
            return trans.createSellTransaction(
                stockInfo,
                tradeDate,
                index,
                stock.count,
                targetPrice,
                "mmb2",
                `动能突破卖出：${targetPrice.toFixed(2)} (= ${
                    currentData.open
                }-${moment.toFixed(2)}*${L * 100}%)`
            );
        }
    }
}

/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */
function showOptions(options) {
    return `
模型 ${mmb.name}[${mmb.label}] 参数：
波幅类型 [${options.mmb.mmbType === "hc" ? "最高-收盘" : "最高-最低"}]
动能平均天数: ${options.mmb.N}
动能突破买入比例: ${options.mmb.P * 100}%
动能突破卖出比例: ${options.mmb.L * 100}%
规则：
  1. [${options.mmb.nommb1 ? "🚫" : "✅"}] 开盘盈利锁定
  2. [${options.mmb.nommb2 ? "🚫" : "✅"}] 动能向下突破卖出
`;
}

let mmb = {
    name: "MMB(动能穿透)",
    label: "mmb",
    description: "动能穿透",
    methodTypes: {
        mmb: "动能突破买入",
        mmb1: "开盘盈利卖出",
        mmb2: "动能突破卖出",
    },
    checkBuyTransaction: checkMMBBuyTransaction,
    checkSellTransaction: checkMMBSellTransaction,
    showOptions,
};

export default mmb;
