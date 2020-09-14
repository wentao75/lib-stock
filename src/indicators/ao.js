/**
 * 基本动量指标
 *
 * 参数：
 *  n: 短期平均天数
 *  m: 长期平均天数
 *  source: hl, ohlc
 */

import _ from "lodash";
import utils from "./utils";

function ao(tradeData, options) {
    utils.checkTradeData(tradeData);

    if (
        !_.isEmpty(tradeData) &&
        _.isArray(tradeData) &&
        tradeData.length > 0 &&
        options &&
        options.n >= 1 &&
        options.m >= 1
    ) {
        let source =
            options && options.source === "ohlc" ? utils.ohlc : utils.hl;
        let digits = options.digits || 2;

        let ma1 = utils.ma(tradeData, options.n, source, "ma", digits);
        let ma2 = utils.ma(tradeData, options.m, source, "ma", digits);

        let momentum = tradeData.map((item, i, all) => {
            if (i >= options.n && i > options.m) {
                return utils.toFixed(ma1[i] - ma2[i], digits);
            } else {
                return 0;
            }
        });
        return momentum;
    }
}

export default {
    name: "AO",
    label: "动量震动指标",
    description: "比尔威廉姆斯动量振荡器指标",
    calculate: ao,
};
