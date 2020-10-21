/**
 * RSI 指标，相对强弱指标
 *
 * 参数
 *  n: 表示平均天数
 *  digits: 保留小数位数
 *
 * RSI = 100-[1/1+（avg(gain)/avg(loss)]
 */

import _ from "lodash";
import utils from "../utils";

/**
 * 计算RSI指标
 * @param {Array} tradeData 数据数组
 * @param {*} options 参数配置，RSI包含n属性
 */
function rsi(tradeData, { n = 4, digits = 3 } = {}) {
    utils.checkTradeData(tradeData);

    if (
        _.isEmpty(tradeData) ||
        !_.isArray(tradeData) ||
        tradeData.length <= 0
    ) {
        return;
    }

    let change;
    // let gain = [];
    // let loss = [];
    let avgGain = [];
    let avgLoss = [];
    let ret = [];
    if (!_.isNil(tradeData) && !_.isEmpty(tradeData)) {
        let a = 1.0 / n;
        let sumGain = 0;
        let sumLoss = 0;
        for (let i = 0; i < tradeData.length; i++) {
            if (i <= n) {
                avgGain[i] = 0;
                avgLoss[i] = 0;
            }
            change = tradeData[i].close - tradeData[i].pre_close;
            let gain = change >= 0 ? change : 0.0;
            let loss = change <= 0 ? -change : 0.0;

            if (i <= n - 1) {
                sumGain += gain;
                sumLoss += loss;
                if (i === n - 1) {
                    avgGain[i] = sumGain / n;
                    avgLoss[i] = sumLoss / n;
                    ret[i] = 100 - 100 / (1 + avgGain[i] / avgLoss[i]);
                }
            } else {
                avgGain[i] = a * gain + a * (n - 1) * avgGain[i - 1];
                avgLoss[i] = a * loss + a * (n - 1) * avgLoss[i - 1];
                ret[i] = 100 - 100 / (1 + avgGain[i] / avgLoss[i]);
            }

            // console.log(
            //     `${tradeData[i].trade_date}, ${tradeData[i].close}, ${
            //         avgGain[i]
            //     }, ${avgLoss[i]}, ${ret[i] && ret[i].toFixed(2)}`
            // );
        }
        // let avgGain = utils.ma(gain, n, null, "ma", digits);
        // let avgLoss = utils.ma(loss, n, null, "ma", digits);

        // return avgLoss.map((loss, index) => {
        //     let ret = 0;
        //     if (avgLoss[index] === 0) {
        //         ret = 100.0;
        //     } else {
        //         ret = 100 - 100 / (1 + avgGain[index] / avgLoss[index]);
        //     }
        //     console.log(
        //         `${tradeData[index].trade_date}, ${tradeData[index].close}, ${avgGain[index]}, ${avgLoss[index]}`
        //     );
        //     return ret;
        // });
    }
    return ret;
}

export default {
    name: "RSI",
    label: "相对强弱指标",
    description: "用于表达价格的超买超卖情况",
    calculate: rsi,
};
