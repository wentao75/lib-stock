/**
 * 基本动量指标
 *
 * 参数：
 *  n: 动量周期
 *  m: 平均天数
 *  source: close, ohlc
 */

import _ from "lodash";
import utils from "./utils";

function mtm(tradeData, options) {
    utils.checkTradeData(tradeData);

    if (
        !_.isEmpty(tradeData) &&
        _.isArray(tradeData) &&
        tradeData.length > 0 &&
        options &&
        options.n > 1
    ) {
        let source =
            options && options.source === "ohlc" ? utils.ohlc : "close";
        let digits = options.digits || 3;
        let ma;
        if (options && options.m && options.m > 1) {
            ma = utils.ma(tradeData, options.m, source, "ma", digits);
        } else {
            ma = utils.ma(tradeData, 1, source, "ma", digits);
        }

        let momentum = tradeData.map((item, i, all) => {
            if (i > options.n) {
                return utils.toFixed(
                    ma[i] - ma[i - options.n],
                    //utils.readData(item, source) - ma[i - options.n],
                    //utils.readData(all[i - options.n], source),
                    digits
                );
            } else {
                return 0;
            }
        });
        // momentum = utils.ma(momentum, 6, undefined, "ma");
        return momentum;
    }
}

export default {
    name: "MTM",
    label: "动量指标",
    description: "动量振荡器指标",
    calculate: mtm,
};
