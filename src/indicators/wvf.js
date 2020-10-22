/**
 * WVF指标，Williams VIX Fix
 *
 * 参数
 *  n: 表示回看天数
 *  digits: 保留小数位数
 *
 * RSI = 100-[1/1+（avg(gain)/avg(loss)]
 */

import _ from "lodash";
import utils from "../utils";

/**
 * 计算WVF指标
 * @param {Array} tradeData 数据数组
 * @param {*} options 参数配置，RSI包含n属性
 */
function wvf(tradeData, { n = 4, digits = 3 } = {}) {
    utils.checkTradeData(tradeData);

    if (
        _.isEmpty(tradeData) ||
        !_.isArray(tradeData) ||
        tradeData.length <= 0
    ) {
        return;
    }

    // wvf = ((highest(close, n)-low)/(highest(close, n)))*100
    let wvf = [];
    if (!_.isNil(tradeData) && !_.isEmpty(tradeData)) {
        let highest = 0.0;
        for (let i = 0; i < tradeData.length; i++) {
            if (i < n - 1) {
                continue;
            }

            highest = 0.0;
            for (let j = 0; j < n; j++) {
                let close = tradeData[i - j].close;
                highest = highest >= close ? highest : close;
            }
            wvf[i] = (100.0 * (highest - tradeData[i].low)) / highest;
        }
    }
    return wvf;
}

export default {
    name: "WVF",
    label: "VIX Fix",
    description: "用于计算市场恐慌程度",
    calculate: wvf,
};
