'use strict';

const fetch = require('node-fetch');
const express = require('express');
const router = express.Router();

const fs = require("fs");
const readline = require("readline");
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');

const googleSpreadMgr = require('../util/googleSpreadMgr');
const datetimeUtil = require('../util/datetimeUtil')();
const googleMailUtil = require('../util/googleMailUtil');
const path = require('path');
const configReader = require('../util/configReader')();

const sgMail = require('@sendgrid/mail');
const { formatWithOptions } = require('util');

const readQuery = (queryId) => {
  const queryPath = path.join(process.env.__basedir, 'query', queryId) + '.sql';
  return fs.readFileSync(queryPath, {encoding: 'utf8', flag: 'r'});
}

function getQuery() {
  if (null === queryStr) {
    const queryPath = path.join(process.env.__basedir, 'query', queryId) + '.sql';
    queryStr = fs.readFileSync(queryPath, {encoding: 'utf8', flag: 'r'});
  }

  return queryStr;
}

const getQueryRetriever = (queryId) => {
  const func = (queryId => {
    let queryStr = null;
    return () => {
      if (null === queryStr) {
        queryStr = readQuery(queryId);
      }

      return queryStr;
    };
  })(queryId);
  return func;
}

const queries = {  
  retrieveProductList: getQueryRetriever('retrieveProductList'),
  retrieveAllProductList: getQueryRetriever('retrieveAllProductList'),
  retrieveProductOrderList: getQueryRetriever('retrieveProductOrderList'),  
  retrieveProductOrderDetail: getQueryRetriever('retrieveProductOrderDetail'),
  retrieveProductSizeVariant: getQueryRetriever('retrieveProductSizeVariant'),
  retrieveBrandList: getQueryRetriever('retrieveBrandList'),
  retrieveBrandListHasProduct: getQueryRetriever('retrieveBrandListHasProduct'),
  retrieveVendorList: getQueryRetriever('retrieveVendorList'),
  retrieveVendorMap: getQueryRetriever('retrieveVendorMap'),
  retrieveVendorProductList: getQueryRetriever('retrieveVendorProductList'),
  retrieveAllVendorProductList: getQueryRetriever('retrieveAllVendorProductList'),
  retrieveProductVariantList: getQueryRetriever('retrieveProductVariantList'),
  retrieveAllProductVariantList: getQueryRetriever('retrieveAllProductVariantList'),
  retrieveMaxProductOrderSeq: getQueryRetriever('retrieveMaxProductOrderSeq'),
  retrieveStdSkuBySizeColor: getQueryRetriever('retrieveStdSkuBySizeColor'),
  insertProductOrder: getQueryRetriever('insertProductOrder'),
  retrieveProductListForLabel: getQueryRetriever('retrieveProductListForLabel')
}

let mgr = null;

const getFetchFunc = (queryFunc) => {
  return (params) => {
    return new Promise((resolve, reject) => {
      const query = queryFunc();
      mgr.executeSelect(query, [...(params || [])]).then(resolve).catch(reject);
    });
  };
}

const getBrandList = getFetchFunc(queries.retrieveBrandList);
const getBrandListHasProducts = getFetchFunc(queries.retrieveBrandListHasProduct);
const getVendorList = getFetchFunc(queries.retrieveVendorList);
const getVendorMap = getFetchFunc(queries.retrieveVendorMap);
const getProductList = getFetchFunc(queries.retrieveProductList);
const getAllProductList = getFetchFunc(queries.retrieveAllProductList);
const getVendorProductList = getFetchFunc(queries.retrieveVendorProductList);
const getAllVendorProductList = getFetchFunc(queries.retrieveAllVendorProductList);
const getProductVariantList = getFetchFunc(queries.retrieveProductVariantList);
const getAllProductVariantList = getFetchFunc(queries.retrieveAllProductVariantList);
const getProductSizeVariantList = getFetchFunc(queries.retrieveProductSizeVariant);
const getMaxProductOrderSeq = getFetchFunc(queries.retrieveMaxProductOrderSeq);
const getStdSkuBySizeColor = getFetchFunc(queries.retrieveStdSkuBySizeColor);    

