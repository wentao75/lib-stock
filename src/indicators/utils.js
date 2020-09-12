import _ from "lodash";

const ORGANIZED = Symbol("表示数据是否经过检查和整理");

/**
 * 对交易数据按照结构进行检查，检查后需要满足
 * 1. 数组结构
 * 2. 交易日期按照时间升序排列，0为最早的数据
 * 3. 如果提供了赋权因子，进行前复权计算
 * 4. 设置ORGANIZED标记为true
 *
 * @param {*} data 交易数据（日线）
 */
function checkTradeData(data, digits = 2) {
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
function calculatePrevAdjPrice(dailyData, digits = 2) {
    if (dailyData && dailyData.data && dailyData.data.length > 0) {
        dailyData.data.forEach((item) => {
            if (item.prevadj_factor) {
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
            }
        });
    }
}

function readData(item, prop) {
    if (_.isFunction(prop)) {
        return prop(item);
    } else if (_.isString(prop)) {
        return item && item[prop];
    }
    return item;
}

function toFixed(num, digits = 2) {
    return Number(num.toFixed(digits));
}

function checkOrder(array) {
    return (
        array &&
        _.isArray(array) &&
        array.length > 1 &&
        array[0].trade_date > array[array.length - 1].trade_date
    );
}

function average(array, index, n, prop, digits = 2) {
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

function ma(array, n, prop, type, digits = 2) {
    if (type === "ma") {
        return sma(array, n, prop);
    } else {
        return ema(array, n, prop);
    }
}

function sma(array, n, prop, digits = 2) {
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

function ema(array, n, prop, digits = 2) {
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

/**
 *
 * @param {Array} array 数据数组
 * @param {number} n 平均天数
 * @param {*} prop 数据属性或转换方法
 * @param {string} type 偏差类型
 * @param {boolean} desc 数据数组是否降序
 * @param {number} digits 小数保留位数
 */
function stdev(array, n, prop, digits = 2) {
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
                    sum += (readData(array[j], prop) - ma) ** 2;
                    count++;
                    j -= step;
                }
                d = toFixed(Math.sqrt(sum / (n - 1)), digits);
            }

            ret[index] = d;
            index++;
            i += step;
        }
        return ret;
    }
}

export default {
    average,
    ma,
    sma,
    ema,
    stdev,
    tr,
    ohlc,
    readData,
    toFixed,
    checkTradeData,
};
