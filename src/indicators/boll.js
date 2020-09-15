/**
 * 布林线指标
 *
 * 参数：
 *  n: 移动平均天数
 *  m: 上下轨到移动平均的标准差倍数
 *  source: close | ohlc
 *  ma: 移动平均类型，ma | ema
 *
 */
import utils from "./utils";
import MA from "./ma";

function boll(tradeData, options) {
    utils.checkTradeData(tradeData);

    let ma = MA.calculate(tradeData, {
        n: options.n,
        type: options.ma,
        source: options.source,
        digits: options.digits,
    });
    if (!ma) return;
    let stdev = utils.stdev(
        tradeData,
        options.n,
        (options && options.source) === "ohlc" ? utils.ohlc : "close",
        options.digits
    );
    if (!stdev) return;

    let up = [];
    let down = [];
    for (let i = 0; i < ma.length; i++) {
        up[i] = utils.toFixed(ma[i] + options.m * stdev[i], options.digits);
        down[i] = utils.toFixed(ma[i] - options.m * stdev[i], options.digits);
    }

    return [ma, up, down, stdev];
}

export default {
    name: "BOLL",
    label: "布林线",
    description: "布林线指标",
    calculate: boll,
};
