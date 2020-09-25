import _ from "lodash";
import engine from "../transaction-engine";
import trans from "../transaction";
import debugpkg from "debug";
const debug = debugpkg("smashday");

/**
 * 攻击日模式
 */
const RULE_NAME = "smashday";

/**
 * 检查指定序号的日期数据是否符合当前模型定义形态
 *
 * @param {int} index 日期序号
 * @param {*} stockData 数据
 * @param {*} options 参数配置
 */
function check(index, stockData, options) {
    if (index < 1) return;
    let type = options && options.smashday.type;
    let currentData = stockData[index];
    let data1 = stockData[index - 1];
    let tradeDate = currentData.trade_date;

    if (type === "smash1" && currentData.close < data1.low) {
        return {
            dataIndex: index,
            date: tradeDate,
            tradeType: "buy",
            type: "smash1",
            targetPrice: currentData.high,
            memo: `突出收盘买入 [${tradeDate} ${currentData.close} < ${data1.low}，小于前一日最低]，在达到今日最大为反转可买入 ${currentData.high}`,
        };
    } else if (type === "smash1" && currentData.close > data1.high) {
        return {
            dataIndex: index,
            date: tradeDate,
            tradeType: "sell",
            type: "smash1",
            targetPrice: currentData.low,
            memo: `突出收盘卖出 [${tradeDate} ${currentData.close} > ${data1.high}，大于前一日最高]，在达到今日最低为反转可卖出 ${currentData.low}`,
        };
    } else if (
        type === "smash2" &&
        currentData.close > data1.close &&
        (currentData.close - currentData.low) /
            (currentData.high - currentData.low) <
            0.25
    ) {
        return {
            dataIndex: index,
            date: tradeDate,
            tradeType: "buy",
            type: "smash2",
            targetPrice: currentData.high,
            memo: `隐藏攻击买入 [${tradeDate} ${currentData.close} > ${data1.close}，收盘上涨，且在今日价格下方25% (${currentData.high}, ${currentData.low})]，在达到今日最高可买入 ${currentData.high}`,
        };
    } else if (
        type === "smash2" &&
        currentData.close < data1.close &&
        (currentData.close - currentData.low) /
            (currentData.high - currentData.low) >
            0.75
    ) {
        return {
            dataIndex: index,
            date: tradeDate,
            tradeType: "sell",
            type: "smash2",
            targetPrice: currentData.low,
            memo: `隐藏攻击卖出 [${tradeDate} ${currentData.close} < ${data1.close}，收盘下跌，且在今日价格上方25% (${currentData.high}, ${currentData.low})]，在达到今日最低可卖出 ${currentData.low}`,
        };
    }
}

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

    let buy = options.smashday && options.smashday.buy;
    let validDays = buy.validDays || 3;
    for (let i = 0; i < validDays; i++) {
        let matched = check(index - i, stockData, options);
        let smashType = buy.type || "smash1";
        let currentData = stockData[index];
        let tradeDate = currentData.trade_date;
        let targetPrice = matched.targetPrice;
        if (matched && matched.trade_date === "buy") {
            if (
                matched.type === smashType &&
                currentData.high >= matched.targetPrice
            ) {
                debug(
                    `攻击日为[${matched.date}]，今日满足目标价位：${matched.targetPrice} [${currentData.low}, ${currentData.high}]`
                );
                return trans.createBuyTransaction(
                    stockInfo,
                    tradeDate,
                    index,
                    balance,
                    targetPrice,
                    RULE_NAME,
                    `攻击日[${matched.type}]买入${targetPrice.toFixed(2)}`
                );
            }
        }
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
function checkSellTransaction(stockInfo, stock, index, stockData, options) {
    if (_.isEmpty(stock) || stock.count <= 0) return;

    let sell = options.smashday && options.smashday.sell;
    let validDays = sell.validDays || 3;
    for (let i = 0; i < validDays; i++) {
        let matched = check(index - i, stockData, options);
        let smashType = sell.type || "smash1";
        let currentData = stockData[index];
        let tradeDate = currentData.trade_date;
        let targetPrice = matched.targetPrice;
        if (matched && matched.trade_date === "sell") {
            if (matched.type === smashType && currentData.low <= targetPrice) {
                debug(
                    `攻击日为[${matched.date}]，今日满足目标价位：${targetPrice} [${currentData.low}, ${currentData.high}]`
                );
                return trans.createSellTransaction(
                    stockInfo,
                    tradeDate,
                    index,
                    stock.count,
                    targetPrice,
                    RULE_NAME,
                    `攻击日[${matched.type}]卖出${targetPrice.toFixed(2)}`
                );
            }
        }
    }
}

/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */
function showOptions(options) {
    let buy = options && options.smashday && options.smashday.buy;
    let sell = options && options.smashday && options.smashday.sell;
    return `
模型 ${smashday.name}[${smashday.label}] 参数：
买入有效期: ${buy.validDays}
买入类型: ${buy.type}, ${smashday.methodTypes[buy.type]}

卖出有效期: ${sell.validDays}
卖出类型: ${sell.type}, ${smashday.methodTypes[sell.type]}
`;
}

let smashday = {
    name: "攻击日",
    label: RULE_NAME,
    description: "攻击日模型",
    methodTypes: {
        smash1: "突出收盘价",
        smash2: "隐藏攻击日",
    },
    checkBuyTransaction,
    checkSellTransaction,
    check,
    showOptions,
};

export default smashday;
