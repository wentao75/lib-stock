/**
 * 抢帽子警报，内容非常简单，连续三个收盘价涨/跌作为警报，警报放在第一根线（3个连续的第一个）
 */

import _ from "lodash";

const REST = "--";
const BUY_READY = "BUY_READY";
const SELL_READY = "SELL_READY";
const BUY = "BUY";
const SELL = "SELL";

function scalper(tradeData) {
    let retData = [];
    if (!_.isNil(tradeData) && !_.isEmpty(tradeData)) {
        let currentState = REST;
        for (let i = 0; i < tradeData.length; i++) {
            if (i < 2) {
                retData[i] = [
                    tradeData[i].trade_date,
                    REST,
                    tradeData[i].close,
                ];
            } else {
                let data = tradeData[i];
                let data1 = tradeData[i - 1];
                let data2 = tradeData[i - 2];
                if (
                    currentState !== BUY &&
                    data.close > data1.close &&
                    data1.close > data2.close
                ) {
                    // UP
                    retData[i - 2] = [data2.trade_date, BUY_READY, data2.low];
                    retData[i - 1] = [data1.trade_date, BUY, data2.close];
                    retData[i] = [data.trade_date, BUY, data.close];
                    currentState = BUY;
                } else if (
                    currentState !== SELL &&
                    data.close < data1.close &&
                    data1.close < data2.close
                ) {
                    retData[i - 2] = [data2.trade_date, SELL_READY, data2.high];
                    retData[i - 1] = [data1.trade_date, SELL, data2.close];
                    retData[i] = [data.trade_date, SELL, data.close];
                    currentState = SELL;
                } else {
                    retData[i] = [data.trade_date, currentState, data.close];
                }
            }
        }
    }

    return retData;
}

export default {
    name: "Scalper",
    label: "抢帽子",
    description: "抢帽子警报",
    calculate: scalper,
    states: {
        REST,
        BUY_READY,
        SELL_READY,
        BUY,
        SELL,
    },
};