const insertProductOrder = ({ORDER_DATE, ORDER_SEQ, STD_SKU, PRODUCT_CODE, BRAND_CODE, VENDOR_CODE, ORDER_QTY, ORDER_TM, EMPLOYEE_ID}) => {
  return (connection => {
    const query = queries.insertProductOrder();

    return new Promise((resolve, reject) => {
      connection.query(query, [ORDER_DATE, ORDER_SEQ, STD_SKU, PRODUCT_CODE, BRAND_CODE, VENDOR_CODE, ORDER_QTY, ORDER_TM, EMPLOYEE_ID], (err, results) => {
        if (err) {
            reject(err);
            return;
        }

        resolve(results);
      });
    });
  });
}

const getProductListForLabel = getFetchFunc(queries.retrieveProductListForLabel);
const getOrderHistory = getFetchFunc(queries.retrieveProductOrderList);
const getOrderDetail = getFetchFunc(queries.retrieveProductOrderDetail);    

router.get('/brand_list', (req, res, next) => {
    getBrandListHasProducts().then(ret => {
        res.json(ret);
    }).catch(error => {
        console.log(error);
        if ("ENOTFOUND" === error.code) {
            res.json({"code": 100, "status": "Error in connection database"})
        }
    });
});

router.get('/vendor_list', (req, res, next) => {
    getVendorList().then(ret => {
        res.json(ret);
    }).catch(error => {
        console.log(error);
        if ("ENOTFOUND" === error.code) {
            res.json({"code": 100, "status": "Error in connection database"})
        }
    });
});

router.get('/product_list', (req, res, next) => {
    const brandCode = req.query.brand_code;

    getProductList([brandCode]).then(ret => {
        res.json(ret);
    }).catch(error => {
        console.log(error);
        if ("ENOTFOUND" === error.code) {
            res.json({"code": 100, "status": "Error in connection database"})
        }
    });
})

router.get('/all_product_list', (req, res, next) => {
  getAllProductList().then(ret => {
    res.json(ret);
  }).catch(error => {
    console.log(error);
    if ("ENOTFOUND" === error.code) {
      res.json({"code": 100, "status": "Error in connectino database"});
    }
  });
})

router.get('/vendor_product_list', (req, res, next) => {
    const vendorCode = req.query.vendor_code;

    getVendorProductList([vendorCode]).then(ret => {
        res.json(ret);
    }).catch(error => {
        console.log(error);
        if ("ENOTFOUND" === error.code) {
            res.json({"code": 100, "status": "Error in connection database"})
        }
    });
});

router.get('/all_vendor_product_list', (req, res, next) => {
  getAllVendorProductList().then(ret => {
    res.json(ret);
  }).catch(error => {
      console.log(error);
      if ("ENOTFOUND" === error.code) {
          res.json({"code": 100, "status": "Error in connection database"})
      }
  });
})

router.get('/product_variant_list', (req, res, next) => {
    const productCode = req.query.product_code;

    getProductVariantList([productCode]).then(ret => {
        res.json(ret);
    }).catch(error => {
        console.log(error);
        if ("ENOTFOUND" === error.code) {
            res.json({"code": 100, "status": "Error in connection database"})
        }
    });
});

router.get('/all_product_variant_list', (req, res, next) => {
  getAllProductVariantList().then(ret => {
    res.json(ret);
  }).catch(error => {
    console.log(error);
    if ("ENOTFOUND" === error.code) {
        res.json({"code": 100, "status": "Error in connection database"})
    }
  });
})

