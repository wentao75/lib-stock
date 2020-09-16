/**
 * TTM Wave A & B & C
 *
 * 参数：
 *  n: wave 短周期平均
 *  ma: wave a 周期平均1
 *  la: wave a 周期平均2
 *  mb: wave b 周期平均1
 *  lb: wave b 周期平均2
 *  mc: wave c 周期平均1
 *  lc: wave c 周期平均2
 *
 *  source: close, ohlc
 */

import _ from "lodash";
import utils from "./utils";

function subtract(array1, array2) {
    if (
        _.isEmpty(array1) ||
        _.isEmpty(array2) ||
        array1.length !== array2.length
    ) {
        return;
    }

    return array1.map((item, i, all) => {
        return item - array2[i];
    });
}

function ttmwave(tradeData, options) {
    utils.checkTradeData(tradeData);

    if (
        _.isEmpty(tradeData) ||
        !_.isArray(tradeData) ||
        tradeData.length <= 0
    ) {
        return;
    }

    let source = (options && options.source) == "ohlc" ? utils.ohlc : "close";
    let digits = (options && options.digits) || 3;
    let n = (options && options.n) || 8;

    // wave A
    let ma = (options && options.ma) || 34;
    let la = (options && options.la) || 55;

    let fastMA1 = utils.ma(tradeData, n, source, "ema", digits);
    let slowMA1 = utils.ma(tradeData, ma, source, "ema", digits);
    let macd1 = subtract(fastMA1, slowMA1);
    let signal1 = utils.ma(macd1, ma, null, "ema", digits);
    let hist1 = subtract(macd1, signal1);

    let fastMA2 = utils.ma(tradeData, n, source, "ema", digits);
    let slowMA2 = utils.ma(tradeData, la, source, "ema", digits);
    let macd2 = subtract(fastMA2, slowMA2);
    let signal2 = utils.ma(macd2, la, null, "ema", digits);
    let hist2 = subtract(macd2, signal2);

    // wave B
    let mb = (options && options.mb) || 89;
    let lb = (options && options.lb) || 144;

    let fastMA3 = utils.ma(tradeData, n, source, "ema", digits);
    let slowMA3 = utils.ma(tradeData, mb, source, "ema", digits);
    let macd3 = subtract(fastMA3, slowMA3);
    let signal3 = utils.ma(macd3, mb, null, "ema", digits);
    let hist3 = subtract(macd3, signal3);

    let fastMA4 = utils.ma(tradeData, n, source, "ema", digits);
    let slowMA4 = utils.ma(tradeData, lb, source, "ema", digits);
    let macd4 = subtract(fastMA4, slowMA4);
    let signal4 = utils.ma(macd4, lb, null, "ema", digits);
    let hist4 = subtract(macd4, signal4);

    // wave C
    let mc = (options && options.mb) || 233;
    let lc = (options && options.lb) || 377;

    let fastMA5 = utils.ma(tradeData, n, source, "ema", digits);
    let slowMA5 = utils.ma(tradeData, mc, source, "ema", digits);
    let macd5 = subtract(fastMA5, slowMA5);
    let signal5 = utils.ma(macd5, mc, null, "ema", digits);
    let hist5 = subtract(macd5, signal5);

    let fastMA6 = utils.ma(tradeData, n, source, "ema", digits);
    let slowMA6 = utils.ma(tradeData, lc, source, "ema", digits);
    let macd6 = subtract(fastMA6, slowMA6);

    return [hist1, hist2, hist3, hist4, hist5, macd6];
}

export default {
    name: "TTM Wave",
    label: "TTMWave",
    description: "TTM 波浪A B C",
    calculate: ttmwave,
};
