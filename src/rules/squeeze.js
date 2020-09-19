import SQUEEZE from "../indicators/squeeze";
import TTMWave from "../indicators/ttmwave";
import _ from "lodash";
import trans from "../transaction";
import debugpkg from "debug";

const debug = debugpkg("engine");

const RULE_NAME = "squeeze";
const SQUEEZE_DATA = Symbol("SQUEEZE_DATA");
const TTMWAVE_DATA = Symbol("TTMWAVE_DATA");

function check(index, stockData, options) {
    let sdata = SQUEEZE.calculate(stockData, options.squeeze);

    // 使用TTMWave同步进行检查
    let ttmwave = TTMWave.calculate(stockData, options.ttmwave);

    if (
        stockData &&
        _.isArray(stockData) &&
        index < stockData.length &&
        index >= 0
    ) {
        let tradeDate = stockData[index].trade_date;
        if (sdata[6][index] === SQUEEZE.states.READY) {
            // 有信号
            // 检查TTM Wave ABC的趋势
            let upTrend = 0;
            let downTrend = 0;
            if (index - 2 >= 0) {
                for (let i = 0; i < 6; i++) {
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
            return {
                dataIndex: index,
                date: tradeDate,
                tradeType: "signal",
                hasSignals: true,
                signal: "READY",
                type: "squeeze",
                trends: [upTrend, downTrend],
                targetPrice: stockData[index].close,
                memo: `挤牌信号，可考虑挤入 [${stockData[index].trade_date} ${sdata[6][index]}]`,
            };
        } else if (sdata[6][index] === SQUEEZE.states.BUY) {
            // 检查Wave ABC的趋势变化

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