router.post('/export_to_google_spread', function(req, res, next) {
  const list = req.body.ORDER_LIST;
  const orderFormConfig = configReader.getOrderFormConfig();

  googleSpreadMgr.getChildren(orderFormConfig.ORDER_FORM_FORDER_ID, null)
    .then(async list => {
      const metaList = [];
      for (let i = 0; i < list.length; i++) {
        try {
          // const fileName = '[Order Form] Order History_2020_01';
          const meta = await googleSpreadMgr.getFileMetadata(list[i].id);
          metaList.push(meta);
        } catch (err) {
          reject(err);
        }
      }

      metaList.sort((v1, v2) => {
        const num1 = parseInt(v1.title.substring(v1.title.lastIndexOf('_')+1));
        const num2 = parseInt(v2.title.substring(v2.title.lastIndexOf('_')+1));

        return num2 - num1;
      });

      return metaList[0];
    }).then(fileMeta => {
      const curMonth = parseInt(datetimeUtil.getCurrentDttm().substring(4, 6));
      let fileName = fileMeta.title;

      if (parseInt(fileName.substring(fileName.lastIndexOf('_')+1)) < curMonth) {
        fileName = `${fileName.substring(0, fileName.lastIndexOf('_')+1)}${('0'+curMonth).slice(-2)}`;
        return googleSpreadMgr.createSpreadFile(fileName)
          .then(googleSpreadMgr.getFileMetadata)
          .then(meta => {
            return googleSpreadMgr.patchFile({ fileid: meta.id, addParents: orderFormConfig.ORDER_FORM_FORDER_ID, removeParents: meta.parents[0].id })            
          }).then(fileData => fileData.id);
      }

      return fileMeta.id;
    }).then(id => {
      const curDttm = datetimeUtil.getCurrentDttm();
      const day = parseInt(curDttm.substring(6, 8), 10);
      const time = datetimeUtil.convertTimeFormat(curDttm.substring(8));

      const requests = [];
      const addSheet = {
        addSheet: {
          properties: {
            title: `${day}${1 === day ? 'st' : 2 === day ? 'nd' : 3 === day ? 'rd' : 'th'} ${time}`
          }
        }
      }

      requests.push(addSheet);
      return googleSpreadMgr.spreadSheetUpdate({ spreadsheetId: id, requests: requests })
        .then(response => {
          const { index, sheetId, title } = response.replies[0].addSheet.properties;

          return { spreadsheetId: response.spreadsheetId, sheetIndex: index, sheetId: sheetId, sheetTitle: title };
        });
    }).then(({ spreadsheetId, sheetIndex, sheetId, sheetTitle }) => {
    //   return googleSpreadMgr.spreadSheetValuesGet({ spreadsheetId: spreadsheetId, range: `${sheetTitle}!A1:A` })
    //     .then(response => {
    //       return { spreadsheetId: spreadsheetId, sheetTitle: sheetTitle, numberOfRow: (response.values && response.values.length || 0) }
    //     });
    // }).then(({ spreadsheetId, sheetTitle, numberOfRow }) => {
      const data = [];
      const sheetAction = [];
      let curRow = 1;

      for (let i = 0; i < list.length; i++) {
        const order = list[i];
        const lastSizeCol = String.fromCharCode('E'.charCodeAt(0)+order.sizeVariant.length-1);
        const totalCol = String.fromCharCode(lastSizeCol.charCodeAt(0)+1);
        
        data.push({
          range: `${sheetTitle}!A${curRow}:D${curRow}`,
          values: [ ['VENDOR', 'ITEM', 'NAME', 'COLOR'] ]
        });

        data.push({
          range: `${sheetTitle}!E${curRow}:${totalCol}${curRow}`,
          values: [ [...order.sizeVariant.map(v => v.shortCode), 'TOTAL QTY'] ]
        });

        curRow++;

        data.push({
          range: `${sheetTitle}!A${curRow}:C${curRow}`,
          values: [ [order.brandName, order.productCode, order.productTitle] ]
        })

        for (let j = 0; j < order.order.length; j++) {
          data.push({
            range: `${sheetTitle}!D${curRow+j}:${lastSizeCol}${curRow+j}`,
            values: [ [order.colorVariant[j], ...order.order[j].map(v => 0 < v ? ''+v : '')] ]
          });
        }

        data.push({
          range: `${sheetTitle}!${totalCol}${curRow}:${totalCol}${curRow}`,
          values: [ [order.totalQty] ]
        });

        sheetAction.push({
          mergeCells: {
            range: {
              sheetId: sheetId,
              startRowIndex: curRow-1,
              endRowIndex: curRow + order.order.length - 1,
              startColumnIndex: 0,
              endColumnIndex: 3
            },
            mergeType: 'MERGE_COLUMNS'
          }
        });

        sheetAction.push({
          mergeCells: {
            range: {
              sheetId: sheetId,
              startRowIndex: curRow-1,
              endRowIndex: curRow + order.order.length - 1,
              startColumnIndex: totalCol.charCodeAt(0) - 'A'.charCodeAt(0),
              endColumnIndex: totalCol.charCodeAt(0) - 'A'.charCodeAt(0) + 1
            },
            mergeType: 'MERGE_COLUMNS'
          }
        });

        const border = {
          style: "SOLID",
          width: 1,
          color: {
            red: 0,
            green: 0,
            blue: 0,
            alpha: 1
          }
        };

        sheetAction.push({
          updateBorders: {
            range: {
              sheetId: sheetId,
              startRowIndex: curRow-2,
              endRowIndex: curRow + order.order.length - 1,
              startColumnIndex: 0,
              endColumnIndex: totalCol.charCodeAt(0) - 'A'.charCodeAt(0) + 1
            },
            top: border,
            bottom: border,
            left: border,
            right: border,
            innerHorizontal: border,
            innerVertical: border
          }
        });

        curRow = curRow + order.order.length + 1;
      }

      return googleSpreadMgr.spreadSheetValuesUpdate({ spreadsheetId: spreadsheetId, data: data })
        .then(googleSpreadMgr.spreadSheetUpdate({ spreadsheetId: spreadsheetId, requests: sheetAction }));

      // return googleSpreadMgr.spreadSheetValuesUpdate({ spreadsheetId: spreadsheetId, data: data });
    }).then(response => {
      res.json({ 'code': 200, 'status': `Updated order data into Google Spreadsheet.` });
    }).catch(err => {
      console.log(err);
    });
});

