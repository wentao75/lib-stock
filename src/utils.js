import _ from "lodash";

const ORGANIZED = Symbol("表示数据是否经过检查和整理");
const ADJUSTED = Symbol("已经复权处理");

/**
 * 对交易数据按照结构进行检查，检查后需要满足
 * 1. 数组结构
 * 2. 交易日期按照时间升序排列，0为最早的数据
 * 3. 如果提供了赋权因子，进行前复权计算
 * 4. 设置ORGANIZED标记为true
 *
 * @param {*} data 交易数据（日线）
 */
function checkTradeData(data, digits = 3) {
    if (_.isEmpty(data) || data[ORGANIZED]) return data;
    if (!_.isArray(data)) return data;

    // 检查数据排序，如果是降序，则反过来
    if (checkOrder(data)) {
        data.reverse();
    }

    if (data[0] && data[0].prevadj_factor) {
        calculatePrevAdjPrice(data, digits);
    }

    data[ORGANIZED] = true;
    return data;
}

/**
 * 将日线数据中的历史价位根据复权因子全部处理为前复权结果，方便后续计算
 *
 * @param {*} dailyData 日线数据
 * @param {int} digits 保留位数
 */
function calculatePrevAdjPrice(dailyData, digits = 3) {
    if (dailyData && dailyData.length > 0 && !dailyData[ADJUSTED]) {
        dailyData.forEach((item) => {
            if (item.prevadj_factor && !item.origin) {
                // console.log(
                //     `复权前 ${item.trade_date}, ${item.open}, ${item.close}`
                // );
                item.origin = {
                    open: item.open,
                    close: item.close,
                    high: item.high,
                    low: item.low,
                    pre_close: item.pre_close,
                    change: item.change,
                };
                item.open = toFixed(item.open * item.prevadj_factor, digits);
                item.close = toFixed(item.close * item.prevadj_factor, digits);
                item.high = toFixed(item.high * item.prevadj_factor, digits);
                item.low = toFixed(item.low * item.prevadj_factor, digits);
                item.pre_close = toFixed(
                    item.pre_close * item.prevadj_factor,
                    digits
                );
                item.change = toFixed(
                    item.change * item.prevadj_factor,
                    digits
                );
                // console.log(
                //     `复权后 ${item.trade_date}, ${item.open}, ${item.close}`
                // );
            }
        });
        dailyData[ADJUSTED] = true;
    }
}

function readData(item, prop) {
    if (_.isFunction(prop)) {
        return prop(item);
    } else if (_.isString(prop)) {
        if (prop === "tr") {
            return tr(item);
        } else if (prop === "ohlc") {
            return ohlc(item);
        } else if (prop === "hl") {
            return hl(item);
        } else {
            return item && item[prop];
        }
    }
    return item;
}

function toFixed(num, digits = 3) {
    return Number(num.toFixed(digits));
}

function checkOrder(array) {
    return (
        array &&
        _.isArray(array) &&
        array.length > 1 &&
        _.isObject(array[0]) &&
        _.has(array[0], "trade_date") &&
        array[0].trade_date > array[array.length - 1].trade_date
    );
}

function average(array, index, n, prop, digits = 3) {
    if (
        index >= 0 &&
        array &&
        Array.isArray(array) &&
        array.length > index &&
        n > 0
    ) {
        let desc = checkOrder(array);

        let step = desc ? -1 : 1;
        let lastIndex = index - step * n;
        if (lastIndex < 0 || lastIndex >= array.length) {
            return;
        }

        let i = index;
        let count = 0;
        let sum = 0;
        while (i >= 0 && i < array.length && count < n) {
            sum += readData(array[i], prop);
            i -= step;
            count++;
        }
        if (count === n) {
            return toFixed(sum / n, digits);
        }
        // let calcArr = array.slice(index - n + 1, index + 1);
        // return (
        //     calcArr
        //         .map((item, i, all) => {
        //             return readData(item, prop);
        //         })
        //         .reduce((total, item) => {
        //             return total + item;
        //         }, 0) / n
        // );
    }
}

function highest(array, index, n, prop, digits = 3) {
    if (
        index >= 0 &&
        array &&
        Array.isArray(array) &&
        array.length > index &&
        n > 0
    ) {
        let lastIndex = index - n + 1;
        if (lastIndex < 0 || lastIndex >= array.length) {
            return;
        }

        let tmp = readData(array[index], prop);
        for (let i = 1; i < n; i++) {
            if (index - i < 0 || index - i >= array.length) continue;
            tmp = Math.max(tmp, readData(array[index - i], prop));
        }
        return tmp;
    }
}

function lowest(array, index, n, prop, digits = 3) {
    if (
        index >= 0 &&
        array &&
        Array.isArray(array) &&
        array.length > index &&
        n > 0
    ) {
        let lastIndex = index - n + 1;
        if (lastIndex < 0 || lastIndex >= array.length) {
            return;
        }

        let tmp = readData(array[index], prop);
        for (let i = 1; i < n; i++) {
            if (index - i < 0 || index - i >= array.length) continue;
            tmp = Math.min(tmp, readData(array[index - i], prop));
        }
        return tmp;
    }
}

