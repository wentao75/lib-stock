/**
 * 平均价
 *
 * 两种类型，
 * ma，算术平均
 * ema，指数移动平均
 */
import _ from "lodash";
import utils from "./utils";

/**
 * 计算移动平均，返回ma数据
 * @param {*} tradeData 所有数据
 * @param {*} options 参数，n 平均周期, type 平均类型, digits 保留小数位数
 */
function ma(tradeData, options) {
    utils.checkTradeData(tradeData);

    return utils.ma(
        tradeData,
        options && options.n,
        "close",
        options && options.type,
        options && options.digits
    );
}

export default {
    name: "均值",
    label: "MA",
    description: "平均收盘价",
    calculate: ma,
};