router.post('/place_order', function(req, res, next) {
    const list = req.body.ORDER_LIST;
    const isError = false;
    const transactionList = [];
    let numOfOrder = 0;

    if (list.length < 1) {
        console.log("The order list is empty.");
        res.json({code: 400, status: "The Order list is empty."});
        return;
    }

    getMaxProductOrderSeq([list[0].ORDER_DATE, list[0].ORDER_DATE]).then(ret => {
        if (ret.length < 1) {
          throw `Failed to get the maximum sequence from PRODUCT_ORDER with ORDER_DATE(${list[0].ORDER_DATE})`;
        }

        return { orderDate: ret[0].ORDER_DATE, orderSeq: ret[0].ORDER_SEQ };
    }).then(({ orderDate, orderSeq }) => {
      for (let i = 0; i < list.length; i++) {
        const order = list[i];
        order.ORDER_SEQ = orderSeq;
        
        transactionList.push(insertProductOrder(order));
        numOfOrder++;
      }

      if (numOfOrder === list.length) {
        mgr.executeTransaction(transactionList).then(async _ => {
          res.json({ 'code': 200, 'status': `Inserted ${numOfOrder} orders.` });

          ((orderDate, orderSeq) => {
            setTimeout(() => {
              fetch(`http://localhost:3000/order_form/send_email?order_date=${orderDate}&order_seq=${orderSeq}`);
            }, 100);
          })(orderDate, orderSeq);
        }).catch(error => {
          console.error(error);
          res.json({ 'code': 400, 'status': errMsg });
          throw "Failed to insert order into database.";
        });
      }
    }).catch(error => {
      console.error(error);
      res.json({ 'code': 400, 'status': errMsg });
    });
});

router.get('/order_history', function(req, res, next) {
  const curDate = datetimeUtil.getCurrentDttm().slice(0, 8);
  const orderDateFr = req.query.order_date_fr || curDate;
  const orderDateTo = req.query.order_date_to || curDate;

  getOrderHistory([orderDateFr, orderDateTo]).then(ret => {
    res.json(ret);
  }).catch(err => {
    if (err.status && -1 === err.status) {
        res.json(err);
        return;
    }

    console.log(err);
    return;
  });
});

