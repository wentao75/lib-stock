/**
 * Keltner Channel，肯特钠通道
 * 类似于布林带的带状指标，由上中下三条轨道组成
 *
 * 中轨：移动平均线，参数n
 * 上/下轨：移动平均线上下ATR*m距离
 *
 * 参数定义：
 *  n：移动平均天数，默认12，（Squeeze 为20）
 *  m：通道和中轨之间ATR值的倍数，默认1.5
 *  type1：价格移动平均类型，ma 简单移动平均，ema 指数移动平均，默认ema
 *  type2：atr移动平均类型，ma ｜ ema，默认 ma
 */
import _ from "lodash";
import MA from "./ma";
import ATR from "./atr";
// import utils from "./utils";

function keltner(tradeData, options) {
    let ma = MA.ma(tradeData, { n: options.n, type: options.type1 });
    let atr = ATR.atr(tradeData, { n: options.n, type: options.type2 });
    let up = [];
    let down = [];
    for (let i = 0; i < ma.length; i++) {
        up[i] = ma[i] + options.m * atr[i];
        down[i] = ma[i] - options.m * atr[i];
    }

    return [ma, up, down, atr];
}

export default {
    name: "科特钠通道",
    label: "KC",
    description: "科特钠通道",
    keltner,
};
