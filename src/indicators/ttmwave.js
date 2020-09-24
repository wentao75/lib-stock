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
 *  useb: true
 *  usec: true
 *  source: close, ohlc
 */

import _ from "lodash";
import utils from "../utils";

function subtract(array1, array2, digits) {
    if (
        _.isEmpty(array1) ||
        _.isEmpty(array2) ||
        array1.length !== array2.length
    ) {
        return;
    }

    return array1.map((item, i, all) => {
        if (digits) {
            return utils.toFixed(item - array2[i], digits);
        } else {
            return item - array2[i];
        }
    });
}

function ttmwave(
    tradeData,
    {
        n = 8, // 5
        ma = 34, // 21
        la = 55, // 34
        useb = true,
        mb = 89, // 55
        lb = 144, // 89
        usec = true,
        mc = 233, // 144
        lc = 377, // 233
        source = "close",
        digits = 3,
    } = {}
) {
    utils.checkTradeData(tradeData);

    if (
        _.isEmpty(tradeData) ||
        !_.isArray(tradeData) ||
        tradeData.length <= 0
    ) {
        return;
    }

    if (source === "ohlc") {
        source = utils.ohlc;
    } else {
        source = "close";
    }
    // let source = (options && options.source) == "ohlc" ? utils.ohlc : "close";
    // let digits = (options && options.digits) || 3;
    // let n = (options && options.n) || 8;

    // let ma = (options && options.ma) || 34;
    // let la = (options && options.la) || 55;
    // let mb = (options && options.mb) || 89;
    // let lb = (options && options.lb) || 144;
    // let mc = (options && options.mb) || 233;
    // let lc = (options && options.lb) || 377;

    // wave A
    let fastMA1 = utils.ma(tradeData, n, source, "ema", digits);
    let slowMA1 = utils.ma(tradeData, ma, source, "ema", digits);
    let macd1 = subtract(fastMA1, slowMA1);
    let signal1 = utils.ma(macd1, ma, null, "ema", digits);
    let hist1 = subtract(macd1, signal1, digits);

    let fastMA2 = utils.ma(tradeData, n, source, "ema", digits);
    let slowMA2 = utils.ma(tradeData, la, source, "ema", digits);
    let macd2 = subtract(fastMA2, slowMA2);
    let signal2 = utils.ma(macd2, la, null, "ema", digits);
    let hist2 = subtract(macd2, signal2, digits);

    // wave B
    let fastMA3 = useb ? utils.ma(tradeData, n, source, "ema", digits) : null;
    let slowMA3 = useb ? utils.ma(tradeData, mb, source, "ema", digits) : null;
    let macd3 = useb ? subtract(fastMA3, slowMA3) : null;
    let signal3 = useb ? utils.ma(macd3, mb, null, "ema", digits) : null;
    let hist3 = useb ? subtract(macd3, signal3, digits) : null;

    let fastMA4 = useb ? utils.ma(tradeData, n, source, "ema", digits) : null;
    let slowMA4 = useb ? utils.ma(tradeData, lb, source, "ema", digits) : null;
    let macd4 = useb ? subtract(fastMA4, slowMA4) : null;
    let signal4 = useb ? utils.ma(macd4, lb, null, "ema", digits) : null;
    let hist4 = useb ? subtract(macd4, signal4, digits) : null;

    // wave C
    let fastMA5 = usec ? utils.ma(tradeData, n, source, "ema", digits) : null;
    let slowMA5 = usec ? utils.ma(tradeData, mc, source, "ema", digits) : null;
    let macd5 = usec ? subtract(fastMA5, slowMA5) : null;
    let signal5 = usec ? utils.ma(macd5, mc, null, "ema", digits) : null;
    let hist5 = usec ? subtract(macd5, signal5, digits) : null;

    let fastMA6 = usec ? utils.ma(tradeData, n, source, "ema", digits) : null;
    let slowMA6 = usec ? utils.ma(tradeData, lc, source, "ema", digits) : null;
    let macd6 = usec ? subtract(fastMA6, slowMA6, digits) : null;
    let signal6 = usec ? utils.ma(macd6, mc, null, "ema", digits) : null;
    let hist6 = usec ? subtract(macd6, signal6, digits) : null;

    return [hist1, hist2, hist3, hist4, hist5, hist6, macd6];
}

export default {
    name: "TTM Wave",
    label: "TTMWave",
    description: "TTM 波浪A B C",
    calculate: ttmwave,
};

// function ttmwave_ol(tradeData, options) {
//     utils.checkTradeData(tradeData);

//     if (
//         _.isEmpty(tradeData) ||
//         !_.isArray(tradeData) ||
//         tradeData.length <= 0
//     ) {
//         return;
//     }

//     let source = (options && options.source) == "ohlc" ? utils.ohlc : "close";
//     let digits = (options && options.digits) || 3;
//     let n = (options && options.n) || 8;
//     // wave A
//     let ma = (options && options.ma) || 34;
//     let la = (options && options.la) || 55;
//     // wave B
//     let mb = (options && options.mb) || 89;
//     let lb = (options && options.lb) || 144;
//     // wave C
//     let mc = (options && options.mb) || 233;
//     let lc = (options && options.lb) || 377;

//     // 优化方式下，从头开始，每天的数据一次性完成
//     let ttmwaves = [];
//     let last = [];
//     for (let i = 0; i < tradeData.length; i++) {
//         let tmp = [];
//         if (i === 0) {
//             // 第一天的特殊数据

//         } else {
//             // wave a
//             // let fastma1 =
//         }
//     }
// }
