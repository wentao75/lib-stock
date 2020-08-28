import moment from "moment";
import CG from "console-grid";
import { formatFxstr } from "./util";
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
            day: "",
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
            day: "周一",
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
            day: "周二",
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
            day: "周三",
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
            day: "周四",
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
            day: "周五",
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

    // 采用console-grid打印格式
    let grid = new CG();
    let CGS = CG.Style;
    let columns = [
        { id: "workday", name: "日期", type: "string", align: "left" },
        { id: "count", name: "交易次数", type: "number", align: "right" },
        { id: "win_ratio", name: "盈利比例", type: "number", align: "right" },
        { id: "win_average", name: "平均盈利", type: "number", align: "right" },
        { id: "loss_ratio", name: "亏损比例", type: "number", align: "right" },
        {
            id: "loss_average",
            name: "平均亏损",
            type: "number",
            align: "right",
        },
        { id: "ratio_winloss", name: "盈亏比", type: "number", align: "right" },
        {
            id: "profit_average",
            name: "平均利润",
            type: "number",
            align: "right",
        },
        { id: "max_loss", name: "最大亏损", type: "number", align: "right" },
        { id: "profit", name: "利润", type: "number", align: "right" },
    ];
    let rows = [];
    for (let report of reports) {
        rows.push({
            workday:
                report.win_ratio > 0.5 && report.profit >= 0
                    ? CGS.red(report.day)
                    : report.day,
            count: report.count,
            win_ratio:
                report.win_ratio >= 0.5
                    ? CGS.red(`${(report.win_ratio * 100).toFixed(1)}%`)
                    : `${(report.win_ratio * 100).toFixed(1)}%`, //CGS.green
            win_average: `${formatFxstr(report.win)}`,
            loss_ratio:
                report.loss_ratio >= 0.5
                    ? CGS.green(`${(report.loss_ratio * 100).toFixed(1)}%`)
                    : `${(report.loss_ratio * 100).toFixed(1)}%`,
            loss_average: `${formatFxstr(report.loss)}`,
            ratio_winloss:
                report.ratio_winloss < -1
                    ? CGS.cyan(`${(-report.ratio_winloss).toFixed(2)}`)
                    : `${(-report.ratio_winloss).toFixed(2)}`,
            profit_average:
                report.average >= 0
                    ? CGS.red(`${formatFxstr(report.average)}`)
                    : CGS.green(`${formatFxstr(report.average)}`),
            max_loss: `${formatFxstr(report.max_loss)}`,
            profit:
                report.profit >= 0
                    ? CGS.red(`${report.profit.toFixed(2)}`)
                    : CGS.green(`${report.profit.toFixed(2)}`),
        });
    }
    let data = {
        option: {},
        columns,
        rows,
    };
    grid.render(data);

    // 采用console-table-printer库打印格式
    // const p = new Table({
    //     columns: [
    //         { name: "workday", alignment: "center" },
    //         { name: "count", alignment: "right" },
    //         { name: "win ratio", alignment: "right" },
    //         { name: "win/trade", alignment: "right" },
    //         { name: "loss ratio", alignment: "right" },
    //         { name: "loss/trade", alignment: "right" },
    //         { name: "ratio win/loss", alignment: "right" },
    //         { name: "profit/trade", alignment: "right" },
    //         { name: "max loss", alignment: "right" },
    //         { name: "profit", alignment: "right" },
    //     ],
    // });
    // for (let report of reports) {
    //     p.addRow(
    //         {
    //             workday: report.day,
    //             count: report.count,
    //             "win ratio": `${(report.win_ratio * 100).toFixed(1)}%`,
    //             "win/trade": `${report.win.toFixed(2)}`,
    //             "loss ratio": `${(report.loss_ratio * 100).toFixed(1)}%`,
    //             "loss/trade": `${report.loss.toFixed(2)}`,
    //             "ratio win/loss": `${(-report.ratio_winloss).toFixed(2)}`,
    //             "profit/trade": `${report.average.toFixed(2)}`,
    //             "max loss": `${report.max_loss.toFixed(2)}`,
    //             profit: `${report.profit.toFixed(2)}`,
    //         },
    //         { color: report.win_ratio > 0.5 ? "red" : "green" }
    //     );
    // }
    // p.printTable();
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
