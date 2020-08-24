import {
    readStockList,
    readStockData,
    stockDataNames,
} from "@wt/lib-wtda-query";

import moment from "moment";
import _ from "lodash";
import debugpkg from "debug";

// import { formatFxstr } from "./util";

// import stoploss from "./stoploss";
import mmb from "./momentum-breakthrough";
import engine from "./transaction-engine";

const log = console.log;
const debug = debugpkg("sim");

async function simulate(options) {
    // 首先根据设置获得列表，列表内容为需要进行算法计算的各个股票
    //  TODO: 这里先读取全部的列表
    let stockListData = await readStockList();
    if (!stockListData || !stockListData.data) {
        log(`没有读取到股票列表，无法处理日线数据`);
        return;
    }
    let stockList = stockListData.data;
    // 重新过滤可用的
    stockList = await filterStockList(stockList, options);
    log(`算法执行 ${stockList && stockList.length} 条数据`);
    // data存放股票列表的基本信息：
    // {
    //      ts_code: '000001.SZ', symbol: '000001', name: '平安银行',
    //      market: '主板', exchange: 'SZSE',
    //      area: '深圳', industry: '银行', fullname: '平安银行股份有限公司',
    //      enname: 'Ping An Bank Co., Ltd.', curr_type: 'CNY',
    //      list_status: 'L', list_date: '19910403', delist_date: null, is_hs: 'S'
    // }
    // this.log(`%o`, stockList[0]);
    // 后续的执行为列表的循环计算，这里的算法因为主要是CPU计算类型，只有输入和输出部分有I/O运算，因此不考虑

    log("");
    // 下一步开始按照给出的数据循环进行处理
    for (let stockItem of stockList) {
        // this.log(`处理数据：%o`, stockItem);

        // 首先读取日线信息
        let stockData = await readStockData(
            stockDataNames.daily,
            stockItem.ts_code
        );
        // 准备资金账户数据
        let capitalData = {
            balance: options.initBalance, // 初始资金
            stock: { info: null, count: 0, price: 0 }, // 持有股票信息
            transactions: [], // 交易记录 {date: , count: 交易数量, price: 交易价格, total: 总金额, amount: 总价, fee: 交易费用, memo: 备注信息}
        };
        if (stockData) {
            log(
                `[${stockItem.ts_code}]${
                    stockItem.name
                } 【数据更新时间：${moment(stockData.updateTime).format(
                    "YYYY-MM-DD HH:mm"
                )}】`
            );
            // 日线数据条数 ${
            //     stockData.data && stockData.data.length
            // }, 从${stockData.startDate}到${
            //     stockData.endDate
            // }，

            // 首先过滤历史数据，这里将日线数据调整为正常日期从历史到现在
            stockData = await filterStockData(stockData);

            // 全部数据调整为前复权后再执行计算
            calculatePrevAdjPrice(stockData);

            // 开始按照日期执行交易算法
            let startDate = moment("20190101", "YYYYMMDD");
            let currentDate = null;
            for (let index = 0; index < stockData.data.length; index++) {
                let daily = stockData.data[index];
                let tradeDate = moment(daily.trade_date, "YYYYMMDD");
                if (_.isEmpty(currentDate)) {
                    if (startDate.isAfter(tradeDate)) {
                        continue;
                    }
                    debug(
                        `找到开始日期，开始执行算法！${index}, ${daily.trade_date}`
                    );
                }
                currentDate = tradeDate;
                // this.log(`%o`, engine);
                let trans = await engine.executeTransaction(
                    mmb,
                    currentDate,
                    index,
                    stockData.data,
                    stockItem,
                    capitalData,
                    options
                );
            }

            engine.logCapitalReport(log, capitalData);
            if (options.showTrans) {
                engine.logTransactions(log, capitalData);
            }
        } else {
            log(
                `[${stockItem.ts_code}]${stockItem.name} 没有日线数据，请检查！`
            );
        }
    }
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
                item.open = Number(
                    (item.open * item.prevadj_factor).toFixed(digits)
                );
                item.close = Number(
                    (item.close * item.prevadj_factor).toFixed(digits)
                );
                item.high = Number(
                    (item.high * item.prevadj_factor).toFixed(digits)
                );
                item.low = Number(
                    (item.low * item.prevadj_factor).toFixed(digits)
                );
                item.pre_close = Number(
                    (item.pre_close * item.prevadj_factor).toFixed(digits)
                );
                item.change = Number(
                    (item.change * item.prevadj_factor).toFixed(digits)
                );
            }
        });
    }
}

/**
 * 这里定义一个过滤列表的接口方法，利用options来过滤后续使用的股票
 * 返回为一个符合条件的列表
 * 这里后续考虑调整一下接口定义，目前暂时简化处理
 */
async function filterStockList(stockList, options) {
    // let retStockList = [];
    return options.selectedStocks.map((tsCode) => {
        let tmp = stockList.filter((item) => {
            return item.ts_code === tsCode;
        });
        // console.log(`${tmp && tmp.length}, %o`, tmp[0]);
        return tmp[0];
    });
}

/**
 * 这里提供对单个数据的调整，主要应当是一些额外的数据计算添加，周期过滤等
 *
 * @param {*} stockData 股票日线数据对象
 * @param {*} options 数据过滤条件
 */
async function filterStockData(stockData, options) {
    stockData.data.reverse();
    return stockData;
}

export default simulate;
