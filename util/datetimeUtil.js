'use strict';

const getDttm = date_ob => {
    // current year
    let yyyy = date_ob.getFullYear();

    // current month
    let mm = ("0" + (date_ob.getMonth() + 1)).slice(-2);

    // current date
    let dd = ("0" + date_ob.getDate()).slice(-2);

    // current hours
    let hh = ("0" + date_ob.getHours()).slice(-2);

    // current minutes
    let mi = ("0" + date_ob.getMinutes()).slice(-2);

    // current seconds
    let ss = ("0" + date_ob.getSeconds()).slice(-2);

    return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

const getCurrentDttm = () => {
    return getDttm(new Date(Date.now()));
}

const convertDateFromat = date => {
    const yyyy = date.slice(0, 4);
    const mm = date.slice(4, 6);
    const dd = date.slice(6, 8);

    return `${yyyy}-${mm}-${dd}`;
}

const convertTimeFormat = time => {
    const hh = time.slice(0, 2);
    const mi = time.slice(2, 4);
    const ss = time.slice(4, 6);

    return `${hh}:${mi}:${ss}`;
}

const convertDatetimeFormat = dttm => {
    return `${convertDateFromat(dttm.slice(0, 8))} ${convertTimeFormat(dttm.slice(-6))}`;
}

module.exports = () => {
    return {
        getCurrentDttm: getCurrentDttm,
        convertDateFromat: convertDateFromat,
        convertTimeFormat: convertTimeFormat,
        convertDatetimeFormat: convertDatetimeFormat,
    };
};