import _ from "lodash";
import engine from "../transaction-engine";
import trans from "../transaction";

import debugpkg from "debug";
const debug = debugpkg("outsideday");

/**
 * 外包日模式，主要针对买入定义
 */
const RULE_NAME = "outsideday";

/**
 * 检查外包日买入条件
 * 1. 前一天为外包日结构，T-1， T-2两天的价格要求满足，T-1价格范围外包T-2，并且T-1收盘价低于T-2最低价
 * 2. 今日T日的开盘价低于T-1外包日收盘价以下
 *
 * 买入价格定为T-1日收盘价
 *
 * @param {*} stockInfo 股票信息
 * @param {double} balance 账户余额
 * @param {int} index 交易日数据索引位置
 * @param {*} stockData 数据
 * @param {*} options 算法参数
 */
function checkBuyTransaction(stockInfo, balance, index, stockData, options) {
    if (balance <= 0) return;
    if (index < 2) return;
    // debug(`外包日买入检查: ${balance}, ${tradeDate}, %o, ${index}`, stockData);

    // let bmOptions = options && options[RULE_NAME];
    let data2 = stockData[index - 2];
    let data1 = stockData[index - 1];
    let currentData = stockData[index];

    // 外包日条件
    if (data1.high < data2.high || data1.low > data2.low) return;
    // 外包日收盘低于前一日最低
    if (data1.close > data2.low) return;
    // 今日开盘低于外包日收盘
    if (currentData.open >= data1.close) return;

    // console.log(`跟踪信息： ${stockData.length}, ${index}`, currentData);
    let targetPrice = currentData.close; // data1.close;
    let tradeDate = currentData.trade_date;

    debug(`找到外包日模式：
    [${tradeDate} open=${currentData.open}, close=${currentData.close}] 
    [${data1.trade_date}: high=${data1.high}, low=${data1.low}, close=${data1.close}]
    [${data2.trade_date}: high=${data1.high}, low=${data1.low}]
    `);
    return trans.createBuyTransaction(
        stockInfo,
        tradeDate,
        index,
        balance,
        targetPrice,
        RULE_NAME,
        `外包日买入 ${targetPrice.toFixed(2)}`
    );
}

// /**
//  * 检查是否可以生成卖出交易，如果可以卖出，产生卖出交易记录
//  *
//  * @param {*} info 股票信息
//  * @param {*} stock 持仓信息
//  * @param {*} index 今日数据索引位置
//  * @param {*} stockData 日线数据
//  * @param {*} options 算法参数
//  */
// function checkSellTransaction(stockInfo, stock, index, stockData, options) {
//     if (_.isEmpty(stock) || stock.count <= 0) return;

//     let currentData = stockData[index];
//     let tradeDate = currentData.trade_date;
//     let bmoptions = options && options[RULE_NAME];
//     let priceType = bmoptions.sellPrice;

//     if (priceType === "open") {
//         return engine.createSellTransaction(
//             stockInfo,
//             tradeDate,
//             index,
//             stock.count,
//             currentData.open,
//             priceType,
//             `开盘卖出 ${currentData.open})`
//         );
//     } else if (priceType === "close") {
//         return engine.createSellTransaction(
//             stockInfo,
//             tradeDate,
//             index,
//             stock.count,
//             currentData.open,
//             priceType,
//             `收盘卖出 ${currentData.close}`
//         );
//     }
// }

/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */
function showOptions(options) {
    return `
`;
}

let outsideday = {
    name: "外包日",
    label: RULE_NAME,
    description: "外包日买入",
    methodTypes: {},
    checkBuyTransaction,
    // checkSellTransaction,
    showOptions,
};

export default outsideday;
