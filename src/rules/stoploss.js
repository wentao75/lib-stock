// const _ = require("lodash");
import _ from "lodash";
// const engine = require("./transaction-engine");
import engine from "../transaction-engine";
import trans from "../transaction";
import debugpkg from "debug";
const debug = debugpkg("rules:stoploss");

const OPTIONS_NAME = "stoploss";

/**
 * 检查是否需要执行止损
 * @param {*} stocks 持仓信息
 * @param {int} index 交易日索引位置
 * @param {*} stockData 日线数据
 */
function checkStoplossTransaction(stockInfo, stock, index, stockData, options) {
    if (_.isEmpty(stock) || stock.count <= 0) return;

    let currentData = stockData[index];
    // 止损最大损失比例
    let S = options && options[OPTIONS_NAME].S;

    // 这里检查纯粹的百分比止损
    let tradeDate = currentData.trade_date;
    let lossPrice = stock.price * (1 - S);
    debug(
        `止损检查${tradeDate}: ${currentData.low}] <= ${lossPrice.toFixed(
            2
        )} (=${stock.price.toFixed(2)}*(1-${(S * 100).toFixed(2)}%))`
    );
    if (currentData.low <= lossPrice) {
        // 当日价格范围达到止损值
        return trans.createSellTransaction(
            stockInfo,
            tradeDate,
            index,
            stock.count,
            lossPrice,
            "stoploss",
            `止损 ${lossPrice.toFixed(2)} (=${stock.price.toFixed(2)}*(1-${
                S * 100
            }%))`
        );
    }
}

/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */
function showOptions(options) {
    return `
模型 ${stoploss.name}[${stoploss.label}] 参数：
止损比例: ${options.stoploss.S * 100}%
`;
}

let stoploss = {
    name: "止损",
    label: "stoploss",
    description: "止损",
    methodTypes: {
        stoploss: "止损卖出",
    },
    checkSellTransaction: checkStoplossTransaction,
    showOptions,
};

export default stoploss;
