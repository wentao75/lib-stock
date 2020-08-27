import moment from "moment";
import { Table } from "console-table-printer";
import debugpkg from "debug";
const debug = debugpkg("reports");

function parseWorkdayReports(transactions) {
    if (!transactions || transactions.length <= 0) return;
    // 报告包含5+1行信息，1-5对应周一到周五的信息，0表示汇总
    // 每行信息包括：count(交易次数), win_ratio(盈利比例)，win(平均盈利金额)，
    //      loss_ratio(亏损比例) ，loss（平均亏损金额），ratio_winloss(盈利亏损比),
    //      average(平均交易规模), max_loss（最大亏损），profit(利润)
    let results = [
        {
            day: "Total",
            count: 0,
            count_win: 0,
            count_loss: 0,
            win_ratio: 0,
            win: 0,
            loss_ratio: 0,
            loss: 0,
            ratio_winloss: 0,
            average: 0,
            max_win: 0,
            max_loss: 0,
            profit: 0,
        },
        {
            day: "Monday",
            count: 0,
            count_win: 0,
            count_loss: 0,
            win_ratio: 0,
            win: 0,
            loss_ratio: 0,
            loss: 0,
            ratio_winloss: 0,
            average: 0,
            max_win: 0,
            max_loss: 0,
            profit: 0,
        },
        {
            day: "Tuesday",
            count: 0,
            count_win: 0,
            count_loss: 0,
            win_ratio: 0,
            win: 0,
            loss_ratio: 0,
            loss: 0,
            ratio_winloss: 0,
            average: 0,
            max_win: 0,
            max_loss: 0,
            profit: 0,
        },
        {
            day: "Wednesday",
            count: 0,
            count_win: 0,
            count_loss: 0,
            win_ratio: 0,
            win: 0,
            loss_ratio: 0,
            loss: 0,
            ratio_winloss: 0,
            average: 0,
            max_win: 0,
            max_loss: 0,
            profit: 0,
        },
        {
            day: "Thursday",
            count: 0,
            count_win: 0,
            count_loss: 0,
            win_ratio: 0,
            win: 0,
            loss_ratio: 0,
            loss: 0,
            ratio_winloss: 0,
            average: 0,
            max_win: 0,
            max_loss: 0,
            profit: 0,
        },
        {
            day: "Friday",
            count: 0,
            count_win: 0,
            count_loss: 0,
            win_ratio: 0,
            win: 0,
            loss_ratio: 0,
            loss: 0,
            ratio_winloss: 0,
            average: 0,
            max_win: 0,
            max_loss: 0,
            profit: 0,
        },
    ];

    for (let trans of transactions) {
        let buy = trans.buy;
        // let sell = trans.sell;
        let date = moment(buy.date, "YYYYMMDD");
        let day = date.day();
        if (day < 1 && day > 5) {
            // 超出了周一～周五的范围，跳过这个日期
            debug(`${buy.tradeDate}交易超出星期范围：${day}, %o`, trans);
            continue;
        }

        let days = [0, day];
        // console.log(`%o`, days);
        // console.log(
        //     `%o, ${buy.tradeDate}, ${date}, ${day}, %o %o`,
        //     trans,
        //     days,
        //     results
        // );
        for (let index of days) {
            let res = results[index];
            res.count++;
            res.profit += trans.profit;
            if (trans.profit >= 0) {
                res.count_win++;
                res.win += trans.profit;
                if (res.max_win < trans.profit) res.max_win = trans.profit;
            } else {
                res.count_loss++;
                res.loss += trans.profit;
                if (res.max_loss > trans.profit) res.max_loss = trans.profit;
            }
            // console.log(`${index}, %o`, res);
        }
    }
    for (let res of results) {
        res.win_ratio = res.count_win / res.count;
        res.win = res.win / res.count_win;
        res.loss_ratio = res.count_loss / res.count;
        res.loss = res.loss / res.count_loss;
        res.ratio_winloss = res.win / res.loss;
        res.average = res.profit / res.count;
    }
    return results;
}

function showWorkdayReports(log, transactions) {
    let reports = parseWorkdayReports(transactions);
    // console.log("%o", reports);

    //     let days = ["总计", "周一", "周二", "周三", "周四", "周五"];
    //     log(`
    // 工作日    交易次数    盈利比例    平均盈利    亏损比例    平均亏损    盈亏比    平均利润    最大亏损    利润`);
    //     for (let report of reports) {
    //         log(
    //             `${report.day}       ${report.count}          ${(
    //                 report.win_ratio * 100
    //             ).toFixed(1)}%    ${report.win.toFixed(2)}    ${(
    //                 report.loss_ratio * 100
    //             ).toFixed(1)}%    ${report.loss.toFixed(
    //                 2
    //             )}    ${report.ratio_winloss.toFixed(
    //                 2
    //             )}    ${report.average.toFixed(2)}    ${report.max_loss.toFixed(
    //                 2
    //             )}    ${report.profit.toFixed(2)}`
    //         );
    //     }
    // 采用console-table-printer库打印格式
    const p = new Table({
        columns: [
            { name: "workday", alignment: "center" },
            { name: "count", alignment: "right" },
            { name: "win ratio", alignment: "right" },
            { name: "win/trade", alignment: "right" },
            { name: "loss ratio", alignment: "right" },
            { name: "loss/trade", alignment: "right" },
            { name: "ratio win/loss", alignment: "right" },
            { name: "profit/trade", alignment: "right" },
            { name: "max loss", alignment: "right" },
            { name: "profit", alignment: "right" },
        ],
    });
    for (let report of reports) {
        p.addRow(
            {
                workday: report.day,
                count: report.count,
                "win ratio": `${(report.win_ratio * 100).toFixed(1)}%`,
                "win/trade": `${report.win.toFixed(2)}`,
                "loss ratio": `${(report.loss_ratio * 100).toFixed(1)}%`,
                "loss/trade": `${report.loss.toFixed(2)}`,
                "ratio win/loss": `${(-report.ratio_winloss).toFixed(2)}`,
                "profit/trade": `${report.average.toFixed(2)}`,
                "max loss": `${report.max_loss.toFixed(2)}`,
                profit: `${report.profit.toFixed(2)}`,
            },
            { color: report.win_ratio > 0.5 ? "red" : "green" }
        );
    }
    p.printTable();
}

export { parseWorkdayReports, showWorkdayReports };

//
// {
//     transeq: stock.transeq,
//     tradeDate: translog.tradeDate,
//     profit: stock.buy.total + translog.total,
//     income: translog.count * translog.price - stock.count * stock.price,
//     buy: stock.buy,
//     sell: translog,
// }
// transaction
// {
//     date: tradeDate,
//     dateIndex: tradeDateIndex,
//     type: "buy",
//     count: count,
//     price,
//     total: total.total,
//     amount: total.amount,
//     fee: total.fee,
//     commission: total.commission,
//     duty: total.duty,
//     methodType,
//     memo,
// }