function ma(array, n, prop, type, digits = 3) {
    if (type === "ma") {
        return sma(array, n, prop, digits);
    } else {
        return ema(array, n, prop, digits);
    }
}

function sma(array, n, prop, digits = 3) {
    if (array && Array.isArray(array) && array.length > 0 && n > 0) {
        let desc = checkOrder(array);
        let step = desc ? -1 : 1;
        let i = desc ? array.length - 1 : 0;
        let index = 0;
        let ret = [];
        while (i >= 0 && i < array.length) {
            ret[index] = average(array, i, n, prop, digits);
            index++;
            i += step;
        }
        return ret;
    }
}

function ema(array, n, prop, digits = 3) {
    if (array && Array.isArray(array) && array.length > 0 && n > 0) {
        let desc = checkOrder(array);
        let step = desc ? -1 : 1;
        let i = desc ? array.length - 1 : 0;
        let index = 0;
        let ret = [];
        let tmp = 0;
        while (i >= 0 && i < array.length) {
            if (index === 0) {
                tmp = readData(array[i], prop);
            } else {
                tmp = (2 * readData(array[i], prop) + (n - 1) * tmp) / (n + 1);
            }
            ret[index] = toFixed(tmp, digits);
            index++;
            i += step;
        }
        return ret;
    }
}

/**
 * 计算指定数据的TR值
 * @param {*} data 日线数据
 */
function tr(data) {
    if (data) {
        return Math.max(
            data.high - data.low,
            Math.abs(data.high - data.pre_close),
            Math.abs(data.pre_close - data.low)
        );
    }
}

function ohlc(data) {
    if (data) {
        return (data.open + data.high + data.low + data.close) / 4;
    }
}

function hl(data) {
    if (data) {
        return (data.high + data.low) / 2;
    }
}

/**
 * 用于计算数组数据的布林线结果，返回数组
 * @param {Array} array 数据数组
 * @param {number} n 均线周期
 * @param {number} multi 布林线偏差倍数
 * @param {number}} digits 保留小数位数
 */
function boll(array, n = 20, multi = 2.0, prop = null, digits = 3) {
    let ret = [];
    let ma = sma(array, n, prop, digits);
    if (!ma) return;

    let std = stdev(array, n, prop, digits);
    if (!std) return;

    let up = [];
    let down = [];
    for (let i = 0; i < ma.length; i++) {
        up[i] = toFixed(ma[i] + multi * std[i], digits);
        down[i] = toFixed(ma[i] - multi * std[i], digits);

        ret[i] = [ma[i], up[i], down[i], std[i]];
    }

    // return [ma, up, down, stdev];
    return ret;
}

// function osc(array, prop = null, n = 14, digits = 3) {
//     if (array && Array.isArray(array) && array.length > 0 && n > 0) {
//         let ret = [];

//         for (let i = 0; i < array.length; i++) {
//             let ohc = highest(array, i, n, prop, digits);
//             let olc = lowest(array, i, n, prop, digits);
//             osc =
//         }
//     }
// }

/**
 *
 * @param {Array} array 数据数组
 * @param {number} n 平均天数
 * @param {*} prop 数据属性或转换方法
 * @param {string} type 偏差类型
 * @param {boolean} desc 数据数组是否降序
 * @param {number} digits 小数保留位数
 */
function stdev(array, n, prop, digits = 3) {
    if (array && Array.isArray(array) && array.length > 0 && n > 0) {
        let desc = checkOrder(array);
        let step = desc ? -1 : 1;
        let i = desc ? array.length - 1 : 0;
        let index = 0;
        let ret = [];
        while (i >= 0 && i < array.length) {
            let ma = average(array, i, n, prop, digits);
            let d;

            if (ma) {
                let sum = 0;
                let j = i;
                let count = 0;
                while (j >= 0 && j < array.length && count < n) {
                    let tmp = readData(array[j], prop);
                    sum += (tmp - ma) ** 2;
                    // console.log(
                    //     `j=${j} - ${array[j].trade_date}, ohlc=${tmp}, sum=${sum}`
                    // );
                    count++;
                    j -= step;
                }
                // d = toFixed(Math.sqrt(sum / (n - 1)), digits);
                d = toFixed(Math.sqrt(sum / n), digits);
                // console.log(
                //     `stdev: ${i}, ${array[i].trade_date}, ma=${ma}, stdev=${d}`
                // );
            }

            ret[index] = d;
            index++;
            i += step;
        }
        return ret;
    }
}

function formatFxstr(num) {
    return num.toLocaleString("zh-CN"); //, { style: "currency", currency: "CNY" });
}

export default {
    formatFxstr,
    average,
    ma,
    sma,
    ema,
    stdev,
    tr,
    ohlc,
    hl,
    readData,
    toFixed,
    checkTradeData,
    boll,
    highest,
    lowest,
};
