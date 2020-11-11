/**
 * TTM Trend
 * 暂未完成，这个部分书上的描述并不清晰，对于如何比较前六个柱价格和当前柱的关系无法准确确定
 *
 * 摘抄：
 * 这项技术将前6根柱状线价格做平均。如果前面6根柱状线的平均价格位于交易区间的上半部分，
 * 则把当前柱状线涂成蓝色，代表偏向看涨和稳定的买方压力。然而，如果前面6根柱状线的平均
 * 价格位于交易区间的下半部分，那么当前柱状线将被涂成红色，代表偏向看跌和稳定的卖方压力。
 *
 * 参数
 *  n: 6 过去的天数
 *  type: TTM | HA
 */
import _ from "lodash";
import utils from "../utils";

const HADATA = Symbol("HADATA");

// 这里需要预先计算好HA的4个价格，并且进行记录，主要是open价格和前一日的HA开盘及收盘相关
function calculateHA(tradeData) {
    if (_.isNil(tradeData)) return;
    if (
        _.isNil(tradeData[HADATA]) ||
        (tradeData && tradeData.length != tradeData[HADATA].length)
    ) {
        // 计算
        let hadata = [];
        for (let i = 0; i < tradeData.length; i++) {
            if (i === 0) {
                let ho = tradeData[i].open;
                hadata[i] = {
                    open: tradeData[i].open,
                    high: tradeData[i].high,
                    low: tradeData[i].low,
                    close: tradeData[i].close,
                };
            } else {
                hadata[i] = {
                    open: (hadata[i - 1].open + hadata[i - 1].close) / 2,
                    high: tradeData[i].high,
                    low: tradeData[i].low,
                    close:
                        (tradeData[i].open +
                            tradeData[i].high +
                            tradeData[i].low +
                            tradeData[i].close) /
                        4,
                };
                hadata[i].high = Math.max(
                    hadata[i].high,
                    hadata[i].open,
                    hadata[i].close
                );
                hadata[i].low = Math.min(
                    hadata[i].low,
                    hadata[i].open,
                    hadata[i].close
                );
            }
        }
        tradeData[HADATA] = hadata;
    }
}

/**
 * 计算每日的趋势情况，返回值设置为涨或跌，用1和0表示
 * @param {*} tradeData 所有数据
 * @param {*} options 参数，n 平均周期, type 平均类型, digits 保留小数位数
 */
function ttmtrend(tradeData, { n = 6, type = "TTM" } = {}) {
    utils.checkTradeData(tradeData);
    calculateHA(tradeData);

    let trends = [];
    // TTM暂未实现，只能给出HA结果！
    type = "HA";
    if (!_.isNil(tradeData) && !_.isEmpty(tradeData)) {
        for (let i = 0; i < tradeData.length; i++) {
            let data = tradeData[i];
            let up = data.close >= data.open;

            let trend;
            if (type === "TTM") {
                if (i === 0) {
                    trend =
                        (tradeData[0].open + tradeData[0].close) / 2 >=
                        (tradeData[0].high + tradeData[0].low) / 2
                            ? 1
                            : 0;
                } else {
                    // let hl = (data.high + data.low) / 2;
                    let avg = 0;
                    let high = 0;
                    let low = Number.MAX_VALUE;
                    let len = 0;
                    for (let j = 0; j < n; j++) {
                        if (i - j - 1 >= 0) {
                            let ld = tradeData[i - j - 1];
                            avg += (ld.open + ld.close) / 2;
                            high = Math.max(high, ld.high);
                            low = Math.min(low, ld.low);
                            len++;
                        } else {
                            break;
                        }
                    }
                    avg = avg / len / 2;
                    let hl = (high + low) / 2;
                    trend = hl >= avg;
                }
            } else if (type === "HA") {
                // HA pattern
                if (i > 0) {
                    // let o =
                    //     (tradeData[i - 1].open + tradeData[i - 1].close) / 2;
                    // let c =
                    //     (tradeData[i].open +
                    //         tradeData[i].high +
                    //         tradeData[i].low +
                    //         tradeData[i].close) /
                    //     4;
                    let hadata = tradeData[HADATA];
                    // if (!(hadata && hadata[i]) && i > 0) {
                    //     hadata[i] = {
                    //         open:
                    //             (hadata[i - 1].open + hadata[i - 1].close) / 2,
                    //         high: tradeData[i].high,
                    //         low: tradeData[i].low,
                    //         close:
                    //             (tradeData[i].open +
                    //                 tradeData[i].high +
                    //                 tradeData[i].low +
                    //                 tradeData[i].close) /
                    //             4,
                    //     };
                    //     hadata[i].high = Math.max(
                    //         hadata[i].high,
                    //         hadata[i].open,
                    //         hadata[i].close
                    //     );
                    //     hadata[i].low = Math.min(
                    //         hadata[i].low,
                    //         hadata[i].open,
                    //         hadata[i].close
                    //     );
                    // }
                    let o = hadata[i].open;
                    let c = hadata[i].close;
                    //up = c >= o;
                    // 1/0表示正常升降，3/2表示修改升降
                    trend = c >= o;
                }
                //trends[i] = up;
            }

            if (up) {
                trends[i] = trend ? 1 : 2;
            } else {
                trends[i] = trend ? 3 : 0;
            }
        }
    }

    return trends;
}

export default {
    name: "TTM趋势",
    label: "TTMTrend",
    description: "将前几日的市场情况纳入到对今日趋势的判断中",
    calculate: ttmtrend,
};
