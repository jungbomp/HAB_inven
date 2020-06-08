'use strict';

const fetch = require('node-fetch');
const express = require('express');
const router = express.Router();

let mgr = null;

const getEmployeeInfo = (employeeId) => {
    return new Promise((resolve, reject) => {
        const sQ = '\
            SELECT EMPLOYEE_ID\
                 , FIRST_NAME\
                 , LAST_NAME\
                 , DEPARTMENT_NAME\
                 , LAST_LOGIN_DTTM\
              FROM `USER`\
             WHERE EMPLOYEE_ID = ?';
        
        mgr.executeSelect(sQ, [employeeId]).then(resolve).catch(reject);
    });
}

const insertUser = (employeeId, firstName, middleName, lastName, departmentName, lastLoginDttm) => {
    return (connection => {
        const iQ = '\
            INSERT\
              INTO `USER` (\
                   EMPLOYEE_ID\
                 , FIRST_NAME\
                 , MIDDLE_NAME\
                 , LAST_NAME\
                 , DEPARTMENT_NAME\
                 , LAST_LOGIN_DTTM\
            )\
            VALUES (\
                   ?\
                 , ?\
                 , ?\
                 , ?\
                 , ?\
                 , ?\
            )';

        return new Promise((resolve, reject) => {
            connection.query(iQ, [employeeId, firstName, middleName, lastName, departmentName, lastLoginDttm], (err, results) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(results);
            });
        });
    });
}

const updateUser = (employeeId, firstName, middleName, lastName, departmentName, lastLoginDttm) => {
    return (connection => {
        const uQ = '\
            UPDATE `USER`\
               SET FIRST_NAME      = ?\
                 , MIDDLE_NAME     = ?\
                 , LAST_NAME       = ?\
                 , DEPARTMENT_NAME = ?\
                 , LAST_LOGIN_DTTM = ?\
             WHERE EMPLOYEE_ID     = ?';

        return new Promise((resolve, reject) => {
            connection.query(uQ, [firstName, middleName, lastName, departmentName, lastLoginDttm, employeeId], (err, results) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(results);
            });
        });
    });
}

const getCurrentDttm = () => {
    const date_ob = new Date(Date.now());

    // adjust 0 before single digit date
    
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

router.get('/', (req, res, next) => {
    console.log(`Can't find employee info.`);
    res.json({code: '900', status: 'Provide employee id'})
});

router.get('/:employeeId', (req, res, next) => {
    const employeeId = req.params.employeeId;
    
    getEmployeeInfo(employeeId).then(ret => {
        if (ret.length != 1) {
            console.log(`Can't find employee data.`);
            res.json({"code": 100, "status": `Can't find employee data with id ${employeeId}`});
            return;
        }

        const user = ret[0];
        res.json(user);
    }).catch(error => {
        console.log(error);
        if ("ENOTFOUND" === error.code) {
            res.json({"code": 100, "status": "Error in connection database"})
        }
    });
});

router.post('/add_user', function(req, res, next) {
    const curDttm = getCurrentDttm();
    const param = req.body;

    if ((param.EMPLOYEE_ID || '').length < 1) {
        console.log("Employee id is empty.");
        res.json({code: 400, status: "Employee id should not be empty."});
        return;
    }

    if ((param.FIST_NAME || param.LAST_NAME || param.MIDDLE_NAME || '').length < 1) {
        console.log("employee's name is empty.");
        res.json({code: 400, status: "Length of name should be longer than zero."});
    }
    
    let user = null;
    fetch(`http://localhost:3000/user/${param.EMPLOYEE_ID}`).then(res => res.json())
    .then(json => {
        if (param.EMPLOYEE_ID === json.EMPLOYEE_ID) {
            res.json({code: 100, status: "Employee id exists in the system."});
            return;
        }

        mgr.executeTransaction([insertUser(param.EMPLOYEE_ID, param.FIRST_NAME, param.MIDDLE_NAME, param.LAST_NAME, param.DEPARTMENT_NAME, curDttm)]).then(() => {
            res.json({"code": 200, "status": "Succed post request."});
        })
        .catch(error => {
            console.error(error);
            res.json({"code": 400, "status": "Post request failed."});
        });
    });
});

router.post('/modify_user', function(req, res, next) {
    const curDttm = getCurrentDttm();
    const param = req.body;

    if ((param.EMPLOYEE_ID || '').length < 1) {
        console.log("Employee id is empty.");
        res.json({code: 400, status: "Employee id should not be empty."});
        return;
    }

    if ((param.FIST_NAME || param.LAST_NAME || param.MIDDLE_NAME || '').length < 1) {
        console.log("employee's name is empty.");
        res.json({code: 400, status: "Length of name should be longer than zero."});
    }
    
    let user = null;
    fetch(`http://localhost:3000/user/${param.EMPLOYEE_ID}`).then(res => res.json())
    .then(json => {
        if ('100' === json.code) {
            res.json({code: 100, status: "Employee id doesn't exist in the system."});
            return;
        }

        param.FIRST_NAME = param.FIRST_NAME || json.FIRST_NAME;
        param.MIDDLE_NAME = param.MIDDLE_NAME || json.MIDDLE_NAME;
        param.LAST_NAME = param.LAST_NAME || json.LAST_NAME;
        param.DEPARTMENT_NAME = param.DEPARTMENT_NAME || json.DEPARTMENT_NAME;

        mgr.executeTransaction([updateUser(param.EMPLOYEE_ID, param.FIRST_NAME, param.MIDDLE_NAME, param.LAST_NAME, param.DEPARTMENT_NAME, curDttm)]).then(() => {
            res.json({"code": 200, "status": "Succed post request."});
        })
        .catch(error => {
            console.error(error);
            res.json({"code": 400, "status": "Post request failed."});
        });
    });
});

module.exports = (transactionMgr) => {
    mgr = transactionMgr;

    return router;
};
