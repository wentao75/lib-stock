import EVERYDAY from "../indicators/everyday";
import _ from "lodash";
import trans from "../transaction";
import debugpkg from "debug";

const debug = debugpkg("rules:everyday");

const RULE_NAME = "everyday";
const EVERYDAY_DATA = Symbol("EVERYDAY_DATA");

function check(index, stockData, options, tsCode) {
    let sdata = EVERYDAY.calculate(stockData, options.everyday);

    if (
        stockData &&
        _.isArray(stockData) &&
        index < stockData.length &&
        index >= 0
    ) {
        let tradeDate = stockData[index].trade_date;
        let longCond = sdata[0];
        let shortCond = sdata[1];

        //         console.log(`
        // ${tsCode}: [${tradeDate}] 买入条件=${longCond[index]}，卖出条件=${shortCond[index]}
        //     TTM: trendSignal=${sdata[2][index]}, ttmTrend=${sdata[3][index]},
        //     Signal: sqzBuy=${sdata[4][index]}, sqzSell=${sdata[5][index]}, wvfBuy=${sdata[6][index]}, osc=${sdata[7][index]}

        //     Wave: hist1=${sdata[21][index]} hist2=${sdata[22][index]} hist3=${sdata[23][index]} hist4=${sdata[24][index]} hist5=${sdata[25][index]} hist6=${sdata[26][index]}
        //     SQZ: state=${sdata[31][index]} mtm=${sdata[32][index]} mtmVal=${sdata[33][index]}
        //     WVF: wvf=${sdata[41][index]} osc=${sdata[45][index]}
        //         `);

        if (longCond[index] != 0) {
            // 有信号
            return {
                tsCode,
                dataIndex: index,
                date: tradeDate,
                tradeType: "buy",
                hasSignals: true,
                signal: "BUY",
                type: "everyday",
                everyday: {},
                memo: `每日规则买入 [${stockData[index].trade_date} ${longCond[index]}]`,
            };
        } else if (shortCond[index] != 0) {
            return {
                tsCode,
                dataIndex: index,
                date: tradeDate,
                hasSignals: true,
                tradeType: "sell",
                signal: "SELL",
                type: "everyday",
                everyday: {},
                memo: `每日规则卖出 [${stockData[index].trade_date} ${shortCond[index]}]`,
            };
        }
    }
}

function calculateData(stockData, options) {
    if (_.isNil(stockData)) return;

    let len =
        stockData &&
        stockData[EVERYDAY_DATA] &&
        stockData[EVERYDAY_DATA][0] &&
        stockData[EVERYDAY_DATA][0].length;
    if (_.isNil(stockData[EVERYDAY_DATA]) || stockData.length != len) {
        stockData[EVERYDAY_DATA] = EVERYDAY.calculate(
            stockData,
            options.squeeze
        );
    }
}

function checkBuyTransaction(stockInfo, balance, index, stockData, options) {
    debug(`检查每日买入：${index}, ${balance}`);
    if (balance <= 0) return;
    calculateData(stockData, options);

    if (index < 1) return;
    // 检查今天index的条件
    let sdata = stockData[EVERYDAY_DATA];
    let longCond = sdata[0];

    // debug(`%o`, squeeze);
    // debug(`检查买入规则：${squeeze_today}, ${squeeze_lday}`);
    if (longCond[index] != 0) {
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
            `每日规则买入 ${targetPrice.toFixed(2)}`
        );
    }
}

function checkSellTransaction(stockInfo, stock, index, stockData, options) {
    if (_.isNil(stock) || stock.count <= 0) return;
    calculateData(stockData, options);

    if (index < 1) return;
    // 检查今天index的条件
    let sdata = stockData[EVERYDAY_DATA];
    let shortCond = sdata[1];
    if (shortCond && shortCond[index] != 0) {
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
            `每日规则卖出 ${targetPrice.toFixed(2)}`
        );
    }
}

/**
 * 返回参数配置的显示信息
 * @param {*}} opions 参数配置
 */
function showOptions(options) {
    let opt = options && options.everyday;
    return `
模型 ${everyday.name}[${everyday.label}] 参数：目前使用默认参数

`;
}

/**
 * 将搜索得到的列表生成分析报表
 *
 * @param {*} results 搜索的匹配列表
 * @param {*} options 匹配使用的参数
 */
async function createReports(results, options) {
    if (_.isNil(results)) return;

    let reports = [];
    // results 当中按照signal进行了分组
    // 下面主要分析signal==="READY"情况下，时间的分布
    let buyList = results && results["BUY"];
    let sellList = results && results["SELL"];

    let types = [{ label: "全部", data: [] }];
    if (!_.isEmpty(buyList)) {
        for (let item of buyList) {
            types[0].data.push(item.tsCode);
        }
        reports.push({ label: "BUY", data: types });
    }

    types = [{ label: "全部", data: [] }];
    if (!_.isEmpty(sellList)) {
        for (let item of sellList) {
            types[0].data.push(item.tsCode);
        }
        reports.push({ label: "SELL", data: types });
    }

    return reports;
}

const everyday = {
    name: "每日规则",
    label: RULE_NAME,

    description: "每日规则模型模型",
    methodTypes: {},
    checkBuyTransaction,
    checkSellTransaction,
    check,
    showOptions,
    createReports,
};

export default everyday;
