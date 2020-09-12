/**
 * ATR 指标，平均真实幅度
 *
 * 参数
 *  n: 表示平均天数
 *  type：表示均值类型，ma 算术平均，ema 指数移动平均
 *
 * TR = max[h-l, abs(h-cp), abs(l-cp)]
 * cp 表示昨日收盘
 *
 * ATR = Sum(TR, n)/n, 表示n天TR的算术平均
 */

import _ from "lodash";
import utils from "./utils";

/**
 * 计算ATR指标
 * @param {Array} tradeData 数据数组
 * @param {*} options 参数配置，ATR包含n属性
 */
function atr(tradeData, options) {
    utils.checkTradeData(tradeData);

    return utils.ma(
        tradeData,
        options.n,
        utils.tr,
        options && options.type,
        options && options.digits
    );
}

export default {
    name: "ATR",
    label: "平均真实波幅",
    description: "表示在一定周期内价格的最大波动偏离幅度",
    calculate: atr,
};