router.get('/order_detail', function(req, res, next) {
  const orderDate = req.query.order_date;
  const orderSeq = req.query.order_seq;

  getOrderDetail([orderDate, orderSeq]).then(async ret => {
    const orderObj = {};
    ret.forEach(order => {
      const productColor = order.PRODUCT_COLOR.substring(order.PRODUCT_COLOR.lastIndexOf("_") + 1).trim();
      const orderSet = orderObj[order["PRODUCT_CODE"]] || {}
      const colorVariant = orderSet["colorVariant"] || {};
      const orderItems = colorVariant[productColor] || {};
      
      orderItems[order.SIZE_CODE] = order;

      order.PRODUCT_COLOR = productColor;
      colorVariant[order.PRODUCT_COLOR] = orderItems;
      colorVariant[order.PRODUCT_COLOR]["manufacturingColor"] = order.MANUFACTURING_COLOR;
      orderSet["colorVariant"] = colorVariant;
      orderSet["vendorCode"] = order.VENDOR_CODE;
      orderSet["vendorName"] = order.VENDOR_NAME;
      orderSet["ordersFrom"] = order.ORDERS_FROM;
      orderSet["brandName"] = order.BRAND_NAME;
      orderSet["vendorEmail"] = order.VENDOR_EMAIL;
      orderSet["productTitle"] = order.PRODUCT_TITLE;
      orderSet["productCode"] = order.PRODUCT_CODE;
      orderSet["manufacturingCode"] = order.MANUFACTURING_CODE
      orderSet["totalQty"] = (orderSet["totalQty"] || 0) + order.ORDER_QTY;
      orderSet["employeeId"] = order.EMPLOYEE_ID;
      orderSet["employeeName"] = order.EMPLOYEE_NAME;
      orderSet["orderDate"] = order.ORDER_DATE;
      orderSet["orderSeq"] = order.ORDER_SEQ;
      orderObj[order.PRODUCT_CODE] = orderSet;
    });

    const orderList = [];
    for (let item in orderObj) {
      const orderSet = orderObj[item];
      
      const colorVariant = [];
      for (let color in orderSet.colorVariant) {
        colorVariant.push({
          productColor: color,
          manufacturingColor: orderSet.colorVariant[color].manufacturingColor,
          sizeVariant: orderSet.colorVariant[color]
        });
      }

      orderSet.colorVariant = colorVariant;

      const sizeVariant = await getProductSizeVariantList([item]);
      orderSet['sizeVariant'] = sizeVariant;

      orderList.push(orderSet);
    }

    res.json(orderList);
  }).catch(err => {
    if (err.status && -1 === err.status) {
        res.json(err);
        return;
    }

    console.log(err);
    return;
  });
});

router.get('/send_email', async function(req, res, next) {
  const orderDate = req.query.order_date;
  const orderSeq = req.query.order_seq;

  const orderList = await (await fetch(`http://localhost:3000/order_form/order_detail?order_date=${orderDate}&order_seq=${orderSeq}`)).json();
  const ret = await sendEmail(orderList);

  res.json(ret);
});

