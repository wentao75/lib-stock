// const _ = require("lodash");
import _ from "lodash";
// const engine = require("./transaction-engine");
import engine from "./transaction-engine";

/**
 * 检查是否需要执行止损
 * @param {*} stock 持仓信息
 * @param {int} index 交易日索引位置
 * @param {*} stockData 日线数据
 */
function checkStoplossTransaction(stockInfo, stock, index, stockData, options) {
    if (_.isEmpty(stock) || stock.count <= 0) return;
    let currentData = stockData[index];
    // 止损最大损失比例
    let S = (options && options.S) || 0.1;

    // 这里检查纯粹的百分比止损
    let lossPrice = stock.price * (1 - S);
    let tradeDate = currentData.trade_date;
    if (currentData.low <= lossPrice) {
        // 当日价格范围达到止损值
        return engine.createSellTransaction(
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

let stoploss = {
    name: "SL",
    description: "止损",
    methodTypes: {
        stoploss: "止损卖出",
    },
    checkStoplossTransaction,
};

export default stoploss;
