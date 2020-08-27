import _ from "lodash";
import engine from "./transaction-engine";

import debugpkg from "debug";
const debug = debugpkg("benchmark");

/**
 * 基准参数，用于测量正常买入卖出情况下的基准效果
 * 采用的买入策略为开盘买入，第二天收盘卖出；或者止损平仓
 */
const RULE_NAME = "benchmark";

/**
 * 检查买入条件
 * @param {*} stockInfo 股票信息
 * @param {double} balance 账户余额
 * @param {int} index 交易日数据索引位置
 * @param {*} stockData 数据
 * @param {*} options 算法参数
 */
function checkBuyTransaction(stockInfo, balance, index, stockData, options) {
    if (balance <= 0) return;
    // debug(`买入检查: ${balance}, ${tradeDate}, %o, ${index}`, stockData);

    // let bmOptions = options && options[RULE_NAME];
    let currentData = stockData[index];
    // console.log(`跟踪信息： ${stockData.length}, ${index}`, currentData);
    let targetPrice = currentData.open;
    let tradeDate = stockData[index].trade_date;

    return engine.createBuyTransaction(
        stockInfo,
        tradeDate,
        index,
        balance,
        targetPrice,
        RULE_NAME,
        `基准买入 ${targetPrice.toFixed(2)}`
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

    let currentData = stockData[index];
    let tradeDate = currentData.trade_date;
    let bmoptions = options && options[RULE_NAME];
    let priceType = bmoptions.sellPrice;

    if (priceType === "open") {
        return engine.createSellTransaction(
            stockInfo,
            tradeDate,
            index,
            stock.count,
            currentData.open,
            priceType,
            `开盘卖出 ${currentData.open})`
        );
    } else if (priceType === "close") {
        return engine.createSellTransaction(
            stockInfo,
            tradeDate,
            index,
            stock.count,
            currentData.open,
            priceType,
            `收盘卖出 ${currentData.close}`
        );
    }
}

/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */
function showOptions(options) {
    return `
模型 ${benchmark.name}[${benchmark.label}] 参数：
卖出类型: ${options.benchmark.sellPrice}
`;
}

let benchmark = {
    name: "基准",
    label: RULE_NAME,
    description: "基准测试",
    methodTyps: {
        open: "开盘卖出",
        close: "收盘卖出",
    },
    checkBuyTransaction,
    checkSellTransaction,
    showOptions,
};

export default benchmark;
