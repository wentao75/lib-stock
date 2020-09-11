import _ from "lodash";

function readData(item, prop) {
    if (_.isFunction(prop)) {
        return prop(item);
    } else if (_.isString(prop)) {
        return item && item[prop];
    }
    return item;
}

function average(array, index, n, prop) {
    if (
        index >= 0 &&
        array &&
        Array.isArray(array) &&
        array.length > index &&
        n > 0
    ) {
        let calcArr = array.slice(index - n + 1, index + 1);
        return (
            calcArr
                .map((item, i, all) => {
                    return readData(item, prop);
                })
                .reduce((total, item) => {
                    return total + item;
                }, 0) / n
        );
    }
}

function ma(array, n, prop, type) {
    if (type === "ma") {
        return sma(array, n, prop);
    } else {
        return ema(array, n, prop);
    }
}

function sma(array, n, prop) {
    if (array && Array.isArray(array) && array.length > 0 && n > 0) {
        return array.map((item, i, all) => {
            if (i < n - 1) {
                return;
            } else {
                return average(all, i, n, prop);
            }
        });
    }
}

function ema(array, n, prop) {
    if (array && Array.isArray(array) && array.length > 0 && n > 0) {
        let tmp = 0;
        return array.map((item, i, all) => {
            if (i === 0) {
                tmp = readData(item, prop);
            } else {
                tmp = (2 * readData(item, prop) + (n - 1) * tmp) / (n + 1);
            }
            return tmp;
        });
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

export default { average, ma, sma, ema, tr };
