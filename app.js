const createError = require('http-errors');
const express = require('express');
const path = require('path');

const fs = require('fs');
const readline = require('readline');
const stream = require('stream');

const orderRouter = require('./routes/order');
const userRouter = require('./routes/user');
const punchClockRouter = require('./routes/punch_clock');
const orderForm = require('./routes/orderForm');

const app = express(), port = process.env.PORT || 3000;

const connMgr = require('./util/transactionMgr')();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public', 'build')));

app.get('/packing_status_view', function(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'build', 'index.html'));
});

app.get('/sales_by_sku_view', function(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'build', 'index.html'));
});

app.use('/order/', orderRouter(connMgr));
app.use('/user/', userRouter(connMgr));
app.use('/punch/', punchClockRouter(connMgr));
app.use('/order_form/', orderForm(connMgr));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

app.listen(port, function() {
  console.log(`Example app listening on port ${port}`);
});

module.exports = app;