router.get('/labels', function(req, res, next) {
  const productCode = req.query.product_code || '';

  // fs.readFile('./unvalid/product_id.txt', "utf8", (err, data) => {
  //   if (err) throw err;

  //   const productIds = data.split('\n');
  //   const unvalied = [];
  //   productIds.forEach(productId => {
  //     const perProduct = JSON.parse(fs.readFileSync(`./unvalid/${productId}.json`, 'utf8'));
  //     perProduct.forEach(unvalid => {
  //       unvalied.push(`${productId}\t${unvalid.STD_SKU}\t${unvalid.NAME}\t${unvalid.SIZE}\t${unvalid.COLOR}\t${unvalid.IMAGE_PATH}\n`);
  //     });
  //   });


  //   let buffer = Buffer.from('PRODUCT_CODE\tSTD_SKU\tPRODUCT_NAME\tPRODUCT_SIZE\tPRODUCT_COLOR\tIMAGE_URL\n');
  //   unvalied.forEach(line => {
  //     buffer = Buffer.concat([buffer, Buffer.from(line)]);
  //   });
  //   fs.writeFile('./unvalid.tsv', buffer, function(err) {
  //     if (err) throw err;

  //     console.log('done!');
  //     res.json(unvalied);
  //   });
  // });

  // return;

  if ((productCode || '').length < 1) {
    res.json({ 'code': 400, 'status': 'Product id is null' });
    return;
  }

  getProductListForLabel([productCode]).then(async (labelList) => {
    const unvalidList = [];
    const labelChunks = labelList.filter((v) => {
      if ((v.COLOR || '').length < 1 || (v.IMAGE_PATH || '').length < 1 || (v.SIZE || '').length < 1) {
        unvalidList.push(`${productCode}\t${v.STD_SKU}\t${v.NAME}\t${v.SIZE}\t${v.COLOR}\t${v.IMAGE_PATH}`);
        // unvalidList.push(v);
        return false;
      }

      return true;
    }).reduce((acc, cur, i) => {
      const index = Math.floor(i / 4);
      if (acc.length < index + 1) {
        acc.push([]);
      }

      acc[index].push(cur);
      return acc;
    }, []);
    
    // const unvalidListBuffer = Buffer.from(JSON.stringify(unvalidList), "utf-8");

    fs.appendFile(`./unvalid.tsv`, unvalidList.join('\n')+'\n', function(err) {
      if(err) {
          return console.log(err);
      }

      console.log(`./unvalid.tsv file was saved!`);
    });
    
    const pdfPromises = labelChunks.map((chunk) => {
      const html = getLabelHtml(chunk);
      // res.send(html);
      return createPDFFile(html);
    });

    return Promise.all(pdfPromises);
  }).then((values) => {
    const loadPromises = values.map((value) => PDFDocument.load(value));
    return Promise.all(loadPromises);
  }).then(async (values) => {
    const doc = await PDFDocument.create();

    const pagePromises = values.map((value) => doc.copyPages(value, [0]));
    const pages = await Promise.all(pagePromises);

    pages.forEach(([page]) => doc.addPage(page));
    const u8Array = await doc.save();
    const buffer = Buffer.from(u8Array);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': buffer.length,
      'Content-Disposition': `attachment; filename=${productCode}.pdf`
     });
    res.end(buffer);
  }).catch(err => {
    if (err.status && -1 === err.status) {
        res.json(err);
        return;
    }

    console.log(err);
    return;
  });
});

async function sendEmail(orderList) {
  console.log('sendEmail: ', orderList);
  const indices = {};
  const orderListByVendor = [];
  orderList.forEach(orderSet => {
    if (false === (orderSet.vendorCode in indices)) {
      orderListByVendor.push({
        vendorCode: orderSet.vendorCode,
        vendorName: orderSet.vendorName,
        vendorEmail: orderSet.vendorEmail,
        ordersFrom: orderSet.ordersFrom,
        employeeId: orderSet.employeeId,
        employeeName: orderSet.employeeName,
        orderDate: orderSet.orderDate,
        orderSeq: orderSet.orderSeq,
        orderList: []
      });
      indices[orderSet.vendorCode] = orderListByVendor.length - 1;
    }

    orderListByVendor[indices[orderSet.vendorCode]].orderList.push(orderSet);
  });
  
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  
  const curDttm = datetimeUtil.getCurrentDttm();
  const yyyy = curDttm.substring(0, 4);
  const mm = curDttm.substring(4, 6);
  const dd = curDttm.substring(6, 8);

  orderListByVendor.forEach(async vendorOrderObj => {

    const html = getHtml(vendorOrderObj.orderList);
    var fs = require('fs');
    fs.writeFileSync('test.html', html);
      
    const buffer = await createPDFFile(html);
    fs.writeFileSync('test.pdf', buffer);

    const base64Encorded = buffer.toString('BASE64');
    const ordersFrom = (vendorOrderObj.ordersFrom || '').length === 0 ? 'JC Sky, Inc (Hat and Beyond)' : vendorOrderObj.ordersFrom;
    const employeeName = (vendorOrderObj.employeeName || '').length === 0 ? ordersFrom : vendorOrderObj.employeeName;
    const orderSeq = ('0000000000' + vendorOrderObj.orderSeq).slice(-10);

    vendorOrderObj.vendorEmail = "Einber.Tee@cottonheritage.com";


    const msg = {
      to: vendorOrderObj.vendorEmail.split(" ").map((addr) => ({ email: addr, name: vendorOrderObj.vendorName })),
      cc: [
        // {email: 'jcsky.jaik@gmail.com', name: 'jai'},
        // {email: 'jcsky.louis@gmail.com', name: 'louis'},
        // {email: 'jcsky.edwardp@gmail.com', name: 'edwardp'},
        // {email: 'jcsky.daniell@gmail.com', name: 'daniell'},
        // {email: 'jcsky.acct@gmail.com', name: 'acct'},
        // {email: 'jungbom@hatandbeyond.com', name: 'acct'},
        // {email: 'jcsky.tedk@gmail.com', name: 'Ted'}
      ],
      from: {email: process.env.SENDGRID_DEFAULT_EMAIL_ADDRESS, name: process.env.SENDGRID_DEFAULT_EMAIL_SENDER_NAME},
      //subject: `${mm}/${dd}/${yyyy} ${ordersFrom} ORDER`,
      subject: `Test order`,
      text: 'Hello world',
      html: `<div>
              <div><span>Dear ${vendorOrderObj.vendorName},</span></div>
              <div><br /><div>
              <div><span>Please find the attachment and note that the unit used for all orders is single piece - e.g. 10 = 10 pcs.</span></div>
              <div><br /></div>
              <div><span>Order #${orderSeq}</span></div>
              <div><br /></div>
              <div><span>Best,</span></div>
              <div><span>${employeeName} ${ordersFrom}
            </div>`,
      attachments: [{
        content: base64Encorded,
        filename: `${ordersFrom}_${vendorOrderObj.vendorName}_${orderSeq} ${mm}-${dd}-${yyyy}.pdf`
      }]
    };

    sgMail.send(msg).then(response => {
      console.log(response);
      // res.json(response);
    });
  });

  //(orderListByVendor);
  return orderListByVendor;
}

