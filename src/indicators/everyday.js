/**
 * 每日指标，Everyday，这里将几个指标组合用于选股和展示
 * 指标包括：
 * 1. TTM
 * 2. Squeeze
 * 3. WVF（Boll and OSC）
 *
 * 参数：
 *  1. 趋势配置
 *    limit: 0.0
 *    trendLB: 3
 *    usewb: false
 *    sqzLongLevel: 2
 *    longLevel: 2
 *    shortLevel: 2
 *    minTotoalTrend: 2
 *  2. Squeeze参数
 *    source: ohlc | close
 *    useTR: true
 *    ma: ma | ema
 *    sqzLength: 20
 *    multBB: 2
 *    multKC: 1.5
 *    mtmLen: 12
 *    mtmSmooth: 1
 *  3. WVF
 *    pd: 22
 *    bbl: 20
 *    mult: 2.0
 *    lb: 50
 *    ph: 0.85
 *    oscn: 14
 *    oscup: 85.0
 *    oscdn: 20.0
 *    oscSmooth: 5
 *  ditis: 3
 *
 */
import _ from "lodash";
import MA from "./ma";
import BOLL from "./boll";
import MTM from "./mtm";
import KC from "./keltner-channel";
import WVF from "./wvf";
import utils from "../utils";

const BUY = "BUY";
const SELL = "SELL";
const UP = "UP";
const DOWN = "DOWN";

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

