import SQUEEZE from "../indicators/squeeze";
import _ from "lodash";

const RULE_NAME = "squeeze";

function check(index, stockData, options) {
    let sdata = SQUEEZE.calculate(stockData, options.squeeze);

    if (
        stockData &&
        _.isArray(stockData) &&
        index < stockData.length &&
        index >= 0
    ) {
        let tradeDate = stockData[index].trade_date;
        if (sdata[6][index] === SQUEEZE.states.READY) {
            // 有信号
            return {
                dataIndex: index,
                date: tradeDate,
                tradeType: "signal",
                hasSignals: true,
                signal: "READY",
                type: "squeeze",
                targetPrice: stockData[index].close,
                memo: `挤牌信号，可考虑挤入 [${stockData[index].trade_date} ${sdata[6][index]}]`,
            };
        } else if (sdata[6][index] === SQUEEZE.states.BUY) {
            return {
                dataIndex: index,
                date: tradeDate,
                tradeType: "buy",
                hasSignals: true,
                signal: "BUY",
                type: "squeeze",
                targetPrice: stockData[index].close,
                memo: `挤牌信号明确，买入 [${stockData[index].trade_date} ${sdata[6][index]}]`,
            };
        } else if (
            sdata[6][index] === SQUEEZE.states.SELL &&
            options.squeeze.needSell
        ) {
            return {
                dataIndex: index,
                date: tradeDate,
                hasSignals: true,
                tradeType: "sell",
                signal: "SELL",
                type: "squeeze",
                targetPrice: stockData[index].close,
                memo: `挤牌信号明确，卖出 [${stockData[index].trade_date} ${sdata[6][index]}]`,
            };
        }
    }
}

function checkBuyTransaction(stockInfo, balance, index, stockData, options) {}

function checkSellTransaction(stockInfo, stock, index, stockData, options) {}

/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */
function showOptions(options) {
    let opt = options && options.squeeze;
    let buy = opt && options.squeeze.buy;
    let sell = opt && options.squeeze.sell;
    return `
模型 ${squeeze.name}[${squeeze.label}] 参数：
source: ${opt.source}
均值类型: ${opt.ma},    平均天数: ${opt.n}
布林线倍率: ${opt.bm}   Keltner通道倍率: ${opt.km}
动量类型:  ${opt.mt}
动量平均天数：  ${opt.mn},     动量天数：${opt.mm}
动量价格类型: ${opt.mmsource}

`;
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
};

export default squeeze;
