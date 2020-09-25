import _ from "lodash";
import engine from "../transaction-engine";
import trans from "../transaction";

import debugpkg from "debug";
const debug = debugpkg("opensell");

const OPTIONS_NAME = "opensell";

/**
 * 开盘盈利卖出
 *
 * @param {*} info 股票信息
 * @param {*} stock 持仓信息
 * @param {*} index 今日数据索引位置
 * @param {*} stockData 日线数据
 * @param {*} options 算法参数
 */
function checkSellTransaction(stockInfo, stock, index, stockData, options) {
    if (_.isEmpty(stock) || stock.count <= 0) return;

    let currentData = stockData[index];
    let tradeDate = currentData.trade_date;

    // 目前有持仓，检查是否达到开盘盈利卖出条件
    if (currentData.open > stock.price) {
        debug(
            `开盘盈利策略符合：${currentData.open.toFixed(
                2
            )} (> ${stock.price.toFixed(2)})`
        );
        return trans.createSellTransaction(
            stockInfo,
            tradeDate,
            index,
            stock.count,
            currentData.open,
            OPTIONS_NAME,
            `开盘盈利卖出 ${currentData.open} (> ${stock.price.toFixed(2)})`
        );
    }
}

/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */
function showOptions(options) {
    return `
`;
}

let opensell = {
    name: "开盘盈利",
    label: OPTIONS_NAME,
    description: "开盘盈利卖出",
    methodTypes: {},
    // checkBuyTransaction: checkMMBBuyTransaction,
    checkSellTransaction,
    showOptions,
};

export default opensell;