function everyday(
    tradeData,
    {
        limit = 0.0,
        trendLB = 3,
        usewb = false,
        sqzLongLevel = 2,
        longLevel = 2,
        shortLevel = 2,
        minTotalTrend = 2,

        source = "ohlc",
        //useTR = true,
        ma = "ma",
        sqzLength = 20,
        multBB = 2,
        multKC = 1.5,
        mtmLen = 12,
        mtmSmooth = 1,

        pd = 22,
        bbl = 20,
        mult = 2.0,
        lb = 50,
        ph = 0.85,
        oscn = 14,
        oscup = 85.0,
        oscdn = 20.0,
        oscSmooth = 5,

        digits = 3,
    } = {}
) {
    utils.checkTradeData(tradeData);

    // TTMWave
    // wave A
    // let n = 8;
    let fastMA = utils.ma(tradeData, 8, "close", "ema", digits + 5);

    let slowMA1 = utils.ma(tradeData, 34, "close", "ema", digits + 5);
    let macd1 = subtract(fastMA, slowMA1);
    let signal1 = utils.ma(macd1, 34, null, "ema", digits + 5);
    let hist1 = subtract(macd1, signal1, digits);

    // let fastMA2 = utils.ma(tradeData, 8, "close", "ema", digits);
    let slowMA2 = utils.ma(tradeData, 55, "close", "ema", digits + 5);
    let macd2 = subtract(fastMA, slowMA2);
    let signal2 = utils.ma(macd2, 55, null, "ema", digits + 5);
    let hist2 = subtract(macd2, signal2, digits);

    // wave B
    // let fastMA3 = utils.ma(tradeData, 8, "close", "ema", digits);
    let slowMA3 = utils.ma(tradeData, 89, "close", "ema", digits + 5);
    let macd3 = subtract(fastMA, slowMA3);
    let signal3 = utils.ma(macd3, 89, null, "ema", digits + 5);
    let hist3 = subtract(macd3, signal3, digits);

    // let fastMA4 = utils.ma(tradeData, 8, "close", "ema", digits);
    let slowMA4 = utils.ma(tradeData, 144, "close", "ema", digits + 5);
    let macd4 = subtract(fastMA, slowMA4);
    let signal4 = utils.ma(macd4, 144, null, "ema", digits + 5);
    let hist4 = subtract(macd4, signal4, digits);

    // wave C
    // let fastMA5 = utils.ma(tradeData, 8, "close", "ema", digits);
    let slowMA5 = utils.ma(tradeData, 233, "close", "ema", digits + 5);
    let macd5 = subtract(fastMA, slowMA5);
    let signal5 = utils.ma(macd5, 233, null, "ema", digits + 5);
    let hist5 = subtract(macd5, signal5, digits);

    // let fastMA6 = utils.ma(tradeData, 8, "close", "ema", digits);
    let slowMA6 = utils.ma(tradeData, 377, "close", "ema", digits + 5);
    let macd6 = subtract(fastMA, slowMA6, digits);
    // let signal6 =  utils.ma(macd6, 377, null, "ema", digits);
    // let hist6 =  subtract(macd6, signal6, digits) ;

    // TODO
    // 利用TTMWave，需要计算 sTrend, mTrend, lTrend，以及组合的trendSignal和ttmTrend，共5个指标
    // 期中 trendSignal(sTrend, mTrend, lTrend)主要由趋势进行判断；而ttmTrend主要由取值是否为正判断
    let sTrend = [];
    let mTrend = [];
    let lTrend = [];
    let trendSignal = [];
    let ttmTrend = [];

    // Squeeze
    let bollData = BOLL.calculate(tradeData, {
        n: sqzLength,
        m: multBB,
        ma,
        source,
        digits,
    });
    let kcData = KC.calculate(tradeData, {
        n: sqzLength,
        m: multKC,
        type1: ma,
        type2: ma,
        source,
        digits,
    });

    let mtmData = MTM.calculate(tradeData, {
        n: mtmLen,
        m: 1,
        source: "close",
        digits,
    });
    let mtmVal = utils.ma(mtmData, mtmSmooth, null, "ma", digits);
    let sqzState = [];
    let mtmState = [];

    let sqzBuySignal = [];
    let sqzSellSignal = [];
    for (let i = 0; i < tradeData.length; i++) {
        // TTM 趋势计算
        let h1t = hist1[i] - utils.nz(hist1, i - 1) >= 0;
        let h1tl = hist1[i] - utils.nz(hist1, i - 1) >= limit;
        let h2t = hist2[i] - utils.nz(hist2, i - 1) >= 0;
        let h2tl = hist2[i] - utils.nz(hist2, i - 1) >= limit;
        let shortTrend = h1t && h2t ? 2 : h1tl || h2tl ? 1 : 0;

        let h1tLB = hist1[i] - utils.nz(hist1, i - trendLB) >= 0;
        let h1tlLB = hist1[i] - utils.nz(hist1, i - trendLB) >= limit;
        let h2tLB = hist2[i] - utils.nz(hist2, i - trendLB) >= 0;
        let h2tlLB = hist2[i] - utils.nz(hist2, i - trendLB) >= limit;
        let shortTrendLB = h1tLB && h2tLB ? 2 : h1tlLB || h2tlLB ? 1 : 0;

        sTrend[i] =
            shortTrend != 0 && shortTrendLB != 0 ? 2 : shortTrend != 0 ? 1 : 0;

        let h3t = hist3[i] - utils.nz(hist3, i - 1) >= 0;
        let h3tl = hist3[i] - utils.nz(hist3, i - 1) >= limit;
        let h4t = hist4[i] - utils.nz(hist4, i - 1) >= 0;
        let h4tl = hist4[i] - utils.nz(hist4, i - 1) >= limit;
        let middleTrend = h3t && h4t ? 2 : h3tl || h4tl ? 1 : 0;

        let h3tLB = hist3[i] - utils.nz(hist3, i - trendLB) >= 0;
        let h3tlLB = hist3[i] - utils.nz(hist3, i - trendLB) >= limit;
        let h4tLB = hist4[i] - utils.nz(hist4, i - trendLB) >= 0;
        let h4tlLB = hist4[i] - utils.nz(hist4, i - trendLB) >= limit;
        let middleTrendLB = h3tLB && h4tLB ? 2 : h3tlLB || h4tlLB ? 1 : 0;

        mTrend[i] =
            middleTrend != 0 && middleTrendLB != 0
                ? 2
                : middleTrend != 0 || middleTrendLB != 0
                ? 1
                : 0;

        let h5t = hist5[i] - utils.nz(hist5, i - 1) >= 0;
        let h5tl = hist5[i] - utils.nz(hist5, i - 1) >= limit;
        let h6t = macd6[i] - utils.nz(macd6, i - 1) >= 0;
        let h6tl = macd6[i] - utils.nz(macd6, i - 1) >= limit;
        let longTrend = h5t && h6t ? 2 : h5tl || h6tl ? 1 : 0;

        let h5tLB = hist5[i] - utils.nz(hist5, i - trendLB) >= 0;
        let h5tlLB = hist5[i] - utils.nz(hist5, i - trendLB) >= limit;
        let h6tLB = macd6[i] - utils.nz(macd6, i - trendLB) >= 0;
        let h6tlLB = macd6[i] - utils.nz(macd6, i - trendLB) >= limit;
        let longTrendLB = h5tLB && h6tLB ? 2 : h5tlLB || h6tlLB ? 1 : 0;

        lTrend[i] =
            longTrend != 0 && longTrendLB != 0
                ? 2
                : longTrend != 0 || longTrendLB != 0
                ? 1
                : 0;

        trendSignal[i] = sTrend[i] + (usewb ? mTrend[i] : lTrend[i]);
        // 中长期趋势，主要表达进入上升还是下降阶段
        ttmTrend[i] =
            (hist3[i] && hist3[i] >= 0 ? 1 : 0) +
            (hist4[i] && hist4[i] >= 0 ? 1 : 0) +
            (hist5[i] && hist5[i] >= 0 ? 1 : 0) +
            (macd6[i] && macd6[i] >= 0 ? 1 : 0);

        // squeeze状态
        let upperBB = bollData && bollData[1] && bollData[1][i];
        let upperKC = kcData && kcData[1] && kcData[1][i];
        let sqzOn = upperBB && upperKC && upperBB < upperKC;
        // let sqzOff = upperBB && upperKC && upperBB >= upperKC;
        // let noSqz = sqzOn == false && sqzOff == false;
        sqzState[i] = sqzOn ? 1 : 0;
        mtmState[i] =
            mtmVal && mtmVal[i] && mtmVal[i] > 0
                ? i > 0 &&
                  mtmVal &&
                  mtmVal[i] &&
                  mtmVal[i - 1] &&
                  mtmVal[i] > mtmVal[i - 1]
                    ? 1
                    : 2
                : i > 0 &&
                  mtmVal &&
                  mtmVal[i] &&
                  mtmVal[i - 1] &&
                  mtmVal[i] < mtmVal[i - 1]
                ? -1
                : -2;

        sqzBuySignal[i] =
            i > 0 &&
            sqzState[i] === 0 &&
            sqzState[i - 1] === 1 &&
            mtmVal[i] >= 0 &&
            mtmVal[i] > utils.nz(mtmVal, i - 1) &&
            trendSignal[i] >= longLevel
                ? 2
                : sqzState[i] === 1 &&
                  mtmVal[i] >= 0 &&
                  mtmVal[i] > utils.nz(mtmVal, i - 1) &&
                  trendSignal[i] >= sqzLongLevel
                ? 1
                : 0;

        sqzSellSignal[i] =
            sqzState[i] === 0 &&
            utils.nz(sqzState, i - 1) === 1 &&
            !(mtmVal[i] >= 0 && mtmVal[i] >= utils.nz(mtmVal, i - 1))
                ? 2
                : sqzState[i] === 1 && (shortTrend === 0 || shortTrendLB === 0)
                ? 1
                : 0;
    }

    // WVF
    let wvf = WVF.calculate(tradeData, { n: pd, digits });
    let wvfma = MA.calculate(wvf, {
        n: bbl,
        type: "ma",
        source: null,
        digits,
    });
    let rangeHigh = [];

    let ohc = [];
    let olc = [];
    let osc = [];
    let oscMA = [];

    let wvfStdev = utils.stdev(wvf, bbl, null, digits);
    let wvfup = [];
    let wvfdown = [];
    let wvfSignal1 = [];
    let wvfSignal2 = [];
    let wvfSignal = [];
    let oscSignal1 = [];
    let oscSignal2 = [];
    let oscSignal = [];
    let oscFilter = [];

    let wvfBuySignal = [];
    let longCondition = [];
    let shortCondition = [];
    for (let i = 0; i < wvfma.length; i++) {
        rangeHigh[i] = utils.highest(wvf, i, lb, null, digits);
        ohc[i] = utils.highest(wvf, i, oscn, null, digits);
        olc[i] = utils.lowest(wvf, i, oscn, null, digits);
        wvfup[i] = utils.toFixed(wvfma[i] + mult * wvfStdev[i], digits);
        wvfdown[i] = utils.toFixed(wvfma[i] - mult * wvfStdev[i], digits);

        rangeHigh[i] =
            rangeHigh && rangeHigh[i] ? rangeHigh[i] * ph : rangeHigh[i];

        osc[i] =
            wvf[i] && olc[i] && ohc[i] && ohc[i] - olc[i] != 0
                ? (100.0 * (wvf[i] - olc[i])) / (ohc[i] - olc[i])
                : 0;
        [, , oscMA[i]] = utils.linreg(osc, i, null, oscSmooth);

        wvfSignal1[i] = wvf[i] >= wvfup[i] || wvf[i] >= rangeHigh[i] ? 1 : 0;
        wvfSignal2[i] =
            (utils.nz(wvf, i - 1) >= utils.nz(wvfup, i - 1) ||
                utils.nz(wvf, i - 1) >= utils.nz(rangeHigh, i - 1)) &&
            wvf[i] < wvfup[i] &&
            wvf[i] < rangeHigh[i]
                ? 1
                : 0;
        wvfSignal[i] = wvfSignal2[i];

        oscSignal1[i] =
            osc[i] && osc[i] > oscup ? 1 : osc[i] && osc[i] < oscdn ? -1 : 0;
        oscSignal2[i] =
            oscMA[i] && oscMA[i] > oscup
                ? 1
                : oscMA[i] && oscMA[i] < oscdn
                ? -1
                : 0;
        oscFilter[i] = oscSignal1[i] === 1 || oscSignal2[i] === 1;
        oscSignal[i] =
            oscFilter[i] === false && utils.nz(oscFilter, i - 1, false) === true
                ? 1
                : 0;

        wvfBuySignal[i] =
            oscSignal[i] === 1 && wvfSignal[i] === 1
                ? 2
                : oscSignal[i] === 1 || wvfSignal[i] === 1
                ? 1
                : 0;
        longCondition[i] =
            trendSignal[i] >= longLevel &&
            wvfBuySignal[i] !== 0 &&
            sqzBuySignal[i] != 0 &&
            ttmTrend[i] >= minTotalTrend
                ? 2
                : ((trendSignal[i] >= longLevel && wvfBuySignal[i] !== 0) ||
                      sqzBuySignal[i] !== 0) &&
                  ttmTrend[i] >= minTotalTrend
                ? 1
                : 0;

        let mlTrend = usewb ? mTrend[i] : lTrend[i];
        shortCondition[i] = sTrend[i] === 0 && mlTrend < shortLevel ? 1 : 0;
    }

    let len = tradeData.length;
    // console.log(
    //     `数据检查：${tradeData[len - 1].open}, ${rangeHigh[len - 1]}, ${
    //         ohc[len - 1]
    //     }, ${olc[len - 1]}, ${wvf[len - 1]}, ${osc[len - 1]}, ${
    //         oscMA[len - 1]
    //     }, ${oscMA[len - 2]}`
    // );
    // console.log(
    //     `数据检查：${tradeData[len - 1].close}, ${
    //         tradeData[len - 1 - 12].close
    //     }, ${bollData[1][len - 1]}, ${kcData[1][len - 1]}, ${
    //         sqzState[len - 1]
    //     }, ${sqzState[len - 10]},${sqzState[len - 11]},${mtmState[len - 1]}, ${
    //         mtmState[len - 2]
    //     }, ${mtmState[len - 7]},${mtmState[len - 8]},  ${mtmVal[len - 1]}, ${
    //         mtmVal[len - 2]
    //     }`
    // );
    // console.log(
    //     `数据检查：[${len}] ${
    //         tradeData[len - 1] && tradeData[len - 1].trade_date
    //     }, ${tradeData[len - 1] && tradeData[len - 1].close}, ${
    //         tradeData[len - 1 - 89] && tradeData[len - 1 - 89].trade_date
    //     }, ${tradeData[len - 1 - 89] && tradeData[len - 1 - 89].close}, ${
    //         tradeData[len - 1 - 233] && tradeData[len - 1 - 233].trade_date
    //     }, ${tradeData[len - 1 - 233] && tradeData[len - 1 - 233].close}, f=${
    //         fastMA[len - 1]
    //     }, sm3=${slowMA3[len - 1]}, m3=${macd3[len - 1]}, s3=${
    //         signal3[len - 1]
    //     }, h3=${hist3[len - 1]}, sm5=${slowMA5[len - 1]}, m5=${
    //         macd5[len - 1]
    //     }, s5=${signal5[len - 1]}, h5=${hist5[len - 1]}`
    // );

    return [
        longCondition, // 0
        shortCondition, // 1
        trendSignal, // 2
        ttmTrend, // 3
        sqzBuySignal, // 4
        sqzSellSignal, // 5
        wvfBuySignal, // 6
        oscSignal, // 7
        undefined, // 8
        undefined, // 9
        undefined, // 10

        // 11 开始放置TTM相关信息
        sTrend, // 11
        mTrend, // 12
        lTrend, // 13
        wvfSignal1, // 14
        wvfSignal2, // 15
        oscSignal1, // 16
        oscSignal2, // 17
        undefined, // 18
        undefined, // 19
        undefined, // 20

        // 21开始放置TTM波数值
        hist1, // 21
        hist2, // 22
        hist3, // 23
        hist4, // 24
        hist5, // 25
        macd6, // 26
        undefined, // 27
        undefined, // 28
        undefined, // 29
        undefined, // 30

        // 31 开始放置鸡排数据
        sqzState, // 31
        mtmState, // 32
        mtmVal, // 33
        undefined, // 34
        undefined, // 35
        undefined, // 36
        undefined, // 37
        undefined, // 38
        undefined, // 39
        undefined, // 40

        // 41 开始放置WVF数据
        wvf, // 41
        wvfma, // 42
        wvfup, // 43
        wvfdown, // 44
        osc, // 45
        oscMA, // 46
    ];
}

export default {
    name: "EVERYDAY",
    label: "每日",
    description: "每日指标",
    calculate: everyday,
    states: {},
};
