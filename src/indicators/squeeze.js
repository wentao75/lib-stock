/**
 * 鸡排指标，Squeeze，From Mastering the Trade (3rd Ed)
 *
 * 参数：
 *  source: close | ohlc
 *  ma: ma | ema
 *  n: 20
 *  bm: 2
 *  km: 1.5
 *  mt: "MTM" || "WAVE"
 *  mn: 5
 *  mm: 12
 *
 *  ditis: 3
 *
 */
import _ from "lodash";
import KC from "./keltner-channel";
import BOLL from "./boll";
import MTM from "./mtm";
// import AO from "./ao";
import TTMWave from "./ttmwave";
import utils from "./utils";

const READY = "READY";
const REST = "--";
const BUY = "BUY";
const SELL = "SELL";

function squeeze(
    tradeData,
    {
        source = "close",
        digits = 3,
        ma = "ema",
        n = 20,
        km = 1.5,
        bm = 2,
        mt = "MTM",
        mn = 12,
        mm = 1,
        tn = 5,
        tm = 21,
        tl = 34,
    } = {}
) {
    utils.checkTradeData(tradeData);

    if (source === "ohlc") {
        source = utils.ohlc;
    } else {
        source = "close";
    }
    // let source = (options && options.source) || "close";
    // let digits = (options && options.digits) || 3;
    // let ma = (options && options.ma) || "ema";
    // let n = (options && options.n) || 20;
    // // kc边界倍数
    // let km = (options && options.km) || 1.5;
    // // boll边界倍数
    // let bm = (options && options.bm) || 2;
    // // 动量指标参数
    // let mt = (options && options.mt) || "MTM";
    // let mn = (options && options.mn) || 12;
    // let mm = (options && options.mm) || 1;
    // let mmsource = (options && options.mmsource) || "hl";

    // // TTM Wave
    // let tn = (options && options.tn) || 5;
    // let tm = (options && options.tm) || 21;
    // let tl = (options && options.tl) || 34;

    let kcData = KC.calculate(tradeData, {
        n,
        m: km,
        type1: ma,
        type2: ma,
        source,
        digits,
    });
    let bollData = BOLL.calculate(tradeData, {
        n,
        m: bm,
        ma,
        source,
        digits,
    });

    let mtmData = MTM.calculate(tradeData, {
        n: mn,
        m: mm,
        source,
        digits,
    });

    let waveData = TTMWave.calculate(tradeData, {
        n: tn,
        ma: tm,
        la: tl,
        source,
        digits,
        useb: false,
        usec: false,
    });

    let mmData = mt === "MTM" ? mtmData : waveData && waveData[0];

    // 下面根据轨道情况，判断状态，状态区分如下
    // 1. boll进kc，启动警告状态：READY
    // 2. boll出kc，进入交易状态：
    //   2.1 mm>0，买入（多头）：BUY
    //   2.2 mm<=0，卖出（空头）：SELL
    // 3. mm 降低，交易结束：--
    let currentState = REST;
    let states = tradeData.map((item, i, all) => {
        let ready =
            bollData &&
            kcData &&
            bollData[1][i] &&
            kcData[1][i] &&
            bollData[1][i] <= kcData[1][i];

        let mmUp = mmData && mmData[i] && mmData[i] >= 0;
        // mt === "MTM"
        //     ? mmData && mmData[i] && mmData[i] >= 0
        //     : waveData && waveData[0] && waveData[0][i] >= 0;

        let nextState = currentState;
        if (currentState === REST) {
            if (ready) {
                nextState = READY;
            }
        } else if (currentState === READY) {
            if (!ready) {
                nextState = mmUp ? BUY : SELL;
            }
        } else if (currentState === BUY || currentState === SELL) {
            if (ready) {
                // 再次进入等待
                nextState = READY;
            } else {
                // 检查是否出现动能减弱
                if (
                    mmData &&
                    mmData[i] &&
                    mmData[i - 1] &&
                    ((currentState === BUY && mmData[i] < mmData[i - 1]) ||
                        (currentState === SELL && mmData[i] > mmData[i - 1]))
                ) {
                    nextState = REST;
                }
            }
        }
        currentState = nextState;
        return nextState;
    });

    return [
        kcData && kcData[0],
        bollData && bollData[1],
        bollData && bollData[2],
        kcData && kcData[1],
        kcData && kcData[2],
        mmData,
        states,
        mtmData,
        waveData && waveData[0],
        waveData && waveData[1],
    ];
}

export default {
    name: "SQUEEZE",
    label: "鸡排",
    description: "挤牌信号器指标",
    calculate: squeeze,
    states: {
        REST,
        READY,
        BUY,
        SELL,
    },
};