async function createPDFFile(htmlString, fileName, callback) {
  var options = {
    format: 'Letter',
    orientation: 'landscape',
    // header: {
    //   eight: '15mm',
    //   contents: `<img alt=’Clintek logo’ 
    //                       height=’100' 
    //                       width=’100'
    //                       src=’http://52.207.115.173:9191/files/5a6597eb7a67600c64ce52cf/?api_key=25BDD8EC59070421FDDE3C571182F6F12F5AAF99FF821A285884E979F3783B23'>`
    // },
    // timeout: 600000,
    // footer: {
    //   height: '15mm',
    //   contents: {
    //     first: `<div>
    //                 <span>1</span>
    //               </div>`,
    //     2: `<div>
    //               <span>2</span>
    //         </div>`,  // Any page number is working. 1-based index
    //     3: `<div>
    //               <span>3</span>
    //           </div>`,
    //     4: `<div>
    //             <span>4</span>
    //         </div>`,
    //     5: `<div>
    //             <span>6</span>
    //           </div>`,
    //     6: `<div>
    //             <span>7</span>
    //           </div>`,
    //     default: `<div>
    //                       <span>Appointment Report</span>
    //                 </div>`, // fallback value
    //     last: `<div>
    //                     <span>Last Page</span>
    //             </div>`,
    //   }
    // }
  };

  /**
   * It will create PDF of that HTML into given folder.
   */ 

  const browser = await puppeteer.launch({ headless: true});
  const page = await browser.newPage();
  // Configure the navigation timeout
  await page.setDefaultNavigationTimeout(0);
  await page.setContent(htmlString, { "waitUntil" : "networkidle0" });
  await page.addStyleTag({
    content: `
      body { margin-top: 0; }
      @page:first { margin-top: 0 }
    `,
  });

  const buffer = await page.pdf({
    path: 'test.pdf',
    // format: "A4",
    landscape: true,
    margin: { left: 0, top: 0, right: 0, bottom: 0 },
    PreferCSSPageSize: true
  });
  await browser.close();

  return await buffer;
}

function getHtml(orderList) {
  var contents = fs.readFileSync('./views/orderDetail.ejs', 'utf8');
  var html = ejs.render(contents, {orderList: orderList});
  // console.log(html);

  return html;
} 

function getLabelHtml(labelList) {
  const contents = fs.readFileSync('./views/test.ejs', 'utf8');
  const html = ejs.render(contents, {labelList: labelList});
  return html;
}

module.exports = (transactionMgr) => {
    mgr = transactionMgr;
    return router;
};
